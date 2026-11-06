import { Component, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactNode, RefObject } from 'react'
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber'
import { Sparkles } from '@react-three/drei'
import { CanvasTexture, Group, LinearFilter, MeshBasicMaterial, NoColorSpace, SRGBColorSpace, TextureLoader } from 'three'
import type { PerspectiveCamera, Texture } from 'three'
import gsap from 'gsap'
import { CARD_REVEAL, RITUAL } from '../lib/ritual'
import type { RitualPhase } from '../lib/ritual'
import type { Role } from '../lib/oracle'
import EntityGrasp from './EntityGrasp'
import CardBack from './CardBack'
import { createEyePainter, EYE_PATCH, engravingTime, eyePose } from '../lib/cardEye'
import { createMothPainter, MOTH_PATCH, mothPose } from '../lib/cardMoth'
import { tendrilField, TENDRIL_AMOUNT } from '../lib/cardTendrils'
import { tendrilGrowth } from '../lib/cardGrowth'

type Props = { phase: RitualPhase; revealed: boolean; reduced: boolean; role: Role }

type DeckPointer = { over: boolean; x: number; y: number }
type DeckMotion = { x: number; y: number; bob: number; elapsed: number }

function useDeckPointer(source: HTMLElement | RefObject<HTMLElement | null>) {
  const pointer = useRef<DeckPointer>({ over: false, x: 0, y: 0 })
  useEffect(() => {
    const element = 'current' in source ? source.current : source
    const stage = element?.closest<HTMLElement>('.card-stage')
    if (!stage) return
    pointer.current.over = matchMedia('(hover: hover)').matches && stage.matches(':hover')
    const track = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') return
      const bounds = stage.getBoundingClientRect()
      pointer.current.over = true
      pointer.current.x = Math.max(-1, Math.min(1, (event.clientX - bounds.left) / bounds.width * 2 - 1))
      pointer.current.y = Math.max(-1, Math.min(1, (event.clientY - bounds.top) / bounds.height * 2 - 1))
    }
    const leave = () => { pointer.current.over = false }
    const visibility = () => { if (document.hidden) leave() }
    stage.addEventListener('pointerenter', track)
    stage.addEventListener('pointermove', track, { capture: true, passive: true })
    stage.addEventListener('pointerleave', leave)
    stage.addEventListener('pointercancel', leave)
    window.addEventListener('blur', leave)
    document.addEventListener('visibilitychange', visibility)
    return () => {
      stage.removeEventListener('pointerenter', track)
      stage.removeEventListener('pointermove', track, { capture: true })
      stage.removeEventListener('pointerleave', leave)
      stage.removeEventListener('pointercancel', leave)
      window.removeEventListener('blur', leave)
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [source])
  return pointer
}

function moveDeck(motion: DeckMotion, pointer: DeckPointer, delta: number, drawing: boolean) {
  const dt = Math.min(delta, .1)
  if (!drawing && !pointer.over) motion.elapsed += dt
  const x = drawing ? 0 : pointer.over ? pointer.y * .055 : Math.sin(motion.elapsed * .26) * .055
  const y = drawing ? 0 : pointer.over ? pointer.x * .09 : Math.sin(motion.elapsed * .19 + .6) * .09
  const bob = drawing || pointer.over ? 0 : Math.sin(motion.elapsed * .32) * .025
  const blend = 1 - Math.exp(-dt * 3.5)
  motion.x += (x - motion.x) * blend
  motion.y += (y - motion.y) * blend
  motion.bob += (bob - motion.bob) * blend
}

function LivingEngraving({ image, seed, kind }: { image: HTMLImageElement; seed: number; kind: 'eye' | 'moth' }) {
  const eye = useMemo(() => {
    const engraving = kind === 'eye' ? (() => {
      const painter = createEyePainter(image)
      return { canvas: painter.canvas, region: EYE_PATCH, paint: (time: number) => painter.paint(eyePose(time, seed)) }
    })() : (() => {
      const painter = createMothPainter(image)
      return { canvas: painter.canvas, region: MOTH_PATCH, paint: (time: number) => painter.paint(mothPose(time, seed)) }
    })()
    engraving.paint(engravingTime())
    const texture = new CanvasTexture(engraving.canvas)
    texture.colorSpace = SRGBColorSpace
    texture.minFilter = LinearFilter; texture.magFilter = LinearFilter; texture.generateMipmaps = false
    return { ...engraving, texture }
  }, [image, seed, kind])
  const runtime = useRef(eye)
  const time = useRef({ accumulated: 0 })
  useLayoutEffect(() => { runtime.current = eye }, [eye])
  useEffect(() => () => eye.texture.dispose(), [eye])
  useFrame((_, delta) => {
    if (document.hidden) return
    const dt = Math.min(delta, .1)
    time.current.accumulated += dt
    if (time.current.accumulated < 1 / (kind === 'moth' ? 24 : 30)) return
    time.current.accumulated = 0
    if (runtime.current.paint(engravingTime())) runtime.current.texture.needsUpdate = true
  })
  const region = eye.region
  const y = (0.5 - region.y - region.height / 2) * 2.70
  return <>
    <mesh position={[0, y, .027]}><planeGeometry args={[1.73 * region.width, 2.70 * region.height]} /><meshBasicMaterial map={eye.texture} toneMapped={false} /></mesh>
    <mesh position={[0, y, -.027]} rotation={[0, Math.PI, 0]}><planeGeometry args={[1.73 * region.width, 2.70 * region.height]} /><meshBasicMaterial map={eye.texture} toneMapped={false} /></mesh>
  </>
}

function createTendrilMaterial(art: Texture, flow: Texture, reduced: boolean) {
  const material = new MeshBasicMaterial({ map: art, toneMapped: false })
  material.onBeforeCompile = (shader) => {
    shader.uniforms.tendrilFlow = { value: flow }
    shader.uniforms.tendrilAmount = { value: reduced ? 0 : TENDRIL_AMOUNT }
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <map_pars_fragment>', '#include <map_pars_fragment>\nuniform sampler2D tendrilFlow;\nuniform float tendrilAmount;')
      .replace('#include <map_fragment>', `
        #ifdef USE_MAP
          vec2 flow = texture2D(tendrilFlow, vMapUv).rg - vec2(0.5);
          vec2 livingUv = clamp(vMapUv + vec2(flow.x, -flow.y) * tendrilAmount, vec2(0.0), vec2(1.0));
          diffuseColor *= texture2D(map, livingUv);
        #endif
      `)
  }
  material.customProgramCacheKey = () => 'card-tendrils-v1'
  return material
}

function Tarot({ index, phase, revealed, reduced, flow, growth }: Props & { index: number; flow: Texture; growth: Texture }) {
  const group = useRef<Group>(null)
  const source = useLoader(TextureLoader, '/assets/tarot-back-worn.webp')
  const texture = useMemo(() => {
    const copy = source.clone()
    copy.colorSpace = SRGBColorSpace
    return copy
  }, [source])
  const material = useMemo(() => createTendrilMaterial(texture, flow, reduced), [texture, flow, reduced])
  useEffect(() => () => material.dispose(), [material])
  useEffect(() => () => texture.dispose(), [texture])
  const { size, camera, gl } = useThree()
  const { height, width } = size
  const offset = index - 2
  const selected = index === 2
  useEffect(() => {
    if (!group.current) return
    const card = group.current
    const timeline = gsap.timeline()
    const move = (position: { x: number; y: number; z: number }, rotation: { x: number; y: number; z: number }, duration: number, scale = 1) => {
      timeline.to(card.position, { ...position, duration, ease: 'power3.inOut' })
        .to(card.rotation, { ...rotation, duration, ease: 'power3.inOut' }, '<')
        .to(card.scale, { x: scale, y: scale, z: scale, duration }, '<')
    }
    if (reduced) {
      move({ x: offset * 0.91, y: -Math.abs(offset) * 0.17, z: -Math.abs(offset) * 0.24 }, { x: 0, y: 0, z: -offset * 0.16 }, 0)
    } else if (phase === 'gathering') {
      move({ x: offset * 0.025, y: offset * 0.016, z: index * 0.055 }, { x: -0.04, y: 0, z: offset * 0.025 }, RITUAL.shuffling - 0.03)
    } else if (phase === 'shuffling') {
      const direction = index % 2 === 0 ? 1 : -1
      for (let cut = 0; cut < 2; cut++) {
        move({ x: direction * (0.85 + index * 0.04), y: 0.1 + index * 0.025, z: (4 - index) * 0.07 }, { x: -0.08, y: direction * 0.16, z: direction * 0.1 }, 0.17)
        move({ x: offset * 0.025, y: offset * 0.016, z: index * 0.055 }, { x: 0, y: 0, z: offset * 0.025 }, 0.17)
      }
    } else if (phase === 'orbiting') {
      const orbit = { progress: 0 }
      timeline.to(orbit, {
        progress: 1, duration: RITUAL.choosing - RITUAL.orbiting - 0.025, ease: 'power1.inOut',
        onUpdate: () => {
          const angle = (index / 5) * Math.PI * 2 + orbit.progress * Math.PI * 2
          const spread = Math.min(orbit.progress * 4, 1)
          card.position.set(Math.sin(angle) * 1.83 * spread, Math.cos(angle) * 0.54 * spread, Math.cos(angle) * 0.58 - 0.15)
          card.rotation.set(-0.08, Math.sin(angle) * 0.3, -Math.sin(angle) * 0.24)
          card.scale.setScalar(1 - spread * 0.14)
        },
      })
    } else if (phase === 'choosing' || phase === 'flipping' || phase === 'revealing' || phase === 'complete') {
      // Project the chosen mesh onto the exact CSS card rectangle at handoff.
      // The elevated HTML card and the Three.js card now share size and center.
      const stage = gl.domElement.closest('.card-stage')
      const css = stage ? getComputedStyle(stage) : null
      const cardHeight = parseFloat(css?.getPropertyValue('--reveal-height') ?? '') || 328
      const centerOffset = parseFloat(css?.getPropertyValue('--reveal-center-offset') ?? '') || 20
      const pixelsPerUnit = height / (2 * Math.tan((camera as PerspectiveCamera).fov * Math.PI / 360) * (camera.position.z - .72))
      const magnification = CARD_REVEAL.perspective / (CARD_REVEAL.perspective - CARD_REVEAL.depth)
      const chosenY = (centerOffset + CARD_REVEAL.lift * magnification) / pixelsPerUnit - .15
      const chosenScale = cardHeight * magnification / (2.72 * pixelsPerUnit)
      move(
        selected ? { x: 0, y: chosenY, z: 0.72 } : { x: offset * 0.94, y: -Math.abs(offset) * 0.17, z: -Math.abs(offset) * 0.24 },
        { x: 0, y: 0, z: selected ? 0 : -offset * 0.17 },
        phase === 'choosing' ? RITUAL.flipping - RITUAL.choosing - 0.025 : 0.35,
        selected ? chosenScale : 1,
      )
    } else {
      move({ x: offset * 0.78, y: -Math.abs(offset) * 0.17, z: -Math.abs(offset) * 0.24 }, { x: 0, y: 0, z: -offset * 0.16 }, 0.7)
    }
    return () => { timeline.kill() }
  }, [phase, reduced, index, offset, selected, height, width, camera, gl])
  return <group ref={group} visible={!(selected && revealed)}>
    <mesh><boxGeometry args={[1.75, 2.72, 0.035]} /><meshStandardMaterial color="#51412e" roughness={0.94} metalness={0.18} /></mesh>
    <mesh position={[0, 0, 0.024]} material={material}><planeGeometry args={[1.73, 2.70]} /></mesh>
    <mesh position={[0, 0, -0.024]} rotation={[0, Math.PI, 0]} material={material}><planeGeometry args={[1.73, 2.70]} /></mesh>
    {!reduced && !(selected && revealed) && <>
      <mesh position={[0, 0, .0255]}><planeGeometry args={[1.73, 2.70]} /><meshBasicMaterial map={growth} transparent depthWrite={false} toneMapped={false} /></mesh>
      <mesh position={[0, 0, -.0255]} rotation={[0, Math.PI, 0]}><planeGeometry args={[1.73, 2.70]} /><meshBasicMaterial map={growth} transparent depthWrite={false} toneMapped={false} /></mesh>
    </>}
    {!reduced && !(selected && revealed) && <><LivingEngraving image={source.image as HTMLImageElement} seed={index} kind="eye" /><LivingEngraving image={source.image as HTMLImageElement} seed={index} kind="moth" /></>}
  </group>
}

function Deck(props: Props & { onReady: () => void }) {
  const group = useRef<Group>(null)
  const flow = useMemo(() => {
    const texture = new CanvasTexture(tendrilField(engravingTime()).canvas)
    texture.colorSpace = NoColorSpace; texture.minFilter = LinearFilter; texture.magFilter = LinearFilter; texture.generateMipmaps = false
    return texture
  }, [])
  const flowRuntime = useRef(flow)
  const growth = useMemo(() => {
    const texture = new CanvasTexture(tendrilGrowth(engravingTime()).canvas)
    texture.colorSpace = SRGBColorSpace; texture.minFilter = LinearFilter; texture.magFilter = LinearFilter; texture.generateMipmaps = false
    return texture
  }, [])
  const growthRuntime = useRef(growth)
  const growthVersion = useRef(-1)
  useLayoutEffect(() => { growthRuntime.current = growth }, [growth])
  useEffect(() => () => growth.dispose(), [growth])
  const flowVersion = useRef(-1)
  useLayoutEffect(() => { flowRuntime.current = flow }, [flow])
  useEffect(() => () => flow.dispose(), [flow])
  const motion = useRef<DeckMotion>({ x: 0, y: 0, bob: 0, elapsed: 0 })
  const canvas = useThree((state) => state.gl.domElement)
  const pointer = useDeckPointer(canvas)
  const { onReady, phase, reduced } = props
  useEffect(() => { onReady() }, [onReady])
  const drawing = phase !== 'idle' && phase !== 'complete'
  useFrame((_, delta) => {
    if (!group.current) return
    if (reduced) {
      motion.current.x = 0; motion.current.y = 0; motion.current.bob = 0
      group.current.rotation.set(0, 0, 0); group.current.position.y = .15
      return
    }
    if (!document.hidden) {
      const field = tendrilField(engravingTime())
      if (field.version !== flowVersion.current) { flowRuntime.current.needsUpdate = true; flowVersion.current = field.version }
      const roots = tendrilGrowth(engravingTime())
      if (roots.version !== growthVersion.current) { growthRuntime.current.needsUpdate = true; growthVersion.current = roots.version }
    }
    moveDeck(motion.current, pointer.current, delta, drawing)
    group.current.rotation.set(motion.current.x, motion.current.y, 0)
    group.current.position.y = .15 + motion.current.bob
  })
  return <group ref={group} position={[0, 0.15, 0]}>
    {[0, 1, 3, 4, 2].map((index) => <Tarot key={index} index={index} flow={flow} growth={growth} {...props} />)}
    {!reduced && <Sparkles count={drawing ? 95 : 55} scale={[8, 4.5, 3]} size={drawing ? 2.2 : 1.7} speed={drawing ? 0.65 : 0.24} opacity={drawing ? 0.85 : 0.6} color={phase === 'revealing' ? '#bd84f2' : props.role === 'killer' ? '#bd6651' : '#caa56c'} />}
  </group>
}

function FallbackCards({ phase, revealed, reduced }: Props) {
  const root = useRef<HTMLDivElement>(null)
  const pointer = useDeckPointer(root)
  const motion = useRef<DeckMotion>({ x: 0, y: 0, bob: 0, elapsed: 0 })
  const drawing = phase !== 'idle' && phase !== 'complete'
  useEffect(() => {
    const element = root.current
    if (!element) return
    if (reduced) {
      motion.current.x = 0; motion.current.y = 0; motion.current.bob = 0
      element.style.transform = 'none'
      return
    }
    const update = (_time: number, deltaMs: number) => {
      moveDeck(motion.current, pointer.current, deltaMs / 1000, drawing)
      element.style.transform = `translateY(${-motion.current.bob * 90}px) rotateX(${motion.current.x}rad) rotateY(${motion.current.y}rad)`
    }
    gsap.ticker.add(update)
    return () => { gsap.ticker.remove(update) }
  }, [drawing, reduced, pointer])
  return <div ref={root} className={`fallback-cards fallback-${phase} ${revealed ? 'has-result' : ''} ${reduced ? 'is-instant' : ''}`} aria-hidden="true">
    {[-2, -1, 0, 1, 2].map((offset) => <div className="fallback-card-track" key={offset} style={{ '--offset': offset, '--order': offset + 2, '--distance': Math.abs(offset), '--depth': 5 - Math.abs(offset) } as CSSProperties}><CardBack reduced={reduced} seed={offset + 2} hidden={offset === 0 && revealed} /></div>)}
  </div>
}

class SceneBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}

export default function CardScene(props: Props) {
  const [ready, setReady] = useState(false)
  const onReady = useCallback(() => setReady(true), [])
  return <SceneBoundary fallback={<FallbackCards {...props} />}>
    {!ready && <FallbackCards {...props} />}
    <Canvas style={{ opacity: ready ? 1 : 0 }} data-ready={ready} frameloop={props.reduced ? 'demand' : 'always'} camera={{ position: [0, 0, 6.9], fov: 36 }} dpr={props.reduced ? 1 : [1, 1.7]} gl={{ alpha: true, antialias: true, powerPreference: 'default' }} fallback={null} aria-hidden="true">
      <ambientLight intensity={0.65} color={props.role === 'killer' ? '#dab2a0' : '#b8c6ba'} />
      <Suspense fallback={null}><Deck {...props} onReady={onReady} /><EntityGrasp phase={props.phase} reduced={props.reduced} role={props.role} /></Suspense>
    </Canvas>
  </SceneBoundary>
}
