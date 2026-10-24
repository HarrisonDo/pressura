/**
 * 场景中央的生长实体：种子 / 冰 / 石 / 火 叠在同一个锚点上，按 formWeight 交叉过渡。
 * 起始页时锚点浮在标题上方，开始录制后缓缓落到画面中央。
 */
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { AdditiveBlending, Color, type Group, type Mesh, type MeshBasicMaterial } from 'three'
import { damp } from '../../core/lib/math'
import { FORM_COLORS } from '../../core/palette'
import { ENTITY_Y, IDLE_Y } from '../layout'
import { useVisual } from '../VisualContext'
import { entitySize } from '../visual'
import { FireFlame } from './FireFlame'
import { IceCluster } from './IceCluster'
import { Seed } from './Seed'
import { StoneRock } from './StoneRock'

export function GrowthEntity({ seed }: { seed: number }) {
  const v = useVisual()
  const anchor = useRef<Group>(null)

  useFrame((_, dt) => {
    const a = anchor.current
    if (!a) return
    const target = v.mode === 'idle' ? IDLE_Y : ENTITY_Y
    a.position.y = damp(a.position.y, target, 0.6, dt)
    // 悬浮的轻微起伏
    a.position.y += v.reducedMotion ? 0 : Math.sin(v.time * 0.9) * 0.0015
  })

  return (
    <group ref={anchor} position={[0, IDLE_Y, 0]}>
      <Seed />
      <IceCluster seed={seed} />
      <StoneRock seed={seed} />
      <FireFlame seed={seed} />
      <TransitionBurst />
    </group>
  )
}

/** 定型 / 转变时向外扩散的光环 */
function TransitionBurst() {
  const v = useVisual()
  const ring = useRef<Mesh>(null)
  const color = useMemo(() => new Color(), [])

  useFrame(({ camera }) => {
    const r = ring.current
    if (!r) return
    const active = v.from !== v.form && v.morph < 1
    r.visible = active
    if (!active) return
    const t = v.morph
    r.quaternion.copy(camera.quaternion)
    r.scale.setScalar(0.3 + t * (entitySize(v.pressure) * 3.2))
    const mat = r.material as MeshBasicMaterial
    color.set(FORM_COLORS[v.form])
    mat.color.copy(color).multiplyScalar(2.5)
    mat.opacity = (1 - t) ** 2
  })

  return (
    <mesh ref={ring} visible={false}>
      <ringGeometry args={[0.92, 1, 96]} />
      <meshBasicMaterial transparent depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
    </mesh>
  )
}
