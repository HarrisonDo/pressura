/**
 * 特征输入源：真实麦克风或模拟输入。会话只认 FeatureFrame，不关心来源。
 * 将来 agent 宠物插件也可以实现这个接口，喂入自己的信号。
 */
import type { EmotionType } from '../types'
import { createRng } from '../lib/random'
import { damp } from '../lib/math'
import { FeatureExtractor, type FeatureFrame } from './features'
import { createVoicePattern, type VoicePattern } from './synthetic'

export interface FeatureSource {
  readonly kind: 'mic' | 'sim'
  start(): Promise<void>
  read(dt: number): FeatureFrame
  stop(): void
}

export type MicErrorCode = 'insecure' | 'unsupported' | 'denied' | 'no-device' | 'busy' | 'unknown'

export class MicError extends Error {
  readonly code: MicErrorCode
  constructor(code: MicErrorCode, message: string) {
    super(message)
    this.name = 'MicError'
    this.code = code
  }
}

function toMicError(err: unknown): MicError {
  const name = err instanceof DOMException || err instanceof Error ? err.name : ''
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return new MicError('denied', '麦克风权限被拒绝')
    case 'NotFoundError':
    case 'OverconstrainedError':
      return new MicError('no-device', '没有找到麦克风')
    case 'NotReadableError':
    case 'AbortError':
      return new MicError('busy', '麦克风被占用或无法读取')
    default:
      return new MicError('unknown', err instanceof Error ? err.message : String(err))
  }
}

export interface MicSourceOptions {
  /** 麦克风被拔掉、被系统收回时触发 */
  onEnded?: () => void
}

export class MicSource implements FeatureSource {
  readonly kind = 'mic' as const
  private ctx: AudioContext | null = null
  private stream: MediaStream | null = null
  private analyser: AnalyserNode | null = null
  private timeDomain = new Float32Array(0)
  private frequency = new Float32Array(0)
  private extractor: FeatureExtractor | null = null
  private readonly options: MicSourceOptions

  constructor(options: MicSourceOptions = {}) {
    this.options = options
  }

  /** 必须在用户点击等手势里调用，否则浏览器不允许启动音频 */
  async start(): Promise<void> {
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      throw new MicError('insecure', '页面不是安全连接（HTTPS）')
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new MicError('unsupported', '浏览器不支持麦克风采集')
    }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          // 关闭浏览器的音频处理：自动增益会把呐喊压平，降噪会吞掉叹气
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 1,
        },
        video: false,
      })
    } catch (err) {
      throw toMicError(err)
    }

    for (const track of this.stream.getAudioTracks()) {
      track.addEventListener('ended', () => this.options.onEnded?.())
    }

    const ctx = new AudioContext()
    this.ctx = ctx
    if (ctx.state === 'suspended') await ctx.resume()

    const analyser = ctx.createAnalyser()
    analyser.fftSize = 2048
    analyser.smoothingTimeConstant = 0.2
    analyser.minDecibels = -100
    analyser.maxDecibels = -10
    ctx.createMediaStreamSource(this.stream).connect(analyser)
    this.analyser = analyser
    this.timeDomain = new Float32Array(analyser.fftSize)
    this.frequency = new Float32Array(analyser.frequencyBinCount)
    this.extractor = new FeatureExtractor(ctx.sampleRate, analyser.fftSize)
  }

  read(): FeatureFrame {
    if (!this.analyser || !this.extractor) {
      return { levelDb: -100, centroid: 0, flux: 0, bands: null }
    }
    this.analyser.getFloatTimeDomainData(this.timeDomain)
    this.analyser.getFloatFrequencyData(this.frequency)
    return this.extractor.extract(this.timeDomain, this.frequency)
  }

  stop(): void {
    this.stream?.getTracks().forEach((track) => track.stop())
    this.stream = null
    this.analyser = null
    this.extractor = null
    if (this.ctx && this.ctx.state !== 'closed') void this.ctx.close()
    this.ctx = null
  }
}

/** 模拟输入：按住时 drive 逐渐升到 1，松开后回落 */
export class SimSource implements FeatureSource {
  readonly kind = 'sim' as const
  private held = false
  private drive = 0
  private pattern: VoicePattern
  private styleValue: EmotionType
  private readonly seed: number

  constructor(style: EmotionType, seed: number) {
    this.styleValue = style
    this.seed = seed
    this.pattern = createVoicePattern(style, createRng(seed))
  }

  get style(): EmotionType {
    return this.styleValue
  }

  setStyle(style: EmotionType): void {
    if (style === this.styleValue) return
    this.styleValue = style
    this.pattern = createVoicePattern(style, createRng(this.seed ^ style.length))
  }

  setHeld(held: boolean): void {
    this.held = held
  }

  async start(): Promise<void> {}

  read(dt: number): FeatureFrame {
    this.drive = damp(this.drive, this.held ? 1 : 0, this.held ? 0.35 : 0.12, dt)
    return this.pattern.next(dt, this.drive)
  }

  stop(): void {
    this.held = false
  }
}
