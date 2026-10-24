/**
 * 会话控制器：把输入源、会话和帧循环串起来，并把粗粒度状态同步进 store。
 * 这是"桌面应用外壳"的一部分；将来做宠物插件时换一个控制器即可，core/ 不用动。
 */
import { freshSeed } from '../core/lib/random'
import {
  EmotionSession,
  MicError,
  MicSource,
  SimSource,
  startFrameLoop,
  type FeatureSource,
  type SessionEvent,
} from '../core/audio'
import type { EmotionType, GrowthForm } from '../core/types'
import { live } from './live'
import { useAppStore, type InputMode } from './store'
import { beginInspect, closeArtifact } from './artifactController'

let source: FeatureSource | null = null
let session: EmotionSession | null = null
let stopLoop: (() => void) | null = null
let unsubscribe: (() => void) | null = null
/** 防止快速连点时两次启动交错 */
let startToken = 0

const set = useAppStore.setState
const get = useAppStore.getState

export async function startRecording(mode: InputMode): Promise<void> {
  const token = ++startToken
  teardown()
  closeArtifact()
  set({ seed: freshSeed(), inputMode: mode, micStatus: mode === 'mic' ? 'requesting' : 'ready', notice: null })

  const src: FeatureSource =
    mode === 'mic'
      ? new MicSource({ onEnded: () => handleMicLost() })
      : new SimSource(get().simStyle, freshSeed())

  try {
    await src.start()
  } catch (err) {
    src.stop()
    if (token !== startToken) return
    set({ micStatus: err instanceof MicError ? err.code : 'unknown', phase: 'onboarding' })
    return
  }
  if (token !== startToken) {
    src.stop()
    return
  }

  const s = new EmotionSession()
  source = src
  session = s
  live.snapshot = s.snapshot
  unsubscribe = s.subscribe(handleEvent)
  set({
    phase: 'recording',
    micStatus: 'ready',
    sessionPhase: s.snapshot.phase,
    form: 'seed',
    result: null,
  })
  stopLoop = startFrameLoop((dt) => {
    if (source && session) session.process(source.read(dt), dt)
  })
}

/** 手动结束；内容太少时返回 false */
export function finishRecording(): boolean {
  return session?.finish() ?? false
}

/** 回到起始页 */
export function backToStart(): void {
  startToken++
  teardown()
  closeArtifact()
  live.snapshot = null
  set({ phase: 'onboarding', sessionPhase: null, form: 'seed', result: null, micStatus: 'idle' })
}

export function setSimHeld(held: boolean): void {
  if (source instanceof SimSource) source.setHeld(held)
}

export function setSimStyle(style: EmotionType): void {
  set({ simStyle: style })
  if (source instanceof SimSource) source.setStyle(style)
}

export function toggleDebug(): void {
  set({ debugOpen: !get().debugOpen })
}

function handleEvent(event: SessionEvent): void {
  switch (event.type) {
    case 'phase':
      set({ sessionPhase: event.phase })
      break
    case 'form':
      set({ form: event.form })
      break
    case 'ended':
      // 结束后立刻释放麦克风（浏览器的录音指示灯随之熄灭）；live.snapshot 保留最后一帧给画面用
      teardown()
      set({ result: event.result, form: event.result.type })
      beginInspect(event.result)
      break
    case 'burst':
      break
  }
}

function handleMicLost(): void {
  if (get().phase !== 'recording') return
  const ended = session?.finish() ?? false
  if (!ended) backToStart()
  set({ notice: '麦克风连接中断了。' })
}

function teardown(): void {
  stopLoop?.()
  stopLoop = null
  unsubscribe?.()
  unsubscribe = null
  source?.stop()
  source = null
  session = null
}

export interface PreviewOptions {
  form: GrowthForm
  pressure: number
  /** 平均发声强度，会叠加一个起伏 */
  intensity?: number
  /** 每隔多少秒来一次强突发，0 表示不突发 */
  burstEvery?: number
}

/**
 * 开发用：不经过声音引擎，直接把画面定格在某个材质 / 压力上，给端到端截图和调视觉用。
 */
export function startPreview(options: PreviewOptions): void {
  startToken++
  teardown()
  const snap = new EmotionSession().snapshot
  snap.phase = 'listening'
  snap.form = options.form
  snap.pressure = options.pressure
  live.snapshot = snap
  set({ phase: 'recording', inputMode: 'sim', sessionPhase: 'listening', form: options.form, result: null })
  let t = 0
  let nextBurst = options.burstEvery ?? 0
  stopLoop = startFrameLoop((dt) => {
    t += dt
    const base = options.intensity ?? 0.5
    snap.intensity = base * (0.65 + 0.35 * Math.sin(t * 4.3) * Math.sin(t * 1.7))
    snap.loud = snap.intensity
    snap.voiced = base > 0
    if (options.burstEvery && t >= nextBurst) {
      snap.burstCount++
      nextBurst += options.burstEvery
    }
  })
}

// 开发模式下暴露给端到端测试读取
if (import.meta.env.DEV) {
  window.__PRESSURA__ = { live, getState: get, preview: startPreview }
}

declare global {
  interface Window {
    __PRESSURA__?: { live: typeof live; getState: typeof get; preview: typeof startPreview }
  }
}
