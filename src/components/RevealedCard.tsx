import { LockKeyhole } from 'lucide-react'
import type { Draw, Perk } from '../lib/oracle'
import { CARD_REVEAL } from '../lib/ritual'
import { useLayoutEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import gsap from 'gsap'
import type { RitualPhase } from '../lib/ritual'
import SpectralBinding from './SpectralBinding'
import CardBack, { CardEyeIcon } from './CardBack'
import { captiveMotion, captivityTime } from '../lib/captivity'
import type { CaptivityClock } from '../lib/captivity'

type Props = { draw: Draw; phase: RitualPhase; revealedPerks: number; instant: boolean; reduced: boolean; captivity: CaptivityClock; onInspect: (perk: Perk) => void; lockedCharacter: boolean; lockedPerks: (string | null)[] }

export default function RevealedCard({ draw, phase, revealedPerks, instant, reduced, captivity, onInspect, lockedCharacter, lockedPerks }: Props) {
  const shell = useRef<HTMLDivElement>(null)
  const captive = useRef<HTMLDivElement>(null)
  const contact = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const element = captive.current
    if (!element) return
    const shadow = contact.current
    if (instant || reduced) { element.style.transform = 'none'; if (shadow) shadow.removeAttribute('style'); return }
    const update = () => {
      const time = captivityTime(captivity)
      const motion = captiveMotion(time)
      element.style.transform = time < 0 ? 'none' : `translate3d(${motion.x}px,${motion.y}px,${motion.z}px) rotateZ(${motion.roll}deg) rotateY(${motion.yaw}deg) rotateX(${motion.pitch}deg)`
      if (shadow) {
        shadow.style.opacity = `${1 - Math.max(0, motion.z) * .012}`
        shadow.style.transform = `translateX(${motion.x * .35}px) scale(${1 + motion.z * .004},${1 + motion.z * .002})`
      }
    }
    gsap.ticker.add(update)
    return () => { gsap.ticker.remove(update); element.style.transform = 'none'; shadow?.removeAttribute('style') }
  }, [instant, reduced, captivity])
  useLayoutEffect(() => {
    if (instant || !shell.current) return
    const animations = ['.reveal-flight', '.reveal-turn', '.reveal-contact-shadow'].flatMap((selector) => shell.current!.querySelector(selector)?.getAnimations() ?? [])
    if (!animations.length) return
    for (const animation of animations) { animation.pause(); animation.currentTime = 0 }
    const clock = { elapsed: 0 }
    // Use the same ticker as the ritual and 3D deck. A slow frame must never
    // leave a finished CSS flip waiting for the character reveal to catch up.
    const motion = gsap.to(clock, {
      elapsed: CARD_REVEAL.impact + CARD_REVEAL.settle,
      duration: CARD_REVEAL.impact + CARD_REVEAL.settle,
      ease: 'none',
      onUpdate: () => { for (const animation of animations) animation.currentTime = clock.elapsed * 1000 },
    })
    return () => { motion.kill() }
  }, [instant])
  const lit = phase === 'revealing' || phase === 'complete'
  const style = { '--flip-duration': `${CARD_REVEAL.turn}s`, '--flight-duration': `${CARD_REVEAL.impact + CARD_REVEAL.settle}s`, '--lift-start': `${CARD_REVEAL.lift}px`, '--depth-start': `${CARD_REVEAL.depth}px`, '--card-perspective': `${CARD_REVEAL.perspective}px` } as CSSProperties
  return <div ref={shell} className={`reveal-shell ${instant ? 'is-instant' : ''} ${lit ? 'is-lit' : ''}`} style={style}>
    <div className="reveal-aura" aria-hidden="true" />
    <div ref={contact} className="captive-contact" aria-hidden="true"><div className="reveal-contact-shadow" /></div>
    <div ref={captive} className="captive-card"><div className="reveal-flight"><div className="reveal-turn">
      <div className="reveal-back reveal-face" aria-hidden="true"><CardBack reduced={reduced || phase === 'revealing' || phase === 'complete'} /></div>
      <article className="revealed-card reveal-face reveal-front" aria-label={lit ? `Your fate: ${draw.character.name}` : 'Your chosen card'} aria-hidden={!lit}>
        <span className="card-roman">{draw.character.role === 'survivor' ? 'XVII' : 'XIII'} {lockedCharacter ? <LockKeyhole size={15} /> : <CardEyeIcon />} {draw.character.role.toUpperCase()}</span>
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
    </div></div></div>
    {revealedPerks > 0 && !instant && <div key={revealedPerks} className="gift-ripple" aria-hidden="true" />}
  </div>
}
