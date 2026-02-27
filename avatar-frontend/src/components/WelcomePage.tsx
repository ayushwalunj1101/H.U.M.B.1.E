'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAppContext } from '@/context/AppContext';

export default function WelcomePage() {
  const router = useRouter();
  const { isOnboarded, vibeCheckCompleted, isLoading } = useAppContext();

  // Redirect if already through onboarding flow
  React.useEffect(() => {
    if (isLoading) return;
    if (isOnboarded && vibeCheckCompleted) router.replace('/chat');
    else if (isOnboarded) router.replace('/vibe-check');
  }, [isLoading, isOnboarded, vibeCheckCompleted, router]);

  if (isLoading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: 'linear-gradient(135deg, #0a0a0f 0%, #1a1a24 100%)',
        color: '#6366f1', fontFamily: 'system-ui'
      }}>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: '2rem', marginBottom: '1rem' }}>H.U.M.B.1.E</h2>
          <p style={{ color: '#a1a1aa' }}>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="welcome-page">
      <div className="welcome-content">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="welcome-title">H.U.M.B.1.E</h1>
          <p className="welcome-subtitle">Your Mental Health Companion</p>
        </motion.div>

        <motion.div
          className="welcome-actions"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <button className="btn-primary-large" onClick={() => router.push('/onboarding')}>
            Get Started
          </button>
          <button className="btn-secondary-large" onClick={() => alert('Sign in coming soon')}>
            Sign In
          </button>
        </motion.div>

        <motion.p
          className="welcome-disclaimer"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.6 }}
        >
          Professional mental health support platform
        </motion.p>
      </div>
    </div>
  );
}
