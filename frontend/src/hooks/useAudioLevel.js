import { useRef, useState, useCallback, useEffect } from 'react';

/**
 * Hook for getting real-time audio level from microphone
 * Returns a ref with the current audio level (0-1) for smooth animations
 */
function useAudioLevel() {
  const levelRef = useRef(0);
  const streamRef = useRef(null);
  const analyserRef = useRef(null);
  const ctxRef = useRef(null);
  const rafRef = useRef(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    if (ctxRef.current && ctxRef.current.state !== 'closed') {
      ctxRef.current.close();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }
    levelRef.current = 0;
    setReady(false);
  }, []);

  const start = useCallback(async () => {
    stop();
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      ctxRef.current = ctx;
      
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.8;
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);
      analyserRef.current = analyser;

      const data = new Uint8Array(analyser.frequencyBinCount);
      
      const tick = () => {
        analyser.getByteFrequencyData(data);
        // Calculate average with some normalization
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        // Normalize to 0-1 range with threshold
        const norm = Math.min(1, Math.max(0, (avg - 16) / 90));
        // Smooth interpolation
        levelRef.current += (norm - levelRef.current) * 0.15;
        rafRef.current = requestAnimationFrame(tick);
      };
      
      tick();
      setReady(true);
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to access microphone');
      console.error('Audio level error:', err);
    }
  }, [stop]);

  // Cleanup on unmount
  useEffect(() => {
    return () => stop();
  }, [stop]);

  return { levelRef, ready, error, start, stop };
}

export default useAudioLevel;
