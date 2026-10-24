/**
 * 压力模型：只增不减。声音越响长得越快，但再轻的声音也会慢慢累积；强突发额外加成。
 */
import { clamp } from '../lib/math'
import type { AudioTuning } from './tuning'

type LoudnessTuning = Pick<AudioTuning, 'gateDb' | 'rangeDb'>
type PressureTuning = Pick<AudioTuning, 'baseRate' | 'quietShare' | 'curve' | 'burstBonus'>

/** 相对底噪的发声强度 0~1；低于门限时为 0 */
export function loudnessFrom(levelDb: number, floorDb: number, tuning: LoudnessTuning): number {
  return clamp((levelDb - floorDb - tuning.gateDb) / tuning.rangeDb)
}

/** 某个强度下每秒的压力增长量 */
export function pressureRate(loud: number, tuning: PressureTuning): number {
  if (loud <= 0) return 0
  return tuning.baseRate * (tuning.quietShare + (1 - tuning.quietShare) * loud ** tuning.curve)
}

export class PressureModel {
  pressure = 0
  private readonly tuning: PressureTuning

  constructor(tuning: PressureTuning) {
    this.tuning = tuning
  }

  update(loud: number, burst: boolean, dt: number): number {
    this.pressure += pressureRate(loud, this.tuning) * dt
    if (burst) this.pressure += this.tuning.burstBonus
    this.pressure = Math.min(1, this.pressure)
    return this.pressure
  }
}
