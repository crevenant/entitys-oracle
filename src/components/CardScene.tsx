import { Component, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber'
import { Float, Sparkles } from '@react-three/drei'
import { Group, SRGBColorSpace, TextureLoader } from 'three'
import gsap from 'gsap'
import { RITUAL } from '../lib/ritual'
import type { RitualPhase } from '../lib/ritual'
import type { Role } from '../lib/oracle'

type Props = { phase: RitualPhase; revealed: boolean; reduced: boolean; role: Role }

function Tarot({ index, phase, revealed, reduced }: Props & { index: number }) {
  const group = useRef<Group>(null)
  const source = useLoader(TextureLoader, '/assets/tarot-back-worn.webp')
  const texture = useMemo(() => {
    const copy = source.clone()
    copy.colorSpace = SRGBColorSpace
    return copy
  }, [source])
  useEffect(() => () => texture.dispose(), [texture])
  const height = useThree((state) => state.size.height)
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
      move(
        selected ? { x: 0, y: 0.12, z: 0.72 } : { x: offset * 0.94, y: -Math.abs(offset) * 0.17, z: -Math.abs(offset) * 0.24 },
        { x: 0, y: 0, z: selected ? 0 : -offset * 0.17 },
        phase === 'choosing' ? RITUAL.flipping - RITUAL.choosing - 0.025 : 0.35,
        selected ? (height < 400 ? 1.22 : 1.16) : 1,
      )
    } else {
      move({ x: offset * 0.78, y: -Math.abs(offset) * 0.17, z: -Math.abs(offset) * 0.24 }, { x: 0, y: 0, z: -offset * 0.16 }, 0.7)
    }
    return () => { timeline.kill() }
  }, [phase, reduced, index, offset, selected, height])
  return <group ref={group} visible={!(selected && revealed)}>
    <mesh><boxGeometry args={[1.75, 2.72, 0.035]} /><meshStandardMaterial color="#51412e" roughness={0.94} metalness={0.18} /></mesh>
    <mesh position={[0, 0, 0.024]}><planeGeometry args={[1.73, 2.70]} /><meshBasicMaterial map={texture} toneMapped={false} /></mesh>
    <mesh position={[0, 0, -0.024]} rotation={[0, Math.PI, 0]}><planeGeometry args={[1.73, 2.70]} /><meshBasicMaterial map={texture} toneMapped={false} /></mesh>
  </group>
}

function Deck(props: Props & { onReady: () => void }) {
  const group = useRef<Group>(null)
  const rotation = useRef({ x: 0, y: 0 })
  const { onReady, phase, reduced } = props
  useEffect(() => { onReady() }, [onReady])
  const drawing = phase !== 'idle' && phase !== 'complete'
  useFrame(({ pointer }, delta) => {
    if (!group.current) return
    if (reduced) { group.current.rotation.set(0, 0, 0); return }
    const enabled = !reduced && !drawing
    rotation.current.x += ((enabled ? -pointer.y * 0.055 : 0) - rotation.current.x) * Math.min(delta * 5, 1)
    rotation.current.y += ((enabled ? pointer.x * 0.09 : 0) - rotation.current.y) * Math.min(delta * 5, 1)
    group.current.rotation.set(rotation.current.x, rotation.current.y, 0)
  })
  return <group ref={group} position={[0, 0.15, 0]}>
    <Float speed={reduced || drawing ? 0 : 1.2} rotationIntensity={drawing ? 0 : 0.035} floatIntensity={drawing ? 0 : 0.16}>
      {[0, 1, 3, 4, 2].map((index) => <Tarot key={index} index={index} {...props} />)}
    </Float>
    {!reduced && <Sparkles count={drawing ? 95 : 55} scale={[8, 4.5, 3]} size={drawing ? 2.2 : 1.7} speed={drawing ? 0.65 : 0.24} opacity={drawing ? 0.85 : 0.6} color={phase === 'revealing' ? '#bd84f2' : props.role === 'killer' ? '#bd6651' : '#caa56c'} />}
  </group>
}

function FallbackCards({ phase, revealed, reduced }: Props) {
  return <div className={`fallback-cards fallback-${phase} ${revealed ? 'has-result' : ''} ${reduced ? 'is-instant' : ''}`} aria-hidden="true">
    {[-2, -1, 0, 1, 2].map((offset) => <div className="fallback-card-track" key={offset} style={{ '--offset': offset, '--order': offset + 2, '--distance': Math.abs(offset), '--depth': 5 - Math.abs(offset) } as CSSProperties}><img alt="" src="/assets/tarot-back-worn.webp" style={{ visibility: offset === 0 && revealed ? 'hidden' : undefined }} /></div>)}
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
      <ambientLight intensity={1.5} color={props.role === 'killer' ? '#dab2a0' : '#b8c6ba'} />
      <Suspense fallback={null}><Deck {...props} onReady={onReady} /></Suspense>
    </Canvas>
  </SceneBoundary>
}
