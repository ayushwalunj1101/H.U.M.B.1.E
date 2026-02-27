/**
 * AvatarSession — HeyGen LiveAvatar embed with RAG integration.
 * The avatar renders via HeyGen's hosted embed (voice chat built-in).
 * RAG queries are sent to the backend for clinical knowledge retrieval.
 */
'use client';

import React, { useState, useCallback } from 'react';
import { useConversation } from '@/hooks/useConversation';
import VoiceStatus from '@/components/VoiceStatus';
import CitationsPanel from '@/components/CitationsPanel';

const EMBED_URL = 'https://embed.liveavatar.com/v1/3b78f84a-fab6-4591-9baa-f2ebfecf9f7a';

export default function AvatarSession() {
  const [isInitialized, setIsInitialized] = useState(false);

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

  const startSession = useCallback(() => {
    setIsInitialized(true);
    setState('idle');
  }, [setState]);

  const endSession = useCallback(() => {
    setIsInitialized(false);
    setState('idle');
    resetConversation();
  }, [setState, resetConversation]);

  return (
    <div className="avatar-session">
      <div className="avatar-video-container">
        {isInitialized ? (
          <iframe
            src={EMBED_URL}
            allow="microphone; camera"
            title="LiveAvatar Therapist"
            className="avatar-embed"
          />
        ) : (
          <div className="avatar-placeholder">
            <div className="avatar-icon">🎙️</div>
            <h2>Voice-First RAG Avatar</h2>
            <p>Speak naturally — the avatar will respond using clinical knowledge.</p>
            <button onClick={startSession} className="btn-start">
              Start Session
            </button>
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

        .avatar-embed {
          width: 100%;
          height: 100%;
          border: none;
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

        .btn-start {
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

        .btn-start:hover {
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

        .loading-spinner {
          width: 32px;
          height: 32px;
          border: 3px solid rgba(99, 102, 241, 0.2);
          border-top-color: #6366f1;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
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
