import { useRef, useState, useCallback } from 'react';

interface AudioVisualizerHook {
  audioData: Uint8Array;
  averageVolume: number;
  isListening: boolean;
  startListening: () => Promise<void>;
  stopListening: () => void;
}

export function useAudioVisualizer(): AudioVisualizerHook {
  const [audioData, setAudioData] = useState<Uint8Array>(new Uint8Array(64));
  const [averageVolume, setAverageVolume] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const contextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number>(0);

  const stopListening = useCallback(() => {
    cancelAnimationFrame(frameRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    contextRef.current?.close();
    streamRef.current = null;
    contextRef.current = null;
    analyserRef.current = null;
    setIsListening(false);
    setAverageVolume(0);
    setAudioData(new Uint8Array(64));
  }, []);

  const startListening = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      contextRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      analyserRef.current = analyser;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      setIsListening(true);

      const tick = () => {
        analyser.getByteFrequencyData(data);
        const copy = new Uint8Array(data);
        setAudioData(copy);
        setAverageVolume(copy.reduce((a, b) => a + b, 0) / copy.length / 255);
        frameRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      setIsListening(false);
    }
  }, []);

  return { audioData, averageVolume, isListening, startListening, stopListening };
}
