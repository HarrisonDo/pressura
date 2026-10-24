/**
 * MicButton —— 右上角麦克风开关按钮
 */
export function MicButton({ isListening, isFrozen, onClick }) {
  return (
    <button
      className={`mic-toggle ${isListening ? 'listening' : ''} ${isFrozen ? 'frozen' : ''}`}
      onClick={onClick}
      title={isListening ? '停止录制' : '开始录制'}
    >
      {isListening && !isFrozen && <span className="mic-ring" />}
      <span className="mic-icon">
        {isFrozen ? '❄️' : isListening ? '🔴' : '🎙️'}
      </span>
    </button>
  );
}
