// SAME IMPORTS AS BEFORE
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import JarvisOrb from './components/JarvisOrb';
import useAudioLevel from './hooks/useAudioLevel';
import useSpeechRecognition from './hooks/useSpeechRecognition';
import './App.css';

/* ❌ REMOVED PROCESSING_PHRASES UI BUTTONS (kept animation text only if backend-driven later) */

const ImmersiveMode = ({ userData, onExit }) => {
  const [state, setState] = useState('idle'); // idle, listening, processing, speaking
  const [messages, setMessages] = useState([]);
  const [displayedSentences, setDisplayedSentences] = useState([]);
  const [processingPhrases, setProcessingPhrases] = useState([]);
  const [micPermissionDenied, setMicPermissionDenied] = useState(false);
  const [orbVisible, setOrbVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [sessionTime, setSessionTime] = useState(0);

  const { levelRef, ready, error: audioError, start: startAudio, stop: stopAudio } =
    useAudioLevel();

  const {
    isListening,
    transcript,
    interimTranscript,
    startListening,
    stopListening,
    resetTranscript
  } = useSpeechRecognition();

  const pauseTimerRef = useRef(null);
  const sessionTimerRef = useRef(null);
  const PAUSE_THRESHOLD = 2000;

  useEffect(() => {
    const timer = setTimeout(() => setOrbVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Track session time
  useEffect(() => {
    if (state === 'idle') return;
    sessionTimerRef.current = setInterval(() => {
      setSessionTime(prev => prev + 1);
    }, 1000);
    return () => clearInterval(sessionTimerRef.current);
  }, [state]);

  useEffect(() => {
    if (audioError) {
      setMicPermissionDenied(true);
      setError('Microphone access denied');
    }
  }, [audioError]);

  useEffect(() => {
    if (state !== 'listening') return;
    if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);

    if (transcript?.trim()) {
      pauseTimerRef.current = setTimeout(handleDoneSpeaking, PAUSE_THRESHOLD);
    }

    return () => pauseTimerRef.current && clearTimeout(pauseTimerRef.current);
  }, [transcript, state]);

  const handleStart = async () => {
    try {
      setMicPermissionDenied(false);
      setError(null);
      setSessionTime(0);
      await startAudio();

      // Fetch greeting from backend
      setState('processing');
      const res = await fetch('http://localhost:8000/api/greeting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userName: userData?.name || '' })
      });

      let greeting;
      if (res.ok) {
        const data = await res.json();
        greeting = data.greeting;
      } else {
        // Fallback only if backend is unreachable
        greeting = `Hi${userData?.name ? ` ${userData.name}` : ''}. I'm here with you. When you're ready, just start speaking.`;
      }

      setMessages([{ role: 'assistant', content: greeting }]);
      setState('speaking');
      speakResponse(greeting);
    } catch (err) {
      setMicPermissionDenied(true);
      setError('Unable to access microphone. Please check permissions.');
    }
  };

  const handleDoneSpeaking = async () => {
    if (pauseTimerRef.current) {
      clearTimeout(pauseTimerRef.current);
    }

    stopAudio();
    stopListening();

    if (!transcript?.trim()) {
      setError('No speech detected. Please try speaking again.');
      setTimeout(() => setError(null), 3000);
      setState('listening');
      startAudio();
      startListening();
      return;
    }

    setState('processing');
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch('http://localhost:8000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: transcript,
          history: messages.slice(-5),
          riskLevel: userData?.riskLevel || 'unknown'
        })
      });

      if (!res.ok) {
        throw new Error(`Server error: ${res.status}`);
      }

      const data = await res.json();
      
      if (!data.response || !data.response.trim()) {
        throw new Error('Empty response from server');
      }

      setMessages(prev => [
        ...prev,
        { role: 'user', content: transcript },
        { role: 'assistant', content: data.response, sources: data.sources }
      ]);

      setState('speaking');
      speakResponse(data.response);
    } catch (err) {
      console.error('API Error:', err);
      setError(err.message || 'Unable to connect to the server.');
      setState('listening');
      startListening();
    } finally {
      setIsSubmitting(false);
    }
  };

  const speakResponse = text => {
    setDisplayedSentences([text]);

    if ('speechSynthesis' in window) {
      const speakWithVoice = () => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9;
        utterance.pitch = 1;

        const voices = window.speechSynthesis.getVoices();
        const preferredVoice = voices.find(v =>
          v.name.includes('Google') || v.name.includes('Samantha')
        );
        if (preferredVoice) utterance.voice = preferredVoice;

        utterance.onend = () => {
          setState('listening');
          startListening();
          resetTranscript();
        };

        utterance.onerror = err => {
          console.error('TTS Error:', err);
          setState('listening');
          startListening();
          resetTranscript();
        };

        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
      };

      if (window.speechSynthesis.getVoices().length > 0) {
        speakWithVoice();
      } else {
        window.speechSynthesis.onvoiceschanged = speakWithVoice;
      }
    } else {
      setTimeout(() => {
        setState('listening');
        startListening();
        resetTranscript();
      }, text.length * 50);
    }
  };

  const handleExit = () => {
    if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
    if (sessionTimerRef.current) clearInterval(sessionTimerRef.current);
    stopAudio();
    stopListening();
    window.speechSynthesis?.cancel();
    onExit?.();
  };

  return (
    <div className="immersive-container">

      {/* TOP BAR: SESSION TIME + EXIT */}
      <div className="immersive-top-bar">
        <div className="session-timer">
          {String(Math.floor(sessionTime / 60)).padStart(2, '0')}:
          {String(sessionTime % 60).padStart(2, '0')}
        </div>
        <motion.button 
          className="immersive-exit" 
          onClick={handleExit}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          Exit
        </motion.button>
      </div>

      {/* ERROR BANNER */}
      <AnimatePresence>
        {error && (
          <motion.div 
            className="error-banner"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <span className="error-icon">⚠</span>
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ORB */}
      <div className="immersive-orb-container">
        <AnimatePresence>
          {orbVisible && (
            <motion.div className="orb-pop-wrapper">
              <JarvisOrb levelRef={levelRef} mode={state} size={320} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* SUBTITLE */}
      <AnimatePresence>
        {state === 'speaking' && (
          <motion.div className="immersive-response">
            <p className="response-sentence">{displayedSentences[0]}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PROCESSING STATE */}
      <AnimatePresence>
        {state === 'processing' && (
          <motion.div 
            className="processing-state"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="processing-spinner"></div>
            <p>Thinking…</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* START */}
      {state === 'idle' && (
        <div className="center-column">
          {(micPermissionDenied || audioError) && (
            <motion.div 
              className="permission-error"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <p>🎤 Microphone access required</p>
              <p style={{ fontSize: '0.9rem', marginTop: '8px' }}>
                Please enable microphone permissions in your browser settings.
              </p>
            </motion.div>
          )}
          <motion.button 
            className="btn-start-therapy" 
            onClick={handleStart}
            disabled={micPermissionDenied}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {micPermissionDenied ? 'Enable Microphone' : 'Start Therapy Session'}
          </motion.button>
        </div>
      )}

      {/* LISTENING */}
      {state === 'listening' && (
        <div className="center-column">
          <p className="listening-prompt">Speak freely…</p>

          <div className="transcript-display">
            {interimTranscript || transcript || 'Listening…'}
          </div>

          <motion.button 
            className="btn-done-speaking" 
            onClick={handleDoneSpeaking}
            disabled={isSubmitting}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {isSubmitting ? 'Processing...' : 'Submit (or pause 2s)'}
          </motion.button>
        </div>
      )}

      {userData?.name && state !== 'idle' && (
        <div className="immersive-greeting">
          Welcome back, {userData.name}
        </div>
      )}
    </div>
  );
};

export default ImmersiveMode;
