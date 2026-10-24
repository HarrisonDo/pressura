/**
 * 调试面板（快捷键 D）：实时曲线 + 数值 + 材质得分，用来真人试音调参。
 * 自己跑 rAF 画 canvas，不经过 React 渲染。
 */
import { useEffect, useRef } from 'react'
import { live } from '../app/live'
import { toggleDebug } from '../app/controller'
import { EMOTION_NAMES, EMOTION_TYPES } from '../core/types'
import { FORM_COLORS } from '../core/palette'

const HISTORY = 300
const WIDTH = 340
const HEIGHT = 200

interface History {
  level: Float32Array
  floor: Float32Array
  loud: Float32Array
  pressure: Float32Array
  flux: Float32Array
  marks: Uint8Array // 0 无, 1 起音, 2 强突发
  head: number
  onsetCount: number
  burstCount: number
}

function createHistory(): History {
  return {
    level: new Float32Array(HISTORY).fill(-100),
    floor: new Float32Array(HISTORY).fill(-100),
    loud: new Float32Array(HISTORY),
    pressure: new Float32Array(HISTORY),
    flux: new Float32Array(HISTORY),
    marks: new Uint8Array(HISTORY),
    head: 0,
    onsetCount: 0,
    burstCount: 0,
  }
}

export function DebugPanel() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const textRef = useRef<HTMLPreElement>(null)
  const barsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = WIDTH * dpr
    canvas.height = HEIGHT * dpr
    ctx.scale(dpr, dpr)

    const h = createHistory()
    let id = 0
    let frame = 0

    const draw = () => {
      id = requestAnimationFrame(draw)
      const s = live.snapshot
      if (!s) return

      const i = h.head
      h.level[i] = s.levelDb
      h.floor[i] = s.floorDb
      h.loud[i] = s.loud
      h.pressure[i] = s.pressure
      h.flux[i] = s.flux
      h.marks[i] = s.burstCount > h.burstCount ? 2 : s.onsetCount > h.onsetCount ? 1 : 0
      h.onsetCount = s.onsetCount
      h.burstCount = s.burstCount
      h.head = (i + 1) % HISTORY

      ctx.clearRect(0, 0, WIDTH, HEIGHT)
      ctx.fillStyle = 'rgba(255,255,255,0.04)'
      for (let y = 0; y <= 4; y++) ctx.fillRect(0, (y * HEIGHT) / 4, WIDTH, 1)

      const x = (k: number) => (k / (HISTORY - 1)) * WIDTH
      const at = (k: number) => (h.head + k) % HISTORY

      for (let k = 0; k < HISTORY; k++) {
        const m = h.marks[at(k)]
        if (!m) continue
        ctx.fillStyle = m === 2 ? 'rgba(255,90,60,0.9)' : 'rgba(255,220,90,0.55)'
        ctx.fillRect(x(k), 0, 1.5, HEIGHT)
      }

      const line = (data: Float32Array, map: (v: number) => number, color: string, width = 1.25) => {
        ctx.beginPath()
        for (let k = 0; k < HISTORY; k++) {
          const y = HEIGHT - map(data[at(k)]) * HEIGHT
          if (k === 0) ctx.moveTo(x(k), y)
          else ctx.lineTo(x(k), y)
        }
        ctx.strokeStyle = color
        ctx.lineWidth = width
        ctx.stroke()
      }
      const db = (v: number) => (v + 100) / 100
      line(h.floor, db, 'rgba(255,255,255,0.35)')
      line(h.level, db, '#5fb4ff')
      line(h.flux, (v) => Math.min(1, v / 30), 'rgba(255,170,80,0.7)', 1)
      line(h.loud, (v) => v, '#ffffff', 1.5)
      line(h.pressure, (v) => v, '#b28cff', 2)

      // 文字和得分条降到约 15 Hz 刷新
      if (frame++ % 4 !== 0) return
      const st = s.stats
      if (textRef.current) {
        textRef.current.textContent = [
          `阶段 ${s.phase.padEnd(11)} 材质 ${EMOTION_NAMES[s.form]}`,
          `电平 ${s.levelDb.toFixed(1).padStart(6)} dB  底噪 ${s.floorDb.toFixed(1)} dB`,
          `强度 ${s.loud.toFixed(2)}  平滑 ${s.intensity.toFixed(2)}  压力 ${(s.pressure * 100).toFixed(1)}%`,
          `质心 ${Math.round(s.centroid).toString().padStart(5)} Hz  通量 ${s.flux.toFixed(1)}`,
          `均强 ${st.meanLoud.toFixed(2)}  起伏 ${st.loudStd.toFixed(2)}  亮度 ${st.centroidNorm.toFixed(2)}`,
          `起音 ${st.onsetRate.toFixed(2)}/s  突发 ${st.burstRate.toFixed(2)}/s  连续 ${st.voicedRatio.toFixed(2)}`,
          `安静 ${s.silentFor.toFixed(1)}s  倒计时 ${(s.settle * 100).toFixed(0)}%`,
        ].join('\n')
      }
      if (barsRef.current) {
        const rows = barsRef.current.children
        EMOTION_TYPES.forEach((type, idx) => {
          const row = rows[idx] as HTMLElement | undefined
          if (!row) return
          row.style.setProperty('--session', String(s.scores[type]))
          row.style.setProperty('--window', String(s.windowScores[type]))
        })
      }
    }
    id = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(id)
  }, [])

  return (
    <aside className="debug-panel" aria-label="声音调试面板">
      <div className="debug-head">
        <strong>声音调试</strong>
        <button type="button" className="icon-btn small" onClick={toggleDebug} aria-label="关闭调试面板">
          ✕
        </button>
      </div>
      <canvas ref={canvasRef} style={{ width: WIDTH, height: HEIGHT }} className="debug-chart" />
      <p className="debug-legend">
        <span style={{ color: '#5fb4ff' }}>电平</span> <span style={{ color: '#bbb' }}>底噪</span>{' '}
        <span>强度</span> <span style={{ color: '#b28cff' }}>压力</span>{' '}
        <span style={{ color: '#ffaa50' }}>通量</span> <span style={{ color: '#ffdc5a' }}>起音</span>{' '}
        <span style={{ color: '#ff5a3c' }}>突发</span>
      </p>
      <pre ref={textRef} className="debug-text" />
      <div ref={barsRef} className="debug-bars">
        {EMOTION_TYPES.map((type) => (
          <div key={type} className="debug-bar" style={{ ['--c' as string]: FORM_COLORS[type] }}>
            <span>{EMOTION_NAMES[type]}</span>
            <div className="debug-bar-track">
              <div className="debug-bar-session" />
              <div className="debug-bar-window" />
            </div>
          </div>
        ))}
      </div>
      <p className="debug-legend">实心 = 整段得分，描边 = 最近 4 秒</p>
    </aside>
  )
}
