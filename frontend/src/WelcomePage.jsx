import React from 'react';
import { motion } from 'framer-motion';

const WelcomePage = ({ onGetStarted, onSignIn }) => {
  return (
    <div className="welcome-page">
      <div className="welcome-content">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="welcome-title">P.O.V</h1>
          <p className="welcome-subtitle">Your Mental Health Companion</p>
        </motion.div>

        <motion.div
          className="welcome-actions"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <button className="btn-primary-large" onClick={onGetStarted}>
            Get Started
          </button>
          <button className="btn-secondary-large" onClick={onSignIn}>
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
};

export default WelcomePage;
