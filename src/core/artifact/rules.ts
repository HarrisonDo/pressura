/**
 * 标本处置规则（纯函数）：种树、浇水、浇汽油、敲击，以及随时间的变化（燃烧、干燥、生长）。
 *
 *            冰                 石                     火核
 * 种树    霜花树             绿树，湿润时长得快       树苗烧成灰（熄灭成黑曜石后可以种活）
 * 浇水    再冻一层、变大     变湿变深、慢慢长苔藓     逐渐熄灭 → 冒蒸汽 → 黑曜石
 * 汽油    点燃，边烧边融化   表面燃烧、熏黑           爆燃，火势更旺
 * 敲击    裂纹，第 3 次碎    裂缝，第 3 次碎          玻璃罩裂开，第 3 次碎、火散成余烬
 *
 * 任何燃烧都能用水浇灭；燃烧会烧掉树。每次处置都会增加"释放度"，环境随之平静下来。
 */
import type { EmotionType } from '../types'

export type Vec3 = [number, number, number]
export type TreeSpecies = 'frost' | 'green' | 'ash'
export type Liquid = 'water' | 'gasoline'

export interface PlantedTree {
  id: number
  /** 相对标本中心的位置和表面法线 */
  point: Vec3
  normal: Vec3
  species: TreeSpecies
  /** 0~1 */
  growth: number
  burnt: boolean
}

export interface CrackMark {
  point: Vec3
  normal: Vec3
}

export interface ArtifactState {
  /** 汽油火势 0~1 */
  burning: number
  /** 熏黑 0~1 */
  soot: number
  /** 湿润 0~1 */
  wet: number
  /** 冰：再冻的厚度 0~1 */
  frost: number
  /** 冰：被烧融的程度 0~0.6 */
  melt: number
  /** 石：苔藓 0~1 */
  moss: number
  /** 火核：熄灭进度 0~1 */
  extinguish: number
  /** 火核已熄灭成黑曜石 */
  obsidian: boolean
  /** 火核：汽油加的火势 0~0.6 */
  fireBoost: number
  trees: PlantedTree[]
  cracks: CrackMark[]
  hits: number
  shattered: boolean
  /** 释放度 0~1 */
  release: number
  nextTreeId: number
}

export type ArtifactAction =
  | { kind: 'plant'; point: Vec3; normal: Vec3 }
  | { kind: 'pour'; liquid: Liquid; amount: number; point?: Vec3 }
  | { kind: 'knock'; point: Vec3; normal: Vec3 }

export type EffectKind =
  | 'plant'
  | 'ash'
  | 'steam'
  | 'freeze'
  | 'splash'
  | 'ignite'
  | 'flare'
  | 'extinguished'
  | 'crack'
  | 'shatter'

export interface ArtifactEffect {
  kind: EffectKind
  point?: Vec3
}

export interface RuleResult {
  state: ArtifactState
  effects: ArtifactEffect[]
}

export const MAX_TREES = 12
export const HITS_TO_SHATTER = 3

export function createArtifactState(): ArtifactState {
  return {
    burning: 0,
    soot: 0,
    wet: 0,
    frost: 0,
    melt: 0,
    moss: 0,
    extinguish: 0,
    obsidian: false,
    fireBoost: 0,
    trees: [],
    cracks: [],
    hits: 0,
    shattered: false,
    release: 0,
    nextTreeId: 1,
  }
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

function clone(s: ArtifactState): ArtifactState {
  return { ...s, trees: s.trees.map((t) => ({ ...t })), cracks: s.cracks.map((c) => ({ ...c })) }
}

/** 火核还在烧（没熄灭） */
export const isLiveFire = (type: EmotionType, s: ArtifactState) => type === 'fire' && !s.obsidian

export function applyAction(prev: ArtifactState, type: EmotionType, action: ArtifactAction): RuleResult {
  if (prev.shattered) return { state: prev, effects: [] }
  const s = clone(prev)
  const effects: ArtifactEffect[] = []

  switch (action.kind) {
    case 'plant': {
      if (s.trees.length >= MAX_TREES) break
      const ash = isLiveFire(type, s)
      const species: TreeSpecies = ash ? 'ash' : type === 'ice' ? 'frost' : 'green'
      s.trees.push({
        id: s.nextTreeId++,
        point: action.point,
        normal: action.normal,
        species,
        growth: ash ? 1 : 0,
        burnt: ash,
      })
      effects.push({ kind: ash ? 'ash' : 'plant', point: action.point })
      s.release = clamp01(s.release + 0.06)
      break
    }

    case 'pour': {
      const a = Math.max(0, action.amount)
      if (action.liquid === 'water') {
        if (s.burning > 0) {
          s.burning = Math.max(0, s.burning - a * 2.5)
          effects.push({ kind: 'steam', point: action.point })
        }
        if (type === 'ice') {
          s.frost = clamp01(s.frost + a * 0.8)
          effects.push({ kind: 'freeze', point: action.point })
        } else if (isLiveFire(type, s)) {
          s.extinguish = clamp01(s.extinguish + a * 0.7)
          effects.push({ kind: 'steam', point: action.point })
          if (s.extinguish >= 1) {
            s.obsidian = true
            s.fireBoost = 0
            s.release = clamp01(s.release + 0.25)
            effects.push({ kind: 'extinguished' })
          }
        } else {
          s.wet = clamp01(s.wet + a * 1.2)
          effects.push({ kind: 'splash', point: action.point })
        }
      } else {
        if (isLiveFire(type, s)) {
          s.fireBoost = Math.min(0.6, s.fireBoost + a * 0.5)
          effects.push({ kind: 'flare', point: action.point })
        } else {
          const wasBurning = s.burning > 0.05
          s.burning = clamp01(s.burning + a * 3)
          if (!wasBurning) effects.push({ kind: 'ignite', point: action.point })
        }
      }
      s.release = clamp01(s.release + a * 0.06)
      break
    }

    case 'knock': {
      s.hits++
      s.cracks.push({ point: action.point, normal: action.normal })
      s.release = clamp01(s.release + 0.12)
      effects.push({ kind: 'crack', point: action.point })
      if (s.hits >= HITS_TO_SHATTER) {
        s.shattered = true
        s.burning = 0
        s.release = 1
        effects.push({ kind: 'shatter', point: action.point })
      }
      break
    }
  }
  return { state: s, effects }
}

/** 随时间的变化：燃烧衰减并烧树/融冰/熏黑，水分蒸发、长苔藓，树慢慢长大 */
export function tickState(prev: ArtifactState, type: EmotionType, dt: number): RuleResult {
  if (dt <= 0) return { state: prev, effects: [] }
  const s = clone(prev)
  const effects: ArtifactEffect[] = []

  if (s.burning > 0) {
    if (type === 'ice') s.melt = Math.min(0.6, s.melt + s.burning * 0.06 * dt)
    else s.soot = clamp01(s.soot + s.burning * 0.1 * dt)
    s.wet = Math.max(0, s.wet - s.burning * 0.3 * dt)
    for (const tree of s.trees) {
      if (!tree.burnt && s.burning > 0.25) {
        tree.burnt = true
        effects.push({ kind: 'ash', point: tree.point })
      }
    }
    s.burning = Math.max(0, s.burning - 0.08 * dt)
  }

  if (s.wet > 0) {
    if (type === 'stone' || s.obsidian) s.moss = clamp01(s.moss + s.wet * 0.05 * dt)
    s.wet = Math.max(0, s.wet - 0.015 * dt)
  }

  if (isLiveFire(type, s)) {
    // 不继续浇水，火会慢慢缓过来
    s.extinguish = Math.max(0, s.extinguish - 0.03 * dt)
    s.fireBoost = Math.max(0, s.fireBoost - 0.02 * dt)
  }

  for (const tree of s.trees) {
    if (tree.burnt || tree.growth >= 1) continue
    const rate = tree.species === 'frost' ? 0.18 : 0.22 + s.wet * 0.4 + s.moss * 0.2
    tree.growth = Math.min(1, tree.growth + rate * dt)
  }

  return { state: s, effects }
}

export interface StateSummary {
  burning: boolean
  wet: boolean
  frozen: boolean
  mossy: boolean
  obsidian: boolean
  trees: number
  hits: number
  shattered: boolean
  release: number
}

export function summarize(s: ArtifactState): StateSummary {
  return {
    burning: s.burning > 0.05,
    wet: s.wet > 0.1,
    frozen: s.frost > 0.1,
    mossy: s.moss > 0.15,
    obsidian: s.obsidian,
    trees: s.trees.filter((t) => !t.burnt).length,
    hits: s.hits,
    shattered: s.shattered,
    release: Math.round(s.release * 100) / 100,
  }
}
