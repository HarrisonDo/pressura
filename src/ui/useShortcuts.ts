import { useEffect } from 'react'
import { finishRecording, setSimHeld, toggleDebug } from '../app/controller'
import { useAppStore } from '../app/store'

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))

/** 全局快捷键：D 调试面板，Enter 结束倾诉，模拟模式下按住空格发声 */
export function useShortcuts() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return
      const { phase, inputMode } = useAppStore.getState()

      if (e.code === 'KeyD') {
        toggleDebug()
        return
      }
      if (phase !== 'recording') return
      if (e.code === 'Space' && inputMode === 'sim') {
        e.preventDefault()
        if (!e.repeat) setSimHeld(true)
      } else if (e.code === 'Enter') {
        e.preventDefault()
        finishRecording()
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' && useAppStore.getState().inputMode === 'sim') {
        e.preventDefault()
        setSimHeld(false)
      }
    }
    const onBlur = () => setSimHeld(false)

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [])
}
