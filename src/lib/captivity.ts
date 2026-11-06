import { useEffect, useLayoutEffect, useRef } from 'react'
import type { RefObject } from 'react'
import gsap from 'gsap'
import type { RitualPhase } from './ritual'

export const CAPTIVITY = { reach: .52, held: 1.48, struggle: 1.72, fragments: 1.25 } as const
export type CaptivityClock = RefObject<{ start: number | null }>
const smooth = (value: number) => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t) }
export const captivityTime = (clock: CaptivityClock) => clock.current.start === null ? -1 : (performance.now() - clock.current.start) / 1000
export const captureReach = (time: number) => smooth((time - CAPTIVITY.reach) / (CAPTIVITY.held - CAPTIVITY.reach))

/** Brief, uneven attempts to escape, separated by quieter holds. Pixels/degrees. */
export function captiveMotion(time: number) {
  const t = Math.max(0, time - CAPTIVITY.struggle)
  const cycle = t % 3.6
  const tug = Math.sin(Math.min(1, cycle / .85) * Math.PI) ** 2
  const second = cycle > 1.15 && cycle < 1.65 ? Math.sin((cycle - 1.15) / .5 * Math.PI) ** 2 * .48 : 0
  const strength = (tug + second) * smooth(t / .18)
  return { x: Math.sin(t * 33) * 2.25 * strength, y: Math.sin(t * 28 + .7) * 1.25 * strength, roll: Math.sin(t * 30 + .2) * .7 * strength }
}

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
