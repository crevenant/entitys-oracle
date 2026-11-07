import { useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import { createForestPainters, createForestTurn, forestPatches, paintFireBed } from '../lib/forestAnimation'
import { CAMPFIRE_FRAME, createCampfireConversation } from '../lib/campfireConversation'
import { FIRE_FORWARD } from '../lib/forestFire'

const { CHAIN, SKY, TREES, FIRE, FIRE_BED, PLATE } = forestPatches
// The fire sits forward of the back pair and behind the near pair's feet.
const CAMPFIRE_GROUP = { x: 1087, y: 443, width: 248, height: 248 * 2 / 3 }
const TRAPPER = { x: 493, y: 345, width: 132, height: 198 }
const MIST_VENTS = [
  { x: 262, y: 623, width: 265, height: 100, duration: 34, delay: -12, drift: 36 },
  { x: 550, y: 522, width: 245, height: 135, duration: 39, delay: -17, drift: -24 },
  { x: 713, y: 744, width: 310, height: 109, duration: 32, delay: -4, drift: 53 },
  { x: 941, y: 583, width: 278, height: 102, duration: 37, delay: -25, drift: 32 },
  { x: 1075, y: 682, width: 299, height: 112, duration: 41, delay: -13, drift: -48 },
  { x: 1365, y: 600, width: 244, height: 94, duration: 36, delay: -9, drift: 27 },
  { x: 1455, y: 811, width: 334, height: 124, duration: 44, delay: -33, drift: -38 },
]
const patchStyle = (patch: { x: number; y: number; width: number; height: number }): CSSProperties => ({
  left: `${patch.x / PLATE.width * 100}%`, top: `${patch.y / PLATE.height * 100}%`,
  width: `${patch.width / PLATE.width * 100}%`, height: `${patch.height / PLATE.height * 100}%`,
})

export default function ForestBackdrop({ reduced }: { reduced: boolean }) {
  const image = useRef<HTMLImageElement>(null)
  const chain = useRef<HTMLCanvasElement>(null)
  const clouds = useRef<HTMLCanvasElement>(null)
  const fire = useRef<HTMLCanvasElement>(null)
  const fireBed = useRef<HTMLCanvasElement>(null)
  const trees = useRef<HTMLCanvasElement>(null)
  const survivorTurns = useRef<HTMLImageElement>(null)
  const conversation = useRef<HTMLCanvasElement>(null)
  const trapperTurns = useRef<HTMLImageElement>(null)
  const trapper = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const source = image.current, bed = fireBed.current
    if (!source || !bed) return
    const paint = () => { if (source.naturalWidth) paintFireBed(source, bed) }
    source.addEventListener('load', paint)
    if (source.complete) paint()
    return () => source.removeEventListener('load', paint)
  }, [])

  useEffect(() => {
    const source = image.current
    const turns = survivorTurns.current
    const groupCanvas = conversation.current
    const groupStage = groupCanvas?.parentElement
    const trapperStrip = trapperTurns.current
    const trapperCanvas = trapper.current
    const trapperStage = trapperCanvas?.parentElement
    if (reduced || !source || !turns || !groupCanvas || !groupStage || !trapperStrip || !trapperCanvas || !trapperStage || !chain.current || !clouds.current || !fire.current || !trees.current) return
    const loop = {
      disposed: false, frame: 0, previous: 0, elapsed: 0,
      paint: undefined as ReturnType<typeof createForestPainters> | undefined,
      paintSurvivors: undefined as ((elapsed: number, delta: number) => void) | undefined,
      paintTrapper: undefined as (() => void) | undefined,
    }
    const tick = (now: number) => {
      if (loop.disposed || document.hidden) return
      if (now - loop.previous >= 1000 / 30) {
        // Keep the scene's phase when returning to the tab, rather than jumping ahead.
        const delta = loop.previous ? Math.min((now - loop.previous) / 1000, .1) : 0
        loop.elapsed += delta
        loop.previous = now
        loop.paint?.(loop.elapsed)
        loop.paintSurvivors?.(loop.elapsed, delta)
        loop.paintTrapper?.()
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
      if (loop.disposed || !turns.naturalWidth) return
      const pose = document.createElement('canvas'), animated = document.createElement('canvas')
      pose.width = animated.width = CAMPFIRE_FRAME.width
      pose.height = animated.height = CAMPFIRE_FRAME.height
      const paintPose = createForestTurn(turns, pose, 15)
      const paintTurn = createForestTurn(turns, groupCanvas, 15)
      paintPose(0)
      const paintConversation = createCampfireConversation(pose, animated)
      paintPose(14)
      const paintListeners = createCampfireConversation(pose, animated, false)
      let chatTime = 0
      loop.paintSurvivors = (elapsed, delta) => {
        const frame = Number(getComputedStyle(groupStage).getPropertyValue('--campfire-frame'))
        // Keep the breathing and gestures attached to the end poses while they blend into the turn.
        if (frame < 1) {
          chatTime += delta
          paintConversation(elapsed, chatTime)
          paintTurn(frame, { frame: 0, image: animated })
          return
        }
        chatTime = 0
        if (frame > 13) {
          paintListeners(elapsed)
          paintTurn(frame, { frame: 14, image: animated })
        } else paintTurn(frame)
      }
      loop.paintSurvivors(loop.elapsed, 0)
      groupCanvas.dataset.ready = ''
    }
    const prepareTrapper = () => {
      if (loop.disposed || !trapperStrip.naturalWidth) return
      const paintTurn = createForestTurn(trapperStrip, trapperCanvas, 17)
      let lastFrame = -1
      loop.paintTrapper = () => {
        const frame = Number(getComputedStyle(trapperStage).getPropertyValue('--trapper-frame'))
        if (frame === lastFrame) return
        paintTurn(frame)
        lastFrame = frame
      }
      loop.paintTrapper()
      trapperCanvas.dataset.ready = ''
    }
    source.addEventListener('load', start)
    turns.addEventListener('load', prepareConversation)
    trapperStrip.addEventListener('load', prepareTrapper)
    document.addEventListener('visibilitychange', visibility)
    if (turns.complete) prepareConversation()
    if (trapperStrip.complete) prepareTrapper()
    if (source.complete) start()
    return () => {
      loop.disposed = true
      cancelAnimationFrame(loop.frame)
      source.removeEventListener('load', start)
      turns.removeEventListener('load', prepareConversation)
      trapperStrip.removeEventListener('load', prepareTrapper)
      document.removeEventListener('visibilitychange', visibility)
      delete groupCanvas.dataset.ready
      delete trapperCanvas.dataset.ready
    }
  }, [reduced])

  return <div className="forest-backdrop" aria-hidden="true">
    <div className="forest-plate">
      <picture className="forest-distance"><source media="(max-width: 640px)" srcSet="/assets/forest-mobile.webp" /><img ref={image} src="/assets/forest-night.webp" alt="" fetchPriority="high" /></picture>
      <canvas ref={chain} className="forest-chain forest-animation" width={CHAIN.width} height={CHAIN.height} style={patchStyle(CHAIN)} />
      <canvas ref={clouds} className="forest-clouds forest-animation" width={SKY.width} height={SKY.height} style={patchStyle(SKY)} />
      <canvas ref={trees} className="forest-trees forest-animation" width={TREES.width} height={TREES.height} style={patchStyle(TREES)} />
      <div className="forest-trapper" style={patchStyle(TRAPPER)}>
        <div className="trapper-peek">
          <div className="trapper-turn">
            <img ref={trapperTurns} src="/assets/trapper-turn.webp" alt="" hidden />
            <canvas ref={trapper} className="forest-turn-canvas" width="144" height="216" />
            <div className="trapper-pose" />
          </div>
        </div>
      </div>
      <canvas ref={fireBed} className="forest-fire-bed" width={FIRE_BED.width} height={FIRE_BED.height} style={patchStyle(FIRE_BED)} />
      <div className="campfire-survivors" style={patchStyle(CAMPFIRE_GROUP)}>
        <img ref={survivorTurns} src="/assets/campfire-turn.webp" alt="" hidden />
        <canvas ref={conversation} className="campfire-conversation forest-animation forest-turn-canvas" width={CAMPFIRE_FRAME.width} height={CAMPFIRE_FRAME.height} />
        <div className="campfire-turn" />
      </div>
      <canvas ref={fire} className="forest-fire forest-animation" width={FIRE.width} height={FIRE.height} style={patchStyle(FIRE)} />
      <div className="campfire-light" style={{ top: `${(506 + FIRE_FORWARD) / PLATE.height * 100}%` }} />
      <div className="forest-ground-mist">
        {MIST_VENTS.map(({ duration, delay, drift, ...patch }) => <div key={patch.x} style={{
          ...patchStyle(patch),
          '--mist-duration': `${duration}s`,
          '--mist-delay': `${delay}s`,
          '--mist-drift': `${drift}%`,
        } as CSSProperties} />)}
      </div>
    </div>
    <div className="forest-role-light" />
    <div className="forest-mist mist-distant" /><div className="forest-mist mist-near" />
    <div className="forest-embers">{Array.from({ length: 14 }, (_, index) => <i key={index} style={{ '--ember-x': `${(index * 31 + 9) % 100}%`, '--ember-delay': `${index * -1.7}s`, '--ember-duration': `${13 + index % 5}s` } as CSSProperties} />)}</div>
    <div className="forest-vignette" />
  </div>
}
