const WIDTH = 640
const HEIGHT = 320
export const HEADLINE_PADDING = 40
export const HEADLINE_CANVAS = { width: WIDTH + HEADLINE_PADDING * 2, height: HEIGHT + HEADLINE_PADDING * 2 }
const TAU = Math.PI * 2
const smooth = (value: number) => {
  const t = Math.max(0, Math.min(1, value))
  return t * t * (3 - 2 * t)
}

// Rear roots emerge through the gaps; front roots curl over the letter strokes.
const roots: { x: number; y: number; dx: number; dy: number; length: number; back?: boolean }[] = [
  { x: .17, y: .12, dx: -.7, dy: -.65, length: 33 },
  { x: .145, y: .015, dx: -.15, dy: -1, length: 23 },
  { x: .075, y: .53, dx: -.95, dy: .3, length: 38 },
  { x: .018, y: .64, dx: -.4, dy: .9, length: 23 },
  { x: .105, y: .94, dx: -.2, dy: 1, length: 28 },
  { x: .42, y: .53, dx: .8, dy: -.5, length: 41 },
  { x: .81, y: .08, dx: .75, dy: .25, length: 30 },
  { x: .89, y: .21, dx: .6, dy: -.8, length: 29 },
  { x: .965, y: .46, dx: .95, dy: .25, length: 35 },
  { x: .84, y: .92, dx: .65, dy: .7, length: 27 },
  { x: .13, y: .68, dx: .5, dy: -.9, length: 77, back: true },
  { x: .22, y: .55, dx: .15, dy: -1, length: 87, back: true },
  { x: .3, y: .87, dx: -.15, dy: -.95, length: 103, back: true },
  { x: .34, y: .43, dx: .8, dy: -.2, length: 66, back: true },
  { x: .43, y: .83, dx: .35, dy: -.9, length: 92, back: true },
  { x: .49, y: .49, dx: -.2, dy: -.95, length: 77, back: true },
  { x: .57, y: .83, dx: .5, dy: -.85, length: 92, back: true },
  { x: .63, y: .37, dx: -.6, dy: .75, length: 69, back: true },
  { x: .71, y: .88, dx: -.2, dy: -1, length: 97, back: true },
  { x: .78, y: .5, dx: -.65, dy: -.45, length: 75, back: true },
  { x: .86, y: .73, dx: -.1, dy: -.95, length: 79, back: true },
  { x: .92, y: .55, dx: .7, dy: .45, length: 46, back: true },
  { x: .19, y: .43, dx: .75, dy: -.2, length: 42 },
  { x: .24, y: .71, dx: .55, dy: .5, length: 39 },
  { x: .32, y: .54, dx: -.45, dy: .85, length: 37 },
  { x: .39, y: .77, dx: -.1, dy: -.9, length: 48 },
  { x: .47, y: .38, dx: .75, dy: .45, length: 41 },
  { x: .51, y: .69, dx: .5, dy: -.7, length: 42 },
  { x: .59, y: .52, dx: -.7, dy: -.5, length: 37 },
  { x: .66, y: .77, dx: -.2, dy: -.95, length: 48 },
  { x: .73, y: .43, dx: .45, dy: .65, length: 36 },
  { x: .81, y: .69, dx: -.7, dy: .15, length: 44 },
]

export function createHeadlinePainter(image: HTMLImageElement, canvas: HTMLCanvasElement) {
  const context = canvas.getContext('2d')!
  const sourceCanvas = document.createElement('canvas')
  sourceCanvas.width = WIDTH
  sourceCanvas.height = HEIGHT
  const sourceContext = sourceCanvas.getContext('2d')!
  sourceContext.drawImage(image, 0, 0, WIDTH, HEIGHT)
  const pixels = sourceContext.getImageData(0, 0, WIDTH, HEIGHT).data
  const premultiplied = Float32Array.from(pixels, (value, index) => index % 4 === 3 ? value : value * pixels[index | 3] / 255)
  const output = sourceContext.createImageData(WIDTH, HEIGHT)
  output.data.set(pixels)
  const letters = new Float32Array(WIDTH * HEIGHT)
  const motion = new Float32Array(WIDTH * HEIGHT)
  const fog = new Float32Array(WIDTH * HEIGHT)
  const active: number[] = []
  const contours: [number, number][] = []

  for (let i = 0; i < letters.length; i++) {
    const p = i * 4
    const light = (pixels[p] * .213 + pixels[p + 1] * .715 + pixels[p + 2] * .072) / 255
    letters[i] = smooth((light - .37) / .19) * smooth(pixels[p + 3] / 180)
  }
  for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) {
    const index = y * WIDTH + x
    // A narrow margin protects the pale lettering while the dark roots move.
    let fixed = letters[index]
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const neighbor = Math.max(0, Math.min(HEIGHT - 1, y + dy)) * WIDTH + Math.max(0, Math.min(WIDTH - 1, x + dx))
      fixed = Math.max(fixed, letters[neighbor])
    }
    motion[index] = (1 - fixed) * smooth(Math.min(x, WIDTH - x, y, HEIGHT - y) / 9)
    fog[index] = (1 - fixed) * smooth((y / HEIGHT - .48) / .18)
      * (1 - smooth((pixels[index * 4 + 3] / 255 - .68) / .29))
    let nearbyAlpha = 0
    for (const dy of [-14, -7, 0, 7, 14]) for (const dx of [-14, -7, 0, 7, 14]) {
      const neighbor = Math.max(0, Math.min(HEIGHT - 1, y + dy)) * WIDTH + Math.max(0, Math.min(WIDTH - 1, x + dx))
      nearbyAlpha = Math.max(nearbyAlpha, pixels[neighbor * 4 + 3])
    }
    if (nearbyAlpha && (motion[index] > .001 || fog[index] > .001)) active.push(index)
    if (y > HEIGHT * .4 && y < HEIGHT - 8 && x % 3 === 0 && y % 2 === 0
      && letters[index] > .65 && letters[index + WIDTH * 3] < .15) contours.push([x, y + 3])
  }

  const puff = document.createElement('canvas')
  puff.width = puff.height = 64
  const puffContext = puff.getContext('2d')!
  for (let cloud = 0; cloud < 7; cloud++) {
    const x = 21 + Math.sin(cloud * 2.4) * 10
    const y = 29 + Math.cos(cloud * 1.7) * 10
    const vapor = puffContext.createRadialGradient(x, y, 0, x, y, 23)
    vapor.addColorStop(0, 'rgba(164,183,176,.25)')
    vapor.addColorStop(.5, 'rgba(125,151,141,.11)')
    vapor.addColorStop(1, 'rgba(99,126,115,0)')
    puffContext.fillStyle = vapor
    puffContext.fillRect(0, 0, 64, 64)
  }
  const wisps = Array.from({ length: 42 }, (_, index) => ({
    point: contours[(index * 137 + 17) % contours.length] ?? [WIDTH * .5, HEIGHT * .8],
    duration: 6 + index % 5,
    offset: (index * .618034) % 1,
    direction: index % 2 ? 1 : -1,
  }))
  const gridWidth = 41, gridHeight = 21
  const flowX = new Float32Array(gridWidth * gridHeight)
  const flowY = new Float32Array(gridWidth * gridHeight)
  const fogOpacity = new Float32Array(gridWidth * gridHeight)

  function drawRoots(time: number, back: boolean) {
    const phase = time / 10 * TAU
    context.save()
    context.translate(HEADLINE_PADDING, HEADLINE_PADDING)
    context.lineCap = 'round'
    context.lineJoin = 'round'
    roots.forEach((root, index) => {
      if (Boolean(root.back) !== back) return
      const age = (time / (11 + index % 3 * 2) + index * .137) % 1
      const growth = smooth(age / .44)
      const opacity = smooth(age / .1) * (1 - smooth((age - .77) / .23))
      const points: [number, number][] = []
      for (let step = 0; step <= 30; step++) {
        const u = step / 30 * growth
        const curl = Math.sin(u * 8 - phase + index) * u * u * 22
        const spread = root.length * 1.4 * u
        points.push([root.x * WIDTH + root.dx * spread - root.dy * curl,
          root.y * HEIGHT + root.dy * spread + root.dx * curl])
      }
      for (const [lineWidth, color, strength] of [[7, '#030806', .38], [4, '#07100c', .95], [1.1, '#142219', .7]] as const) {
        context.globalAlpha = opacity * strength
        context.lineWidth = lineWidth * (back ? 1.25 : 1)
        context.strokeStyle = color
        context.beginPath()
        points.forEach(([x, y], point) => { if (point) context.lineTo(x, y); else context.moveTo(x, y) })
        context.stroke()
      }
    })
    context.restore()
  }

  return (time: number) => {
    const phase = time / 10 * TAU
    // Advect the original root/fog pixels with a coarse cached flow field.
    // Sine values are evaluated per grid cell, not per image pixel.
    for (let gy = 0; gy < gridHeight; gy++) for (let gx = 0; gx < gridWidth; gx++) {
      const x = gx / (gridWidth - 1), y = gy / (gridHeight - 1)
      const edge = Math.max(Math.abs(x - .5) * 1.7, Math.abs(y - .5) * 1.8)
      const amount = 1.5 + edge * 7
      const i = gy * gridWidth + gx
      flowX[i] = (Math.sin(x * 11 + y * 7 - phase) + Math.sin(y * 19 + phase * 2) * .35) * amount
      flowY[i] = (Math.sin(x * 15 - y * 6 + phase) * .7 + Math.cos(y * 13 - phase) * .4) * amount
      const age = (time / 10 + x * .77 + y * .21) % 1
      fogOpacity[i] = .12 + .88 * smooth(age / .19) * (1 - smooth((age - .53) / .47))
    }
    for (const pixel of active) {
      const x = pixel % WIDTH, y = Math.floor(pixel / WIDTH), target = pixel * 4
      const gridX = x / 16, gridY = y / 16
      const col = Math.floor(gridX), row = Math.floor(gridY)
      const a = row * gridWidth + col, b = a + 1, c = a + gridWidth, d = c + 1
      const fx = gridX - col, fy = gridY - row
      const wA = (1 - fx) * (1 - fy), wB = fx * (1 - fy), wC = (1 - fx) * fy, wD = fx * fy
      const dx = (flowX[a] * wA + flowX[b] * wB + flowX[c] * wC + flowX[d] * wD) * motion[pixel]
      const dy = (flowY[a] * wA + flowY[b] * wB + flowY[c] * wC + flowY[d] * wD) * motion[pixel]
      const sx = Math.max(0, Math.min(WIDTH - 1.001, x - dx))
      const sy = Math.max(0, Math.min(HEIGHT - 1.001, y - dy))
      const left = Math.floor(sx), top = Math.floor(sy)
      const ia = (top * WIDTH + left) * 4, ib = ia + 4, ic = ia + WIDTH * 4, id = ic + 4
      const ax = sx - left, ay = sy - top
      const pA = (1 - ax) * (1 - ay), pB = ax * (1 - ay), pC = (1 - ax) * ay, pD = ax * ay
      const alpha = pixels[ia + 3] * pA + pixels[ib + 3] * pB + pixels[ic + 3] * pC + pixels[id + 3] * pD
      const vaporOpacity = fogOpacity[a] * wA + fogOpacity[b] * wB + fogOpacity[c] * wC + fogOpacity[d] * wD
      output.data[target + 3] = alpha * (1 - fog[pixel] * (1 - vaporOpacity))
      for (let channel = 0; channel < 3; channel++) output.data[target + channel] = alpha
        ? (premultiplied[ia + channel] * pA + premultiplied[ib + channel] * pB
          + premultiplied[ic + channel] * pC + premultiplied[id + channel] * pD) * 255 / alpha : 0
    }
    sourceContext.putImageData(output, 0, 0)
    context.clearRect(0, 0, canvas.width, canvas.height)
    drawRoots(time, true)
    context.drawImage(sourceCanvas, HEADLINE_PADDING, HEADLINE_PADDING)
    drawRoots(time, false)
    context.save()
    context.translate(HEADLINE_PADDING, HEADLINE_PADDING)

    // Vapor rises from lower glyph contours and follows a curling path along
    // the strokes, hangs there, then expands and disappears gradually.
    wisps.forEach(({ point, duration, offset, direction }, index) => {
      const life = (time / duration + offset) % 1
      const opacity = smooth(life / .2) * (1 - smooth((life - .53) / .47))
      const curl = life * Math.PI * 1.7
      const size = 12 + life * 28
      const x = point[0] + direction * (Math.sin(curl) * 19 + life * 10)
      const y = point[1] - life * (32 + index % 5 * 8) + Math.cos(curl) * 5
      context.globalAlpha = opacity * .7
      context.drawImage(puff, x - size * .8, y - size * .35, size * 1.6, size * .7)
    })
    context.restore()
  }
}
