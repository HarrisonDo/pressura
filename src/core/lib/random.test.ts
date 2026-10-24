import { describe, expect, it } from 'vitest'
import { createRng, hashString } from './random'

describe('createRng', () => {
  it('同一 seed 产生完全相同的序列', () => {
    const a = createRng(42)
    const b = createRng(42)
    const seqA = Array.from({ length: 100 }, () => a.next())
    const seqB = Array.from({ length: 100 }, () => b.next())
    expect(seqA).toEqual(seqB)
  })

  it('不同 seed 产生不同序列', () => {
    const a = createRng(1)
    const b = createRng(2)
    expect(a.next()).not.toBe(b.next())
  })

  it('输出落在 [0, 1) 且大致均匀', () => {
    const rng = createRng(7)
    let sum = 0
    for (let i = 0; i < 10000; i++) {
      const v = rng.next()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
      sum += v
    }
    expect(sum / 10000).toBeGreaterThan(0.48)
    expect(sum / 10000).toBeLessThan(0.52)
  })

  it('int 包含两端', () => {
    const rng = createRng(3)
    const seen = new Set<number>()
    for (let i = 0; i < 500; i++) seen.add(rng.int(1, 3))
    expect([...seen].sort()).toEqual([1, 2, 3])
  })

  it('direction 返回单位向量', () => {
    const rng = createRng(9)
    for (let i = 0; i < 50; i++) {
      const [x, y, z] = rng.direction()
      expect(Math.hypot(x, y, z)).toBeCloseTo(1, 6)
    }
  })

  it('fork 是确定性的，且不影响父序列', () => {
    const parent1 = createRng(10)
    const parent2 = createRng(10)
    const childA = parent1.fork('trees')
    const childB = parent2.fork('trees')
    expect(childA.next()).toBe(childB.next())
    expect(parent1.next()).toBe(parent2.next())
    expect(createRng(10).fork('a').next()).not.toBe(createRng(10).fork('b').next())
  })
})

describe('hashString', () => {
  it('稳定且区分不同字符串', () => {
    expect(hashString('ice')).toBe(hashString('ice'))
    expect(hashString('ice')).not.toBe(hashString('fire'))
  })
})
