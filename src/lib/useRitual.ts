import { useCallback, useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import type { Draw } from './oracle'
import { DECK_RETURN, RITUAL } from './ritual'
import type { RitualPhase } from './ritual'
import { createRitualAudio, loadRitualSamples } from './sound'

type State = { draw: Draw | null; phase: RitualPhase; revealedPerks: number; instant: boolean }
type Options = { reduced: boolean; sound: boolean; volume: number; haptics: boolean; onComplete: (draw: Draw) => void }
type Playback = { draw: Draw; timeline: gsap.core.Timeline; audio: ReturnType<typeof createRitualAudio> }
const initial: State = { draw: null, phase: 'idle', revealedPerks: 0, instant: true }

function vibrate(pattern: number | number[]) {
  try { navigator.vibrate?.(pattern) } catch { /* Optional device feedback. */ }
}

export function useRitual({ reduced, sound, volume, haptics, onComplete }: Options) {
  const [state, setState] = useState<State>(initial)
  const active = useRef<Playback | null>(null)
  const clock = useRef({ time: 0 })
  const soundSession = useRef<ReturnType<typeof createRitualAudio>>(null)
  const feedback = useRef({ sound, haptics })
  useEffect(() => { if (sound) void loadRitualSamples().catch(() => undefined) }, [sound])
  useEffect(() => {
    feedback.current = { sound, haptics }
    if (!sound) soundSession.current?.stop()
    else soundSession.current?.setVolume(volume)
    if (!haptics) vibrate(0)
  }, [sound, volume, haptics])

  const finish = useCallback((instant = false) => {
    const playback = active.current
    if (!playback) return
    active.current = null
    playback.timeline.kill()
    if (instant) playback.audio?.stop()
    else playback.audio?.release()
    vibrate(0)
    setState((previous) => ({ ...previous, draw: playback.draw, phase: 'complete', revealedPerks: 4, instant: instant || previous.instant }))
    onComplete(playback.draw)
  }, [onComplete])

  const cancel = useCallback(() => {
    const playback = active.current
    active.current = null
    playback?.timeline.kill()
    playback?.audio?.stop()
    soundSession.current?.stop()
    vibrate(0)
  }, [])

  useEffect(() => () => cancel(), [cancel])
  useEffect(() => { if (reduced) finish(true) }, [reduced, finish])

  const start = useCallback((draw: Draw) => {
    if (active.current) return
    // Start decoding during the shuffle so the chosen portrait never reveals blank.
    for (const src of ['/assets/tarot-back-worn.webp', draw.character.image, ...draw.perks.map((perk) => perk.image)]) {
      const image = new Image()
      image.src = src
      void image.decode().catch(() => undefined)
    }
    const timeline = gsap.timeline({ paused: true })
    const returning = state.phase === 'complete' && !reduced
    const beginAt = returning ? DECK_RETURN.exit + DECK_RETURN.rise : 0
    clock.current.time = 0
    timeline.to(clock.current, { time: RITUAL.complete, duration: RITUAL.complete, ease: 'none' }, beginAt)
    soundSession.current?.stop()
    const audio = sound && !reduced ? createRitualAudio({ volume, role: draw.character.role === 'killer' ? 'killer' : 'survivor' }) : null
    soundSession.current = audio
    active.current = { draw, timeline, audio }
    const gather = () => {
      setState({ draw, phase: 'gathering', revealedPerks: 0, instant: reduced })
      if (feedback.current.sound) audio?.cue('gathering')
    }
    if (returning) {
      setState((previous) => ({ ...previous, phase: 'returning' }))
      timeline.call(() => setState({ draw: null, phase: 'returning', revealedPerks: 0, instant: false }), [], DECK_RETURN.exit)
      timeline.call(gather, [], beginAt)
    } else gather()
    if (reduced) { finish(true); return }
    for (const phase of ['shuffling', 'orbiting', 'choosing', 'flipping', 'revealing'] as const) {
      timeline.call(() => {
        if (!active.current) return
        setState((previous) => ({ ...previous, phase }))
        if (feedback.current.sound) audio?.cue(phase)
        if (phase === 'revealing' && feedback.current.haptics) vibrate([22, 40, 35])
      }, [], beginAt + RITUAL[phase])
    }
    RITUAL.perks.forEach((time, index) => timeline.call(() => {
      if (!active.current) return
      setState((previous) => ({ ...previous, revealedPerks: index + 1 }))
      if (feedback.current.sound) audio?.cue('perk', index)
      if (feedback.current.haptics) vibrate(12)
    }, [], beginAt + time))
    timeline.call(() => finish(), [], beginAt + RITUAL.complete)
    timeline.play(0)
  }, [finish, reduced, sound, state.phase, volume])

  const reset = useCallback(() => { cancel(); setState(initial) }, [cancel])
  const restore = useCallback((draw: Draw) => {
    cancel()
    setState({ draw, phase: 'complete', revealedPerks: 4, instant: true })
  }, [cancel])

  return {
    ...state,
    clock,
    drawing: state.phase !== 'idle' && state.phase !== 'complete',
    hasCard: ['returning', 'flipping', 'revealing', 'complete'].includes(state.phase),
    start, reset, restore,
    skip: () => finish(true),
  }
}
