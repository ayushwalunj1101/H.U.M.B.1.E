import { useRef, useCallback } from 'react';

interface AudioLevelHook {
  levelRef: React.MutableRefObject<number>;
  ready: boolean;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
}

export function useAudioLevel(): AudioLevelHook {
  const levelRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const frameRef = useRef<number>(0);
  const readyRef = useRef(false);
  const errorRef = useRef<string | null>(null);

  const stop = useCallback(() => {
    cancelAnimationFrame(frameRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    contextRef.current?.close();
    streamRef.current = null;
    contextRef.current = null;
    analyserRef.current = null;
    levelRef.current = 0;
  }, []);

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      contextRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        levelRef.current = avg / 255;
        frameRef.current = requestAnimationFrame(tick);
      };
      tick();
      readyRef.current = true;
    } catch (e: any) {
      errorRef.current = e?.message || 'Microphone access denied';
    }
  }, []);

  return { levelRef, ready: readyRef.current, error: errorRef.current, start, stop };
}
