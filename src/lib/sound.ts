import type { SoundCue } from './ritual'

let context: AudioContext | undefined

/** Each draw owns its audio nodes, so skipping, muting, or leaving stops every cue. */
export function createRitualAudio() {
  try {
    context ??= new AudioContext()
    const audio = context
    void audio.resume().catch(() => undefined)
    const master = audio.createGain()
    master.gain.value = 0.16
    master.connect(audio.destination)
    const sources = new Set<AudioScheduledSourceNode>()
    let stopped = false

    function track(source: AudioScheduledSourceNode, gain: GainNode, duration: number, delay = 0) {
      sources.add(source)
      source.onended = () => { sources.delete(source); source.disconnect(); gain.disconnect() }
      source.start(audio.currentTime + delay)
      source.stop(audio.currentTime + delay + duration + 0.05)
    }

    function tone(frequency: number, duration: number, volume: number, delay = 0, endFrequency = frequency) {
      if (stopped) return
      const now = audio.currentTime + delay
      const source = audio.createOscillator()
      const gain = audio.createGain()
      source.type = 'sine'
      source.frequency.setValueAtTime(frequency, now)
      source.frequency.exponentialRampToValueAtTime(endFrequency, now + duration)
      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.exponentialRampToValueAtTime(volume, now + Math.min(duration / 3, 0.08))
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
      source.connect(gain).connect(master)
      track(source, gain, duration, delay)
    }

    function breath(duration: number, volume: number, delay = 0, frequency = 900) {
      if (stopped) return
      const now = audio.currentTime + delay
      const buffer = audio.createBuffer(1, Math.ceil(audio.sampleRate * duration), audio.sampleRate)
      const samples = buffer.getChannelData(0)
      for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1
      const source = audio.createBufferSource()
      source.buffer = buffer
      const filter = audio.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.setValueAtTime(frequency, now)
      filter.frequency.exponentialRampToValueAtTime(frequency / 3, now + duration)
      filter.Q.value = 0.6
      const gain = audio.createGain()
      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.linearRampToValueAtTime(volume, now + duration * 0.25)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
      source.connect(filter).connect(gain).connect(master)
      track(source, gain, duration, delay)
      source.addEventListener('ended', () => filter.disconnect(), { once: true })
    }

    return {
      cue(phase: SoundCue, index = 0) {
        if (stopped) return
        switch (phase) {
          case 'gathering': breath(0.44, 0.28); breath(5.3, 0.045, 0, 260); tone(82.41, 0.7, 0.16, 0, 55); break
          case 'shuffling':
            for (let beat = 0; beat < 5; beat++) breath(0.15, 0.26, beat * 0.12, 1900)
            break
          case 'orbiting':
            tone(110, 1.4, 0.08); tone(164.81, 1.25, 0.05, 0.08); breath(1.2, 0.12)
            for (let beat = 0; beat < 3; beat++) {
              tone(54, 0.14, 0.28, beat * 0.36, 40)
              tone(47, 0.11, 0.15, beat * 0.36 + 0.16, 35)
            }
            break
          case 'choosing':
            tone(65.41, 0.37, 0.3, 0, 49); breath(0.34, 0.2, 0, 550)
            master.gain.cancelScheduledValues(audio.currentTime)
            master.gain.setValueAtTime(0.16, audio.currentTime)
            master.gain.linearRampToValueAtTime(0.0001, audio.currentTime + 0.45)
            break
          case 'flipping':
            master.gain.cancelScheduledValues(audio.currentTime)
            master.gain.setValueAtTime(0.0001, audio.currentTime)
            master.gain.linearRampToValueAtTime(0.16, audio.currentTime + 0.12)
            breath(0.72, 0.28, 0, 1800); tone(220, 0.65, 0.1, 0, 659.25)
            break
          case 'revealing': tone(130.81, 1.2, 0.2); tone(196, 1, 0.12); tone(261.63, 0.85, 0.08); break
          case 'perk': {
            const frequency = [329.63, 392, 440, 659.25][index]
            tone(frequency, 0.46, 0.2)
            tone(frequency * 2, 0.32, 0.045, 0.025)
            break
          }
        }
      },
      stop() {
        if (stopped) return
        stopped = true
        for (const source of sources) { try { source.stop() } catch { /* Already ended. */ } }
        sources.clear()
        master.disconnect()
      },
    }
  } catch { return null }
}
