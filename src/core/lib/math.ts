export const clamp = (value: number, min = 0, max = 1): number =>
  Math.min(max, Math.max(min, value))

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

export const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = clamp((x - edge0) / (edge1 - edge0))
  return t * t * (3 - 2 * t)
}

/** 高斯钟形：x 在 center 处为 1，偏离 width 时约为 0.37 */
export const bell = (x: number, center: number, width: number): number =>
  Math.exp(-(((x - center) / width) ** 2))

/**
 * 与帧率无关的指数平滑：经过 tau 秒后，current 走完到 target 距离的约 63%。
 */
export const damp = (current: number, target: number, tau: number, dt: number): number =>
  tau <= 0 ? target : target + (current - target) * Math.exp(-dt / tau)

/** 线性插值的分位数，p ∈ [0, 1] */
export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return Number.NaN
  const sorted = [...values].sort((a, b) => a - b)
  const index = clamp(p) * (sorted.length - 1)
  const lo = Math.floor(index)
  const hi = Math.ceil(index)
  return lerp(sorted[lo], sorted[hi], index - lo)
}

/** 把任意长度的序列重采样为 count 个点（多则分桶平均，少则线性插值） */
export function resample(values: readonly number[], count: number): number[] {
  if (count <= 0) return []
  if (values.length === 0) return new Array<number>(count).fill(0)
  if (values.length === 1) return new Array<number>(count).fill(values[0])

  if (values.length >= count) {
    const out: number[] = []
    for (let i = 0; i < count; i++) {
      const start = Math.floor((i * values.length) / count)
      const end = Math.max(start + 1, Math.floor(((i + 1) * values.length) / count))
      let sum = 0
      for (let j = start; j < end; j++) sum += values[j]
      out.push(sum / (end - start))
    }
    return out
  }

  const out: number[] = []
  for (let i = 0; i < count; i++) {
    const pos = (i / (count - 1)) * (values.length - 1)
    const lo = Math.floor(pos)
    const hi = Math.min(values.length - 1, lo + 1)
    out.push(lerp(values[lo], values[hi], pos - lo))
  }
  return out
}
