import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import gsap from 'gsap'
import { createEntityRig, updateEntityRig } from '../lib/entityRig'
import type { EntityPose } from '../lib/entityRig'
import type { RitualPhase } from '../lib/ritual'
import type { Role } from '../lib/oracle'

const poses: Record<RitualPhase, EntityPose> = {
  idle: { reach: .03, agitation: .1 },
  gathering: { reach: .2, agitation: .35 },
  shuffling: { reach: .36, agitation: .65 },
  orbiting: { reach: .63, agitation: .9 },
  choosing: { reach: 1, agitation: .25 },
  flipping: { reach: .25, agitation: .75 },
  revealing: { reach: .12, agitation: .2 },
  complete: { reach: .03, agitation: .1 },
}

export default function EntityGrasp({ phase, reduced, role }: { phase: RitualPhase; reduced: boolean; role: Role }) {
  const rig = useMemo(() => createEntityRig(), [])
  const runtime = useRef(rig)
  const pose = useRef<EntityPose>({ ...poses.idle })
  const elapsed = useRef(0)
  const width = useThree((state) => state.size.width)

  useLayoutEffect(() => { runtime.current = rig; updateEntityRig(rig, 0, pose.current) }, [rig])
  useEffect(() => () => rig.dispose(), [rig])
  useEffect(() => {
    const tween = gsap.to(pose.current, {
      ...poses[phase], duration: reduced ? 0 : phase === 'flipping' ? .32 : phase === 'choosing' ? .58 : .7,
      ease: phase === 'flipping' ? 'power2.out' : 'sine.inOut',
    })
    return () => { tween.kill() }
  }, [phase, reduced])

  useFrame(({ clock }, delta) => {
    if (reduced) return
    elapsed.current += delta
    // Slower root motion still looks fluid at 30 updates per second on a phone.
    if (width < 600 && elapsed.current < 1 / 30) return
    elapsed.current = 0
    updateEntityRig(runtime.current, clock.elapsedTime, pose.current)
  })

  return <group visible={!reduced}>
    <directionalLight position={[-5, 3.5, 1.5]} color="#c1c9b1" intensity={3.1} />
    <pointLight position={[2.8, .8, 2.5]} color={role === 'killer' ? '#bd654e' : '#bba678'} intensity={2.1} distance={7} decay={2} />
    <pointLight position={[-2.2, -1.5, 1.8]} color="#66796b" intensity={1.1} distance={5} decay={2} />
    <primitive object={rig.group} dispose={null} position={[0, .15, 0]} />
  </group>
}
