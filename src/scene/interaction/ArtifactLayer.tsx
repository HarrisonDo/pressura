/**
 * 标本处置的视觉层：点击拾取、树、燃烧、倾倒的液体、裂纹闪光、碎裂碎片、蒸汽/灰烬等粒子特效、黑曜石。
 * 演示版：效果偏简单，规则全部在 core/artifact/rules.ts。
 */
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import {
  AdditiveBlending,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  Sprite,
  SpriteMaterial,
  Vector3,
  Mesh,
} from 'three'
import type { ArtifactLive, ArtifactPointerEvent } from '../../app/live'
import type { ArtifactEffect, PlantedTree, Vec3 } from '../../core/artifact/rules'
import { createRng } from '../../core/lib/random'
import { FORM_COLORS } from '../../core/palette'
import { ENTITY_Y, GROUND_Y } from '../layout'
import { glowTexture } from '../textures'
import { useVisual } from '../VisualContext'
import { entitySize } from '../visual'

export interface ArtifactBridge {
  artifact: ArtifactLive | null
  onArtifactPointer: ((event: ArtifactPointerEvent) => void) | null
}

const UP = new Vector3(0, 1, 0)

export function ArtifactLayer({ bridge }: { bridge: ArtifactBridge }) {
  const v = useVisual()
  const root = useRef<Group>(null)
  const collider = useRef<Mesh>(null)

  useFrame(() => {
    const a = bridge.artifact
    const s = a?.state
    v.hidden = !!s?.shattered
    v.obsidian = !!s?.obsidian
    v.calm = s?.release ?? 0
    v.scaleMul = s ? (1 + s.frost * 0.18) * (1 - s.melt * 0.6) : 1
    if (root.current) root.current.visible = !!a
    if (collider.current) collider.current.scale.setScalar(entitySize(v.pressure) * 0.95 * v.scaleMul)
  })

  const toLocal = (e: ThreeEvent<PointerEvent | MouseEvent>): { point: Vec3; normal: Vec3 } => {
    const p = e.point.clone().sub(new Vector3(0, ENTITY_Y, 0))
    const n = p.clone().normalize()
    return { point: [p.x, p.y, p.z], normal: [n.x, n.y, n.z] }
  }
  const send = (kind: ArtifactPointerEvent['kind'], e: ThreeEvent<PointerEvent | MouseEvent>) => {
    e.stopPropagation()
    bridge.onArtifactPointer?.({ kind, ...toLocal(e) })
  }

  return (
    <group ref={root} position={[0, ENTITY_Y, 0]} visible={false}>
      {/* 看不见的拾取球：所有材质都用它来确定点击位置和表面方向 */}
      <mesh
        ref={collider}
        onPointerDown={(e) => send('down', e)}
        onPointerMove={(e) => send('move', e)}
        onPointerUp={(e) => send('up', e)}
        onPointerLeave={(e) => send('up', e)}
        onDoubleClick={(e) => send('double', e)}
      >
        <sphereGeometry args={[1, 32, 24]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <Trees bridge={bridge} />
      <Burning bridge={bridge} />
      <PourStream bridge={bridge} />
      <Obsidian />
      <Effects bridge={bridge} />
    </group>
  )
}

/** 把树种在拾取球表面，沿法线方向生长 */
function Trees({ bridge }: { bridge: ArtifactBridge }) {
  const v = useVisual()
  const group = useRef<Group>(null)
  const trunkGeo = useMemo(() => new CylinderGeometry(0.035, 0.05, 0.3, 6).translate(0, 0.15, 0), [])
  const crownGeo = useMemo(() => new ConeGeometry(0.16, 0.38, 7).translate(0, 0.42, 0), [])
  const mats = useMemo(
    () => ({
      trunk: new MeshStandardMaterial({ color: '#6b4a32', roughness: 0.9, flatShading: true }),
      green: new MeshStandardMaterial({ color: '#5fbf5a', roughness: 0.7, flatShading: true, emissive: '#1d4a1a', emissiveIntensity: 0.4 }),
      frost: new MeshStandardMaterial({ color: '#e6f6ff', roughness: 0.2, flatShading: true, emissive: '#5fb7ff', emissiveIntensity: 0.6, transparent: true, opacity: 0.9 }),
      ash: new MeshStandardMaterial({ color: '#3a3532', roughness: 1, flatShading: true }),
    }),
    [],
  )
  const nodes = useRef(new Map<number, Group>())
  const q = useMemo(() => new Quaternion(), [])

  useFrame(() => {
    const g = group.current
    const trees = bridge.artifact?.state.trees ?? []
    if (!g) return
    g.visible = !v.hidden
    const seen = new Set<number>()
    const r = entitySize(v.pressure) * 0.82 * v.scaleMul
    for (const tree of trees) {
      seen.add(tree.id)
      let node = nodes.current.get(tree.id)
      if (!node) {
        node = buildTree(tree, trunkGeo, crownGeo, mats)
        nodes.current.set(tree.id, node)
        g.add(node)
      }
      const n = new Vector3(...tree.normal)
      node.position.copy(n).multiplyScalar(r)
      node.quaternion.copy(q.setFromUnitVectors(UP, n))
      node.scale.setScalar(Math.max(0.05, tree.growth) * (0.8 + r * 0.25))
      const crown = node.children[1] as Mesh
      crown.material = tree.burnt ? mats.ash : tree.species === 'frost' ? mats.frost : mats.green
      crown.visible = !tree.burnt || tree.species === 'ash'
      crown.scale.setScalar(tree.burnt ? 0.5 : 1)
    }
    for (const [id, node] of nodes.current) {
      if (!seen.has(id)) {
        g.remove(node)
        nodes.current.delete(id)
      }
    }
  })
  return <group ref={group} />
}

function buildTree(
  tree: PlantedTree,
  trunkGeo: CylinderGeometry,
  crownGeo: ConeGeometry,
  mats: Record<'trunk' | 'green' | 'frost' | 'ash', MeshStandardMaterial>,
): Group {
  const g = new Group()
  const trunk = new Mesh(trunkGeo, tree.burnt ? mats.ash : mats.trunk)
  const crown = new Mesh(crownGeo, mats.green)
  g.add(trunk, crown)
  return g
}

/** 汽油燃烧：在表面绕一圈闪烁的火苗光晕 */
function Burning({ bridge }: { bridge: ArtifactBridge }) {
  const v = useVisual()
  const group = useRef<Group>(null)
  const sprites = useMemo(() => {
    const rng = createRng(77)
    return Array.from({ length: 14 }, () => {
      const s = new Sprite(
        new SpriteMaterial({ map: glowTexture(), color: new Color('#ff7a2a'), blending: AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false }),
      )
      return { sprite: s, dir: new Vector3(...rng.direction()), phase: rng.range(0, 6) }
    })
  }, [])

  useFrame(() => {
    const g = group.current
    const burning = bridge.artifact?.state.burning ?? 0
    if (!g) return
    g.visible = burning > 0.02 && !v.hidden
    if (!g.visible) return
    const r = entitySize(v.pressure) * 0.85 * v.scaleMul
    for (const { sprite, dir, phase } of sprites) {
      const up = Math.max(0, dir.y) * 0.25
      sprite.position.copy(dir).multiplyScalar(r).add(new Vector3(0, up + 0.1 * Math.sin(v.time * 4 + phase), 0))
      const f = 0.7 + 0.3 * Math.sin(v.time * 9 + phase * 3)
      sprite.scale.setScalar((0.5 + burning * 0.7) * f)
      ;(sprite.material as SpriteMaterial).opacity = burning * f
      ;(sprite.material as SpriteMaterial).color.setRGB(2.2, 0.7 + f * 0.3, 0.15)
    }
  })

  return (
    <group ref={group}>
      {sprites.map(({ sprite }, i) => (
        <primitive key={i} object={sprite} />
      ))}
      <pointLight color="#ff7a2a" intensity={4} distance={4} />
    </group>
  )
}

/** 倾倒中的液体：从上方落到点击处的一串水滴 */
function PourStream({ bridge }: { bridge: ArtifactBridge }) {
  const v = useVisual()
  const mesh = useRef<InstancedMesh>(null)
  const geo = useMemo(() => new IcosahedronGeometry(0.035, 0), [])
  const mat = useMemo(() => new MeshStandardMaterial({ color: '#7cc8ff', transparent: true, opacity: 0.85, roughness: 0.1, emissive: '#2a6fb0', emissiveIntensity: 0.6 }), [])
  const dummy = useMemo(() => new Object3D(), [])
  const COUNT = 40

  useFrame(() => {
    const m = mesh.current
    const a = bridge.artifact
    if (!m) return
    const target = a?.pouring
    m.visible = !!target
    if (!target || !a) return
    const isWater = a.tool === 'water'
    mat.color.set(isWater ? '#7cc8ff' : '#e8c35a')
    mat.emissive.set(isWater ? '#2a6fb0' : '#7a5a10')
    const top = new Vector3(target[0] + 0.25, target[1] + 2.2, target[2] + 0.4)
    const end = new Vector3(...target)
    for (let i = 0; i < COUNT; i++) {
      const t = (i / COUNT + v.time * 1.8) % 1
      dummy.position.lerpVectors(top, end, t * t)
      dummy.position.x += Math.sin(i * 12.9 + v.time * 10) * 0.02
      dummy.scale.set(1, 1.8, 1)
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
    }
    m.instanceMatrix.needsUpdate = true
  })
  return <instancedMesh ref={mesh} args={[geo, mat, COUNT]} frustumCulled={false} />
}

/** 火核熄灭后留下的黑曜石 */
function Obsidian() {
  const v = useVisual()
  const mesh = useRef<Mesh>(null)
  useFrame(() => {
    const m = mesh.current
    if (!m) return
    m.visible = v.obsidian && !v.hidden
    m.scale.setScalar(entitySize(v.pressure) * 0.7 * v.scaleMul)
    m.rotation.y = v.time * 0.1
  })
  return (
    <mesh ref={mesh} visible={false}>
      <dodecahedronGeometry args={[1, 1]} />
      <meshStandardMaterial color="#14101a" roughness={0.15} metalness={0.6} flatShading emissive="#3a1a10" emissiveIntensity={0.4} />
    </mesh>
  )
}

interface Particle {
  pos: Vector3
  vel: Vector3
  life: number
  max: number
  size: number
  color: Color
  gravity: number
}

interface Shard {
  pos: Vector3
  vel: Vector3
  rot: Vector3
  spin: Vector3
  size: number
}

/** 一次性特效：蒸汽、灰烬、冻结、溅水、点燃、爆燃、裂纹闪光、碎裂碎片 */
function Effects({ bridge }: { bridge: ArtifactBridge }) {
  const v = useVisual()
  const puffGroup = useRef<Group>(null)
  const shardMesh = useRef<InstancedMesh>(null)
  const flash = useRef<Sprite>(null)
  const particles = useRef<(Particle & { sprite: Sprite })[]>([])
  const shards = useRef<Shard[]>([])
  const shardGeo = useMemo(() => new DodecahedronGeometry(0.12, 0), [])
  const shardMat = useMemo(() => new MeshStandardMaterial({ color: '#cfeaff', flatShading: true, roughness: 0.3 }), [])
  const dummy = useMemo(() => new Object3D(), [])
  const rng = useMemo(() => createRng(99), [])
  const flashLevel = useRef(0)

  const spawn = (effect: ArtifactEffect, count: number, color: string, speed: number, gravity: number, size: number) => {
    const g = puffGroup.current
    if (!g) return
    const origin = new Vector3(...(effect.point ?? [0, 0.5, 0]))
    for (let i = 0; i < count; i++) {
      const sprite = new Sprite(
        new SpriteMaterial({ map: glowTexture(), color: new Color(color), transparent: true, depthWrite: false, blending: AdditiveBlending, toneMapped: false }),
      )
      g.add(sprite)
      const dir = new Vector3(...rng.direction())
      particles.current.push({
        sprite,
        pos: origin.clone(),
        vel: dir.multiplyScalar(speed * rng.range(0.4, 1)).add(new Vector3(0, speed * 0.5, 0)),
        life: 0,
        max: rng.range(0.8, 1.6),
        size,
        color: new Color(color),
        gravity,
      })
    }
  }

  useFrame((_, dt) => {
    const a = bridge.artifact
    if (a && a.effects.length) {
      const effects = a.effects.splice(0)
      for (const e of effects) {
        switch (e.kind) {
          case 'steam':
            spawn(e, 3, '#dfe8f0', 0.8, -0.6, 0.6)
            break
          case 'extinguished':
            spawn({ kind: 'steam', point: [0, 0.4, 0] }, 30, '#e8eef4', 1.4, -0.8, 0.9)
            flashLevel.current = 0.6
            break
          case 'ash':
            spawn(e, 10, '#6a5f58', 0.6, 0.6, 0.25)
            break
          case 'plant':
            spawn(e, 8, '#8cff7a', 0.5, -0.2, 0.2)
            break
          case 'freeze':
            spawn(e, 2, '#bfe8ff', 0.4, 0.3, 0.25)
            break
          case 'splash':
            spawn(e, 2, '#7cc8ff', 0.7, 2, 0.2)
            break
          case 'ignite':
          case 'flare':
            spawn(e, 18, '#ff8a2a', 1.6, -0.5, 0.45)
            flashLevel.current = 0.8
            break
          case 'crack':
            spawn(e, 12, FORM_COLORS[a.type], 1.2, 1.5, 0.2)
            flashLevel.current = 0.5
            break
          case 'shatter': {
            flashLevel.current = 1.4
            const r = entitySize(v.pressure) * v.scaleMul
            shardMat.color.set(a.type === 'ice' ? '#cfeaff' : a.type === 'stone' || a.state.obsidian ? (a.state.obsidian ? '#1a1520' : '#8d7866') : '#ff8a3c')
            shardMat.emissive.set(a.type === 'fire' && !a.state.obsidian ? '#ff4a12' : '#000000')
            shards.current = Array.from({ length: 60 }, () => {
              const d = new Vector3(...rng.direction())
              return {
                pos: d.clone().multiplyScalar(r * rng.range(0.2, 0.8)),
                vel: d.multiplyScalar(rng.range(2, 5)).add(new Vector3(0, 2, 0)),
                rot: new Vector3(),
                spin: new Vector3(rng.range(-6, 6), rng.range(-6, 6), rng.range(-6, 6)),
                size: rng.range(0.5, 1.6) * (0.6 + r * 0.4),
              }
            })
            spawn(e, 30, FORM_COLORS[a.type], 2.4, 1, 0.5)
            break
          }
        }
      }
    }

    // 粒子
    const g = puffGroup.current
    particles.current = particles.current.filter((p) => {
      p.life += dt
      if (p.life >= p.max) {
        g?.remove(p.sprite)
        p.sprite.material.dispose()
        return false
      }
      p.vel.y -= p.gravity * dt
      p.pos.addScaledVector(p.vel, dt)
      p.sprite.position.copy(p.pos)
      const t = p.life / p.max
      p.sprite.scale.setScalar(p.size * (0.6 + t))
      p.sprite.material.opacity = (1 - t) * 0.8
      return true
    })

    // 碎片：简单抛物线 + 地面反弹
    const m = shardMesh.current
    if (m) {
      m.visible = shards.current.length > 0 && !!a?.state.shattered
      const floor = GROUND_Y - ENTITY_Y + 0.05
      shards.current.forEach((s, i) => {
        s.vel.y -= 9.8 * dt
        s.pos.addScaledVector(s.vel, dt)
        if (s.pos.y < floor) {
          s.pos.y = floor
          s.vel.y *= -0.3
          s.vel.x *= 0.7
          s.vel.z *= 0.7
          s.spin.multiplyScalar(0.7)
        }
        s.rot.addScaledVector(s.spin, dt)
        dummy.position.copy(s.pos)
        dummy.rotation.set(s.rot.x, s.rot.y, s.rot.z)
        dummy.scale.setScalar(s.size)
        dummy.updateMatrix()
        m.setMatrixAt(i, dummy.matrix)
      })
      m.count = shards.current.length
      m.instanceMatrix.needsUpdate = true
    }

    // 闪光
    flashLevel.current = Math.max(0, flashLevel.current - dt * 2)
    v.flash = Math.max(v.flash, flashLevel.current)
    if (flash.current) {
      flash.current.visible = flashLevel.current > 0.01
      flash.current.scale.setScalar(2 + flashLevel.current * 4)
      flash.current.material.opacity = Math.min(1, flashLevel.current)
    }
  })

  return (
    <>
      <group ref={puffGroup} />
      <instancedMesh ref={shardMesh} args={[shardGeo, shardMat, 60]} frustumCulled={false} visible={false} />
      <sprite ref={flash} visible={false}>
        <spriteMaterial map={glowTexture()} color="#ffffff" transparent depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
      </sprite>
    </>
  )
}
