import type { Draw, Perk } from '../lib/oracle'
import { CARD_REVEAL } from '../lib/ritual'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import gsap from 'gsap'
import type { RitualPhase } from '../lib/ritual'
import CardBack from './CardBack'
import CardFace from './CardFace'
import CardCloseup from './CardCloseup'
import { calmEntity, captivityMotion, captivityTime, entityReaction, provokeEntity } from '../lib/captivity'
import type { CaptivityClock } from '../lib/captivity'

type Props = { draw: Draw; phase: RitualPhase; revealedPerks: number; instant: boolean; reduced: boolean; captivity: CaptivityClock; onInspect: (perk: Perk) => void; lockedCharacter: boolean; lockedPerks: (string | null)[] }

export default function RevealedCard({ draw, phase, revealedPerks, instant, reduced, captivity, onInspect, lockedCharacter, lockedPerks }: Props) {
  const shell = useRef<HTMLDivElement>(null)
  const captive = useRef<HTMLDivElement>(null)
  const contact = useRef<HTMLDivElement>(null)
  const [inspection, setInspection] = useState<'idle' | 'resisting' | 'open'>('idle')
  const restoreFocus = useRef(false)
  useLayoutEffect(() => {
    if (inspection === 'idle' && restoreFocus.current) {
      shell.current?.querySelector<HTMLButtonElement>('.card-challenge')?.focus({ preventScroll: true })
      restoreFocus.current = false
    }
  }, [inspection])
  useEffect(() => () => calmEntity(captivity), [captivity])
  useEffect(() => {
    if (inspection !== 'resisting') return
    const surface = shell.current
    const update = () => {
      const reaction = entityReaction(captivity)
      surface?.setAttribute('data-resistance', reaction.forcing ? 'forcing' : reaction.surging ? 'surge' : `${reaction.level}`)
      if (reduced || instant || reaction.surging) {
        if (reduced || instant) calmEntity(captivity)
        setInspection('open'); gsap.ticker.remove(update)
      }
    }
    gsap.ticker.add(update)
    return () => { gsap.ticker.remove(update); surface?.removeAttribute('data-resistance') }
  }, [inspection, reduced, instant, captivity])
  const challenge = () => {
    if (inspection !== 'idle' || phase !== 'complete') return
    if (reduced || instant || captivity.current.start === null) { setInspection('open'); return }
    provokeEntity(captivity); setInspection('resisting')
  }
  const dismiss = () => { calmEntity(captivity); restoreFocus.current = true; setInspection('idle') }
  useLayoutEffect(() => {
    const element = captive.current
    if (!element) return
    const shadow = contact.current
    if (instant || reduced) { element.style.transform = 'none'; if (shadow) shadow.removeAttribute('style'); return }
    const update = () => {
      const time = captivityTime(captivity)
      const motion = captivityMotion(captivity)
      element.style.transform = time < 0 ? 'none' : `translate3d(${motion.x}px,${motion.y}px,${motion.z}px) rotateZ(${motion.roll}deg) rotateY(${motion.yaw}deg) rotateX(${motion.pitch}deg)`
      if (shadow) {
        shadow.style.opacity = `${Math.max(.08, 1 - Math.max(0, motion.z) * .012)}`
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
  const lit = phase === 'revealing' || phase === 'complete' || phase === 'returning'
  const style = { '--flip-duration': `${CARD_REVEAL.turn}s`, '--flight-duration': `${CARD_REVEAL.impact + CARD_REVEAL.settle}s`, '--lift-start': `${CARD_REVEAL.lift}px`, '--depth-start': `${CARD_REVEAL.depth}px`, '--card-perspective': `${CARD_REVEAL.perspective}px` } as CSSProperties
  const face = { draw, revealedPerks, lit, motionReduced: reduced, onInspect, lockedCharacter, lockedPerks }
  return <><div ref={shell} className={`reveal-shell ${instant ? 'is-instant' : ''} ${lit ? 'is-lit' : ''} ${inspection === 'open' ? 'is-inspecting' : ''}`} style={style} inert={phase === 'returning'} aria-hidden={inspection === 'open' || undefined}>
    <div className="reveal-aura" aria-hidden="true" />
    <div ref={contact} className="captive-contact" aria-hidden="true"><div className="reveal-contact-shadow" /></div>
    <div ref={captive} className="captive-card"><div className="reveal-flight"><div className="reveal-turn">
      <div className="reveal-back reveal-face" aria-hidden="true"><CardBack reduced={reduced || lit} /></div>
      <CardFace {...face} portraitActive={inspection !== 'open'} challenge={{ ready: phase === 'complete', busy: inspection !== 'idle', direct: reduced || instant, onClick: challenge }} />
    </div></div></div>
    {revealedPerks > 0 && !instant && <div key={revealedPerks} className="gift-ripple" aria-hidden="true" />}
  </div>{inspection === 'open' && <CardCloseup {...face} source={captive} captivity={captivity} reduced={reduced || instant} onDismiss={dismiss} />}</>
}
