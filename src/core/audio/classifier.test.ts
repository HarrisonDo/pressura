import { describe, expect, it } from 'vitest'
import {
  computeStats,
  EmotionTracker,
  scoreEmotions,
  StatsAccumulator,
  topEmotion,
  type EmotionScores,
  type FrameRecord,
  type VoiceStats,
} from './classifier'
import { DEFAULT_TUNING } from './tuning'

const stats = (s: Partial<VoiceStats>): VoiceStats => ({
  spanSeconds: 10,
  voicedSeconds: 8,
  meanLoud: 0.5,
  loudStd: 0.1,
  centroidNorm: 0.4,
  onsetRate: 1.5,
  burstRate: 0,
  voicedRatio: 0.8,
  onsetCount: 15,
  burstCount: 0,
  ...s,
})

describe('scoreEmotions', () => {
  it('低语 / 叹气 → 冰', () => {
    const s = stats({ meanLoud: 0.15, loudStd: 0.06, onsetRate: 0.8, voicedRatio: 0.7, centroidNorm: 0.8 })
    expect(topEmotion(scoreEmotions(s))).toBe('ice')
  })

  it('急促碎碎念 → 石', () => {
    const s = stats({ meanLoud: 0.5, loudStd: 0.18, onsetRate: 3, voicedRatio: 0.6, burstRate: 0.1, centroidNorm: 0.45 })
    expect(topEmotion(scoreEmotions(s))).toBe('stone')
  })

  it('吼叫 → 火', () => {
    const s = stats({ meanLoud: 0.8, loudStd: 0.2, onsetRate: 1.5, voicedRatio: 0.8, burstRate: 0.6, centroidNorm: 0.65 })
    expect(topEmotion(scoreEmotions(s))).toBe('fire')
  })

  it('没有发声时全为 0', () => {
    expect(scoreEmotions(stats({ voicedSeconds: 0 }))).toEqual({ ice: 0, stone: 0, fire: 0 })
  })
})

describe('StatsAccumulator 与 computeStats 一致', () => {
  it('同一组记录得到相同统计', () => {
    const records: FrameRecord[] = []
    for (let i = 0; i < 600; i++) {
      const voiced = i > 30 && i % 20 < 12
      records.push({
        t: i / 60,
        dt: 1 / 60,
        loud: voiced ? 0.3 + (i % 7) * 0.05 : 0,
        centroidNorm: voiced ? 0.5 : 0,
        voiced,
        onset: voiced && i % 20 === 0,
        burst: false,
      })
    }
    const acc = new StatsAccumulator()
    records.forEach((r) => acc.add(r))
    const a = acc.result()
    const b = computeStats(records)
    expect(a.meanLoud).toBeCloseTo(b.meanLoud, 10)
    expect(a.loudStd).toBeCloseTo(b.loudStd, 10)
    expect(a.onsetCount).toBe(b.onsetCount)
    // 第一次发声（i = 31）之前的静音不计入
    expect(a.spanSeconds).toBeCloseTo((600 - 31) / 60, 5)
    expect(a.voicedRatio).toBeGreaterThan(0.5)
    expect(a.voicedRatio).toBeLessThan(0.7)
  })
})

describe('EmotionTracker', () => {
  const ice: EmotionScores = { ice: 0.9, stone: 0.2, fire: 0.1 }
  const fire: EmotionScores = { ice: 0.1, stone: 0.2, fire: 0.9 }
  const DT = 1 / 60

  it('压力到 lockPressure 前保持种子，到达后按整段得分定型', () => {
    const tracker = new EmotionTracker(DEFAULT_TUNING)
    expect(tracker.update(0.1, ice, ice, true, DT)).toBeNull()
    expect(tracker.form).toBe('seed')
    expect(tracker.update(0.15, ice, ice, true, DT)).toBe('locked')
    expect(tracker.form).toBe('ice')
  })

  it('短暂的反向特征不会触发转变', () => {
    const tracker = new EmotionTracker(DEFAULT_TUNING)
    tracker.update(0.2, ice, ice, true, DT)
    // 冷却结束后，反向 2 秒再回来
    for (let i = 0; i < 60 * 7; i++) tracker.update(0.3, ice, ice, true, DT)
    for (let i = 0; i < 60 * 2; i++) tracker.update(0.3, ice, fire, true, DT)
    for (let i = 0; i < 60 * 2; i++) tracker.update(0.3, ice, ice, true, DT)
    expect(tracker.form).toBe('ice')
    expect(tracker.shifts).toBe(0)
  })

  it('持续 3 秒以上明显偏向另一种材质才转变', () => {
    const tracker = new EmotionTracker(DEFAULT_TUNING)
    tracker.update(0.2, ice, ice, true, DT)
    for (let i = 0; i < 60 * 7; i++) tracker.update(0.3, ice, ice, true, DT)
    let change = null
    for (let i = 0; i < 60 * 4 && !change; i++) change = tracker.update(0.4, ice, fire, true, DT)
    expect(change).toBe('shifted')
    expect(tracker.form).toBe('fire')
  })

  it('窗口内没有声音时不累计转变', () => {
    const tracker = new EmotionTracker(DEFAULT_TUNING)
    tracker.update(0.2, ice, ice, true, DT)
    for (let i = 0; i < 60 * 15; i++) tracker.update(0.3, ice, fire, false, DT)
    expect(tracker.form).toBe('ice')
  })
})
