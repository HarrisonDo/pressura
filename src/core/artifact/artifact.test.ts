import { describe, expect, it } from 'vitest'
import { createNoise3D, fbm, ridged } from '../lib/noise'
import { createRng } from '../lib/random'
import { generateIceCluster } from './ice'
import { createStoneShaper } from './stone'

describe('noise', () => {
  it('同一种子输出相同，取值约在 [-1, 1]', () => {
    const a = createNoise3D(createRng(1))
    const b = createNoise3D(createRng(1))
    let min = Infinity
    let max = -Infinity
    for (let i = 0; i < 2000; i++) {
      const x = i * 0.137
      const y = i * 0.071
      const z = i * 0.29
      const v = a(x, y, z)
      expect(v).toBe(b(x, y, z))
      min = Math.min(min, v)
      max = Math.max(max, v)
    }
    expect(min).toBeGreaterThanOrEqual(-1.05)
    expect(max).toBeLessThanOrEqual(1.05)
    expect(max - min).toBeGreaterThan(1)
  })

  it('fbm / ridged 落在预期区间', () => {
    const n = createNoise3D(createRng(2))
    for (let i = 0; i < 500; i++) {
      const f = fbm(n, i * 0.3, i * 0.2, i * 0.1)
      const r = ridged(n, i * 0.3, i * 0.2, i * 0.1)
      expect(Math.abs(f)).toBeLessThanOrEqual(1.05)
      expect(r).toBeGreaterThanOrEqual(0)
      expect(r).toBeLessThanOrEqual(1)
    }
  })
})

describe('generateIceCluster', () => {
  it('同一种子生成同一晶簇', () => {
    expect(generateIceCluster(42)).toEqual(generateIceCluster(42))
    expect(generateIceCluster(42)).not.toEqual(generateIceCluster(43))
  })

  it('第一根是竖直主晶，方向、出现时间都在合理范围', () => {
    const crystals = generateIceCluster(7)
    expect(crystals).toHaveLength(34)
    expect(crystals[0].appearAt).toBe(0)
    expect(crystals[0].dir[1]).toBeGreaterThan(0.98)
    expect(crystals.some((c) => c.dir[1] < -0.8)).toBe(true)
    for (const c of crystals) {
      expect(Math.hypot(...c.dir)).toBeCloseTo(1, 6)
      expect(c.dir[1]).toBeGreaterThanOrEqual(-1)
      expect(c.appearAt).toBeGreaterThanOrEqual(0)
      expect(c.appearAt).toBeLessThan(0.95)
    }
  })
})

describe('createStoneShaper', () => {
  it('确定性，且三种形态都在合理半径内', () => {
    const a = createStoneShaper(5)
    const b = createStoneShaper(5)
    const rng = createRng(9)
    for (let i = 0; i < 300; i++) {
      const [x, y, z] = rng.direction()
      const pa = a(x, y, z)
      expect(pa).toEqual(b(x, y, z))
      for (const pos of [pa.smooth, pa.rough, pa.cracked]) {
        const r = Math.hypot(...pos)
        expect(r).toBeGreaterThan(0.5)
        expect(r).toBeLessThan(1.6)
      }
      expect(pa.crack).toBeGreaterThanOrEqual(0)
      expect(pa.crack).toBeLessThanOrEqual(1)
      // 裂岩只会比粗石更凹
      expect(Math.hypot(...pa.cracked)).toBeLessThanOrEqual(Math.hypot(...pa.rough) + 1e-9)
    }
  })

  it('有一部分表面落在裂缝上', () => {
    const shaper = createStoneShaper(11)
    const rng = createRng(3)
    let cracked = 0
    for (let i = 0; i < 2000; i++) {
      const [x, y, z] = rng.direction()
      if (shaper(x, y, z).crack > 0.3) cracked++
    }
    expect(cracked).toBeGreaterThan(40)
    expect(cracked).toBeLessThan(800)
  })
})
