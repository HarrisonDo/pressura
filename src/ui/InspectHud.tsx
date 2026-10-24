/**
 * 标本处置界面：工具栏（种树 / 浇水 / 汽油 / 敲击）+ 收集 + 标本信息。
 */
import { useEffect } from 'react'
import { backToStart, startRecording } from '../app/controller'
import { closeArtifact, collectArtifact, openGallery, selectTool } from '../app/artifactController'
import { useAppStore, type Tool } from '../app/store'
import { FORM_COLORS, FORM_ICONS } from '../core/palette'
import { EMOTION_LABELS } from '../core/types'
import { Sparkline } from './Sparkline'

const TOOLS: { tool: Tool; icon: string; label: string; hint: string }[] = [
  { tool: 'plant', icon: '🌱', label: '种树', hint: '点击标本表面种下一棵树' },
  { tool: 'water', icon: '💧', label: '浇水', hint: '按住标本倒水' },
  { tool: 'gasoline', icon: '⛽', label: '汽油', hint: '按住标本浇汽油，会着火' },
  { tool: 'knock', icon: '👊', label: '敲击', hint: '点击敲击，三下就碎（任何工具下双击也能敲）' },
]

const REASONS = { silence: '安静下来后凝结', overflow: '压力满溢', manual: '手动结束' } as const

export function InspectHud() {
  const signature = useAppStore((s) => s.signature)
  const summary = useAppStore((s) => s.summary)
  const tool = useAppStore((s) => s.tool)
  const viewingId = useAppStore((s) => s.viewingId)
  const inputMode = useAppStore((s) => s.inputMode)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const index = Number(e.key) - 1
      if (index >= 0 && index < TOOLS.length) selectTool(TOOLS[index].tool)
      if (e.key === '5') void collectArtifact()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!signature || !summary) return null
  const color = FORM_COLORS[signature.type]
  const current = TOOLS.find((t) => t.tool === tool)
  const badges = [
    summary.trees > 0 && `🌱 ${summary.trees} 棵树`,
    summary.burning && '🔥 燃烧中',
    summary.wet && '💧 湿润',
    summary.frozen && '❄ 再冻',
    summary.mossy && '🌿 苔藓',
    summary.obsidian && '⬛ 黑曜石',
    summary.hits > 0 && !summary.shattered && `💥 裂纹 ×${summary.hits}`,
    summary.shattered && '💥 已碎',
  ].filter(Boolean) as string[]

  return (
    <div className="hud" style={{ ['--form-color' as string]: color }}>
      <section className="inspect-card" aria-labelledby="inspect-title">
        <p className="eyebrow">{viewingId ? '藏品' : REASONS[signature.endReason]}</p>
        <h2 id="inspect-title">
          <span aria-hidden="true">{FORM_ICONS[signature.type]}</span> {EMOTION_LABELS[signature.type]}
        </h2>
        <Sparkline values={signature.intensityCurve} color={color} label="强度曲线" width={250} height={40} />
        <dl className="result-stats">
          <div>
            <dt>时长</dt>
            <dd>{signature.durationSeconds.toFixed(1)} 秒</dd>
          </div>
          <div>
            <dt>压力</dt>
            <dd>{Math.round(signature.finalPressure * 100)}%</dd>
          </div>
          <div>
            <dt>爆发</dt>
            <dd>{signature.burstCount} 次</dd>
          </div>
          <div>
            <dt>释放</dt>
            <dd>{Math.round(summary.release * 100)}%</dd>
          </div>
        </dl>
        {badges.length > 0 && (
          <ul className="badges">
            {badges.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        )}
        <div className="result-actions">
          <button type="button" className="btn btn-ghost" onClick={() => void startRecording(inputMode)}>
            再录一次
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => (viewingId ? void openGallery() : (closeArtifact(), backToStart()))}
          >
            {viewingId ? '返回标本馆' : '放弃'}
          </button>
        </div>
      </section>

      <footer className="hud-bottom">
        <p className="phase-hint">{summary.shattered ? '它碎了。可以把碎片也收起来。' : current?.hint}</p>
        <div className="toolbar" role="toolbar" aria-label="处置工具">
          {TOOLS.map((t, i) => (
            <button
              key={t.tool}
              type="button"
              className="tool"
              aria-pressed={tool === t.tool}
              disabled={summary.shattered}
              onClick={() => selectTool(t.tool)}
              title={`${t.label}（${i + 1}）`}
            >
              <span aria-hidden="true">{t.icon}</span>
              {t.label}
            </button>
          ))}
          <button type="button" className="tool tool-collect" onClick={() => void collectArtifact()} title="收集（5）">
            <span aria-hidden="true">📦</span>
            {viewingId ? '保存' : '收集'}
          </button>
        </div>
        <p className="drag-hint">拖动旋转 · 滚轮缩放 · 双击敲击</p>
      </footer>

      <button type="button" className="btn btn-quiet gallery-entry" onClick={() => void openGallery()}>
        🏛 标本馆
      </button>
    </div>
  )
}
