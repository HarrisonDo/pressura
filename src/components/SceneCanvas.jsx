/**
 * SceneCanvas —— Three.js 场景的 React 包装器
 * 负责：canvas 挂载、EmotionScene 生命周期、RAF 循环
 */
import { useEffect, useRef, useCallback } from 'react';
import { EmotionScene } from '../scenes/EmotionScene';

export function SceneCanvas({ audioData, isFrozen, onSceneReady }) {
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const rafRef = useRef(null);
  const audioDataRef = useRef(audioData);
  const isFrozenRef = useRef(isFrozen);

  // 保持最新 ref
  audioDataRef.current = audioData;
  isFrozenRef.current = isFrozen;

  const animate = useCallback(() => {
    rafRef.current = requestAnimationFrame(animate);
    if (sceneRef.current) {
      sceneRef.current.update(audioDataRef.current);
    }
  }, []);

  // 初始化场景
  useEffect(() => {
    if (!canvasRef.current) return;

    const scene = new EmotionScene(canvasRef.current);
    sceneRef.current = scene;

    if (onSceneReady) onSceneReady(scene);

    animate();

    // 响应式 resize
    const handleResize = () => {
      if (sceneRef.current) {
        sceneRef.current.resize(window.innerWidth, window.innerHeight);
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', handleResize);
      if (sceneRef.current) {
        sceneRef.current.dispose();
        sceneRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 凝固状态变化时通知场景
  useEffect(() => {
    if (!sceneRef.current) return;
    if (isFrozen) {
      sceneRef.current.freeze();
    }
  }, [isFrozen]);

  return (
    <canvas
      ref={canvasRef}
      className="scene-canvas"
      style={{ display: 'block', width: '100%', height: '100%' }}
    />
  );
}
