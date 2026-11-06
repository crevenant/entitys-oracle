import { useCallback, useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import type { Draw } from './oracle'
import { RITUAL } from './ritual'
import type { RitualPhase } from './ritual'
import { createRitualAudio } from './sound'

type State = { draw: Draw | null; phase: RitualPhase; revealedPerks: number; instant: boolean }
type Options = { reduced: boolean; sound: boolean; haptics: boolean; onComplete: (draw: Draw) => void }
type Playback = { draw: Draw; timeline: gsap.core.Timeline; audio: ReturnType<typeof createRitualAudio> }
const initial: State = { draw: null, phase: 'idle', revealedPerks: 0, instant: true }

function vibrate(pattern: number | number[]) {
  try { navigator.vibrate?.(pattern) } catch { /* Optional device feedback. */ }
}

export function useRitual({ reduced, sound, haptics, onComplete }: Options) {
  const [state, setState] = useState<State>(initial)
  const active = useRef<Playback | null>(null)
  const feedback = useRef({ sound, haptics })
  useEffect(() => {
    feedback.current = { sound, haptics }
    if (!sound) active.current?.audio?.stop()
    if (!haptics) vibrate(0)
  }, [sound, haptics])

  const finish = useCallback((instant = false) => {
    const playback = active.current
    if (!playback) return
    active.current = null
    playback.timeline.kill()
    playback.audio?.stop()
    vibrate(0)
    setState((previous) => ({ ...previous, draw: playback.draw, phase: 'complete', revealedPerks: 4, instant: instant || previous.instant }))
    onComplete(playback.draw)
  }, [onComplete])

  const cancel = useCallback(() => {
    const playback = active.current
    active.current = null
    playback?.timeline.kill()
    playback?.audio?.stop()
    vibrate(0)
  }, [])

  useEffect(() => () => cancel(), [cancel])
  useEffect(() => { if (reduced) finish(true) }, [reduced, finish])

  const start = useCallback((draw: Draw) => {
    if (active.current) return
    // Start decoding during the shuffle so the chosen portrait never reveals blank.
    for (const entry of [draw.character, ...draw.perks]) {
      const image = new Image()
      image.src = entry.image
      void image.decode().catch(() => undefined)
    }
    const timeline = gsap.timeline({ paused: true })
    const audio = sound && !reduced ? createRitualAudio() : null
    active.current = { draw, timeline, audio }
    setState({ draw, phase: 'gathering', revealedPerks: 0, instant: reduced })
    if (reduced) { finish(true); return }
    audio?.cue('gathering')
    for (const phase of ['shuffling', 'orbiting', 'choosing', 'flipping', 'revealing'] as const) {
      timeline.call(() => {
        if (!active.current) return
        setState((previous) => ({ ...previous, phase }))
        if (feedback.current.sound) audio?.cue(phase)
        if (phase === 'revealing' && feedback.current.haptics) vibrate([22, 40, 35])
      }, [], RITUAL[phase])
    }
    RITUAL.perks.forEach((time, index) => timeline.call(() => {
      if (!active.current) return
      setState((previous) => ({ ...previous, revealedPerks: index + 1 }))
      if (feedback.current.sound) audio?.cue('perk', index)
      if (feedback.current.haptics) vibrate(12)
    }, [], time))
    timeline.call(() => finish(), [], RITUAL.complete)
    timeline.play(0)
  }, [finish, reduced, sound])

  const reset = useCallback(() => { cancel(); setState(initial) }, [cancel])
  const restore = useCallback((draw: Draw) => {
    cancel()
    setState({ draw, phase: 'complete', revealedPerks: 4, instant: true })
  }, [cancel])

  return {
    ...state,
    drawing: state.phase !== 'idle' && state.phase !== 'complete',
    hasCard: ['flipping', 'revealing', 'complete'].includes(state.phase),
    start, reset, restore,
    skip: () => finish(true),
  }
}
