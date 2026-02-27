'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useAppContext } from '@/context/AppContext';

interface ReportData {
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

export default function Report() {
  const router = useRouter();
  const { userData } = useAppContext();
  const [report, setReport] = useState<ReportData | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('apli_assessment_report');
      if (saved) {
        try { setReport(JSON.parse(saved)); } catch {}
      }
    }
  }, []);

  const scoreColor = (s: number) =>
    s <= 4 ? '#10b981' : s <= 9 ? '#f59e0b' : s <= 14 ? '#f97316' : '#ef4444';

  if (!report) {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem' }}>
        <p style={{ opacity: 0.6 }}>No assessment report found.</p>
        <button onClick={() => router.push('/assessment')}
          style={{ padding: '0.75rem 1.5rem', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', cursor: 'pointer' }}>
          Take Assessment
        </button>
      </div>
    );
  }

  return (
    <div className="report-screen" style={{ maxWidth: 780, margin: '0 auto', padding: '2rem' }}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Wellness Report</h1>
          <p style={{ opacity: 0.5 }}>
            {userData?.name ? `${userData.name}'s` : 'Your'} Assessment • {new Date(report.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
          {[
            { label: 'PHQ-9 Score', value: `${report.severityScore}/27` },
            { label: 'Severity', value: report.severity },
            { label: 'Status', value: report.primaryState },
          ].map(s => (
            <div key={s.label} style={{ padding: '1.25rem', borderRadius: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', textAlign: 'center' }}>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, color: scoreColor(report.severityScore) }}>{s.value}</div>
              <div style={{ opacity: 0.55, marginTop: '0.3rem', fontSize: '0.85rem' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {report.clinicalDetails && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2.5rem' }}>
            <div style={{ padding: '1.5rem', borderRadius: 14, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <h3 style={{ marginBottom: '0.75rem', color: '#a78bfa' }}>Primary Concerns</h3>
              <p style={{ opacity: 0.8, lineHeight: 1.7 }}>{report.clinicalDetails.primaryConcerns}</p>
            </div>
            <div style={{ padding: '1.5rem', borderRadius: 14, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <h3 style={{ marginBottom: '0.75rem', color: '#60a5fa' }}>Identified Themes</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {report.clinicalDetails.keyThemes.map((t, i) => (
                  <span key={i} style={{ padding: '0.3rem 0.8rem', borderRadius: 999, background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.4)', fontSize: '0.85rem' }}>{t}</span>
                ))}
              </div>
            </div>
            {report.clinicalDetails.riskFactors.length > 0 && (
              <div style={{ padding: '1.5rem', borderRadius: 14, background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.25)' }}>
                <h3 style={{ marginBottom: '0.75rem', color: '#f87171' }}>Risk Factors</h3>
                <ul style={{ paddingLeft: '1.2rem', opacity: 0.8, lineHeight: 2 }}>
                  {report.clinicalDetails.riskFactors.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </div>
            )}
            <div style={{ padding: '1.5rem', borderRadius: 14, background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <h3 style={{ marginBottom: '0.75rem', color: '#34d399' }}>Recommendations</h3>
              <ul style={{ paddingLeft: '1.2rem', opacity: 0.8, lineHeight: 2 }}>
                {report.clinicalDetails.recommendations.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
            onClick={() => router.push('/chat')}
            style={{ padding: '0.85rem 1.8rem', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
            Talk to Aura
          </motion.button>
          <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
            onClick={() => router.push('/immersive')}
            style={{ padding: '0.85rem 1.8rem', borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: '#fff', cursor: 'pointer' }}>
            Immersive Mode
          </motion.button>
          <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
            onClick={() => router.push('/assessment')}
            style={{ padding: '0.85rem 1.8rem', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '0.9rem' }}>
            Retake Assessment
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
