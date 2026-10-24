import { OrbitControls } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import type { SessionSnapshot } from '../core/audio'
import { CameraRig } from './CameraRig'
import { Effects } from './Effects'
import { GrowthEntity } from './entities/GrowthEntity'
import { Atmosphere } from './environment/Atmosphere'
import { Ground } from './environment/Ground'
import { AmbientParticles } from './environment/Particles'
import { ArtifactLayer, type ArtifactBridge } from './interaction/ArtifactLayer'
import { ENTITY_Y } from './layout'
import { SpectrumRing } from './SpectrumRing'
import { VisualContext } from './VisualContext'
import { createVisualState, stepVisual, type VisualState } from './visual'

/** 场景只依赖这个最小接口，不直接依赖应用外壳 */
export interface LiveSource extends ArtifactBridge {
  snapshot: SessionSnapshot | null
  capture: (() => string) | null
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/**
 * 唯一的 WebGL 画布。生长、处置、画廊查看都在这一个上下文里切换内容。
 * interactive = 标本处置阶段：可以拖动旋转、点选标本。
 */
export function Stage({ live, seed, interactive }: { live: LiveSource; seed: number; interactive: boolean }) {
  const visual = useMemo(() => createVisualState(prefersReducedMotion()), [])

  return (
    <Canvas
      className="stage-canvas"
      dpr={[1, 2]}
      camera={{ position: [0, 0.6, 5.6], fov: 45, near: 0.1, far: 80 }}
      gl={{ antialias: false, powerPreference: 'high-performance', stencil: false, preserveDrawingBuffer: true }}
    >
      <VisualContext.Provider value={visual}>
        <Director live={live} visual={visual} />
        {interactive ? (
          <OrbitControls
            makeDefault
            target={[0, ENTITY_Y, 0]}
            enablePan={false}
            minDistance={3}
            maxDistance={10}
            maxPolarAngle={Math.PI * 0.62}
            enableDamping
          />
        ) : (
          <CameraRig />
        )}
        <Atmosphere />
        <Ground />
        <AmbientParticles />
        <GrowthEntity seed={seed} key={seed} />
        <SpectrumRing />
        <ArtifactLayer bridge={live} />
        <Effects />
        <Capture live={live} />
      </VisualContext.Provider>
    </Canvas>
  )
}

/** 每帧最先运行（优先级 -1）：把会话快照转成视觉状态 */
function Director({ live, visual }: { live: LiveSource; visual: VisualState }) {
  useFrame((_, dt) => stepVisual(visual, live.snapshot, Math.min(dt, 0.1)), -1)
  return null
}

/** 提供画廊缩略图截图：把当前画面缩到 360px 宽的 webp */
function Capture({ live }: { live: LiveSource }) {
  const gl = useThree((s) => s.gl)
  useEffect(() => {
    live.capture = () => {
      const src = gl.domElement
      const w = 360
      const h = Math.round((src.height / src.width) * w)
      const c = document.createElement('canvas')
      c.width = w
      c.height = h
      c.getContext('2d')?.drawImage(src, 0, 0, w, h)
      return c.toDataURL('image/webp', 0.75)
    }
    return () => {
      live.capture = null
    }
  }, [gl, live])
  return null
}
