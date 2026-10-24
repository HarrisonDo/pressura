import { describe, expect, it } from 'vitest'
import { DEFAULT_TUNING } from './tuning'
import { loudnessFrom, pressureRate, PressureModel } from './pressure'
import { OnsetDetector } from './onset'
import { NoiseFloor } from './noiseFloor'

const T = DEFAULT_TUNING
const DT = 1 / 60

describe('loudnessFrom', () => {
  it('低于门限为 0，门限 + 量程为 1', () => {
    expect(loudnessFrom(-60 + T.gateDb - 1, -60, T)).toBe(0)
    expect(loudnessFrom(-60 + T.gateDb + T.rangeDb, -60, T)).toBe(1)
    expect(loudnessFrom(0, -60, T)).toBe(1)
    expect(loudnessFrom(-60 + T.gateDb + T.rangeDb / 2, -60, T)).toBeCloseTo(0.5, 5)
  })
})

describe('PressureModel', () => {
  it('越响长得越快，安静不增长', () => {
    expect(pressureRate(0, T)).toBe(0)
    expect(pressureRate(0.2, T)).toBeLessThan(pressureRate(0.6, T))
    expect(pressureRate(0.6, T)).toBeLessThan(pressureRate(1, T))
  })

  it('低语也能慢慢长：至少有满强度速度的 quietShare', () => {
    expect(pressureRate(0.01, T)).toBeGreaterThanOrEqual(T.baseRate * T.quietShare)
  })

  it('只增不减，封顶 1', () => {
    const model = new PressureModel(T)
    let prev = 0
    for (let i = 0; i < 60 * 40; i++) {
      const loud = i % 120 < 60 ? 1 : 0
      const p = model.update(loud, i % 30 === 0, DT)
      expect(p).toBeGreaterThanOrEqual(prev)
      expect(p).toBeLessThanOrEqual(1)
      prev = p
    }
    expect(prev).toBe(1)
  })

  it('满强度持续呐喊约 15 秒灌满（不计突发）', () => {
    const model = new PressureModel(T)
    let seconds = 0
    while (model.pressure < 1 && seconds < 60) {
      model.update(1, false, DT)
      seconds += DT
    }
    expect(seconds).toBeGreaterThan(13)
    expect(seconds).toBeLessThan(17)
  })
})

describe('OnsetDetector', () => {
  function warmed() {
    const d = new OnsetDetector(T)
    let time = 0
    for (let i = 0; i < 60; i++) {
      d.update(1, 0.5, time, DT)
      time += DT
    }
    return { d, time }
  }

  it('平稳通量下没有起音，尖峰触发起音', () => {
    const { d, time } = warmed()
    expect(d.update(1.1, 0.5, time, DT)).toBe('none')
    expect(d.update(15, 0.5, time + DT, DT)).toBe('onset')
  })

  it('强度超过 burstLoud 时记为强突发', () => {
    const { d, time } = warmed()
    expect(d.update(20, 0.9, time, DT)).toBe('burst')
  })

  it('不应期内不重复触发', () => {
    const { d, time } = warmed()
    expect(d.update(15, 0.5, time, DT)).toBe('onset')
    expect(d.update(15, 0.5, time + 0.05, DT)).toBe('none')
    expect(d.update(30, 0.5, time + 0.2, DT)).toBe('onset')
  })

  it('太轻的声音不算起音', () => {
    const { d, time } = warmed()
    expect(d.update(15, 0.05, time, DT)).toBe('none')
  })
})

describe('NoiseFloor', () => {
  it('校准取 20 分位数，不被说话声带高', () => {
    const floor = new NoiseFloor(T)
    for (let i = 0; i < 70; i++) floor.addCalibrationSample(-65 + (i % 3) * 0.5)
    for (let i = 0; i < 20; i++) floor.addCalibrationSample(-25)
    expect(floor.finishCalibration()).toBeCloseTo(-65, 0)
  })

  it('环境变安静时快速下探', () => {
    const floor = new NoiseFloor(T, -50)
    for (let i = 0; i < 60 * 3; i++) floor.track(-62, DT)
    expect(floor.floorDb).toBeLessThan(-61)
  })

  it('持续说话不会把底噪抬上去', () => {
    const floor = new NoiseFloor(T, -60)
    for (let i = 0; i < 60 * 20; i++) floor.track(-30, DT)
    expect(floor.floorDb).toBeCloseTo(-60, 5)
  })

  it('环境略变吵时缓慢上浮', () => {
    const floor = new NoiseFloor(T, -60)
    for (let i = 0; i < 60 * 30; i++) floor.track(-56, DT)
    expect(floor.floorDb).toBeGreaterThan(-57)
  })
})
