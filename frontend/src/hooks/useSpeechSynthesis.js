import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Custom hook for Web Speech API (Speech Synthesis / TTS)
 * Provides text-to-speech capabilities with voice control
 */
const useSpeechSynthesis = () => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [isSupported, setIsSupported] = useState(false);
  
  const utteranceRef = useRef(null);

  // Initialize voices
  useEffect(() => {
    if (!('speechSynthesis' in window)) {
      setIsSupported(false);
      return;
    }

    setIsSupported(true);

    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      setVoices(availableVoices);
      
      // Try to find a good default voice
      const preferredVoice = availableVoices.find(v => 
        v.name.includes('Samantha') || 
        v.name.includes('Google US English') ||
        v.name.includes('Microsoft David') ||
        v.name.includes('Microsoft Zira')
      ) || availableVoices.find(v => v.lang.startsWith('en')) || availableVoices[0];
      
      setSelectedVoice(preferredVoice);
    };

    loadVoices();
    
    // Load voices when they change (some browsers load asynchronously)
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  // Speak text
  const speak = useCallback((text, options = {}) => {
    if (!isSupported || !text) return;

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    
    // Apply options
    utterance.rate = options.rate || 0.95;
    utterance.pitch = options.pitch || 1.0;
    utterance.volume = options.volume || 1.0;
    
    if (selectedVoice || options.voice) {
      utterance.voice = options.voice || selectedVoice;
    }

    utterance.onstart = () => {
      setIsSpeaking(true);
      setIsPaused(false);
      if (options.onStart) options.onStart();
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      setIsPaused(false);
      if (options.onEnd) options.onEnd();
    };

    utterance.onerror = (event) => {
      console.error('Speech synthesis error:', event);
      setIsSpeaking(false);
      setIsPaused(false);
      if (options.onError) options.onError(event);
    };

    utterance.onpause = () => {
      setIsPaused(true);
    };

    utterance.onresume = () => {
      setIsPaused(false);
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [isSupported, selectedVoice]);

  // Stop speaking
  const cancel = useCallback(() => {
    if (!isSupported) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setIsPaused(false);
  }, [isSupported]);

  // Pause speaking
  const pause = useCallback(() => {
    if (!isSupported || !isSpeaking) return;
    window.speechSynthesis.pause();
    setIsPaused(true);
  }, [isSupported, isSpeaking]);

  // Resume speaking
  const resume = useCallback(() => {
    if (!isSupported || !isPaused) return;
    window.speechSynthesis.resume();
    setIsPaused(false);
  }, [isSupported, isPaused]);

  return {
    isSpeaking,
    isPaused,
    isSupported,
    voices,
    selectedVoice,
    speak,
    cancel,
    pause,
    resume,
    setSelectedVoice
  };
};

export default useSpeechSynthesis;
