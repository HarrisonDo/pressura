/**
 * 环绕实体的频谱环：64 段频带左右镜像成 128 根光条，始终面向镜头。
 * 模拟输入没有频谱时，用强度合成一个起伏的环。
 */
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { AdditiveBlending, Color, InstancedMesh, MeshBasicMaterial, Object3D, type Group } from 'three'
import { BAND_COUNT } from '../core/audio/features'
import { damp } from '../core/lib/math'
import { FORM_COLORS } from '../core/palette'
import type { GrowthForm } from '../core/types'
import { ENTITY_Y } from './layout'
import { useVisual } from './VisualContext'
import { entitySize, formWeight } from './visual'

const BARS = BAND_COUNT * 2
const FORMS: GrowthForm[] = ['seed', 'ice', 'stone', 'fire']

export function SpectrumRing() {
  const v = useVisual()
  const group = useRef<Group>(null)
  const mesh = useRef<InstancedMesh>(null)
  const smoothed = useMemo(() => new Float32Array(BAND_COUNT), [])
  const dummy = useMemo(() => new Object3D(), [])
  const material = useMemo(
    () =>
      new MeshBasicMaterial({
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        toneMapped: false,
      }),
    [],
  )
  const tmp = useMemo(() => new Color(), [])
  const radius = useRef(0.8)
  const presence = useRef(0)

  useFrame(({ camera }, dt) => {
    const g = group.current
    const m = mesh.current
    if (!g || !m) return
    presence.current = damp(presence.current, v.mode === 'live' ? 1 : 0, 0.5, dt)
    g.visible = presence.current > 0.01
    if (!g.visible) return
    g.quaternion.copy(camera.quaternion)
    g.position.y = ENTITY_Y

    let peak = 0
    for (let i = 0; i < BAND_COUNT; i++) peak = Math.max(peak, v.bands[i])
    const synthetic = peak < 0.01
    for (let i = 0; i < BAND_COUNT; i++) {
      const target = synthetic
        ? v.intensity * (0.35 + 0.35 * Math.sin(i * 0.45 + v.time * 6) * Math.sin(i * 0.17 - v.time * 3))
        : v.bands[i]
      smoothed[i] = damp(smoothed[i], Math.max(0, target), target > smoothed[i] ? 0.03 : 0.12, dt)
    }

    const base = v.form === 'seed' ? 0.55 : entitySize(v.pressure) * 1.25 + 0.25
    radius.current = damp(radius.current, base, 0.4, dt)
    for (let i = 0; i < BARS; i++) {
      const band = smoothed[i < BAND_COUNT ? i : BARS - 1 - i]
      const angle = (i / BARS) * Math.PI * 2 + Math.PI / 2
      const len = 0.03 + band * 0.6
      const r = radius.current + len / 2
      dummy.position.set(Math.cos(angle) * r, Math.sin(angle) * r, 0)
      dummy.rotation.set(0, 0, angle - Math.PI / 2)
      dummy.scale.set(0.014, len, 0.014)
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
    }
    m.instanceMatrix.needsUpdate = true

    material.color.setRGB(0, 0, 0)
    for (const form of FORMS) {
      const w = formWeight(v, form)
      if (w > 0) material.color.add(tmp.set(FORM_COLORS[form]).multiplyScalar(w))
    }
    material.color.multiplyScalar(1.6)
    material.opacity = presence.current * (0.18 + v.intensity * 0.7)
  })

  return (
    <group ref={group}>
      <instancedMesh ref={mesh} args={[undefined, material, BARS]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>
    </group>
  )
}
