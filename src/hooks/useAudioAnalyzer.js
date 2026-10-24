/**
 * useAudioAnalyzer
 * 封装 Web Audio API，提供实时音量、频率分析和情绪判断
 */
import { useState, useRef, useCallback, useEffect } from 'react';

// 情绪类型映射
export const EMOTION_TYPES = {
  ICE: 'ice',       // 冰块：低频主导，压抑
  FIRE: 'fire',     // 火苗：高音量 + 高频，愤怒
  STONE: 'stone',   // 石头：中频 + 波动大，焦虑
  CRYSTAL: 'crystal', // 暗晶：混合/不明
};

// 凝固倒计时（毫秒）
const FREEZE_DELAY = 3000;
// FFT 大小
const FFT_SIZE = 2048;

export function useAudioAnalyzer() {
  const [isListening, setIsListening] = useState(false);
  const [isFrozen, setIsFrozen] = useState(false);
  const [permission, setPermission] = useState('idle'); // idle | granted | denied

  // 实时音频数据
  const [audioData, setAudioData] = useState({
    volume: 0,         // 0~1 总音量
    bassEnergy: 0,     // 0~1 低频能量 (20-300Hz)
    midEnergy: 0,      // 0~1 中频能量 (300-3000Hz)
    highEnergy: 0,     // 0~1 高频能量 (3000-20000Hz)
    accumulated: 0,    // 0~1 累积压力值
    emotionType: EMOTION_TYPES.CRYSTAL,
  });

  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const accumulatedRef = useRef(0);
  const freezeTimerRef = useRef(null);
  const dataArrayRef = useRef(null);
  const isFrozenRef = useRef(false);

  // 判断情绪类型
  const detectEmotion = useCallback((bassEnergy, midEnergy, highEnergy, volume) => {
    if (volume < 0.05) return EMOTION_TYPES.CRYSTAL;

    const bassRatio = bassEnergy / (bassEnergy + midEnergy + highEnergy + 0.001);
    const highRatio = highEnergy / (bassEnergy + midEnergy + highEnergy + 0.001);

    if (volume > 0.6 && highRatio > 0.35) return EMOTION_TYPES.FIRE;
    if (bassRatio > 0.5 && volume < 0.5) return EMOTION_TYPES.ICE;
    if (midEnergy > 0.3 && Math.abs(midEnergy - bassEnergy) > 0.15) return EMOTION_TYPES.STONE;
    return EMOTION_TYPES.CRYSTAL;
  }, []);

  // 分析帧循环
  const analyzeFrame = useCallback(() => {
    if (!analyserRef.current || isFrozenRef.current) return;

    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = dataArrayRef.current;

    analyser.getByteFrequencyData(dataArray);

    const sampleRate = audioContextRef.current.sampleRate;
    const binHz = sampleRate / FFT_SIZE;

    let bassSum = 0, bassCount = 0;
    let midSum = 0, midCount = 0;
    let highSum = 0, highCount = 0;
    let totalSum = 0;

    for (let i = 0; i < bufferLength; i++) {
      const hz = i * binHz;
      const val = dataArray[i] / 255;
      totalSum += val;

      if (hz >= 20 && hz < 300) { bassSum += val; bassCount++; }
      else if (hz >= 300 && hz < 3000) { midSum += val; midCount++; }
      else if (hz >= 3000 && hz < 20000) { highSum += val; highCount++; }
    }

    const volume = totalSum / bufferLength;
    const bassEnergy = bassCount > 0 ? bassSum / bassCount : 0;
    const midEnergy = midCount > 0 ? midSum / midCount : 0;
    const highEnergy = highCount > 0 ? highSum / highCount : 0;

    // 累积逻辑：声音越大，累积越快
    if (volume > 0.03) {
      accumulatedRef.current = Math.min(1, accumulatedRef.current + volume * 0.002);

      // 重置凝固计时器
      if (freezeTimerRef.current) {
        clearTimeout(freezeTimerRef.current);
        freezeTimerRef.current = null;
      }
      // 启动凝固倒计时
      freezeTimerRef.current = setTimeout(() => {
        if (accumulatedRef.current > 0.05) {
          isFrozenRef.current = true;
          setIsFrozen(true);
        }
      }, FREEZE_DELAY);
    }

    const emotionType = detectEmotion(bassEnergy, midEnergy, highEnergy, volume);

    setAudioData({
      volume,
      bassEnergy,
      midEnergy,
      highEnergy,
      accumulated: accumulatedRef.current,
      emotionType,
    });

    rafRef.current = requestAnimationFrame(analyzeFrame);
  }, [detectEmotion]);

  // 开始监听
  const startListening = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      setPermission('granted');
      streamRef.current = stream;

      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = audioContext;

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = FFT_SIZE;
      analyser.smoothingTimeConstant = 0.8;
      analyserRef.current = analyser;

      dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      accumulatedRef.current = 0;
      isFrozenRef.current = false;
      setIsFrozen(false);
      setIsListening(true);
      analyzeFrame();
    } catch (err) {
      setPermission('denied');
      console.error('麦克风权限被拒绝:', err);
    }
  }, [analyzeFrame]);

  // 停止监听
  const stopListening = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (freezeTimerRef.current) clearTimeout(freezeTimerRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    setIsListening(false);
  }, []);

  // 重置（新的情绪录制周期）
  const reset = useCallback(() => {
    accumulatedRef.current = 0;
    isFrozenRef.current = false;
    setIsFrozen(false);
    setAudioData(prev => ({ ...prev, accumulated: 0, volume: 0 }));
  }, []);

  // 清理
  useEffect(() => {
    return () => {
      stopListening();
    };
  }, [stopListening]);

  return {
    isListening,
    isFrozen,
    permission,
    audioData,
    startListening,
    stopListening,
    reset,
  };
}
