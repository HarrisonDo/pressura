/**
 * 以 requestAnimationFrame 驱动的循环；dt 有上限，切回标签页时不会一次跳很多。
 * 返回停止函数。
 */
export function startFrameLoop(step: (dt: number) => void, maxDt = 0.1): () => void {
  let last = performance.now()
  let id = 0
  let stopped = false

  const tick = (now: number) => {
    if (stopped) return
    const dt = Math.min(maxDt, Math.max(0, (now - last) / 1000))
    last = now
    if (dt > 0) step(dt)
    id = requestAnimationFrame(tick)
  }

  id = requestAnimationFrame(tick)
  return () => {
    stopped = true
    cancelAnimationFrame(id)
  }
}
