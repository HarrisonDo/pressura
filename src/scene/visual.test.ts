import { describe, expect, it } from 'vitest'
import { EmotionSession } from '../core/audio'
import { createVisualState, entitySize, formWeight, MORPH_SECONDS, stepVisual } from './visual'

const DT = 1 / 60

describe('stepVisual', () => {
  it('没有会话时是 idle 种子', () => {
    const v = createVisualState()
    stepVisual(v, null, DT)
    expect(v.mode).toBe('idle')
    expect(v.form).toBe('seed')
    expect(formWeight(v, 'seed')).toBe(1)
  })

  it('材质变化时交叉过渡，结束后旧材质权重为 0', () => {
    const v = createVisualState()
    const session = new EmotionSession()
    const snap = session.snapshot
    stepVisual(v, snap, DT)
    snap.form = 'ice'
    stepVisual(v, snap, DT)
    expect(v.from).toBe('seed')
    expect(v.flash).toBeGreaterThan(0.9)
    const midSeed = formWeight(v, 'seed')
    expect(midSeed).toBeGreaterThan(0.9)
    for (let t = 0; t < MORPH_SECONDS / 2; t += DT) stepVisual(v, snap, DT)
    expect(formWeight(v, 'ice')).toBeGreaterThan(0.3)
    expect(formWeight(v, 'seed')).toBeGreaterThan(0.3)
    for (let t = 0; t < MORPH_SECONDS; t += DT) stepVisual(v, snap, DT)
    expect(formWeight(v, 'ice')).toBe(1)
    expect(formWeight(v, 'seed')).toBe(0)
    expect(formWeight(v, 'fire')).toBe(0)
  })

  it('新的强突发产生一次脉冲，然后衰减', () => {
    const v = createVisualState()
    const snap = new EmotionSession().snapshot
    stepVisual(v, snap, DT)
    snap.burstCount = 1
    stepVisual(v, snap, DT)
    expect(v.burst).toBeGreaterThan(0.85)
    for (let i = 0; i < 60; i++) stepVisual(v, snap, DT)
    expect(v.burst).toBeLessThan(0.01)
  })

  it('压力平滑跟随，进入新阶段时闪光', () => {
    const v = createVisualState()
    const snap = new EmotionSession().snapshot
    snap.pressure = 0.5
    for (let i = 0; i < 60 * 3; i++) stepVisual(v, snap, DT)
    expect(v.pressure).toBeCloseTo(0.5, 2)
    expect(v.stage).toBe(2)
  })
})

describe('entitySize', () => {
  it('单调递增，范围合理', () => {
    let prev = 0
    for (let p = 0; p <= 1; p += 0.01) {
      const s = entitySize(p)
      expect(s).toBeGreaterThanOrEqual(prev)
      prev = s
    }
    expect(entitySize(0.15)).toBeCloseTo(0.45, 5)
    expect(entitySize(1)).toBeCloseTo(1.55, 5)
  })
})
