/**
 * 冰晶簇的确定性生成：悬浮在空中的一团晶簇 ——
 * 一根竖直主晶 + 几根斜向副晶 + 一根向下的坠晶 + 一圈随压力陆续冒出的小晶。
 * 只产出纯数据，由场景层转成几何体。
 */
import { createRng } from '../lib/random'

export interface CrystalSpec {
  /** 生长方向（单位向量） */
  dir: [number, number, number]
  /** 根部偏移（相对晶簇中心） */
  base: [number, number, number]
  /** 满压力时的长度 / 半径（晶簇局部单位） */
  length: number
  radius: number
  /** 压力到这个值时开始冒出 */
  appearAt: number
  /** 绕自身轴的旋转（弧度），让六棱柱棱面错开 */
  twist: number
}

/** 晶体向下伸出的最大程度（方向 y 分量下限） */
export const ICE_MIN_DIR_Y = -0.6

function normalize([x, y, z]: [number, number, number]): [number, number, number] {
  const len = Math.hypot(x, y, z) || 1
  return [x / len, y / len, z / len]
}

export function generateIceCluster(seed: number, count = 34): CrystalSpec[] {
  const rng = createRng(seed).fork('ice-cluster')
  const crystals: CrystalSpec[] = []

  const push = (dir: [number, number, number], length: number, radius: number, appearAt: number) => {
    const d = normalize(dir)
    crystals.push({
      dir: d,
      // 根部埋在中心附近，晶簇看起来是从一个核心里长出来的
      base: [d[0] * -0.12, d[1] * -0.12, d[2] * -0.12],
      length,
      radius,
      appearAt,
      twist: rng.range(0, Math.PI / 3),
    })
  }

  // 主晶：几乎竖直
  push([rng.range(-0.08, 0.08), 1, rng.range(-0.08, 0.08)], 1.35, 0.3, 0)

  // 副晶：与竖直方向成 25°~60°
  const secondary = rng.int(3, 4)
  for (let i = 0; i < secondary; i++) {
    const angle = rng.range(0.45, 1.05)
    const azimuth = (i / secondary) * Math.PI * 2 + rng.range(-0.4, 0.4)
    push(
      [Math.sin(angle) * Math.cos(azimuth), Math.cos(angle), Math.sin(angle) * Math.sin(azimuth)],
      rng.range(0.85, 1.1),
      rng.range(0.19, 0.25),
      rng.range(0.02, 0.2),
    )
  }

  // 坠晶：向下
  push([rng.range(-0.3, 0.3), -1, rng.range(-0.3, 0.3)], rng.range(0.55, 0.75), 0.17, rng.range(0.15, 0.3))

  // 小晶：越晚冒出的越长，压力越高越像一团炸开的冰棱
  const rest = Math.max(0, count - crystals.length)
  const appearTimes = Array.from({ length: rest }, () => rng.range(0.08, 0.9)).sort((a, b) => a - b)
  for (const appearAt of appearTimes) {
    let dir: [number, number, number]
    do dir = rng.direction()
    while (dir[1] < ICE_MIN_DIR_Y)
    push(dir, 0.35 + 0.55 * appearAt + rng.range(0, 0.25), rng.range(0.07, 0.15) + appearAt * 0.05, appearAt)
  }

  return crystals
}
