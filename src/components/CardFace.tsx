import { LockKeyhole } from 'lucide-react'
import type { Draw, Perk } from '../lib/oracle'
import SpectralBinding from './SpectralBinding'
import CharacterPortrait from './CharacterPortrait'
import { portraitClips } from '../lib/portraitClips'

export type CardFaceProps = { draw: Draw; revealedPerks: number; lit: boolean; motionReduced: boolean; onInspect: (perk: Perk) => void; lockedCharacter: boolean; lockedPerks: (string | null)[] }
type Challenge = { ready: boolean; busy: boolean; direct: boolean; onClick: () => void }

export default function CardFace({ draw, revealedPerks, lit, motionReduced, onInspect, lockedCharacter, lockedPerks, challenge, enlarged = false, portraitActive = true }: CardFaceProps & { challenge?: Challenge; enlarged?: boolean; portraitActive?: boolean }) {
  return <article className={`revealed-card ${enlarged ? 'closeup-face' : 'reveal-face reveal-front'}`} aria-label={lit ? `Your fate: ${draw.character.name}` : 'Your chosen card'} aria-hidden={!lit}>
    {challenge && <button className="card-challenge" disabled={!challenge.ready || challenge.busy} aria-label={challenge.direct ? 'Enlarge character card' : 'Challenge the Entity for a closer look'} onMouseDown={(event) => { event.preventDefault(); event.currentTarget.focus({ preventScroll: true }) }} onClick={challenge.onClick} />}
    <span className="card-roman"><span>{draw.character.role === 'survivor' ? 'XVII' : 'XIII'}</span>{lockedCharacter && <LockKeyhole size={15} />}<span>{draw.character.role.toUpperCase()}</span></span>
    <div className="portrait-frame"><CharacterPortrait key={`${draw.id}:${portraitClips[draw.character.id]?.src ?? 'still'}`} character={draw.character} session={draw.id} clip={portraitClips[draw.character.id]} active={lit && portraitActive} reduced={motionReduced} /><div className="portrait-shade" /><div className="portrait-haunting" aria-hidden="true" /></div>
    <div className={`card-identity ${draw.character.name.length > 14 ? 'is-long-name' : ''}`}><span>THE ENTITY HAS CHOSEN</span><h2>{draw.character.name}</h2></div>
    <div className="card-perks">{draw.perks.map((perk, index) => {
      const shown = index < revealedPerks, held = lockedPerks[index] === perk.id
      return <div className={`card-perk-slot ${shown ? 'is-awakened' : ''} ${held ? 'is-held' : ''}`} key={perk.id}><span className="perk-seal" aria-hidden="true">{['I', 'II', 'III', 'IV'][index]}</span><button disabled={!shown} aria-hidden={!shown} aria-label={`View ${perk.name}, tier III`} onClick={() => onInspect(perk)}><img src={perk.image} alt="" /></button>{held && shown && <LockKeyhole className="card-lock-token" size={9} aria-hidden="true" />}</div>
    })}</div>
    <span className="card-bottom">◇ &nbsp; {challenge?.busy ? 'THE ENTITY RESISTS' : revealedPerks !== 4 ? 'THE FOG HOLDS ITS SECRETS' : challenge?.ready ? challenge.direct ? 'LOOK CLOSER' : 'CHALLENGE THE GRASP' : 'YOUR FATE IS SEALED'} &nbsp; ◇</span>
    {lockedCharacter && <SpectralBinding />}
  </article>
}
