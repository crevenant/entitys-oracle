import { useEffect, useRef } from 'react'
import { createHeadlinePainter, HEADLINE_CANVAS } from '../lib/headlineAnimation'

export default function LivingHeadline({ reduced }: { reduced: boolean }) {
  const image = useRef<HTMLImageElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const source = image.current, target = canvas.current
    if (reduced || !source || !target) return
    const loop = {
      frame: 0, previous: 0, elapsed: 0, visible: true, disposed: false,
      paint: undefined as ReturnType<typeof createHeadlinePainter> | undefined,
    }
    const tick = (now: number) => {
      if (loop.disposed || document.hidden || !loop.visible) return
      if (now - loop.previous >= 1000 / 24) {
        loop.elapsed += loop.previous ? Math.min((now - loop.previous) / 1000, .15) : 0
        loop.previous = now
        loop.paint?.(loop.elapsed)
      }
      loop.frame = requestAnimationFrame(tick)
    }
    const resume = () => {
      cancelAnimationFrame(loop.frame)
      loop.previous = 0
      if (loop.paint && !document.hidden && loop.visible) loop.frame = requestAnimationFrame(tick)
    }
    const start = () => {
      if (loop.disposed || !source.naturalWidth) return
      loop.paint = createHeadlinePainter(source, target)
      loop.paint(loop.elapsed)
      target.dataset.ready = ''
      resume()
    }
    const observer = new IntersectionObserver(([entry]) => {
      loop.visible = entry.isIntersecting
      resume()
    })
    observer.observe(target)
    source.addEventListener('load', start)
    document.addEventListener('visibilitychange', resume)
    if (source.complete) start()
    return () => {
      loop.disposed = true
      cancelAnimationFrame(loop.frame)
      observer.disconnect()
      source.removeEventListener('load', start)
      document.removeEventListener('visibilitychange', resume)
      delete target.dataset.ready
    }
  }, [reduced])

  return <span className="headline-scene" aria-hidden="true">
    <canvas ref={canvas} className="headline-canvas" width={HEADLINE_CANVAS.width} height={HEADLINE_CANVAS.height} />
    <img ref={image} className="headline-art" src="/assets/headline-fog.webp" width="1200" height="600" alt="" fetchPriority="high" />
  </span>
}
