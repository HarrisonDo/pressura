/**
 * 情绪签名：一次倾诉的全部"基因"。画廊只存签名 + 处置后的状态，就能把标本原样重建出来。
 */
import type { EmotionScores, EndReason, SessionResult } from '../audio'
import type { EmotionType } from '../types'

export const SIGNATURE_VERSION = 1

export interface ArtifactSignature {
  version: number
  id: string
  /** 决定形状的随机种子 */
  seed: number
  type: EmotionType
  createdAt: number
  endReason: EndReason
  durationSeconds: number
  finalPressure: number
  peakLoud: number
  meanLoud: number
  burstCount: number
  onsetRate: number
  scores: EmotionScores
  intensityCurve: number[]
}

export function createSignature(result: SessionResult, seed: number, now = Date.now()): ArtifactSignature {
  return {
    version: SIGNATURE_VERSION,
    id: `${now.toString(36)}-${(seed >>> 0).toString(36)}`,
    seed: seed >>> 0,
    type: result.type,
    createdAt: now,
    endReason: result.endReason,
    durationSeconds: round(result.durationSeconds, 2),
    // 压力太低的标本几乎看不见，最低按 0.2 显示
    finalPressure: round(Math.max(0.2, result.finalPressure), 3),
    peakLoud: round(result.peakLoud, 3),
    meanLoud: round(result.meanLoud, 3),
    burstCount: result.burstCount,
    onsetRate: round(result.onsetRate, 3),
    scores: { ice: round(result.scores.ice, 3), stone: round(result.scores.stone, 3), fire: round(result.scores.fire, 3) },
    intensityCurve: result.intensityCurve,
  }
}

const round = (v: number, digits: number) => Math.round(v * 10 ** digits) / 10 ** digits
