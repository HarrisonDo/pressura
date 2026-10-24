import { useState, type PointerEvent } from 'react'
import { finishRecording, setSimHeld, setSimStyle, toggleDebug } from '../app/controller'
import { useAppStore } from '../app/store'
import { EMOTION_LABELS, EMOTION_NAMES, EMOTION_TYPES, type GrowthForm } from '../core/types'
import { FORM_COLORS, FORM_ICONS, STAGE_THRESHOLDS, stageOf } from '../core/palette'
import { useLiveSample } from './useLiveSample'

const pct = (v: number) => Math.round(v * 100)

export function RecordingHud() {
  const form = useAppStore((s) => s.form)
  const sessionPhase = useAppStore((s) => s.sessionPhase)
  const inputMode = useAppStore((s) => s.inputMode)
  const pressure = useLiveSample((s) => Math.round(s.pressure * 1000) / 1000, 0)
  const color = FORM_COLORS[form]

  return (
    <div className="hud" style={{ ['--form-color' as string]: color }}>
      <header className="hud-top">
        <FormBadge form={form} />
        <PressureMeter pressure={pressure} />
      </header>

      <button
        type="button"
        className="icon-btn hud-debug"
        onClick={toggleDebug}
        aria-label="切换调试面板（快捷键 D）"
        title="调试面板（D）"
      >
        ⌁
      </button>

      <FormToast form={form} />

      <footer className="hud-bottom">
        <PhaseHint phase={sessionPhase} pressure={pressure} sim={inputMode === 'sim'} form={form} />
        {inputMode === 'sim' && <SimControls />}
        <button
          type="button"
          className="btn btn-quiet"
          onClick={() => finishRecording()}
          disabled={pressure < 0.02}
          title="结束（Enter）"
        >
          结束倾诉
        </button>
      </footer>
    </div>
  )
}

function FormBadge({ form }: { form: GrowthForm }) {
  return (
    <div className="form-badge" aria-live="polite">
      <span aria-hidden="true">{FORM_ICONS[form]}</span>
      <span>{EMOTION_LABELS[form]}</span>
    </div>
  )
}

function PressureMeter({ pressure }: { pressure: number }) {
  const stage = stageOf(pressure)
  return (
    <div className="pressure">
      <div className="pressure-label">
        <span>压力</span>
        <span className="pressure-value">{pct(pressure)}%</span>
        <span className="pressure-stage">第 {stage + 1} 阶段</span>
      </div>
      <div
        className="pressure-track"
        role="progressbar"
        aria-label="情绪压力"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct(pressure)}
      >
        <div className="pressure-fill" style={{ width: `${pressure * 100}%` }} />
        {STAGE_THRESHOLDS.slice(1).map((t) => (
          <span key={t} className="pressure-tick" style={{ left: `${t * 100}%` }} />
        ))}
      </div>
    </div>
  )
}

function PhaseHint({
  phase,
  pressure,
  sim,
  form,
}: {
  phase: string | null
  pressure: number
  sim: boolean
  form: GrowthForm
}) {
  const calibration = useLiveSample((s) => Math.round(s.calibration * 100), 0)
  const settle = useLiveSample((s) => Math.round(s.settle * 100) / 100, 0, 30)

  let text = ''
  if (phase === 'calibrating') text = `正在聆听环境，请先保持安静… ${calibration}%`
  else if (phase === 'settling') text = '安静下来，它正在凝结…'
  else if (pressure < 0.02) text = sim ? '按住空格或下方按钮发声' : '开始说吧，叹气、碎碎念、呐喊都可以'
  else if (form === 'seed') text = '继续，它正在成形…'

  return (
    <div className="phase-hint" role="status" aria-live="polite">
      {phase === 'settling' && <SettleRing progress={settle} />}
      {text && <span>{text}</span>}
    </div>
  )
}

function SettleRing({ progress }: { progress: number }) {
  const r = 14
  const c = 2 * Math.PI * r
  return (
    <svg className="settle-ring" width="36" height="36" viewBox="0 0 36 36" aria-hidden="true">
      <circle cx="18" cy="18" r={r} className="settle-ring-bg" />
      <circle
        cx="18"
        cy="18"
        r={r}
        className="settle-ring-fg"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - progress)}
      />
    </svg>
  )
}

/** 定型 / 转变时短暂提示"它变成了冰"：按材质换 key 重新挂载，CSS 动画播完自动隐去 */
function FormToast({ form }: { form: GrowthForm }) {
  if (form === 'seed') return null
  return (
    <div className="form-toast" key={form} aria-hidden="true">
      它变成了{EMOTION_NAMES[form]}
    </div>
  )
}

function SimControls() {
  const simStyle = useAppStore((s) => s.simStyle)
  const [held, setHeld] = useState(false)

  const press = (e: PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    setHeld(true)
    setSimHeld(true)
  }
  const release = () => {
    setHeld(false)
    setSimHeld(false)
  }

  return (
    <div className="sim-controls">
      <div className="segmented" role="group" aria-label="模拟的声音风格">
        {EMOTION_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            aria-pressed={simStyle === type}
            onClick={() => setSimStyle(type)}
          >
            {FORM_ICONS[type]} {EMOTION_NAMES[type]}
          </button>
        ))}
      </div>
      <button
        type="button"
        className={`btn btn-hold ${held ? 'is-held' : ''}`}
        onPointerDown={press}
        onPointerUp={release}
        onPointerCancel={release}
        onLostPointerCapture={release}
      >
        {held ? '发声中…' : '按住发声'}
      </button>
    </div>
  )
}
