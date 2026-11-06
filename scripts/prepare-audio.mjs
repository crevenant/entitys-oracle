// Regeneration tool only. Requires FFmpeg and 7-Zip; playback needs neither.
import { mkdir, writeFile, readFile, readdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'

const ffmpeg = process.env.FFMPEG ?? 'ffmpeg'
const sevenZip = process.env.SEVEN_ZIP ?? '7z'
const sourceDir = 'output/audio-sources'
const outputDir = 'public/assets/audio'
const effectsOnly = process.argv.includes('--effects-only')
await mkdir(sourceDir, { recursive: true })
await mkdir(outputDir, { recursive: true })
const sources = [
  { file: 'theme.ogg', page: 'https://opengameart.org/content/horror-atmosphere', author: 'Juhani Junkala (SubspaceAudio)', url: 'https://opengameart.org/sites/default/files/Juhani%20Junkala%20-%20Post%20Apocalyptic%20Wastelands%20%5BLoop%20Ready%5D.ogg' },
  { file: 'shuffle.wav', page: 'https://opengameart.org/content/playing-card-sounds', author: 'Brian MacIntosh (BMacZero)', url: 'https://opengameart.org/sites/default/files/shuffle.wav' },
  { file: 'cut.wav', page: 'https://opengameart.org/content/playing-card-sounds', author: 'Brian MacIntosh (BMacZero)', url: 'https://opengameart.org/sites/default/files/cut.wav' },
  { file: 'contact.wav', page: 'https://opengameart.org/content/playing-card-sounds', author: 'Brian MacIntosh (BMacZero)', url: 'https://opengameart.org/sites/default/files/contact2.wav' },
  { file: 'wood.7z', page: 'https://opengameart.org/content/35-wooden-crackshitsdestructions', author: 'Independent.nu (submitted by qubodup)', url: 'https://opengameart.org/sites/default/files/independent_nu_ljudbank-wood_crack_hit_destruction.7z' },
  { file: 'heartbeat.flac', page: 'https://opengameart.org/content/heartbeat-single-sound', author: 'Independent.nu (submitted by qubodup)', url: 'https://opengameart.org/sites/default/files/heartbeat.mp3_.flac' },
  { file: 'ghost.zip', page: 'https://opengameart.org/content/ghost-monster-voice-moaning-growling', author: 'Iwan Gabovitch (qubodup)', url: 'https://opengameart.org/sites/default/files/qubodup-GhostMoans.zip' },
]
for (const source of sources) {
  const path = `${sourceDir}/${source.file}`
  let bytes
  try { bytes = await readFile(path) } catch {
    const response = await fetch(source.url)
    if (!response.ok) throw Error(`${response.status}: ${source.url}`)
    bytes = Buffer.from(await response.arrayBuffer())
    await writeFile(path, bytes)
  }
  source.sha256 = createHash('sha256').update(bytes).digest('hex')
  source.license = 'CC0-1.0'
}
function run(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8', windowsHide: true })
  if (result.error || result.status !== 0) throw result.error ?? Error(result.stderr)
}
run(sevenZip, ['x', `${sourceDir}/wood.7z`, `-o${sourceDir}/wood`, '-y'])
run(sevenZip, ['x', `${sourceDir}/ghost.zip`, `-o${sourceDir}/ghost`, '-y'])
const woodFiles = await readdir(`${sourceDir}/wood`, { recursive: true })
const wood = (name) => `${sourceDir}/wood/${woodFiles.find((path) => path.endsWith(name))}`
const ghost = `${sourceDir}/ghost/qubodup-GhostMoans/wav/qubodup-GhostMoan01.wav`
const recipes = [
  ['wastelands-theme.mp3', `${sourceDir}/theme.ogg`, 'loudnorm=I=-21:TP=-3:LRA=10', 112],
  ['cards-shuffle.wav', `${sourceDir}/shuffle.wav`, 'afftdn=nr=8:nf=-48,highpass=f=120,lowpass=f=5800,equalizer=f=3400:t=q:w=0.8:g=-2,afade=t=in:d=0.008,afade=t=out:st=0.65:d=0.12'],
  ['card-turn.wav', `${sourceDir}/cut.wav`, 'afftdn=nr=8:nf=-48,highpass=f=100,lowpass=f=5500,afade=t=in:d=0.008,areverse,afade=t=in:d=0.025,areverse'],
  ['card-place.wav', `${sourceDir}/contact.wav`, 'afftdn=nr=8:nf=-48,highpass=f=90,lowpass=f=4500,afade=t=in:d=0.008,areverse,afade=t=in:d=0.035,areverse'],
  ['root-crack.wav', wood('crack03.mp3.flac'), 'afftdn=nr=12:nf=-43,atrim=start=0.1:duration=0.95,asetpts=PTS-STARTPTS,asetrate=44100*0.86,aresample=44100,highpass=f=70,lowpass=f=2100,afade=t=in:d=0.012,afade=t=out:st=0.8:d=0.3'],
  ['entity-breath.wav', ghost, 'afftdn=nr=14:nf=-42,asetrate=44100*0.76,aresample=44100,atrim=0:3,highpass=f=80,lowpass=f=1350,afade=t=in:d=0.22,afade=t=out:st=2.2:d=0.8,volume=0.8'],
  ['veil-rise.wav', ghost, 'afftdn=nr=14:nf=-42,atrim=0.3:1.5,areverse,asetrate=44100*0.92,aresample=44100,highpass=f=180,lowpass=f=1800,afade=t=in:d=0.8,afade=t=out:st=1.05:d=0.25,volume=0.7'],
  ['reveal-impact.wav', wood('impactwood06.mp3.flac'), 'afftdn=nr=12:nf=-43,atrim=start=0.1:duration=1.3,asetpts=PTS-STARTPTS,asetrate=44100*0.78,aresample=44100,highpass=f=38,lowpass=f=1600,bass=g=3:f=140,afade=t=in:d=0.012,afade=t=out:st=0.85:d=0.8,alimiter=limit=0.8:level=false'],
  ['heartbeat.wav', `${sourceDir}/heartbeat.flac`, 'afftdn=nr=10:nf=-46,atrim=start=0.12:duration=0.9,asetpts=PTS-STARTPTS,highpass=f=38,lowpass=f=500,afade=t=in:d=0.012,afade=t=out:st=0.55:d=0.35,alimiter=limit=0.8:level=false'],
  ['perk-seal.wav', wood('impactwood03.mp3.flac'), 'afftdn=nr=12:nf=-43,atrim=start=0.1:duration=0.9,asetpts=PTS-STARTPTS,asetrate=44100*0.93,aresample=44100,highpass=f=110,lowpass=f=1900,afade=t=in:d=0.012,afade=t=out:st=0.4:d=0.55,alimiter=limit=0.75:level=false'],
]
for (const [name, source, filter, bitrate] of recipes) {
  if (effectsOnly && name === 'wastelands-theme.mp3') continue
  const encoding = name.endsWith('.wav') ? ['-ac', '1', '-codec:a', 'pcm_s16le'] : ['-ac', '2', '-codec:a', 'libmp3lame', '-b:a', `${bitrate}k`]
  run(ffmpeg, ['-y', '-hide_banner', '-loglevel', 'error', '-i', source, '-af', filter, '-ar', '44100', ...encoding, `${outputDir}/${name}`])
  console.log(name)
}
await mkdir('design', { recursive: true })
await writeFile('design/audio-sources.json', JSON.stringify({ imported: new Date().toISOString(), sources, recipes: recipes.map(([file, source, filter, bitrate]) => ({ file, source, filter, ...(bitrate ? { bitrate } : { encoding: 'PCM 16-bit mono, 44100 Hz' }) })) }, null, 2) + '\n')
