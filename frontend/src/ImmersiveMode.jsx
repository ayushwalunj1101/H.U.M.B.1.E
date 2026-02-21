// SAME IMPORTS AS BEFORE
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import JarvisOrb from './components/JarvisOrb';
import useAudioLevel from './hooks/useAudioLevel';
import useSpeechRecognition from './hooks/useSpeechRecognition';
import './App.css';

/* ❌ REMOVED PROCESSING_PHRASES UI BUTTONS (kept animation text only if backend-driven later) */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import StreamingAvatar, {
  AvatarQuality,
  StreamingEvents,
  TaskType,
  VoiceEmotion,
} from '@heygen/streaming-avatar';
import { queryRAG, getAccessToken } from './lib/rag-client';
import './App.css';

// The Avatar ID the user requested to be hardcoded
const HARDCODED_AVATAR_ID = '38c680e881ec441cab7b68d515237d3f';

const ImmersiveMode = ({ userData, onExit }) => {
  const videoRef = useRef(null);
  const avatarRef = useRef(null);
  const [state, setState] = useState('idle'); // idle, listening, processing, speaking
  const [isInitialized, setIsInitialized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState(null);
  const [sessionTime, setSessionTime] = useState(0);
  const sessionTimerRef = useRef(null);

  // Track session time
  useEffect(() => {
    if (state === 'idle') return;
    sessionTimerRef.current = setInterval(() => {
      setSessionTime(prev => prev + 1);
    }, 1000);
    return () => clearInterval(sessionTimerRef.current);
  }, [state]);

  const handleStart = useCallback(async () => {
    if (isInitializing || isInitialized) return;
    setIsInitializing(true);
    setError(null);
    setSessionTime(0);

    try {
      // 1. Fetch streaming token from our unified backend
      const token = await getAccessToken();

      // 2. Create avatar instance
      const avatar = new StreamingAvatar({ token });
      avatarRef.current = avatar;

      // 3. Set up event listeners
      avatar.on(StreamingEvents.STREAM_READY, (event) => {
        if (videoRef.current && event.detail) {
          videoRef.current.srcObject = event.detail;
          videoRef.current.play().catch(() => {});
        }
        setIsInitialized(true);
        setIsInitializing(false);
      });

      avatar.on(StreamingEvents.AVATAR_START_TALKING, () => {
        setState('speaking');
      });

      avatar.on(StreamingEvents.AVATAR_STOP_TALKING, () => {
        setState('listening');
      });

      avatar.on(StreamingEvents.USER_START, () => {
        setState('listening');
      });

      avatar.on(StreamingEvents.USER_STOP, () => {
        setState('processing');
      });

      // 4. Handle user's transcribed speech (Send to RAG!)
      avatar.on(StreamingEvents.USER_END_MESSAGE, async (event) => {
        const transcript = event?.detail?.message || '';
        if (!transcript.trim()) return;

        setState('processing');

        try {
          // Send transcript to our local FastAPI LangGraph RAG
          const ragData = await queryRAG(transcript, []);
          
          if (ragData && ragData.spoken_answer) {
            await avatar.speak({
              text: ragData.spoken_answer,
              taskType: TaskType.REPEAT,
            });
          }
        } catch (apiErr) {
          console.error('RAG Error:', apiErr);
          await avatar.speak({
            text: "I'm having trouble connecting to my knowledge base right now. Could you ask me again?",
            taskType: TaskType.REPEAT,
          });
        }
      });

      avatar.on(StreamingEvents.STREAM_DISCONNECTED, () => {
        handleExit();
      });

      // 5. Start the session using HeyGen v2 SDK methods
      const startConfig = {
        quality: AvatarQuality.Medium,
        avatarName: HARDCODED_AVATAR_ID,
        language: 'en',
      };

      await avatar.newSession(startConfig);
      await avatar.startSession();

      // Send initial greeting through RAG or just speak it
      const greeting = `Hi${userData?.name ? ` ${userData.name}` : ''}. I'm here with you. What would you like to talk about today?`;
      await avatar.speak({
        text: greeting,
        taskType: TaskType.REPEAT,
      });

    } catch (err) {
      console.error('Avatar init error:', err);
      setError('Unable to start the avatar session. ' + (err.message || ''));
      setIsInitializing(false);
    }
  }, [isInitializing, isInitialized, userData]);

  const handleExit = () => {
    if (sessionTimerRef.current) clearInterval(sessionTimerRef.current);
    if (avatarRef.current) {
      avatarRef.current.stopAvatar().catch(() => {});
      avatarRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setState('idle');
    setIsInitialized(false);
    onExit?.();
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (avatarRef.current) {
        avatarRef.current.stopAvatar().catch(() => {});
      }
    };
  }, []);

  return (
    <div className="immersive-container">

      {/* TOP BAR: SESSION TIME + EXIT */}
      <div className="immersive-top-bar" style={{ zIndex: 10 }}>
        {isInitialized && (
          <div className="session-timer">
            {String(Math.floor(sessionTime / 60)).padStart(2, '0')}:
            {String(sessionTime % 60).padStart(2, '0')}
          </div>
        )}
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
            style={{ position: 'absolute', top: 80, zIndex: 20 }}
          >
            <span className="error-icon">⚠</span>
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* AVATAR VIDEO CONTAINER */}
      <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0a0a0f',
          overflow: 'hidden'
      }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: isInitialized ? 1 : 0,
            transition: 'opacity 1s ease'
          }}
        />

        {/* LOADING OR START UI */}
        {!isInitialized && (
          <div className="center-column" style={{ position: 'absolute', zIndex: 5 }}>
            {isInitializing ? (
               <motion.div 
                 className="processing-state"
                 initial={{ opacity: 0 }}
                 animate={{ opacity: 1 }}
               >
                 <div className="processing-spinner"></div>
                 <p>Connecting to Avatar...</p>
               </motion.div>
            ) : (
              <motion.button 
                className="btn-start-therapy" 
                onClick={handleStart}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Start Immersive Therapy
              </motion.button>
            )}
          </div>
        )}
      </div>

      {/* PROCESSING STATE OVERLAY */}
      <AnimatePresence>
        {state === 'processing' && isInitialized && (
          <motion.div 
            className="processing-state"
            style={{ position: 'absolute', bottom: 40, left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
          >
            <div className="processing-spinner"></div>
            <p>Thinking…</p>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* LISTENING INDICATOR */}
      <AnimatePresence>
        {state === 'listening' && isInitialized && (
          <motion.div 
            style={{ position: 'absolute', bottom: 40, left: '50%', transform: 'translateX(-50%)', zIndex: 10, background: 'rgba(99, 102, 241, 0.2)', padding: '10px 20px', borderRadius: '30px', color: '#818cf8', fontWeight: 'bold' }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
          >
            <span style={{ display: 'inline-block', width: '10px', height: '10px', background: '#818cf8', borderRadius: '50%', marginRight: '10px', animation: 'pulse 1.5s infinite' }}></span>
            Listening...
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default ImmersiveMode;
