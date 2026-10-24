import { Canvas, useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { Color, type Mesh, type MeshStandardMaterial } from 'three'
import type { SessionSnapshot } from '../core/audio'
import { damp } from '../core/lib/math'
import { FORM_COLORS } from '../core/palette'

/** 场景只依赖这个最小接口，不直接依赖应用外壳 */
export interface LiveSource {
  snapshot: SessionSnapshot | null
}

/**
 * 唯一的 WebGL 画布。主场景、凝结、处置、画廊查看器都在这一个上下文里切换内容。
 */
export function Stage({ live }: { live: LiveSource }) {
  return (
    <Canvas
      className="stage-canvas"
      dpr={[1, 2]}
      camera={{ position: [0, 0.6, 5], fov: 45, near: 0.1, far: 100 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
    >
      <color attach="background" args={['#06060a']} />
      <ambientLight intensity={0.4} />
      <directionalLight position={[3, 4, 2]} intensity={1.2} />
      <PressureProbe live={live} />
    </Canvas>
  )
}

/** M1 临时探针：大小跟随压力、颜色跟随材质。M2 换成真正的生长实体。 */
function PressureProbe({ live }: { live: LiveSource }) {
  const mesh = useRef<Mesh>(null)
  const material = useRef<MeshStandardMaterial>(null)
  const color = useMemo(() => new Color(), [])

  useFrame((_, dt) => {
    const s = live.snapshot
    const m = mesh.current
    if (!m || !material.current) return
    const pressure = s?.pressure ?? 0
    const intensity = s?.intensity ?? 0
    const target = 0.15 + pressure * 1.1 + intensity * 0.1
    m.scale.setScalar(damp(m.scale.x, target, 0.15, dt))
    m.rotation.y += dt * (0.25 + intensity * 1.5)
    color.set(FORM_COLORS[s?.form ?? 'seed'])
    material.current.color.lerp(color, 1 - Math.exp(-dt / 0.3))
    material.current.emissive.copy(material.current.color).multiplyScalar(0.35 + intensity * 0.6)
  })

  return (
    <mesh ref={mesh}>
      <icosahedronGeometry args={[1, 1]} />
      <meshStandardMaterial ref={material} color={FORM_COLORS.seed} flatShading />
    </mesh>
  )
}
