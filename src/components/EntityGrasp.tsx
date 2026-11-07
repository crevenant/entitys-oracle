import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import gsap from 'gsap'
import { Color } from 'three'
import type { RefObject } from 'react'
import { createEntityRig, updateEntityRig } from '../lib/entityRig'
import type { EntityPose } from '../lib/entityRig'
import type { RitualPhase } from '../lib/ritual'
import type { Role } from '../lib/oracle'
import { captureReach, captivityMotion, captivityTime, entityReaction } from '../lib/captivity'
import type { CaptivityClock } from '../lib/captivity'
import type { PerspectiveCamera } from 'three'
import { CARD_REVEAL, RITUAL, SUMMONING } from '../lib/ritual'

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
const shadowColor = new Color('#070d0a')
const smooth = (value: number) => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t) }

export default function EntityGrasp({ phase, reduced, role, captivity, ritualClock }: { phase: RitualPhase; reduced: boolean; role: Role; captivity: CaptivityClock; ritualClock: RefObject<{ time: number }> }) {
  const rig = useMemo(() => createEntityRig(), [])
  const runtime = useRef(rig)
  const pose = useRef<EntityPose>({ ...poses.idle })
  const elapsed = useRef(0)
  const width = useThree((state) => state.size.width)
  const { size, camera, gl } = useThree()
  const frame = useRef({ halfWidth: 1, halfHeight: 1.5, centerY: 0, unitsPerPixel: .01, depthScale: .005 })
  useLayoutEffect(() => {
    const stage = gl.domElement.closest('.card-stage')
    if (!stage) return
    const css = getComputedStyle(stage)
    const units = 2 * Math.tan((camera as PerspectiveCamera).fov * Math.PI / 360) * (camera.position.z - .86) / stage.clientHeight
    frame.current = { halfWidth: (parseFloat(css.getPropertyValue('--reveal-width')) / 2 + 1) * units, halfHeight: parseFloat(css.getPropertyValue('--reveal-height')) / 2 * units, centerY: parseFloat(css.getPropertyValue('--reveal-center-offset')) * units - .15, unitsPerPixel: units, depthScale: (camera.position.z - .86) / CARD_REVEAL.perspective }
  }, [size.height, size.width, camera, gl])

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
    const after = captivityTime(captivity)
    if (after >= 0) {
      const reaction = entityReaction(captivity), reach = captureReach(after) * (1 - reaction.release * .94)
      const motion = captivityMotion(captivity), fit = frame.current
      const agitation = reaction.time < 0 ? after < .4 ? 1 : .4 : reaction.forcing ? 2.6 : reaction.surging ? .9 : .4 + reaction.level * reaction.pulse
      updateEntityRig(runtime.current, clock.elapsedTime, { reach, agitation }, { ...fit, motion })
    } else updateEntityRig(runtime.current, clock.elapsedTime, pose.current)
    // The existing roots become the summoned arms. Keeping the same rig avoids
    // a jump in their origins, bends, and gripping tips at either handoff.
    if (!['idle', 'complete'].includes(phase)) {
      const time = ritualClock.current.time
      const emergence = smooth((time - SUMMONING.shiver) / (SUMMONING.takeHold - SUMMONING.shiver))
      const release = 1 - smooth((time - RITUAL.flipping) / .65)
      runtime.current.material.color.lerp(shadowColor, emergence * release * .92)
    }
  })

  // Preserve the roots' positions throughout the summoning and chosen-card grip.
  return <group visible={!reduced}>
    <directionalLight position={[-5, 3.5, 1.5]} color="#c1c9b1" intensity={3.1} />
    <pointLight position={[2.8, .8, 2.5]} color={role === 'killer' ? '#bd654e' : '#bba678'} intensity={2.1} distance={7} decay={2} />
    <pointLight position={[-2.2, -1.5, 1.8]} color="#66796b" intensity={1.1} distance={5} decay={2} />
    <primitive object={rig.group} dispose={null} position={[0, .15, 0]} renderOrder={-1} />
  </group>
}
