import { useEffect, useEffectEvent, useState } from 'react'
import { live } from '../app/live'
import type { SessionSnapshot } from '../core/audio'

/**
 * 以较低频率（默认 12 Hz）从实时快照里采样一个值。
 * read 应返回原始类型（数字请先取整/保留位数），值没变就不会触发重渲染。
 */
export function useLiveSample<T>(read: (s: SessionSnapshot) => T, fallback: T, hz = 12): T {
  const [value, setValue] = useState<T>(() => (live.snapshot ? read(live.snapshot) : fallback))

  const sample = useEffectEvent(() => {
    const snap = live.snapshot
    const next = snap ? read(snap) : fallback
    setValue((prev) => (Object.is(prev, next) ? prev : next))
  })

  useEffect(() => {
    const id = window.setInterval(() => sample(), 1000 / hz)
    return () => window.clearInterval(id)
  }, [hz])

  return value
}
