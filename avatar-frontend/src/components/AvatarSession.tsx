/**
 * AvatarSession — LiveAvatar SDK + RAG-powered voice interaction.
 * - Avatar: Rendered via @heygen/liveavatar-web-sdk (LITE mode)
 * - RAG Mic button: captures speech → backend `/api/rag-speak` → speaks clinical response aloud
 */
'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { LiveAvatarSession } from '@heygen/liveavatar-web-sdk';
import { getAccessToken } from '@/lib/rag-client';
import { useConversation } from '@/hooks/useConversation';
import CitationsPanel from '@/components/CitationsPanel';
import VoiceStatus from '@/components/VoiceStatus';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export default function AvatarSession() {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const sessionRef = useRef<LiveAvatarSession | null>(null);
  
  const [isInitialized, setIsInitialized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  const [textInput, setTextInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const {
    state,
    setState,
    citations,
    council,
    error,
    sendQuery,
    clearError,
    setError,
    resetConversation,
  } = useConversation();

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  /**
   * Initialize the LiveAvatar session (LITE mode).
   */
  const initializeAvatar = useCallback(async () => {
    if (isInitializing || isInitialized) return;
    
    setIsInitializing(true);
    setInitError(null);

    try {
      // 1. Fetch LiveAvatar session token from backend
      const tokenData = await getAccessToken();
      console.log('[LiveAvatar] Session token received');

      // 2. Create LiveAvatar session
      const session = new LiveAvatarSession(tokenData, {
        voiceChat: false,
      });
      sessionRef.current = session;

      // 3. Start the session
      await session.start();
      console.log('[LiveAvatar] Session started successfully');

      // 4. Attach the WebRTC stream to our video element
      if (videoRef.current) {
        session.attach(videoRef.current);
        console.log('[LiveAvatar] Stream attached to video element');
      }

      setIsInitialized(true);
      setIsInitializing(false);

    } catch (err: unknown) {
      console.error('[LiveAvatar] Initialization failed:', err);
      let userFriendlyError = 'Failed to connect to the avatar service. Please try again.';

      if (err instanceof Error) {
        if (err.message.includes('401') || err.message.toLowerCase().includes('token')) {
          userFriendlyError = 'Authentication failed. Please check your API keys.';
        } else if (err.message.includes('Network') || err.message.includes('fetch')) {
          userFriendlyError = 'Network connection lost. Please check your internet.';
        }
      }

      setInitError(userFriendlyError);
      setIsInitializing(false);
    }
  }, [isInitializing, isInitialized]);


  /**
   * Process a message through the RAG pipeline
   * We pass speak=true to sendQuery so the backend directly tells LiveAvatar API to speak the response!
   */
  const processMessage = useCallback(async (text: string) => {
    if (!text.trim() || isSending || !isInitialized) return;

    setIsSending(true);
    setChatMessages(prev => [...prev, { role: 'user', content: text }]);

    try {
      // The backend will query RAG, then automatically call LiveAvatar API to make the avatar speak!
      const answer = await sendQuery(text, true);

      if (answer) {
        setChatMessages(prev => [...prev, { role: 'assistant', content: answer }]);
      } else {
        const fallback = "I'm having trouble right now. Could you rephrase that?";
        setChatMessages(prev => [...prev, { role: 'assistant', content: fallback }]);
      }
    } catch (err) {
      console.error('RAG query failed:', err);
      setChatMessages(prev => [...prev, { role: 'assistant', content: "Something went wrong. Please try again." }]);
    } finally {
      setIsSending(false);
    }
  }, [isSending, isInitialized, sendQuery]);

  /**
   * Toggle microphone — uses Web Speech API to capture user's voice,
   * then sends the transcript to the RAG backend.
   */
  const toggleMic = useCallback(() => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('Speech recognition is not supported in this browser. Use Chrome.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.continuous = false;

    recognition.onstart = () => setIsListening(true);
    
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      console.log('[Mic] Transcript:', transcript);
      setIsListening(false);
      processMessage(transcript);
    };

    recognition.onerror = (event: any) => {
      console.error('[Mic] Error:', event.error);
      setIsListening(false);
      if (event.error === 'not-allowed') {
        setError('Microphone access denied. Please allow mic access.');
      }
    };

    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
  }, [isListening, processMessage, setError]);


  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (textInput.trim()) {
      processMessage(textInput.trim());
      setTextInput('');
    }
  }, [textInput, processMessage]);


  const endSession = useCallback(async () => {
    if (sessionRef.current) {
      await sessionRef.current.stop();
      sessionRef.current = null;
    }
    setIsInitialized(false);
    setChatMessages([]);
    resetConversation();
  }, [resetConversation]);

  useEffect(() => {
    return () => {
      if (sessionRef.current) {
        sessionRef.current.stop().catch(() => {});
      }
    };
  }, []);

  return (
    <div className="avatar-session">
      {/* Avatar Container uses the LiveAvatar web SDK injected rendering stream! */}
      <div className="avatar-video-container" ref={containerRef}>
        {/* The actual video element the SDK will attach the stream to */}
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
                <button onClick={initializeAvatar} className="btn-retry">
                  Retry
                </button>
              </>
            ) : (
              <>
                <div className="avatar-icon">🎙️</div>
                <h2>H.U.M.B.L.E Therapist</h2>
                <p>Talk naturally — the avatar will respond using the clinical RAG pipeline.</p>
                <button onClick={initializeAvatar} className="btn-start">
                  Start Session
                </button>
              </>
            )}
          </div>
        )}

        {/* Overlay Mic Button right on top of the Avatar when initialized */}
        {isInitialized && (
          <div className="integrated-mic-overlay">
            <button 
              onClick={toggleMic} 
              className={`integrated-mic-btn ${isListening ? 'listening' : ''}`}
              title="Click to talk via RAG"
              disabled={isSending}
            >
              <div className="mic-icon-wrapper">
                {isListening ? (
                  <span className="recording-dot"></span>
                ) : (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                    <line x1="12" y1="19" x2="12" y2="22"/>
                  </svg>
                )}
              </div>
            </button>
          </div>
        )}
      </div>

      {isInitialized && (
         <div className="status-bar">
          <VoiceStatus state={state} />
          <button onClick={endSession} className="btn-end">End Session</button>
         </div>
      )}


      {/* Text Chat Panel */}
      {isInitialized && (
        <div className="chat-panel">
          <div className="chat-header">
            <span className="chat-title">💬 Clinical Text Chat</span>
          </div>

          <div className="chat-messages">
            {chatMessages.length === 0 && (
              <div className="chat-empty">
                Use the mic button on the avatar, or type below.
              </div>
            )}
            {chatMessages.map((msg, i) => (
              <div key={i} className={`chat-bubble ${msg.role}`}>
                <span className="chat-role">{msg.role === 'user' ? 'You' : 'Therapist'}</span>
                <p>{msg.content}</p>
              </div>
            ))}
            {isSending && (
              <div className="chat-bubble assistant typing">
                <span className="chat-role">Therapist</span>
                <p>Thinking...</p>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <form onSubmit={handleSubmit} className="chat-input-bar">
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Type your message..."
              className="chat-input"
              disabled={isSending}
            />
            <button type="submit" className="btn-send" disabled={isSending || !textInput.trim()}>
              ➤
            </button>
          </form>
        </div>
      )}

      {/* Citations Panel */}
      <CitationsPanel citations={citations} visible={isInitialized && citations.length > 0} />

      {/* Council Badge */}
      {council && isInitialized && (
        <div className="council-badge">
          <span className={`council-state ${council.primary_state.toLowerCase()}`}>
            {council.primary_state}
          </span>
          <span className="council-modality">{council.recommended_modality}</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={clearError}>✕</button>
        </div>
      )}

      <style jsx>{`
        .avatar-session {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          width: 100%;
          max-width: 900px;
          margin: 0 auto;
          padding: 20px;
        }

        .avatar-video-container {
          position: relative;
          width: 100%;
          aspect-ratio: 16 / 9;
          max-height: 420px;
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
          display: block;
        }

        /* The LiveKit SDK injects Video tags globally. We use absolute positioning inside it. */
        .avatar-video-container :global(video) {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .integrated-mic-overlay {
          position: absolute;
          bottom: 24px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 10;
        }

        .integrated-mic-btn {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          border: 2px solid rgba(255, 255, 255, 0.2);
          background: rgba(15, 15, 26, 0.6);
          backdrop-filter: blur(10px);
          color: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        }

        .integrated-mic-btn:hover:not(:disabled) {
          transform: scale(1.1);
          background: rgba(99, 102, 241, 0.8);
          border-color: rgba(255, 255, 255, 0.4);
        }

        .integrated-mic-btn.listening {
          background: rgba(239, 68, 68, 0.9);
          border-color: #fca5a5;
          animation: micPulse 1.5s infinite;
        }
        
        .integrated-mic-btn:disabled {
           opacity: 0.6;
           cursor: not-allowed;
           transform: scale(0.95);
        }

        .recording-dot {
          width: 16px;
          height: 16px;
          background: white;
          border-radius: 4px;
        }

        @keyframes micPulse {
          0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
          70% { box-shadow: 0 0 0 16px rgba(239, 68, 68, 0); }
          100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }

        .avatar-placeholder {
          width: 100%; height: 100%;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          gap: 12px; color: #e2e8f0; text-align: center; padding: 24px;
        }

        .avatar-icon { font-size: 48px; margin-bottom: 8px; }

        .avatar-placeholder h2 {
          font-size: 24px; font-weight: 700;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        }

        .avatar-placeholder p { color: #94a3b8; font-size: 14px; max-width: 360px; }

        /* Status & End Button */
        .status-bar {
          display: flex;
          width: 100%;
          justify-content: space-between;
          align-items: center;
        }

        /* Chat Panel */
        .chat-panel {
          width: 100%;
          border: 1px solid rgba(99, 102, 241, 0.15);
          border-radius: 16px;
          background: rgba(15, 15, 26, 0.6);
          backdrop-filter: blur(8px);
          overflow: hidden;
        }

        .chat-header {
          display: flex; align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .chat-title { font-size: 13px; font-weight: 600; color: #94a3b8; }

        .chat-messages {
          max-height: 220px; overflow-y: auto; padding: 12px 16px;
          display: flex; flex-direction: column; gap: 10px;
        }

        .chat-empty { text-align: center; color: #64748b; font-size: 13px; padding: 16px 0; }

        .chat-bubble {
          max-width: 80%; padding: 10px 14px; border-radius: 14px;
          font-size: 14px; line-height: 1.5; animation: slideUp 0.2s ease-out;
        }

        .chat-bubble.user {
          align-self: flex-end;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          color: white; border-bottom-right-radius: 4px;
        }

        .chat-bubble.assistant {
          align-self: flex-start;
          background: rgba(255, 255, 255, 0.06);
          color: #e2e8f0; border-bottom-left-radius: 4px;
        }

        .chat-bubble.typing { opacity: 0.6; }

        .chat-role {
          display: block; font-size: 11px; font-weight: 600;
          opacity: 0.7; margin-bottom: 2px; text-transform: uppercase;
        }

        .chat-bubble p { margin: 0; }

        .chat-input-bar {
          display: flex; gap: 8px; padding: 12px 16px;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
        }

        .chat-input {
          flex: 1; padding: 10px 14px;
          border: 1px solid rgba(99, 102, 241, 0.2);
          border-radius: 10px; background: rgba(15, 15, 26, 0.8);
          color: #e2e8f0; font-size: 14px; outline: none;
        }

        .chat-input:focus { border-color: #6366f1; }
        .chat-input:disabled { opacity: 0.5; }

        .btn-send {
          padding: 10px 16px; border: none; border-radius: 10px;
          font-size: 16px; cursor: pointer;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          color: white;
        }

        .btn-send:disabled { opacity: 0.4; cursor: not-allowed; }

        .btn-start, .btn-retry {
          padding: 12px 32px; border: none; border-radius: 12px;
          font-size: 16px; font-weight: 600; cursor: pointer;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          color: white; transition: all 0.2s;
        }

        .btn-start:hover { transform: translateY(-2px); box-shadow: 0 4px 20px rgba(99, 102, 241, 0.4); }

        .btn-end {
          padding: 6px 12px;
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 8px; background: rgba(239, 68, 68, 0.1);
          color: #ef4444; font-size: 12px; cursor: pointer;
        }

        .error-banner {
          display: flex; align-items: center; justify-content: space-between;
          gap: 12px; width: 100%; padding: 12px 16px;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 12px; color: #fca5a5; font-size: 13px;
        }

        .error-banner button { background: none; border: none; color: #fca5a5; cursor: pointer; }

        .council-badge {
          display: flex; align-items: center; gap: 10px;
          padding: 8px 16px; background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 12px;
        }

        .council-state {
          font-size: 12px; font-weight: 600; padding: 3px 10px;
          border-radius: 6px; text-transform: uppercase;
        }

        .council-state.depression { background: rgba(59, 130, 246, 0.15); color: #60a5fa; }
        .council-state.anxiety { background: rgba(245, 158, 11, 0.15); color: #fbbf24; }
        .council-state.crisis { background: rgba(239, 68, 68, 0.15); color: #f87171; }
        .council-state.general { background: rgba(34, 197, 94, 0.15); color: #4ade80; }

        .council-modality { font-size: 12px; color: #64748b; }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
