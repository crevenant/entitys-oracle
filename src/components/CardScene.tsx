import { Component, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Canvas, useFrame, useLoader } from '@react-three/fiber'
import { Float, Sparkles } from '@react-three/drei'
import { DoubleSide, Group, SRGBColorSpace, TextureLoader } from 'three'
import gsap from 'gsap'

type Props = { drawing: boolean; revealed: boolean; reduced: boolean }

function Tarot({ index, drawing, revealed, reduced }: Props & { index: number }) {
  const group = useRef<Group>(null)
  const source = useLoader(TextureLoader, '/assets/tarot-back.webp')
  const texture = useMemo(() => {
    const copy = source.clone()
    copy.colorSpace = SRGBColorSpace
    return copy
  }, [source])
  useEffect(() => () => texture.dispose(), [texture])
  const offset = index - 2
  useEffect(() => {
    if (!group.current) return
    const target = group.current
    const timeline = gsap.timeline()
    if (drawing && !reduced) {
      timeline.to(target.position, { x: -offset * 0.24, y: index * 0.018, z: index * 0.06, duration: 0.3 })
        .to(target.rotation, { z: offset * -0.1, y: Math.PI * 2, duration: 0.55 }, '<')
        .to(target.position, { x: offset * 0.85, y: Math.abs(offset) * -0.14, z: -Math.abs(offset) * 0.22, duration: 0.6, ease: 'power3.out' })
        .to(target.rotation, { z: -offset * 0.15, y: Math.PI * 4, duration: 0.6 }, '<')
    } else {
      timeline.to(target.position, { x: offset * (revealed ? 0.91 : 0.78), y: -Math.abs(offset) * 0.17, z: -Math.abs(offset) * 0.24, duration: reduced ? 0 : 0.7 })
        .to(target.rotation, { z: -offset * 0.16, y: 0, duration: reduced ? 0 : 0.7 }, '<')
    }
    return () => { timeline.kill() }
  }, [drawing, revealed, reduced, index, offset])
  return <group ref={group}>
    <mesh><boxGeometry args={[1.75, 2.72, 0.035]} /><meshStandardMaterial color="#342b1d" roughness={0.75} /></mesh>
    <mesh position={[0, 0, 0.024]}><planeGeometry args={[1.73, 2.70]} /><meshBasicMaterial map={texture} side={DoubleSide} toneMapped={false} /></mesh>
  </group>
}

function Deck(props: Props & { onReady: () => void }) {
  const group = useRef<Group>(null)
  const rotation = useRef({ x: 0, y: 0 })
  const { onReady } = props
  useEffect(() => { onReady() }, [onReady])
  useFrame(({ pointer }, delta) => {
    if (!group.current || props.reduced) return
    rotation.current.x += (-pointer.y * 0.055 - rotation.current.x) * Math.min(delta * 3, 1)
    rotation.current.y += (pointer.x * 0.09 - rotation.current.y) * Math.min(delta * 3, 1)
    group.current.rotation.set(rotation.current.x, rotation.current.y, 0)
  })
  return <group ref={group} position={[0, 0.15, 0]}>
    <Float speed={props.reduced ? 0 : 1.2} rotationIntensity={0.035} floatIntensity={0.16}>
      {[0, 1, 3, 4, 2].map((index) => <Tarot key={index} index={index} {...props} />)}
    </Float>
    {!props.reduced && <Sparkles count={55} scale={[9, 5, 3]} size={1.7} speed={0.24} opacity={0.6} color="#caa56c" />}
  </group>
}

function FallbackCards({ drawing, revealed }: Props) {
  return <div className={`fallback-cards ${drawing ? 'shuffling' : ''} ${revealed ? 'has-result' : ''}`}>
    {[-2, -1, 0, 1, 2].map((offset) => <img key={offset} alt="" src="/assets/tarot-back.webp" style={{ transform: `translateX(${offset * 48}px) rotate(${offset * 9}deg)`, zIndex: 3 - Math.abs(offset) }} />)}
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
    <Canvas style={{ opacity: ready ? 1 : 0 }} data-ready={ready} camera={{ position: [0, 0, 6.9], fov: 36 }} dpr={props.reduced ? 1 : [1, 1.7]} gl={{ alpha: true, antialias: true, powerPreference: 'default' }} fallback={null} aria-hidden="true">
      <ambientLight intensity={1.5} />
      <Suspense fallback={null}><Deck {...props} onReady={onReady} /></Suspense>
    </Canvas>
  </SceneBoundary>
}
