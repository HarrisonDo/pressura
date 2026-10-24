/**
 * 合成声音特征：给模拟模式（没有麦克风时按住空格"呐喊"）和单测用。
 * 直接产出 FeatureFrame，不经过真实音频。
 *
 * 三种风格的设计目标（对应 classifier 的打分规则）：
 *   ice   低沉平稳的叹气/闷声：高出底噪约 14 dB，起伏小，几乎没有起音
 *   stone 急促碎碎念：每秒约 4 个音节，中等响度，断断续续
 *   fire  吼叫：高出底噪约 46 dB，乐句开头和重音处有强突发，声音偏亮
 */
import type { EmotionType } from '../types'
import type { Rng } from '../lib/random'
import type { FeatureFrame } from './features'

export interface VoicePattern {
  /** drive 0~1：0 = 只有底噪，1 = 全力发声 */
  next(dt: number, drive: number): FeatureFrame
}

const NOISE_FLUX = (rng: Rng) => rng.range(0.6, 1.8)

export function createVoicePattern(style: EmotionType, rng: Rng, floorDb = -62): VoicePattern {
  let t = 0
  let wasVoiced = false
  // 碎碎念 / 吼叫的分段状态
  let segmentLeft = 0
  let segmentVoiced = false
  let accentLeft = 0

  const frame = (levelDb: number, centroid: number, flux: number): FeatureFrame => ({
    levelDb,
    centroid,
    flux,
    bands: null,
  })

  const silent = () => frame(floorDb + rng.range(-1, 1), rng.range(1500, 3500), NOISE_FLUX(rng))

  return {
    next(dt, drive) {
      t += dt
      if (drive <= 0.01) {
        wasVoiced = false
        return silent()
      }

      switch (style) {
        case 'ice': {
          // 每 4 秒有一次 0.5 秒的换气停顿
          const breathing = t % 4 > 3.5
          if (breathing) {
            wasVoiced = false
            return silent()
          }
          const level = floorDb + drive * (14 + 3 * Math.sin(t * Math.PI * 0.5)) + rng.range(-0.8, 0.8)
          const flux = wasVoiced ? NOISE_FLUX(rng) : 9
          wasVoiced = true
          return frame(level, rng.range(450, 580), flux)
        }

        case 'stone': {
          segmentLeft -= dt
          let onset = false
          if (segmentLeft <= 0) {
            segmentVoiced = !segmentVoiced
            segmentLeft = segmentVoiced ? rng.range(0.11, 0.16) : rng.range(0.08, 0.18)
            onset = segmentVoiced
          }
          if (!segmentVoiced) return silent()
          const level = floorDb + drive * (30 + rng.range(-4, 4))
          return frame(level, rng.range(900, 1150), onset ? rng.range(12, 18) : NOISE_FLUX(rng))
        }

        case 'fire': {
          segmentLeft -= dt
          let onset = false
          if (segmentLeft <= 0) {
            segmentVoiced = !segmentVoiced
            segmentLeft = segmentVoiced ? rng.range(0.8, 1.5) : rng.range(0.2, 0.4)
            onset = segmentVoiced
            accentLeft = rng.range(0.4, 0.6)
          }
          if (!segmentVoiced) return silent()
          accentLeft -= dt
          if (accentLeft <= 0) {
            onset = true
            accentLeft = rng.range(0.4, 0.6)
          }
          const level = floorDb + drive * (46 + rng.range(-4, 4))
          return frame(level, rng.range(1600, 1900), onset ? rng.range(20, 25) : NOISE_FLUX(rng))
        }
      }
    },
  }
}
