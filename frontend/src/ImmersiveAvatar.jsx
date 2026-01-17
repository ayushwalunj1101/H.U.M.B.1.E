import React from 'react';
import { motion } from 'framer-motion';
import './App.css';

const ImmersiveAvatar = ({ gender = 'female', isSpeaking = false }) => {
  const avatarLetter = gender === 'male' ? 'M' : gender === 'female' ? 'F' : 'A';
  const avatarColor = gender === 'male' ? '#3b82f6' : '#ec4899';

  return (
    <div className="immersive-avatar-container">
      <motion.div
        className={`avatar-circle ${isSpeaking ? 'speaking' : ''}`}
        style={{
          background: `linear-gradient(135deg, ${avatarColor} 0%, ${gender === 'male' ? '#6366f1' : '#f43f5e'} 100%)`
        }}
        animate={isSpeaking ? { scale: [1, 1.05, 1] } : {}}
        transition={isSpeaking ? { duration: 0.6, repeat: Infinity } : {}}
      >
        <span className="avatar-letter">{avatarLetter}</span>
      </motion.div>
      
      {isSpeaking && (
        <motion.div
          className="speaking-ring"
          initial={{ scale: 1, opacity: 0.8 }}
          animate={{ scale: 1.4, opacity: 0 }}
          transition={{ duration: 1, repeat: Infinity }}
        />
      )}
    </div>
  );
};

export default ImmersiveAvatar;
