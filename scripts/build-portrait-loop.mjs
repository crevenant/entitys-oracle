import { mkdir, readFile, writeFile, copyFile, readdir } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import sharp from 'sharp'

const argument = process.argv.find((value) => value.startsWith('--ffmpeg='))
const ffmpeg = argument?.slice('--ffmpeg='.length) || process.env.PORTRAIT_FFMPEG || 'ffmpeg'
const source = 'design/portrait-sable/keyframes-v1.png'
const blinkSource = 'design/portrait-sable/blink-poses-v2.png'
const working = 'output/portrait-sable'
const output = 'public/assets/portrait-clips'
const fps = 24, duration = 8, interpolationFrames = 60
const run = (args) => {
  const result = spawnSync(ffmpeg, ['-y', '-hide_banner', '-loglevel', 'error', ...args], { encoding: 'utf8', windowsHide: true })
  if (result.status !== 0) throw new Error(result.stderr || `FFmpeg exited ${result.status}`)
}
await mkdir(`${working}/keyframes`, { recursive: true })
await mkdir(`${working}/frames`, { recursive: true })
await mkdir(output, { recursive: true })
const metadata = await sharp(source).metadata()
for (let index = 0; index < 8; index++) {
  await sharp(source).extract({ left: Math.round(index % 4 * metadata.width / 4), top: Math.round(Math.floor(index / 4) * metadata.height / 2), width: Math.floor(metadata.width / 4), height: Math.floor(metadata.height / 2) })
    .resize(512, 512).png().toFile(`${working}/keyframes/${index}.png`)
}
// Hold one head pose throughout the blink; never morph the whole face to blink.
const blinkMask = await sharp(Buffer.from('<svg width="512" height="512"><ellipse cx="225" cy="127" rx="15" ry="17" fill="white"/><ellipse cx="282" cy="119" rx="17" ry="17" fill="white"/></svg>')).blur(1.2).png().toBuffer()
const blinkMetadata = await sharp(blinkSource).metadata()
for (let index = 0; index < 2; index++) {
  const patch = await sharp(blinkSource).extract({ left: Math.round(index * blinkMetadata.width / 2), top: 0, width: Math.floor(blinkMetadata.width / 2), height: blinkMetadata.height })
    .resize(512, 512).ensureAlpha().composite([{ input: blinkMask, blend: 'dest-in' }]).png().toBuffer()
  await sharp(`${working}/keyframes/4.png`).composite([{ input: patch }]).png().toFile(`${working}/keyframes/blink-${index}.png`)
}
// Four authored eye-only poses at 24 fps: half shut, shut, shut, half open.
const blinkStartFrame = 82, blinkPoses = [0, 1, 1, 0]
const timeline = [
  [0, 0], [1.2, 0], [1.6, 1], [2.3, 2], [2.65, 2], [3.35, 4],
  [4.1, 4], [5, 5], [5.35, 5],
  [5.95, 6], [6.9, 0], [duration, 0],
]
const pairs = [...new Set(timeline.slice(1).flatMap(([, to], index) => {
  const from = timeline[index][1]
  return from === to ? [] : [`${from}-${to}`]
}))]
for (const pair of pairs) {
  const [from, to] = pair.split('-').map(Number), folder = `${working}/transitions/${pair}`
  await mkdir(folder, { recursive: true }); await mkdir(`${folder}/input`, { recursive: true })
  const cached = (await readdir(folder)).filter((name) => name.endsWith('.png'))
  if (process.argv.includes('--reuse-transitions') && cached.length === interpolationFrames) {
    console.log(`Reused pose ${pair}`)
    continue
  }
  for (const [index, frame] of [from, from, to, to].entries()) await copyFile(`${working}/keyframes/${frame}.png`, `${folder}/input/${index}.png`)
  run(['-framerate', '1', '-i', `${folder}/input/%d.png`, '-vf', 'minterpolate=fps=60:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1:scd=none,trim=start=1:end=2,setpts=PTS-STARTPTS', '-frames:v', `${interpolationFrames}`, `${folder}/%03d.png`])
  const frames = (await readdir(folder)).filter((name) => name.endsWith('.png'))
  if (frames.length !== interpolationFrames) throw new Error(`Expected ${interpolationFrames} interpolated frames for ${pair}; received ${frames.length}`)
  console.log(`Interpolated pose ${pair}`)
}
for (let frame = 0; frame < duration * fps; frame++) {
  const time = frame / fps
  const segment = timeline.findIndex((point, index) => index < timeline.length - 1 && time >= point[0] && time < timeline[index + 1][0])
  const [start, from] = timeline[segment], [end, to] = timeline[segment + 1]
  let image = `${working}/keyframes/${from}.png`
  if (from !== to) {
    const t = (time - start) / (end - start), ease = t * t * (3 - 2 * t)
    const step = Math.round(ease * interpolationFrames)
    image = step === interpolationFrames ? `${working}/keyframes/${to}.png` : `${working}/transitions/${from}-${to}/${String(step + 1).padStart(3, '0')}.png`
  }
  const blinkIndex = frame - blinkStartFrame
  if (blinkIndex >= 0 && blinkIndex < blinkPoses.length) image = `${working}/keyframes/blink-${blinkPoses[blinkIndex]}.png`
  await copyFile(image, `${working}/frames/${String(frame).padStart(4, '0')}.png`)
}
// Both ends rest on exactly the same authored neutral frame; no reverse loop.
const first = await readFile(`${working}/frames/0000.png`), last = await readFile(`${working}/frames/${String(duration * fps - 1).padStart(4, '0')}.png`)
if (!first.equals(last)) throw new Error('The loop seam must match exactly')
run(['-framerate', `${fps}`, '-i', `${working}/frames/%04d.png`, '-frames:v', `${duration * fps}`, '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', '19', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', `${output}/sable-ward-loop.mp4`])
await sharp(`${working}/keyframes/0.png`).webp({ quality: 92 }).toFile(`${output}/sable-ward-poster.webp`)
await writeFile('design/portrait-sable/loop-recipe.json', JSON.stringify({ source, blinkSource, output: `${output}/sable-ward-loop.mp4`, poster: `${output}/sable-ward-poster.webp`, duration, fps, size: [512, 512], timeline, blink: { startFrame: blinkStartFrame, poses: blinkPoses, method: 'Feathered eye-only patches over fixed pose 4; no optical-flow interpolation during the blink' }, interpolation: 'FFmpeg minterpolate / MCI / AOBMC / bidirectional motion estimation / 60 intermediate frames / smoothstep timing', loop: 'Identical neutral image at both ends, held for 1.1 seconds at the end', creation: 'Built-in image generation for authored key poses; local interpolation and H.264 encoding', audio: false }, null, 2) + '\n')
console.log(`Created ${path.resolve(output, 'sable-ward-loop.mp4')}`)
