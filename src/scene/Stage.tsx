import { Canvas, useFrame } from '@react-three/fiber'
import { useMemo, useState } from 'react'
import type { SessionSnapshot } from '../core/audio'
import { freshSeed } from '../core/lib/random'
import { CameraRig } from './CameraRig'
import { Effects } from './Effects'
import { GrowthEntity } from './entities/GrowthEntity'
import { Atmosphere } from './environment/Atmosphere'
import { Ground } from './environment/Ground'
import { AmbientParticles } from './environment/Particles'
import { SpectrumRing } from './SpectrumRing'
import { VisualContext } from './VisualContext'
import { createVisualState, stepVisual, type VisualState } from './visual'

/** 场景只依赖这个最小接口，不直接依赖应用外壳 */
export interface LiveSource {
  snapshot: SessionSnapshot | null
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/**
 * 唯一的 WebGL 画布。主场景、凝结、处置、画廊查看器都在这一个上下文里切换内容。
 */
export function Stage({ live, seed }: { live: LiveSource; seed?: number }) {
  const visual = useMemo(() => createVisualState(prefersReducedMotion()), [])
  const [fallbackSeed] = useState(() => freshSeed())

  return (
    <Canvas
      className="stage-canvas"
      dpr={[1, 2]}
      camera={{ position: [0, 0.6, 5.6], fov: 45, near: 0.1, far: 80 }}
      gl={{ antialias: false, powerPreference: 'high-performance', stencil: false }}
    >
      <VisualContext.Provider value={visual}>
        <Director live={live} visual={visual} />
        <CameraRig />
        <Atmosphere />
        <Ground />
        <AmbientParticles />
        <GrowthEntity seed={seed ?? fallbackSeed} />
        <SpectrumRing />
        <Effects />
      </VisualContext.Provider>
    </Canvas>
  )
}

/** 每帧最先运行（优先级 -1）：把会话快照转成视觉状态 */
function Director({ live, visual }: { live: LiveSource; visual: VisualState }) {
  useFrame((_, dt) => stepVisual(visual, live.snapshot, Math.min(dt, 0.1)), -1)
  return null
}
