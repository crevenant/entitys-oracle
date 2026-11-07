import { BookOpen, ChevronRight, LockKeyhole, UnlockKeyhole } from 'lucide-react'
import type { Draw, Perk } from '../lib/oracle'
import { publicUrl } from '../lib/publicUrl'

type Props = {
  draw: Draw
  lockedCharacter: boolean
  lockedPerks: (string | null)[]
  onCharacterLock: () => void
  onPerkLock: (index: number) => void
  onUnlock: () => void
  onInspect: (perk: Perk) => void
  onPool: () => void
}

export default function LoadoutControls({ draw, lockedCharacter, lockedPerks, onCharacterLock, onPerkLock, onUnlock, onInspect, onPool }: Props) {
  const lockCount = Number(lockedCharacter) + lockedPerks.filter(Boolean).length
  return <section className="loadout" aria-label="Character and perk locks">
    <button className="edit-perk-pool" onClick={onPool}><BookOpen size={12} />Edit perk pool</button>
    <div className={`character-lock-row ${lockedCharacter ? 'is-held' : ''}`}>
      <img src={publicUrl(draw.character.image)} alt="" />
      <span><small>YOUR {draw.character.role.toUpperCase()}</small><strong>{draw.character.name}</strong></span>
      <button className="lock-character" aria-label={lockedCharacter ? 'Unlock character' : 'Lock character'} aria-pressed={lockedCharacter} onClick={onCharacterLock}>{lockedCharacter ? <LockKeyhole size={14} /> : <UnlockKeyhole size={14} />}<span>{lockedCharacter ? 'Character locked' : 'Lock character'}</span></button>
    </div>
    <div className="loadout-grid">{draw.perks.map((entry, index) => {
      const held = lockedPerks[index] === entry.id
      return <div className={`perk-slot-control ${held ? 'is-held' : ''}`} key={entry.id} data-slot={index + 1}>
        <button className="perk-tile" aria-label={entry.name} onClick={() => onInspect(entry)}><span className="perk-icon"><img src={publicUrl(entry.image)} alt="" /></span><span><small>0{index + 1} / VERY RARE</small><strong>{entry.name}</strong></span><ChevronRight size={14} /></button>
        <button className="perk-lock" aria-label={`${held ? 'Unlock' : 'Lock'} perk slot ${index + 1}: ${entry.name}`} aria-pressed={held} onClick={() => onPerkLock(index)}>{held ? <LockKeyhole size={12} /> : <UnlockKeyhole size={12} />}<span>{held ? 'Locked' : 'Lock slot'}</span></button>
      </div>
    })}</div>
    <div className="loadout-footnote"><p>{lockCount ? `${lockCount} of 5 entries locked. Only unlocked entries will reroll.` : 'Lock any entry to keep it for the next draw.'}</p>{lockCount > 0 && <button onClick={onUnlock}>Unlock all</button>}</div>
    <p className="reroll-explanation">Random draws may repeat unlocked entries. Locking an entry includes it in your pool.</p>
  </section>
}
