/**
 * 起音 / 强突发检测：频谱通量超过自适应阈值即判为一次起音（一个音节、一声吼）。
 */
import type { AudioTuning } from './tuning'

export type OnsetKind = 'none' | 'onset' | 'burst'

type OnsetTuning = Pick<
  AudioTuning,
  'onsetTau' | 'onsetK' | 'onsetMinFlux' | 'onsetMinLoud' | 'onsetRefractory' | 'burstLoud'
>

export class OnsetDetector {
  private mean = 0
  private variance = 1
  private warmup = 0
  private lastOnset = Number.NEGATIVE_INFINITY
  private readonly tuning: OnsetTuning

  constructor(tuning: OnsetTuning) {
    this.tuning = tuning
  }

  update(flux: number, loud: number, time: number, dt: number): OnsetKind {
    const t = this.tuning
    // 先用"更新前"的统计量判断，避免尖峰把自己的阈值抬高
    const threshold = Math.max(t.onsetMinFlux, this.mean + t.onsetK * Math.sqrt(this.variance))

    let kind: OnsetKind = 'none'
    if (
      this.warmup >= 0.3 &&
      flux > threshold &&
      loud >= t.onsetMinLoud &&
      time - this.lastOnset >= t.onsetRefractory
    ) {
      kind = loud >= t.burstLoud ? 'burst' : 'onset'
      this.lastOnset = time
    }

    const a = 1 - Math.exp(-dt / t.onsetTau)
    const diff = flux - this.mean
    this.mean += a * diff
    this.variance = (1 - a) * (this.variance + a * diff * diff)
    this.warmup += dt
    return kind
  }
}
