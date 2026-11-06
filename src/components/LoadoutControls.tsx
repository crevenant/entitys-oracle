import { BookOpen, ChevronRight, LockKeyhole, UnlockKeyhole } from 'lucide-react'
import type { Draw, Perk } from '../lib/oracle'

type Props = {
  draw: Draw
  revealedPerks: number
  drawing: boolean
  lockedCharacter: boolean
  lockedPerks: (string | null)[]
  onCharacterLock: () => void
  onPerkLock: (index: number) => void
  onUnlock: () => void
  onInspect: (perk: Perk) => void
  onPool: () => void
}

export default function LoadoutControls({ draw, revealedPerks, drawing, lockedCharacter, lockedPerks, onCharacterLock, onPerkLock, onUnlock, onInspect, onPool }: Props) {
  const lockCount = Number(lockedCharacter) + lockedPerks.filter(Boolean).length
  return <section className="loadout" aria-label="Your four perks">
    <div className="loadout-heading"><span className="eyebrow">YOUR HAND</span><button className="edit-perk-pool" onClick={onPool}><BookOpen size={12} />Edit perk pool</button></div>
    <div className={`character-lock-row ${lockedCharacter ? 'is-held' : ''}`}>
      <img src={draw.character.image} alt="" />
      <span><small>YOUR {draw.character.role.toUpperCase()}</small><strong>{draw.character.name}</strong></span>
      <button className="lock-character" aria-label={lockedCharacter ? 'Unlock character' : 'Lock character'} aria-pressed={lockedCharacter} disabled={drawing} onClick={onCharacterLock}>{lockedCharacter ? <LockKeyhole size={14} /> : <UnlockKeyhole size={14} />}<span>{lockedCharacter ? 'Character locked' : 'Lock character'}</span></button>
    </div>
    <div className="loadout-grid">{draw.perks.map((entry, index) => {
      const shown = index < revealedPerks
      const held = lockedPerks[index] === entry.id
      return <div className={`perk-slot-control ${held ? 'is-held' : ''}`} key={entry.id} data-slot={index + 1}>
        <button className={`perk-tile ${shown ? 'gift-revealed' : 'gift-concealed'}`} aria-label={shown ? entry.name : `Unrevealed gift ${index + 1}`} disabled={!shown} onClick={() => onInspect(entry)}><span className="perk-icon">{shown ? <img src={entry.image} alt="" /> : <span className="unknown-gift">◇</span>}</span><span><small>0{index + 1} / {shown ? 'VERY RARE' : 'VEILED'}</small><strong>{shown ? entry.name : 'Awaiting the Entity'}</strong></span><ChevronRight size={14} /></button>
        <button className="perk-lock" aria-label={`${held ? 'Unlock' : 'Lock'} perk slot ${index + 1}${shown ? `: ${entry.name}` : ''}`} aria-pressed={held} disabled={drawing || !shown} onClick={() => onPerkLock(index)}>{held ? <LockKeyhole size={12} /> : <UnlockKeyhole size={12} />}<span>{held ? 'Locked' : 'Lock slot'}</span></button>
      </div>
    })}</div>
    <div className="loadout-footnote"><p>{lockCount ? `${lockCount} of 5 entries locked. Only unlocked entries will reroll.` : 'Lock any entry to keep it for the next draw.'}</p>{lockCount > 0 && <button disabled={drawing} onClick={onUnlock}>Unlock all</button>}</div>
    <p className="reroll-explanation">Random draws may repeat unlocked entries. Locking an entry includes it in your pool.</p>
  </section>
}
