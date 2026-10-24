/**
 * 后期：泛光（火、冰的冷光、熔岩、频谱环靠它发光）、色差（高压时画面"撕裂"）、暗角、色调映射。
 */
import { useFrame } from '@react-three/fiber'
import { Bloom, ChromaticAberration, EffectComposer, ToneMapping, Vignette } from '@react-three/postprocessing'
import { useRef } from 'react'
import { ToneMappingMode, type BloomEffect, type ChromaticAberrationEffect, type VignetteEffect } from 'postprocessing'
import { useVisual } from './VisualContext'

export function Effects() {
  const v = useVisual()
  const bloom = useRef<BloomEffect>(null)
  const aberration = useRef<ChromaticAberrationEffect>(null)
  const vignette = useRef<VignetteEffect>(null)

  useFrame(() => {
    if (bloom.current) bloom.current.intensity = 0.85 + v.flash * 1.6 + v.intensity * 0.35 + v.burst * 0.5
    if (aberration.current) {
      const amount = v.reducedMotion ? 0 : v.pressure * v.pressure * (0.0004 + v.intensity * 0.0016) + v.burst * 0.0012
      aberration.current.offset.set(amount, amount * 0.6)
    }
    if (vignette.current) vignette.current.darkness = 0.55 + v.pressure * 0.3
  })

  return (
    <EffectComposer multisampling={4}>
      <Bloom ref={bloom} mipmapBlur luminanceThreshold={0.7} luminanceSmoothing={0.25} intensity={0.85} radius={0.72} />
      <ChromaticAberration ref={aberration} radialModulation modulationOffset={0.25} />
      <Vignette ref={vignette} offset={0.28} darkness={0.55} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  )
}
