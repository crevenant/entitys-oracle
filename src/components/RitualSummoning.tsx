import { useLayoutEffect, useRef } from 'react'
import type { RefObject } from 'react'
import { createPortal } from 'react-dom'
import gsap from 'gsap'
import { paintSummonedEntity, paintControlShadows, paintReleaseShadows } from '../lib/entitySummoning'
import type { ShadowSource } from '../lib/entitySummoning'
import type { CardEyeAnchor } from '../lib/cardEye'
import { RITUAL, SUMMONING } from '../lib/ritual'

/** Lives for one draw, so skipping, reduced motion, and repeat draws tear down
 * both canvases and the ticker together. The portal avoids the stage perspective
 * turning the viewport-sized burst into a transformed containing block. */
export default function RitualSummoning({ clock, eyeAnchor }: { clock: RefObject<{ time: number }>; eyeAnchor: RefObject<CardEyeAnchor | null> }) {
  const entity = useRef<HTMLCanvasElement>(null)
  const burst = useRef<HTMLCanvasElement>(null)
  useLayoutEffect(() => {
    const canvas = entity.current, screen = burst.current
    const ctx = canvas?.getContext('2d'), smoke = screen?.getContext('2d')
    const stage = canvas?.closest<HTMLElement>('.card-stage')
    if (!canvas || !screen || !ctx || !smoke || !stage) return
    const layout = { sources: [] as ShadowSource[], lastPaint: -1 }
    const viewport = { width: 0, height: 0, ratio: 1 }
    const measure = () => {
      viewport.width = window.innerWidth; viewport.height = window.innerHeight
      viewport.ratio = Math.min(window.devicePixelRatio || 1, 1.5)
      screen.width = Math.round(viewport.width * viewport.ratio); screen.height = Math.round(viewport.height * viewport.ratio)
      // Start the smoke at the controls' real positions, including after scroll.
      layout.sources = [...document.querySelectorAll<HTMLElement>('.role-switch, .draw-button, .motion-notice')].map((element) => {
        const box = element.getBoundingClientRect()
        return { x: box.x, y: box.y, width: box.width, height: box.height }
      })
    }
    const flatEye = stage.querySelector('.fallback-card-track:nth-child(3) .tarot-eye-patch')
    measure()
    const update = () => {
      if (document.hidden) return
      const time = clock.current.time
      if (time - layout.lastPaint < 1 / 30) return
      if (layout.lastPaint >= SUMMONING.shuffle && time < RITUAL.revealing) return
      layout.lastPaint = time
      smoke.setTransform(viewport.ratio, 0, 0, viewport.ratio, 0, 0)
      smoke.clearRect(0, 0, viewport.width, viewport.height)
      if (time >= RITUAL.revealing) {
        const card = stage.querySelector('.reveal-flight')?.getBoundingClientRect()
        if (card) paintReleaseShadows(smoke, time - RITUAL.revealing, card, layout.sources)
        return
      }
      if (time >= SUMMONING.closeEye) {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        canvas.dataset.manifestation = time < SUMMONING.tremor ? 'closing' : time < SUMMONING.shuffle ? 'trembling' : 'spent'
        return
      }
      const eye = eyeAnchor.current
      const surface = flatEye ?? (eye?.surface.isConnected ? eye.surface : stage)
      const bounds = surface.getBoundingClientRect()
      const target = { x: bounds.x + bounds.width * (flatEye ? .51 : eye?.x ?? .5), y: bounds.y + bounds.height * (flatEye ? .51 : eye?.y ?? .43) }
      const body = canvas.getBoundingClientRect()
      paintSummonedEntity(ctx, time, { x: (target.x - body.x) * canvas.width / body.width, y: (target.y - body.y) * canvas.height / body.height }, !!flatEye)
      paintControlShadows(smoke, time, layout.sources, target)
      canvas.dataset.manifestation = time < SUMMONING.shiver ? 'shivering'
        : time < SUMMONING.burst ? 'bursting' : time < SUMMONING.takeHold ? 'forming'
        : time < SUMMONING.absorb ? 'holding' : 'absorbing'
    }
    update()
    gsap.ticker.add(update)
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, { passive: true })
    return () => {
      gsap.ticker.remove(update)
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure)
    }
  }, [clock, eyeAnchor])
  return <>
    <canvas ref={entity} className="summoned-entity" width={960} height={640} aria-hidden="true" />
    {createPortal(<canvas ref={burst} className="control-shadow-burst" aria-hidden="true" />, document.body)}
  </>
}
