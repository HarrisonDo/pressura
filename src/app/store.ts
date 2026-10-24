/**
 * 应用级的低频状态（React 订阅）。每帧变化的数据不放这里，见 live.ts。
 */
import { create } from 'zustand'
import type { EmotionType, GrowthForm } from '../core/types'
import type { MicErrorCode, SessionPhase, SessionResult } from '../core/audio'
import type { ArtifactSignature } from '../core/artifact/signature'
import type { StateSummary } from '../core/artifact/rules'

export type AppPhase = 'onboarding' | 'recording' | 'inspecting' | 'gallery'
export type InputMode = 'mic' | 'sim'
export type MicStatus = 'idle' | 'requesting' | 'ready' | MicErrorCode
export type Tool = 'plant' | 'water' | 'gasoline' | 'knock'

export interface GalleryItem {
  signature: ArtifactSignature
  summary: StateSummary
  /** 完整处置状态（JSON），用于在画廊里重建 */
  state: string
  thumbnail: string
  collectedAt: number
}

export interface AppState {
  phase: AppPhase
  inputMode: InputMode
  micStatus: MicStatus
  simStyle: EmotionType
  sessionPhase: SessionPhase | null
  form: GrowthForm
  result: SessionResult | null
  /** 当前实体的形状种子 */
  seed: number
  signature: ArtifactSignature | null
  summary: StateSummary | null
  tool: Tool
  /** 正在从画廊里查看的藏品 id；null 表示刚凝结的新标本 */
  viewingId: string | null
  gallery: GalleryItem[]
  debugOpen: boolean
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
  seed: 1,
  signature: null,
  summary: null,
  tool: 'plant',
  viewingId: null,
  gallery: [],
  debugOpen: false,
  notice: null,
}

export const useAppStore = create<AppState>()(() => ({ ...initialAppState }))
