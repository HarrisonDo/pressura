/**
 * 冰晶簇：主晶先出现，副晶和小晶随压力陆续冒出、伸长；
 * 第 4 阶段起周围起霜雾，第 5 阶段内部透出冷光。
 */
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import {
  AdditiveBlending,
  Color,
  InstancedMesh,
  MeshPhysicalMaterial,
  Object3D,
  Quaternion,
  Vector3,
  type Group,
  type PointLight,
  type Sprite,
} from 'three'
import { generateIceCluster } from '../../core/artifact/ice'
import { smoothstep } from '../../core/lib/math'
import { createRng } from '../../core/lib/random'
import { prismGeometry } from '../geometry'
import { glowTexture } from '../textures'
import { useVisual } from '../VisualContext'
import { entitySize, formWeight, popIn } from '../visual'

const UP = new Vector3(0, 1, 0)

export function IceCluster({ seed }: { seed: number }) {
  const v = useVisual()
  const group = useRef<Group>(null)
  const mesh = useRef<InstancedMesh>(null)
  const light = useRef<PointLight>(null)
  const mist = useRef<(Sprite | null)[]>([])

  const crystals = useMemo(() => generateIceCluster(seed), [seed])
  const geometry = useMemo(() => prismGeometry(), [])
  const material = useMemo(
    () =>
      new MeshPhysicalMaterial({
        color: new Color('#dff3ff'),
        roughness: 0.08,
        metalness: 0,
        transmission: 0.82,
        thickness: 0.7,
        ior: 1.31,
        attenuationColor: new Color('#4aa3ff'),
        attenuationDistance: 0.9,
        clearcoat: 1,
        clearcoatRoughness: 0.08,
        emissive: new Color('#3f9dff'),
        emissiveIntensity: 0.08,
        flatShading: true,
        envMapIntensity: 1.6,
      }),
    [],
  )
  const orientations = useMemo(
    () =>
      crystals.map((c) => {
        const dir = new Vector3(...c.dir)
        const q = new Quaternion().setFromUnitVectors(UP, dir)
        return q.multiply(new Quaternion().setFromAxisAngle(UP, c.twist))
      }),
    [crystals],
  )
  const mistSpots = useMemo(() => {
    const rng = createRng(seed).fork('mist')
    return Array.from({ length: 6 }, (_, i) => ({
      angle: (i / 6) * Math.PI * 2 + rng.range(-0.3, 0.3),
      radius: rng.range(1.1, 1.6),
      y: rng.range(-0.6, 0.2),
      size: rng.range(1.6, 2.6),
    }))
  }, [seed])
  const dummy = useMemo(() => new Object3D(), [])

  useFrame(() => {
    const g = group.current
    const m = mesh.current
    if (!g || !m) return
    const w = formWeight(v, 'ice')
    g.visible = w > 0.001
    if (!g.visible) return

    const p = v.pressure
    const pulse = 1 + v.intensity * 0.03 + v.burst * 0.06
    g.scale.setScalar(entitySize(p) * popIn(w) * pulse)
    g.rotation.y = v.time * 0.08

    crystals.forEach((c, i) => {
      // 每根晶体在 appearAt 之后 0.12 的压力区间内长出来
      const grow = smoothstep(c.appearAt, c.appearAt + 0.12, p)
      const len = c.length * (0.3 + 0.7 * grow) * (0.75 + 0.25 * p)
      const rad = c.radius * grow
      dummy.position.set(c.base[0], c.base[1], c.base[2])
      dummy.quaternion.copy(orientations[i])
      dummy.scale.set(rad || 1e-4, grow > 0 ? len : 1e-4, rad || 1e-4)
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
    })
    m.instanceMatrix.needsUpdate = true

    // 第 5 阶段：内部冷光
    const inner = smoothstep(0.86, 1, p)
    material.emissiveIntensity = 0.08 + inner * (0.9 + v.intensity * 0.8) + v.flash * 0.4
    if (light.current) light.current.intensity = (inner * 6 + v.burst * 2) * w

    // 第 4 阶段起：霜雾
    const mistAmount = smoothstep(0.6, 0.9, p) * w
    mist.current.forEach((sprite, i) => {
      if (!sprite) return
      const spot = mistSpots[i]
      const a = spot.angle + v.time * 0.05
      sprite.position.set(Math.cos(a) * spot.radius, spot.y, Math.sin(a) * spot.radius)
      ;(sprite.material as { opacity: number }).opacity = mistAmount * 0.22
    })
  })

  return (
    <group ref={group} visible={false}>
      <instancedMesh ref={mesh} args={[geometry, material, crystals.length]} frustumCulled={false} />
      <pointLight ref={light} color="#7cc8ff" intensity={0} distance={4} />
      {mistSpots.map((spot, i) => (
        <sprite
          key={i}
          ref={(el) => {
            mist.current[i] = el
          }}
          scale={spot.size}
        >
          <spriteMaterial
            map={glowTexture()}
            color="#bfe4ff"
            transparent
            opacity={0}
            depthWrite={false}
            blending={AdditiveBlending}
          />
        </sprite>
      ))}
    </group>
  )
}
