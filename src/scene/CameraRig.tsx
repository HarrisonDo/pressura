/**
 * 镜头：缓慢漂移；实体越大越往后退；压力越高、声音越响，镜头越抖（减少动态效果时关闭抖动）。
 */
import { useFrame } from '@react-three/fiber'
import { useMemo } from 'react'
import { Vector3 } from 'three'
import { damp } from '../core/lib/math'
import { ENTITY_Y } from './layout'
import { useVisual } from './VisualContext'

export function CameraRig() {
  const v = useVisual()
  const target = useMemo(() => new Vector3(0, ENTITY_Y + 0.05, 0), [])
  const state = useMemo(() => ({ distance: 5.6 }), [])

  useFrame(({ camera }, dt) => {
    state.distance = damp(state.distance, 5.6 + v.pressure * 1.3, 0.8, dt)
    const azimuth = Math.sin(v.time * 0.06) * 0.14
    const elevation = 0.1 + Math.sin(v.time * 0.045) * 0.03
    camera.position.set(
      Math.sin(azimuth) * state.distance,
      target.y + Math.sin(elevation) * state.distance,
      Math.cos(azimuth) * state.distance,
    )

    if (!v.reducedMotion) {
      const amp = 0.028 * v.pressure * v.pressure * (0.3 + v.intensity) + v.burst * 0.035
      camera.position.x += Math.sin(v.time * 31) * Math.sin(v.time * 7.7) * amp
      camera.position.y += Math.sin(v.time * 27 + 1.3) * Math.sin(v.time * 5.1) * amp
    }
    camera.lookAt(target)
  })

  return null
}
