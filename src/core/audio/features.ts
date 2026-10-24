/**
 * 逐帧声音特征提取（纯函数 + 少量带状态的小工具）。
 * 输入来自 AnalyserNode：时域波形（-1~1）和 dB 频谱。
 */
import { clamp } from '../lib/math'

export const MIN_DB = -100
export const BAND_COUNT = 64

/** 频谱质心 / 通量只看人声相关的频段 */
const VOICE_MIN_HZ = 80
const VOICE_MAX_HZ = 8000

export interface FeatureFrame {
  /** RMS 电平（dBFS，-100 ~ 0） */
  levelDb: number
  /** 频谱质心（Hz），反映声音偏亮还是偏暗 */
  centroid: number
  /** 频谱通量：人声频段内每个频点的平均正向 dB 增量，起音/爆发时突增 */
  flux: number
  /** 64 段对数频带能量（0~1），给频谱环可视化用；模拟输入可以为 null */
  bands: Float32Array | null
}

const safeDb = (v: number): number => (Number.isFinite(v) ? Math.max(MIN_DB, v) : MIN_DB)

export function rmsDb(samples: Float32Array): number {
  if (samples.length === 0) return MIN_DB
  let sum = 0
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i]
  const rms = Math.sqrt(sum / samples.length)
  return rms > 0 ? Math.max(MIN_DB, 20 * Math.log10(rms)) : MIN_DB
}

/** dB 频谱 → 线性幅度，写入 out 并返回 */
export function dbToMagnitudes(db: Float32Array, out: Float32Array): Float32Array {
  for (let i = 0; i < db.length; i++) {
    const v = db[i]
    out[i] = Number.isFinite(v) ? 10 ** (v / 20) : 0
  }
  return out
}

function binRange(length: number, binHz: number, minHz: number, maxHz: number): [number, number] {
  const lo = Math.max(1, Math.floor(minHz / binHz))
  const hi = Math.min(length - 1, Math.ceil(maxHz / binHz))
  return [lo, hi]
}

/**
 * 功率加权的频谱质心。
 * 用功率（幅度平方）而不是幅度加权：宽带底噪分散在几百个频点上，功率加权后几乎不影响结果，
 * 而人声谐波集中在少数频点，会主导质心。
 */
export function spectralCentroid(
  magnitudes: Float32Array,
  binHz: number,
  minHz = VOICE_MIN_HZ,
  maxHz = VOICE_MAX_HZ,
): number {
  const [lo, hi] = binRange(magnitudes.length, binHz, minHz, maxHz)
  let weighted = 0
  let total = 0
  for (let i = lo; i <= hi; i++) {
    const power = magnitudes[i] * magnitudes[i]
    weighted += power * i * binHz
    total += power
  }
  return total > 1e-20 ? weighted / total : 0
}

/** 正向频谱通量（基于 dB），需要记住上一帧，所以是一个小类 */
export class SpectralFlux {
  private prev: Float32Array | null = null
  private readonly binHz: number
  private readonly minHz: number
  private readonly maxHz: number

  constructor(binHz: number, minHz = VOICE_MIN_HZ, maxHz = VOICE_MAX_HZ) {
    this.binHz = binHz
    this.minHz = minHz
    this.maxHz = maxHz
  }

  update(db: Float32Array): number {
    const [lo, hi] = binRange(db.length, this.binHz, this.minHz, this.maxHz)
    if (!this.prev || this.prev.length !== db.length) {
      this.prev = new Float32Array(db.length)
      for (let i = 0; i < db.length; i++) this.prev[i] = safeDb(db[i])
      return 0
    }
    let sum = 0
    for (let i = lo; i <= hi; i++) {
      const cur = safeDb(db[i])
      const diff = cur - this.prev[i]
      if (diff > 0) sum += diff
      this.prev[i] = cur
    }
    return sum / (hi - lo + 1)
  }

  reset(): void {
    this.prev = null
  }
}

/** 对数分布的频带能量（取每段内最大 dB 并归一化到 0~1） */
export function logBands(
  db: Float32Array,
  binHz: number,
  out: Float32Array,
  minHz = 60,
  maxHz = VOICE_MAX_HZ,
  floorDb = -95,
  ceilDb = -25,
): Float32Array {
  const n = out.length
  const ratio = maxHz / minHz
  for (let b = 0; b < n; b++) {
    const f0 = minHz * ratio ** (b / n)
    const f1 = minHz * ratio ** ((b + 1) / n)
    const i0 = Math.min(db.length - 1, Math.floor(f0 / binHz))
    const i1 = Math.min(db.length - 1, Math.max(i0, Math.ceil(f1 / binHz) - 1))
    let peak = MIN_DB
    for (let i = i0; i <= i1; i++) peak = Math.max(peak, safeDb(db[i]))
    out[b] = clamp((peak - floorDb) / (ceilDb - floorDb))
  }
  return out
}

/** 把一帧原始分析数据转成 FeatureFrame */
export class FeatureExtractor {
  readonly binHz: number
  private readonly flux: SpectralFlux
  private magnitudes: Float32Array = new Float32Array(0)
  private readonly bands = new Float32Array(BAND_COUNT)

  constructor(sampleRate: number, fftSize: number) {
    this.binHz = sampleRate / fftSize
    this.flux = new SpectralFlux(this.binHz)
  }

  extract(timeDomain: Float32Array, frequencyDb: Float32Array): FeatureFrame {
    if (this.magnitudes.length !== frequencyDb.length) {
      this.magnitudes = new Float32Array(frequencyDb.length)
    }
    return {
      levelDb: rmsDb(timeDomain),
      centroid: spectralCentroid(dbToMagnitudes(frequencyDb, this.magnitudes), this.binHz),
      flux: this.flux.update(frequencyDb),
      bands: logBands(frequencyDb, this.binHz, this.bands),
    }
  }
}
