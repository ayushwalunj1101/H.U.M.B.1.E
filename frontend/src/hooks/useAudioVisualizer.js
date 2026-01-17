import { useState, useEffect, useRef, useCallback } from 'react';

export const useAudioVisualizer = () => {
  const [audioData, setAudioData] = useState(new Uint8Array(0));
  const [isListening, setIsListening] = useState(false);
  const [averageVolume, setAverageVolume] = useState(0);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const streamRef = useRef(null);
  const animationRef = useRef(null);

  const startListening = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      
      // Detail level: 64 gives a nice "chunkiness", 256 is very detailed
      analyserRef.current.fftSize = 128;
      analyserRef.current.smoothingTimeConstant = 0.8;
      
      sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
      sourceRef.current.connect(analyserRef.current);

      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const update = () => {
        if (analyserRef.current) {
          analyserRef.current.getByteFrequencyData(dataArray);
          
          // Calculate average volume for silence detection
          const avg = dataArray.reduce((sum, val) => sum + val, 0) / dataArray.length;
          setAverageVolume(avg);
          
          // Copy the array to trigger state update (React needs new reference)
          setAudioData(new Uint8Array(dataArray));
          animationRef.current = requestAnimationFrame(update);
        }
      };
      
      update();
      setIsListening(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      throw err;
    }
  }, []);

  const stopListening = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
    }
    
    setIsListening(false);
    setAudioData(new Uint8Array(0));
    setAverageVolume(0);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopListening();
    };
  }, [stopListening]);

  return { 
    audioData, 
    averageVolume,
    isListening, 
    startListening, 
    stopListening 
  };
};

export default useAudioVisualizer;
