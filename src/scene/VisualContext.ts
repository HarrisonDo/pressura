import { createContext, useContext } from 'react'
import type { VisualState } from './visual'

export const VisualContext = createContext<VisualState | null>(null)

export function useVisual(): VisualState {
  const v = useContext(VisualContext)
  if (!v) throw new Error('useVisual 必须在 <Stage> 内使用')
  return v
}
