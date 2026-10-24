/**
 * 可设种子的 3D simplex 噪声（Stefan Gustavson 算法），输出约在 [-1, 1]。
 * CPU 端用于程序化生成模型形状，保证同一 seed 生成同一模型。
 */
import type { Rng } from './random'

export type Noise3D = (x: number, y: number, z: number) => number

const GRAD3 = new Float32Array([
  1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0, 1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, -1, 0, 1, 1, 0, -1, 1, 0, 1, -1, 0,
  -1, -1,
])
const F3 = 1 / 3
const G3 = 1 / 6

export function createNoise3D(rng: Rng): Noise3D {
  const p = new Uint8Array(256)
  for (let i = 0; i < 256; i++) p[i] = i
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1))
    const tmp = p[i]
    p[i] = p[j]
    p[j] = tmp
  }
  const perm = new Uint8Array(512)
  const permMod12 = new Uint8Array(512)
  for (let i = 0; i < 512; i++) {
    perm[i] = p[i & 255]
    permMod12[i] = perm[i] % 12
  }

  const corner = (gi: number, x: number, y: number, z: number): number => {
    let t = 0.6 - x * x - y * y - z * z
    if (t < 0) return 0
    t *= t
    return t * t * (GRAD3[gi] * x + GRAD3[gi + 1] * y + GRAD3[gi + 2] * z)
  }

  return (xin, yin, zin) => {
    const s = (xin + yin + zin) * F3
    const i = Math.floor(xin + s)
    const j = Math.floor(yin + s)
    const k = Math.floor(zin + s)
    const t = (i + j + k) * G3
    const x0 = xin - (i - t)
    const y0 = yin - (j - t)
    const z0 = zin - (k - t)

    let i1: number, j1: number, k1: number, i2: number, j2: number, k2: number
    if (x0 >= y0) {
      if (y0 >= z0) [i1, j1, k1, i2, j2, k2] = [1, 0, 0, 1, 1, 0]
      else if (x0 >= z0) [i1, j1, k1, i2, j2, k2] = [1, 0, 0, 1, 0, 1]
      else [i1, j1, k1, i2, j2, k2] = [0, 0, 1, 1, 0, 1]
    } else {
      if (y0 < z0) [i1, j1, k1, i2, j2, k2] = [0, 0, 1, 0, 1, 1]
      else if (x0 < z0) [i1, j1, k1, i2, j2, k2] = [0, 1, 0, 0, 1, 1]
      else [i1, j1, k1, i2, j2, k2] = [0, 1, 0, 1, 1, 0]
    }

    const ii = i & 255
    const jj = j & 255
    const kk = k & 255
    const gi0 = permMod12[ii + perm[jj + perm[kk]]] * 3
    const gi1 = permMod12[ii + i1 + perm[jj + j1 + perm[kk + k1]]] * 3
    const gi2 = permMod12[ii + i2 + perm[jj + j2 + perm[kk + k2]]] * 3
    const gi3 = permMod12[ii + 1 + perm[jj + 1 + perm[kk + 1]]] * 3

    return (
      32 *
      (corner(gi0, x0, y0, z0) +
        corner(gi1, x0 - i1 + G3, y0 - j1 + G3, z0 - k1 + G3) +
        corner(gi2, x0 - i2 + 2 * G3, y0 - j2 + 2 * G3, z0 - k2 + 2 * G3) +
        corner(gi3, x0 - 1 + 3 * G3, y0 - 1 + 3 * G3, z0 - 1 + 3 * G3))
    )
  }
}

/** 分形叠加，输出约在 [-1, 1] */
export function fbm(noise: Noise3D, x: number, y: number, z: number, octaves = 4): number {
  let sum = 0
  let amp = 0.5
  let freq = 1
  let norm = 0
  for (let o = 0; o < octaves; o++) {
    sum += amp * noise(x * freq, y * freq, z * freq)
    norm += amp
    amp *= 0.5
    freq *= 2
  }
  return sum / norm
}

/** 脊状噪声，输出 [0, 1]，适合岩石棱角 */
export function ridged(noise: Noise3D, x: number, y: number, z: number, octaves = 3): number {
  let sum = 0
  let amp = 0.5
  let freq = 1
  let norm = 0
  for (let o = 0; o < octaves; o++) {
    const n = 1 - Math.abs(noise(x * freq, y * freq, z * freq))
    sum += amp * n * n
    norm += amp
    amp *= 0.5
    freq *= 2
  }
  return sum / norm
}
