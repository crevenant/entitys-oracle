import { EYE_PATCH } from './cardEye'
import { MOTH_PATCH } from './cardMoth'

export const TENDRIL_PERIOD = 24
// The deck displays this 768px artwork at roughly 160px wide. Give the roots
// enough travel to remain visible at that size without disturbing the anchors.
export const TENDRIL_AMOUNT = 68 / 768
const FLOW_FPS = 30
export const NEUTRAL_TENDRILS = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="1" height="1"%3E%3Cpath fill="%23808080" d="M0 0h1v1H0z"/%3E%3C/svg%3E'
const WIDTH = 64, HEIGHT = 96
const smooth = (from: number, to: number, value: number) => {
  const t = Math.max(0, Math.min(1, (value - from) / (to - from)))
  return t * t * (3 - 2 * t)
}
type Region = { x: number; y: number; width: number; height: number }
const anchors: Region[] = [
  EYE_PATCH, MOTH_PATCH,
  { x: .445, y: .035, width: .11, height: .93 },
  { x: .035, y: .012, width: .19, height: .13 },
  { x: .775, y: .012, width: .19, height: .13 },
  { x: .035, y: .855, width: .19, height: .13 },
  { x: .775, y: .855, width: .19, height: .13 },
]

/** Feather displacement to zero around the frame, symbols, and live eye/moth patches. */
export function tendrilMotionMask(x: number, y: number) {
  let mask = smooth(.035, .095, Math.min(x, 1 - x)) * smooth(.025, .065, Math.min(y, 1 - y))
  for (const anchor of anchors) {
    const dx = Math.max(anchor.x - .02 - x, 0, x - anchor.x - anchor.width - .02)
    const dy = Math.max(anchor.y - .02 - y, 0, y - anchor.y - anchor.height - .02)
    mask *= smooth(0, .04, Math.hypot(dx, dy))
  }
  const ring = Math.hypot((x - .5) / .26, (y - .45) / .177)
  return mask * smooth(.025, .095, Math.abs(ring - 1))
}

export function createTendrilField() {
  const canvas = document.createElement('canvas'); canvas.width = WIDTH; canvas.height = HEIGHT
  const context = canvas.getContext('2d')!
  const pixels = context.createImageData(WIDTH, HEIGHT)
  const masks = new Float32Array(WIDTH * HEIGHT)
  const directions = Array.from({ length: 4 }, () => new Float32Array(WIDTH * HEIGHT))
  for (let row = 0; row < HEIGHT; row++) for (let col = 0; col < WIDTH; col++) {
    const x = col / (WIDTH - 1), y = row / (HEIGHT - 1), index = row * WIDTH + col
    masks[index] = tendrilMotionMask(x, y)
    const dx = x - .5, dy = (y - .45) * 1.5
    const radius = Math.hypot(dx, dy), angle = Math.atan2(dy, dx)
    directions[0][index] = Math.cos(angle)
    directions[1][index] = Math.sin(angle)
    directions[2][index] = radius * 18 + Math.sin(angle * 3) * .65
    directions[3][index] = angle * 3 + radius * 9
  }
  let frame = -1, version = 0, encodedVersion = -1, url = NEUTRAL_TENDRILS
  return {
    canvas,
    get version() { return version },
    update(time: number) {
      const next = Math.floor(Math.max(0, time) * FLOW_FPS)
      if (next === frame) return false
      frame = next
      // Integer harmonics meet with identical positions and velocities at the wrap.
      const phase = (next / FLOW_FPS % TENDRIL_PERIOD) / TENDRIL_PERIOD * Math.PI * 2
      for (let index = 0; index < masks.length; index++) {
        // A wave travels from the eye toward the edge. Negative radial sampling
        // stretches the artwork outward; the tangential component coils it.
        const pressure = directions[2][index] - phase * 2
        const push = -.48 - Math.sin(pressure) * .34
        const twist = Math.sin(directions[3][index] - phase) * .32 + Math.sin(pressure + .8) * .12
        const radialX = directions[0][index], radialY = directions[1][index]
        const dx = (radialX * push - radialY * twist) * masks[index]
        const dy = (radialY * push + radialX * twist) * masks[index] * (2 / 3)
        pixels.data[index * 4] = Math.round(127.5 + dx * 111)
        pixels.data[index * 4 + 1] = Math.round(127.5 + dy * 111)
        pixels.data[index * 4 + 2] = 128
        pixels.data[index * 4 + 3] = 255
      }
      context.putImageData(pixels, 0, 0)
      version++
      return true
    },
    imageURL() {
      if (encodedVersion !== version) { url = canvas.toDataURL('image/png'); encodedVersion = version }
      return url
    },
  }
}

let shared: ReturnType<typeof createTendrilField> | undefined
export function tendrilField(time: number) {
  shared ??= createTendrilField()
  shared.update(time)
  return shared
}
