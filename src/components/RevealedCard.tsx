import { Eye, LockKeyhole } from 'lucide-react'
import type { Draw, Perk } from '../lib/oracle'
import type { RitualPhase } from '../lib/ritual'
import SpectralBinding from './SpectralBinding'

type Props = { draw: Draw; phase: RitualPhase; revealedPerks: number; instant: boolean; onInspect: (perk: Perk) => void; lockedCharacter: boolean; lockedPerks: (string | null)[] }

export default function RevealedCard({ draw, phase, revealedPerks, instant, onInspect, lockedCharacter, lockedPerks }: Props) {
  const lit = phase !== 'flipping'
  return <div className={`reveal-shell ${instant ? 'is-instant' : ''} ${lit ? 'is-lit' : ''}`}>
    <div className="reveal-aura" aria-hidden="true" />
    <div className="reveal-turn">
      <div className="reveal-back reveal-face" aria-hidden="true"><img src="/assets/tarot-back-worn.webp" alt="" /></div>
      <article className="revealed-card reveal-face reveal-front" aria-label={lit ? `Your fate: ${draw.character.name}` : 'Your chosen card'} aria-hidden={!lit}>
        <span className="card-roman">{draw.character.role === 'survivor' ? 'XVII' : 'XIII'} {lockedCharacter ? <LockKeyhole size={15} /> : <Eye size={15} />} {draw.character.role.toUpperCase()}</span>
        <div className="portrait-frame"><img className="character-portrait" src={draw.character.image} alt={draw.character.name} /><div className="portrait-shade" /><div className="portrait-haunting" aria-hidden="true" /></div>
        <div className="card-identity"><span>THE ENTITY HAS CHOSEN</span><h2>{draw.character.name}</h2></div>
        <div className="card-perks">{draw.perks.map((perk, index) => {
          const shown = index < revealedPerks
          const held = lockedPerks[index] === perk.id
          return <div className={`card-perk-slot ${shown ? 'is-awakened' : ''} ${held ? 'is-held' : ''}`} key={perk.id}><span className="perk-seal" aria-hidden="true">{['I', 'II', 'III', 'IV'][index]}</span><button disabled={!shown} aria-hidden={!shown} aria-label={`View ${perk.name}, tier III`} onClick={() => onInspect(perk)}><img src={perk.image} alt="" /></button>{held && shown && <LockKeyhole className="card-lock-token" size={9} aria-hidden="true" />}</div>
        })}</div>
        <span className="card-bottom">◇ &nbsp; {revealedPerks === 4 ? 'YOUR FATE IS SEALED' : 'THE FOG HOLDS ITS SECRETS'} &nbsp; ◇</span>
        {lockedCharacter && <SpectralBinding />}
      </article>
    </div>
    {revealedPerks > 0 && !instant && <div key={revealedPerks} className="gift-ripple" aria-hidden="true" />}
  </div>
}
