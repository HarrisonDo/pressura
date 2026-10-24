/**
 * 环境底噪估计：开场先校准，之后缓慢自适应（环境变吵/变静都能跟上，但不会把人声当成底噪）。
 */
import { clamp, damp, percentile } from '../lib/math'
import type { AudioTuning } from './tuning'

type FloorTuning = Pick<
  AudioTuning,
  'floorMinDb' | 'floorMaxDb' | 'floorFallTau' | 'floorRiseTau' | 'floorRiseWindowDb'
>

export class NoiseFloor {
  floorDb: number
  private calibration: number[] = []
  private readonly tuning: FloorTuning

  constructor(tuning: FloorTuning, initialDb = -60) {
    this.tuning = tuning
    this.floorDb = clamp(initialDb, tuning.floorMinDb, tuning.floorMaxDb)
  }

  addCalibrationSample(levelDb: number): void {
    this.calibration.push(levelDb)
  }

  /** 用 20 分位数作为底噪：即使校准时有人在说话，也能取到说话间隙的电平 */
  finishCalibration(): number {
    if (this.calibration.length > 0) {
      this.floorDb = clamp(
        percentile(this.calibration, 0.2),
        this.tuning.floorMinDb,
        this.tuning.floorMaxDb,
      )
    }
    this.calibration = []
    return this.floorDb
  }

  track(levelDb: number, dt: number): number {
    const { floorFallTau, floorRiseTau, floorRiseWindowDb, floorMinDb, floorMaxDb } = this.tuning
    if (levelDb < this.floorDb) {
      this.floorDb = damp(this.floorDb, levelDb, floorFallTau, dt)
    } else if (levelDb < this.floorDb + floorRiseWindowDb) {
      this.floorDb = damp(this.floorDb, levelDb, floorRiseTau, dt)
    }
    this.floorDb = clamp(this.floorDb, floorMinDb, floorMaxDb)
    return this.floorDb
  }
}
