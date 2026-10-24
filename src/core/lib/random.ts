/**
 * 可复现的伪随机数（mulberry32）。
 * 同一个 seed 永远产生同一序列 —— 画廊里重建模型全靠它。
 */
export interface Rng {
  /** [0, 1) */
  next(): number
  /** [min, max) */
  range(min: number, max: number): number
  /** [min, max] 的整数 */
  int(min: number, max: number): number
  /** 以 probability 的概率返回 true */
  chance(probability: number): boolean
  /** 从数组中取一个元素 */
  pick<T>(items: readonly T[]): T
  /** 单位球面上均匀分布的方向 */
  direction(): [number, number, number]
  /** 派生一个独立子序列，互不干扰 */
  fork(label: string): Rng
}

export function hashString(text: string): number {
  // FNV-1a 32 位
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

export function createRng(seed: number): Rng {
  let state = seed >>> 0

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  const rng: Rng = {
    next,
    range: (min, max) => min + (max - min) * next(),
    int: (min, max) => Math.floor(min + (max - min + 1) * next()),
    chance: (probability) => next() < probability,
    pick: (items) => {
      if (items.length === 0) throw new Error('pick() 需要非空数组')
      return items[Math.floor(next() * items.length)] as (typeof items)[number]
    },
    direction: () => {
      const z = next() * 2 - 1
      const theta = next() * Math.PI * 2
      const r = Math.sqrt(1 - z * z)
      return [r * Math.cos(theta), r * Math.sin(theta), z]
    },
    fork: (label) => createRng((seed ^ hashString(label)) >>> 0),
  }
  return rng
}

/** 生成一个新的随机种子（只在创建新实体时调用，其余地方都用确定性 Rng） */
export function freshSeed(): number {
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    return crypto.getRandomValues(new Uint32Array(1))[0] ?? 1
  }
  return Math.floor(Math.random() * 0xffffffff) >>> 0
}
