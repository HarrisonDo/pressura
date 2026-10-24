/**
 * 场景和界面共用的配色与阶段定义。
 */
import type { GrowthForm } from './types'

export const FORM_COLORS: Record<GrowthForm, string> = {
  seed: '#c9c4ff',
  ice: '#7cc8ff',
  stone: '#c2a37f',
  fire: '#ff7a3c',
}

export const FORM_ICONS: Record<GrowthForm, string> = {
  seed: '✦',
  ice: '❄',
  stone: '⬢',
  fire: '🔥',
}

/** 生长阶段的压力阈值（第 1 阶段从 0 开始），共 5 个阶段 */
export const STAGE_THRESHOLDS = [0, 0.15, 0.4, 0.7, 0.9] as const

export function stageOf(pressure: number): number {
  let stage = 0
  for (let i = 0; i < STAGE_THRESHOLDS.length; i++) if (pressure >= STAGE_THRESHOLDS[i]) stage = i
  return stage
}
