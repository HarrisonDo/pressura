/**
 * 每帧变化的实时数据。渲染层在 useFrame 里直接读，HUD 以低频采样读，都不触发 React 渲染。
 */
import type { SessionSnapshot } from '../core/audio'
import type { ArtifactEffect, ArtifactState, Vec3 } from '../core/artifact/rules'
import type { EmotionType } from '../core/types'

export interface ArtifactLive {
  type: EmotionType
  state: ArtifactState
  /** 尚未被场景消费的视觉特效 */
  effects: ArtifactEffect[]
  tool: 'plant' | 'water' | 'gasoline' | 'knock'
  /** 正在倾倒液体的位置（相对标本中心），没在倒时为 null */
  pouring: Vec3 | null
}

export interface ArtifactPointerEvent {
  kind: 'down' | 'up' | 'double' | 'move'
  point: Vec3
  normal: Vec3
}

export interface LiveData {
  snapshot: SessionSnapshot | null
  artifact: ArtifactLive | null
  /** 场景把点击/拖动交给应用处理 */
  onArtifactPointer: ((event: ArtifactPointerEvent) => void) | null
  /** 场景提供的截图函数 */
  capture: (() => string) | null
}

export const live: LiveData = { snapshot: null, artifact: null, onArtifactPointer: null, capture: null }
