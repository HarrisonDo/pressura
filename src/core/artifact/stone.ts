/**
 * 石头的确定性塑形：给单位球面上的一点，算出三种形态下的位置 ——
 *   smooth  卵石（光滑、略扁长）
 *   rough   粗石（分形起伏 + 棱角）
 *   cracked 裂岩（在粗石基础上沿几条裂缝向内凹陷）
 * 以及该点的裂缝强度（给熔岩发光用）和凹陷程度（给明暗用）。
 */
import { createNoise3D, fbm, ridged } from '../lib/noise'
import { createRng } from '../lib/random'

export interface StonePoint {
  smooth: [number, number, number]
  rough: [number, number, number]
  cracked: [number, number, number]
  /** 0~1，越靠近裂缝中心越大 */
  crack: number
  /** -1~1，负值为凹处 */
  cavity: number
}

interface Crack {
  normal: [number, number, number]
  /** 裂缝只覆盖半个球面左右，用这个方向做遮罩 */
  mask: [number, number, number]
  width: number
  depth: number
}

export type StoneShaper = (x: number, y: number, z: number) => StonePoint

export function createStoneShaper(seed: number): StoneShaper {
  const rng = createRng(seed).fork('stone')
  const noise = createNoise3D(rng.fork('noise'))
  const elongation: [number, number, number] = [rng.range(1.05, 1.2), rng.range(0.82, 0.92), rng.range(0.95, 1.08)]
  const offset = [rng.range(0, 100), rng.range(0, 100), rng.range(0, 100)]

  const crackCount = rng.int(3, 4)
  const cracks: Crack[] = Array.from({ length: crackCount }, () => ({
    normal: rng.direction(),
    mask: rng.direction(),
    width: rng.range(0.06, 0.1),
    depth: rng.range(0.1, 0.16),
  }))

  return (x, y, z) => {
    const ox = x + offset[0]
    const oy = y + offset[1]
    const oz = z + offset[2]
    const base = 0.06 * noise(ox * 1.2, oy * 1.2, oz * 1.2)
    const relief = 0.2 * fbm(noise, ox * 1.8, oy * 1.8, oz * 1.8, 4) + 0.09 * (ridged(noise, ox * 3.2, oy * 3.2, oz * 3.2) - 0.5)

    let crack = 0
    let dent = 0
    for (let k = 0; k < cracks.length; k++) {
      const c = cracks[k]
      const wobble = 0.07 * noise(x * 4 + k * 7, y * 4, z * 4)
      const d = Math.abs(x * c.normal[0] + y * c.normal[1] + z * c.normal[2] + wobble)
      if (d >= c.width) continue
      const coverage = smooth01((x * c.mask[0] + y * c.mask[1] + z * c.mask[2] + 0.25) / 0.5)
      const strength = (1 - d / c.width) * coverage
      crack = Math.max(crack, strength)
      dent = Math.max(dent, c.depth * strength ** 1.5)
    }

    const rSmooth = 1 + base
    const rRough = 1 + base + relief
    const rCracked = rRough - dent
    const scale = (r: number): [number, number, number] => [x * r * elongation[0], y * r * elongation[1], z * r * elongation[2]]

    return {
      smooth: scale(rSmooth),
      rough: scale(rRough),
      cracked: scale(rCracked),
      crack,
      cavity: Math.max(-1, Math.min(1, relief * 5 - dent * 4)),
    }
  }
}

const smooth01 = (t: number): number => {
  const c = Math.max(0, Math.min(1, t))
  return c * c * (3 - 2 * c)
}
