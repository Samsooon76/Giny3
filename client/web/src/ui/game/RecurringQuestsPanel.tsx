import { useState } from 'react'
import type { GameAction } from '../../giny/actions'
import type { QuestState } from '../../giny/questState'
import './recurringQuests.css'

const date = (unix: number) => new Date(unix * 1000).toLocaleString('fr-FR')
export function RecurringQuestsPanel({ state, run, pending }: { state: QuestState | null; run: (command: GameAction) => Promise<void>; pending: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const [tab, setTab] = useState<'daily' | 'weekly' | 'unclaimed' | 'battlepass'>('daily')
  const quests = !state ? [] : tab === 'battlepass' ? [] : tab === 'unclaimed' ? state.unclaimed : state[tab].quests
  return <aside className={`recurring-quests-panel ${expanded ? 'expanded' : ''}`} aria-label="Quêtes récurrentes et Battle Pass">
    <header><button onClick={() => { setExpanded(v => !v); if (!expanded) void run({ action: 'quests.sync', args: {} }) }}>Quêtes récurrentes · Battle Pass {expanded ? '−' : '+'}</button></header>
    {expanded && <>
      <nav aria-label="Période de quêtes">{(['daily', 'weekly', 'unclaimed', 'battlepass'] as const).map((key, i) => <button key={key} aria-pressed={tab === key} onClick={() => setTab(key)}>{['Jour', 'Semaine', 'À récupérer', 'Battle Pass'][i]}</button>)}</nav>
      <button disabled={pending} onClick={() => void run({ action: 'quests.sync', args: {} })}>Actualiser</button>
      {!state && <p>En attente des données de Giny…</p>}
      {state && <div className="recurring-content">
        {tab !== 'battlepass' && <>
          {tab !== 'unclaimed' && <p>Renouvellement : {date(tab === 'daily' ? state.dailyResetUnix : state.weeklyResetUnix)}</p>}
          {quests.length === 0 && <p>Aucune quête dans cette période.</p>}
          {quests.map(quest => <article key={quest.id}>
            <strong>{quest.title}</strong><p>{quest.description}</p>
            <progress aria-label={`Progression : ${quest.title}`} value={quest.currentAmount} max={quest.targetAmount} />
            <span>{quest.currentAmount} / {quest.targetAmount}</span>
            <p>{quest.rewards.map(r => r.label).join(' · ')}</p>
            <button disabled={pending || !quest.completed || quest.rewardClaimed} onClick={() => void run({ action: 'quests.claim', args: { questId: quest.id } })}>{quest.rewardClaimed ? 'Récompense récupérée' : quest.completed ? 'Récupérer' : 'En cours'}</button>
          </article>)}
        </>}
        {tab === 'battlepass' && <>
          <strong>{state.battlePass.seasonName || 'Aucune saison active'}</strong>
          <p>Niveau {state.battlePass.level} · {state.battlePass.currentXp} / {state.battlePass.xpRequired} XP</p>
          {state.battlePass.levels.map(level => <article key={level.level}>
            <strong>Palier {level.level}</strong>
            {(['free', 'vip'] as const).map(track => <div key={track} className="battlepass-slot">
              <span>{track === 'free' ? 'Gratuit' : 'VIP'} : {level[track].label || 'Aucune récompense'}</span>
              <button disabled={pending || !level[track].claimable} onClick={() => void run({ action: 'battlepass.claim', args: { level: level.level, vip: track === 'vip' ? 1 : 0 } })}>{level[track].claimed ? 'Récupérée' : level[track].locked ? 'Verrouillée' : 'Récupérer'}</button>
            </div>)}
          </article>)}
        </>}
      </div>}
    </>}
  </aside>
}
