import { describe, expect, it } from 'vitest'
import type { EmotionType, GrowthForm } from '../types'
import { createRng } from '../lib/random'
import { createVoicePattern } from './synthetic'
import { CURVE_POINTS, EmotionSession, type SessionPhase } from './session'

const DT = 1 / 60

interface Segment {
  seconds: number
  style?: EmotionType
}

/** 按时间段喂合成特征；style 为空表示安静 */
function run(segments: Segment[], seed = 1) {
  const session = new EmotionSession()
  const forms: GrowthForm[] = []
  const phases: SessionPhase[] = []
  session.subscribe((e) => {
    if (e.type === 'form') forms.push(e.form)
    if (e.type === 'phase') phases.push(e.phase)
  })
  const patterns = new Map<EmotionType, ReturnType<typeof createVoicePattern>>()
  const silence = createVoicePattern('ice', createRng(seed + 99))
  const pressures: number[] = []

  for (const seg of segments) {
    const pattern = seg.style
      ? (patterns.get(seg.style) ??
        patterns.set(seg.style, createVoicePattern(seg.style, createRng(seed))).get(seg.style)!)
      : silence
    for (let t = 0; t < seg.seconds; t += DT) {
      if (session.snapshot.phase === 'ended') break
      session.process(pattern.next(DT, seg.style ? 1 : 0), DT)
      pressures.push(session.snapshot.pressure)
    }
  }
  return { session, result: session.getResult(), forms, phases, pressures }
}

describe('EmotionSession：三种合成声音得到三种材质', () => {
  it.each([
    ['ice', 'ice'],
    ['stone', 'stone'],
    ['fire', 'fire'],
  ] as const)('%s 风格 → %s', (style, expected) => {
    for (const seed of [1, 2, 3]) {
      const { result, forms } = run([{ seconds: 2 }, { seconds: 25, style }, { seconds: 6 }], seed)
      expect(result, `seed ${seed}`).not.toBeNull()
      expect(result!.type, `seed ${seed}`).toBe(expected)
      // 定型一次，不来回跳
      expect(forms.length, `seed ${seed}`).toBeLessThanOrEqual(2)
      expect(forms[0], `seed ${seed}`).toBe(expected)
    }
  })

  it('吼叫会灌满压力，以"满溢"结束', () => {
    const { result } = run([{ seconds: 2 }, { seconds: 30, style: 'fire' }])
    expect(result!.endReason).toBe('overflow')
    expect(result!.finalPressure).toBe(1)
    expect(result!.burstCount).toBeGreaterThan(5)
  })

  it('碎碎念之后安静 3 秒以"静默"结束', () => {
    const { result } = run([{ seconds: 2 }, { seconds: 15, style: 'stone' }, { seconds: 6 }])
    expect(result!.endReason).toBe('silence')
    expect(result!.finalPressure).toBeGreaterThan(0.1)
    expect(result!.finalPressure).toBeLessThan(1)
  })
})

describe('EmotionSession：阶段与结束条件', () => {
  it('先校准再聆听，底噪接近真实底噪', () => {
    const { session, phases } = run([{ seconds: 3 }])
    expect(phases[0]).toBe('listening')
    expect(session.snapshot.floorDb).toBeGreaterThan(-64)
    expect(session.snapshot.floorDb).toBeLessThan(-60)
  })

  it('说话时间太短不会凝结', () => {
    const { session } = run([{ seconds: 2 }, { seconds: 3, style: 'stone' }, { seconds: 10 }])
    expect(session.snapshot.phase).not.toBe('ended')
  })

  it('倒计时中再出声会取消凝结', () => {
    const { session, phases } = run([
      { seconds: 2 },
      { seconds: 10, style: 'stone' },
      { seconds: 2 },
      { seconds: 4, style: 'stone' },
    ])
    expect(phases).toContain('settling')
    expect(phases.lastIndexOf('listening')).toBeGreaterThan(phases.indexOf('settling'))
    expect(session.snapshot.phase).not.toBe('ended')
  })

  it('压力全程只增不减', () => {
    const { pressures } = run([{ seconds: 2 }, { seconds: 8, style: 'fire' }, { seconds: 2 }, { seconds: 8, style: 'ice' }])
    for (let i = 1; i < pressures.length; i++) expect(pressures[i]).toBeGreaterThanOrEqual(pressures[i - 1])
  })

  it('手动结束：校准中或几乎没声音时拒绝，之后可以结束', () => {
    const session = new EmotionSession()
    const pattern = createVoicePattern('stone', createRng(5))
    expect(session.finish()).toBe(false)
    for (let t = 0; t < 2; t += DT) session.process(pattern.next(DT, 0), DT)
    expect(session.finish()).toBe(false)
    for (let t = 0; t < 4; t += DT) session.process(pattern.next(DT, 1), DT)
    expect(session.finish()).toBe(true)
    expect(session.getResult()!.endReason).toBe('manual')
  })

  it('结果里的强度曲线固定为 64 个点，取值 0~1', () => {
    const { result } = run([{ seconds: 2 }, { seconds: 12, style: 'stone' }, { seconds: 6 }])
    expect(result!.intensityCurve).toHaveLength(CURVE_POINTS)
    for (const v of result!.intensityCurve) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
    }
  })

  it('同样的输入得到同样的结果（可重放）', () => {
    const a = run([{ seconds: 2 }, { seconds: 12, style: 'ice' }, { seconds: 6 }], 7).result
    const b = run([{ seconds: 2 }, { seconds: 12, style: 'ice' }, { seconds: 6 }], 7).result
    expect(a).toEqual(b)
  })
})
