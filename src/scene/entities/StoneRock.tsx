/**
 * 石头：定型时是一把砂砾，聚拢成卵石 → 粗石 → 带裂缝的巨岩 → 裂缝里透出熔岩红光。
 * 形态用 morph target 平滑过渡；发声时整块石头焦躁地震颤。
 */
import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import {
  Color,
  DodecahedronGeometry,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
  Vector3,
  type Group,
  type Mesh,
  type PointLight,
} from 'three'
import { smoothstep } from '../../core/lib/math'
import { createRng } from '../../core/lib/random'
import { buildStoneGeometry, createStoneMaterial } from '../geometry'
import { useVisual } from '../VisualContext'
import { entitySize, formWeight, popIn } from '../visual'

export function StoneRock({ seed }: { seed: number }) {
  const v = useVisual()
  const group = useRef<Group>(null)
  const rock = useRef<Mesh>(null)
  const gravel = useRef<InstancedMesh>(null)
  const light = useRef<PointLight>(null)

  const geometry = useMemo(() => buildStoneGeometry(seed), [seed])
  const { material, uniforms } = useMemo(() => createStoneMaterial(), [])
  const gravelGeometry = useMemo(() => new DodecahedronGeometry(1, 0), [])
  const gravelMaterial = useMemo(
    () => new MeshStandardMaterial({ color: new Color('#8d7866'), roughness: 1, flatShading: true }),
    [],
  )
  const pebbles = useMemo(() => {
    const rng = createRng(seed).fork('gravel')
    return Array.from({ length: 10 }, () => ({
      dir: new Vector3(...rng.direction()),
      radius: rng.range(0.7, 1.3),
      size: rng.range(0.14, 0.26),
      spin: rng.range(0.5, 2),
    }))
  }, [seed])
  const dummy = useMemo(() => new Object3D(), [])

  // R3F 是先 new Mesh() 再赋 geometry，morph 权重数组需要手动初始化
  useLayoutEffect(() => {
    rock.current?.updateMorphTargets()
  }, [geometry])

  useFrame(() => {
    const g = group.current
    const r = rock.current
    if (!g || !r) return
    const w = formWeight(v, 'stone')
    g.visible = w > 0.001 && !v.hidden
    if (!g.visible) return

    const p = v.pressure
    // 焦虑：发声时的高频震颤
    const tremor = v.reducedMotion ? 0 : (v.intensity * 0.025 + v.burst * 0.04) * entitySize(p)
    g.position.set(
      Math.sin(v.time * 47) * tremor,
      Math.sin(v.time * 53 + 1) * tremor,
      Math.sin(v.time * 41 + 2) * tremor,
    )
    g.scale.setScalar(entitySize(p) * popIn(w) * v.scaleMul)
    g.rotation.y = v.time * 0.06

    // 砂砾聚拢成石头
    const gather = smoothstep(0.15, 0.36, p)
    r.scale.setScalar(0.35 + 0.65 * gather)
    r.rotation.x = 0.3
    const influences = r.morphTargetInfluences
    if (influences) {
      influences[0] = smoothstep(0.3, 0.6, p)
      influences[1] = smoothstep(0.68, 0.9, p)
    }
    uniforms.uCrackDark.value = smoothstep(0.62, 0.82, p)
    uniforms.uLava.value = smoothstep(0.86, 1, p) * (1 + v.intensity * 0.8 + v.burst)
    uniforms.uTime.value = v.time
    if (light.current) light.current.intensity = uniforms.uLava.value * 5 * w

    const gm = gravel.current
    if (gm) {
      gm.visible = gather < 1
      pebbles.forEach((pb, i) => {
        const radius = pb.radius * (1 - gather * 0.75)
        dummy.position.copy(pb.dir).multiplyScalar(radius)
        dummy.rotation.set(v.time * pb.spin, v.time * pb.spin * 0.7, 0)
        dummy.scale.setScalar(pb.size * (1 - gather))
        dummy.updateMatrix()
        gm.setMatrixAt(i, dummy.matrix)
      })
      gm.instanceMatrix.needsUpdate = true
    }
  })

  return (
    <group ref={group} visible={false}>
      <mesh ref={rock} geometry={geometry} material={material} />
      <instancedMesh ref={gravel} args={[gravelGeometry, gravelMaterial, pebbles.length]} frustumCulled={false} />
      <pointLight ref={light} color="#ff6a2a" intensity={0} distance={5} />
    </group>
  )
}
