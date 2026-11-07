export const CAMPFIRE_FRAME = { width: 384, height: 256 }

type Zone = readonly [x: number, y: number, radiusX: number, radiusY: number]
type Beat = readonly [start: number, duration: number, lean: number, nod: number, handShift?: number]

// Coordinates and movement are measured on the 640 × 427 cutout. Positive
// lean moves right, and positive nod dips the head. The listeners overlap
// the end of each speaker's movement by a moment.
const figures: { torso: Zone; head: Zone; hand?: Zone; beats: Beat[] }[] = [
  // Sable inclines toward Vittorio and later acknowledges Rick.
  { torso: [188, 115, 58, 115], head: [191, 62, 39, 65], beats: [[.8, 4.8, 6, 0], [2.2, 1.2, 0, 7], [12.3, 1.5, 2, 6]] },
  // Vittorio gives one slow, shallow nod.
  { torso: [442, 111, 63, 110], head: [443, 58, 42, 59], beats: [[3.3, 1.8, -2, 3], [5.5, 3.3, -4.5, 0]] },
  // Dwight lifts his hand off his knee briefly, then leans in to speak.
  {
    torso: [75, 194, 93, 126], head: [109, 132, 41, 58], hand: [176, 252, 46, 31],
    beats: [[1.8, 2.4, 5, 0, 9], [7.1, 3.8, 12, 0], [8.2, 1.6, 0, 2, 7]],
  },
  // Rick resettles his forearm, then shifts his shoulders toward Dwight.
  {
    torso: [579, 193, 94, 125], head: [539, 124, 43, 61], hand: [464, 267, 49, 34],
    beats: [[4.2, 2.7, -4, 0, 9], [9.1, 4.7, -12, 0], [10.8, 1.7, 0, 3, -6]],
  },
]

function influence(x: number, y: number, [cx, cy, rx, ry]: Zone) {
  const distance = Math.hypot((x - cx) / rx, (y - cy) / ry)
  const t = Math.max(0, Math.min(1, (1 - distance) / .68))
  return t * t * (3 - 2 * t)
}

export function createCampfireConversation(image: CanvasImageSource, canvas: HTMLCanvasElement, gestures = true) {
  const { width, height } = CAMPFIRE_FRAME
  const context = canvas.getContext('2d')!
  context.drawImage(image, 0, 0, width, height)
  const source = context.getImageData(0, 0, width, height).data
  const output = context.createImageData(width, height)
  output.data.set(source)

  const moving = figures.map(({ torso, head, hand }) => {
    const points: { x: number; y: number; lean: number; nod: number; hand: number }[] = []
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const assetX = x * 640 / width, assetY = y * 427 / height
      const nod = influence(assetX, assetY, head)
      const lean = Math.max(influence(assetX, assetY, torso), nod)
      const handWeight = hand ? influence(assetX, assetY, hand) : 0
      if (Math.max(lean, handWeight) > .001) points.push({ x, y, lean, nod, hand: handWeight })
    }
    return points
  })

  // Interpolate premultiplied color so transparent hair and clothing edges
  // keep their original color as they move across fractional pixels.
  const premultiplied = Float32Array.from(source, (value, index) => index % 4 === 3 ? value : value * source[index | 3] / 255)
  const horizontal = new Float32Array(width * height)
  const vertical = new Float32Array(width * height)
  const active = [...new Set(moving.flatMap(points => points.map(({ x, y }) => y * width + x)))].sort((a, b) => a - b)

  return (time: number, gestureTime = time) => {
    const phase = gestureTime % 16
    horizontal.fill(0)
    vertical.fill(0)
    figures.forEach(({ beats }, index) => {
      // Different periods keep the seated figures from swaying in unison.
      // The influence fades at the hips, leaving their seats and feet planted.
      const rock = Math.sin(time * (.73 + index * .07) + index * 1.8) * 3.6
      let lean = rock
      let nod = Math.sin(time * 1.23 + index * 2.1) * .22
      let handShift = 0
      for (const [start, duration, sideways, down, hand = 0] of gestures ? beats : []) {
        const t = (phase - start) / duration
        if (t <= 0 || t >= 1) continue
        const ease = Math.sin(t * Math.PI) ** 2
        lean += ease * sideways
        nod += ease * down
        handShift += ease * hand
      }
      for (const point of moving[index]) {
        const pixel = point.y * width + point.x
        horizontal[pixel] += (lean * point.lean + handShift * point.hand) * width / 640
        vertical[pixel] += (nod * point.nod + Math.abs(rock) * point.lean * .12
          - Math.abs(handShift) * point.hand * .7) * height / 427
      }
    })

    for (const pixel of active) {
      const x = Math.max(0, Math.min(width - 1, pixel % width - horizontal[pixel]))
      const y = Math.max(0, Math.min(height - 1, Math.floor(pixel / width) - vertical[pixel]))
      const left = Math.floor(x), top = Math.floor(y)
      const right = Math.min(left + 1, width - 1), bottom = Math.min(top + 1, height - 1)
      const a = (top * width + left) * 4, b = (top * width + right) * 4
      const c = (bottom * width + left) * 4, d = (bottom * width + right) * 4
      const dx = x - left, dy = y - top
      const wA = (1 - dx) * (1 - dy), wB = dx * (1 - dy), wC = (1 - dx) * dy, wD = dx * dy
      const target = pixel * 4
      const alpha = source[a + 3] * wA + source[b + 3] * wB + source[c + 3] * wC + source[d + 3] * wD
      output.data[target + 3] = alpha
      for (let channel = 0; channel < 3; channel++) {
        output.data[target + channel] = alpha > 0
          ? (premultiplied[a + channel] * wA + premultiplied[b + channel] * wB
            + premultiplied[c + channel] * wC + premultiplied[d + channel] * wD) * 255 / alpha
          : 0
      }
    }
    context.putImageData(output, 0, 0)
  }
}
