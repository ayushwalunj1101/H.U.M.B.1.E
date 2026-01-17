import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Iridescence from './Iridescence';

/**
 * JarvisOrb - Voice-reactive iridescent orb component
 * 
 * Props:
 * - levelRef: ref containing audio level (0-1)
 * - mode: 'idle' | 'listening' | 'processing' | 'speaking'
 * - size: diameter in pixels
 */
const JarvisOrb = ({ 
  levelRef, 
  mode = 'idle',
  size = 280 
}) => {
  const [level, setLevel] = useState(0);

  // Smooth animation loop to read levelRef
  useEffect(() => {
    let raf = 0;
    const update = () => {
      const target = levelRef?.current || 0;
      setLevel(prev => prev + (target - prev) * 0.25);
      raf = requestAnimationFrame(update);
    };
    update();
    return () => cancelAnimationFrame(raf);
  }, [levelRef]);

  // Color schemes for different modes
  const colorSchemes = {
    idle: [0.3, 0.5, 1],        // Blue
    listening: [0.2, 0.7, 1],    // Cyan-blue
    processing: [1, 0.5, 0.2],   // Orange-gold
    speaking: [0.2, 0.8, 0.5],   // Green-cyan
  };

  // Dynamic values based on audio level and mode
  const baseAmplitude = mode === 'processing' ? 0.3 : 0.18;
  const baseSpeed = mode === 'processing' ? 1.2 : 0.75;
  
  const amplitude = baseAmplitude + level * 1.7;
  const speed = baseSpeed + level * 0.5;
  const scale = 1 + level * 0.35;
  const glowOpacity = 0.25 + level * 2.45;
  
  // Glow colors based on mode
  const glowColors = {
    idle: 'rgba(58, 108, 255, 0.45)',
    listening: 'rgba(34, 211, 238, 0.5)',
    processing: 'rgba(251, 191, 36, 0.55)',
    speaking: 'rgba(52, 211, 153, 0.5)',
  };

  return (
    <div 
      className="jarvis-orb-wrapper"
      style={{ 
        position: 'relative',
        width: size,
        height: size,
        filter: 'drop-shadow(0 50px 100px rgba(0, 0, 0, 0.7))',
      }}
    >
      {/* Deep shadow base */}
      <div 
        style={{
          position: 'absolute',
          inset: -40,
          borderRadius: '50%',
          background: 'radial-gradient(circle at 30% 30%, rgba(99, 102, 241, 0.15) 0%, transparent 50%)',
          filter: 'blur(60px)',
          zIndex: -1,
        }}
      />

      {/* Outer glow blur */}
      <motion.div 
        className="jarvis-glow-blur"
        animate={{ 
          opacity: glowOpacity,
          scale: mode === 'processing' ? [1, 1.1, 1] : 1
        }}
        transition={{ 
          opacity: { duration: 0.12 },
          scale: { duration: 1, repeat: mode === 'processing' ? Infinity : 0 }
        }}
        style={{
          position: 'absolute',
          inset: -20,
          borderRadius: '50%',
          background: mode === 'processing' 
            ? 'radial-gradient(circle, rgba(251, 191, 36, 0.6) 0%, rgba(249, 115, 22, 0.3) 50%, transparent 70%)'
            : mode === 'listening'
            ? 'radial-gradient(circle, rgba(34, 211, 238, 0.5) 0%, rgba(59, 130, 246, 0.3) 50%, transparent 70%)'
            : mode === 'speaking'
            ? 'radial-gradient(circle, rgba(52, 211, 153, 0.5) 0%, rgba(16, 185, 129, 0.3) 50%, transparent 70%)'
            : 'radial-gradient(circle, rgba(99, 102, 241, 0.4) 0%, rgba(59, 130, 246, 0.2) 50%, transparent 70%)',
          filter: 'blur(40px)',
          zIndex: 0,
        }}
      />

      {/* Inner rim light for 3D effect */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: `linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0) 40%, rgba(0, 0, 0, 0.15) 100%)`,
          pointerEvents: 'none',
          zIndex: 2,
        }}
      />

      {/* Main orb container */}
      <motion.div 
        className="jarvis-orb-container"
        animate={{ scale }}
        transition={{ duration: 0.12, ease: 'easeOut' }}
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          overflow: 'hidden',
          boxShadow: `
            0 0 90px ${glowColors[mode] || glowColors.idle},
            inset -30px -30px 60px rgba(0, 0, 0, 0.3),
            inset 20px 20px 40px rgba(255, 255, 255, 0.1)
          `,
          zIndex: 1,
        }}
      >
        <Iridescence 
          amplitude={amplitude} 
          speed={speed} 
          color={colorSchemes[mode] || colorSchemes.idle}
          size={size}
        />
      </motion.div>

      {/* Processing ring particles */}
      {mode === 'processing' && (
        <div className="jarvis-particles">
          {[...Array(8)].map((_, i) => (
            <motion.div
              key={i}
              className="jarvis-particle"
              initial={{ opacity: 0, scale: 0 }}
              animate={{ 
                opacity: [0, 1, 0],
                scale: [0.5, 1, 0.5],
                rotate: 360
              }}
              transition={{
                duration: 2,
                delay: i * 0.25,
                repeat: Infinity,
                ease: 'linear'
              }}
              style={{
                position: 'absolute',
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: 'rgba(251, 191, 36, 0.8)',
                boxShadow: '0 0 10px rgba(251, 191, 36, 0.6)',
                left: '50%',
                top: '50%',
                marginLeft: -4,
                marginTop: -4,
                transformOrigin: `4px ${size / 2 + 20}px`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default JarvisOrb;
