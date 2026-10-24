/**
 * 地面与散落物：冰 → 结冰的湖面（强反射）+ 从远处向中心蔓延的冰刺；
 * 石 → 粗糙的土地 + 随声音震颤的碎石；火 → 焦土（中心余热发光）+ 闪烁的炭块。
 */
import { MeshReflectorMaterial } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import {
  Color,
  DodecahedronGeometry,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  Vector3,
  type BufferGeometry,
  type Material,
} from 'three'
import { createRng } from '../../core/lib/random'
import { smoothstep } from '../../core/lib/math'
import { prismGeometry } from '../geometry'
import { GROUND_Y } from '../layout'
import { groundGlowTexture } from '../textures'
import { useVisual } from '../VisualContext'
import { formWeight } from '../visual'
import { blendColor, blendNumber } from './palettes'

type ReflectorMaterial = MeshStandardMaterial & { mixStrength: number }

export function Ground() {
  const v = useVisual()
  const material = useRef<ReflectorMaterial>(null)

  useFrame(() => {
    const m = material.current
    if (!m) return
    blendColor(m.color, v, (p) => p.ground)
    m.roughness = blendNumber(v, (p) => p.groundRoughness)
    m.metalness = blendNumber(v, (p) => p.groundMetalness)
    m.mixStrength = blendNumber(v, (p) => p.reflection)
    blendColor(m.emissive, v, (p) => p.groundGlow)
    const glow = blendNumber(v, (p) => p.groundGlowStrength)
    m.emissiveIntensity = glow * (1 + v.intensity * 0.6 + v.burst * 0.8)
  })

  return (
    <group position={[0, GROUND_Y, 0]}>
      <mesh rotation-x={-Math.PI / 2}>
        <circleGeometry args={[30, 64]} />
        <MeshReflectorMaterial
          ref={material as never}
          resolution={512}
          blur={[300, 80]}
          mixBlur={0.9}
          mixStrength={0.6}
          mixContrast={1}
          depthScale={1.1}
          minDepthThreshold={0.4}
          maxDepthThreshold={1.4}
          mirror={0}
          color="#0d0c16"
          roughness={0.6}
          metalness={0.2}
          emissiveMap={groundGlowTexture()}
          emissive="#000000"
          envMapIntensity={0.12}
        />
      </mesh>
      <IceSpikes />
      <Pebbles />
      <Embers />
    </group>
  )
}

interface Scatter {
  pos: Vector3
  scale: number
  rot: Quaternion
  /** 0~1，按距离排序，冰刺据此决定出现的先后 */
  order: number
  phase: number
}

function scatter(seed: number, count: number, minR: number, maxR: number): Scatter[] {
  const rng = createRng(seed)
  return Array.from({ length: count }, () => {
    const r = Math.sqrt(rng.range(minR * minR, maxR * maxR))
    const a = rng.range(0, Math.PI * 2)
    const tilt = new Quaternion().setFromAxisAngle(
      new Vector3(rng.range(-1, 1), 0, rng.range(-1, 1)).normalize(),
      rng.range(0, 0.45),
    )
    const spin = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), rng.range(0, Math.PI * 2))
    return {
      pos: new Vector3(Math.cos(a) * r, 0, Math.sin(a) * r),
      scale: rng.range(0.5, 1.2),
      rot: tilt.multiply(spin),
      order: (r - minR) / (maxR - minR),
      phase: rng.range(0, Math.PI * 2),
    }
  })
}

type InstanceUpdate = (item: Scatter, dummy: Object3D) => boolean

/** 实例化散落物：每帧按回调算出每个实例的位置/缩放，返回 false 表示隐藏 */
function Instanced({
  items,
  geometry,
  material,
  update,
}: {
  items: Scatter[]
  geometry: BufferGeometry
  material: Material
  update: InstanceUpdate
}) {
  const ref = useRef<InstancedMesh>(null)
  const dummy = useMemo(() => new Object3D(), [])
  const hidden = useMemo(() => new Matrix4().makeScale(0, 0, 0), [])

  useFrame(() => {
    const mesh = ref.current
    if (!mesh) return
    let any = false
    items.forEach((item, i) => {
      dummy.position.copy(item.pos)
      dummy.quaternion.copy(item.rot)
      dummy.scale.setScalar(item.scale)
      if (update(item, dummy)) {
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
        any = true
      } else mesh.setMatrixAt(i, hidden)
    })
    mesh.visible = any
    mesh.instanceMatrix.needsUpdate = true
  })

  return <instancedMesh ref={ref} args={[geometry, material, items.length]} frustumCulled={false} />
}

/** 冰刺：从远处向中心蔓延，压力越高越密越长 */
function IceSpikes() {
  const v = useVisual()
  const items = useMemo(() => scatter(101, 70, 1.6, 9), [])
  const geometry = useMemo(() => prismGeometry(), [])
  const material = useMemo(
    () =>
      new MeshStandardMaterial({
        color: new Color('#cfeaff'),
        roughness: 0.15,
        metalness: 0.1,
        emissive: new Color('#3b8fd8'),
        emissiveIntensity: 0.35,
        flatShading: true,
        transparent: true,
        opacity: 0.9,
      }),
    [],
  )
  return (
    <Instanced
      items={items}
      geometry={geometry}
      material={material}
      update={(item, d) => {
        const w = formWeight(v, 'ice')
        if (w <= 0.01) return false
        const reach = smoothstep(1 - item.order - 0.15, 1 - item.order + 0.15, v.pressure * 1.25)
        const s = item.scale * reach * w
        if (s <= 0.01) return false
        d.scale.set(s * 0.12, s * (0.35 + v.pressure * 0.5), s * 0.12)
        return true
      }}
    />
  )
}

/** 碎石：发声时跟着震颤 */
function Pebbles() {
  const v = useVisual()
  const items = useMemo(() => scatter(202, 60, 1.4, 8), [])
  const geometry = useMemo(() => new DodecahedronGeometry(1, 0), [])
  const material = useMemo(
    () => new MeshStandardMaterial({ color: new Color('#6e5a49'), roughness: 1, flatShading: true }),
    [],
  )
  return (
    <Instanced
      items={items}
      geometry={geometry}
      material={material}
      update={(item, d) => {
        const w = formWeight(v, 'stone')
        if (w <= 0.01) return false
        const s = item.scale * 0.12 * w * (0.7 + v.pressure * 0.5)
        const jump = v.reducedMotion
          ? 0
          : Math.max(0, Math.sin(v.time * 18 + item.phase)) * (v.intensity * 0.05 + v.burst * 0.08)
        d.position.y = s * 0.4 + jump
        d.scale.set(s, s * 0.7, s)
        return true
      }}
    />
  )
}

/** 炭块：火的余烬，闪烁发光 */
function Embers() {
  const v = useVisual()
  const items = useMemo(() => scatter(303, 55, 1.4, 8), [])
  const geometry = useMemo(() => new IcosahedronGeometry(1, 0), [])
  const material = useMemo(
    () =>
      new MeshStandardMaterial({
        color: new Color('#2a0f08'),
        roughness: 0.9,
        emissive: new Color('#ff5a1a'),
        emissiveIntensity: 1.5,
        flatShading: true,
      }),
    [],
  )
  useFrame(() => {
    material.emissiveIntensity = 0.8 + v.pressure * 2.2 + v.intensity * 1.2 + v.burst * 2
  })
  return (
    <Instanced
      items={items}
      geometry={geometry}
      material={material}
      update={(item, d) => {
        const w = formWeight(v, 'fire')
        if (w <= 0.01) return false
        const flicker = 0.85 + 0.15 * Math.sin(v.time * 7 + item.phase * 3)
        const s = item.scale * 0.1 * w * flicker
        d.position.y = s * 0.3
        d.scale.set(s, s * 0.6, s)
        return true
      }}
    />
  )
}
