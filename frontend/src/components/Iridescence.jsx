import React, { useRef, useEffect } from 'react';
import { Color, Mesh, Program, Renderer, Triangle } from 'ogl';

const vertexShader = `
attribute vec2 uv;
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0, 1);
}
`;

const fragmentShader = `
precision highp float;
uniform float uTime;
uniform vec3 uColor;
uniform vec3 uResolution;
uniform vec2 uMouse;
uniform float uAmplitude;
uniform float uSpeed;
varying vec2 vUv;
void main() {
  float mr = min(uResolution.x, uResolution.y);
  vec2 uv = (vUv * 2.0 - 1.0) * uResolution.xy / mr;
  float d = -uTime * 0.5 * uSpeed;
  float a = 0.0;
  for (float i = 0.0; i < 8.0; ++i) {
    a += cos(i - d - a * uv.x);
    d += sin(uv.y * i + a);
  }
  vec3 col = vec3(cos(uv * vec2(d, a)) * 0.6 + 0.4, cos(a + d) * 0.5 + 0.5);
  col = cos(col * cos(vec3(d, a, 2.5)) * 0.5 + 0.5) * uColor;
  gl_FragColor = vec4(col, 1.0);
}
`;

const Iridescence = ({ 
  color = [0.3, 0.6, 1], 
  speed = 0.1, 
  amplitude = 0.1,
  size = 300 
}) => {
  const containerRef = useRef(null);
  const rendererRef = useRef(null);
  const programRef = useRef(null);
  const animationRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const renderer = new Renderer({ alpha: true, antialias: true });
    const { gl } = renderer;
    rendererRef.current = renderer;

    const geometry = new Triangle(gl);
    const program = new Program(gl, {
      vertex: vertexShader,
      fragment: fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new Color(...color) },
        uResolution: { value: new Color(size, size, 1) },
        uMouse: { value: new Float32Array([0.5, 0.5]) },
        uAmplitude: { value: amplitude },
        uSpeed: { value: speed },
      },
    });
    programRef.current = program;

    const mesh = new Mesh(gl, { geometry, program });
    renderer.setSize(size, size);
    
    // Style the canvas
    gl.canvas.style.width = '100%';
    gl.canvas.style.height = '100%';
    gl.canvas.style.display = 'block';

    const animate = (t) => {
      program.uniforms.uTime.value = t * 0.001;
      renderer.render({ scene: mesh });
      animationRef.current = requestAnimationFrame(animate);
    };
    
    animate(0);
    containerRef.current.appendChild(gl.canvas);

    return () => {
      cancelAnimationFrame(animationRef.current);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      if (containerRef.current && gl.canvas.parentNode === containerRef.current) {
        containerRef.current.removeChild(gl.canvas);
      }
    };
  }, [size]);

  // Update uniforms when props change
  useEffect(() => {
    if (programRef.current) {
      programRef.current.uniforms.uColor.value = new Color(...color);
      programRef.current.uniforms.uSpeed.value = speed;
      programRef.current.uniforms.uAmplitude.value = amplitude;
    }
  }, [color, speed, amplitude]);

  return (
    <div 
      ref={containerRef} 
      style={{ 
        width: '100%', 
        height: '100%',
        borderRadius: '50%',
        overflow: 'hidden'
      }} 
    />
  );
};

export default Iridescence;
