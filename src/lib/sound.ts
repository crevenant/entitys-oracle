import type { SoundCue } from './ritual'
import type { Role } from './oracle'
import { publicUrl } from './publicUrl.ts'

export const AUDIO_FILES = {
  shuffle: '/assets/audio/cards-shuffle.wav', turn: '/assets/audio/card-turn.wav', place: '/assets/audio/card-place.wav',
  crack: '/assets/audio/root-crack.wav', breath: '/assets/audio/entity-breath.wav', rise: '/assets/audio/veil-rise.wav',
  impact: '/assets/audio/reveal-impact.wav', heartbeat: '/assets/audio/heartbeat.wav', seal: '/assets/audio/perk-seal.wav',
} as const
export const THEME_FILE = '/assets/audio/wastelands-theme.mp3'
export type SampleBank = Record<keyof typeof AUDIO_FILES, AudioBuffer>
type SoundOptions = { volume?: number; role?: Role; seed?: number; samples: SampleBank }
let context: AudioContext | undefined
let output: AudioNode | undefined
const banks = new WeakMap<BaseAudioContext, Promise<SampleBank>>()
export const boundedVolume = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : .75

export function getAudioContext() {
  context ??= new AudioContext({ latencyHint: 'interactive' })
  return context
}

/** Shared ceiling for music and effects, including when both volume sliders are at maximum. */
export function createAudioOutput(audio: BaseAudioContext, destination: AudioNode) {
  const compressor = audio.createDynamicsCompressor()
  compressor.threshold.value = -8; compressor.knee.value = 8; compressor.ratio.value = 12
  compressor.attack.value = .002; compressor.release.value = .18
  const limiter = audio.createWaveShaper()
  const curve = new Float32Array(4097)
  for (let index = 0; index < curve.length; index++) curve[index] = Math.max(-.92, Math.min(.92, index / 2048 - 1))
  limiter.curve = curve; limiter.oversample = '2x'
  compressor.connect(limiter).connect(destination)
  return compressor
}

export function getAudioOutput() {
  output ??= createAudioOutput(getAudioContext(), getAudioContext().destination)
  return output
}

export function loadRitualSamples(audio: BaseAudioContext = getAudioContext()) {
  let pending = banks.get(audio)
  if (!pending) {
    pending = Promise.all(Object.entries(AUDIO_FILES).map(async ([key, url]) => {
      const response = await fetch(publicUrl(url))
      if (!response.ok) throw Error(`Audio unavailable: ${url}`)
      return [key, await audio.decodeAudioData(await response.arrayBuffer())] as const
    })).then((entries) => Object.fromEntries(entries) as SampleBank)
    banks.set(audio, pending)
    void pending.catch(() => banks.delete(audio))
  }
  return pending
}

/** Sample-based foley and creature textures, shared by live playback and offline mix checks. */
export function createRitualSoundscape(audio: BaseAudioContext, destination: AudioNode, options: SoundOptions) {
  const pitch = options.role === 'killer' ? .89 : 1
  const sources = new Set<AudioScheduledSourceNode>()
  const voices = new Set<AudioNode>()
  let stopped = false, released = false, disposed = false
  let timer: ReturnType<typeof setTimeout> | undefined
  const dry = audio.createGain()
  // A damped delay room adds depth without a noise impulse or a grainy wash.
  const room = audio.createGain()
  const roomFilter = audio.createBiquadFilter()
  roomFilter.type = 'lowpass'; roomFilter.frequency.value = 1750; roomFilter.Q.value = .5
  const roomLevel = audio.createGain(); roomLevel.gain.value = .23
  const reflections: AudioNode[] = []
  for (const [index, time] of [.0311, .0437, .0573, .0719].entries()) {
    const delay = audio.createDelay(.2); delay.delayTime.value = time
    const damping = audio.createBiquadFilter(); damping.type = 'lowpass'; damping.frequency.value = 1100 + index * 180; damping.Q.value = .5
    const feedback = audio.createGain(); feedback.gain.value = .53 - index * .035
    const gain = audio.createGain(); gain.gain.value = .18
    const pan = audio.createStereoPanner(); pan.pan.value = [-.65, .5, -.3, .7][index]
    room.connect(delay).connect(damping)
    damping.connect(feedback).connect(delay)
    damping.connect(gain).connect(pan).connect(roomFilter)
    reflections.push(delay, damping, feedback, gain, pan)
  }
  const tension = audio.createGain()
  const lowCut = audio.createBiquadFilter(); lowCut.type = 'highpass'; lowCut.frequency.value = 32; lowCut.Q.value = .5
  const bodyEQ = audio.createBiquadFilter(); bodyEQ.type = 'lowshelf'; bodyEQ.frequency.value = 170; bodyEQ.gain.value = 2.5
  const harshness = audio.createBiquadFilter(); harshness.type = 'peaking'; harshness.frequency.value = 3200; harshness.Q.value = .8; harshness.gain.value = -3.5
  const air = audio.createBiquadFilter(); air.type = 'lowpass'; air.frequency.value = 6200; air.Q.value = .5
  const compressor = audio.createDynamicsCompressor()
  compressor.threshold.value = -12; compressor.knee.value = 12; compressor.ratio.value = 2.5
  compressor.attack.value = .012; compressor.release.value = .2
  const fade = audio.createGain()
  const volume = audio.createGain(); volume.gain.value = boundedVolume(options.volume ?? .75)
  dry.connect(tension)
  roomFilter.connect(roomLevel).connect(tension)
  tension.connect(lowCut).connect(bodyEQ).connect(harshness).connect(air).connect(compressor).connect(fade).connect(volume).connect(destination)
  const buses: AudioNode[] = [dry, room, roomFilter, roomLevel, ...reflections, tension, lowCut, bodyEQ, harshness, air, compressor, fade, volume]

  function register(source: AudioScheduledSourceNode, nodes: AudioNode[], at: number, end: number) {
    for (const node of nodes) voices.add(node)
    sources.add(source)
    source.addEventListener('ended', () => {
      source.disconnect(); sources.delete(source)
      for (const node of nodes) { node.disconnect(); voices.delete(node) }
    }, { once: true })
    source.start(at)
    source.stop(end + .01)
  }

  // Quiet, decaying low resonances add the body of a struck object, without fizz.
  function resonance(at: number, frequency: number, duration: number, level: number, pan = 0, endFrequency = frequency * .92) {
    const source = audio.createOscillator(); source.type = 'sine'
    source.frequency.setValueAtTime(frequency * pitch, at)
    source.frequency.exponentialRampToValueAtTime(endFrequency * pitch, at + duration)
    const gain = audio.createGain()
    gain.gain.setValueAtTime(0, at)
    gain.gain.linearRampToValueAtTime(level, at + .018)
    gain.gain.exponentialRampToValueAtTime(.00001, at + duration - .025)
    gain.gain.linearRampToValueAtTime(0, at + duration)
    const position = audio.createStereoPanner(); position.pan.value = pan
    source.connect(gain).connect(position).connect(dry)
    register(source, [gain, position], at, at + duration)
  }

  function play(key: keyof SampleBank, at: number, level: number, pan = 0, rate = 1, duration?: number, attack = .012, wet = .25) {
    const source = audio.createBufferSource()
    source.buffer = options.samples[key]
    source.playbackRate.value = rate * pitch
    const length = Math.min(duration ?? Infinity, source.buffer.duration / source.playbackRate.value)
    const gain = audio.createGain()
    const end = at + length
    gain.gain.setValueAtTime(0, at)
    gain.gain.linearRampToValueAtTime(level, at + Math.min(attack, length * .2))
    gain.gain.setValueAtTime(level, Math.max(at + attack, end - Math.min(.16, length * .35)))
    gain.gain.linearRampToValueAtTime(0, end)
    const position = audio.createStereoPanner(); position.pan.value = pan
    const send = audio.createGain(); send.gain.value = wet
    source.connect(gain).connect(position).connect(dry)
    position.connect(send).connect(room)
    register(source, [gain, position, send], at, end)
  }

  function dispose() {
    if (disposed) return
    disposed = true
    if (timer) clearTimeout(timer)
    for (const source of sources) { try { source.stop() } catch { /* Already ended. */ } source.disconnect() }
    sources.clear()
    for (const node of voices) node.disconnect()
    voices.clear()
    for (const bus of buses) bus.disconnect()
  }

  return {
    cue(phase: SoundCue, index = 0, at = audio.currentTime) {
      if (stopped || released || disposed) return
      switch (phase) {
        case 'gathering':
          play('breath', at, .16, -.25, 1, 1.8, .3, .3)
          play('place', at + .04, .55, -.15, 1, undefined, .016, .12)
          resonance(at + .04, 83, .65, .09, 0, 61)
          break
        case 'shuffling':
          play('shuffle', at, .65, -.4, 1, undefined, .012, .1)
          play('shuffle', at + .28, .3, .4, 1.06, .35, .014, .1)
          break
        case 'orbiting':
          play('breath', at, .22, .3, .95, 1.3, .22, .35)
          for (const [beat, delay] of [0, .51, .94].entries()) {
            play('heartbeat', at + delay, .58 + beat * .06, 0, 1 + beat * .04, .48, .012, .06)
            resonance(at + delay, 62, .24, .14 + beat * .025, 0, 43)
            resonance(at + delay + .16, 51, .2, .085, 0, 38)
          }
          play('crack', at + .37, .32, -.55, 1, .6, .018, .18)
          break
        case 'choosing':
          play('crack', at, .46, .45, .97, .48, .018, .2)
          play('breath', at, .28, -.2, .94, .5, .08, .3)
          resonance(at, 76, .45, .13, 0, 49)
          tension.gain.cancelScheduledValues(at)
          tension.gain.setValueAtTime(1, at)
          tension.gain.exponentialRampToValueAtTime(.0001, at + .47)
          break
        case 'flipping':
          tension.gain.cancelScheduledValues(at)
          tension.gain.setValueAtTime(.0001, at)
          tension.gain.exponentialRampToValueAtTime(1, at + .12)
          play('rise', at, .42, -.2, 1, .9, .3, .28)
          play('turn', at + .25, .62, .3, 1, undefined, .014, .12)
          resonance(at + .1, 92, .55, .055, 0, 146)
          break
        case 'revealing':
          play('impact', at, .72, 0, 1, 1.3, .018, .3)
          play('breath', at + .04, .2, .15, .94, 1.45, .12, .3)
          resonance(at, 68, .85, .3, 0, 42)
          resonance(at + .018, 113, .5, .085, -.12, 96)
          break
        case 'perk':
          play('seal', at, .36, [-.45, -.15, .15, .45][index] ?? 0, [1.04, 1, .97, .92][index] ?? 1, .8, .018, .25)
          play('place', at, .26, 0, 1, undefined, .015, .1)
          resonance(at, [196, 185, 174.6, 146.8][index] ?? 146.8, .65, .11, [-.3, -.1, .1, .3][index] ?? 0)
          if (index === 3) {
            resonance(at + .02, 73.4, .95, .14, 0, 55)
            resonance(at + .025, 110, .85, .055, -.15, 98)
          }
          break
      }
    },
    setVolume(value: number) {
      if (disposed || stopped) return
      volume.gain.cancelAndHoldAtTime(audio.currentTime)
      volume.gain.linearRampToValueAtTime(boundedVolume(value), audio.currentTime + .04)
    },
    release(at = audio.currentTime) {
      if (released || stopped || disposed) return
      released = true
      fade.gain.setValueAtTime(1, at)
      fade.gain.exponentialRampToValueAtTime(.00001, at + .95)
      if (!('startRendering' in audio)) timer = setTimeout(dispose, Math.max(0, at - audio.currentTime + 1.02) * 1000)
    },
    stop() {
      if (stopped || disposed) return
      stopped = true
      if (timer) clearTimeout(timer)
      const now = audio.currentTime
      fade.gain.cancelAndHoldAtTime(now)
      fade.gain.linearRampToValueAtTime(0, now + .025)
      for (const source of sources) { try { source.stop(now + .03) } catch { /* Already ended. */ } }
      timer = setTimeout(dispose, 45)
    },
    dispose,
  }
}

export function createRitualAudio(options: Omit<SoundOptions, 'samples'> = {}) {
  try {
    const audio = getAudioContext()
    void audio.resume().catch(() => undefined)
    let engine: ReturnType<typeof createRitualSoundscape> | undefined
    let stopped = false, released = false, volume = options.volume ?? .75
    const pending: { phase: SoundCue; index: number; at: number }[] = []
    void loadRitualSamples(audio).then((samples) => {
      if (stopped) return
      engine = createRitualSoundscape(audio, getAudioOutput(), { ...options, volume, samples })
      for (const cue of pending) if (audio.currentTime - cue.at < .3) engine.cue(cue.phase, cue.index)
      pending.length = 0
      if (released) engine.release()
    }).catch(() => undefined)
    return {
      cue(phase: SoundCue, index = 0) {
        if (stopped || released) return
        if (engine) engine.cue(phase, index)
        else pending.push({ phase, index, at: audio.currentTime })
      },
      setVolume(value: number) { volume = value; engine?.setVolume(value) },
      release() { released = true; engine?.release() },
      stop() { stopped = true; pending.length = 0; engine?.stop() },
    }
  } catch { return null }
}
