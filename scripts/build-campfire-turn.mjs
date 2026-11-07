import sharp from 'sharp'

const width = 256, height = 171, frameCount = 15
const scaleX = width / 1536, scaleY = height / 1024
const poses = await Promise.all([
  'public/assets/campfire-survivors.webp', 'design/campfire-turning.webp', 'design/campfire-looking.webp',
].map(async (path) => {
  const pixels = await sharp(path).resize(width, height, { fit: 'fill' }).ensureAlpha().raw().toBuffer()
  return Float32Array.from(pixels, (value, index) => index % 4 === 3 ? value : value * pixels[index | 3] / 255)
}))

// Landmarks on the original 1536 × 1024 artwork. Each set follows the
// same eye, nose, mouth, jaw and crown in the inward, halfway and facing poses.
const heads = [
  { zone: [451, 152, 127, 133], poses: [
    [[503, 139], [517, 157], [510, 178], [490, 199], [450, 78]],
    [[470, 140], [503, 155], [491, 175], [479, 196], [445, 75]],
    [[438, 141], [460, 162], [459, 182], [453, 200], [443, 75]],
  ] },
  { zone: [1044, 127, 123, 124], poses: [
    [[1020, 135], [1008, 153], [1021, 171], [1040, 191], [1061, 67]],
    [[1035, 138], [1018, 158], [1036, 175], [1046, 198], [1056, 62]],
    [[1052, 130], [1033, 155], [1038, 174], [1045, 199], [1042, 60]],
  ] },
  { zone: [266, 333, 122, 132], poses: [
    [[333, 340], [351, 351], [339, 374], [323, 402], [264, 244]],
    [[294, 345], [329, 374], [306, 399], [289, 423], [260, 245]],
    [[260, 343], [282, 373], [275, 399], [263, 423], [252, 246]],
  ] },
  { zone: [1280, 316, 137, 140], poses: [
    [[1211, 300], [1202, 330], [1216, 354], [1240, 397], [1280, 215]],
    [[1252, 312], [1218, 343], [1243, 370], [1259, 402], [1270, 217]],
    [[1266, 308], [1236, 342], [1251, 367], [1265, 400], [1271, 218]],
  ] },
]

const mix = (a, b, t) => a + (b - a) * t
const smooth = (value) => {
  const t = Math.max(0, Math.min(1, value))
  return t * t * (3 - 2 * t)
}

function sample(pixels, x, y, channel) {
  x = Math.max(0, Math.min(width - 1.001, x))
  y = Math.max(0, Math.min(height - 1.001, y))
  const left = Math.floor(x), top = Math.floor(y)
  const i = (top * width + left) * 4 + channel
  return mix(mix(pixels[i], pixels[i + 4], x - left),
    mix(pixels[i + width * 4], pixels[i + width * 4 + 4], x - left), y - top)
}

// Each pixel belongs to its nearest head zone. Beyond the zones the original
// seated bodies are copied verbatim, so the turn stays at the neck.
const regions = Array.from({ length: width * height }, (_, index) => {
  const x = (index % width) / scaleX, y = Math.floor(index / width) / scaleY
  let head = 0, coverage = 0
  heads.forEach(({ zone: [cx, cy, rx, ry] }, candidate) => {
    const weight = 1 - smooth((Math.hypot((x - cx) / rx, (y - cy) / ry) - .68) / .32)
    if (weight > coverage) { head = candidate; coverage = weight }
  })
  return { head, coverage }
})

const strip = Buffer.alloc(width * frameCount * height * 4)
for (let frame = 0; frame < frameCount; frame++) {
  const progress = frame * 2 / (frameCount - 1)
  const segment = Math.min(1, Math.floor(progress)), t = progress - segment
  const landmarks = heads.map(({ poses }) => poses[segment].map(([x, y], i) => {
    const [nextX, nextY] = poses[segment + 1][i]
    return { x: mix(x, nextX, t), y: mix(y, nextY, t), dx: nextX - x, dy: nextY - y }
  }))

  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const pixel = y * width + x
    const { head, coverage } = regions[pixel]
    const color = Array.from(poses[0].subarray(pixel * 4, pixel * 4 + 4))
    if (coverage > 0 && progress > 0) {
      let dx = 0, dy = 0, total = 0
      for (const point of landmarks[head]) {
        const weight = 1 / ((x / scaleX - point.x) ** 2 + (y / scaleY - point.y) ** 2 + 625) ** 2
        dx += point.dx * weight
        dy += point.dy * weight
        total += weight
      }
      dx *= coverage * scaleX / total
      dy *= coverage * scaleY / total
      for (let c = 0; c < 4; c++) {
        const from = sample(poses[segment], x - dx * t, y - dy * t, c)
        const to = sample(poses[segment + 1], x + dx * (1 - t), y + dy * (1 - t), c)
        color[c] = mix(color[c], mix(from, to, t), coverage)
      }
    }
    const target = (y * width * frameCount + frame * width + x) * 4
    strip[target + 3] = Math.round(color[3])
    for (let c = 0; c < 3; c++) strip[target + c] = color[3] ? Math.round(color[c] * 255 / color[3]) : 0
  }
}

await sharp(strip, { raw: { width: width * frameCount, height, channels: 4 } })
  .webp({ quality: 88, alphaQuality: 100 }).toFile('public/assets/campfire-turn.webp')
