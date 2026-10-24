/**
 * 每帧变化的实时数据。渲染层在 useFrame 里直接读，HUD 以低频采样读，都不触发 React 渲染。
 */
import type { SessionSnapshot } from '../core/audio'

export interface LiveData {
  snapshot: SessionSnapshot | null
}

export const live: LiveData = { snapshot: null }
