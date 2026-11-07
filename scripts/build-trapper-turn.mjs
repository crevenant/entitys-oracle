import sharp from 'sharp'

const width = 144, height = 216, frameCount = 17
const scale = width / 1024
const names = ['stalking', 'three-quarter', 'stare']
const poses = await Promise.all(names.map(async (name) => {
  const pixels = await sharp(`public/assets/trapper-${name}.webp`).resize(width, height).ensureAlpha().raw().toBuffer()
  const premultiplied = Float32Array.from(pixels)
  for (let i = 0; i < pixels.length; i += 4) {
    const gray = pixels[i] * .213 + pixels[i + 1] * .715 + pixels[i + 2] * .072
    const alpha = pixels[i + 3] / 255
    for (let c = 0; c < 3; c++) premultiplied[i + c] = (gray + (pixels[i + c] - gray) * .4) * .52 * alpha * .74
    premultiplied[i + 3] *= .74
  }
  return premultiplied
}))

// Track the same mask landmarks in all three generated views. The first two
// points are the eye sockets, followed by the nose, jaw and skull contour.
const landmarks = [
  [[747, 218], [778, 218], [779, 245], [736, 324], [670, 283], [773, 274], [681, 59], [576, 109], [784, 132], [557, 167]],
  [[714, 209], [765, 207], [748, 243], [717, 321], [662, 273], [756, 267], [668, 57], [585, 102], [770, 127], [554, 157]],
  [[634, 198], [707, 199], [671, 239], [675, 315], [599, 257], [723, 263], [654, 57], [585, 97], [746, 122], [560, 151]],
]
const mix = (a, b, t) => a + (b - a) * t
const smooth = (value) => {
  const t = Math.max(0, Math.min(1, value))
  return t * t * (3 - 2 * t)
}

function sample(pixels, x, y, channel) {
  const left = Math.floor(x), top = Math.floor(y)
  const i = (top * width + left) * 4 + channel
  return mix(mix(pixels[i], pixels[i + 4], x - left),
    mix(pixels[i + width * 4], pixels[i + width * 4 + 4], x - left), y - top)
}

const strip = Buffer.alloc(width * frameCount * height * 4)
for (let frame = 0; frame < frameCount; frame++) {
  const progress = frame * 2 / (frameCount - 1)
  const pose = Math.min(1, Math.floor(progress)), t = progress - pose
  const points = landmarks[pose].map(([x, y], index) => {
    const [nextX, nextY] = landmarks[pose + 1][index]
    return { x: mix(x, nextX, t), y: mix(y, nextY, t), dx: nextX - x, dy: nextY - y }
  })

  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const source = (y * width + x) * 4
    const target = (y * width * frameCount + frame * width + x) * 4
    const px = x / scale, py = y / scale
    const head = smooth((px - 462) / 72) * (1 - smooth((py - 320) / 100))
    const color = Array.from(poses[0].subarray(source, source + 4))
    if (head > 0 && x < 128) {
      // Move each source toward the interpolated landmarks before blending its
      // texture. This gives the eye, nose and jaw continuous screen motion.
      let dx = 0, dy = 0, total = 0
      for (const point of points) {
        const weight = 1 / ((px - point.x) ** 2 + (py - point.y) ** 2 + 225) ** 2
        dx += point.dx * weight
        dy += point.dy * weight
        total += weight
      }
      dx *= head * scale / total
      dy *= head * scale / total
      for (let c = 0; c < 4; c++) {
        const from = sample(poses[pose], x - dx * t, Math.max(0, y - dy * t), c)
        const to = sample(poses[pose + 1], x + dx * (1 - t), Math.max(0, y + dy * (1 - t)), c)
        color[c] = mix(color[c], mix(from, to, t), head)
      }
    }

    // Follow the sockets through the turn and reveal the far eye with the mask.
    const glow = points.slice(0, 2).reduce((light, eye, index) => {
      const intensity = index === 0 ? .98 : mix([.18, .66][pose], [.66, .94][pose], t)
      const dx = px - eye.x, dy = py - eye.y
      const core = Math.exp(-((dx / 12) ** 2 + (dy / 9) ** 2))
      const halo = .34 * Math.exp(-((dx / 24) ** 2 + (dy / 20) ** 2))
      const socket = intensity * (core + halo * (1 - core))
      return light + socket * (1 - light)
    }, 0)
    const alpha = mix(color[3] / 255, 1, glow)
    for (const [channel, red] of [255, 24, 20].entries()) {
      strip[target + channel] = alpha ? Math.round(mix(color[channel], red, glow) / alpha) : 0
    }
    strip[target + 3] = Math.round(alpha * 255)
  }
}

await sharp(strip, { raw: { width: width * frameCount, height, channels: 4 } })
  .webp({ quality: 88, alphaQuality: 100 }).toFile('public/assets/trapper-turn.webp')
