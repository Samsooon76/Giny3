import {
  loadBubble,
  type Actors,
  type BubbleScene,
  type Descriptor,
} from '../bubble/runtime'
import { nativeGrid } from '../bubble/grid'
import { Overlays } from '../bubble/Overlays'
import { Labels } from '../bubble/Labels'
import { Combat } from '../bubble/Combat'
import type { GameRendererOptions } from '../bubble/options'
import { CombatDisplayController } from '../combat/CombatDisplayController'
import type { CombatEvent, CombatState } from '../../giny/combatState'
import {
  CHAT_CHANNEL,
  type ChatLine,
  type HudSpell,
  type WorldSession,
} from '../../giny/types'
import { stripChatMarkup } from '../../giny/chatText'
import type { InteractiveEvent } from '../../giny/parsers'
import {
  DEFAULT_OVERLAY_OPTIONS,
  readHeapMemoryMB,
  type OverlayOptions,
} from '../../debug/stats'
import { DEFAULT_MAP_ID } from '../../data/assetUrl'
import { worldDisplayStore } from '../../ui/game/worldDisplayStore'
import { buildMapEdges, findEdgeHover, type EdgeHover, type MapEdgeIndex } from '../maps/edges'
import type { CellGrid } from '../cells/CellGrid'
import { bindWorldInput } from './WorldInput'
import { logError } from '../../debug/sessionLogger'
export type { GameRendererOptions }
const PREVIEW_LOOK =
  '{1|10,2012|1=#e3ad72,2=#8b452f,3=#db8a35,4=#66512e,5=#302b28|50}'

/** Giny owns game state and network messages; Bubble owns world presentation. */
export class GameRenderer {
  readonly combatDisplay = new CombatDisplayController()
  private options: GameRendererOptions
  private session?: WorldSession
  private scene?: BubbleScene
  private actors?: Actors
  private canvas?: HTMLCanvasElement
  private transitionIndicator?: HTMLDivElement
  private labels?: Labels
  private grid?: CellGrid
  private overlays?: Overlays
  private combat?: Combat
  private spell: HudSpell | null = null
  private mapId: number
  private requestedMap: number | null = null
  private loadQueue: Promise<void> = Promise.resolve()
  private controller = new AbortController()
  private loadController = new AbortController()
  private destroyed = false
  private loading = true
  private frame = 0
  private clock = 0
  private lastTime = 0
  private frames = 0
  private loadMs = 0
  private fps = 0
  private hovered = -1
  private selected = -1
  private path: number[] = []
  private queuedMovements = new Map<number, { mapId: number; path: number[] }>()
  private movementPending = false
  private intent = 0
  private overlay: OverlayOptions = { ...DEFAULT_OVERLAY_OPTIONS }
  private edges: MapEdgeIndex = {
    edges: [],
    bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
  }
  private edgeHover: EdgeHover | null = null
  private hoverIntent = 0
  private cleanups: (() => void)[] = []
  constructor(options: GameRendererOptions) {
    this.options = options
    this.session = options.session
    this.mapId = options.session?.mapId ?? options.mapId ?? DEFAULT_MAP_ID
  }
  async mount(host: HTMLElement) {
    const runtime = await loadBubble()
    if (this.destroyed) return
    const canvas = document.createElement('canvas')
    canvas.setAttribute('aria-label', 'Carte du monde')
    Object.assign(canvas.style, {
      display: 'block',
      width: '100%',
      height: '100%',
      touchAction: 'none',
    })
    host.append(canvas)
    this.canvas = canvas
    const transitionIndicator = document.createElement('div')
    transitionIndicator.className = 'map-transition-indicator'
    transitionIndicator.dataset.testid = 'map-transition-indicator'
    transitionIndicator.setAttribute('aria-hidden', 'true')
    transitionIndicator.textContent = '➜'
    Object.assign(transitionIndicator.style, {
      position: 'fixed', display: 'none', zIndex: '45', pointerEvents: 'none',
      width: '48px', height: '48px', lineHeight: '43px', textAlign: 'center',
      color: '#fff4a3', background: 'rgba(42, 35, 13, .86)',
      border: '3px solid #f5e56b', borderRadius: '50%', boxSizing: 'border-box',
      font: 'bold 34px/42px system-ui', textShadow: '0 2px 2px #000',
      boxShadow: '0 3px 12px rgba(0,0,0,.75)',
    })
    host.append(transitionIndicator)
    this.transitionIndicator = transitionIndicator
    this.scene = new runtime.__BubbleMapScene(canvas)
    this.actors = new runtime.__BubbleNativeActors(this.scene)
    await this.actors.init()
    if (this.destroyed) return
    this.labels = new Labels(host, canvas, this.scene, this.actors)
    this.bindInput()
    const display = () => {
      const state = worldDisplayStore.snapshot(),
        groups = new Set(this.scene?.gfxVisibleGroups)
      if (state.foreground) groups.add('foreground')
      else groups.delete('foreground')
      this.scene?.setGfxVisibleGroups(groups)
    }
    this.cleanups.push(
      worldDisplayStore.subscribe(display),
      this.combatDisplay.onChange(() => {
        this.combat?.setGridVisible(this.combatDisplay.grid)
        void this.combat
          ?.setTactical(this.combatDisplay.tactical)
          .catch((e) => this.report(e))
      }),
    )
    display()
    this.tick(performance.now())
    await this.loadMap(this.mapId)
    if (
      import.meta.env.DEV ||
      new URLSearchParams(location.search).has('benchmark')
    )
      Object.assign(window, {
        __ginyPerformance: () => this.performanceSnapshot(),
        __ginyRenderer: this,
      })
  }
  private report(error: unknown) {
    if (!this.destroyed) {
      const message = error instanceof Error ? error.message : String(error)
      logError('renderer-error', error, {
        mapId: this.mapId, requestedMap: this.requestedMap,
        sessionMapId: this.session?.mapId, characterId: this.session?.character.id,
        look: this.session?.character.look, cameraZoom: this.scene?.camera.zoom,
        hoveredCell: this.hovered, selectedCell: this.selected, path: [...this.path],
        actors: this.actors?.diagnostics,
      })
      this.options.onError?.(message)
      console.error(error)
    }
  }
  private async loadMap(id: number) {
    if (this.requestedMap === id) return this.loadQueue
    this.requestedMap = id
    this.loadController.abort()
    this.loadController = new AbortController()
    const signal = this.loadController.signal
    this.loading = true
    this.clearWorldHover()
    this.intent++
    this.options.onLoading?.(true)
    this.options.onMapError?.(null)
    const load = this.loadQueue
      .catch(() => {})
      .then(async () => {
        if (signal.aborted || this.destroyed || !this.scene || !this.actors)
          return
        const start = performance.now()
        this.combat?.destroy()
        this.combat = undefined
        this.overlays?.destroy()
        this.labels?.clear()
        await this.actors.sync([], { force: true })
        const bc7 =
          this.scene.supportsBc7Textures &&
          new URLSearchParams(location.search).get('textures') !== 'lossless'
        try {
          await this.scene.load(id, '/bubble/data/map3', 0, {
            atlasSource: bc7 ? 'ktx' : 'packs',
            mapKtxProfile: bc7 ? 'bc7' : undefined,
            binFormat: 'bin',
            signal,
          })
        } catch (error) {
          const failure = error as { status?: number; url?: string }
          if (
            !bc7 ||
            signal.aborted ||
            failure.status !== 404 ||
            !failure.url?.includes('/textures-ktx-bc7/')
          )
            throw error
          await this.scene.load(id, '/bubble/data/map3', 0, {
            atlasSource: 'packs',
            binFormat: 'bin',
            signal,
          })
        }
        if (signal.aborted || this.destroyed) return
        this.mapId = id
        const { grid, map } = nativeGrid(
          this.actors,
          this.scene.loadedScene!.map,
          id,
        )
        this.grid = grid
        this.edges = buildMapEdges(map, grid)
        this.overlays = new Overlays(this.scene, grid)
        this.scene.fitCamera()
        await this.syncWorld(true)
        if (signal.aborted || this.destroyed) return
        this.clock = 0
        this.loadMs = performance.now() - start
        this.scene.render(0, this.actors.tick(0), [], { tacticalMode: false })
        this.loading = false
        this.requestedMap = null
        this.flushMovements()
        this.emitStats()
        this.options.onLoading?.(false)
      })
      .catch((error) => {
        if (!signal.aborted && !this.destroyed) {
          this.requestedMap = null
          this.options.onMapError?.(
            error instanceof Error ? error.message : String(error),
          )
          this.report(error)
          throw error
        }
      })
    this.loadQueue = load
    return load
  }
  private descriptors(): Descriptor[] {
    const s = this.session
    if (!s || s.mapId !== this.mapId) {
      if (s) return []
      const cell = this.grid?.firstWalkable() ?? 276
      return [
        {
          id: 1,
          name: 'Personnage',
          kind: 'character',
          look: PREVIEW_LOOK,
          cell,
          direction: 1,
        },
      ]
    }
    const actors = s.actors
      .filter((a) => a.id !== s.character.id && a.entity_look)
      .map((a) => ({
        id: a.id,
        name: a.name,
        kind: a.kind.toLowerCase().includes('monster')
          ? 'monster'
          : a.kind.toLowerCase(),
        look: a.entity_look,
        cell: a.cell_id,
        direction: a.direction,
      }))
    actors.push({
      id: s.character.id,
      name: s.character.name,
      kind: 'character',
      look: s.character.look,
      cell: s.cellId,
      direction: s.direction,
    })
    return actors
  }
  private async syncWorld(force = false) {
    if (!this.combat) {
      await this.actors?.sync(this.descriptors(), {
        force,
        signal: this.loadController.signal,
      })
      this.actors?.syncInteractives(this.session?.interactives ?? [])
      this.flushMovements()
    }
  }
  async setSession(session: WorldSession) {
    this.session = session
    if (!this.scene) return
    if (this.combat) return
    if (session.mapId !== this.mapId || this.loading) {
      await this.loadMap(session.mapId)
      return
    }
    await this.syncWorld()
  }
  resyncWorldPosition(session: WorldSession) {
    this.session = session
    this.intent++
    if (session.mapId !== this.mapId) {
      void this.setSession(session).catch((e) => this.report(e))
      return
    }
    if (!this.combat) void this.syncWorld(true).catch((e) => this.report(e))
  }
  retryMap() {
    void this.loadMap(this.session?.mapId ?? this.mapId).catch((e) =>
      this.report(e),
    )
  }
  selectCombatSpell(spell: HudSpell | null) {
    this.spell = spell
    this.combat?.select(spell)
  }
  async presentCombat(
    event: CombatEvent | null,
    state: CombatState,
    signal: AbortSignal,
  ) {
    if (
      signal.aborted ||
      this.destroyed ||
      !this.scene ||
      !this.actors ||
      !this.labels
    )
      return
    if (!state.snapshot) {
      this.combat?.destroy()
      this.combat = undefined
      if (this.session && this.session.mapId !== this.mapId)
        await this.loadMap(this.session.mapId)
      else await this.syncWorld(true)
      return
    }
    if (this.loading) await this.loadQueue
    if (this.mapId !== state.snapshot.map_id)
      await this.loadMap(state.snapshot.map_id)
    if (signal.aborted || this.destroyed || !this.grid) return
    if (!this.combat) {
      this.intent++
      this.combat = new Combat(this.grid, this.actors, this.scene, this.labels)
      this.combat.select(this.spell)
      this.combat.setGridVisible(this.combatDisplay.grid)
      await this.combat.setTactical(this.combatDisplay.tactical)
    }
    if (event) await this.combat.present(event, state, signal)
    else await this.combat.sync(state.snapshot, signal)
  }
  setOverlay(overlay: OverlayOptions) {
    this.overlay = { ...overlay }
  }
  worldZoomState() {
    return {
      canIn: (this.scene?.camera.zoom ?? 1) < 4,
      canOut: (this.scene?.camera.zoom ?? 1) > 0.2,
    }
  }
  zoomWorld(action: 'in' | 'out' | 'reset', point?: { x: number; y: number }) {
    if (!this.scene) return
    if (action === 'reset') {
      this.scene.fitCamera()
      return
    }
    this.zoom(action === 'in' ? -200 : 200, point)
  }
  private zoom(delta: number, point?: { x: number; y: number }) {
    if (!this.scene || !this.canvas) return
    const rect = this.canvas.getBoundingClientRect(),
      x = point?.x ?? rect.left + rect.width / 2,
      y = point?.y ?? rect.top + rect.height / 2,
      a = this.scene.clientToWorld(x, y)
    this.scene.camera.zoom = Math.max(
      0.2,
      Math.min(4, this.scene.camera.zoom * Math.exp(-delta * 0.001)),
    )
    const b = this.scene.clientToWorld(x, y)
    this.scene.camera.x += a.x - b.x
    this.scene.camera.y += a.y - b.y
  }
  private bindInput() {
    const canvas = this.canvas!
    let pan = false,
      last = { x: 0, y: 0 }
    const camera = {
      get isPanning() {
        return pan
      },
      zoomAt: (x: number, y: number, d: number) => this.zoom(d, { x, y }),
      onPointerDown: (e: {
        button: number
        clientX: number
        clientY: number
      }) => {
        pan = e.button === 1
        last = { x: e.clientX, y: e.clientY }
      },
      onPointerMove: (e: { clientX: number; clientY: number }) => {
        if (pan && this.scene) {
          this.scene.camera.x -= (e.clientX - last.x) / this.scene.camera.zoom
          this.scene.camera.y -= (e.clientY - last.y) / this.scene.camera.zoom
          last = { x: e.clientX, y: e.clientY }
        }
        return pan
      },
      onPointerUp: () => {
        pan = false
      },
      onPointerCancel: () => {
        pan = false
      },
    }
    this.cleanups.push(
      bindWorldInput(canvas, {
        camera,
        point: (e) => ({ x: e.clientX, y: e.clientY }),
        dirty: () => {},
        move: (e) => this.hover(e.clientX, e.clientY),
        click: (e) => {
          void this.click(e).catch((error) => this.report(error))
        },
        leave: () => {
          this.hovered = -1
          this.clearWorldHover()
          this.options.onCharacterHover?.(null)
          this.options.onMonsterHover?.(null)
        },
        context: (e) =>
          this.options.onWorldContextMenu?.({ x: e.clientX, y: e.clientY }),
        key: (e) => {
          if (e.key.toLowerCase() === 't' && this.combat)
            this.combatDisplay.toggleTactical()
          if (e.key.toLowerCase() === 'g') {
            if (this.combat) this.combatDisplay.toggleGrid()
            else worldDisplayStore.toggle('grid')
          }
        },
      }),
    )
  }
  private actorAt(x: number, y: number) {
    if (!this.scene || !this.actors) return
    const p = this.scene.clientToWorld(x, y)
    return [...this.actors.entries].reverse().find((e) => {
      const b = e.source.lastLocalBounds,
        s = e.source
      return (
        !e.hidden &&
        b &&
        p.x >= s.x + b[0] &&
        p.x <= s.x + b[2] &&
        p.y >= s.y + b[1] &&
        p.y <= s.y + b[3]
      )
    })
  }
  private clearWorldHover() {
    this.hoverIntent++
    this.edgeHover = null
    this.scene?.setGfxHoverRef?.(null)
    if (this.transitionIndicator) this.transitionIndicator.style.display = 'none'
    if (this.canvas) this.canvas.style.cursor = 'default'
  }
  private showTransitionIndicator(edge: EdgeHover | null, clientX: number, clientY: number) {
    const indicator = this.transitionIndicator, canvas = this.canvas
    if (!indicator || !canvas || !edge) {
      if (indicator) indicator.style.display = 'none'
      return
    }
    const rect = canvas.getBoundingClientRect(), margin = 29
    indicator.style.left = `${Math.max(rect.left + margin, Math.min(rect.right - margin, clientX))}px`
    indicator.style.top = `${Math.max(rect.top + margin, Math.min(rect.bottom - margin, clientY))}px`
    const angle = { right: 0, bottom: 90, left: 180, top: -90 }[edge.edge.direction]
    indicator.style.transform = `translate(-50%, -50%) rotate(${angle}deg)`
    indicator.style.display = 'block'
  }
  private hover(x: number, y: number) {
    if (this.loading || !this.scene || !this.actors) return
    const p = this.scene.clientToWorld(x, y),
      hit = this.actorAt(x, y)
    this.hovered =
      hit?.entity.cellId ??
      (this.combat ? this.grid!.worldToCell(p) : this.actors.worldToCell(p))
    if (this.combat) {
      this.clearWorldHover()
      this.combat.hover(this.hovered, { x, y })
      return
    }
    const actor = this.session?.actors.find((a) => a.id === hit?.descriptor.id)
    this.options.onCharacterHover?.(
      actor?.kind === 'Character' ? { actor, x, y } : null,
    )
    this.options.onMonsterHover?.(actor?.group ? { actor, x, y } : null)
    const edge = this.grid ? findEdgeHover(this.edges, this.grid, p) : null
    this.edgeHover = edge
    this.showTransitionIndicator(edge, x, y)
    if (this.canvas) this.canvas.style.cursor = edge ? 'pointer' : 'default'
    const intent = ++this.hoverIntent
    const mapId = this.mapId
    void this.scene.pickGfxElementRefsAtClientExact(x, y, { includeHitboxes: true })
      .then((refs) => {
        if (intent !== this.hoverIntent || mapId !== this.mapId || this.loading || this.combat || !this.scene) return
        const interactiveRef = refs.find((ref) => {
          const element = this.scene?.loadedScene?.map.elements[ref.group]?.[ref.index]
          return this.session?.interactives.some(i => i.element_id === element?.interactionId && i.enabled)
        }) ?? null
        this.scene.setGfxHoverRef?.(interactiveRef, 'select')
        if (interactiveRef) {
          this.edgeHover = null
          this.showTransitionIndicator(null, x, y)
        }
        if (this.canvas) this.canvas.style.cursor = interactiveRef || this.edgeHover ? 'pointer' : 'default'
      })
      .catch((error) => {
        if (intent === this.hoverIntent) this.report(error)
      })
  }
  private async click(event: PointerEvent) {
    if (this.loading || !this.scene || !this.actors || !this.grid) return
    const point = this.scene.clientToWorld(event.clientX, event.clientY),
      hit = this.actorAt(event.clientX, event.clientY),
      cell =
        hit?.entity.cellId ??
        (this.combat
          ? this.grid.worldToCell(point)
          : this.actors.worldToCell(point))
    if (this.combat) {
      if (cell >= 0 && this.combat.canTarget(cell))
        this.options.onCombatCell?.(cell, this.combat.pathTo(cell))
      return
    }
    const actor = this.session?.actors.find((a) => a.id === hit?.descriptor.id),
      target = actor ? { actor, x: event.clientX, y: event.clientY } : undefined
    if (target && actor?.kind === 'Npc') {
      this.options.onNpcClick?.(target)
      return
    }
    if (
      target &&
      actor?.kind === 'Character' &&
      actor.id !== this.session?.character.id
    ) {
      this.options.onCharacterClick?.(target)
      return
    }
    if (actor?.group) {
      await this.walk(cell, () => this.options.attackMonster?.(actor.id))
      return
    }
    const refs = await this.scene.pickGfxElementRefsAtClientExact(
      event.clientX,
      event.clientY,
      { includeHitboxes: true },
    )
    for (const ref of refs) {
      const element =
          this.scene.loadedScene?.map.elements[ref.group]?.[ref.index],
        interactive = this.session?.interactives.find(
          (i) => i.element_id === element?.interactionId && i.enabled,
        )
      if (interactive) {
        this.scene.setGfxHoverRef?.(ref, 'select')
        const me = this.actors.entries.find(
          (e) => e.descriptor.id === this.playerId(),
        )
        const adjacent = [
          interactive.cell_id,
          ...this.grid.neighbours(interactive.cell_id),
        ].filter((c) => this.grid!.isWalkable(c))
        const destination = adjacent
          .sort(
            (a, b) =>
              this.actors!.pathTo(this.playerId(), a).length -
              this.actors!.pathTo(this.playerId(), b).length,
          )
          .find(
            (c) =>
              c === me?.entity.cellId ||
              this.actors!.pathTo(this.playerId(), c).length > 1,
          )
        if (destination !== undefined)
          await this.walk(destination, () =>
            this.options.useInteractive?.(interactive.element_id),
          )
        return
      }
    }
    const edge = findEdgeHover(this.edges, this.grid, point)
    if (edge) {
      await this.walk(edge.cellId, async () => {
        if (this.options.changeMap)
          await this.options.changeMap(edge.edge.mapId)
        else await this.loadMap(edge.edge.mapId)
      })
      return
    }
    if (cell >= 0) await this.walk(cell)
  }
  private playerId() {
    return this.session?.character.id ?? 1
  }
  private async walk(cell: number, after?: () => void | Promise<void>) {
    if (!this.actors || this.movementPending) return
    const id = this.playerId(),
      me = this.actors.entries.find((e) => e.descriptor.id === id)
    if (!me || me.movement.moving) return
    const intent = ++this.intent,
      map = this.mapId
    this.selected = cell
    if (me.entity.cellId === cell) {
      await after?.()
      return
    }
    const path = this.actors.pathTo(id, cell)
    if (path.length < 2) return
    this.movementPending = true
    try {
      const confirmed = this.options.requestMovement
        ? await this.options.requestMovement(path, map)
        : path
      if (intent !== this.intent || map !== this.mapId || this.destroyed) return
      this.path = confirmed
      const arrived = await this.actors.move(
        id,
        confirmed,
        this.loadController.signal,
      )
      if (
        arrived &&
        intent === this.intent &&
        map === this.mapId &&
        !this.destroyed
      ) {
        this.options.confirmMovement?.(map)
        await after?.()
      }
    } finally {
      this.movementPending = false
    }
  }
  playActorMovement(id: number, path: number[]) {
    if (this.combat || this.destroyed) return
    this.queuedMovements.set(id, {
      mapId: this.requestedMap ?? this.session?.mapId ?? this.mapId,
      path: [...path],
    })
    this.flushMovements()
  }
  private flushMovements() {
    if (this.loading || !this.actors) return
    for (const [id, event] of this.queuedMovements) {
      if (event.mapId !== this.mapId) {
        this.queuedMovements.delete(id)
        continue
      }
      if (!this.actors.entries.some((e) => e.descriptor.id === id)) continue
      this.queuedMovements.delete(id)
      void this.actors
        .move(id, event.path, this.loadController.signal)
        .catch((e) => this.report(e))
    }
  }
  showSpeech(line: ChatLine) {
    if (
      line.kind !== 'message' ||
      line.channel !== CHAT_CHANNEL.GLOBAL ||
      !Number.isFinite(line.senderId)
    )
      return
    const text = stripChatMarkup(line.content).trim().slice(0, 512)
    if (text)
      void this.labels?.show(
        line.senderId!,
        text,
        Math.min(12000, Math.max(4000, text.length * 65)),
      )
  }
  onInteractiveEvent(event: InteractiveEvent) {
    if (!this.session) return
    if (event.kind === 'stated' || event.kind === 'element') {
      this.session = {
        ...this.session,
        interactives: this.session.interactives.map((item) => ({ ...item })),
      }
      const interactive = this.session.interactives.find(
        (i) => i.element_id === event.elementId,
      )
      if (interactive) {
        if (event.kind === 'stated') interactive.state = event.state
        else interactive.enabled = event.enabled
        this.actors?.syncInteractives(this.session.interactives)
      }
    } else if (event.kind === 'error')
      this.options.onError?.('Utilisation de cet élément refusée.')
  }
  private tick = (time: number) => {
    if (this.destroyed) return
    this.frame = requestAnimationFrame(this.tick)
    const dt = Math.min(0.1, this.lastTime ? (time - this.lastTime) / 1000 : 0)
    this.lastTime = time
    if (this.loading || !this.scene?.isReady || !this.actors) return
    try {
      this.clock += dt
      const actors = this.actors.tick(dt),
        combat = this.combat?.tick(dt),
        items = combat?.items ?? []
      if (
        !this.combat &&
        this.overlays &&
        this.grid &&
        (this.overlay.showGrid || worldDisplayStore.snapshot().grid)
      )
        for (const c of this.grid.cells)
          if (c.mov)
            items.push(
              this.overlays.cell(
                c.cellId,
                0x666666,
                0.2,
                true,
                this.overlay.showCellIds ? String(c.cellId) : '',
              ),
            )
      this.scene.render(
        this.clock,
        [...actors, ...(combat?.actors ?? [])],
        items,
        {
          tacticalMode: this.combat?.tacticalEnabled ?? false,
          tacticalClearColor: this.combat?.clearColor ?? null,
        },
      )
      this.labels?.tick()
      this.frames++
      this.fps = dt ? 1 / dt : 0
      if (this.frames % 30 === 0) this.emitStats()
    } catch (error) {
      this.loading = true
      this.report(error)
    }
  }
  private emitStats() {
    const me = this.actors?.entries.find(
        (e) => e.descriptor.id === this.playerId(),
      ),
      stats = this.scene?.getBenchStats() ?? {},
      resources = this.scene?.getResourceStats() ?? {}
    this.options.onStats({
      mapId: this.mapId,
      fps: this.fps,
      spriteCount: Number((stats.frame as { quads?: number })?.quads ?? 0),
      textureCount: Number(stats.textureCount ?? resources.entityTextures ?? 0),
      drawCalls: (stats.frame as { drawCalls?: number })?.drawCalls ?? null,
      hoveredCell: this.hovered,
      selectedCell: this.selected,
      pathLength: this.path.length,
      loadMs: this.loadMs,
      memoryMB: readHeapMemoryMB(),
      unsupported: {
        notDrawn: 0,
        animated: 0,
        refraction: 0,
        particles: 0,
        unknownLayer: 0,
        missingTexture: Number(
          (stats.mapTextureFailures as { total?: number })?.total ?? 0,
        ),
        unsupportedBlend: 0,
        ignoredEffects: 0,
      },
      look: me?.descriptor.look ?? '',
      animation: me?.entity.animManager?.animationName ?? '',
      facing: me?.entity.currentDir ?? 0,
      entityCell: me?.entity.cellId ?? -1,
    })
  }
  performanceSnapshot() {
    return {
      backend: 'bubble-native',
      mapId: this.mapId,
      loading: this.loading,
      frames: this.frames,
      loadMs: this.loadMs,
      nativeActors: this.actors?.diagnostics,
      bench: this.scene?.getBenchStats(),
      resources: this.scene?.getResourceStats(),
    }
  }
  destroy() {
    if (this.destroyed) return
    this.destroyed = true
    this.transitionIndicator?.remove()
    this.transitionIndicator = undefined
    this.queuedMovements.clear()
    this.intent++
    this.controller.abort()
    this.loadController.abort()
    cancelAnimationFrame(this.frame)
    for (const stop of this.cleanups) stop()
    this.combat?.destroy()
    this.labels?.destroy()
    this.overlays?.destroy()
    this.actors?.destroy()
    this.scene?.destroy()
    this.canvas?.remove()
    this.options.onCharacterHover?.(null)
    this.options.onMonsterHover?.(null)
  }
}
