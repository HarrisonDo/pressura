/**
 * 应用级的低频状态（React 订阅）。每帧变化的数据不放这里，见 live.ts。
 */
import { create } from 'zustand'
import type { EmotionType, GrowthForm } from '../core/types'
import type { MicErrorCode, SessionPhase, SessionResult } from '../core/audio'

export type AppPhase = 'onboarding' | 'recording' | 'result'
export type InputMode = 'mic' | 'sim'
export type MicStatus = 'idle' | 'requesting' | 'ready' | MicErrorCode

export interface AppState {
  phase: AppPhase
  inputMode: InputMode
  micStatus: MicStatus
  simStyle: EmotionType
  sessionPhase: SessionPhase | null
  form: GrowthForm
  result: SessionResult | null
  debugOpen: boolean
  /** 录音中途麦克风断开等异常提示 */
  notice: string | null
}

export const initialAppState: AppState = {
  phase: 'onboarding',
  inputMode: 'mic',
  micStatus: 'idle',
  simStyle: 'fire',
  sessionPhase: null,
  form: 'seed',
  result: null,
  debugOpen: false,
  notice: null,
}

export const useAppStore = create<AppState>()(() => ({ ...initialAppState }))
