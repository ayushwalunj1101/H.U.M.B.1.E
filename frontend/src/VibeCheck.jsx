import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ImmersiveAvatar from './ImmersiveAvatar';
import SuccessState from './SuccessState';
import './App.css';

const PHQ9_QUESTIONS = [
  { id: 1, question: "Little interest or pleasure in doing things?" },
  { id: 2, question: "Feeling down, depressed, or hopeless?" },
  { id: 3, question: "Trouble falling or staying asleep, or sleeping too much?" },
  { id: 4, question: "Feeling tired or having little energy?" },
  { id: 5, question: "Poor appetite or overeating?" },
  { id: 6, question: "Feeling bad about yourself?" },
  { id: 7, question: "Trouble concentrating on things?" },
  { id: 8, question: "Moving or speaking slowly, or being fidgety?" },
  { id: 9, question: "Thoughts that you would be better off dead?" }
];

const STAGE_INTRO = 'intro';
const STAGE_GAME = 'game';
const STAGE_PROCESSING = 'processing';
const STAGE_RESULT = 'result';

const VibeCheck = ({ userData, onComplete }) => {
  const [stage, setStage] = useState(STAGE_INTRO);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [isAvatarTalking, setIsAvatarTalking] = useState(false);
  const [finalReport, setFinalReport] = useState(null);

  const avatarGender = userData?.pronouns === 'He/Him' ? 'female' : 'male';
  const chatHistory = JSON.parse(localStorage.getItem('apli_chat_messages') || '[]');

  const speak = (text) => {
    if (!window.speechSynthesis) return;
    
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find(v => 
      avatarGender === 'male' ? v.name.includes('Male') || v.name.includes('David') : v.name.includes('Female') || v.name.includes('Zira')
    );
    if (voice) utterance.voice = voice;
    
    utterance.onstart = () => setIsAvatarTalking(true);
    utterance.onend = () => setIsAvatarTalking(false);
    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    if (window.speechSynthesis) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }
    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const startGame = () => {
    setStage(STAGE_GAME);
    setTimeout(() => {
      speak(PHQ9_QUESTIONS[0].question);
    }, 500);
  };

  const handleAnswer = (score) => {
    const newAnswers = { ...answers, [currentQIndex]: score };
    setAnswers(newAnswers);

    if (currentQIndex < PHQ9_QUESTIONS.length - 1) {
      const nextIdx = currentQIndex + 1;
      setCurrentQIndex(nextIdx);
      setTimeout(() => {
        speak(PHQ9_QUESTIONS[nextIdx].question);
      }, 300);
    } else {
      finishGame(newAnswers);
    }
  };

  const extractThemes = (text) => {
    const themes = [];
    const lower = text.toLowerCase();
    if (lower.includes('anxious') || lower.includes('anxiety') || lower.includes('worry')) themes.push('Anxiety');
    if (lower.includes('depressed') || lower.includes('sad') || lower.includes('hopeless')) themes.push('Depression');
    if (lower.includes('sleep') || lower.includes('insomnia')) themes.push('Sleep Issues');
    if (lower.includes('stress') || lower.includes('overwhelm')) themes.push('Stress');
    if (lower.includes('relationship') || lower.includes('family')) themes.push('Relationships');
    return themes.length > 0 ? themes : ['General Mental Health'];
  };

  const generateRecommendations = (score, concerns) => {
    const recs = [];
    if (score >= 15) {
      recs.push('Immediate consultation with mental health professional');
      recs.push('Contact Tele-MANAS helpline: 14416');
      recs.push('Consider inpatient evaluation if experiencing crisis');
    } else if (score >= 10) {
      recs.push('Schedule appointment with psychiatrist or psychologist');
      recs.push('Consider therapy (CBT/DBT) for symptom management');
      recs.push('Regular follow-up assessments');
    } else if (score >= 5) {
      recs.push('Continue self-monitoring with regular check-ins');
      recs.push('Practice stress management techniques');
      recs.push('Maintain healthy lifestyle habits');
    } else {
      recs.push('Continue current wellness practices');
      recs.push('Regular self-assessment to track changes');
    }
    return recs;
  };

  const finishGame = (finalAnswers) => {
    setStage(STAGE_PROCESSING);
    window.speechSynthesis.cancel();
    
    const score = Object.values(finalAnswers).reduce((a, b) => a + b, 0);
    
    let severity, primaryState;
    if (score >= 20) {
      severity = "Severe";
      primaryState = "Severe Depression";
    } else if (score >= 15) {
      severity = "Moderately Severe";
      primaryState = "Moderately Severe Depression";
    } else if (score >= 10) {
      severity = "Moderate";
      primaryState = "Moderate Distress";
    } else if (score >= 5) {
      severity = "Mild";
      primaryState = "Mild Symptoms";
    } else {
      severity = "Minimal";
      primaryState = "Stable";
    }

    const userConcerns = chatHistory
      .filter(msg => msg.role === 'user')
      .map(msg => msg.content)
      .join(' ');
    
    const reportDetails = {
      primaryConcerns: userConcerns || 'Initial assessment - no prior chat history',
      keyThemes: extractThemes(userConcerns),
      riskFactors: score >= 15 ? ['Severe depressive symptoms', 'Immediate intervention needed'] : 
                   score >= 10 ? ['Moderate symptoms', 'Professional consultation recommended'] : 
                   ['Mild symptoms', 'Monitoring recommended'],
      recommendations: generateRecommendations(score, userConcerns)
    };
    
    const report = {
      severityScore: score,
      severity,
      primaryState,
      severityTrend: "Baseline",
      answers: finalAnswers,
      timestamp: new Date().toISOString(),
      maxScore: 27,
      clinicalDetails: reportDetails,
      chatHistory: chatHistory.slice(-10)
    };
    
    setFinalReport(report);

    setTimeout(() => {
      setStage(STAGE_RESULT);
      if (score >= 15) {
        speak("Assessment complete. Let's review your results together.");
      } else if (score >= 10) {
        speak("Assessment complete. Let's review your results.");
      } else {
        speak("Assessment complete. You're looking stable.");
      }
    }, 2000);
  };

  return (
    <div className="vibe-check-container">
      <div className="assessment-avatar-stage">
        <ImmersiveAvatar gender={avatarGender} isSpeaking={isAvatarTalking} />
      </div>

      <div className="assessment-card-area">
        <AnimatePresence mode='wait'>
          
          {stage === STAGE_INTRO && (
            <motion.div 
              key="intro"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="intro-card"
            >
              <h2>Clinical Assessment</h2>
              <p>I'm going to ask you 9 quick questions to understand where you stand.</p>
              <p style={{ fontSize: '0.9rem', color: '#a1a1aa', marginTop: '1rem' }}>
                PHQ-9 Assessment • 2 minutes
              </p>
              <button className="btn-primary" onClick={startGame}>Start Assessment</button>
            </motion.div>
          )}

          {stage === STAGE_GAME && (
            <motion.div 
              key="game"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="question-card"
            >
              <div className="progress-bar">
                <div 
                  className="fill" 
                  style={{ width: `${((currentQIndex + 1) / PHQ9_QUESTIONS.length) * 100}%` }} 
                />
              </div>
              
              <div className="question-number">
                Question {currentQIndex + 1} of {PHQ9_QUESTIONS.length}
              </div>
              
              <h3>{PHQ9_QUESTIONS[currentQIndex].question}</h3>
              
              <div className="options-grid">
                {[
                  { label: "Not at all", score: 0, severity: "none" },
                  { label: "Several days", score: 1, severity: "mild" },
                  { label: "More than half", score: 2, severity: "moderate" },
                  { label: "Nearly every day", score: 3, severity: "severe" }
                ].map((opt) => (
                  <button 
                    key={opt.score} 
                    className={`option-btn option-${opt.severity}`}
                    onClick={() => handleAnswer(opt.score)}
                  >
                    <span className="option-score">{opt.score}</span>
                    <span className="option-label">{opt.label}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {stage === STAGE_PROCESSING && (
             <motion.div 
               key="proc" 
               className="processing-state"
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
             >
               <div className="spinner"></div>
               <p>Analyzing Patterns...</p>
             </motion.div>
          )}

          {stage === STAGE_RESULT && (
            <SuccessState 
              userGender={avatarGender}
              userName={userData?.name}
              report={finalReport} 
              onContinue={() => onComplete(finalReport)}
            />
          )}

        </AnimatePresence>
      </div>
    </div>
  );
};

export default VibeCheck;
