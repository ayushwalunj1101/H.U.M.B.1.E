'use client';

import React, { useRef } from 'react';
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import ImmersiveAvatar from './ImmersiveAvatar';
import SuccessState from './SuccessState';
import { useAppContext } from '@/context/AppContext';

const PHQ9_QUESTIONS = [
  "Little interest or pleasure in doing things?",
  "Feeling down, depressed, or hopeless?",
  "Trouble falling or staying asleep, or sleeping too much?",
  "Feeling tired or having little energy?",
  "Poor appetite or overeating?",
  "Feeling bad about yourself — or that you are a failure?",
  "Trouble concentrating on things?",
  "Moving or speaking so slowly that other people could notice — or being so restless you've been moving around more?",
  "Thoughts that you would be better off dead, or thoughts of hurting yourself?",
];

const OPTIONS = [
  { label: 'Not at all',        value: 0, emoji: '😊' },
  { label: 'Several days',      value: 1, emoji: '😐' },
  { label: 'More than half the days', value: 2, emoji: '😟' },
  { label: 'Nearly every day',  value: 3, emoji: '😢' },
];

const SEVERITY = (s: number) => s <= 4 ? { label: 'Minimal', color: '#10b981' } : s <= 9 ? { label: 'Mild', color: '#f59e0b' } : s <= 14 ? { label: 'Moderate', color: '#f97316' } : { label: 'Severe', color: '#ef4444' };

type Stage = 'intro' | 'game' | 'processing' | 'result';

export default function VibeCheck() {
  const router = useRouter();
  const { userData, handleVibeCheckComplete } = useAppContext();
  const [stage, setStage] = useState<Stage>('intro');
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [report, setReport] = useState<any>(null);
  const [speaking, setSpeaking] = useState(false);

  const speakQuestion = useCallback((text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.9; u.pitch = 1.05;
    u.onstart = () => setSpeaking(true);
    u.onend = () => setSpeaking(false);
    window.speechSynthesis.speak(u);
  }, []);

  useEffect(() => {
    if (stage === 'game') speakQuestion(PHQ9_QUESTIONS[current]);
  }, [stage, current, speakQuestion]);

  const handleAnswer = (value: number) => {
    const updated = [...answers, value];
    setAnswers(updated);
    if (current < PHQ9_QUESTIONS.length - 1) {
      setCurrent(c => c + 1);
    } else {
      setStage('processing');
      const score = updated.reduce((a, b) => a + b, 0);
      const sev = SEVERITY(score);
      const r = {
        severityScore: score, severity: sev.label,
        primaryState: sev.label === 'Minimal' ? 'Stable' : sev.label === 'Mild' ? 'Monitoring' : 'Support Needed',
        timestamp: new Date().toISOString(),
      };
      setTimeout(() => { setReport(r); setStage('result'); }, 2500);
    }
  };

  const handleContinue = () => {
    handleVibeCheckComplete(report?.severity?.toLowerCase() || 'minimal');
    router.push('/chat');
  };

  if (stage === 'result') {
    return <SuccessState userGender={userData?.gender} userName={userData?.name} report={report} onContinue={handleContinue} />;
  }

  return (
    <div className="vibe-check-screen" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      {stage === 'intro' && (
        <motion.div className="vibe-intro" style={{ textAlign: 'center', maxWidth: 600 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <ImmersiveAvatar gender={userData?.gender as any} isSpeaking={false} />
          <h1 className="vibe-title" style={{ marginTop: '2rem' }}>Quick Vibe Check</h1>
          <p className="vibe-subtitle" style={{ marginTop: '1rem', opacity: 0.7 }}>
            A simple 9-question check-in to see how you're feeling. No right or wrong answers — just your honest experience.
          </p>
          <motion.button
            className="btn-primary"
            style={{ marginTop: '2rem' }}
            onClick={() => setStage('game')}
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          >
            Let's Begin
          </motion.button>
        </motion.div>
      )}

      {stage === 'game' && (
        <motion.div className="vibe-game" style={{ width: '100%', maxWidth: 680 }} key={current} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}>
          <div className="progress-bar-container" style={{ marginBottom: '2rem' }}>
            <div style={{ width: `${(current / PHQ9_QUESTIONS.length) * 100}%`, height: 4, background: 'linear-gradient(90deg,#6366f1,#8b5cf6)', borderRadius: 2, transition: 'width 0.4s ease' }} />
            <p style={{ marginTop: '0.5rem', opacity: 0.5, fontSize: '0.85rem' }}>{current + 1} / {PHQ9_QUESTIONS.length}</p>
          </div>
          <ImmersiveAvatar gender={userData?.gender as any} isSpeaking={speaking} />
          <h2 className="vibe-question" style={{ margin: '1.5rem 0', fontSize: '1.3rem', textAlign: 'center' }}>
            Over the last 2 weeks, how often have you been bothered by...
            <br /><span style={{ color: '#8b5cf6' }}>"{PHQ9_QUESTIONS[current]}"</span>
          </h2>
          <div className="vibe-options" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            {OPTIONS.map(opt => (
              <motion.button key={opt.value} className="vibe-option-btn" onClick={() => handleAnswer(opt.value)} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                style={{ padding: '1rem', borderRadius: 12, border: '2px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', cursor: 'pointer', color: '#fff', fontSize: '1rem', textAlign: 'center' }}>
                <div style={{ fontSize: '1.8rem' }}>{opt.emoji}</div>
                <div style={{ marginTop: '0.4rem', opacity: 0.85 }}>{opt.label}</div>
              </motion.button>
            ))}
          </div>
        </motion.div>
      )}

      {stage === 'processing' && (
        <motion.div style={{ textAlign: 'center' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="processing-spinner" style={{ width: 60, height: 60, borderRadius: '50%', border: '4px solid rgba(99,102,241,0.3)', borderTopColor: '#6366f1', animation: 'spin 1s linear infinite', margin: '0 auto 1.5rem' }} />
          <p style={{ opacity: 0.7 }}>Analyzing your responses...</p>
        </motion.div>
      )}
    </div>
  );
}
