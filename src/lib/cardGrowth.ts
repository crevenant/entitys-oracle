import { TENDRIL_PERIOD, tendrilMotionMask } from './cardTendrils'

const WIDTH = 384, HEIGHT = 576, STEPS = 36, TAU = Math.PI * 2
const clamp = (value: number) => Math.max(0, Math.min(1, value))
const smooth = (value: number) => { const t = clamp(value); return t * t * (3 - 2 * t) }

/** New root tips advance outward, branch, and disappear only after fading away. */
export function createTendrilGrowth() {
  const canvas = document.createElement('canvas'); canvas.width = WIDTH; canvas.height = HEIGHT
  const context = canvas.getContext('2d')!
  const mask = document.createElement('canvas'); mask.width = WIDTH; mask.height = HEIGHT
  const maskContext = mask.getContext('2d')!, pixels = maskContext.createImageData(WIDTH, HEIGHT)
  for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) {
    const index = (y * WIDTH + x) * 4
    pixels.data[index] = pixels.data[index + 1] = pixels.data[index + 2] = 255
    pixels.data[index + 3] = Math.round(tendrilMotionMask(x / (WIDTH - 1), y / (HEIGHT - 1)) * 255)
  }
  maskContext.putImageData(pixels, 0, 0)
  const roots = Array.from({ length: 18 }, (_, index) => {
    const angle = index / 18 * TAU + .12
    const dx = Math.cos(angle), dy = Math.sin(angle) / 1.5
    const edge = Math.min((dx > 0 ? .425 : -.425) / dx, (dy > 0 ? .49 : -.39) / dy)
    return { angle, edge, seed: index * 2.399, offset: (index * .618034) % 1 }
  })
  let frame = -1, version = 0
  return {
    canvas,
    get version() { return version },
    update(time: number) {
      const next = Math.floor(Math.max(0, time) * 30)
      if (next === frame) return false
      frame = next
      const cycle = (next / 30 % TENDRIL_PERIOD) / TENDRIL_PERIOD, phase = cycle * TAU
      context.clearRect(0, 0, WIDTH, HEIGHT)
      context.lineCap = 'round'; context.lineJoin = 'round'
      for (const root of roots) {
        const age = (cycle * 2 + root.offset) % 1
        const length = smooth(age / .72)
        const opacity = smooth(age / .08) * (1 - smooth((age - .72) / .28))
        if (length < .005 || opacity < .01) continue
        const points: [number, number][] = []
        for (let step = 0; step <= STEPS; step++) {
          const u = step / STEPS * length
          const r = .285 + (root.edge - .285) * u
          const curl = Math.sin(u * 7 - phase + root.seed) * .16 * Math.sin(u * Math.PI)
          const angle = root.angle + curl + Math.sin(phase + root.seed) * u * .08
          points.push([(.5 + Math.cos(angle) * r) * WIDTH, (.45 + Math.sin(angle) * r / 1.5) * HEIGHT])
        }
        // Dark bark consumes the old engraving; a narrow brass ridge catches light.
        context.globalAlpha = opacity
        for (const [width, color] of [[5.5, '#0d100c'], [3, '#57462c'], [.8, '#ad8b50']] as const) {
          context.strokeStyle = color; context.lineWidth = width
          context.beginPath(); points.forEach(([x, y], i) => { if (i) context.lineTo(x, y); else context.moveTo(x, y) }); context.stroke()
        }
        for (const attach of [.32, .57, .76]) {
          const extension = smooth((length - attach) / .2)
          if (!extension) continue
          const point = points[Math.min(STEPS, Math.round(attach / length * STEPS))]
          const side = attach === .57 ? -1 : 1
          const angle = root.angle + side * (.65 + Math.sin(phase + root.seed) * .24)
          const distance = 19 * extension
          const endX = point[0] + Math.cos(angle) * distance, endY = point[1] + Math.sin(angle) * distance
          context.strokeStyle = '#8e7043'; context.lineWidth = 1.2
          context.beginPath(); context.moveTo(...point)
          context.quadraticCurveTo(point[0] + Math.cos(angle + side * .7) * distance * .6, point[1] + Math.sin(angle + side * .7) * distance * .6, endX, endY); context.stroke()
        }
      }
      context.globalAlpha = 1
      context.globalCompositeOperation = 'destination-in'; context.drawImage(mask, 0, 0)
      context.globalCompositeOperation = 'source-over'
      version++
      return true
    },
  }
}

let shared: ReturnType<typeof createTendrilGrowth> | undefined
export function tendrilGrowth(time: number) {
  shared ??= createTendrilGrowth()
  shared.update(time)
  return shared
}
