import { useEffect, useId, useRef } from 'react'
import gsap from 'gsap'
import { createEyePainter, EYE_ART, engravingTime, eyePose, loadEyeArtwork } from '../lib/cardEye'
import { createMothPainter, mothPose } from '../lib/cardMoth'
import { NEUTRAL_TENDRILS, tendrilField, TENDRIL_AMOUNT } from '../lib/cardTendrils'
import { tendrilGrowth } from '../lib/cardGrowth'

export default function CardBack({ reduced, seed = 2, hidden = false }: { reduced: boolean; seed?: number; hidden?: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const mothCanvas = useRef<HTMLCanvasElement>(null)
  const displacement = useRef<SVGFEImageElement>(null)
  const growthCanvas = useRef<HTMLCanvasElement>(null)
  const filterId = useId()
  useEffect(() => {
    if (reduced || hidden) return
    const lifetime = { active: true }
    let remove: (() => void) | undefined
    void loadEyeArtwork().then((image) => {
      if (!lifetime.active || !canvas.current || !mothCanvas.current) return
      const painter = createEyePainter(image, canvas.current)
      const moth = createMothPainter(image, mothCanvas.current)
      let accumulated = 0
      let fieldVersion = -1
      let growthVersion = -1
      const updateTendrils = (time: number) => {
        const field = tendrilField(time)
        if (displacement.current && fieldVersion !== field.version) {
          displacement.current.setAttribute('href', field.imageURL())
          fieldVersion = field.version
        }
        const growth = tendrilGrowth(time)
        const target = growthCanvas.current
        if (target && growth.version !== growthVersion) {
          if (target.width !== growth.canvas.width || target.height !== growth.canvas.height) { target.width = growth.canvas.width; target.height = growth.canvas.height }
          const context = target.getContext('2d')!
          context.clearRect(0, 0, target.width, target.height)
          context.drawImage(growth.canvas, 0, 0)
          growthVersion = growth.version
        }
      }
      painter.paint(eyePose(engravingTime(), seed))
      moth.paint(mothPose(engravingTime(), seed))
      updateTendrils(engravingTime())
      const update = (_time: number, deltaMs: number) => {
        if (document.hidden) return
        const dt = Math.min(deltaMs / 1000, .1)
        accumulated += dt
        if (accumulated < 1 / 30) return
        accumulated = 0
        const time = engravingTime()
        painter.paint(eyePose(time, seed))
        moth.paint(mothPose(time, seed))
        updateTendrils(time)
      }
      gsap.ticker.add(update)
      remove = () => gsap.ticker.remove(update)
    }).catch(() => undefined)
    return () => { lifetime.active = false; remove?.() }
  }, [reduced, seed, hidden])
  const alive = !reduced && !hidden
  return <div className="tarot-art" style={{ visibility: hidden ? 'hidden' : undefined }} aria-hidden="true">
    {alive && <svg className="tendril-filter" width="0" height="0"><defs><filter id={filterId} filterUnits="objectBoundingBox" primitiveUnits="objectBoundingBox" x="0" y="0" width="1" height="1" colorInterpolationFilters="sRGB"><feImage ref={displacement} href={NEUTRAL_TENDRILS} x="0" y="0" width="1" height="1" preserveAspectRatio="none" result="tendril-flow" /><feDisplacementMap in="SourceGraphic" in2="tendril-flow" scale={TENDRIL_AMOUNT} xChannelSelector="R" yChannelSelector="G" /></filter></defs></svg>}
    <img src={EYE_ART} alt="" style={{ filter: alive ? `url(#${filterId})` : undefined }} />
    {alive && <canvas ref={growthCanvas} className="tarot-root-growth" />}
    {!reduced && <><canvas ref={canvas} className="tarot-eye-patch" /><canvas ref={mothCanvas} className="tarot-moth-patch" /></>}
  </div>
}

export function CardEyeIcon() {
  return <svg className="living-card-eye" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><g className="card-eye-lids"><path d="M2 12C6 3 18 3 22 12C18 21 6 21 2 12Z" /><g className="card-eye-gaze"><ellipse cx="12" cy="12" rx="2.3" ry="3.2" /></g></g></svg>
}
