import { useCallback, useEffect, useRef, useState } from 'react'
import { boundedVolume, getAudioContext, getAudioOutput } from './sound'

export type ThemeState = 'loading' | 'waiting' | 'playing' | 'paused' | 'error'

export function useBackgroundTheme(enabled: boolean, volume: number, ducking: boolean) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const graph = useRef<{ audio: HTMLAudioElement; context: AudioContext; source: MediaElementAudioSourceNode; gain: GainNode } | null>(null)
  const [state, setState] = useState<ThemeState>('loading')
  const playRequest = useRef<(() => void) | null>(null)
  const startTheme = useCallback(() => playRequest.current?.(), [])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    try {
      if (!graph.current || graph.current.audio !== audio) {
        const context = getAudioContext()
        graph.current = { audio, context, source: context.createMediaElementSource(audio), gain: context.createGain() }
        graph.current.gain.gain.value = 0
      }
      const { source, gain } = graph.current
      source.connect(gain).connect(getAudioOutput())
      return () => { audio.pause(); source.disconnect(); gain.disconnect() }
    } catch { queueMicrotask(() => setState('error')) }
  }, [])

  useEffect(() => {
    const gain = graph.current?.gain.gain
    const context = graph.current?.context
    if (!gain || !context) return
    gain.cancelAndHoldAtTime(context.currentTime)
    gain.linearRampToValueAtTime(enabled ? boundedVolume(volume) * (ducking ? .32 : 1) : 0, context.currentTime + (ducking ? .25 : .9))
  }, [volume, ducking, enabled])

  useEffect(() => {
    const audio = audioRef.current
    const context = graph.current?.context
    if (!audio || !context) return
    const lifecycle = { alive: true, request: 0 }
    const pause = () => { lifecycle.request++; audio.pause(); setState('paused') }
    const syncPlayback = () => {
      if (!enabled || document.hidden) { pause(); return }
      if (audio.error) setState('error')
      else if (!audio.paused && context.state === 'running') setState('playing')
      else setState(audio.readyState < HTMLMediaElement.HAVE_FUTURE_DATA ? 'loading' : 'waiting')
    }
    const start = () => {
      if (!enabled || document.hidden) return
      if (!audio.paused && context.state === 'running') { setState('playing'); return }
      if (audio.error) audio.load()
      const version = ++lifecycle.request
      // Both calls happen inside the gesture, before awaiting either permission promise.
      void Promise.all([context.resume(), audio.play()]).then(() => {
        if (!lifecycle.alive || version !== lifecycle.request) return
        setState(context.state === 'running' && !audio.paused ? 'playing' : 'waiting')
      }).catch(() => { if (lifecycle.alive && version === lifecycle.request) setState(audio.error ? 'error' : 'waiting') })
    }
    playRequest.current = start
    const visibility = () => { if (document.hidden) pause(); else start() }
    const failure = () => setState('error')
    if (enabled) start(); else pause()
    window.addEventListener('click', start, { capture: true })
    window.addEventListener('keydown', start, { capture: true })
    document.addEventListener('visibilitychange', visibility)
    audio.addEventListener('error', failure)
    audio.addEventListener('canplay', start)
    audio.addEventListener('playing', syncPlayback)
    context.addEventListener('statechange', syncPlayback)
    return () => {
      lifecycle.alive = false; lifecycle.request++
      playRequest.current = null
      window.removeEventListener('click', start, { capture: true })
      window.removeEventListener('keydown', start, { capture: true })
      document.removeEventListener('visibilitychange', visibility)
      audio.removeEventListener('error', failure)
      audio.removeEventListener('canplay', start)
      audio.removeEventListener('playing', syncPlayback)
      context.removeEventListener('statechange', syncPlayback)
    }
  }, [enabled])

  return { audioRef, state, startTheme }
}
