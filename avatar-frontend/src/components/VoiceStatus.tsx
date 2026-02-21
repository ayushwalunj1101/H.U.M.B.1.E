/**
 * VoiceStatus — Visual indicator for current system state.
 * Shows: Listening | Thinking | Speaking | Ready
 */
'use client';

import React from 'react';
import { ConversationState } from '@/hooks/useConversation';

interface VoiceStatusProps {
  state: ConversationState;
}

const STATUS_CONFIG: Record<ConversationState, { label: string; color: string; icon: string; pulse: boolean }> = {
  idle: {
    label: 'Ready',
    color: '#6366f1',
    icon: '🎙️',
    pulse: false,
  },
  listening: {
    label: 'Listening...',
    color: '#22c55e',
    icon: '🎤',
    pulse: true,
  },
  processing: {
    label: 'Thinking...',
    color: '#f59e0b',
    icon: '🧠',
    pulse: true,
  },
  speaking: {
    label: 'Speaking...',
    color: '#8b5cf6',
    icon: '🔊',
    pulse: true,
  },
};

export default function VoiceStatus({ state }: VoiceStatusProps) {
  const config = STATUS_CONFIG[state];

  return (
    <div className="voice-status">
      <div
        className={`status-dot ${config.pulse ? 'pulse' : ''}`}
        style={{ backgroundColor: config.color }}
      />
      <span className="status-icon">{config.icon}</span>
      <span className="status-label">{config.label}</span>

      <style jsx>{`
        .voice-status {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 24px;
          font-size: 14px;
          color: #e2e8f0;
          transition: all 0.3s ease;
        }

        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          transition: background-color 0.3s ease;
        }

        .status-dot.pulse {
          animation: pulse 1.5s ease-in-out infinite;
        }

        .status-icon {
          font-size: 16px;
        }

        .status-label {
          font-weight: 500;
          letter-spacing: 0.02em;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
}
