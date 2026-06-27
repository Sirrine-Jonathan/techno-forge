import React from 'react';
import { Play, Square, Sliders, Zap, RefreshCw, Volume2, Waves } from 'lucide-react';

interface AudioEngineControlsProps {
  isPlaying: boolean;
  bpm: number;
  cutoff: number;
  resonance: number;
  distortion: number;
  sidechainEnabled: boolean;
  masterVolume: number;
  engineStarted: boolean;
  onStartEngine: () => void;
  onTogglePlay: () => void;
  onBpmChange: (bpm: number) => void;
  onCutoffChange: (cutoff: number) => void;
  onResonanceChange: (q: number) => void;
  onDistortionChange: (amount: number) => void;
  onSidechainToggle: (enabled: boolean) => void;
  onVolumeChange: (vol: number) => void;
  onResetPattern: () => void;
}

export default function AudioEngineControls({
  isPlaying,
  bpm,
  cutoff,
  resonance,
  distortion,
  sidechainEnabled,
  masterVolume,
  engineStarted,
  onStartEngine,
  onTogglePlay,
  onBpmChange,
  onCutoffChange,
  onResonanceChange,
  onDistortionChange,
  onSidechainToggle,
  onVolumeChange,
  onResetPattern
}: AudioEngineControlsProps) {
  return (
    <div id="audio-controls-card" className="bg-[#161622] border-2 border-neutral-800 p-5 rounded-none flex flex-col gap-4 font-mono">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold tracking-widest text-neutral-400 uppercase flex items-center gap-2">
          <Sliders className="w-4 h-4 text-[#00FFCC]" />
          Analog Synthesis Controls
        </h3>
        <div className="flex items-center gap-2">
          {!engineStarted && (
            <span className="text-[9px] bg-amber-950/40 border border-amber-800/80 px-2 py-0.5 text-amber-400 rounded animate-pulse">
              Engine Offline (Click Play to Power On)
            </span>
          )}
          <span className="text-[10px] bg-neutral-900 border border-neutral-800 px-2 py-0.5 text-neutral-500 rounded">
            Tone.js Graph
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        
        {/* PLAYBACK TRANSPORT COMMANDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* Play/Stop Button */}
          <button
            id="transport-play-toggle-btn"
            onClick={onTogglePlay}
            className={`flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-bold uppercase border-2 transition-all cursor-pointer ${
              isPlaying
                ? 'bg-red-950 border-red-600 text-red-400 hover:bg-red-900/80'
                : 'bg-[#00FFCC] border-[#00FFCC] text-[#0F0F15] hover:bg-[#00FFCC]/90 hover:shadow-[0_0_15px_rgba(0,255,204,0.25)]'
            }`}
          >
            {isPlaying ? (
              <>
                <Square className="w-3.5 h-3.5 fill-current" />
                Stop Sequencer
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                Start Sequencer
              </>
            )}
          </button>

          {/* Reset Button */}
          <button
            id="reset-grid-btn"
            onClick={onResetPattern}
            className="flex items-center justify-center gap-2 bg-neutral-900 border border-neutral-700 hover:border-red-500 hover:text-red-400 text-neutral-300 text-xs py-2 px-4 uppercase transition-all font-bold cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Clear Sequence
          </button>

          {/* Sidechain toggle */}
          <button
            id="sidechain-toggle-btn"
            onClick={() => onSidechainToggle(!sidechainEnabled)}
            className={`flex items-center justify-center gap-2 border text-xs py-2 px-4 uppercase transition-all font-bold cursor-pointer ${
              sidechainEnabled
                ? 'bg-pink-950/20 border-[#FF00AA] text-[#FF00AA] hover:bg-pink-950/40'
                : 'bg-neutral-900 border-neutral-800 text-neutral-500 hover:border-neutral-700'
            }`}
          >
            <Zap className={`w-3.5 h-3.5 ${sidechainEnabled ? 'fill-current animate-pulse' : ''}`} />
            4/4 Ducking: {sidechainEnabled ? 'ON' : 'OFF'}
          </button>
        </div>

        <div className="border-t border-neutral-900 my-1" />

        {/* PARAMETERS SLIDERS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* MASTER PARAMETERS */}
          <div className="flex flex-col gap-3 bg-[#0F0F15] p-3 border border-neutral-900">
            <span className="text-[10px] font-bold tracking-wider text-neutral-400 uppercase flex items-center gap-1.5 border-b border-neutral-800 pb-1">
              <Volume2 className="w-3 h-3 text-[#00FFCC]" />
              Master Configuration
            </span>

            {/* Tempo BPM Slider */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-400">Tempo (BPM)</span>
                <span className="text-[#00FFCC] font-bold">{bpm} BPM</span>
              </div>
              <input
                id="bpm-input-slider"
                type="range"
                min="110"
                max="140"
                step="1"
                value={bpm}
                onChange={(e) => onBpmChange(parseInt(e.target.value, 10))}
                className="w-full accent-[#00FFCC] bg-neutral-800 h-1 rounded-lg cursor-pointer"
              />
            </div>

            {/* Master Volume Slider */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-400">Master Level</span>
                <span className="text-neutral-300">{masterVolume === 0 ? 'MUTE' : `${Math.round(masterVolume * 100)}%`}</span>
              </div>
              <input
                id="master-volume-slider"
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={masterVolume}
                onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                className="w-full accent-[#00FFCC] bg-neutral-800 h-1 rounded-lg cursor-pointer"
              />
            </div>
          </div>

          {/* TB-303 SYNTH PARAMETERS */}
          <div className="flex flex-col gap-3 bg-[#0F0F15] p-3 border border-neutral-900">
            <span className="text-[10px] font-bold tracking-wider text-[#FF00AA] uppercase flex items-center gap-1.5 border-b border-neutral-800 pb-1">
              <Waves className="w-3.5 h-3.5 text-[#FF00AA]" />
              Acid Synthesizer (Sawtooth)
            </span>

            {/* Cutoff frequency */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-400">Filter Cutoff</span>
                <span className="text-[#FF00AA] font-bold">{cutoff} Hz</span>
              </div>
              <input
                id="synth-cutoff-slider"
                type="range"
                min="100"
                max="3500"
                step="50"
                value={cutoff}
                onChange={(e) => onCutoffChange(parseInt(e.target.value, 10))}
                className="w-full accent-[#FF00AA] bg-neutral-800 h-1 rounded-lg cursor-pointer"
              />
            </div>

            {/* Filter Q (Resonance) */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-400">Resonance (Q)</span>
                <span className="text-[#FF00AA] font-bold">x {resonance.toFixed(1)}</span>
              </div>
              <input
                id="synth-resonance-slider"
                type="range"
                min="1"
                max="15"
                step="0.5"
                value={resonance}
                onChange={(e) => onResonanceChange(parseFloat(e.target.value))}
                className="w-full accent-[#FF00AA] bg-neutral-800 h-1 rounded-lg cursor-pointer"
              />
            </div>

            {/* Distortion Amount */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-400">Overdrive Distortion</span>
                <span className="text-[#FF00AA] font-bold">{Math.round(distortion * 100)} %</span>
              </div>
              <input
                id="synth-distortion-slider"
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={distortion}
                onChange={(e) => onDistortionChange(parseFloat(e.target.value))}
                className="w-full accent-[#FF00AA] bg-neutral-800 h-1 rounded-lg cursor-pointer"
              />
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
