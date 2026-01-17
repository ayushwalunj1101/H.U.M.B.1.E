import React, { useRef, useEffect, useMemo } from 'react';

/**
 * SiriOrb - A liquid blob visualization component using HTML5 Canvas
 * 
 * Props:
 * - audioData: Uint8Array of frequency data from audio analyzer
 * - mode: 'idle' | 'listening' | 'processing' | 'speaking'
 * - size: number (diameter in pixels, default 300)
 */
const SiriOrb = ({ 
  audioData = new Uint8Array(0), 
  mode = 'idle',
  size = 300 
}) => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const timeRef = useRef(0);
  const targetColorRef = useRef({ r: 99, g: 102, b: 241 }); // Default indigo
  const currentColorRef = useRef({ r: 99, g: 102, b: 241 });

  // Color schemes for different modes
  const colorSchemes = useMemo(() => ({
    idle: { 
      inner: { r: 147, g: 197, b: 253 },  // Light blue
      outer: { r: 99, g: 102, b: 241 },   // Indigo
      glow: 'rgba(99, 102, 241, 0.4)'
    },
    listening: { 
      inner: { r: 34, g: 211, b: 238 },   // Cyan
      outer: { r: 59, g: 130, b: 246 },   // Blue
      glow: 'rgba(34, 211, 238, 0.5)'
    },
    processing: { 
      inner: { r: 251, g: 191, b: 36 },   // Amber
      outer: { r: 249, g: 115, b: 22 },   // Orange
      glow: 'rgba(251, 191, 36, 0.5)'
    },
    speaking: { 
      inner: { r: 52, g: 211, b: 153 },   // Emerald
      outer: { r: 16, g: 185, b: 129 },   // Green
      glow: 'rgba(52, 211, 153, 0.5)'
    }
  }), []);

  // Simplex noise implementation for organic movement
  const noise = useMemo(() => {
    return (x, y) => {
      // Simplified 2D noise using sine waves (faster than true Perlin)
      return (
        Math.sin(x * 1.2 + y * 0.8) * 0.3 +
        Math.sin(x * 2.4 - y * 1.6) * 0.2 +
        Math.sin(x * 0.6 + y * 2.2) * 0.25 +
        Math.cos(x * 1.8 + y * 1.4) * 0.25
      );
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    
    // Set up high-DPI canvas
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const centerX = size / 2;
    const centerY = size / 2;
    const baseRadius = size * 0.32;

    // Calculate audio intensity
    const getAudioIntensity = () => {
      if (!audioData || audioData.length === 0) return 0;
      const sum = audioData.reduce((acc, val) => acc + val, 0);
      return Math.min(sum / (audioData.length * 128), 1); // Normalize to 0-1
    };

    // Interpolate colors smoothly
    const lerpColor = (current, target, factor) => ({
      r: current.r + (target.r - current.r) * factor,
      g: current.g + (target.g - current.g) * factor,
      b: current.b + (target.b - current.b) * factor
    });

    const draw = () => {
      timeRef.current += 0.015;
      const time = timeRef.current;

      // Clear canvas
      ctx.clearRect(0, 0, size, size);

      // Get current color scheme and interpolate
      const scheme = colorSchemes[mode] || colorSchemes.idle;
      targetColorRef.current = scheme.outer;
      currentColorRef.current = lerpColor(currentColorRef.current, targetColorRef.current, 0.05);

      const audioIntensity = getAudioIntensity();
      
      // Speed multiplier based on mode
      const speedMultiplier = mode === 'processing' ? 2.5 : mode === 'speaking' ? 1.5 : 1;
      
      // Breathing effect when idle/silent
      const breathe = Math.sin(time * 0.8) * 0.03 + 1;
      
      // Audio reactivity
      const audioReactivity = 1 + audioIntensity * 0.5;

      // Draw glow layers
      for (let g = 3; g >= 0; g--) {
        const glowRadius = baseRadius * (1.3 + g * 0.15) * breathe * audioReactivity;
        const gradient = ctx.createRadialGradient(
          centerX, centerY, 0,
          centerX, centerY, glowRadius
        );
        
        const alpha = (0.15 - g * 0.03) * (1 + audioIntensity * 0.5);
        const { r, g: green, b } = currentColorRef.current;
        
        gradient.addColorStop(0, `rgba(${r}, ${green}, ${b}, ${alpha})`);
        gradient.addColorStop(0.5, `rgba(${r}, ${green}, ${b}, ${alpha * 0.5})`);
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        
        ctx.beginPath();
        ctx.arc(centerX, centerY, glowRadius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
      }

      // Draw the main blob
      ctx.beginPath();
      
      const points = 180;
      const noiseScale = 2.5;
      const distortionAmount = 15 + audioIntensity * 40;

      for (let i = 0; i <= points; i++) {
        const angle = (i / points) * Math.PI * 2;
        
        // Multi-layered noise for organic movement
        const noiseVal = noise(
          Math.cos(angle) * noiseScale + time * speedMultiplier,
          Math.sin(angle) * noiseScale + time * speedMultiplier * 0.7
        );
        
        // Additional audio-reactive spikes
        let audioSpike = 0;
        if (audioData.length > 0) {
          const dataIndex = Math.floor((i / points) * audioData.length);
          audioSpike = (audioData[dataIndex] / 255) * 25;
        }
        
        const radius = baseRadius * breathe * audioReactivity + 
                       noiseVal * distortionAmount + 
                       audioSpike;
        
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;
        
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      
      ctx.closePath();

      // Create main gradient
      const innerColor = scheme.inner;
      const outerColor = currentColorRef.current;
      
      const mainGradient = ctx.createRadialGradient(
        centerX - baseRadius * 0.3, 
        centerY - baseRadius * 0.3, 
        0,
        centerX, 
        centerY, 
        baseRadius * 1.5
      );
      
      mainGradient.addColorStop(0, `rgba(255, 255, 255, 0.95)`);
      mainGradient.addColorStop(0.2, `rgba(${innerColor.r}, ${innerColor.g}, ${innerColor.b}, 0.9)`);
      mainGradient.addColorStop(0.6, `rgba(${outerColor.r}, ${outerColor.g}, ${outerColor.b}, 0.85)`);
      mainGradient.addColorStop(1, `rgba(${outerColor.r * 0.5}, ${outerColor.g * 0.5}, ${outerColor.b * 0.5}, 0.8)`);

      ctx.fillStyle = mainGradient;
      ctx.fill();

      // Inner highlight for 3D effect
      ctx.beginPath();
      ctx.arc(
        centerX - baseRadius * 0.25, 
        centerY - baseRadius * 0.25, 
        baseRadius * 0.35 * breathe,
        0, 
        Math.PI * 2
      );
      
      const highlightGradient = ctx.createRadialGradient(
        centerX - baseRadius * 0.25,
        centerY - baseRadius * 0.25,
        0,
        centerX - baseRadius * 0.25,
        centerY - baseRadius * 0.25,
        baseRadius * 0.35
      );
      
      highlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
      highlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      
      ctx.fillStyle = highlightGradient;
      ctx.fill();

      // Particle ring effect for processing mode
      if (mode === 'processing') {
        const particleCount = 12;
        for (let i = 0; i < particleCount; i++) {
          const particleAngle = (i / particleCount) * Math.PI * 2 + time * 2;
          const particleRadius = baseRadius * 1.4 + Math.sin(time * 3 + i) * 10;
          const px = centerX + Math.cos(particleAngle) * particleRadius;
          const py = centerY + Math.sin(particleAngle) * particleRadius;
          
          ctx.beginPath();
          ctx.arc(px, py, 3 + Math.sin(time * 4 + i) * 2, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(251, 191, 36, ${0.6 + Math.sin(time * 2 + i) * 0.3})`;
          ctx.fill();
        }
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [audioData, mode, size, colorSchemes, noise]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: size,
        height: size,
        display: 'block'
      }}
    />
  );
};

export default SiriOrb;
