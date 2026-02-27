import { useState, useEffect, useCallback, useRef } from 'react';

interface SpeakOptions {
  voice?: SpeechSynthesisVoice;
  rate?: number;
  pitch?: number;
  volume?: number;
  onStart?: () => void;
  onEnd?: () => void;
}

interface SpeechSynthesisHook {
  isSpeaking: boolean;
  isPaused: boolean;
  isSupported: boolean;
  voices: SpeechSynthesisVoice[];
  selectedVoice: SpeechSynthesisVoice | null;
  speak: (text: string, options?: SpeakOptions) => void;
  cancel: () => void;
  pause: () => void;
  resume: () => void;
  setSelectedVoice: (voice: SpeechSynthesisVoice | null) => void;
}

export function useSpeechSynthesis(): SpeechSynthesisHook {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
  const isSupported = !!synth;
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (!synth) return;
    const loadVoices = () => {
      const v = synth.getVoices();
      setVoices(v);
      if (!selectedVoice && v.length > 0) {
        const preferred = v.find(x => x.lang.startsWith('en') && x.name.toLowerCase().includes('female')) || v.find(x => x.lang.startsWith('en')) || v[0];
        setSelectedVoice(preferred || null);
      }
    };
    loadVoices();
    synth.addEventListener('voiceschanged', loadVoices);
    return () => synth.removeEventListener('voiceschanged', loadVoices);
  }, [synth, selectedVoice]);

  const speak = useCallback((text: string, options: SpeakOptions = {}) => {
    if (!synth) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.voice = options.voice || selectedVoice;
    u.rate = options.rate ?? 0.95;
    u.pitch = options.pitch ?? 1.05;
    u.volume = options.volume ?? 1;
    u.onstart = () => { setIsSpeaking(true); setIsPaused(false); options.onStart?.(); };
    u.onend = () => { setIsSpeaking(false); setIsPaused(false); options.onEnd?.(); };
    u.onerror = () => { setIsSpeaking(false); setIsPaused(false); };
    utteranceRef.current = u;
    synth.speak(u);
  }, [synth, selectedVoice]);

  const cancel = useCallback(() => {
    synth?.cancel();
    setIsSpeaking(false);
    setIsPaused(false);
  }, [synth]);

  const pause = useCallback(() => {
    synth?.pause();
    setIsPaused(true);
  }, [synth]);

  const resume = useCallback(() => {
    synth?.resume();
    setIsPaused(false);
  }, [synth]);

  return { isSpeaking, isPaused, isSupported, voices, selectedVoice, speak, cancel, pause, resume, setSelectedVoice };
}
