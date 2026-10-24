/**
 * 声音引擎的全部可调参数集中在这里，调试面板可以实时查看效果。
 * 数值是按"笔记本内置麦克风、关闭自动增益、安静房间"估的初值，需要真人试音后微调。
 */
export interface AudioTuning {
  /** 开场测环境底噪的时长（秒） */
  calibrationSeconds: number

  /** 高于底噪多少 dB 才算在发声 */
  gateDb: number
  /** 从 gate 往上多少 dB 映射到满强度 1.0 */
  rangeDb: number

  /** 满强度时压力每秒增长量 */
  baseRate: number
  /** 再轻的声音也能拿到的最低增长比例（让低语也能慢慢长大） */
  quietShare: number
  /** 强度 → 增长速度的曲线指数 */
  curve: number
  /** 每次强突发额外增加的压力 */
  burstBonus: number

  /** 起音检测：频谱通量均值/方差的平滑时间（秒） */
  onsetTau: number
  /** 起音阈值 = 均值 + k × 标准差 */
  onsetK: number
  /** 起音的最小通量（dB/频点） */
  onsetMinFlux: number
  /** 起音时的最小强度 */
  onsetMinLoud: number
  /** 两次起音的最短间隔（秒） */
  onsetRefractory: number
  /** 起音时强度超过这个值算"强突发" */
  burstLoud: number

  /** 压力达到这个值时，种子定型为具体材质 */
  lockPressure: number
  /** 近期窗口里另一种材质领先多少分才考虑转变 */
  shiftMargin: number
  /** 领先需要持续多久（秒）才真正转变 */
  shiftHold: number
  /** 转变后的冷却时间（秒） */
  shiftCooldown: number
  /** "近期窗口"的长度（秒） */
  windowSeconds: number

  /** 从第一次发声算起，至少多长时间才允许凝结（秒） */
  minDurationSeconds: number
  /** 至少多少压力才允许凝结 */
  minPressure: number
  /** 安静多久后开始显示凝结倒计时（秒） */
  settleDelay: number
  /** 安静多久后正式凝结（秒，含 settleDelay） */
  settleSeconds: number

  /** 底噪允许的范围（dBFS） */
  floorMinDb: number
  floorMaxDb: number
  /** 电平低于底噪时，底噪下探的平滑时间（秒） */
  floorFallTau: number
  /** 电平略高于底噪时，底噪上浮的平滑时间（秒） */
  floorRiseTau: number
  /** 只有高出底噪不到这么多 dB 时才允许上浮（避免把人声当底噪） */
  floorRiseWindowDb: number

  /** 频谱质心（功率加权）归一化区间（Hz）：低于 low 记为 0，高于 high 记为 1 */
  centroidLowHz: number
  centroidHighHz: number
}

export const DEFAULT_TUNING: AudioTuning = {
  calibrationSeconds: 1.5,

  gateDb: 6,
  rangeDb: 42,

  baseRate: 0.065,
  quietShare: 0.25,
  curve: 1.3,
  burstBonus: 0.012,

  onsetTau: 1.5,
  onsetK: 1.8,
  onsetMinFlux: 2.5,
  onsetMinLoud: 0.12,
  onsetRefractory: 0.12,
  burstLoud: 0.65,

  lockPressure: 0.15,
  shiftMargin: 0.25,
  shiftHold: 3,
  shiftCooldown: 6,
  windowSeconds: 4,

  minDurationSeconds: 5,
  minPressure: 0.1,
  settleDelay: 0.8,
  settleSeconds: 3,

  floorMinDb: -90,
  floorMaxDb: -35,
  floorFallTau: 0.8,
  floorRiseTau: 10,
  floorRiseWindowDb: 6,

  centroidLowHz: 250,
  centroidHighHz: 2000,
}
