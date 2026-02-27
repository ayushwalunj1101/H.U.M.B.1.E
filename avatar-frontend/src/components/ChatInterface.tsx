'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import JarvisOrb from './JarvisOrb';
import { useAudioLevel } from '@/hooks/useAudioLevel';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useSpeechSynthesis } from '@/hooks/useSpeechSynthesis';
import { useAppContext } from '@/context/AppContext';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  citations?: Array<{ title?: string; source?: string; text?: string }>;
  timestamp: number;
}

type OrbMode = 'idle' | 'listening' | 'processing' | 'speaking';

const STORAGE_KEY = 'apli_chat_messages';

export default function ChatInterface() {
  const router = useRouter();
  const { userData, riskLevel } = useAppContext();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText]   = useState('');
  const [orbMode, setOrbMode]       = useState<OrbMode>('idle');
  const [isLoading, setIsLoading]   = useState(false);
  const [showCitations, setShowCitations] = useState(false);
  const [lastCitations, setLastCitations] = useState<any[]>([]);
  const [voiceMode, setVoiceMode]   = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLTextAreaElement>(null);

  const { levelRef, start: startAudio, stop: stopAudio } = useAudioLevel();
  const { isListening, transcript, interimTranscript, resetTranscript, startListening, stopListening } = useSpeechRecognition();
  const { speak, cancel: cancelSpeech, isSpeaking } = useSpeechSynthesis();

  // Load saved messages
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          setMessages(JSON.parse(saved));
        } catch {}
      }
    }
  }, []);

  // Persist messages
  useEffect(() => {
    if (messages.length > 0 && typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    }
  }, [messages]);

  // Auto-scroll
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // Sync orb mode with speaking/listening
  useEffect(() => {
    if (isSpeaking)     setOrbMode('speaking');
    else if (isListening) setOrbMode('listening');
    else if (!isLoading)  setOrbMode('idle');
  }, [isSpeaking, isListening, isLoading]);

  // Populate input from voice transcript
  useEffect(() => {
    if (transcript) setInputText(transcript.trim());
  }, [transcript]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;
    cancelSpeech();
    const userMsg: Message = { role: 'user', content: text.trim(), timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    resetTranscript();
    setIsLoading(true);
    setOrbMode('processing');

    try {
      const body = {
        query: text.trim(),
        session_id: typeof window !== 'undefined' ? (localStorage.getItem('humble_session_id') || 'chat') : 'chat',
        user_name: userData?.name,
        risk_level: riskLevel,
      };

      const res = await fetch('/api/rag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json();

      const answerText = data.spoken_answer || data.answer || 'I heard you. Could you tell me more about that?';
      const citations  = data.citations || [];

      const assistantMsg: Message = { role: 'assistant', content: answerText, citations, timestamp: Date.now() };
      setMessages(prev => [...prev, assistantMsg]);
      setLastCitations(citations);

      if (voiceMode) {
        speak(answerText, {
          onStart: () => setOrbMode('speaking'),
          onEnd:   () => setOrbMode('idle'),
        });
      } else {
        setOrbMode('idle');
      }
    } catch (err: unknown) {
      const isNetwork = err instanceof TypeError && (err.message.includes('fetch') || err.message.includes('Network'));
      const errText = isNetwork
        ? "I'm having trouble connecting right now. Please check your connection and try again."
        : "I'm processing a lot right now. Could you rephrase that for me?";
      setMessages(prev => [...prev, { role: 'assistant', content: errText, timestamp: Date.now() }]);
      setOrbMode('idle');
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, cancelSpeech, resetTranscript, userData, riskLevel, voiceMode, speak]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(inputText); }
  };

  const toggleVoice = async () => {
    if (isListening) {
      stopListening();
      stopAudio();
      if (inputText.trim()) sendMessage(inputText);
    } else {
      resetTranscript();
      setInputText('');
      await startAudio();
      startListening();
    }
  };

  const clearHistory = () => {
    setMessages([]);
    if (typeof window !== 'undefined') localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <div className="chat-screen" style={{ display: 'flex', height: 'calc(100vh - 80px)', overflow: 'hidden' }}>
      {/* Sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div className="chat-sidebar" initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }}
            style={{ width: 260, padding: '1.5rem', borderRight: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: '0.75rem', overflowY: 'auto' }}>
            <h3 style={{ opacity: 0.7, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Sessions</h3>
            <button onClick={clearHistory} style={{ padding: '0.6rem 1rem', borderRadius: 8, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)', color: '#f87171', cursor: 'pointer', textAlign: 'left', fontSize: '0.85rem' }}>
              Clear History
            </button>
            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <button onClick={() => router.push('/assessment')}
                style={{ padding: '0.75rem', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#fff', cursor: 'pointer', fontSize: '0.85rem' }}>
                Take Assessment
              </button>
              <button onClick={() => router.push('/report')}
                style={{ padding: '0.75rem', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#fff', cursor: 'pointer', fontSize: '0.85rem' }}>
                View Report
              </button>
              <button onClick={() => router.push('/immersive')}
                style={{ padding: '0.75rem', borderRadius: 8, border: '1px solid rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.1)', color: '#a78bfa', cursor: 'pointer', fontSize: '0.85rem' }}>
                Immersive Mode
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Orb + Controls bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <button onClick={() => setSidebarOpen(v => !v)}
            style={{ padding: '0.5rem', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: '1.1rem' }}>
            ☰
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <JarvisOrb levelRef={levelRef} mode={orbMode} size={80} />
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Aura</div>
              <div style={{ opacity: 0.45, fontSize: '0.78rem' }}>{orbMode === 'idle' ? 'Ready' : orbMode === 'listening' ? 'Listening…' : orbMode === 'processing' ? 'Thinking…' : 'Speaking…'}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={() => setVoiceMode(v => !v)}
              style={{ padding: '0.5rem 0.9rem', borderRadius: 8, border: `1px solid ${voiceMode ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.1)'}`, background: voiceMode ? 'rgba(99,102,241,0.15)' : 'transparent', color: voiceMode ? '#a78bfa' : '#fff', cursor: 'pointer', fontSize: '0.8rem' }}>
              {voiceMode ? '🔊 Voice On' : '🔇 Voice Off'}
            </button>
            {lastCitations.length > 0 && (
              <button onClick={() => setShowCitations(v => !v)}
                style={{ padding: '0.5rem 0.9rem', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: '0.8rem' }}>
                📚 {lastCitations.length} Sources
              </button>
            )}
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {messages.length === 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: 'center', marginTop: '3rem', opacity: 0.5 }}>
              <p style={{ fontSize: '1rem' }}>Hi{userData?.name ? `, ${userData.name}` : ''}. I'm Aura — your mental health companion.</p>
              <p style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>How are you feeling today?</p>
            </motion.div>
          )}
          {messages.map((msg, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              style={{
                display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              }}>
              <div style={{
                maxWidth: '72%', padding: '0.85rem 1.1rem', borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                background: msg.role === 'user' ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : 'rgba(255,255,255,0.06)',
                border: msg.role === 'assistant' ? '1px solid rgba(255,255,255,0.08)' : 'none',
                lineHeight: 1.6, fontSize: '0.95rem',
              }}>
                {msg.content}
                {msg.citations && msg.citations.length > 0 && (
                  <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.12)', fontSize: '0.75rem', opacity: 0.55 }}>
                    {msg.citations.slice(0, 2).map((c, ci) => (
                      <div key={ci}>📖 {c.title || c.source || 'Source'}</div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
          {isLoading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div style={{ padding: '0.85rem 1.1rem', borderRadius: 14, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  {[0,1,2].map(d => (
                    <motion.div key={d} animate={{ y: [0, -5, 0] }} transition={{ duration: 0.6, delay: d * 0.15, repeat: Infinity }}
                      style={{ width: 7, height: 7, borderRadius: '50%', background: '#8b5cf6' }} />
                  ))}
                </div>
              </div>
            </motion.div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Citations panel */}
        <AnimatePresence>
          {showCitations && lastCitations.length > 0 && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              style={{ borderTop: '1px solid rgba(255,255,255,0.08)', padding: '1rem 1.5rem', background: 'rgba(255,255,255,0.02)', overflow: 'hidden' }}>
              <div style={{ fontSize: '0.8rem', opacity: 0.5, marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Sources</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {lastCitations.map((c, i) => (
                  <div key={i} style={{ padding: '0.4rem 0.85rem', borderRadius: 999, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', fontSize: '0.82rem', color: '#a78bfa' }}>
                    {c.title || c.source || `Source ${i + 1}`}
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input bar */}
        <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
          <textarea
            ref={inputRef}
            value={isListening ? (inputText + (interimTranscript ? ` ${interimTranscript}` : '')) : inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isListening ? 'Listening…' : 'Type a message or press mic to speak…'}
            rows={1}
            style={{
              flex: 1, padding: '0.75rem 1rem', borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: '0.95rem', resize: 'none', outline: 'none', fontFamily: 'inherit', lineHeight: 1.5,
            }}
          />
          <motion.button onClick={toggleVoice} whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.95 }}
            style={{ width: 44, height: 44, borderRadius: '50%', border: `2px solid ${isListening ? '#ef4444' : 'rgba(255,255,255,0.2)'}`, background: isListening ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.05)', color: '#fff', cursor: 'pointer', fontSize: '1.1rem', flexShrink: 0 }}>
            {isListening ? '⏹' : '🎙'}
          </motion.button>
          <motion.button onClick={() => sendMessage(inputText)} disabled={!inputText.trim() || isLoading}
            whileHover={inputText.trim() && !isLoading ? { scale: 1.05 } : {}} whileTap={inputText.trim() && !isLoading ? { scale: 0.95 } : {}}
            style={{ width: 44, height: 44, borderRadius: '50%', border: 'none', background: inputText.trim() && !isLoading ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : 'rgba(255,255,255,0.1)', color: '#fff', cursor: inputText.trim() && !isLoading ? 'pointer' : 'not-allowed', fontSize: '1.1rem', flexShrink: 0, opacity: inputText.trim() && !isLoading ? 1 : 0.4 }}>
            ➤
          </motion.button>
        </div>
      </div>
    </div>
  );
}
