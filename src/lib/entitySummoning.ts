import { SUMMONING } from './ritual'

export type ShadowSource = { x: number; y: number; width: number; height: number }
type Point = { x: number; y: number }
const clamp = (value: number) => Math.max(0, Math.min(1, value))
const smooth = (value: number) => { const t = clamp(value); return t * t * (3 - 2 * t) }
const noise = (seed: number) => { const n = Math.sin(seed * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n) }

function haze(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, opacity: number) {
  if (opacity <= 0 || radius <= 0) return
  const fog = ctx.createRadialGradient(x, y, 0, x, y, radius)
  fog.addColorStop(0, `rgba(2,7,6,${opacity})`)
  fog.addColorStop(.44, `rgba(5,12,10,${opacity * .7})`)
  fog.addColorStop(1, 'rgba(6,13,11,0)')
  ctx.fillStyle = fog
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2)
}

/** Each wisp winds inward and vanishes before the eye closes. */
export function paintControlShadows(ctx: CanvasRenderingContext2D, time: number, sources: ShadowSource[], target: Point) {
  sources.forEach((source, sourceIndex) => {
    for (let i = 0; i < 30; i++) {
      const seed = i + sourceIndex * 59
      const start = SUMMONING.shiver + noise(seed) * .24
      const end = SUMMONING.closeEye - noise(seed + 27) * .42
      const progress = (time - start) / (end - start)
      if (progress <= 0 || progress >= 1) continue
      const sx = source.x + noise(seed + 41) * source.width
      const sy = source.y + source.height * noise(seed + 19)
      const angle = Math.atan2(sy - target.y, sx - target.x)
      const distance = Math.hypot(sx - target.x, sy - target.y)
      const curl = (noise(seed + 8) - .5) * 3.4
      const at = (p: number) => {
        const radius = distance * (1 - p ** 1.45) + Math.sin(Math.PI * p) * (22 + noise(seed + 7) * 54)
        const turn = angle + curl * Math.sin(p * 2.2) + p ** 2 * 1.4
        return { x: target.x + Math.cos(turn) * radius, y: target.y + Math.sin(turn) * radius }
      }
      const head = at(progress), tail = at(Math.max(0, progress - .14))
      const taper = 1 - smooth((progress - .9) / .1)
      const alive = smooth(progress / .12) * taper
      haze(ctx, head.x, head.y, (13 + noise(seed + 12) * 25) * (.18 + .82 * taper), alive * .5)
      ctx.beginPath()
      ctx.moveTo(tail.x, tail.y)
      const bend = at(Math.max(0, progress - .07))
      ctx.quadraticCurveTo(bend.x, bend.y, head.x, head.y)
      ctx.strokeStyle = `rgba(5,12,10,${alive * .55})`
      ctx.lineWidth = (1 + noise(seed + 6) * 5) * taper
      ctx.stroke()
      ctx.strokeStyle = `rgba(103,113,105,${alive * .2})`; ctx.lineWidth *= .23; ctx.stroke()
    }
  })
}

/** Smoke curls off the card edges. Some wisps drift away and others settle into the controls. */
export function paintReleaseShadows(ctx: CanvasRenderingContext2D, time: number, card: ShadowSource, controls: ShadowSource[]) {
  for (let i = 0; i < 52; i++) {
    const seed = i + 221
    const progress = (time - noise(seed) * .45) / (.68 + noise(seed + 4) * .45)
    if (progress <= 0 || progress >= 1) continue
    const side = i % 2 ? 1 : -1
    const startX = card.x + card.width * (side === 1 ? .98 : .02)
    const startY = card.y + card.height * (.12 + noise(seed + 7) * .82)
    const control = i < 35 ? controls[i % controls.length] : undefined
    const endX = control ? control.x + control.width * noise(seed + 8) : startX + side * (38 + noise(seed + 9) * 75)
    const endY = control ? control.y + control.height * noise(seed + 11) : startY - 38 - noise(seed + 10) * 64
    const at = (p: number) => {
      const spread = Math.sin(p * Math.PI) * (22 + noise(seed + 6) * 50)
      return {
        x: startX + (endX - startX) * smooth(p) + spread * side,
        y: startY + (endY - startY) * smooth(p) - spread * Math.sin(p * 5 + seed),
      }
    }
    const head = at(progress), tail = at(Math.max(0, progress - .17))
    const bend = at(Math.max(0, progress - .08))
    const opacity = smooth(progress / .14) * (1 - smooth((progress - .65) / .35))
    haze(ctx, head.x, head.y, 11 + noise(seed + 2) * 25 + progress * 9, opacity * .6)
    ctx.beginPath()
    ctx.moveTo(tail.x, tail.y)
    ctx.quadraticCurveTo(bend.x, bend.y, head.x, head.y)
    ctx.strokeStyle = `rgba(5,12,10,${opacity * .64})`
    ctx.lineWidth = 1 + noise(seed + 3) * 4
    ctx.stroke()
    ctx.strokeStyle = `rgba(95,109,100,${opacity * .17})`
    ctx.lineWidth = .8
    ctx.stroke()
  }
}

/** A deliberately indistinct, many-limbed presence. Tapered articulated limbs
 * grow out of the smoke and coil toward the cards, rather than a static image. */
export function paintSummonedEntity(ctx: CanvasRenderingContext2D, time: number, eye: Point, fallbackArms = false) {
  ctx.clearRect(0, 0, 960, 640)
  const form = smooth((time - SUMMONING.burst) / (SUMMONING.takeHold - SUMMONING.burst))
  const collapse = smooth((time - SUMMONING.absorb) / (SUMMONING.closeEye - SUMMONING.absorb))
  if (form <= 0 || collapse >= 1) return
  ctx.save()
  ctx.globalAlpha = 1 - collapse
  ctx.translate(480 + (eye.x - 480) * collapse, 189 + (eye.y - 189) * collapse)
  ctx.scale(1 - collapse, 1 - collapse)
  ctx.translate(0, 111)
  const breathe = Math.sin(time * 1.7) * 5
  // Smoky shoulders and a faceless crown only become apparent between curls.
  for (let i = 0; i < 30; i++) {
    const angle = noise(i + 3) * Math.PI * 2 + time * .07
    const spread = 25 + noise(i + 31) * 104
    haze(ctx, Math.cos(angle) * spread, -111 + Math.sin(angle) * spread * .64 + breathe,
      (45 + noise(i + 12) * 60) * form, .18 * form)
  }
  const grip = smooth((time - SUMMONING.form) / (SUMMONING.absorb - SUMMONING.form))
  // Each limb has an independent slow curl, an elbow and a hooked tip. Back
  // branches reach wide; four inner arms close around the deck before shuffling.
  // WebGL uses the actual card-holding rig; only the flat-card fallback needs
  // canvas arms. The smoky body is shared by both renderers.
  for (let i = 0; fallbackArms && i < 10; i++) {
    const side = i % 2 ? 1 : -1
    const row = Math.floor(i / 2)
    const inner = row < 2
    const grow = smooth((form - row * .055) / .76)
    const sway = Math.sin(time * (1.1 + row * .13) + i * 1.8) * (8 + row * 2)
    const anchor = { x: side * (24 + row * 6), y: -100 + row * 11 + breathe }
    const elbow = { x: side * (135 + row * 35 + Math.sin(i * 3) * 14) * grow, y: -184 + row * 64 + sway }
    const tip = {
      x: side * (inner ? 127 + (1 - grip) * 100 : 285 + row * 22) * grow,
      y: (inner ? -54 + row * 151 : -167 + row * 86) * grow + sway * .5,
    }
    const points: Point[] = []
    const cubic = (a: Point, b: Point, c: Point, d: Point, t: number) => {
      const u = 1 - t
      return { x: u ** 3 * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t ** 3 * d.x,
        y: u ** 3 * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t ** 3 * d.y }
    }
    for (let k = 0; k <= 36; k++) {
      points.push(k <= 18
        ? cubic(anchor, { x: side * 95, y: anchor.y - 12 }, { x: elbow.x * .9, y: elbow.y - 18 }, elbow, k / 18)
        : cubic(elbow, { x: elbow.x + side * 22, y: elbow.y + 28 }, { x: tip.x + side * 42, y: tip.y - 22 }, tip, (k - 18) / 18))
    }
    const left: Point[] = [], right: Point[] = []
    points.forEach((point, k) => {
      const before = points[Math.max(0, k - 1)], after = points[Math.min(points.length - 1, k + 1)]
      const dx = after.x - before.x, dy = after.y - before.y, length = Math.hypot(dx, dy) || 1
      const thickness = (1 - k / 36) ** 1.1 * (8 + row * 1.8) * grow
      const rough = 1 + Math.sin(k * 2.7 + i) * .1
      left.push({ x: point.x - dy / length * thickness * rough, y: point.y + dx / length * thickness * rough })
      right.push({ x: point.x + dy / length * thickness * rough, y: point.y - dx / length * thickness * rough })
    })
    ctx.beginPath()
    const outline = [...left, ...right.reverse()]
    outline.forEach((point, k) => k === 0 ? ctx.moveTo(point.x, point.y) : ctx.lineTo(point.x, point.y))
    ctx.closePath()
    ctx.fillStyle = `rgba(3,9,6,${form * .94})`
    ctx.save(); ctx.shadowBlur = 11; ctx.shadowColor = '#020504'; ctx.fill(); ctx.restore()
    ctx.strokeStyle = `rgba(77,92,68,${form * .15})`
    ctx.lineWidth = .7; ctx.stroke()
    // An intermittent ridge catches just enough moonlight to reveal the curl.
    ctx.beginPath()
    left.slice(4, 25).forEach((point, k) => k === 0 ? ctx.moveTo(point.x + 1, point.y + 1) : ctx.lineTo(point.x + 1, point.y + 1))
    ctx.strokeStyle = `rgba(110,115,86,${form * .14})`; ctx.stroke()
    // Fine searching filaments keep the entity alive while holding still.
    ctx.beginPath(); ctx.moveTo(elbow.x, elbow.y)
    ctx.bezierCurveTo(elbow.x + side * 25, elbow.y - 25, elbow.x - side * 22, elbow.y - 50,
      elbow.x + Math.sin(time * 1.4 + i) * 24, elbow.y - 63)
    ctx.strokeStyle = `rgba(16,26,20,${form * .85})`; ctx.lineWidth = 1.4; ctx.stroke()
  }
  // Drifting veils interrupt the outline so the mass never reads as a cutout.
  for (let i = 0; i < 16; i++) {
    const x = Math.sin(time * .31 + i * 2.1) * 195
    const y = -150 + ((time * 22 + i * 29) % 280)
    haze(ctx, x, y, 65 + noise(i + 77) * 40, form * .19)
  }
  ctx.restore()
}
