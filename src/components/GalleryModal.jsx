/**
 * GalleryModal —— 收藏画廊弹窗（Phase 1 基础版）
 */
import { useState } from 'react';
import { getEmotionLabel, getEmotionColor, deleteFromGallery } from '../store/galleryStore';

export function GalleryModal({ items, onClose, onUpdate }) {
  const [selected, setSelected] = useState(null);

  const handleDelete = (id) => {
    const updated = deleteFromGallery(id);
    onUpdate(updated);
    if (selected?.id === id) setSelected(null);
  };

  const formatDate = (ts) => {
    const d = new Date(ts);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  return (
    <div className="gallery-overlay" onClick={onClose}>
      <div className="gallery-modal" onClick={e => e.stopPropagation()}>
        <div className="gallery-header">
          <h2>🏛️ 情绪博物馆</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        {items.length === 0 ? (
          <div className="gallery-empty">
            <p>还没有收藏的情绪</p>
            <p className="gallery-empty-hint">录制并收藏你的第一个情绪晶体吧</p>
          </div>
        ) : (
          <div className="gallery-grid">
            {items.map(item => {
              const color = getEmotionColor(item.emotionType);
              const label = getEmotionLabel(item.emotionType);
              return (
                <div
                  key={item.id}
                  className={`gallery-card ${selected?.id === item.id ? 'selected' : ''}`}
                  style={{ borderColor: selected?.id === item.id ? color : 'transparent' }}
                  onClick={() => setSelected(item)}
                >
                  {item.snapshot && (
                    <img
                      src={item.snapshot}
                      alt={label}
                      className="gallery-thumb"
                    />
                  )}
                  <div className="gallery-card-info">
                    <span className="gallery-card-label" style={{ color }}>
                      {label}
                    </span>
                    <span className="gallery-card-date">
                      {formatDate(item.createdAt)}
                    </span>
                  </div>
                  <div
                    className="gallery-card-bar"
                    style={{ background: color, width: `${Math.round((item.scale / 1.5) * 100)}%` }}
                  />
                  <button
                    className="gallery-delete-btn"
                    onClick={e => { e.stopPropagation(); handleDelete(item.id); }}
                    title="删除"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* 统计栏 */}
        {items.length > 0 && (
          <div className="gallery-stats">
            {['ice', 'fire', 'stone', 'crystal'].map(type => {
              const count = items.filter(i => i.emotionType === type).length;
              if (count === 0) return null;
              return (
                <div key={type} className="stat-item">
                  <span style={{ color: getEmotionColor(type) }}>{getEmotionLabel(type)}</span>
                  <span>{count} 次</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
