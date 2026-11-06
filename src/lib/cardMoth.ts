export const MOTH_PATCH = { x: .24, y: .65, width: .52, height: .16 }
export type MothPose = { flap: number; fold: number }
const smooth = (value: number) => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t) }

export function mothPose(time: number, seed: number): MothPose {
  const cycle = (time + seed * .73) % 5.8
  const burst = smooth(cycle / .4) * (1 - smooth((cycle - 2.5) / .65))
  const strength = .2 + burst * .8
  const beat = Math.sin(time * 17 + seed * .65)
  return { flap: beat * strength, fold: (beat * .5 + .5) * strength }
}

function wing(context: CanvasRenderingContext2D, right = false) {
  const x = (value: number) => right ? 1 - value : value
  context.beginPath()
  context.moveTo(x(.045), .075)
  context.bezierCurveTo(x(.26), .04, x(.43), .25, x(.5), .4)
  context.lineTo(x(.48), .67)
  context.bezierCurveTo(x(.37), .75, x(.31), .92, x(.19), .82)
  context.bezierCurveTo(x(.23), .65, x(.14), .49, x(.045), .39)
  context.bezierCurveTo(x(.12), .35, x(.06), .24, x(.045), .075)
  context.closePath()
}

/** Lift two cutouts from the existing engraving, keeping the body and card still. */
export function createMothPainter(image: HTMLImageElement, canvas = document.createElement('canvas')) {
  canvas.width = 320; canvas.height = 148
  const width = canvas.width, height = canvas.height
  const context = canvas.getContext('2d')!
  const sx = image.naturalWidth * MOTH_PATCH.x, sy = image.naturalHeight * MOTH_PATCH.y
  const sw = image.naturalWidth * MOTH_PATCH.width, sh = image.naturalHeight * MOTH_PATCH.height
  const base = document.createElement('canvas'); base.width = width; base.height = height
  const baseContext = base.getContext('2d')!
  baseContext.drawImage(image, sx, sy, sw, sh, 0, 0, width, height)
  const wings = [false, true].map((right) => {
    const layer = document.createElement('canvas'); layer.width = width; layer.height = height
    const target = layer.getContext('2d')!
    target.scale(width, height); wing(target, right); target.clip(); target.setTransform(1, 0, 0, 1, 0, 0)
    target.drawImage(image, sx, sy, sw, sh, 0, 0, width, height)
    return layer
  })
  // Paper from below the moth only appears in the narrow spaces exposed by a flap.
  for (const right of [false, true]) {
    baseContext.save(); baseContext.scale(width, height); wing(baseContext, right); baseContext.clip(); baseContext.setTransform(1, 0, 0, 1, 0, 0)
    baseContext.drawImage(image, image.naturalWidth * .35, image.naturalHeight * .82, image.naturalWidth * .065, image.naturalHeight * .035, 0, 0, width, height)
    baseContext.fillStyle = '#0a0b0750'; baseContext.fillRect(0, 0, width, height)
    baseContext.restore()
  }
  let previous: MothPose | undefined
  return {
    canvas,
    paint(pose: MothPose) {
      if (previous && Math.abs(previous.flap - pose.flap) < .008 && Math.abs(previous.fold - pose.fold) < .005) return false
      previous = { ...pose }
      context.clearRect(0, 0, width, height); context.drawImage(base, 0, 0)
      wings.forEach((layer, index) => {
        const side = index === 0 ? -1 : 1
        context.save()
        context.translate(width * .5, height * .4)
        context.rotate(side * pose.flap * .022)
        context.scale(1 - pose.fold * .075, 1 - pose.fold * .012)
        context.translate(-width * .5, -height * .4)
        context.globalAlpha = 1 - pose.fold * .055
        context.drawImage(layer, 0, 0)
        context.restore()
      })
      // Head, antenna roots, abdomen, and dagger stay fixed over the wing hinges.
      context.drawImage(image, sx + sw * .45, sy + sh * .2, sw * .1, sh * .8, width * .45, height * .2, width * .1, height * .8)
      return true
    },
  }
}
