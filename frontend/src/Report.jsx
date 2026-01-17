import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import JarvisOrb from './components/JarvisOrb';
import './App.css';

const Report = ({ userData }) => {
  const [report, setReport] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const savedReport = localStorage.getItem('apli_assessment_report');
    if (savedReport) {
      setReport(JSON.parse(savedReport));
    }
  }, []);

  if (!report) {
    return (
      <div className="report-container">
        <div className="report-empty">
          <h2>No Assessment Found</h2>
          <p>Complete an assessment to see your wellness report.</p>
          <button 
            className="btn-primary"
            onClick={() => navigate('/assessment')}
          >
            Take Assessment
          </button>
        </div>
      </div>
    );
  }

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'minimal': return '#34d399';
      case 'mild': return '#fbbf24';
      case 'moderate': return '#f97316';
      case 'severe': return '#ef4444';
      default: return '#6366f1';
    }
  };

  const getSeverityLabel = (severity) => {
    switch (severity) {
      case 'minimal': return 'You\'re doing well!';
      case 'mild': return 'Some areas need attention';
      case 'moderate': return 'Consider seeking support';
      case 'severe': return 'Please reach out for help';
      default: return '';
    }
  };

  const getCategoryLabel = (category) => {
    const labels = {
      mood: '😊 Mood',
      anxiety: '😰 Anxiety',
      sleep: '😴 Sleep',
      energy: '⚡ Energy',
      social: '👥 Social',
      coping: '💪 Coping'
    };
    return labels[category] || category;
  };

  const formatDate = (isoString) => {
    return new Date(isoString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="report-container">
      {/* Header */}
      <div className="report-header">
        <button className="btn-back" onClick={() => navigate('/chat')}>
          ← Back to Chat
        </button>
        <h1>Your Wellness Report</h1>
        <p className="report-date">{formatDate(report.timestamp)}</p>
      </div>

      {/* Overall Score */}
      <motion.div 
        className="report-score-card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ borderColor: getSeverityColor(report.severity) }}
      >
        <div className="score-orb">
          <JarvisOrb 
            levelRef={{ current: 0 }}
            mode={report.severity === 'minimal' ? 'speaking' : report.severity === 'severe' ? 'processing' : 'listening'}
            size={140}
          />
        </div>
        
        <div className="score-details">
          <div className="score-number">
            <span className="score-value" style={{ color: getSeverityColor(report.severity) }}>
              {100 - report.percentageScore}%
            </span>
            <span className="score-label">Wellness Score</span>
          </div>
          
          <div 
            className="severity-badge"
            style={{ background: getSeverityColor(report.severity) }}
          >
            {report.severity.toUpperCase()}
          </div>
          
          <p className="severity-message">{getSeverityLabel(report.severity)}</p>
        </div>
      </motion.div>

      {/* Category Breakdown */}
      <motion.div 
        className="report-categories"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <h2>Category Breakdown</h2>
        <div className="categories-grid">
          {Object.entries(report.categoryScores).map(([category, score], index) => (
            <motion.div
              key={category}
              className="category-card"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 * index }}
            >
              <span className="category-name">{getCategoryLabel(category)}</span>
              <div className="category-bar">
                <motion.div 
                  className="category-fill"
                  initial={{ width: 0 }}
                  animate={{ width: `${100 - score}%` }}
                  transition={{ duration: 0.8, delay: 0.2 * index }}
                  style={{ 
                    background: score >= 50 
                      ? 'linear-gradient(90deg, #f97316, #ef4444)' 
                      : 'linear-gradient(90deg, #34d399, #22d3ee)' 
                  }}
                />
              </div>
              <span className="category-score">{100 - score}%</span>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Recommendations */}
      <motion.div 
        className="report-recommendations"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <h2>Personalized Recommendations</h2>
        <div className="recommendations-list">
          {report.recommendations.map((rec, index) => (
            <motion.div
              key={index}
              className={`recommendation-card priority-${rec.priority}`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 * index }}
            >
              <div className="rec-header">
                <span className="rec-area">{rec.area}</span>
                <span className={`rec-priority ${rec.priority}`}>
                  {rec.priority === 'critical' ? '🚨' : rec.priority === 'high' ? '⚠️' : '💡'}
                </span>
              </div>
              <p className="rec-suggestion">{rec.suggestion}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Actions */}
      <motion.div 
        className="report-actions"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
      >
        <button 
          className="btn-primary"
          onClick={() => navigate('/chat')}
        >
          Continue Chatting
        </button>
        <button 
          className="btn-secondary"
          onClick={() => navigate('/assessment')}
        >
          Retake Assessment
        </button>
        <button 
          className="btn-secondary"
          onClick={() => navigate('/immersive')}
        >
          Enter Immersive Mode
        </button>
      </motion.div>

      {/* Disclaimer */}
      <div className="report-disclaimer">
        <p>
          ⚠️ This assessment is for informational purposes only and is not a substitute 
          for professional medical advice, diagnosis, or treatment. If you're experiencing 
          a mental health crisis, please contact a mental health professional or crisis 
          helpline immediately.
        </p>
      </div>
    </div>
  );
};

export default Report;
