import { useState, useRef, useCallback, useEffect } from 'react';

interface SpeechRecognitionHook {
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  error: string | null;
  isSupported: boolean;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
}

// Augment window for browser-specific SpeechRecognition
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export function useSpeechRecognition(): SpeechRecognitionHook {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  const SpeechRecognitionAPI: any =
    typeof window !== 'undefined'
      ? (window.SpeechRecognition || window.webkitSpeechRecognition)
      : null;

  const isSupported = !!SpeechRecognitionAPI;

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
    setInterimTranscript('');
  }, []);

  const startListening = useCallback(() => {
    if (!SpeechRecognitionAPI) { setError('Speech recognition not supported'); return; }
    setError(null);
    const recognition = new SpeechRecognitionAPI();
    recognition.lang = 'en-US';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => { setIsListening(false); setInterimTranscript(''); };
    recognition.onerror = (e: any) => {
      setError(e.error);
      setIsListening(false);
    };
    recognition.onresult = (e: any) => {
      let final = '';
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) final += res[0].transcript;
        else interim += res[0].transcript;
      }
      if (final) setTranscript(prev => prev + final + ' ');
      setInterimTranscript(interim);
    };

    recognition.start();
  }, [SpeechRecognitionAPI]);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
  }, []);

  useEffect(() => () => recognitionRef.current?.abort(), []);

  return { isListening, transcript, interimTranscript, error, isSupported, startListening, stopListening, resetTranscript };
}
