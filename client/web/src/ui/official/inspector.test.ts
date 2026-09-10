import { describe, expect, it } from 'vitest'
import { formatInspectDump, inspectEnabled, inspectPayload, officialPath, type Inspectable } from './inspector'

function node(attrs: Record<string, string>, parent: Inspectable | null = null, className = 'official-node', extras: Partial<Inspectable> = {}): Inspectable {
  const element: Inspectable = {
    className,
    classList: { contains: (name: string) => className.split(/\s+/).includes(name) },
    parentElement: parent,
    getAttribute: (name: string) => attrs[name] ?? null,
    getBoundingClientRect: () => ({ left: 12, top: 40, width: 980, height: 880 }),
    ...extras,
  }
  return element
}

describe('ui inspector', () => {
  it('turns on from the query flag used by the other UI debug tools', () => {
    expect(inspectEnabled('?ui-preview=hud&ui-inspect=1')).toBe(true)
    expect(inspectEnabled('?ui-preview=hud')).toBe(false)
  })

  it('rebuilds the Unity path and never uses the React uid as the Unity id', () => {
    const root = node({ 'data-binding': 'equipmentUi', 'data-type': 'UXML', 'data-tree': 'equipmentStorageUi' })
    const windowNode = node({
      'data-binding': 'PlayerInventory',
      'data-type': 'WindowFigma',
      'data-full-type': 'Core.UILogic.Components.Figma.WindowFigma',
      'data-unity-id': '-1097865452',
      'data-giny': 'Window',
      'data-official-id': 'equipmentStorageUi-root-PlayerInventory',
    }, root, 'official-node official-WindowFigma official-window is-movable window')
    expect(officialPath(windowNode)).toBe('equipmentUi/PlayerInventory')
    const payload = inspectPayload(windowNode)
    expect(payload.tree).toBe('equipmentStorageUi')
    expect(payload.giny).toBe('Window')
    expect(payload.id).toBe('-1097865452')
    expect(payload.classes).toEqual(['is-movable', 'window'])
    expect(payload.host).toBeUndefined()
    expect(formatInspectDump(payload)).toContain('chemin    equipmentUi/PlayerInventory')
    expect(formatInspectDump(payload)).toContain('id        -1097865452')
    expect(formatInspectDump(payload)).toContain('box       980×880 @ 12,40')
  })

  it('promotes a toggle interior to the DofusToggleButtonCustom host', () => {
    const root = node({ 'data-binding': 'equipmentUi', 'data-type': 'UXML', 'data-tree': 'equipmentStorageUi' })
    const btn = node({
      'data-binding': 'btnAll',
      'data-type': 'DofusToggleButtonCustom',
      'data-full-type': 'Core.UILogic.Components.Figma.DofusToggleButtonCustom',
      'data-unity-id': '1401450509',
      'data-giny': 'Button',
      'data-sprite': 'styles/images/tab_small_normal.png',
    }, root, 'official-node toggle button secondary')
    const interior = node({
      'data-binding': 'toggle_container',
      'data-type': 'VisualElement',
      'data-full-type': 'UnityEngine.UIElements.VisualElement',
      'data-giny': 'Panel',
      'data-official-id': 'equipmentStorageUi-storage-toggle_container',
    }, btn)
    const payload = inspectPayload(interior)
    expect(payload.path).toBe('equipmentUi/btnAll/toggle_container')
    expect(payload.giny).toBe('Panel')
    expect(payload.id).toBe('')
    expect(payload.host?.path).toBe('equipmentUi/btnAll')
    expect(payload.host?.giny).toBe('Button')
    expect(payload.host?.id).toBe('1401450509')
    expect(formatInspectDump(payload)).toContain('hôte      equipmentUi/btnAll')
    expect(formatInspectDump(payload)).toContain('DofusToggleButtonCustom · Button')
  })

  it('reads a Window chrome sprite off window_shadow when the host has none', () => {
    const shadow = node({
      'data-binding': 'window_shadow',
      'data-sprite': 'styles/images/windowShadow.png',
      'data-slice': '45 45 45 45',
    })
    const windowNode = node({
      'data-binding': 'PlayerInventory',
      'data-type': 'WindowFigma',
      'data-giny': 'Window',
      'data-unity-id': '-1097865452',
    }, null, 'official-node window', {
      querySelector: (selector: string) => selector.includes('window_shadow') ? shadow : null,
    })
    const payload = inspectPayload(windowNode)
    expect(payload.sprite).toBe('styles/images/windowShadow.png')
    expect(payload.slice).toBe('45 45 45 45')
  })
})
