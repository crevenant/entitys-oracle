import { SUMMONING } from './ritual'
import { publicUrl } from './publicUrl'

/** A small live patch reuses the engraving; the full card never needs repainting. */
export const EYE_PATCH = { x: .3, y: .4, width: .4, height: .09 }
export const EYE_CENTER = { x: EYE_PATCH.x + EYE_PATCH.width * .51, y: EYE_PATCH.y + EYE_PATCH.height * .51 }
export type CardEyeAnchor = { surface: HTMLCanvasElement; x: number; y: number }
export const EYE_ART = publicUrl('/assets/tarot-back-worn.webp')
export type EyePose = { x: number; y: number; open: number }
let animationEpoch: number | undefined
export function engravingTime() {
  const now = performance.now()
  animationEpoch ??= now
  return (now - animationEpoch) / 1000
}
const gazes = [{ x: 0, y: 0 }, { x: -.028, y: -.012 }, { x: .027, y: .015 }, { x: .005, y: -.028 }, { x: -.018, y: .02 }, { x: .02, y: -.008 }]
const smooth = (value: number) => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t) }

export function summoningEyePose(time: number): EyePose {
  return { x: 0, y: 0, open: 1 - smooth((time - SUMMONING.closeEye) / (SUMMONING.tremor - SUMMONING.closeEye)) }
}

export function eyePose(time: number, seed: number): EyePose {
  const gazeTime = time + seed * .83
  const step = Math.floor(gazeTime / 3.2)
  const from = gazes[step % gazes.length], to = gazes[(step + 1) % gazes.length]
  const progress = smooth((gazeTime % 3.2 - 2.8) / .32)
  const blink = (time + seed * .61) % 5.2
  const closing = blink - 4.92
  const open = closing < 0 ? 1 : closing < .095 ? 1 - smooth(closing / .095) : closing < .125 ? 0 : smooth((closing - .125) / .155)
  return { x: from.x + (to.x - from.x) * progress, y: from.y + (to.y - from.y) * progress, open }
}

function aperture(context: CanvasRenderingContext2D, open: number) {
  context.beginPath()
  context.moveTo(.165, .58)
  context.bezierCurveTo(.34, .58 - .54 * open, .64, .575 - .54 * open, .86, .575)
  context.bezierCurveTo(.66, .575 + .4 * open, .34, .58 + .4 * open, .165, .58)
  context.closePath()
}

export function createEyePainter(image: HTMLImageElement, canvas = document.createElement('canvas')) {
  canvas.width = 320; canvas.height = 108
  const context = canvas.getContext('2d')!
  const iris = document.createElement('canvas'); iris.width = canvas.width; iris.height = canvas.height
  const irisContext = iris.getContext('2d')!
  const width = canvas.width, height = canvas.height
  const sx = image.naturalWidth * EYE_PATCH.x, sy = image.naturalHeight * EYE_PATCH.y
  const sw = image.naturalWidth * EYE_PATCH.width, sh = image.naturalHeight * EYE_PATCH.height
  let previous: EyePose | undefined
  return {
    canvas,
    paint(pose: EyePose) {
      if (previous && Math.abs(previous.x - pose.x) < .0001 && Math.abs(previous.y - pose.y) < .0001 && Math.abs(previous.open - pose.open) < .001) return false
      previous = { ...pose }
      context.clearRect(0, 0, width, height)
      context.drawImage(image, sx, sy, sw, sh, 0, 0, width, height)
      context.save()
      context.scale(width, height)
      aperture(context, 1); context.clip()
      context.setTransform(1, 0, 0, 1, 0, 0)
      if (pose.open < .999) {
        const lid = context.createLinearGradient(0, height * .15, 0, height * .9)
        lid.addColorStop(0, '#171910'); lid.addColorStop(.48, '#302b1b'); lid.addColorStop(1, '#11130d')
        context.fillStyle = lid; context.fillRect(0, 0, width, height)
        // Fine curved creases keep a closed lid in the engraved visual language.
        context.save(); context.scale(width, height)
        for (let crease = 0; crease < 5; crease++) {
          const inset = .035 * crease
          context.beginPath(); context.moveTo(.17 + inset, .575 - inset)
          context.bezierCurveTo(.36, .45 - inset, .63, .45 - inset, .85 - inset, .575 - inset)
          context.strokeStyle = '#9c784422'; context.lineWidth = .003; context.stroke()
        }
        context.restore()
      }
      context.save()
      context.scale(width, height)
      aperture(context, pose.open); context.clip()
      context.setTransform(1, 0, 0, 1, 0, 0)
      context.drawImage(image, sx, sy, sw, sh, 0, 0, width, height)
      if (Math.abs(pose.x) + Math.abs(pose.y) > .0001) {
        irisContext.clearRect(0, 0, width, height)
        irisContext.globalCompositeOperation = 'source-over'
        irisContext.drawImage(image, sx, sy, sw, sh, pose.x * width, pose.y * height, width, height)
        irisContext.save()
        irisContext.translate(width * .51, height * .51)
        irisContext.scale(width * .19, height * .42)
        const feather = irisContext.createRadialGradient(0, 0, .7, 0, 0, 1)
        feather.addColorStop(0, '#fff'); feather.addColorStop(1, '#fff0')
        irisContext.globalCompositeOperation = 'destination-in'
        irisContext.fillStyle = feather; irisContext.fillRect(-6, -6, 12, 12)
        irisContext.restore()
        context.drawImage(iris, 0, 0)
      }
      context.restore()
      if (pose.open < .999) {
        context.save(); context.scale(width, height)
        aperture(context, pose.open)
        context.lineWidth = .004; context.strokeStyle = '#a8834b'; context.stroke()
        context.restore()
      }
      context.restore()
      return true
    },
  }
}

let artwork: Promise<HTMLImageElement> | undefined
export function loadEyeArtwork() {
  artwork ??= (async () => {
    const image = new Image(); image.src = EYE_ART
    await image.decode()
    return image
  })().catch((error) => { artwork = undefined; throw error })
  return artwork
}
