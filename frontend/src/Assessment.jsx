import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import JarvisOrb from './components/JarvisOrb';
import './App.css';

// PHQ-9 (Patient Health Questionnaire-9) - Clinically validated depression screening
const ASSESSMENT_QUESTIONS = [
  {
    id: 1,
    question: "Over the last 2 weeks, how often have you been bothered by little interest or pleasure in doing things?",
    category: "depression",
    options: [
      { text: "Not at all", score: 0 },
      { text: "Several days", score: 1 },
      { text: "More than half the days", score: 2 },
      { text: "Nearly every day", score: 3 }
    ]
  },
  {
    id: 2,
    question: "Over the last 2 weeks, how often have you been bothered by feeling down, depressed, or hopeless?",
    category: "depression",
    options: [
      { text: "Not at all", score: 0 },
      { text: "Several days", score: 1 },
      { text: "More than half the days", score: 2 },
      { text: "Nearly every day", score: 3 }
    ]
  },
  {
    id: 3,
    question: "Over the last 2 weeks, how often have you been bothered by trouble falling or staying asleep, or sleeping too much?",
    category: "depression",
    options: [
      { text: "Not at all", score: 0 },
      { text: "Several days", score: 1 },
      { text: "More than half the days", score: 2 },
      { text: "Nearly every day", score: 3 }
    ]
  },
  {
    id: 4,
    question: "Over the last 2 weeks, how often have you been bothered by feeling tired or having little energy?",
    category: "depression",
    options: [
      { text: "Not at all", score: 0 },
      { text: "Several days", score: 1 },
      { text: "More than half the days", score: 2 },
      { text: "Nearly every day", score: 3 }
    ]
  },
  {
    id: 5,
    question: "Over the last 2 weeks, how often have you been bothered by poor appetite or overeating?",
    category: "depression",
    options: [
      { text: "Not at all", score: 0 },
      { text: "Several days", score: 1 },
      { text: "More than half the days", score: 2 },
      { text: "Nearly every day", score: 3 }
    ]
  },
  {
    id: 6,
    question: "Over the last 2 weeks, how often have you been bothered by feeling bad about yourself — or that you are a failure or have let yourself or your family down?",
    category: "depression",
    options: [
      { text: "Not at all", score: 0 },
      { text: "Several days", score: 1 },
      { text: "More than half the days", score: 2 },
      { text: "Nearly every day", score: 3 }
    ]
  },
  {
    id: 7,
    question: "Over the last 2 weeks, how often have you been bothered by trouble concentrating on things, such as reading the newspaper or watching television?",
    category: "depression",
    options: [
      { text: "Not at all", score: 0 },
      { text: "Several days", score: 1 },
      { text: "More than half the days", score: 2 },
      { text: "Nearly every day", score: 3 }
    ]
  },
  {
    id: 8,
    question: "Over the last 2 weeks, how often have you been bothered by moving or speaking so slowly that other people could have noticed? Or the opposite — being so fidgety or restless that you have been moving around a lot more than usual?",
    category: "depression",
    options: [
      { text: "Not at all", score: 0 },
      { text: "Several days", score: 1 },
      { text: "More than half the days", score: 2 },
      { text: "Nearly every day", score: 3 }
    ]
  },
  {
    id: 9,
    question: "Over the last 2 weeks, how often have you been bothered by thoughts that you would be better off dead, or of hurting yourself in some way?",
    category: "depression",
    options: [
      { text: "Not at all", score: 0 },
      { text: "Several days", score: 1 },
      { text: "More than half the days", score: 2 },
      { text: "Nearly every day", score: 3 }
    ]
  }
];

const Assessment = ({ userData, onComplete }) => {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const progress = ((currentQuestion + 1) / ASSESSMENT_QUESTIONS.length) * 100;
  const question = ASSESSMENT_QUESTIONS[currentQuestion];

  const handleAnswer = (optionIndex) => {
    const newAnswers = {
      ...answers,
      [question.id]: {
        questionId: question.id,
        category: question.category,
        score: question.options[optionIndex].score,
        answer: question.options[optionIndex].text
      }
    };
    setAnswers(newAnswers);

    // Auto-advance after short delay
    setTimeout(() => {
      if (currentQuestion < ASSESSMENT_QUESTIONS.length - 1) {
        setCurrentQuestion(prev => prev + 1);
      } else {
        submitAssessment(newAnswers);
      }
    }, 300);
  };

  const submitAssessment = async (finalAnswers) => {
    setIsSubmitting(true);
    
    // Calculate scores
    const totalScore = Object.values(finalAnswers).reduce((sum, a) => sum + a.score, 0);
    const maxScore = ASSESSMENT_QUESTIONS.length * 3;
    const percentageScore = Math.round((totalScore / maxScore) * 100);
    
    // Category scores
    const categories = {};
    Object.values(finalAnswers).forEach(answer => {
      if (!categories[answer.category]) {
        categories[answer.category] = { total: 0, count: 0 };
      }
      categories[answer.category].total += answer.score;
      categories[answer.category].count += 1;
    });

    const categoryScores = {};
    Object.entries(categories).forEach(([cat, data]) => {
      categoryScores[cat] = Math.round((data.total / (data.count * 3)) * 100);
    });

    // PHQ-9 severity ranges (based on total score 0-27)
    let severity = 'minimal';
    let riskLevel = 'low';
    
    if (totalScore >= 20) {
      severity = 'severe';
      riskLevel = 'high';
    } else if (totalScore >= 15) {
      severity = 'moderately severe';
      riskLevel = 'moderate';
    } else if (totalScore >= 10) {
      severity = 'moderate';
      riskLevel = 'moderate';
    } else if (totalScore >= 5) {
      severity = 'mild';
      riskLevel = 'low';
    }
    
    // Check for suicidal ideation (question 9)
    if (finalAnswers[9]?.score > 0) {
      riskLevel = 'high';
    }

    const report = {
      timestamp: new Date().toISOString(),
      assessmentType: 'PHQ-9',
      totalScore,
      maxScore,
      percentageScore,
      severity,
      riskLevel,
      categoryScores,
      answers: finalAnswers,
      suicidalIdeation: finalAnswers[9]?.score > 0,
      recommendations: generateRecommendations(severity, riskLevel, finalAnswers)
    };

    // Save to localStorage
    localStorage.setItem('apli_assessment_report', JSON.stringify(report));
    
    // Call completion handler if provided
    if (onComplete) {
      onComplete(report);
    }

    // Navigate to report
    navigate('/report');
  };

  const generateRecommendations = (severity, riskLevel, finalAnswers) => {
    const recommendations = [];
    
    // Critical: Suicidal ideation check
    if (finalAnswers[9]?.score > 0) {
      recommendations.push({
        area: "Immediate Support Needed",
        suggestion: "You mentioned thoughts of self-harm. Please call Tele-MANAS at 14416 (24/7, Free) or Connecting Trust (Pune) at 9922001122 immediately.",
        priority: "critical"
      });
    }
    
    // Severity-based recommendations
    if (severity === 'severe' || severity === 'moderately severe') {
      recommendations.push({
        area: "Professional Support",
        suggestion: "Your PHQ-9 score indicates severe depression. Please consult a mental health professional or psychiatrist for evaluation and treatment.",
        priority: "critical"
      });
    } else if (severity === 'moderate') {
      recommendations.push({
        area: "Professional Support",
        suggestion: "Consider scheduling an appointment with a therapist or counselor for evidence-based treatment like CBT.",
        priority: "high"
      });
    }
    
    // Symptom-specific recommendations
    if (finalAnswers[3]?.score >= 2) {
      recommendations.push({
        area: "Sleep Hygiene",
        suggestion: "Establish a consistent sleep schedule, limit screen time before bed, and create a relaxing bedtime routine.",
        priority: "medium"
      });
    }
    
    if (finalAnswers[4]?.score >= 2) {
      recommendations.push({
        area: "Energy & Activity",
        suggestion: "Try gentle physical activity like walking, even for 10-15 minutes daily. Start small and build gradually.",
        priority: "medium"
      });
    }
    
    if (finalAnswers[7]?.score >= 2) {
      recommendations.push({
        area: "Concentration",
        suggestion: "Break tasks into smaller steps, reduce distractions, and practice mindfulness to improve focus.",
        priority: "medium"
      });
    }
    
    // General wellness recommendations
    if (severity !== 'minimal') {
      recommendations.push({
        area: "Daily Practices",
        suggestion: "Practice self-compassion, maintain social connections, and consider journaling your thoughts and feelings.",
        priority: "low"
      });
    }

    return recommendations;
  };

  return (
    <div className="assessment-container">
      {/* Header */}
      <div className="assessment-header">
        <button className="btn-back" onClick={() => navigate('/chat')}>
          ← Back to Chat
        </button>
        <h1>PHQ-9 Depression Screening</h1>
        <p>Over the last 2 weeks, how often have you been bothered by the following problems?</p>
      </div>

      {/* Progress bar */}
      <div className="assessment-progress">
        <div className="progress-bar">
          <motion.div 
            className="progress-fill"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
        <span className="progress-text">
          Question {currentQuestion + 1} of {ASSESSMENT_QUESTIONS.length}
        </span>
      </div>

      {/* Orb indicator */}
      <div className="assessment-orb">
        <JarvisOrb 
          levelRef={{ current: 0 }}
          mode={isSubmitting ? 'processing' : 'listening'}
          size={120}
        />
      </div>

      {/* Question */}
      <AnimatePresence mode="wait">
        {!isSubmitting ? (
          <motion.div
            key={currentQuestion}
            className="question-card"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.3 }}
          >
            <h2 className="question-text">{question.question}</h2>
            
            <div className="options-grid">
              {question.options.map((option, index) => (
                <motion.button
                  key={index}
                  className={`option-btn ${answers[question.id]?.answer === option.text ? 'selected' : ''}`}
                  onClick={() => handleAnswer(index)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {option.text}
                </motion.button>
              ))}
            </div>
          </motion.div>
        ) : (
          <motion.div
            className="submitting-state"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <p>Analyzing your responses...</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation */}
      {currentQuestion > 0 && !isSubmitting && (
        <button 
          className="btn-previous"
          onClick={() => setCurrentQuestion(prev => prev - 1)}
        >
          Previous Question
        </button>
      )}
    </div>
  );
};

export default Assessment;
