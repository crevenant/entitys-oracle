import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { BufferGeometry, DoubleSide, Float32BufferAttribute, Mesh, MeshBasicMaterial } from 'three'
import type { Texture } from 'three'
import { CAPTIVITY, captivityTime } from '../lib/captivity'
import type { CaptivityClock } from '../lib/captivity'

const random = (seed: number) => { const n = Math.sin(seed * 127.1) * 43758.5453; return n - Math.floor(n) }

/** A single draw call per shattered card; UVs retain the actual tarot artwork. */
export default function CardFragments({ texture, index, clock }: { texture: Texture; index: number; clock: CaptivityClock }) {
  const mesh = useRef<Mesh>(null)
  const phone = useThree((state) => state.size.width < 600)
  const pieces = useMemo(() => {
    const geometry = new BufferGeometry(), count = phone ? 3 : 4
    const positions: number[] = [], uv: number[] = [], centers: number[] = [], launches: number[] = [], spins: number[] = []
    const grid = Array.from({ length: count + 1 }, (_, row) => Array.from({ length: count + 1 }, (_, col) => [
      col / count + (col > 0 && col < count ? (random(row * 11 + col + 3) - .5) * .12 : 0),
      row / count + (row > 0 && row < count ? (random(row * 13 + col + 7) - .5) * .12 : 0),
    ]))
    let piece = 0
    for (let row = 0; row < count; row++) for (let col = 0; col < count; col++) {
      const a = grid[row][col], b = grid[row][col + 1], c = grid[row + 1][col], d = grid[row + 1][col + 1]
      for (const triangle of [[a, b, c], [b, d, c]]) {
        const cx = triangle.reduce((sum, point) => sum + point[0], 0) / 3, cy = triangle.reduce((sum, point) => sum + point[1], 0) / 3
        const seed = index * 61 + piece++ * 3
        const direction = index < 2 ? -1 : 1
        for (const point of triangle) {
          positions.push((point[0] - .5) * 1.73, (.5 - point[1]) * 2.70, .026)
          uv.push(point[0], 1 - point[1])
          centers.push((cx - .5) * 1.73, (.5 - cy) * 2.70, .026)
          launches.push(direction * (1.8 + random(seed + 4) * 2.4), .3 + random(seed + 8) * 2.4, (random(seed + 12) - .4) * 2.8)
          spins.push((random(seed + 19) - .5) * 7, (random(seed + 23) - .5) * 9, direction * (1 + random(seed + 31) * 5))
        }
      }
    }
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
    geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2))
    geometry.setAttribute('shardCenter', new Float32BufferAttribute(centers, 3))
    geometry.setAttribute('shardLaunch', new Float32BufferAttribute(launches, 3))
    geometry.setAttribute('shardSpin', new Float32BufferAttribute(spins, 3))
    const age = { value: 0 }
    const material = new MeshBasicMaterial({ map: texture, side: DoubleSide, transparent: true, depthWrite: false, toneMapped: false })
    material.onBeforeCompile = (shader) => {
      shader.uniforms.shardAge = age
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 shardCenter;\nattribute vec3 shardLaunch;\nattribute vec3 shardSpin;\nuniform float shardAge;')
        .replace('#include <begin_vertex>', `
          vec3 p = position - shardCenter;
          vec3 angle = shardSpin * shardAge;
          p.yz = mat2(cos(angle.x), -sin(angle.x), sin(angle.x), cos(angle.x)) * p.yz;
          p.xz = mat2(cos(angle.y), -sin(angle.y), sin(angle.y), cos(angle.y)) * p.xz;
          p.xy = mat2(cos(angle.z), -sin(angle.z), sin(angle.z), cos(angle.z)) * p.xy;
          vec3 transformed = p * (1.0 - smoothstep(0.5, 1.25, shardAge) * 0.6) + shardCenter + shardLaunch * shardAge;
          transformed.y -= 2.8 * shardAge * shardAge;
        `)
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nuniform float shardAge;')
        .replace('#include <alphatest_fragment>', 'diffuseColor.a *= 1.0 - smoothstep(0.35, 1.25, shardAge);\n#include <alphatest_fragment>')
    }
    material.customProgramCacheKey = () => 'destroyed-tarot-v1'
    return { geometry, material, age }
  }, [phone, texture, index])
  const runtime = useRef(pieces)
  useLayoutEffect(() => { runtime.current = pieces }, [pieces])
  useEffect(() => () => { pieces.geometry.dispose(); pieces.material.dispose() }, [pieces])
  useFrame(() => {
    const time = captivityTime(clock)
    if (mesh.current) mesh.current.visible = time >= 0 && time < CAPTIVITY.fragments
    runtime.current.age.value = Math.max(0, Math.min(time, CAPTIVITY.fragments))
  })
  return <mesh ref={mesh} geometry={pieces.geometry} material={pieces.material} frustumCulled={false} />
}

export function FlatCardFragments({ index }: { index: number }) {
  const direction = index < 2 ? -1 : 1
  return <div className="flat-card-fragments" aria-hidden="true">{Array.from({ length: 18 }, (_, piece) => {
    const col = Math.floor(piece / 2) % 3, row = Math.floor(piece / 6)
    const a = `${col * 100 / 3}% ${row * 100 / 3}%`, b = `${(col + 1) * 100 / 3}% ${row * 100 / 3}%`
    const c = `${col * 100 / 3}% ${(row + 1) * 100 / 3}%`, d = `${(col + 1) * 100 / 3}% ${(row + 1) * 100 / 3}%`
    return <i key={piece} style={{ clipPath: `polygon(${piece % 2 ? `${b},${d},${c}` : `${a},${b},${c}`})`, '--shard-x': `${direction * (95 + random(index * 31 + piece) * 150)}px`, '--shard-y': `${-65 + random(piece * 7 + index) * 210}px`, '--shard-spin': `${direction * (30 + piece * 17)}deg` } as import('react').CSSProperties} />
  })}</div>
}
