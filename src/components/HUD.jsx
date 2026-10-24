/**
 * HUD —— 场景信息叠加层
 * 显示：情绪类型、能量条、状态文字、工具栏（凝固后）
 */
import { getEmotionLabel, getEmotionColor } from '../store/galleryStore';
import { EMOTION_TYPES } from '../hooks/useAudioAnalyzer';

const EMOTION_ICONS = {
  [EMOTION_TYPES.ICE]:     '🧊',
  [EMOTION_TYPES.FIRE]:    '🔥',
  [EMOTION_TYPES.STONE]:   '🪨',
  [EMOTION_TYPES.CRYSTAL]: '💎',
};

export function HUD({
  audioData,
  isListening,
  isFrozen,
  galleryCount,
  onStop,
  onSave,
  onReset,
  onOpenGallery,
}) {
  const { accumulated, volume, emotionType } = audioData;
  const color = getEmotionColor(emotionType);
  const label = getEmotionLabel(emotionType);
  const icon  = EMOTION_ICONS[emotionType] || '💎';

  const energyPct = Math.round(accumulated * 100);

  return (
    <>
      {/* 顶部状态栏 */}
      <div className="hud-top">
        <div className="emotion-badge" style={{ borderColor: color, color }}>
          <span>{icon}</span>
          <span>{label}</span>
        </div>

        <div className="energy-bar-wrapper">
          <div className="energy-label">情绪压力 {energyPct}%</div>
          <div className="energy-bar-track">
            <div
              className="energy-bar-fill"
              style={{
                width: `${energyPct}%`,
                background: `linear-gradient(90deg, ${color}88, ${color})`,
                boxShadow: volume > 0.05 ? `0 0 8px ${color}` : 'none',
              }}
            />
          </div>
        </div>

        {/* 实时音量指示 */}
        <div className="volume-dots">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="volume-dot"
              style={{
                background: i / 10 < volume ? color : 'rgba(255,255,255,0.1)',
                boxShadow: i / 10 < volume ? `0 0 4px ${color}` : 'none',
              }}
            />
          ))}
        </div>
      </div>

      {/* 中央状态提示 */}
      {isListening && !isFrozen && (
        <div className="center-hint">
          {accumulated < 0.05
            ? '开始说话，释放你的情绪...'
            : volume < 0.03
            ? '保持沉默 3 秒后情绪将凝固'
            : ''}
        </div>
      )}

      {isFrozen && (
        <div className="center-hint frozen">
          ✨ 情绪已凝固 · 拖动旋转查看
        </div>
      )}

      {/* 凝固后工具栏 */}
      {isFrozen && (
        <div className="toolbar">
          <button className="tool-btn" onClick={onSave} title="收藏到画廊">
            <span>📦</span>
            <span>收藏</span>
          </button>
          <button className="tool-btn reset-btn" onClick={onReset} title="重新录制">
            <span>🔄</span>
            <span>重置</span>
          </button>
        </div>
      )}

      {/* 底部控制栏 */}
      <div className="hud-bottom">
        {isListening && !isFrozen && (
          <button className="mic-btn active" onClick={onStop}>
            <span className="mic-pulse" />
            <span>🎤</span>
            <span>停止录制</span>
          </button>
        )}

        {!isListening && !isFrozen && (
          <div className="hint-text">点击右上角麦克风开始</div>
        )}
      </div>

      {/* 画廊入口 */}
      <button className="gallery-btn" onClick={onOpenGallery}>
        <span>🏛️</span>
        {galleryCount > 0 && <span className="gallery-count">{galleryCount}</span>}
      </button>
    </>
  );
}
