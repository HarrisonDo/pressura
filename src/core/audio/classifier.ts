/**
 * 材质判定：把一段声音的统计特征打分成冰 / 石 / 火。
 *
 * 这是"声音特征 → 视觉"的表达映射，不是情绪识别：
 *   火：响、爆发多、声音偏亮（吼、喊）
 *   冰：轻、平稳、起伏小、起音少（叹气、低语、闷声）
 *   石：中等响度、起音密集、断断续续（急促的碎碎念）
 */
import type { EmotionType, GrowthForm } from '../types'
import { EMOTION_TYPES } from '../types'
import { bell, smoothstep } from '../lib/math'
import type { AudioTuning } from './tuning'

export interface FrameRecord {
  /** 进入聆听后的时间（秒） */
  t: number
  dt: number
  loud: number
  /** 归一化频谱质心 0~1 */
  centroidNorm: number
  voiced: boolean
  onset: boolean
  burst: boolean
}

export interface VoiceStats {
  /** 统计区间内从第一次发声算起的时长（秒） */
  spanSeconds: number
  voicedSeconds: number
  /** 以下均只统计发声帧 */
  meanLoud: number
  loudStd: number
  centroidNorm: number
  /** 每秒起音次数 / 强突发次数（按 span 计） */
  onsetRate: number
  burstRate: number
  /** 发声时间占比，越低越断续 */
  voicedRatio: number
  onsetCount: number
  burstCount: number
}

export type EmotionScores = Record<EmotionType, number>

export const EMPTY_STATS: VoiceStats = {
  spanSeconds: 0,
  voicedSeconds: 0,
  meanLoud: 0,
  loudStd: 0,
  centroidNorm: 0,
  onsetRate: 0,
  burstRate: 0,
  voicedRatio: 0,
  onsetCount: 0,
  burstCount: 0,
}

/** 增量统计（整段会话用），O(1) 每帧 */
export class StatsAccumulator {
  private started = false
  private span = 0
  private voiced = 0
  private sumLoud = 0
  private sumLoud2 = 0
  private sumCentroid = 0
  private onsets = 0
  private bursts = 0

  add(r: FrameRecord): void {
    if (!this.started && !r.voiced) return
    this.started = true
    this.span += r.dt
    if (r.voiced) {
      this.voiced += r.dt
      this.sumLoud += r.loud * r.dt
      this.sumLoud2 += r.loud * r.loud * r.dt
      this.sumCentroid += r.centroidNorm * r.dt
    }
    if (r.onset) this.onsets++
    if (r.burst) this.bursts++
  }

  result(): VoiceStats {
    return finalize(this.span, this.voiced, this.sumLoud, this.sumLoud2, this.sumCentroid, this.onsets, this.bursts)
  }
}

/** 对一段记录（如最近 4 秒）直接计算统计量 */
export function computeStats(records: readonly FrameRecord[], from = 0, to = records.length): VoiceStats {
  let started = false
  let span = 0
  let voiced = 0
  let sumLoud = 0
  let sumLoud2 = 0
  let sumCentroid = 0
  let onsets = 0
  let bursts = 0
  for (let i = from; i < to; i++) {
    const r = records[i]
    if (!started && !r.voiced) continue
    started = true
    span += r.dt
    if (r.voiced) {
      voiced += r.dt
      sumLoud += r.loud * r.dt
      sumLoud2 += r.loud * r.loud * r.dt
      sumCentroid += r.centroidNorm * r.dt
    }
    if (r.onset) onsets++
    if (r.burst) bursts++
  }
  return finalize(span, voiced, sumLoud, sumLoud2, sumCentroid, onsets, bursts)
}

function finalize(
  span: number,
  voiced: number,
  sumLoud: number,
  sumLoud2: number,
  sumCentroid: number,
  onsets: number,
  bursts: number,
): VoiceStats {
  if (voiced <= 0) return { ...EMPTY_STATS, spanSeconds: span }
  const meanLoud = sumLoud / voiced
  const variance = Math.max(0, sumLoud2 / voiced - meanLoud * meanLoud)
  // span 太短时按 1 秒算，避免刚开口时速率虚高
  const rateBase = Math.max(1, span)
  return {
    spanSeconds: span,
    voicedSeconds: voiced,
    meanLoud,
    loudStd: Math.sqrt(variance),
    centroidNorm: sumCentroid / voiced,
    onsetRate: onsets / rateBase,
    burstRate: bursts / rateBase,
    voicedRatio: span > 0 ? voiced / span : 0,
    onsetCount: onsets,
    burstCount: bursts,
  }
}

export function scoreEmotions(s: VoiceStats): EmotionScores {
  if (s.voicedSeconds <= 0) return { ice: 0, stone: 0, fire: 0 }
  const fire =
    0.45 * smoothstep(0.45, 0.8, s.meanLoud) +
    0.3 * smoothstep(0.1, 0.8, s.burstRate) +
    0.25 * smoothstep(0.3, 0.7, s.centroidNorm)
  const ice =
    0.45 * (1 - smoothstep(0.2, 0.55, s.meanLoud)) +
    0.3 * (1 - smoothstep(0.08, 0.25, s.loudStd)) +
    0.25 * (1 - smoothstep(1, 3, s.onsetRate))
  const stone =
    0.35 * bell(s.meanLoud, 0.45, 0.25) +
    0.4 * smoothstep(1.2, 3.5, s.onsetRate) +
    0.25 * (1 - smoothstep(0.5, 0.85, s.voicedRatio))
  return { ice, stone, fire }
}

export function topEmotion(scores: EmotionScores): EmotionType {
  let best: EmotionType = 'ice'
  for (const type of EMOTION_TYPES) if (scores[type] > scores[best]) best = type
  return best
}

export type FormChange = 'locked' | 'shifted' | null

type TrackerTuning = Pick<AudioTuning, 'lockPressure' | 'shiftMargin' | 'shiftHold' | 'shiftCooldown'>

/**
 * 材质状态机：种子 → 在 lockPressure 时定型 → 之后只有近期特征持续明显偏向另一种材质才转变。
 * 避免旧版那种逐帧跳变。
 */
export class EmotionTracker {
  form: GrowthForm = 'seed'
  shifts = 0
  private candidate: EmotionType | null = null
  private candidateFor = 0
  private cooldown = 0
  private readonly tuning: TrackerTuning

  constructor(tuning: TrackerTuning) {
    this.tuning = tuning
  }

  update(
    pressure: number,
    sessionScores: EmotionScores,
    windowScores: EmotionScores,
    windowHasVoice: boolean,
    dt: number,
  ): FormChange {
    const t = this.tuning
    if (this.form === 'seed') {
      if (pressure >= t.lockPressure) {
        this.form = topEmotion(sessionScores)
        this.cooldown = t.shiftCooldown
        return 'locked'
      }
      return null
    }

    this.cooldown = Math.max(0, this.cooldown - dt)
    if (!windowHasVoice) return null

    const current = this.form
    const leader = topEmotion(windowScores)
    if (leader !== current && windowScores[leader] - windowScores[current] >= t.shiftMargin) {
      if (this.candidate === leader) this.candidateFor += dt
      else {
        this.candidate = leader
        this.candidateFor = dt
      }
      if (this.candidateFor >= t.shiftHold && this.cooldown <= 0) {
        this.form = leader
        this.shifts++
        this.cooldown = t.shiftCooldown
        this.candidate = null
        this.candidateFor = 0
        return 'shifted'
      }
    } else {
      this.candidate = null
      this.candidateFor = 0
    }
    return null
  }
}
