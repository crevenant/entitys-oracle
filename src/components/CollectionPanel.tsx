import { useState } from 'react'
import { Check, Shield, Sparkles } from 'lucide-react'
import { catalog } from '../lib/oracle'
import type { Role } from '../lib/oracle'

export type CollectionTab = 'characters' | 'perks'
type Props = {
  role: Role
  tab: CollectionTab
  onTab: (tab: CollectionTab) => void
  excludedCharacters: string[]
  excludedPerks: string[]
  onCharacters: (excluded: string[]) => void
  onPerks: (excluded: string[]) => void
  drawing: boolean
}

export default function CollectionPanel({ role, tab, onTab, excludedCharacters, excludedPerks, onCharacters, onPerks, drawing }: Props) {
  const [queries, setQueries] = useState({ characters: '', perks: '' })
  const characters = catalog.characters.filter((entry) => entry.role === role)
  const perks = catalog.perks.filter((entry) => entry.role === role)
  const entries = tab === 'characters' ? characters : perks
  const excluded = tab === 'characters' ? excludedCharacters : excludedPerks
  const update = tab === 'characters' ? onCharacters : onPerks
  const selectedCount = entries.filter((entry) => !excluded.includes(entry.id)).length
  const query = queries[tab]
  const visible = entries.filter((entry) => entry.name.toLowerCase().includes(query.trim().toLowerCase()))
  const toggle = (id: string) => update(excluded.includes(id) ? excluded.filter((entry) => entry !== id) : [...excluded, id])
  const insufficient = tab === 'characters' ? selectedCount === 0 : selectedCount < 4

  return <>
    <p className="eyebrow">CURATE YOUR OFFERING</p>
    <h2>Your {role} deck</h2>
    <p className="modal-copy">Choose the characters and perks the Entity can draw. Your selections are saved for each role on this device.</p>
    <div className="collection-tabs" role="tablist" aria-label="Collection type" onKeyDown={(event) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
      event.preventDefault()
      const next: CollectionTab = event.key === 'Home' ? 'characters' : event.key === 'End' ? 'perks' : tab === 'characters' ? 'perks' : 'characters'
      onTab(next)
      event.currentTarget.querySelector<HTMLButtonElement>(`#${next}-tab`)?.focus()
    }}>
      <button role="tab" id="characters-tab" tabIndex={tab === 'characters' ? 0 : -1} aria-controls="collection-items" aria-selected={tab === 'characters'} onClick={() => onTab('characters')}><Shield size={14} />Characters <span>{characters.filter((entry) => !excludedCharacters.includes(entry.id)).length}</span></button>
      <button role="tab" id="perks-tab" tabIndex={tab === 'perks' ? 0 : -1} aria-controls="collection-items" aria-selected={tab === 'perks'} onClick={() => onTab('perks')}><Sparkles size={14} />Perks <span>{perks.filter((entry) => !excludedPerks.includes(entry.id)).length}</span></button>
    </div>
    {drawing && <p className="pool-warning">Finish or skip the ritual before changing your pool.</p>}
    <div className="collection-toolbar">
      <input aria-label={`Search ${tab}`} placeholder={tab === 'characters' ? 'Find a character…' : 'Find a perk…'} value={query} onChange={(event) => setQueries({ ...queries, [tab]: event.target.value })} />
      <button disabled={drawing} onClick={() => update(excluded.filter((id) => !entries.some((entry) => entry.id === id)))}>Select all</button>
      <button disabled={drawing} onClick={() => update([...new Set([...excluded, ...entries.map((entry) => entry.id)])])}>Clear</button>
    </div>
    <p className={`collection-count ${insufficient ? 'pool-insufficient' : ''}`} role="status">{selectedCount} of {entries.length} {tab} selected{insufficient ? ` · Choose at least ${tab === 'characters' ? 'one character' : 'four perks'}` : ''}</p>
    <div id="collection-items" role="tabpanel" aria-labelledby={`${tab}-tab`} className={tab === 'characters' ? 'collection-grid' : 'perk-pool-grid'}>
      {visible.map((entry) => {
        const selected = !excluded.includes(entry.id)
        return <button className={`${tab === 'characters' ? 'collection-character' : 'collection-perk'} ${selected ? 'selected' : ''}`} key={entry.id} aria-label={entry.name} aria-pressed={selected} disabled={drawing} onClick={() => toggle(entry.id)}>
          {tab === 'perks' ? <span className="pool-perk-icon"><img src={entry.image} alt="" loading="lazy" /></span> : <img src={entry.image} alt="" loading="lazy" />}
          <span className="collection-entry-name">{entry.name}{tab === 'perks' && <small>TIER III · VERY RARE</small>}</span>
          <span className="collection-check">{selected && <Check size={12} />}</span>
        </button>
      })}
    </div>
    {!visible.length && <p className="empty-state">No {tab} match your search.</p>}
    <p className="catalog-note">Removing a locked entry also unlocks it. Select all and Clear apply to every {role} {tab === 'characters' ? 'character' : 'perk'}, including entries hidden by search.</p>
  </>
}
