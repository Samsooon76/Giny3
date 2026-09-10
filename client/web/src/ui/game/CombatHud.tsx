import { useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import type { CharacterHud, WorldActor } from '../../giny/types'
import { catalogGeneration, subscribeCatalog } from './catalog'
import {
  monsterGroupHeader,
  monsterGroupXpLabel,
  monsterLevelLabel,
  specificLootLabel,
  summarizeMonsterGroup,
  useMonsterCatalog,
} from './monsterGroupTooltip'
import './monsterGroupTooltip.css'

export function MonsterGroupTooltip({
  hover,
  hud,
  partySize,
  onPointerEnter,
  onPointerLeave,
  onClose,
}: {
  hover: { actor: WorldActor; x: number; y: number } | null
  hud?: CharacterHud | null
  partySize?: number
  onPointerEnter?: () => void
  onPointerLeave?: () => void
  onClose?: () => void
}) {
  const monsters = useMonsterCatalog()
  const catalogTick = useSyncExternalStore(subscribeCatalog, catalogGeneration, catalogGeneration)
  const group = hover?.actor.group
  const summary = useMemo(
    () => group ? summarizeMonsterGroup(group, monsters, { playerLevel: hud?.character.level, partySize: partySize ?? 2 }) : null,
    [group, monsters, hud?.character.level, partySize, catalogTick],
  )
  const popupRef = useRef<HTMLElement>(null)
  useLayoutEffect(() => {
    const popup = popupRef.current
    if (!popup || !hover) return
    const place = () => {
      const viewport = window.visualViewport
      const x = viewport?.offsetLeft ?? 0
      const y = viewport?.offsetTop ?? 0
      const width = viewport?.width ?? window.innerWidth
      const height = viewport?.height ?? window.innerHeight
      popup.style.maxWidth = `${Math.max(0, width - 16)}px`
      popup.style.maxHeight = `${Math.max(0, height - 16)}px`
      const rect = popup.getBoundingClientRect()
      const preferredLeft = hover.x + 22 + rect.width <= x + width - 8
        ? hover.x + 22 : hover.x - rect.width - 22
      popup.style.left = `${Math.max(x + 8, Math.min(preferredLeft, x + width - rect.width - 8))}px`
      popup.style.top = `${Math.max(y + 8, Math.min(hover.y + 12, y + height - rect.height - 8))}px`
    }
    place()
    const observer = new ResizeObserver(place)
    observer.observe(popup)
    window.addEventListener('resize', place)
    window.visualViewport?.addEventListener('resize', place)
    window.visualViewport?.addEventListener('scroll', place)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', place)
      window.visualViewport?.removeEventListener('resize', place)
      window.visualViewport?.removeEventListener('scroll', place)
    }
  }, [hover, summary])
  if (!hover || !summary) return null
  return createPortal(
    <aside ref={popupRef} role="tooltip" className="monster-group-tooltip"
      onPointerEnter={onPointerEnter} onPointerLeave={onPointerLeave}
      onKeyDown={(event) => { if (event.key === 'Escape') onClose?.() }}>
      <header className="monster-group-tooltip__header">
        {monsterGroupHeader(summary.level)}
        <button type="button" className="monster-group-tooltip__close" aria-label="Fermer" onClick={onClose}>×</button>
      </header>
      {(summary.xp > 0 || summary.kamas > 0) && (
        <div className="monster-group-tooltip__rewards">
          <div className="monster-group-tooltip__xp-row">
            <div className="monster-group-tooltip__xp-col">
              {summary.xp > 0 && (
                <span className="monster-group-tooltip__xp">
                  <span>{summary.xp.toLocaleString('fr-FR')}</span>
                  <span className="monster-group-tooltip__xp-unit">XP</span>
                </span>
              )}
              {summary.groupXp != null && (
                <span className="monster-group-tooltip__group-xp">{monsterGroupXpLabel(summary.groupXp)}</span>
              )}
            </div>
            {summary.xp > 0 && summary.kamas > 0 && <span className="monster-group-tooltip__divider" />}
            {summary.kamas > 0 && (
              <span className="monster-group-tooltip__kamas">
                {summary.kamas.toLocaleString('fr-FR')}
                <img className="monster-group-tooltip__kamas-icon" src="/dofus3/icons/kamas.png" alt="" />
              </span>
            )}
          </div>
        </div>
      )}
      <div className="monster-group-tooltip__body">
        <ul className="monster-group-tooltip__list">
          {summary.members.map((member, index) => (
            <li key={`${member.id}-${index}`} className="monster-group-tooltip__member">
              <span className="monster-group-tooltip__name">
                {member.is_boss && <span className="monster-group-tooltip__badge monster-group-tooltip__badge--boss" />}
                {member.is_mini_boss && <span className="monster-group-tooltip__badge monster-group-tooltip__badge--mini" />}
                {member.bounty && <span className="monster-group-tooltip__badge monster-group-tooltip__badge--bounty" />}
                {member.name}
              </span>
              <span className="monster-group-tooltip__lvl">{monsterLevelLabel(member.level)}</span>
            </li>
          ))}
        </ul>
        {summary.loots.length > 0 && (
          <section className="monster-group-tooltip__loot">
            <div className="monster-group-tooltip__loot-head">
              <span>{specificLootLabel()}</span>
              <span className="monster-group-tooltip__loot-count">{summary.loots.length}</span>
            </div>
            <div className="monster-group-tooltip__grid" tabIndex={0} aria-label="Butins spécifiques">
              {summary.loots.map((loot) => (
                <div
                  key={loot.gid}
                  title={loot.name}
                  className={`monster-group-tooltip__slot${loot.criterion ? ' monster-group-tooltip__slot--criterion' : ''}`}
                  style={loot.icon ? { backgroundImage: `url("${loot.icon}")` } : undefined}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </aside>,
    document.body,
  )
}
