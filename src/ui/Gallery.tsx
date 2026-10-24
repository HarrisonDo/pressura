/**
 * 情绪标本馆：本机收藏的全部标本。点开可以在 3D 场景里重新查看、继续处置。
 */
import { useMemo, useState } from 'react'
import { backToStart } from '../app/controller'
import { deleteGalleryItem, viewGalleryItem } from '../app/artifactController'
import { useAppStore } from '../app/store'
import { FORM_COLORS, FORM_ICONS } from '../core/palette'
import { EMOTION_LABELS, EMOTION_NAMES, EMOTION_TYPES, type EmotionType } from '../core/types'

type Filter = 'all' | EmotionType

const fmtDate = (ts: number) => {
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function Gallery() {
  const items = useAppStore((s) => s.gallery)
  const notice = useAppStore((s) => s.notice)
  const [filter, setFilter] = useState<Filter>('all')
  const shown = useMemo(() => (filter === 'all' ? items : items.filter((i) => i.signature.type === filter)), [items, filter])
  const counts = useMemo(() => {
    const c: Record<EmotionType, number> = { ice: 0, stone: 0, fire: 0 }
    for (const i of items) c[i.signature.type]++
    return c
  }, [items])

  return (
    <main className="gallery" aria-labelledby="gallery-title">
      <header className="gallery-head">
        <div>
          <p className="eyebrow">只保存在这台设备上</p>
          <h1 id="gallery-title">情绪标本馆</h1>
        </div>
        <div className="gallery-stats" aria-label="统计">
          {EMOTION_TYPES.map((t) => (
            <span key={t} style={{ color: FORM_COLORS[t] }}>
              {FORM_ICONS[t]} {EMOTION_NAMES[t]} {counts[t]}
            </span>
          ))}
        </div>
        <button type="button" className="btn btn-primary" onClick={backToStart}>
          再倾诉一次
        </button>
      </header>

      {notice && <p className="gallery-notice" role="status">{notice}</p>}

      <div className="segmented" role="group" aria-label="按材质筛选">
        {(['all', ...EMOTION_TYPES] as Filter[]).map((f) => (
          <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>
            {f === 'all' ? `全部 ${items.length}` : `${FORM_ICONS[f]} ${EMOTION_NAMES[f]}`}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="gallery-empty">还没有标本。去倾诉一次，然后把它收进来。</p>
      ) : (
        <ul className="gallery-grid">
          {shown.map((item) => {
            const s = item.signature
            const color = FORM_COLORS[s.type]
            const tags = [
              item.summary.trees > 0 && '🌱',
              item.summary.mossy && '🌿',
              item.summary.obsidian && '⬛',
              item.summary.frozen && '❄',
              item.summary.shattered && '💥',
            ].filter(Boolean)
            return (
              <li key={s.id} className="gallery-card" style={{ ['--form-color' as string]: color }}>
                <button type="button" className="gallery-open" onClick={() => viewGalleryItem(item)} aria-label={`查看 ${EMOTION_LABELS[s.type]} ${fmtDate(s.createdAt)}`}>
                  {item.thumbnail ? <img src={item.thumbnail} alt="" /> : <div className="gallery-thumb-empty">{FORM_ICONS[s.type]}</div>}
                  <div className="gallery-meta">
                    <strong>{EMOTION_LABELS[s.type]}</strong>
                    <span>{fmtDate(s.createdAt)}</span>
                  </div>
                  <div className="gallery-meta dim">
                    <span>{s.durationSeconds.toFixed(0)} 秒 · 压力 {Math.round(s.finalPressure * 100)}%</span>
                    <span>{tags.join(' ')}</span>
                  </div>
                </button>
                <button
                  type="button"
                  className="icon-btn small gallery-delete"
                  aria-label="删除这件标本"
                  onClick={() => {
                    if (window.confirm('删除这件标本？删除后无法恢复。')) void deleteGalleryItem(s.id)
                  }}
                >
                  ✕
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}
