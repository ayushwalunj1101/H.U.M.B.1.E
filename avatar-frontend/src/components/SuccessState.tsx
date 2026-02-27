'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';

interface Report {
  severityScore: number;
  severity: string;
  primaryState: string;
  timestamp: string;
  clinicalDetails?: {
    primaryConcerns: string;
    keyThemes: string[];
    riskFactors: string[];
    recommendations: string[];
  };
}

interface SuccessStateProps {
  userGender?: string;
  userName?: string;
  report: Report | null;
  onContinue: () => void;
}

export default function SuccessState({ userGender, userName, report, onContinue }: SuccessStateProps) {
  const router = useRouter();
  const [showConfetti, setShowConfetti] = useState(true);
  const isHighRisk = report && report.severityScore >= 7;

  useEffect(() => {
    const timer = setTimeout(() => setShowConfetti(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="success-state">
      {showConfetti && !isHighRisk && (
        <div className="confetti-container">
          {[...Array(50)].map((_, i) => (
            <motion.div
              key={i}
              className="confetti-piece"
              style={{
                left: `${Math.random() * 100}%`,
                backgroundColor: ['#6366f1','#8b5cf6','#f43f5e','#10b981','#f59e0b'][Math.floor(Math.random() * 5)],
              }}
              initial={{ y: -20, opacity: 1, rotate: 0 }}
              animate={{ y: 900, opacity: 0, rotate: Math.random() * 720 - 360 }}
              transition={{ duration: Math.random() * 2 + 2, ease: 'easeOut', delay: Math.random() * 0.5 }}
            />
          ))}
        </div>
      )}

      <motion.div className="success-content" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}>
        <h1 className="success-title">
          {isHighRisk ? 'Clinical Assessment Report' : 'Assessment Complete'}
        </h1>
        <p className="success-subtitle">
          {isHighRisk
            ? 'Your assessment indicates significant distress. Professional support is recommended.'
            : 'Your wellbeing assessment has been processed.'}
        </p>

        {isHighRisk && (
          <motion.div className="manas-alert-box" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4, delay: 0.4 }}>
            <div className="manas-header">
              <span className="pulse-dot" />
              <strong>Tele-MANAS Connection Recommended</strong>
            </div>
            <p>Your score indicates significant distress. We have prepared a clinical summary for professional consultation.</p>
            <button className="btn-manas-connect" onClick={() => window.open('tel:14416', '_self')}>
              Call 14416 (Tele-MANAS Helpline)
            </button>
          </motion.div>
        )}

        {report && (
          <motion.div className="clinical-details-card" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4, delay: 0.5 }}>
            <h3>Clinical Assessment Report</h3>
            {report.clinicalDetails && (
              <>
                <div className="detail-section">
                  <h4>Primary Concerns</h4>
                  <p className="concern-text">{report.clinicalDetails.primaryConcerns}</p>
                </div>
                <div className="detail-section">
                  <h4>Identified Themes</h4>
                  <div className="theme-tags">
                    {report.clinicalDetails.keyThemes.map((theme, idx) => (
                      <span key={idx} className="theme-tag">{theme}</span>
                    ))}
                  </div>
                </div>
                <div className="detail-section">
                  <h4>Risk Assessment</h4>
                  <ul className="risk-list">{report.clinicalDetails.riskFactors.map((r, i) => <li key={i}>{r}</li>)}</ul>
                </div>
                <div className="detail-section">
                  <h4>Clinical Recommendations</h4>
                  <ul className="recommendation-list">{report.clinicalDetails.recommendations.map((r, i) => <li key={i}>{r}</li>)}</ul>
                </div>
              </>
            )}
            <div className="report-stats">
              <div className="stat-item"><span className="stat-label">PHQ-9 Score</span><span className="stat-value">{report.severityScore}/27</span></div>
              <div className="stat-item"><span className="stat-label">Severity</span><span className="stat-value">{report.severity}</span></div>
              <div className="stat-item"><span className="stat-label">Status</span><span className="stat-value">{report.primaryState}</span></div>
            </div>
          </motion.div>
        )}

        <div className="success-actions">
          <motion.button className="btn-secondary-large" onClick={onContinue} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            {isHighRisk ? 'Talk to Aura (Safety Mode)' : 'Continue to Chat'}
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
