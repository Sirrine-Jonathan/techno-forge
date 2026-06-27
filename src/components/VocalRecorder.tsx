import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Play, Sparkles, RefreshCw, Volume2 } from 'lucide-react';
import { analyzeVocalAudio } from '../utils/dspAnalyzer';
import { DSPAnalysisResult } from '../types';

interface VocalRecorderProps {
  bpm: number;
  engineStarted: boolean;
  onTranscriptionComplete: (result: DSPAnalysisResult) => void;
}

export default function VocalRecorder({ bpm, engineStarted, onTranscriptionComplete }: VocalRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBuffer, setRecordedBuffer] = useState<AudioBuffer | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioSourceUrl, setAudioSourceUrl] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Set up Audio Context and Analyser
  const initAudio = async () => {
    if (!audioContextRef.current) {
      // @ts-ignore
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      audioContextRef.current = new AudioCtx();
    }
    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }
  };

  const startRecording = async () => {
    try {
      await initAudio();
      const ctx = audioContextRef.current!;

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Set up analyser for visualizer
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Set up MediaRecorder
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        const url = URL.createObjectURL(audioBlob);
        setAudioSourceUrl(url);

        // Convert Blob to AudioBuffer for DSP analysis
        try {
          const arrayBuffer = await audioBlob.arrayBuffer();
          // Use current or a new context to decode
          const decodeCtx = audioContextRef.current || new AudioContext();
          const decodedBuffer = await decodeCtx.decodeAudioData(arrayBuffer);
          setRecordedBuffer(decodedBuffer);
          drawStaticWaveform(decodedBuffer);
        } catch (err) {
          console.error('Error decoding recorded audio data:', err);
        }
      };

      // Start recording
      mediaRecorder.start();
      setIsRecording(true);
      setRecordedBuffer(null);
      setRecordingSeconds(0);
      setCountdown(30); // 30s limit

      // Start duration tracker
      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => {
          if (prev >= 29) {
            stopRecording();
            return 30;
          }
          return prev + 1;
        });
      }, 1000);

      // Start visualizer loop
      drawRealtimeOscilloscope();
    } catch (err) {
      console.error('Error starting voice record:', err);
      alert('Could not access microphone. Please ensure microphone permissions are granted.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    setIsRecording(false);
  };

  // Draw scrolling microphone audio wave while recording
  const drawRealtimeOscilloscope = () => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationFrameRef.current = requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(dataArray);

      // Theme colors: Slate #0F0F15, Mint #00FFCC
      ctx.fillStyle = '#0F0F15';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#00FFCC';
      ctx.beginPath();

      const sliceWidth = canvas.width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * canvas.height) / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();

      // Draw subtle neon gridlines
      ctx.strokeStyle = 'rgba(0, 255, 204, 0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, canvas.height / 2);
      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
    };

    draw();
  };

  // Draw the full static waveform once recording completes
  const drawStaticWaveform = (buffer: AudioBuffer) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const data = buffer.getChannelData(0);
    const step = Math.ceil(data.length / canvas.width);
    const amp = canvas.height / 2;

    ctx.fillStyle = '#161622'; // Dark charcoal background
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw static center bar
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.beginPath();
    ctx.moveTo(0, amp);
    ctx.lineTo(canvas.width, amp);
    ctx.stroke();

    // Draw neon cyan bars for the wave
    ctx.strokeStyle = '#00FFCC';
    ctx.lineWidth = 2;
    ctx.beginPath();

    for (let i = 0; i < canvas.width; i++) {
      let min = 1.0;
      let max = -1.0;
      for (let j = 0; j < step; j++) {
        const datum = data[i * step + j];
        if (datum < min) min = datum;
        if (datum > max) max = datum;
      }
      ctx.moveTo(i, amp + min * amp);
      ctx.lineTo(i, amp + max * amp);
    }
    ctx.stroke();
  };

  // Process raw floats using the offline DSP analyzer
  const handleTranscribe = () => {
    if (!recordedBuffer) return;
    setIsTranscribing(true);

    // Small delay to let UI threads breathe, avoiding locks
    setTimeout(() => {
      try {
        const result = analyzeVocalAudio(recordedBuffer, bpm);
        onTranscriptionComplete(result);
      } catch (err) {
        console.error('DSP Transcription error:', err);
      } finally {
        setIsTranscribing(false);
      }
    }, 150);
  };

  const playRecordedAudio = () => {
    if (audioSourceUrl) {
      const audio = new Audio(audioSourceUrl);
      audio.play();
    }
  };

  return (
    <div id="vocal-recorder-card" className="bg-[#161622] border-2 border-neutral-800 p-5 rounded-none flex flex-col gap-4 font-mono">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold tracking-widest text-neutral-400 uppercase flex items-center gap-2">
          <Mic className="w-4 h-4 text-[#00FFCC]" />
          Vocal Input Transcriber (DSP)
        </h3>
        <span className="text-[10px] bg-neutral-900 border border-neutral-800 px-2 py-0.5 text-neutral-500 rounded">
          Local Capture
        </span>
      </div>

      <p className="text-xs text-neutral-400 leading-relaxed">
        Beatbox/hum a 4-bar techno loop (pshh for high-hats, claps for snares, deep humming for bassline). The offline DSP engine extracts transients and pitch frequencies directly.
      </p>

      {/* WAVEFORM VIEWER STAGE */}
      <div className="relative border border-neutral-800 rounded bg-[#0F0F15] overflow-hidden">
        <canvas
          id="visualizer-canvas"
          ref={canvasRef}
          width={640}
          height={110}
          className="w-full h-[110px] block"
        />

        {isRecording && (
          <div className="absolute top-2 right-2 flex items-center gap-2 bg-red-950/80 border border-red-500 px-2 py-1 rounded text-[10px] text-red-400 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            REC {recordingSeconds}s / 30s
          </div>
        )}

        {!isRecording && !recordedBuffer && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-neutral-600 bg-[#0F0F15]/95">
            <Mic className="w-8 h-8 text-neutral-700" />
            <span className="text-[11px] font-bold tracking-wider uppercase text-neutral-500">Waveform Analyzer Idle</span>
            <span className="text-[10px] text-neutral-600">Connect microphone and record vocal loop</span>
          </div>
        )}
      </div>

      {/* CONTROLS AREA */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
        {/* Play/Record Buttons */}
        <div className="flex items-center gap-2">
          {!isRecording ? (
            <button
              id="record-mic-btn"
              onClick={startRecording}
              className="flex-1 flex items-center justify-center gap-2 bg-neutral-900 border border-neutral-700 hover:border-red-500 text-neutral-300 hover:text-red-400 text-xs py-2 px-3 font-bold transition-all uppercase active:scale-98"
            >
              <Mic className="w-3.5 h-3.5 text-red-500 animate-pulse" />
              Record Voice
            </button>
          ) : (
            <button
              id="stop-mic-btn"
              onClick={stopRecording}
              className="flex-1 flex items-center justify-center gap-2 bg-red-950 border border-red-600 hover:bg-red-900 text-red-200 text-xs py-2 px-3 font-bold transition-all uppercase active:scale-98"
            >
              <Square className="w-3.5 h-3.5 fill-red-200" />
              Stop Recording
            </button>
          )}

          {recordedBuffer && (
            <button
              id="play-vocal-preview-btn"
              onClick={playRecordedAudio}
              className="bg-neutral-900 border border-neutral-800 hover:border-[#00FFCC] text-neutral-400 hover:text-[#00FFCC] p-2.5 transition-all text-xs flex items-center justify-center"
              title="Play vocal recording preview"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
            </button>
          )}
        </div>

        {/* Transcribe Button */}
        <button
          id="vocal-dsp-transcribe-btn"
          disabled={!recordedBuffer || isTranscribing}
          onClick={handleTranscribe}
          className={`flex items-center justify-center gap-2 py-2 px-4 text-xs font-bold uppercase border-2 transition-all active:scale-98 ${
            recordedBuffer && !isTranscribing
              ? 'bg-[#00FFCC] border-[#00FFCC] text-[#0F0F15] hover:bg-[#00FFCC]/90 hover:shadow-[0_0_15px_rgba(0,255,204,0.35)] cursor-pointer'
              : 'bg-neutral-900 border-neutral-800 text-neutral-600 cursor-not-allowed'
          }`}
        >
          {isTranscribing ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              Transcribing DSP...
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5 fill-current" />
              Transcribe Vocal (DSP)
            </>
          )}
        </button>
      </div>

      {recordedBuffer && (
        <div className="flex justify-between items-center bg-neutral-950 border border-neutral-900 px-3 py-2 text-[10px] text-neutral-500 rounded">
          <span className="flex items-center gap-1.5 text-neutral-400">
            <Volume2 className="w-3 h-3 text-[#00FFCC]" />
            Length: {recordedBuffer.duration.toFixed(2)}s @ {recordedBuffer.sampleRate}Hz
          </span>
          <span className="text-[#00FFCC] uppercase font-bold animate-pulse">
            Signal Captured • Ready to Transcribe
          </span>
        </div>
      )}
    </div>
  );
}
