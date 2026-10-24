/**
 * 一次"倾诉"会话：校准 → 聆听 → 安静倒计时 → 结束。
 * 纯逻辑、可确定性重放：给同样的帧序列一定得到同样的结果，方便单测。
 *
 * 渲染层每帧直接读取 snapshot（同一个可变对象，不触发 React 渲染）；
 * 粗粒度的状态变化（阶段、材质、结束）通过 subscribe 推送。
 */
import type { EmotionType, GrowthForm } from '../types'
import { clamp, damp, resample } from '../lib/math'
import { BAND_COUNT, type FeatureFrame } from './features'
import { NoiseFloor } from './noiseFloor'
import { OnsetDetector } from './onset'
import { loudnessFrom, PressureModel } from './pressure'
import {
  EmotionTracker,
  StatsAccumulator,
  computeStats,
  scoreEmotions,
  topEmotion,
  type EmotionScores,
  type FrameRecord,
  type VoiceStats,
} from './classifier'
import { DEFAULT_TUNING, type AudioTuning } from './tuning'

export type SessionPhase = 'calibrating' | 'listening' | 'settling' | 'ended'
export type EndReason = 'silence' | 'overflow' | 'manual'

export const CURVE_POINTS = 64
const CURVE_SAMPLE_SECONDS = 0.1

export interface SessionSnapshot {
  phase: SessionPhase
  /** 校准进度 0~1 */
  calibration: number
  /** 进入聆听后的时间（秒） */
  elapsed: number
  levelDb: number
  floorDb: number
  /** 当前帧发声强度 0~1 */
  loud: number
  /** 平滑后的强度，给视觉用（起得快、落得慢） */
  intensity: number
  voiced: boolean
  centroid: number
  flux: number
  pressure: number
  form: GrowthForm
  /** 整段会话的材质得分 */
  scores: EmotionScores
  /** 最近窗口的材质得分 */
  windowScores: EmotionScores
  stats: VoiceStats
  /** 计数器只增不减：渲染层比较前后值就能知道这一帧有没有新的起音/突发 */
  onsetCount: number
  burstCount: number
  silentFor: number
  /** 凝结倒计时进度 0~1 */
  settle: number
  bands: Float32Array
}

export interface SessionResult {
  type: EmotionType
  endReason: EndReason
  /** 从第一次发声到结束（秒） */
  durationSeconds: number
  voicedSeconds: number
  finalPressure: number
  peakLoud: number
  meanLoud: number
  onsetCount: number
  burstCount: number
  onsetRate: number
  centroidNorm: number
  scores: EmotionScores
  /** 强度曲线，CURVE_POINTS 个点，0~1 */
  intensityCurve: number[]
}

export type SessionEvent =
  | { type: 'phase'; phase: SessionPhase }
  | { type: 'form'; form: GrowthForm; change: 'locked' | 'shifted' }
  | { type: 'burst' }
  | { type: 'ended'; result: SessionResult }

export class EmotionSession {
  readonly tuning: AudioTuning
  readonly snapshot: SessionSnapshot

  private readonly floor: NoiseFloor
  private readonly onset: OnsetDetector
  private readonly pressure: PressureModel
  private readonly tracker: EmotionTracker
  private readonly sessionStats = new StatsAccumulator()
  private readonly records: FrameRecord[] = []
  private windowStart = 0
  private calibrationElapsed = 0
  private firstVoiceAt: number | null = null
  private peakLoud = 0
  private curve: number[] = []
  private curveSum = 0
  private curveTime = 0
  private result: SessionResult | null = null
  private readonly listeners = new Set<(event: SessionEvent) => void>()

  constructor(tuning: Partial<AudioTuning> = {}) {
    this.tuning = { ...DEFAULT_TUNING, ...tuning }
    this.floor = new NoiseFloor(this.tuning)
    this.onset = new OnsetDetector(this.tuning)
    this.pressure = new PressureModel(this.tuning)
    this.tracker = new EmotionTracker(this.tuning)
    this.snapshot = {
      phase: 'calibrating',
      calibration: 0,
      elapsed: 0,
      levelDb: -100,
      floorDb: this.floor.floorDb,
      loud: 0,
      intensity: 0,
      voiced: false,
      centroid: 0,
      flux: 0,
      pressure: 0,
      form: 'seed',
      scores: { ice: 0, stone: 0, fire: 0 },
      windowScores: { ice: 0, stone: 0, fire: 0 },
      stats: this.sessionStats.result(),
      onsetCount: 0,
      burstCount: 0,
      silentFor: 0,
      settle: 0,
      bands: new Float32Array(BAND_COUNT),
    }
  }

  subscribe(listener: (event: SessionEvent) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getResult(): SessionResult | null {
    return this.result
  }

  process(frame: FeatureFrame, dt: number): void {
    const s = this.snapshot
    if (s.phase === 'ended' || dt <= 0) return
    const t = this.tuning

    s.levelDb = frame.levelDb
    s.centroid = frame.centroid
    s.flux = frame.flux
    if (frame.bands) s.bands.set(frame.bands)
    else s.bands.fill(0)

    if (s.phase === 'calibrating') {
      this.floor.addCalibrationSample(frame.levelDb)
      this.calibrationElapsed += dt
      s.calibration = clamp(this.calibrationElapsed / t.calibrationSeconds)
      if (this.calibrationElapsed >= t.calibrationSeconds) {
        s.floorDb = this.floor.finishCalibration()
        this.setPhase('listening')
      }
      return
    }

    s.elapsed += dt
    s.floorDb = this.floor.track(frame.levelDb, dt)
    const loud = loudnessFrom(frame.levelDb, s.floorDb, t)
    const voiced = loud > 0
    s.loud = loud
    s.voiced = voiced
    s.intensity = damp(s.intensity, loud, loud > s.intensity ? 0.04 : 0.3, dt)
    this.peakLoud = Math.max(this.peakLoud, loud)

    const kind = this.onset.update(frame.flux, loud, s.elapsed, dt)
    if (kind !== 'none') s.onsetCount++
    if (kind === 'burst') {
      s.burstCount++
      this.emit({ type: 'burst' })
    }
    s.pressure = this.pressure.update(loud, kind === 'burst', dt)

    if (voiced && this.firstVoiceAt === null) this.firstVoiceAt = s.elapsed

    // 记录 + 统计
    const centroidNorm = clamp((frame.centroid - t.centroidLowHz) / (t.centroidHighHz - t.centroidLowHz))
    const record: FrameRecord = {
      t: s.elapsed,
      dt,
      loud,
      centroidNorm,
      voiced,
      onset: kind !== 'none',
      burst: kind === 'burst',
    }
    this.records.push(record)
    this.sessionStats.add(record)
    while (
      this.windowStart < this.records.length &&
      this.records[this.windowStart].t < s.elapsed - t.windowSeconds
    ) {
      this.windowStart++
    }
    // 整段统计是增量的，窗口之前的记录可以丢掉，长时间倾诉也不会无限占内存
    if (this.windowStart > 2048) {
      this.records.splice(0, this.windowStart)
      this.windowStart = 0
    }
    const windowStats = computeStats(this.records, this.windowStart)
    s.stats = this.sessionStats.result()
    s.scores = scoreEmotions(s.stats)
    s.windowScores = scoreEmotions(windowStats)

    const change = this.tracker.update(s.pressure, s.scores, s.windowScores, windowStats.voicedSeconds > 0.5, dt)
    if (change) {
      s.form = this.tracker.form
      this.emit({ type: 'form', form: s.form, change })
    }

    // 强度曲线采样
    this.curveSum += s.intensity * dt
    this.curveTime += dt
    if (this.curveTime >= CURVE_SAMPLE_SECONDS) {
      this.curve.push(this.curveSum / this.curveTime)
      this.curveSum = 0
      this.curveTime = 0
    }

    // 结束判定
    if (voiced) {
      s.silentFor = 0
      s.settle = 0
      if (s.phase === 'settling') this.setPhase('listening')
    } else {
      s.silentFor += dt
    }

    if (s.pressure >= 1) {
      this.end('overflow')
      return
    }

    const spoken = this.firstVoiceAt === null ? 0 : s.elapsed - this.firstVoiceAt
    const canEnd = spoken >= t.minDurationSeconds && s.pressure >= t.minPressure
    if (s.phase === 'listening' && canEnd && s.silentFor >= t.settleDelay) {
      this.setPhase('settling')
    }
    if (s.phase === 'settling') {
      s.settle = clamp((s.silentFor - t.settleDelay) / (t.settleSeconds - t.settleDelay))
      if (s.silentFor >= t.settleSeconds) this.end('silence')
    }
  }

  /** 手动结束。几乎没有内容时拒绝结束，返回 false */
  finish(): boolean {
    const s = this.snapshot
    if (s.phase === 'ended') return true
    if (s.phase === 'calibrating' || s.pressure < 0.02) return false
    this.end('manual')
    return true
  }

  private end(reason: EndReason): void {
    const s = this.snapshot
    if (this.curveTime > 0) this.curve.push(this.curveSum / this.curveTime)
    const type: EmotionType = s.form === 'seed' ? topEmotion(s.scores) : s.form
    s.form = type
    s.settle = reason === 'silence' ? 1 : s.settle
    const stats = s.stats
    this.result = {
      type,
      endReason: reason,
      durationSeconds: this.firstVoiceAt === null ? 0 : s.elapsed - this.firstVoiceAt,
      voicedSeconds: stats.voicedSeconds,
      finalPressure: s.pressure,
      peakLoud: this.peakLoud,
      meanLoud: stats.meanLoud,
      onsetCount: stats.onsetCount,
      burstCount: stats.burstCount,
      onsetRate: stats.onsetRate,
      centroidNorm: stats.centroidNorm,
      scores: { ...s.scores },
      intensityCurve: resample(this.curve, CURVE_POINTS).map((v) => Math.round(v * 1000) / 1000),
    }
    this.setPhase('ended')
    this.emit({ type: 'ended', result: this.result })
  }

  private setPhase(phase: SessionPhase): void {
    if (this.snapshot.phase === phase) return
    this.snapshot.phase = phase
    this.emit({ type: 'phase', phase })
  }

  private emit(event: SessionEvent): void {
    for (const listener of this.listeners) listener(event)
  }
}
