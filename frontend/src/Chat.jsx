import React, { useState, useRef, useEffect, useReducer } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

import JarvisOrb from './components/JarvisOrb';
import useAudioLevel from './hooks/useAudioLevel';
import useSpeechRecognition from './hooks/useSpeechRecognition';
import useSpeechSynthesis from './hooks/useSpeechSynthesis';

import './App.css';

/* ----------------------------------------
   Interaction State Machine (Single Truth)
-----------------------------------------*/

const initialInteractionState = {
  orb: 'idle',          // idle | listening | processing | speaking
  status: null          // human-readable status from backend
};

function interactionReducer(state, event) {
  switch (event.type) {
    case 'analysis_start':
      return { orb: 'processing', status: 'Analyzing' };

    case 'retrieval_start':
      return { orb: 'processing', status: 'Retrieving context' };

    case 'generation_start':
      return { orb: 'processing', status: 'Generating response' };

    case 'assistant_message':
      return { orb: 'speaking', status: null };

    case 'speech_end':
      return { orb: 'idle', status: null };

    case 'error':
      return { orb: 'idle', status: null };

    default:
      return state;
  }
}

/* ----------------------------------------
   Chat Component
-----------------------------------------*/

const Chat = ({ userData, riskLevel }) => {
  const navigate = useNavigate();
  const messagesEndRef = useRef(null);

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [interaction, dispatch] = useReducer(
    interactionReducer,
    initialInteractionState
  );

  /* -------- Audio / Voice Hooks -------- */

  const { levelRef, start: startAudio, stop: stopAudio } = useAudioLevel();

  const {
    isListening,
    transcript,
    interimTranscript,
    error: sttError,
    isSupported: sttSupported,
    startListening,
    stopListening,
    resetTranscript
  } = useSpeechRecognition();

  const {
    isSpeaking,
    isSupported: ttsSupported,
    speak,
    cancel: cancelSpeech
  } = useSpeechSynthesis();

  /* -------- Persist Chat -------- */

  useEffect(() => {
    const saved = localStorage.getItem('apli_chat_messages');
    if (saved) setMessages(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem('apli_chat_messages', JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  /* -------- Delete Chat --------*/

  const deleteChat = () => {
    setMessages([]);
    localStorage.removeItem('apli_chat_messages');
    setShowDeleteConfirm(false);
    cancelSpeech();
  };
  /* -------- STT → Input Sync -------- */

  useEffect(() => {
    if (transcript || interimTranscript) {
      setInput([transcript, interimTranscript].filter(Boolean).join(' '));
    }
  }, [transcript, interimTranscript]);

  /* ----------------------------------------
     Send Message (EVENT-DRIVEN)
  -----------------------------------------*/

  const sendMessage = async () => {
    if (!input.trim() || isSending) return;

    cancelSpeech();
    stopListening();
    resetTranscript();

    const userMessage = {
      role: 'user',
      content: input,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsSending(true);

    try {
      const response = await fetch('http://localhost:8000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          history: messages.slice(-5),
          riskLevel: riskLevel || 'unknown'
        })
      });

      if (!response.ok) {
        throw new Error(`API error ${response.status}`);
      }

      const data = await response.json();

      // Backend returns { response, council, sources }
      if (!data.response || typeof data.response !== 'string') {
        throw new Error('Invalid backend response: missing response content');
      }

      // Dispatch processing state
      dispatch({ type: 'assistant_message' });

      const assistantMessage = {
        role: 'assistant',
        content: data.response,
        timestamp: Date.now(),
        sources: data.sources || [],
        council: data.council || null
      };

      setMessages(prev => [...prev, assistantMessage]);

      if (ttsSupported) {
        speak(data.response, {
          rate: 0.95,
          onEnd: () => dispatch({ type: 'speech_end' })
        });
      } else {
        dispatch({ type: 'speech_end' });
      }
    } catch (err) {
      console.error(err);

      // Dynamic error message based on error type
      let errorContent;
      if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        errorContent = 'Unable to reach the server. Please check your connection and try again.';
      } else if (err.message.includes('API error')) {
        errorContent = 'The service is temporarily unavailable. Please try again in a moment.';
      } else {
        errorContent = 'Something unexpected happened. Please try again.';
      }

      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: errorContent,
          isError: true,
          timestamp: Date.now()
        }
      ]);

      dispatch({ type: 'error' });
    } finally {
      setIsSending(false);
    }
  };

  /* ----------------------------------------
     Voice Controls
  -----------------------------------------*/

  const toggleVoiceInput = () => {
    if (isListening) {
      stopListening();
      stopAudio();
      dispatch({ type: 'speech_end' });
    } else {
      cancelSpeech();
      startAudio();
      startListening();
      dispatch({ type: 'analysis_start' });
    }
  };

  /* ----------------------------------------
     Render
  -----------------------------------------*/

  return (
    <div className="chat-container">

      {/* -------- Delete Chat Button (Top Right) -------- */}
      <motion.button 
        className="delete-chat-floating"
        onClick={() => setShowDeleteConfirm(true)}
        title="Delete chat history"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          <line x1="10" y1="11" x2="10" y2="17"></line>
          <line x1="14" y1="11" x2="14" y2="17"></line>
        </svg>
      </motion.button>

      {/* -------- Orb Section -------- */}
      <div className="chat-orb-section">
        <JarvisOrb
          levelRef={levelRef}
          size={200}
          mode={isListening ? 'listening' : interaction.orb}
        />

        {interaction.status && (
          <motion.div
            className="processing-status"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
          >
            <div className="status-spinner"></div>
            <span>{interaction.status}</span>
          </motion.div>
        )}

        {(isListening || isSpeaking) && (
          <motion.div 
            className="voice-status-indicator"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
          >
            {isListening && (
              <div className="status-badge listening">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                </svg>
                <span>Listening</span>
              </div>
            )}
            {isSpeaking && (
              <div className="status-badge speaking">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
                </svg>
                <span>Speaking</span>
              </div>
            )}
          </motion.div>
        )}

        <div className="orb-actions">
          <button className="btn-assessment" onClick={() => navigate('/assessment')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
            </svg>
            <span>Assessment</span>
          </button>
          <button className="btn-immersive" onClick={() => navigate('/immersive')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
              <line x1="9" y1="9" x2="9.01" y2="9"></line>
              <line x1="15" y1="9" x2="15.01" y2="9"></line>
            </svg>
            <span>Immersive</span>
          </button>
        </div>
      </div>

      {/* -------- Delete Confirmation Modal -------- */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div 
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowDeleteConfirm(false)}
          >
            <motion.div 
              className="delete-confirm-modal"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="modal-icon warning">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"></path>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
              </div>
              <h3>Delete Chat History?</h3>
              <p>This will permanently remove all messages from your conversation. This action cannot be undone.</p>
              <div className="modal-actions">
                <motion.button 
                  className="btn-modal-cancel"
                  onClick={() => setShowDeleteConfirm(false)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Cancel
                </motion.button>
                <motion.button 
                  className="btn-modal-delete"
                  onClick={deleteChat}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Delete
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* -------- Messages -------- */}
      <div className="chat-messages-area">
        <div className="messages-container">

          {messages.length === 0 && (
            <motion.div 
              className="empty-chat-state"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="empty-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
              </div>
              <h3>Welcome, {userData?.name || 'there'}</h3>
              <p>I'm here to listen and support you. Share what's on your mind.</p>
            </motion.div>
          )}

          {messages.map((msg, idx) => (
            <motion.div
              key={idx}
              className={`message ${msg.role} ${msg.isError ? 'error' : ''}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
            >
              <div className="message-bubble">
                {msg.content}
              </div>
              
              {msg.sources && msg.sources.length > 0 && (
                <motion.div 
                  className="message-sources"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  transition={{ delay: 0.2 }}
                >
                  <div className="sources-header">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                    </svg>
                    <span>Sources:</span>
                  </div>
                  <div className="sources-list">
                    {msg.sources.map((source, sIdx) => (
                      <span key={sIdx} className="source-tag">{source}</span>
                    ))}
                  </div>
                </motion.div>
              )}

              {msg.council && (
                <div className="message-council-badge">
                  <span className={`council-state ${msg.council.primary_state?.toLowerCase()}`}>
                    {msg.council.primary_state}
                  </span>
                </div>
              )}
            </motion.div>
          ))}

          <div ref={messagesEndRef} />
        </div>

        {/* -------- Input -------- */}
        <div className="chat-input-area">
          <div className="input-wrapper">
            {sttSupported && (
              <motion.button 
                className={`voice-button ${isListening ? 'active' : ''}`}
                onClick={toggleVoiceInput}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {isListening ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="6" width="12" height="12" rx="2"></rect>
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                    <line x1="12" y1="19" x2="12" y2="23"></line>
                    <line x1="8" y1="23" x2="16" y2="23"></line>
                  </svg>
                )}
              </motion.button>
            )}

            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={isListening ? "Listening..." : "Share what's on your mind…"}
              rows={3}
              disabled={isSending}
              className={isListening ? 'listening' : ''}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
            />

            <motion.button 
              className="send-button"
              onClick={sendMessage} 
              disabled={isSending || !input.trim()}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {isSending ? (
                <div className="loading-spinner"></div>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="22" y1="2" x2="11" y2="13"></line>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
              )}
            </motion.button>
          </div>

          {sttError && (
            <motion.div 
              className="stt-error"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              {sttError}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Chat;
