import React, { useEffect, useRef, useState } from 'react';
import { Waves, Zap, Activity, Radio, Sparkles } from 'lucide-react';

interface AudioVisualizerProps {
  analyser: AnalyserNode | null;
  engineStarted: boolean;
  isPlaying: boolean;
}

type VisualizerMode = 'spectrum' | 'waveform' | 'circular';

export default function AudioVisualizer({ analyser, engineStarted, isPlaying }: AudioVisualizerProps) {
  const [mode, setMode] = useState<VisualizerMode>('circular');
  const [sensitivity, setSensitivity] = useState<number>(1.2);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);

  // Resize canvas to fit its container dynamically
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (rect) {
        canvas.width = rect.width * (window.devicePixelRatio || 1);
        canvas.height = 140 * (window.devicePixelRatio || 1);
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // Initial call

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [engineStarted]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !analyser || !engineStarted) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const fftSize = analyser.fftSize;
    const frequencyBinCount = analyser.frequencyBinCount;
    
    // Allocate data buffers for both domains to allow seamless mixing
    const freqData = new Uint8Array(frequencyBinCount);
    const timeData = new Uint8Array(fftSize);

    // Track smoothing values for low-frequency peak triggers (bass bumps)
    let smoothedBass = 0;

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);

      const dpr = window.devicePixelRatio || 1;
      const width = canvas.width;
      const height = canvas.height;

      // Fetch fresh data
      analyser.getByteFrequencyData(freqData);
      analyser.getByteTimeDomainData(timeData);

      // Extract low bass frequency energy for a beat-responsive flash/shake effect
      let bassSum = 0;
      const bassBinsCount = 8; // analyze first 8 bins of FFT (sub bass)
      for (let i = 0; i < bassBinsCount; i++) {
        bassSum += freqData[i];
      }
      const bassNormalized = (bassSum / bassBinsCount) / 255;
      smoothedBass = smoothedBass * 0.85 + bassNormalized * 0.15;

      // Draw dark techno space background
      ctx.fillStyle = '#0F0F15';
      ctx.fillRect(0, 0, width, height);

      // Draw ambient grid backing
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
      ctx.lineWidth = 1;
      const gridStep = 40 * dpr;
      for (let x = 0; x < width; x += gridStep) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridStep) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Add a neon cyber-grid horizon line in the middle
      ctx.strokeStyle = 'rgba(0, 255, 204, 0.05)';
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();

      if (mode === 'spectrum') {
        // --- 1. NEON BAR FREQUENCY SPECTRUM ---
        const barWidth = (width / frequencyBinCount) * 1.5;
        let barHeight;
        let x = 0;

        for (let i = 0; i < frequencyBinCount; i++) {
          const value = freqData[i] * sensitivity;
          barHeight = (value / 255) * height * 0.85;

          // Color gradient: bass frequencies (neon mint) transitioning to highs (cyberpunk magenta)
          const ratio = i / frequencyBinCount;
          const r = Math.round(0 + ratio * 255);
          const g = Math.round(255 - ratio * 255);
          const b = Math.round(204 + ratio * 50);
          
          ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
          
          // Draw reflecting bar from center for nice symmetrically stacked look
          ctx.fillRect(x, (height - barHeight) / 2, barWidth - (2 * dpr), barHeight);
          
          // Draw tiny floating crest particles
          if (barHeight > 5 * dpr) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
            ctx.fillRect(x, (height - barHeight) / 2 - (2 * dpr), barWidth - (2 * dpr), 1.5 * dpr);
            ctx.fillRect(x, (height + barHeight) / 2, barWidth - (2 * dpr), 1.5 * dpr);
          }

          x += barWidth;
          if (x > width) break;
        }

      } else if (mode === 'waveform') {
        // --- 2. ANALOG OSCILLOSCOPE WAVEFORM ---
        ctx.lineWidth = 2.5 * dpr;
        
        // Dynamic color transition based on bass activity
        const neonColor = smoothedBass > 0.4 ? '#FF00AA' : '#00FFCC';
        ctx.strokeStyle = neonColor;
        ctx.shadowColor = neonColor;
        ctx.shadowBlur = isPlaying ? 10 * dpr * smoothedBass : 0;

        ctx.beginPath();
        const sliceWidth = width / fftSize;
        let x = 0;

        for (let i = 0; i < fftSize; i++) {
          const v = timeData[i] / 128.0; // Normalized -1.0 to 1.0
          // Apply sensitivity offset around center
          const offset = (v - 1.0) * sensitivity;
          const y = ((1.0 + offset) * height) / 2;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }

          x += sliceWidth;
        }

        ctx.lineTo(width, height / 2);
        ctx.stroke();
        ctx.shadowBlur = 0; // reset shadow for performance

      } else if (mode === 'circular') {
        // --- 3. ORBITAL LISSAJOUS RADIAL RING ---
        const centerX = width / 2;
        const centerY = height / 2;
        // Base radius fluctuates with the track's bass output
        const baseRadius = Math.min(width, height) * 0.28 + (smoothedBass * 18 * dpr);

        ctx.lineWidth = 3 * dpr;
        
        // Outer glowing ring
        ctx.strokeStyle = '#FF00AA';
        ctx.shadowColor = '#FF00AA';
        ctx.shadowBlur = 12 * dpr * smoothedBass;
        
        ctx.beginPath();
        
        const numPoints = 120;
        for (let i = 0; i <= numPoints; i++) {
          const angle = (i / numPoints) * Math.PI * 2;
          
          // Sample index in FFT or Waveform to match angle
          const dataIndex = Math.floor((i / numPoints) * frequencyBinCount);
          const rawVal = freqData[dataIndex] || 0;
          const radialOffset = (rawVal / 255) * 35 * sensitivity * dpr;

          const r = baseRadius + radialOffset;
          const x = centerX + Math.cos(angle) * r;
          const y = centerY + Math.sin(angle) * r;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.closePath();
        ctx.stroke();

        // Inner glowing syncopation ring
        ctx.strokeStyle = '#00FFCC';
        ctx.shadowColor = '#00FFCC';
        ctx.shadowBlur = 8 * dpr * smoothedBass;
        ctx.lineWidth = 1.5 * dpr;
        
        ctx.beginPath();
        for (let i = 0; i <= numPoints; i++) {
          const angle = (i / numPoints) * Math.PI * 2;
          const waveIndex = Math.floor((i / numPoints) * fftSize);
          const rawVal = (timeData[waveIndex] / 128.0) - 1.0;
          const radialOffset = rawVal * 18 * sensitivity * dpr;

          const r = (baseRadius * 0.7) + radialOffset;
          const x = centerX + Math.cos(angle) * r;
          const y = centerY + Math.sin(angle) * r;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.closePath();
        ctx.stroke();
        
        ctx.shadowBlur = 0; // reset
      }
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [analyser, mode, sensitivity, engineStarted, isPlaying]);

  return (
    <div id="audio-visualizer-card" className="bg-[#161622] border-2 border-neutral-800 p-4 rounded-none flex flex-col gap-3 font-mono">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Visualizer Title */}
        <h3 className="text-sm font-bold tracking-widest text-neutral-400 uppercase flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#00FFCC] animate-pulse" />
          Master CRT Oscilloscope
        </h3>

        {/* Dynamic Mode Pickers */}
        <div className="flex items-center gap-1.5 bg-[#0F0F15] p-1 border border-neutral-800 self-start sm:self-auto">
          <button
            id="viz-mode-circular-btn"
            onClick={() => setMode('circular')}
            className={`text-[9px] px-2 py-1 font-bold uppercase transition-all cursor-pointer ${
              mode === 'circular'
                ? 'bg-[#FF00AA] text-[#0F0F15]'
                : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            Radial Orbit
          </button>
          <button
            id="viz-mode-spectrum-btn"
            onClick={() => setMode('spectrum')}
            className={`text-[9px] px-2 py-1 font-bold uppercase transition-all cursor-pointer ${
              mode === 'spectrum'
                ? 'bg-[#00FFCC] text-[#0F0F15]'
                : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            FFT Spectrogram
          </button>
          <button
            id="viz-mode-waveform-btn"
            onClick={() => setMode('waveform')}
            className={`text-[9px] px-2 py-1 font-bold uppercase transition-all cursor-pointer ${
              mode === 'waveform'
                ? 'bg-[#00FFCC] text-[#0F0F15]'
                : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            Analog Wave
          </button>
        </div>
      </div>

      {/* CANVAS ELEMENT STAGE */}
      <div className="relative border border-neutral-900 rounded bg-[#0F0F15] overflow-hidden min-h-[140px] flex items-center justify-center">
        <canvas
          id="master-visualizer-canvas"
          ref={canvasRef}
          className="w-full h-[140px] block"
        />

        {/* Not-Started Context Guidance Overlay */}
        {!engineStarted && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-neutral-600 bg-[#0F0F15]/95 z-10 px-4 text-center">
            <Radio className="w-8 h-8 text-neutral-700 animate-pulse" />
            <span className="text-[11px] font-bold tracking-wider uppercase text-neutral-500">
              CRT Signal Feed Offline
            </span>
            <span className="text-[10px] text-neutral-600 max-w-xs leading-normal">
              Activate the Analog Audio Engine below to route and visualize master signal levels.
            </span>
          </div>
        )}

        {/* Signal Active Indicator */}
        {engineStarted && (
          <div className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-[#0F0F15]/80 border border-neutral-800/80 px-2 py-0.5 rounded text-[8px] text-neutral-500 tracking-wider">
            <span className={`w-1.5 h-1.5 rounded-full ${isPlaying ? 'bg-[#00FFCC] animate-ping' : 'bg-neutral-700'}`} />
            FEED: {isPlaying ? 'ACTIVE MASTER SIGNAL' : 'MONITOR SILENT'}
          </div>
        )}
      </div>

      {/* SENSITIVITY CALIBRATION */}
      <div className="flex items-center justify-between gap-4 bg-[#0F0F15] p-2 border border-neutral-900 text-[10px]">
        <span className="text-neutral-500 uppercase font-bold flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-[#FF00AA]" />
          Visual Gain Multiplier:
        </span>
        <div className="flex items-center gap-2 flex-1 max-w-[200px]">
          <input
            id="visual-gain-slider"
            type="range"
            min="0.5"
            max="2.5"
            step="0.1"
            value={sensitivity}
            onChange={(e) => setSensitivity(parseFloat(e.target.value))}
            className="w-full accent-[#00FFCC] bg-neutral-800 h-1 rounded cursor-pointer"
          />
          <span className="text-neutral-400 font-bold shrink-0 w-8 text-right">x{sensitivity.toFixed(1)}</span>
        </div>
      </div>
    </div>
  );
}
