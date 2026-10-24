/**
 * 背景、雾和灯光：随材质和压力变化。冰冷蓝、石暖褐、火暗红；压力越高越压抑。
 */
import { Environment, Lightformer } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Color, FogExp2, type DirectionalLight, type HemisphereLight } from 'three'
import { useVisual } from '../VisualContext'
import { blendColor, blendNumber } from './palettes'

export function Atmosphere() {
  const v = useVisual()
  const scene = useThree((s) => s.scene)
  const background = useMemo(() => new Color('#07070d'), [])
  const fog = useMemo(() => new FogExp2('#0c0b16', 0.045), [])
  const hemi = useRef<HemisphereLight>(null)
  const key = useRef<DirectionalLight>(null)
  const rim = useRef<DirectionalLight>(null)
  const tmp = useMemo(() => new Color(), [])

  useEffect(() => {
    scene.background = background
    scene.fog = fog
    return () => {
      scene.background = null
      scene.fog = null
    }
  }, [scene, background, fog])

  useFrame(() => {
    blendColor(background, v, (p) => p.background)
    blendColor(fog.color, v, (p) => p.fog)
    fog.density = blendNumber(v, (p) => p.fogDensity) * (1 - v.calm * 0.55)

    if (hemi.current) {
      blendColor(hemi.current.color, v, (p) => p.sky)
      blendColor(hemi.current.groundColor, v, (p) => p.groundLight)
      hemi.current.intensity = 0.55 - v.pressure * 0.2
    }
    if (key.current) {
      blendColor(key.current.color, v, (p) => p.key)
      key.current.intensity = 1.6 - v.pressure * 0.5 + v.flash * 1.2
    }
    if (rim.current) {
      blendColor(tmp, v, (p) => p.rim)
      rim.current.color.copy(tmp)
      rim.current.intensity = 1.8 + v.pressure * 1.6 + v.burst * 1.5
    }
  })

  return (
    <>
      <hemisphereLight ref={hemi} intensity={0.5} />
      <directionalLight ref={key} position={[3, 5, 4]} intensity={1.5} />
      <directionalLight ref={rim} position={[-3, 2, -5]} intensity={2} />
      {/* 程序生成的环境反射：只渲染一次，给冰的透射和地面提供高光 */}
      <Environment resolution={256} frames={1} environmentIntensity={0.6}>
        <Lightformer form="ring" intensity={2.5} position={[0, 6, -2]} scale={6} />
        <Lightformer form="rect" intensity={1.5} position={[-6, 1, 1]} rotation-y={Math.PI / 2} scale={[8, 3, 1]} />
        <Lightformer form="rect" intensity={1} position={[6, 2, -1]} rotation-y={-Math.PI / 2} scale={[6, 2, 1]} />
        <Lightformer form="circle" intensity={0.8} position={[0, -4, 3]} scale={4} />
      </Environment>
    </>
  )
}
