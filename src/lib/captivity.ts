import { useEffect, useLayoutEffect, useRef } from 'react'
import type { RefObject } from 'react'
import gsap from 'gsap'
import { CARD_REVEAL } from './ritual'
import type { RitualPhase } from './ritual'

export const CAPTIVITY = { reach: .52, held: 1.48, struggle: 1.72, fragments: 1.25 } as const
export const PROVOCATION = { beat: .72, shove: 2.16, surge: 2.9 } as const
export type CaptivityClock = RefObject<{ start: number | null; provokedAt: number | null }>
const smooth = (value: number) => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t) }
export const captivityTime = (clock: CaptivityClock) => clock.current.start === null ? -1 : (performance.now() - clock.current.start) / 1000
export const captureReach = (time: number) => smooth((time - CAPTIVITY.reach) / (CAPTIVITY.held - CAPTIVITY.reach))

/** Weighty 3D escape attempts, separated by still holds. Pixels/degrees. */
export function captiveMotion(time: number) {
  const t = Math.max(0, time - CAPTIVITY.struggle)
  const cycle = t % 3.6
  const tug = cycle < 1.3 ? Math.sin(cycle / 1.3 * Math.PI) ** 2 : 0
  const second = cycle > 1.6 && cycle < 2.15 ? Math.sin((cycle - 1.6) / .55 * Math.PI) ** 2 * .55 : 0
  const strength = (tug + second) * smooth(t / .18)
  return {
    x: Math.sin(t * 8.5) * 2.6 * strength,
    y: Math.sin(t * 6.5 + .7) * 1.8 * strength,
    z: Math.sin(t * 7.6 - .4) * 16 * strength,
    pitch: Math.sin(t * 7 + .6) * 8.5 * strength,
    yaw: Math.sin(t * 8.8 - .5) * 10 * strength,
    roll: Math.sin(t * 6.2 + .2) * 1.8 * strength,
  }
}
export type CaptiveMotion = ReturnType<typeof captiveMotion>

export const provokeEntity = (clock: CaptivityClock) => { clock.current.provokedAt = performance.now() }
export const calmEntity = (clock: CaptivityClock) => { clock.current.provokedAt = null }
export function entityReaction(clock: CaptivityClock) {
  const time = clock.current.provokedAt === null ? -1 : (performance.now() - clock.current.provokedAt) / 1000
  const level = time < 0 ? 0 : Math.min(3, Math.floor(time / PROVOCATION.beat) + 1)
  const surging = time >= PROVOCATION.surge
  const forcing = time >= PROVOCATION.shove && !surging
  const pulse = time < 0 || time >= PROVOCATION.shove ? 0 : Math.sin(time % PROVOCATION.beat / PROVOCATION.beat * Math.PI) ** 2
  return { time, level, forcing, surging, pulse, release: smooth((time - PROVOCATION.surge + .12) / .48) }
}
function forcedForwardMotion(elapsed: number): CaptiveMotion {
  const duration = PROVOCATION.surge - PROVOCATION.shove
  const progress = Math.max(0, Math.min(1, elapsed / duration))
  // Load against the grip first, then accelerate forward. Hold the final pose
  // through the modal handoff so the shove never resets to a neutral card.
  if (progress < .26) {
    const load = smooth(progress / .26)
    return { x: -4 * load, y: 7 * load, z: -28 * load, pitch: 12 * load, yaw: -4 * load, roll: -1.5 * load }
  }
  const drive = ((progress - .26) / .74) ** 3
  return { x: -4 + drive * 7, y: 7 - drive * 19, z: -28 + drive * 283, pitch: 12 - drive * 21, yaw: -4 + drive * 6, roll: -1.5 + drive * 2.1 }
}
export function captivityMotion(clock: CaptivityClock): CaptiveMotion {
  const reaction = entityReaction(clock)
  if (reaction.time < 0) return captiveMotion(captivityTime(clock))
  if (reaction.time >= PROVOCATION.shove) return forcedForwardMotion(reaction.time - PROVOCATION.shove)
  const t = reaction.time, strength = reaction.pulse * (1 + reaction.level * .75)
  return { x: Math.sin(t * 22) * 3 * strength, y: Math.sin(t * 18) * 2 * strength, z: Math.sin(t * 15) * 15 * strength, pitch: Math.sin(t * 16) * 8 * strength, yaw: Math.sin(t * 20) * 10 * strength, roll: Math.sin(t * 19) * 2.1 * strength }
}

/** CSS translate → roll → yaw → pitch, in screen axes, before perspective. */
export function captiveAnchor(x: number, y: number, motion: CaptiveMotion) {
  const pitch = motion.pitch * Math.PI / 180, yaw = motion.yaw * Math.PI / 180, roll = motion.roll * Math.PI / 180
  const py = y * Math.cos(pitch), pz = y * Math.sin(pitch)
  const yx = x * Math.cos(yaw) + pz * Math.sin(yaw), yz = -x * Math.sin(yaw) + pz * Math.cos(yaw)
  return { x: yx * Math.cos(roll) - py * Math.sin(roll) + motion.x, y: yx * Math.sin(roll) + py * Math.cos(roll) + motion.y, z: yz + motion.z }
}
export const captivePerspective = (z: number) => CARD_REVEAL.perspective / (CARD_REVEAL.perspective - z)

/** One impact timestamp keeps fragments, the Entity, and the HTML card aligned. */
export function useCaptivity(phase: RitualPhase, enabled: boolean, stage: RefObject<HTMLDivElement | null>): CaptivityClock {
  const clock = useRef<{ start: number | null; provokedAt: number | null }>({ start: null, provokedAt: null })
  const sequence = useRef<(() => void) | null>(null)
  useLayoutEffect(() => {
    const element = stage.current
    if (!element) return
    if (!enabled || (phase !== 'revealing' && phase !== 'complete')) {
      sequence.current?.(); sequence.current = null
      clock.current.start = null
      clock.current.provokedAt = null
      element.setAttribute('data-captivity', 'idle')
      return
    }
    if (phase !== 'revealing') return
    sequence.current?.()
    clock.current.start = performance.now()
    clock.current.provokedAt = null
    element.setAttribute('data-captivity', 'shattering')
    const update = () => {
      const time = captivityTime(clock)
      const next = time >= CAPTIVITY.held ? 'held' : time >= CAPTIVITY.reach ? 'reaching' : 'shattering'
      if (element.getAttribute('data-captivity') !== next) element.setAttribute('data-captivity', next)
      if (next === 'held') gsap.ticker.remove(update)
    }
    gsap.ticker.add(update)
    sequence.current = () => gsap.ticker.remove(update)
  }, [phase, enabled, stage])
  useEffect(() => () => { sequence.current?.() }, [])
  return clock
}
