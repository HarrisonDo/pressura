/**
 * 跨层共享的核心类型。
 * core/ 目录不依赖 React / three.js，将来可以原样复用到 agent 宠物插件里。
 */

/** 三种情绪材质：冰（压抑）/ 石（焦虑）/ 火（愤怒） */
export type EmotionType = 'ice' | 'stone' | 'fire'

/** 生长阶段还没定型时的中性"种子" */
export type GrowthForm = EmotionType | 'seed'

export const EMOTION_TYPES: readonly EmotionType[] = ['ice', 'stone', 'fire']

export const EMOTION_LABELS: Record<GrowthForm, string> = {
  seed: '未定',
  ice: '压抑 · 冰',
  stone: '焦虑 · 石',
  fire: '愤怒 · 火',
}
