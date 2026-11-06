import { build } from 'vite'
import { chromium } from '@playwright/test'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { RITUAL } from '../src/lib/ritual.ts'
import { AUDIO_FILES, THEME_FILE } from '../src/lib/sound.ts'

const bundle = await build({
  configFile: false,
  logLevel: 'silent',
  build: { write: false, minify: false, lib: { entry: 'src/lib/sound.ts', name: 'OracleSound', formats: ['iife'] } },
})
const code = (Array.isArray(bundle) ? bundle[0] : bundle).output.find((entry) => entry.type === 'chunk').code
await mkdir('output/audio', { recursive: true })
const browser = await chromium.launch()
const sampleData = Object.fromEntries(await Promise.all(Object.entries(AUDIO_FILES).map(async ([key, path]) => [key, (await readFile(`public${path}`)).toString('base64')])))
const themeData = (await readFile(`public${THEME_FILE}`)).toString('base64')
try {
  for (const mix of [{ role: 'survivor', volume: .75 }, { role: 'killer', volume: .75 }, { role: 'killer', volume: 1, music: true }]) {
    const page = await browser.newPage()
    await page.addScriptTag({ content: code })
    const rendered = await page.evaluate(async ({ mix, timeline, sampleData, themeData }) => {
      const sampleRate = 44100, seconds = 7.5
      const audio = new OfflineAudioContext(2, sampleRate * seconds, sampleRate)
      const samples = Object.fromEntries(await Promise.all(Object.entries(sampleData).map(async ([key, data]) => [key, await audio.decodeAudioData(Uint8Array.from(atob(data), (character) => character.charCodeAt(0)).buffer)])))
      const outputBus = window.OracleSound.createAudioOutput(audio, audio.destination)
      const sound = window.OracleSound.createRitualSoundscape(audio, outputBus, { ...mix, seed: 62841, samples })
      if (mix.music) {
        const theme = audio.createBufferSource()
        theme.buffer = await audio.decodeAudioData(Uint8Array.from(atob(themeData), (character) => character.charCodeAt(0)).buffer)
        theme.connect(outputBus)
        theme.start(0, 68)
        theme.stop(seconds)
      }
      for (const phase of ['gathering', 'shuffling', 'orbiting', 'choosing', 'flipping', 'revealing']) sound.cue(phase, 0, timeline[phase])
      timeline.perks.forEach((time, index) => sound.cue('perk', index, time))
      sound.release(timeline.complete)
      const buffer = await audio.startRendering()
      const channels = [buffer.getChannelData(0), buffer.getChannelData(1)]
      let peak = 0, energy = 0, finite = true, maxSampleStep = 0
      for (const channel of channels) {
        let previous = 0
        for (const value of channel) {
          finite &&= Number.isFinite(value)
          peak = Math.max(peak, Math.abs(value))
          maxSampleStep = Math.max(maxSampleStep, Math.abs(value - previous))
          previous = value
          energy += value * value
        }
      }
      const rms = (from, to) => {
        let sum = 0, count = 0
        for (const channel of channels) for (let index = Math.floor(from * sampleRate); index < Math.floor(to * sampleRate); index++) { sum += channel[index] ** 2; count++ }
        return Math.sqrt(sum / count)
      }
      const stats = { finite, peak, maxSampleStep, rms: Math.sqrt(energy / (buffer.length * 2)), heartbeat: rms(1.2, 2.4), hush: rms(3, 3.16), tail: rms(6.9, 7.4) }
      const bytes = new ArrayBuffer(44 + buffer.length * 4)
      const view = new DataView(bytes)
      const text = (offset, value) => { for (let index = 0; index < value.length; index++) view.setUint8(offset + index, value.charCodeAt(index)) }
      text(0, 'RIFF'); view.setUint32(4, bytes.byteLength - 8, true); text(8, 'WAVE'); text(12, 'fmt ')
      view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 2, true)
      view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 4, true); view.setUint16(32, 4, true); view.setUint16(34, 16, true)
      text(36, 'data'); view.setUint32(40, bytes.byteLength - 44, true)
      for (let frame = 0; frame < buffer.length; frame++) for (let channel = 0; channel < 2; channel++) {
        const value = Math.max(-1, Math.min(1, channels[channel][frame]))
        view.setInt16(44 + (frame * 2 + channel) * 2, Math.round(value * (value < 0 ? 32768 : 32767)), true)
      }
      const output = new Uint8Array(bytes)
      const chunks = []
      for (let index = 0; index < output.length; index += 16384) chunks.push(String.fromCharCode(...output.subarray(index, index + 16384)))
      sound.dispose()
      return { stats, wav: btoa(chunks.join('')) }
    }, { mix, timeline: RITUAL, sampleData, themeData: mix.music ? themeData : '' })
    const { stats } = rendered
    if (!stats.finite || stats.peak > .95 || stats.rms < .01 || (!mix.music && (stats.hush > .004 || stats.tail > .0001))) throw new Error(`Invalid mix: ${JSON.stringify({ mix, stats })}`)
    const path = `output/audio/ritual-${mix.music ? 'combined-max' : mix.role}.wav`
    await writeFile(path, Buffer.from(rendered.wav, 'base64'))
    console.log(`${path}: ${JSON.stringify(stats)}`)
    await page.close()
  }
} finally { await browser.close() }
