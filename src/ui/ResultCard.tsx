/**
 * M1 临时的结果卡片：M3 会换成凝结动画 + 可交互标本。
 */
import { backToStart, startRecording } from '../app/controller'
import { useAppStore } from '../app/store'
import { EMOTION_LABELS, EMOTION_NAMES, EMOTION_TYPES } from '../core/types'
import type { EndReason } from '../core/audio'
import { FORM_COLORS, FORM_ICONS } from '../core/palette'
import { Sparkline } from './Sparkline'

const REASONS: Record<EndReason, string> = {
  silence: '安静下来后凝结',
  overflow: '压力满溢',
  manual: '手动结束',
}

export function ResultCard() {
  const result = useAppStore((s) => s.result)
  const inputMode = useAppStore((s) => s.inputMode)
  if (!result) return null
  const color = FORM_COLORS[result.type]

  return (
    <section className="result-card" aria-labelledby="result-title" style={{ ['--form-color' as string]: color }}>
      <p className="eyebrow">{REASONS[result.endReason]}</p>
      <h2 id="result-title">
        <span aria-hidden="true">{FORM_ICONS[result.type]}</span> {EMOTION_LABELS[result.type]}
      </h2>
      <Sparkline values={result.intensityCurve} color={color} label="这次倾诉的强度曲线" />
      <dl className="result-stats">
        <div>
          <dt>时长</dt>
          <dd>{result.durationSeconds.toFixed(1)} 秒</dd>
        </div>
        <div>
          <dt>压力</dt>
          <dd>{Math.round(result.finalPressure * 100)}%</dd>
        </div>
        <div>
          <dt>峰值强度</dt>
          <dd>{Math.round(result.peakLoud * 100)}%</dd>
        </div>
        <div>
          <dt>爆发</dt>
          <dd>{result.burstCount} 次</dd>
        </div>
      </dl>
      <ul className="result-scores" aria-label="材质得分">
        {EMOTION_TYPES.map((type) => (
          <li key={type} style={{ ['--c' as string]: FORM_COLORS[type], ['--v' as string]: result.scores[type] }}>
            <span>{EMOTION_NAMES[type]}</span>
            <span className="result-score-bar" />
            <span>{result.scores[type].toFixed(2)}</span>
          </li>
        ))}
      </ul>
      <div className="result-actions">
        <button type="button" className="btn btn-primary" onClick={() => void startRecording(inputMode)}>
          再来一次
        </button>
        <button type="button" className="btn btn-ghost" onClick={backToStart}>
          返回首页
        </button>
      </div>
    </section>
  )
}
