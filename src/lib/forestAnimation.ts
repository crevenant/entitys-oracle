import { createFirePainter, FIRE_FORWARD } from './forestFire'

// Coordinates refer to the original 1672 × 941 forest plate. The shared CSS
// stage applies the same cover crop to both the photograph and these patches.
const PLATE = { width: 1672, height: 941 }
const CHAIN = { x: 240, y: 120, width: 110, height: 250 }
const SKY = { x: 960, y: 0, width: 460, height: 200 }
const TREES = { x: 1030, y: 125, width: 320, height: 370 }
const FIRE = { x: 1090, y: 410, width: 240, height: 220 }
const FIRE_BED = { x: 1110, y: 455, width: 210, height: 175 }
const clamp = (n: number) => Math.max(0, Math.min(1, n))
const smooth = (n: number) => { const t = clamp(n); return t * t * (3 - 2 * t) }

function surface(width: number, height: number) {
  const canvas = document.createElement('canvas')
  canvas.width = width; canvas.height = height
  return { canvas, ctx: canvas.getContext('2d')! }
}

function crop(image: HTMLImageElement, rect: { x: number; y: number; width: number; height: number }) {
  const target = surface(rect.width, rect.height)
  target.ctx.drawImage(image, rect.x / PLATE.width * image.naturalWidth, rect.y / PLATE.height * image.naturalHeight,
    rect.width / PLATE.width * image.naturalWidth, rect.height / PLATE.height * image.naturalHeight,
    0, 0, rect.width, rect.height)
  return target
}

export function paintFireBed(image: HTMLImageElement, canvas: HTMLCanvasElement) {
  const { width, height } = FIRE_BED
  const pixels = crop(image, FIRE_BED).ctx.getImageData(0, 0, width, height).data
  const context = canvas.getContext('2d')!
  const output = context.createImageData(width, height)
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    // Move the fire and the photographed logs as one patch. Taper the warp
    // into the surrounding clearing so the original flames aren't duplicated.
    const across = 1 - smooth((Math.abs(x - 101) - 45) / 45)
    const depth = smooth((y - 7) / 60) * (1 - smooth((y - 122) / 44))
    const sourceY = y - FIRE_FORWARD * across * depth
    const top = Math.floor(sourceY), fraction = sourceY - top
    const a = (top * width + x) * 4
    const b = (Math.min(height - 1, top + 1) * width + x) * 4
    const index = (y * width + x) * 4
    for (let c = 0; c < 3; c++) output.data[index + c] = pixels[a + c] + (pixels[b + c] - pixels[a + c]) * fraction
    output.data[index + 3] = 255 * smooth(Math.min(x, width - 1 - x, y, height - 1 - y) / 14)
  }
  context.putImageData(output, 0, 0)
}

function noise(x: number, y: number) {
  const hash = (a: number, b: number) => {
    const value = Math.sin(a * 127.1 + b * 311.7) * 43758.5453
    return value - Math.floor(value)
  }
  const ix = Math.floor(x), iy = Math.floor(y), fx = smooth(x - ix), fy = smooth(y - iy)
  const a = hash(ix, iy) * (1 - fx) + hash(ix + 1, iy) * fx
  const b = hash(ix, iy + 1) * (1 - fx) + hash(ix + 1, iy + 1) * fx
  return a * (1 - fy) + b * fy
}

function chainPainter(image: HTMLImageElement, canvas: HTMLCanvasElement) {
  const source = crop(image, CHAIN).canvas
  const ctx = canvas.getContext('2d')!
  const mask = surface(CHAIN.width, CHAIN.height)
  const pixels = mask.ctx.createImageData(CHAIN.width, CHAIN.height)
  for (let y = 0; y < CHAIN.height; y++) for (let x = 0; x < CHAIN.width; x++) {
    const edge = smooth(Math.min(x, CHAIN.width - 1 - x) / 18) * smooth(Math.min(y, CHAIN.height - 1 - y) / 22)
    const i = (y * CHAIN.width + x) * 4
    pixels.data[i + 3] = Math.round(edge * 255)
  }
  mask.ctx.putImageData(pixels, 0, 0)
  return (time: number) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    // Bend the original links and hook around their fixed branch attachment.
    // The feathered forest margin moves with them, hiding the original chain.
    const swing = Math.sin(time * 1.08) * 6.2 + Math.sin(time * 1.91) * .65
    for (let y = 0; y < CHAIN.height; y++) {
      const weight = smooth((y - 28) / 195)
      const offset = swing * weight
      ctx.drawImage(source, 0, y, CHAIN.width, 1, offset, y, CHAIN.width, 1)
    }
    ctx.globalCompositeOperation = 'destination-in'
    ctx.drawImage(mask.canvas, 0, 0)
    ctx.globalCompositeOperation = 'source-over'
  }
}

function cloudPainter(image: HTMLImageElement, canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')!
  const mask = crop(image, SKY)
  const pixels = mask.ctx.getImageData(0, 0, SKY.width, SKY.height)
  for (let y = 0; y < SKY.height; y++) for (let x = 0; x < SKY.width; x++) {
    const i = (y * SKY.width + x) * 4
    const luminance = (pixels.data[i] * .2126 + pixels.data[i + 1] * .7152 + pixels.data[i + 2] * .0722) / 255
    // Dark trunks and pine silhouettes stay in front of the passing clouds.
    const sky = smooth((luminance - .07) / .16)
    const edge = smooth(Math.min(x, SKY.width - 1 - x) / 45) * smooth((SKY.height - y) / 60)
    pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = 255
    pixels.data[i + 3] = Math.round(sky * edge * 255)
  }
  mask.ctx.putImageData(pixels, 0, 0)

  // A small, cached noise texture drifts in front of the moon. Its broad clear
  // gaps reveal the original moon again, with no opacity jump at the loop seam.
  const texture = surface(1024, SKY.height)
  const field = texture.ctx.createImageData(1024, SKY.height)
  for (let y = 0; y < SKY.height; y++) for (let x = 0; x < 1024; x++) {
    const angle = x / 1024 * Math.PI * 2
    // Circular noise coordinates make the texture horizontally tileable.
    const nx = Math.cos(angle) * 2.6 + 8, ny = Math.sin(angle) * 2.6 + y / 95
    const billow = noise(nx, ny) * .58 + noise(nx * 2.8, ny * 2.8) * .28 + noise(nx * 7.5, ny * 7.5) * .14
    const band = .5 + Math.sin(angle * 3 + .7) * .27
    const density = smooth((billow * .65 + band * .35 - .32) / .34)
    const i = (y * 1024 + x) * 4
    field.data[i] = 20 + billow * 13
    field.data[i + 1] = 29 + billow * 16
    field.data[i + 2] = 28 + billow * 16
    field.data[i + 3] = Math.round(density * .94 * 255)
  }
  texture.ctx.putImageData(field, 0, 0)
  return (time: number) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    const drift = (time * 11 + 580) % 1024
    ctx.drawImage(texture.canvas, -drift, 0)
    ctx.drawImage(texture.canvas, 1024 - drift, 0)
    ctx.globalCompositeOperation = 'destination-in'
    ctx.drawImage(mask.canvas, 0, 0)
    ctx.globalCompositeOperation = 'source-over'
  }
}

function treePainter(image: HTMLImageElement, canvas: HTMLCanvasElement, clouds: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')!
  const original = crop(image, TREES).canvas
  const source = surface(TREES.width, TREES.height)
  const output = ctx.createImageData(TREES.width, TREES.height)
  const trees = [
    { x: 1116, crown: 145, root: 462, radius: 61, amplitude: 2.6, speed: .79, phase: 0 },
    { x: 1181, crown: 238, root: 478, radius: 45, amplitude: 1.8, speed: .67, phase: .8 },
    { x: 1263, crown: 260, root: 482, radius: 56, amplitude: 2.2, speed: .73, phase: 1.7 },
  ]
  const weights = trees.map(() => new Float32Array(TREES.width * TREES.height))
  const feather = new Uint8ClampedArray(TREES.width * TREES.height)
  for (let y = 0; y < TREES.height; y++) for (let x = 0; x < TREES.width; x++) {
    const pixel = y * TREES.width + x
    const edge = smooth(Math.min(x, TREES.width - 1 - x) / 18) * smooth(Math.min(y, TREES.height - 1 - y) / 18)
    feather[pixel] = edge * 255
    trees.forEach((tree, index) => {
      const across = 1 - smooth((Math.abs(x + TREES.x - tree.x) / tree.radius - .5) * 2)
      const bend = smooth((tree.root - y - TREES.y) / (tree.root - tree.crown))
      const canopy = smooth((y + TREES.y - tree.crown + 30) / 28)
      // Each trunk stays planted; the crown bends most. Displacement eases
      // into the surrounding image, without cutout outlines or doubled trees.
      weights[index][pixel] = across * bend * bend * canopy * edge
    })
  }
  const motion = new Float32Array(trees.length)
  return (time: number) => {
    source.ctx.clearRect(0, 0, TREES.width, TREES.height)
    source.ctx.drawImage(original, 0, 0)
    // Include this frame's clouds before bending the trees so the overlapping
    // sky stays continuous. The moon and foreground branches remain outside.
    source.ctx.drawImage(clouds, SKY.x - TREES.x, SKY.y - TREES.y)
    const pixels = source.ctx.getImageData(0, 0, TREES.width, TREES.height).data
    trees.forEach((tree, index) => {
      motion[index] = smooth(time / 1.4) * (Math.sin(time * tree.speed + tree.phase) * tree.amplitude
        + Math.sin(time * 1.63 + tree.phase * 2) * .24)
    })
    for (let y = 0; y < TREES.height; y++) for (let x = 0; x < TREES.width; x++) {
      const pixel = y * TREES.width + x
      const displacement = weights[0][pixel] * motion[0] + weights[1][pixel] * motion[1] + weights[2][pixel] * motion[2]
      const sampleX = Math.max(0, Math.min(TREES.width - 1, x - displacement))
      const left = Math.floor(sampleX), fraction = sampleX - left
      const a = (y * TREES.width + left) * 4
      const b = (y * TREES.width + Math.min(TREES.width - 1, left + 1)) * 4
      const target = pixel * 4
      for (let channel = 0; channel < 3; channel++) {
        output.data[target + channel] = pixels[a + channel] + (pixels[b + channel] - pixels[a + channel]) * fraction
      }
      output.data[target + 3] = feather[pixel]
    }
    ctx.putImageData(output, 0, 0)
  }
}

export function createForestPainters(image: HTMLImageElement, chain: HTMLCanvasElement, clouds: HTMLCanvasElement, fire: HTMLCanvasElement, trees: HTMLCanvasElement) {
  const painters = [chainPainter(image, chain), cloudPainter(image, clouds), treePainter(image, trees, clouds), createFirePainter(fire)]
  return (time: number) => painters.forEach((paint) => paint(time))
}

export const forestPatches = { CHAIN, SKY, TREES, FIRE, FIRE_BED, PLATE }
