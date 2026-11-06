import { useEffect, useLayoutEffect, useRef } from 'react'
import type { RefObject } from 'react'
import gsap from 'gsap'
import { CARD_REVEAL } from './ritual'
import type { RitualPhase } from './ritual'

export const CAPTIVITY = { reach: .52, held: 1.48, struggle: 1.72, fragments: 1.25 } as const
export type CaptivityClock = RefObject<{ start: number | null }>
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
  const clock = useRef<{ start: number | null }>({ start: null })
  const sequence = useRef<(() => void) | null>(null)
  useLayoutEffect(() => {
    const element = stage.current
    if (!element) return
    if (!enabled || (phase !== 'revealing' && phase !== 'complete')) {
      sequence.current?.(); sequence.current = null
      clock.current.start = null
      element.setAttribute('data-captivity', 'idle')
      return
    }
    if (phase !== 'revealing') return
    sequence.current?.()
    clock.current.start = performance.now()
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
