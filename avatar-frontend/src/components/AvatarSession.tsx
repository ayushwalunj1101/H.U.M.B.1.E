/**
 * AvatarSession — Core component managing HeyGen Interactive Avatar lifecycle.
 * Handles: token fetch, session init, voice-chat events, RAG calls, avatar speak.
 */
'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import StreamingAvatar, {
  AvatarQuality,
  StreamingEvents,
  TaskType,
  VoiceEmotion,
} from '@heygen/streaming-avatar';
import { getAccessToken } from '@/lib/rag-client';
import { useConversation } from '@/hooks/useConversation';
import VoiceStatus from '@/components/VoiceStatus';
import CitationsPanel from '@/components/CitationsPanel';

const FALLBACK_MESSAGE = "I'm having trouble retrieving that information right now. Could you try again?";

export default function AvatarSession() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const avatarRef = useRef<StreamingAvatar | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [avatarId, setAvatarId] = useState<string>('38c680e881ec441cab7b68d515237d3f');
  const [voiceId, setVoiceId] = useState<string>('');
  const [isInitializing, setIsInitializing] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  const {
    state,
    setState,
    citations,
    council,
    error,
    sendQuery,
    clearError,
    resetConversation,
  } = useConversation();

  /**
   * Initialize the HeyGen avatar session.
   */
  const initializeAvatar = useCallback(async () => {
    if (isInitializing || isInitialized) return;
    if (!avatarId.trim()) {
      setInitError("Please enter a valid Avatar ID.");
      return;
    }
    
    setIsInitializing(true);
    setInitError(null);

    try {
      // 1. Fetch streaming token
      const token = await getAccessToken();

      // 2. Create avatar instance
      const avatar = new StreamingAvatar({ token });
      avatarRef.current = avatar;

      // 3. Set up event listeners
      avatar.on(StreamingEvents.STREAM_READY, (event: any) => {
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
        setState('idle');
      });

      avatar.on(StreamingEvents.USER_START, () => {
        setState('listening');
      });

      avatar.on(StreamingEvents.USER_STOP, () => {
        // This is the critical trigger — user finished speaking
        setState('processing');
      });

      // 4. Handle user's transcribed speech
      avatar.on(StreamingEvents.USER_END_MESSAGE, async (event: any) => {
        const transcript = event?.detail?.message || '';
        if (!transcript.trim()) return;

        setState('processing');

        // Send to RAG backend
        const spokenAnswer = await sendQuery(transcript);

        if (spokenAnswer) {
          // Command avatar to speak the response
          try {
            await avatar.speak({
              text: spokenAnswer,
              taskType: TaskType.REPEAT,
            });
          } catch (speakError) {
            console.error('Avatar speak error:', speakError);
            setState('idle');
          }
        } else {
          // Fallback: speak a generic message
          try {
            await avatar.speak({
              text: FALLBACK_MESSAGE,
              taskType: TaskType.REPEAT,
            });
          } catch {
            setState('idle');
          }
        }
      });

      avatar.on(StreamingEvents.STREAM_DISCONNECTED, () => {
        setIsInitialized(false);
        setState('idle');
      });

      // 5. Start the session using the v2 SDK methods (newSession -> startSession)
      let startConfig: any = {
        quality: AvatarQuality.Medium,
        avatarName: avatarId.trim(),
        language: 'en',
      };

      if (voiceId.trim()) {
        startConfig.voice = {
          voiceId: voiceId.trim(),
          rate: 1.0,
          emotion: VoiceEmotion.FRIENDLY,
        };
      }

      console.log('Creating new avatar session with config:', startConfig);
      
      const sessionData = await avatar.newSession(startConfig);
      console.log("Session created successfully. Starting session...", sessionData);
      
      await avatar.startSession();
      console.log("Avatar stream established.");

    } catch (err: any) {
      // Extensive logging to extract the exact API reason
      console.error('Avatar initialization error full object:', err);
      const apiReason = err?.response?.data || err?.message || err?.toString() || 'Failed to start avatar. 400 Bad Request.';
      setInitError(typeof apiReason === 'string' ? apiReason : JSON.stringify(apiReason));
      setIsInitializing(false);
    }
  }, [isInitializing, isInitialized, avatarId, voiceId, setState, sendQuery]);

  /**
   * End the avatar session.
   */
  const endSession = useCallback(async () => {
    if (avatarRef.current) {
      await avatarRef.current.stopAvatar();
      avatarRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsInitialized(false);
    setState('idle');
    resetConversation();
  }, [setState, resetConversation]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (avatarRef.current) {
        avatarRef.current.stopAvatar().catch(() => {});
      }
    };
  }, []);

  return (
    <div className="avatar-session">
      {/* Avatar Video */}
      <div className="avatar-video-container">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="avatar-video"
        />

        {!isInitialized && (
          <div className="avatar-placeholder">
            {isInitializing ? (
              <>
                <div className="loading-spinner" />
                <p>Initializing avatar...</p>
              </>
            ) : initError ? (
              <>
                <p className="error-text">{initError}</p>
                <div className="config-inputs">
                  <input
                    type="text"
                    placeholder="Avatar ID (required)"
                    value={avatarId}
                    onChange={(e) => setAvatarId(e.target.value)}
                    className="config-input"
                  />
                  <input
                    type="text"
                    placeholder="Voice ID (optional)"
                    value={voiceId}
                    onChange={(e) => setVoiceId(e.target.value)}
                    className="config-input"
                  />
                </div>
                <button onClick={initializeAvatar} className="btn-retry" disabled={!avatarId.trim()}>
                  Retry
                </button>
              </>
            ) : (
              <>
                <div className="avatar-icon">🎙️</div>
                <h2>Voice-First RAG Avatar</h2>
                <p>Speak naturally — the avatar will respond using clinical knowledge.</p>
                
                <div className="config-inputs">
                  <input
                    type="text"
                    placeholder="Avatar ID (e.g. Wayne_20240711)"
                    value={avatarId}
                    onChange={(e) => setAvatarId(e.target.value)}
                    className="config-input"
                  />
                  <input
                    type="text"
                    placeholder="Voice ID (optional)"
                    value={voiceId}
                    onChange={(e) => setVoiceId(e.target.value)}
                    className="config-input"
                  />
                </div>

                <button onClick={initializeAvatar} className="btn-start" disabled={!avatarId.trim()}>
                  Start Session
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Voice Status */}
      {isInitialized && (
        <div className="status-bar">
          <VoiceStatus state={state} />
          <button onClick={endSession} className="btn-end">
            End Session
          </button>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={clearError}>✕</button>
        </div>
      )}

      {/* Citations Panel */}
      <CitationsPanel citations={citations} visible={isInitialized} />

      {/* Council Badge */}
      {council && isInitialized && (
        <div className="council-badge">
          <span className={`council-state ${council.primary_state.toLowerCase()}`}>
            {council.primary_state}
          </span>
          <span className="council-modality">{council.recommended_modality}</span>
        </div>
      )}

      <style jsx>{`
        .avatar-session {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 20px;
          width: 100%;
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
        }

        .avatar-video-container {
          position: relative;
          width: 100%;
          aspect-ratio: 16 / 9;
          max-height: 450px;
          border-radius: 20px;
          overflow: hidden;
          background: linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 100%);
          border: 1px solid rgba(99, 102, 241, 0.2);
          box-shadow: 0 0 40px rgba(99, 102, 241, 0.1);
        }

        .avatar-video {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .avatar-placeholder {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          color: #e2e8f0;
          text-align: center;
          padding: 24px;
        }

        .avatar-icon {
          font-size: 48px;
          margin-bottom: 8px;
        }

        .avatar-placeholder h2 {
          font-size: 24px;
          font-weight: 700;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .avatar-placeholder p {
          color: #94a3b8;
          font-size: 14px;
          max-width: 320px;
        }

        .btn-start, .btn-retry {
          padding: 12px 32px;
          border: none;
          border-radius: 12px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          color: white;
        }

        .btn-start:hover, .btn-retry:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 20px rgba(99, 102, 241, 0.4);
        }

        .btn-end {
          padding: 8px 16px;
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 8px;
          background: rgba(239, 68, 68, 0.1);
          color: #ef4444;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn-end:hover {
          background: rgba(239, 68, 68, 0.2);
        }

        .status-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          max-width: 600px;
        }

        .error-banner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          width: 100%;
          max-width: 600px;
          padding: 12px 16px;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 12px;
          color: #fca5a5;
          font-size: 13px;
          animation: slideUp 0.3s ease-out;
        }

        .error-banner button {
          background: none;
          border: none;
          color: #fca5a5;
          cursor: pointer;
          font-size: 16px;
          padding: 0 4px;
        }

        .error-text {
          color: #fca5a5;
        }

        .loading-spinner {
          width: 32px;
          height: 32px;
          border: 3px solid rgba(99, 102, 241, 0.2);
          border-top-color: #6366f1;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        .council-badge {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 16px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
        }

        .council-state {
          font-size: 12px;
          font-weight: 600;
          padding: 3px 10px;
          border-radius: 6px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .council-state.depression { background: rgba(59, 130, 246, 0.15); color: #60a5fa; }
        .council-state.anxiety { background: rgba(245, 158, 11, 0.15); color: #fbbf24; }
        .council-state.crisis { background: rgba(239, 68, 68, 0.15); color: #f87171; }
        .council-state.general { background: rgba(34, 197, 94, 0.15); color: #4ade80; }

        .council-modality {
          font-size: 12px;
          color: #64748b;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
