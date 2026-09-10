import { useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { WorldActor } from '../../giny/types'
import { gameDataUrl } from '../../data/assetUrl'
import './characterTooltip.css'

export type CharacterHover = { actor: WorldActor; x: number; y: number }

export function CharacterTooltip({ hover }: { hover: CharacterHover | null }) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const popup = ref.current
    if (!popup || !hover) return
    const place = () => {
      const width = popup.offsetWidth, height = popup.offsetHeight
      popup.style.left = `${Math.max(8, Math.min(hover.x - width / 2, window.innerWidth - width - 8))}px`
      popup.style.top = `${Math.max(8, Math.min(hover.y - height - 14, window.innerHeight - height - 8))}px`
    }
    place()
    const observer = new ResizeObserver(place)
    observer.observe(popup)
    window.addEventListener('resize', place)
    return () => { observer.disconnect(); window.removeEventListener('resize', place) }
  }, [hover])
  if (!hover?.actor.name) return null
  const guild = hover.actor.guild
  const emblem = guild?.emblem
  const symbol = emblem && Number.isInteger(emblem.symbol_shape) && emblem.symbol_shape > 0
    ? gameDataUrl(`pictos/emblemsymbols/${emblem.symbol_shape}.png`) : undefined
  return createPortal(<div ref={ref} className="character-tooltip" role="tooltip">
    {guild && <span className="character-tooltip-emblem" aria-hidden="true">
      <img src="/dofus3/guild/textures/CreationGuilde_tx_emblem.png" alt="" />
      {symbol && <img key={symbol} className="character-tooltip-symbol" src={symbol} alt="" onError={event => { event.currentTarget.style.visibility = 'hidden' }} />}
    </span>}
    <div className="character-tooltip-text">
      {guild?.name && <span className="character-tooltip-guild">{guild.name}</span>}
      <strong className="character-tooltip-name">{hover.actor.name}</strong>
    </div>
  </div>, document.body)
}
