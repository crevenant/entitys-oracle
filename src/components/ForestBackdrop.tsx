import { useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import { createForestPainters, forestPatches } from '../lib/forestAnimation'
import { CAMPFIRE_FRAME, createCampfireConversation } from '../lib/campfireConversation'

const { CHAIN, SKY, TREES, FIRE, PLATE } = forestPatches
// Place the opening between the four seats over the existing fire at (1211, 540).
const CAMPFIRE_GROUP = { x: 1087, y: 443, width: 248, height: 248 * 2 / 3 }
const patchStyle = (patch: { x: number; y: number; width: number; height: number }): CSSProperties => ({
  left: `${patch.x / PLATE.width * 100}%`, top: `${patch.y / PLATE.height * 100}%`,
  width: `${patch.width / PLATE.width * 100}%`, height: `${patch.height / PLATE.height * 100}%`,
})

export default function ForestBackdrop({ reduced }: { reduced: boolean }) {
  const image = useRef<HTMLImageElement>(null)
  const chain = useRef<HTMLCanvasElement>(null)
  const clouds = useRef<HTMLCanvasElement>(null)
  const fire = useRef<HTMLCanvasElement>(null)
  const trees = useRef<HTMLCanvasElement>(null)
  const survivors = useRef<HTMLImageElement>(null)
  const conversation = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const source = image.current
    const group = survivors.current
    const groupCanvas = conversation.current
    if (reduced || !source || !group || !groupCanvas || !chain.current || !clouds.current || !fire.current || !trees.current) return
    const loop = {
      disposed: false, frame: 0, previous: 0, elapsed: 0,
      paint: undefined as ReturnType<typeof createForestPainters> | undefined,
      paintConversation: undefined as ReturnType<typeof createCampfireConversation> | undefined,
    }
    const tick = (now: number) => {
      if (loop.disposed || document.hidden) return
      if (now - loop.previous >= 1000 / 30) {
        // Keep the scene's phase when returning to the tab, rather than jumping ahead.
        loop.elapsed += loop.previous ? Math.min((now - loop.previous) / 1000, .1) : 0
        loop.previous = now
        loop.paint?.(loop.elapsed)
        loop.paintConversation?.(loop.elapsed)
      }
      loop.frame = requestAnimationFrame(tick)
    }
    const start = () => {
      cancelAnimationFrame(loop.frame)
      if (loop.disposed || !source.naturalWidth) return
      loop.paint = createForestPainters(source, chain.current!, clouds.current!, fire.current!, trees.current!)
      loop.previous = 0
      if (!document.hidden) loop.frame = requestAnimationFrame(tick)
    }
    const visibility = () => {
      cancelAnimationFrame(loop.frame)
      loop.previous = 0
      if (!document.hidden && loop.paint) loop.frame = requestAnimationFrame(tick)
    }
    const prepareConversation = () => {
      if (loop.disposed || !group.naturalWidth) return
      loop.paintConversation = createCampfireConversation(group, groupCanvas)
      loop.paintConversation(loop.elapsed)
      groupCanvas.dataset.ready = ''
    }
    source.addEventListener('load', start)
    group.addEventListener('load', prepareConversation)
    document.addEventListener('visibilitychange', visibility)
    if (group.complete) prepareConversation()
    if (source.complete) start()
    return () => {
      loop.disposed = true
      cancelAnimationFrame(loop.frame)
      source.removeEventListener('load', start)
      group.removeEventListener('load', prepareConversation)
      document.removeEventListener('visibilitychange', visibility)
      delete groupCanvas.dataset.ready
    }
  }, [reduced])

  return <div className="forest-backdrop" aria-hidden="true">
    <div className="forest-plate">
      <picture className="forest-distance"><source media="(max-width: 640px)" srcSet="/assets/forest-mobile.webp" /><img ref={image} src="/assets/forest-night.webp" alt="" fetchPriority="high" /></picture>
      <canvas ref={chain} className="forest-chain forest-animation" width={CHAIN.width} height={CHAIN.height} style={patchStyle(CHAIN)} />
      <canvas ref={clouds} className="forest-clouds forest-animation" width={SKY.width} height={SKY.height} style={patchStyle(SKY)} />
      <canvas ref={trees} className="forest-trees forest-animation" width={TREES.width} height={TREES.height} style={patchStyle(TREES)} />
      <div className="campfire-survivors" style={patchStyle(CAMPFIRE_GROUP)}>
        <canvas ref={conversation} className="campfire-conversation forest-animation" width={CAMPFIRE_FRAME.width} height={CAMPFIRE_FRAME.height} />
        <img ref={survivors} src="/assets/campfire-survivors.webp" alt="" />
      </div>
      <canvas ref={fire} className="forest-fire forest-animation" width={FIRE.width} height={FIRE.height} style={patchStyle(FIRE)} />
      <div className="campfire-light" />
    </div>
    <div className="forest-role-light" />
    <div className="forest-mist mist-distant" /><div className="forest-mist mist-near" />
    <div className="forest-embers">{Array.from({ length: 14 }, (_, index) => <i key={index} style={{ '--ember-x': `${(index * 31 + 9) % 100}%`, '--ember-delay': `${index * -1.7}s`, '--ember-duration': `${13 + index % 5}s` } as CSSProperties} />)}</div>
    <div className="forest-vignette" />
  </div>
}
