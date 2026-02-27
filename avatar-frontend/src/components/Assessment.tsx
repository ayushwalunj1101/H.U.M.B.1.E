'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useAppContext } from '@/context/AppContext';
import { buildAssessmentReport } from '@/lib/scoring';

const PHQ9 = [
  "Feeling down, depressed, or hopeless?",
  "Little interest or pleasure in doing things?",
  "Trouble falling or staying asleep, or sleeping too much?",
  "Feeling tired or having little energy?",
  "Poor appetite or overeating?",
  "Feeling bad about yourself or that you are a failure?",
  "Trouble concentrating on things, such as reading or watching television?",
  "Moving or speaking so slowly that other people could notice, or the opposite — being so fidgety that you've been moving around more than usual?",
  "Thoughts that you would be better off dead or of hurting yourself in some way?",
];

const OPTS = [
  { label: 'Not at all', value: 0 },
  { label: 'Several days', value: 1 },
  { label: 'More than half the days', value: 2 },
  { label: 'Nearly every day', value: 3 },
];

interface AssessmentProps {
  userData?: { name?: string; age?: string; gender?: string };
  onComplete?: (report: any) => void;
}

export default function Assessment({ userData, onComplete }: AssessmentProps) {
  const router = useRouter();
  const { userData: ctxData, handleVibeCheckComplete } = useAppContext();
  const user = userData || ctxData;

  const [answers, setAnswers] = useState<(number | null)[]>(new Array(PHQ9.length).fill(null));
  const [current, setCurrent] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [orbMode, setOrbMode] = useState<'idle' | 'speaking'>('idle');
  const levelRef = React.useRef(0);

  const speakQ = useCallback((text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.9;
    u.onstart = () => { setOrbMode('speaking'); levelRef.current = 0.4; };
    u.onend = () => { setOrbMode('idle'); levelRef.current = 0; };
    window.speechSynthesis.speak(u);
  }, []);

  useEffect(() => { speakQ(PHQ9[current]); }, [current, speakQ]);

  const setAnswer = (val: number) => {
    const updated = [...answers];
    updated[current] = val;
    setAnswers(updated);
  };

  const next = () => {
    if (current < PHQ9.length - 1) setCurrent(c => c + 1);
  };

  const prev = () => {
    if (current > 0) setCurrent(c => c - 1);
  };

  const submit = () => {
    // Build report using centralized scoring utility — no magic numbers
    const report = buildAssessmentReport(answers);

    // SECURITY: Do NOT store PHI/clinical data in localStorage.
    // Report is passed through React state (AppContext) only — never persisted client-side.

    handleVibeCheckComplete(report);
    setSubmitted(true);
    if (onComplete) {
      onComplete(report);
    } else {
      router.push('/report');
    }
  };

  const answered = answers[current] !== null;
  const allAnswered = answers.every(a => a !== null);
  const isLast = current === PHQ9.length - 1;

  return (
    <div className="assessment-screen" style={{ minHeight: '80vh', padding: '2rem', maxWidth: 780, margin: '0 auto' }}>
      <motion.div className="assessment-header" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h1 style={{ fontSize: '1.6rem', marginBottom: '0.5rem' }}>Clinical Assessment</h1>
        <p style={{ opacity: 0.6, marginBottom: '2rem' }}>PHQ-9 Standardised Depression Screening</p>
        <div style={{ height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, marginBottom: '2rem', overflow: 'hidden' }}>
          <motion.div style={{ height: '100%', background: 'linear-gradient(90deg,#6366f1,#8b5cf6)', borderRadius: 2 }} animate={{ width: `${((current + (answered ? 1 : 0)) / PHQ9.length) * 100}%` }} />
        </div>
      </motion.div>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '2rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 280 }}>
          <motion.div key={current} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <p style={{ opacity: 0.5, marginBottom: '0.5rem', fontSize: '0.85rem' }}>Question {current + 1} of {PHQ9.length}</p>
            <h2 style={{ fontSize: '1.1rem', marginBottom: '1.5rem', lineHeight: 1.6 }}>
              Over the last 2 weeks, how often have you been bothered by:<br />
              <span style={{ color: '#a78bfa' }}>{PHQ9[current]}</span>
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {OPTS.map(opt => (
                <motion.button key={opt.value} onClick={() => setAnswer(opt.value)}
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  style={{
                    padding: '0.85rem 1.2rem', borderRadius: 10, textAlign: 'left', cursor: 'pointer',
                    border: answers[current] === opt.value ? '2px solid #6366f1' : '2px solid rgba(255,255,255,0.1)',
                    background: answers[current] === opt.value ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)',
                    color: answers[current] === opt.value ? '#a78bfa' : '#fff', fontSize: '0.95rem',
                    transition: 'all 0.2s',
                  }}>
                  {opt.label}
                </motion.button>
              ))}
            </div>
          </motion.div>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
            <button onClick={prev} disabled={current === 0}
              style={{ padding: '0.75rem 1.5rem', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: '#fff', cursor: current === 0 ? 'not-allowed' : 'pointer', opacity: current === 0 ? 0.3 : 1 }}>
              Back
            </button>
            {isLast ? (
              <motion.button onClick={submit} disabled={!allAnswered}
                whileHover={allAnswered ? { scale: 1.04 } : {}} whileTap={allAnswered ? { scale: 0.96 } : {}}
                style={{ padding: '0.75rem 1.5rem', borderRadius: 8, border: 'none', background: allAnswered ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'rgba(255,255,255,0.1)', color: '#fff', cursor: allAnswered ? 'pointer' : 'not-allowed', opacity: allAnswered ? 1 : 0.5, fontWeight: 600 }}>
                Submit Assessment
              </motion.button>
            ) : (
              <motion.button onClick={next} disabled={!answered}
                whileHover={answered ? { scale: 1.04 } : {}} whileTap={answered ? { scale: 0.96 } : {}}
                style={{ padding: '0.75rem 1.5rem', borderRadius: 8, border: 'none', background: answered ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'rgba(255,255,255,0.1)', color: '#fff', cursor: answered ? 'pointer' : 'not-allowed', opacity: answered ? 1 : 0.5 }}>
                Next
              </motion.button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
