/**
 * App —— 主应用入口
 * 状态机：idle → listening → frozen → (save/reset)
 */
import { useState, useRef, useCallback } from 'react';
import { useAudioAnalyzer } from './hooks/useAudioAnalyzer';
import { SceneCanvas } from './components/SceneCanvas';
import { PermissionScreen } from './components/PermissionScreen';
import { HUD } from './components/HUD';
import { GalleryModal } from './components/GalleryModal';
import { MicButton } from './components/MicButton';
import { loadGallery, saveToGallery } from './store/galleryStore';
import './styles/app.css';

export default function App() {
  const {
    isListening,
    isFrozen,
    permission,
    audioData,
    startListening,
    stopListening,
    reset: resetAudio,
  } = useAudioAnalyzer();

  const [appState, setAppState] = useState('idle'); // idle | scene
  const [showGallery, setShowGallery] = useState(false);
  const [gallery, setGallery] = useState(() => loadGallery());
  const sceneRef = useRef(null);

  const handleSceneReady = useCallback((scene) => {
    sceneRef.current = scene;
  }, []);

  // 点击麦克风按钮
  const handleMicToggle = useCallback(() => {
    if (appState === 'idle') {
      setAppState('scene');
      startListening();
    } else if (isListening && !isFrozen) {
      stopListening();
    }
  }, [appState, isListening, isFrozen, startListening, stopListening]);

  // 停止录制（HUD 按钮）
  const handleStop = useCallback(() => {
    stopListening();
  }, [stopListening]);

  // 收藏当前实体
  const handleSave = useCallback(() => {
    if (!sceneRef.current) return;
    const entityData = sceneRef.current.getEntityData();
    const saved = saveToGallery(entityData);
    setGallery(prev => [saved, ...prev]);
    // 收藏后重置
    handleReset();
  }, []);

  // 重置场景
  const handleReset = useCallback(() => {
    resetAudio();
    if (sceneRef.current) {
      sceneRef.current.reset();
    }
    // 重新开始录制
    startListening();
  }, [resetAudio, startListening]);

  // 画廊数据更新
  const handleGalleryUpdate = useCallback((updated) => {
    setGallery(updated);
  }, []);

  // 首次进入引导页
  if (appState === 'idle') {
    return (
      <>
        {/* 背景场景（只渲染，不交互）*/}
        <div className="scene-wrapper">
          <SceneCanvas
            audioData={{ volume: 0, bassEnergy: 0, midEnergy: 0, highEnergy: 0, accumulated: 0, emotionType: 'crystal' }}
            isFrozen={false}
            onSceneReady={handleSceneReady}
          />
        </div>
        <PermissionScreen onStart={() => { setAppState('scene'); startListening(); }} permission={permission} />
      </>
    );
  }

  return (
    <div className="app-root">
      {/* Three.js 主场景 */}
      <div className="scene-wrapper">
        <SceneCanvas
          audioData={audioData}
          isFrozen={isFrozen}
          onSceneReady={handleSceneReady}
        />
      </div>

      {/* 右上角麦克风按钮 */}
      <MicButton
        isListening={isListening}
        isFrozen={isFrozen}
        onClick={handleMicToggle}
      />

      {/* HUD 叠加层 */}
      <HUD
        audioData={audioData}
        isListening={isListening}
        isFrozen={isFrozen}
        galleryCount={gallery.length}
        onStop={handleStop}
        onSave={handleSave}
        onReset={handleReset}
        onOpenGallery={() => setShowGallery(true)}
      />

      {/* 画廊弹窗 */}
      {showGallery && (
        <GalleryModal
          items={gallery}
          onClose={() => setShowGallery(false)}
          onUpdate={handleGalleryUpdate}
        />
      )}
    </div>
  );
}
