import { BufferAttribute, BufferGeometry, CatmullRomCurve3, Color, DataTexture, DynamicDrawUsage, Group, Mesh, MeshStandardMaterial, RepeatWrapping, RGBAFormat, SphereGeometry, Vector3 } from 'three'
import { captiveAnchor, captivePerspective } from './captivity'
import type { CaptiveMotion } from './captivity'

type Point = [number, number, number]
type RootDefinition = { points: Point[]; grip: Point; side: number; radius: number; seed: number }
type Root = {
  curve: CatmullRomCurve3
  rest: Vector3[]
  geometry: BufferGeometry
  segments: number
  sides: number
  radius: number
  seed: number
  centers: Float32Array
  parent?: Root
  attach: number
  direction: Vector3
  grip: Vector3
  side: number
  sheath?: number
}

export type EntityPose = { reach: number; agitation: number }
export type EntityGrip = { halfWidth: number; halfHeight: number; centerY: number; unitsPerPixel: number; depthScale: number; motion: CaptiveMotion }
export type EntityRig = ReturnType<typeof createEntityRig>

// Hand-placed paths keep the silhouette deliberately uneven, rather than mirrored.
const definitions: RootDefinition[] = [
  { points: [[-7,-3,-1],[-4.8,-2.2,-.5],[-3.6,-1.8,-.05],[-2.9,-1.4,.1],[-2.4,-.95,.32],[-2.1,-.65,.3],[-1.86,-.2,.2]], grip: [-1.02,.18,.86], side: -1, radius: .14, seed: 1.3 },
  { points: [[4.2,-4.7,-.9],[3.1,-3.2,-.4],[2.3,-2.6,0],[2.6,-1.9,.2],[2.5,-.9,.2],[2.1,-.75,.1],[1.78,-.35,.18]], grip: [1.03,-.15,.88], side: 1, radius: .125, seed: 4.8 },
  { points: [[-7,1.6,-1.2],[-5.5,1.8,-1],[-4.1,1.2,-.8],[-3,.85,-.5],[-2.55,1.1,-.25],[-2.1,1.1,-.1],[-1.8,.85,-.1]], grip: [-1.02,1.2,.81], side: -1, radius: .086, seed: 8.1 },
  { points: [[7,3.1,-1.2],[5.3,2.7,-.9],[4.4,1.7,-.75],[3.2,1.4,-.5],[2.55,.95,-.25],[2.2,.65,-.12],[1.8,.77,-.1]], grip: [1.02,.96,.82], side: 1, radius: .103, seed: 13.5 },
  { points: [[-1,-4,-.9],[-1.6,-3,-.5],[-2,-2.5,-.15],[-1.7,-2,.12],[-1.3,-1.8,.15],[-1,-1.7,.12],[-.9,-1.45,.14]], grip: [-.45,-1.31,.8], side: -1, radius: .073, seed: 21.2 },
]

const point = new Vector3()
const tangent = new Vector3()
const normal = new Vector3()
const binormal = new Vector3()
const forward = new Vector3(0, 0, 1)
const attachPoint = new Vector3()

function geometry(segments: number, sides: number, seed: number) {
  const mesh = new BufferGeometry()
  const count = (segments + 1) * (sides + 1)
  mesh.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3).setUsage(DynamicDrawUsage))
  mesh.setAttribute('normal', new BufferAttribute(new Float32Array(count * 3), 3).setUsage(DynamicDrawUsage))
  const colors = new Float32Array(count * 3)
  const uv = new Float32Array(count * 2)
  const indices: number[] = []
  for (let ring = 0; ring <= segments; ring++) {
    for (let edge = 0; edge <= sides; edge++) {
      const index = ring * (sides + 1) + edge
      const shade = .75 + .12 * Math.sin(ring * 1.9 + edge * .8 + seed) + .07 * Math.sin(ring * 4.1 - edge * 2.2)
      colors.set([shade, shade * .96, shade * .85], index * 3)
      uv.set([edge / sides, ring / segments], index * 2)
      if (ring < segments && edge < sides) {
        const next = index + sides + 1
        indices.push(index, index + 1, next, next, index + 1, next + 1)
      }
    }
  }
  mesh.setAttribute('color', new BufferAttribute(colors, 3))
  mesh.setAttribute('uv', new BufferAttribute(uv, 2))
  mesh.setIndex(indices)
  return mesh
}

function barkTexture() {
  const width = 96, height = 192
  const data = new Uint8Array(width * height * 4)
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const grain = Math.sin(x * .64 + Math.sin(y * .045) * 1.2)
    const pores = Math.sin(x * 15.17 + y * 31.7) * Math.sin(y * 9.2 - x * 4.7)
    const value = Math.round(123 + grain * 47 + pores * 29)
    data.set([value, value, value, 255], (y * width + x) * 4)
  }
  const texture = new DataTexture(data, width, height, RGBAFormat)
  texture.wrapS = texture.wrapT = RepeatWrapping
  texture.repeat.set(2, 4)
  texture.needsUpdate = true
  return texture
}

function createRoot(definition: RootDefinition): Root {
  const rest = definition.points.map((entry) => new Vector3(...entry))
  return {
    rest, curve: new CatmullRomCurve3(rest.map((entry) => entry.clone()), false, 'centripetal'),
    geometry: geometry(44, 8, definition.seed), segments: 44, sides: 8,
    radius: definition.radius, seed: definition.seed, centers: new Float32Array(45 * 3),
    attach: 0, direction: new Vector3(), grip: new Vector3(...definition.grip), side: definition.side,
  }
}

function createBranch(parent: Root, attach: number, direction: Point, seed: number, fine = false): Root {
  const rest = Array.from({ length: 6 }, () => new Vector3())
  const segments = fine ? 14 : 23, sides = fine ? 5 : 6
  return {
    parent, attach, direction: new Vector3(...direction), rest,
    curve: new CatmullRomCurve3(rest.map((entry) => entry.clone()), false, 'centripetal'),
    geometry: geometry(segments, sides, seed), segments, sides, seed,
    radius: parent.radius * (fine ? .2 : .33), centers: new Float32Array((segments + 1) * 3),
    grip: new Vector3(), side: parent.side,
  }
}

function shapeRoot(root: Root, time: number, pose: EntityPose) {
  const points = root.curve.points
  if (root.parent) {
    if (root.sheath !== undefined) {
      for (let index = 0; index < points.length; index++) {
        const u = .04 + index / (points.length - 1) * .88
        root.parent.curve.getPoint(u, points[index])
        root.parent.curve.getTangent(u, tangent)
        normal.set(-tangent.y, tangent.x, 0).normalize()
        const angle = root.sheath + u * 7 + Math.sin(u * 12 + root.seed) * .14
        const radius = root.parent.radius * Math.pow(1 - u, .83) * .97
        points[index].addScaledVector(normal, Math.cos(angle) * radius)
        points[index].z += Math.sin(angle) * radius
      }
      return
    }
    root.parent.curve.getPoint(root.attach, attachPoint)
    const direction = root.direction
    for (let index = 0; index < points.length; index++) {
      const u = index / (points.length - 1)
      const curl = u * u
      points[index].copy(attachPoint)
      points[index].x += direction.x * u + Math.sin(u * 5.5 + root.seed + time * .28) * .14 * curl
      points[index].y += direction.y * u + Math.cos(u * 5 + root.seed + time * .32) * .2 * curl
      points[index].z += direction.z * u + Math.sin(u * 4 + root.seed + time * .35) * .11 * curl
    }
    return
  }
  for (let index = 0; index < points.length; index++) {
    const u = index / (points.length - 1)
    const weight = u * u
    const rest = root.rest[index]
    points[index].copy(rest)
    const tip = root.grip
    if (index >= points.length - 3) {
      const bend = index - (points.length - 3)
      const targetX = tip.x + root.side * [.24, .075, -.04][bend]
      const targetY = tip.y + [-.24, -.07, .085][bend]
      const targetZ = tip.z + [-.26, -.035, .055][bend]
      points[index].x += (targetX - rest.x) * pose.reach
      points[index].y += (targetY - rest.y) * pose.reach
      points[index].z += (targetZ - rest.z) * pose.reach
    } else {
      points[index].x -= root.side * pose.reach * weight * .16
      points[index].z += pose.reach * weight * .14
    }
    const envelope = Math.sin(u * Math.PI * .85)
    const movement = (.055 + pose.agitation * .09) * envelope
    const hold = 1 - pose.reach * weight * .74
    points[index].x += Math.sin(time * .8 + root.seed + u * 8) * movement * hold
    points[index].y += Math.sin(time * .63 + root.seed * 1.8 + u * 7) * movement * hold
    points[index].z += Math.cos(time * .57 + root.seed + u * 9) * movement * .65
  }
}

function skinRoot(root: Root) {
  const { segments, sides, centers, seed } = root
  const positions = root.geometry.getAttribute('position')
  const normals = root.geometry.getAttribute('normal')
  const vertices = positions.array as Float32Array
  const lighting = normals.array as Float32Array
  for (let ring = 0; ring <= segments; ring++) {
    root.curve.getPoint(ring / segments, point)
    centers[ring * 3] = point.x
    centers[ring * 3 + 1] = point.y
    centers[ring * 3 + 2] = point.z
  }
  for (let ring = 0; ring <= segments; ring++) {
    const u = ring / segments
    const before = Math.max(0, ring - 1) * 3
    const after = Math.min(segments, ring + 1) * 3
    tangent.set(centers[after] - centers[before], centers[after + 1] - centers[before + 1], centers[after + 2] - centers[before + 2]).normalize()
    normal.crossVectors(tangent, forward).normalize()
    binormal.crossVectors(tangent, normal).normalize()
    const taper = Math.pow(1 - u, .83)
    const swell = 1 + .1 * Math.sin(u * 39 + seed) + .055 * Math.sin(u * 91 - seed)
    const radius = root.radius * taper * swell + .0015
    for (let edge = 0; edge <= sides; edge++) {
      const angle = edge / sides * Math.PI * 2
      const cos = Math.cos(angle), sin = Math.sin(angle)
      const nx = normal.x * cos + binormal.x * sin
      const ny = normal.y * cos + binormal.y * sin
      const nz = normal.z * cos + binormal.z * sin
      const ridges = 1 + .1 * Math.sin(angle * 3 + u * 12 + seed) + .055 * Math.cos(angle * 5 - u * 17)
      const index = (ring * (sides + 1) + edge) * 3
      vertices[index] = centers[ring * 3] + nx * radius * ridges
      vertices[index + 1] = centers[ring * 3 + 1] + ny * radius * ridges
      vertices[index + 2] = centers[ring * 3 + 2] + nz * radius * ridges
      lighting[index] = nx; lighting[index + 1] = ny; lighting[index + 2] = nz
    }
  }
  positions.needsUpdate = true
  normals.needsUpdate = true
}

export function createEntityRig() {
  const group = new Group()
  group.name = 'Organic Entity roots'
  const texture = barkTexture()
  const material = new MeshStandardMaterial({ color: '#514739', vertexColors: true, roughness: .91, metalness: 0, bumpMap: texture, bumpScale: .065 })
  const roots = definitions.map(createRoot)
  const branches: Root[] = []
  roots.forEach((root, index) => {
    branches.push(createBranch(root, .48 + index % 2 * .04, [root.side * .53, .42 - index * .11, .18], root.seed + 2.3))
    branches.push(createBranch(root, .68, [root.side * .35, -.4 + index * .13, -.12], root.seed + 6.1))
    branches.push(createBranch(root, .84, [-root.side * .24, .29, .12], root.seed + 9.4, true))
  })
  const fibers = branches.filter((_, index) => index % 3 !== 2).map((branch, index) => createBranch(branch, .68, [branch.side * .19, .16 * (index % 2 ? -1 : 1), .08], branch.seed + 13, true))
  const sheaths = roots.flatMap((root) => [0, 2.1, 4.2].map((angle) => {
    const sheath = createBranch(root, 0, [0, 0, 0], root.seed + angle + 18, true)
    sheath.sheath = angle
    sheath.radius = .009
    return sheath
  }))
  const allRoots = [...roots, ...branches, ...fibers, ...sheaths]
  for (const root of allRoots) {
    const mesh = new Mesh(root.geometry, material)
    mesh.frustumCulled = false
    group.add(mesh)
  }
  const knotGeometry = new SphereGeometry(1, 8, 6)
  const knots = branches.filter((_, index) => index % 3 === 0).map((branch) => {
    const mesh = new Mesh(knotGeometry, material)
    mesh.scale.set(branch.parent!.radius * .8, branch.parent!.radius * 1.12, branch.parent!.radius * .7)
    group.add(mesh)
    return { branch, mesh }
  })
  return {
    group, material, texture, roots: allRoots, mainRoots: roots, knots,
    baseColor: new Color('#514739'),
    dispose() { for (const root of allRoots) root.geometry.dispose(); knotGeometry.dispose(); material.dispose(); texture.dispose() },
  }
}

export function updateEntityRig(rig: EntityRig, time: number, pose: EntityPose, grip?: EntityGrip) {
  const anchors = [[-1, .05], [1, -.4], [-1, .75], [1, .7], [-.4, -1]]
  rig.mainRoots.forEach((root, index) => {
    if (!grip) { root.grip.set(...definitions[index].grip); return }
    const [x, y] = anchors[index]
    const point = captiveAnchor(x * grip.halfWidth / grip.unitsPerPixel, -y * grip.halfHeight / grip.unitsPerPixel, grip.motion)
    // Match the CSS perspective to the camera's depth scale. The card's center
    // stays at its screen offset while each gripping tip follows all three axes.
    const centerY = (grip.centerY + .15) / captivePerspective(point.z) - .15
    root.grip.set(point.x * grip.unitsPerPixel, centerY - point.y * grip.unitsPerPixel, .86 + point.z * grip.depthScale)
  })
  for (const root of rig.roots) { shapeRoot(root, time, pose); skinRoot(root) }
  for (const { branch, mesh } of rig.knots) branch.parent!.curve.getPoint(branch.attach, mesh.position)
  rig.material.color.copy(rig.baseColor).multiplyScalar(.55 + pose.reach * .45)
}
