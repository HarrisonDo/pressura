/**
 * 每帧的视觉驱动状态：由 Director 从会话快照推导，所有场景组件在 useFrame 里读取。
 * 纯逻辑，不依赖 three.js，方便单测。
 */
import type { SessionSnapshot } from '../core/audio'
import { BAND_COUNT } from '../core/audio/features'
import { clamp, damp } from '../core/lib/math'
import { stageOf } from '../core/palette'
import type { GrowthForm } from '../core/types'

/** 材质切换的过渡时长（秒） */
export const MORPH_SECONDS = 1.4

export interface VisualState {
  /** idle：起始页，没有会话；live：录制中或刚结束 */
  mode: 'idle' | 'live'
  form: GrowthForm
  /** 过渡前的材质；没有过渡时与 form 相同 */
  from: GrowthForm
  /** 过渡进度 0~1 */
  morph: number
  /** 平滑后的压力（视觉用） */
  pressure: number
  intensity: number
  voiced: boolean
  /** 强突发脉冲，触发时为 1，快速衰减 */
  burst: number
  /** 定型 / 进入新阶段时的闪光，触发后衰减 */
  flash: number
  stage: number
  time: number
  bands: Float32Array
  reducedMotion: boolean
  /** 内部：用来识别新会话和新的突发 */
  snapshotRef: SessionSnapshot | null
  burstCount: number
}

export function createVisualState(reducedMotion = false): VisualState {
  return {
    mode: 'idle',
    form: 'seed',
    from: 'seed',
    morph: 1,
    pressure: 0,
    intensity: 0,
    voiced: false,
    burst: 0,
    flash: 0,
    stage: 0,
    time: 0,
    bands: new Float32Array(BAND_COUNT),
    reducedMotion,
    snapshotRef: null,
    burstCount: 0,
  }
}

export function stepVisual(v: VisualState, snap: SessionSnapshot | null, dt: number): void {
  v.time += dt
  v.mode = snap ? 'live' : 'idle'

  if (snap !== v.snapshotRef) {
    // 新会话：计数器从头开始，压力让它平滑缩回去
    v.snapshotRef = snap
    v.burstCount = snap?.burstCount ?? 0
  }

  const targetForm: GrowthForm = snap?.form ?? 'seed'
  if (targetForm !== v.form) {
    v.from = v.morph < 0.5 ? v.from : v.form
    v.form = targetForm
    v.morph = 0
    v.flash = 1
  }
  v.morph = Math.min(1, v.morph + dt / MORPH_SECONDS)
  if (v.morph >= 1) v.from = v.form

  v.pressure = damp(v.pressure, snap?.pressure ?? 0, 0.35, dt)
  v.intensity = snap ? snap.intensity : damp(v.intensity, 0, 0.5, dt)
  v.voiced = snap?.voiced ?? false

  if (snap && snap.burstCount > v.burstCount) {
    v.burstCount = snap.burstCount
    v.burst = 1
  }
  v.burst = damp(v.burst, 0, 0.18, dt)

  const stage = stageOf(v.pressure)
  if (stage > v.stage) v.flash = Math.max(v.flash, 0.6)
  v.stage = stage
  v.flash = damp(v.flash, 0, 0.4, dt)

  if (snap) v.bands.set(snap.bands)
  else v.bands.fill(0)
}

const easeInOut = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2)

/** 某个材质当前的可见权重 0~1（过渡时新旧交叉淡入淡出） */
export function formWeight(v: VisualState, form: GrowthForm): number {
  if (v.from === v.form) return form === v.form ? 1 : 0
  const t = easeInOut(v.morph)
  if (form === v.form) return t
  if (form === v.from) return 1 - t
  return 0
}

/** 定型后实体的"半径"（世界单位），种子期不用这个 */
export function entitySize(pressure: number): number {
  const p = clamp((pressure - 0.15) / 0.85)
  return 0.45 + 1.1 * (1 - (1 - p) ** 1.5)
}

/** 种子的大小 */
export function seedSize(v: VisualState): number {
  if (v.mode === 'idle') return 0.14
  return 0.08 + clamp(v.pressure / 0.15) * 0.24
}

/** 带回弹的出场缩放：权重 0→1 时略微冲过头再回落 */
export function popIn(weight: number): number {
  if (weight <= 0) return 0
  if (weight >= 1) return 1
  const c1 = 1.70158
  const c3 = c1 + 1
  const t = weight - 1
  return 1 + c3 * t * t * t + c1 * t * t
}
