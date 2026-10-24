import { describe, expect, it } from 'vitest'
import { BAND_COUNT, FeatureExtractor, logBands, rmsDb, SpectralFlux, spectralCentroid } from './features'

const SAMPLE_RATE = 48000
const FFT = 2048
const BIN_HZ = SAMPLE_RATE / FFT

function sine(freq: number, amplitude: number, length = FFT): Float32Array {
  const out = new Float32Array(length)
  for (let i = 0; i < length; i++) out[i] = amplitude * Math.sin((2 * Math.PI * freq * i) / SAMPLE_RATE)
  return out
}

function spectrumWithPeak(peakHz: number, peakDb = -20, restDb = -100): Float32Array {
  const db = new Float32Array(FFT / 2).fill(restDb)
  db[Math.round(peakHz / BIN_HZ)] = peakDb
  return db
}

describe('rmsDb', () => {
  it('满幅正弦约为 -3 dBFS', () => {
    expect(rmsDb(sine(440, 1, 48000))).toBeCloseTo(-3.01, 1)
  })

  it('幅度减半约低 6 dB', () => {
    const full = rmsDb(sine(440, 1, 48000))
    const half = rmsDb(sine(440, 0.5, 48000))
    expect(full - half).toBeCloseTo(6.02, 1)
  })

  it('静音钳制在 -100', () => {
    expect(rmsDb(new Float32Array(1024))).toBe(-100)
    expect(rmsDb(new Float32Array(0))).toBe(-100)
  })
})

describe('spectralCentroid', () => {
  it('单峰频谱的质心就是峰值频率', () => {
    const db = spectrumWithPeak(1000, -10, -200)
    const mags = db.map((v) => 10 ** (v / 20))
    expect(spectralCentroid(mags, BIN_HZ)).toBeGreaterThan(950)
    expect(spectralCentroid(mags, BIN_HZ)).toBeLessThan(1050)
  })

  it('高频能量多则质心更高', () => {
    const toMags = (db: Float32Array) => db.map((v) => 10 ** (v / 20))
    const low = spectralCentroid(toMags(spectrumWithPeak(500, -10, -120)), BIN_HZ)
    const high = spectralCentroid(toMags(spectrumWithPeak(3000, -10, -120)), BIN_HZ)
    expect(high).toBeGreaterThan(low)
  })

  it('全零返回 0', () => {
    expect(spectralCentroid(new Float32Array(1024), BIN_HZ)).toBe(0)
  })
})

describe('SpectralFlux', () => {
  it('第一帧为 0，相同频谱为 0，整体抬高 10 dB 约为 10', () => {
    const flux = new SpectralFlux(BIN_HZ)
    const quiet = new Float32Array(FFT / 2).fill(-80)
    const loud = new Float32Array(FFT / 2).fill(-70)
    expect(flux.update(quiet)).toBe(0)
    expect(flux.update(quiet)).toBe(0)
    expect(flux.update(loud)).toBeCloseTo(10, 5)
    // 变安静不计入正向通量
    expect(flux.update(quiet)).toBe(0)
  })

  it('-Infinity 不会产生 NaN', () => {
    const flux = new SpectralFlux(BIN_HZ)
    flux.update(new Float32Array(FFT / 2).fill(Number.NEGATIVE_INFINITY))
    expect(Number.isFinite(flux.update(new Float32Array(FFT / 2).fill(-50)))).toBe(true)
  })
})

describe('logBands', () => {
  it('输出在 0~1，峰值所在频带最亮', () => {
    const out = new Float32Array(BAND_COUNT)
    logBands(spectrumWithPeak(1000, -25), BIN_HZ, out)
    let maxIndex = 0
    for (let i = 0; i < out.length; i++) {
      expect(out[i]).toBeGreaterThanOrEqual(0)
      expect(out[i]).toBeLessThanOrEqual(1)
      if (out[i] > out[maxIndex]) maxIndex = i
    }
    expect(out[maxIndex]).toBe(1)
    // 1 kHz 在 60~8000 Hz 对数刻度上大约位于 57% 处
    expect(maxIndex / BAND_COUNT).toBeGreaterThan(0.5)
    expect(maxIndex / BAND_COUNT).toBeLessThan(0.65)
  })
})

describe('FeatureExtractor', () => {
  it('组合出完整的一帧', () => {
    const extractor = new FeatureExtractor(SAMPLE_RATE, FFT)
    const frame = extractor.extract(sine(1000, 0.1), spectrumWithPeak(1000, -30, -110))
    expect(frame.levelDb).toBeCloseTo(-23, 0)
    expect(frame.centroid).toBeGreaterThan(900)
    expect(frame.flux).toBe(0)
    expect(frame.bands).toHaveLength(BAND_COUNT)
  })
})
