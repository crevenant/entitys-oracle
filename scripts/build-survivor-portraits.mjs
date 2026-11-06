import { mkdir, readFile, writeFile, access } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import sharp from 'sharp'

const manifestPath = 'design/portraits/survivors/manifest.json'
const jobs = JSON.parse(await readFile(manifestPath, 'utf8'))
const eyeRegions = JSON.parse(await readFile('design/portraits/survivors/eye-regions.json', 'utf8'))
const blinkOverrides = JSON.parse(await readFile('design/portraits/survivors/blink-overrides.json', 'utf8'))
const ffmpeg = process.argv.find(a => a.startsWith('--ffmpeg='))?.slice(9) || process.env.PORTRAIT_FFMPEG || 'ffmpeg'
const only = process.argv.find(a => a.startsWith('--only='))?.slice(7).split(',')
const size = 512, fps = 24, duration = 8, steps = 60, bytes = size * size * 3
const timeline = [[0, 0], [1.2, 0], [2.2, 1], [2.55, 1], [3.25, 2], [4.1, 2], [5.1, 6], [5.4, 6], [6.9, 0], [8, 0]]
const run = (args, input) => {
  const result = spawnSync(ffmpeg, ['-y', '-hide_banner', '-loglevel', 'error', ...args], { input, maxBuffer: 64 * 1024 * 1024, windowsHide: true })
  if (result.status !== 0) throw new Error(result.stderr?.toString() || result.error?.message || `FFmpeg exited ${result.status}`)
  return result.stdout
}
await mkdir('public/assets/portrait-clips', { recursive: true })
await mkdir('output/portraits/review', { recursive: true })
for (const job of jobs) {
  if (only && !only.includes(job.slug)) continue
  try { await access(job.source) } catch { continue }
  const meta = await sharp(job.source).metadata()
  if (Math.abs(meta.width / meta.height - 2) > .03) throw new Error(`Unexpected sheet shape for ${job.name}`)
  const png = [], rgb = []
  const working = `output/portraits/${job.slug}`
  await mkdir(working, { recursive: true })
  for (let index = 0; index < 8; index++) {
    png[index] = await sharp(job.source).extract({ left: Math.round(index % 4 * meta.width / 4), top: Math.round(Math.floor(index / 4) * meta.height / 2), width: Math.floor(meta.width / 4), height: Math.floor(meta.height / 2) }).resize(size, size).removeAlpha().png().toBuffer()
    rgb[index] = await sharp(png[index]).raw().toBuffer()
    await writeFile(`${working}/${index}.png`, png[index])
  }
  await sharp(png[2]).extract({ left: 100, top: 60, width: 300, height: 200 }).png().toFile(`output/portraits/review/${job.slug}-eyes.png`)
  if (process.argv.includes('--prepare')) continue
  if (!(job.slug in eyeRegions)) continue
  job.eyes = eyeRegions[job.slug]
  job.reviewed = true
  const version = job.version ? `-v${job.version}` : ''
  const clip = `public/assets/portrait-clips/${job.slug}-loop${version}.mp4`
  const poster = `public/assets/portrait-clips/${job.slug}-poster${version}.webp`
  if (!process.argv.includes('--force') && job.status === 'rendered') {
    try { await access(clip); await access(poster); continue } catch { /* Rebuild missing outputs. */ }
  }
  let blinkRgb, halfBlinkRgb
  const blinkOverride = blinkOverrides[job.slug]
  const blinkStart = blinkOverride?.startFrame ?? 83
  const blinkPoses = blinkOverride?.poses ?? ['closed', 'closed']
  if (job.eyes.length) {
    const ellipses = job.eyes.map(([cx, cy, rx, ry]) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="white"/>`).join('')
    const mask = await sharp(Buffer.from(`<svg width="512" height="512">${ellipses}</svg>`)).blur(1).png().toBuffer()
    const patch = await sharp(png[4]).ensureAlpha().composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer()
    const blink = await sharp(png[2]).composite([{ input: patch }]).png().toBuffer()
    blinkRgb = await sharp(blink).removeAlpha().raw().toBuffer()
    await writeFile(`output/portraits/review/${job.slug}-blink.png`, blink)
    if (blinkOverride?.halfPose !== undefined) {
      const halfPatch = await sharp(png[blinkOverride.halfPose]).ensureAlpha().composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer()
      halfBlinkRgb = await sharp(png[2]).composite([{ input: halfPatch }]).removeAlpha().raw().toBuffer()
    }
    if (blinkPoses.includes('half') && !halfBlinkRgb) throw new Error(`Missing half-lid pose for ${job.name}`)
  }
  const transitions = new Map()
  for (const [from, to] of [[0, 1], [1, 2], [2, 6], [6, 0]]) {
    for (const [index, pose] of [from, from, to, to].entries()) await writeFile(`${working}/input-${index}.png`, png[pose])
    const data = run(['-framerate', '1', '-i', `${working}/input-%d.png`, '-vf', 'minterpolate=fps=60:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1:scd=none,trim=start=1:end=2,setpts=PTS-STARTPTS', '-frames:v', `${steps}`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1'])
    if (data.length !== steps * bytes) throw new Error(`Incomplete transition ${job.slug} ${from}-${to}`)
    transitions.set(`${from}-${to}`, data)
  }
  const frames = Buffer.alloc(duration * fps * bytes)
  for (let frame = 0; frame < duration * fps; frame++) {
    const time = frame / fps
    const segment = timeline.findIndex((point, index) => index < timeline.length - 1 && time >= point[0] && time < timeline[index + 1][0])
    const [start, from] = timeline[segment], [end, to] = timeline[segment + 1]
    let selected = rgb[from]
    if (from !== to) {
      const t = (time - start) / (end - start), step = Math.round(t * t * (3 - 2 * t) * steps)
      selected = step === steps ? rgb[to] : transitions.get(`${from}-${to}`).subarray(step * bytes, (step + 1) * bytes)
    }
    // Reviewed half-lid poses can lengthen a blink without morphing the face.
    const blinkIndex = frame - blinkStart
    if (blinkRgb && blinkIndex >= 0 && blinkIndex < blinkPoses.length) selected = blinkPoses[blinkIndex] === 'half' ? halfBlinkRgb : blinkRgb
    selected.copy(frames, frame * bytes)
  }
  if (!frames.subarray(0, bytes).equals(frames.subarray(frames.length - bytes))) throw new Error(`Loop seam mismatch: ${job.name}`)
  run(['-f', 'rawvideo', '-pix_fmt', 'rgb24', '-video_size', '512x512', '-framerate', `${fps}`, '-i', 'pipe:0', '-frames:v', `${duration * fps}`, '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', '19', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', clip], frames)
  await sharp(png[0]).webp({ quality: 92 }).toFile(poster)
  const reviewFrames = [rgb[0], rgb[1], rgb[2], blinkRgb ?? rgb[2], rgb[6], rgb[0]]
  await sharp({ create: { width: 768, height: 512, channels: 3, background: '#080b09' } }).composite(await Promise.all(reviewFrames.map(async (input, index) => ({ input: await sharp(input, { raw: { width: 512, height: 512, channels: 3 } }).resize(256, 256).png().toBuffer(), left: index % 3 * 256, top: Math.floor(index / 3) * 256 })))).webp({ quality: 90 }).toFile(`output/portraits/review/${job.slug}-loop.webp`)
  await writeFile(`design/portraits/survivors/${job.slug}/loop-recipe.json`, JSON.stringify({ source: job.source, clip, poster, fps, duration, size: [512, 512], timeline, blink: { eyes: job.eyes, frames: job.eyes.length ? blinkPoses.map((_, index) => blinkStart + index) : [], poses: job.eyes.length ? blinkPoses : [], halfPose: blinkOverride?.halfPose, note: job.eyes.length ? 'Eye-only patches over an unchanged neutral head; no blink interpolation' : 'Eyes obscured by opaque lenses; preserve glasses' }, interpolation: 'FFmpeg MCI / AOBMC / bidirectional / smoothstep timing', loop: 'Opening and closing authored frames are pixel-identical', creation: 'Built-in image generation, local interpolation and encoding', audio: false }, null, 2) + '\n')
  job.status = 'rendered'
  await writeFile(manifestPath, JSON.stringify(jobs, null, 2) + '\n')
  console.log(`Rendered ${job.name}`)
}
if (!process.argv.includes('--prepare')) {
  const registry = Object.fromEntries(jobs.filter(j => j.status === 'rendered').map(j => {
    const version = j.version ? `-v${j.version}` : ''
    return [j.id, { src: `/assets/portrait-clips/${j.slug}-loop${version}.mp4`, poster: `/assets/portrait-clips/${j.slug}-poster${version}.webp` }]
  }))
  await writeFile('src/lib/survivorPortraitClips.json', JSON.stringify(registry, null, 2) + '\n')
}
