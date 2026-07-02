import React, { useState } from 'react';
import { 
  Play, Square, Sliders, Zap, RefreshCw, Volume2, Waves, 
  Sparkles, BrainCircuit, Check, Save, HelpCircle 
} from 'lucide-react';
import { saveSound } from '../utils/libraryStorage';

interface AudioEngineControlsProps {
  isPlaying: boolean;
  bpm: number;
  cutoff: number;
  resonance: number;
  distortion: number;
  sidechainEnabled: boolean;
  masterVolume: number;
  engineStarted: boolean;
  activeTrackName?: string;
  
  // Expanded parameters
  waveform: 'sawtooth' | 'square';
  decay: number;
  envMod: number;
  portamento: number;
  delayFeedback: number;
  delayMix: number;

  onStartEngine: () => void;
  onTogglePlay: () => void;
  onBpmChange: (bpm: number) => void;
  onCutoffChange: (cutoff: number) => void;
  onResonanceChange: (q: number) => void;
  onDistortionChange: (amount: number) => void;
  onSidechainToggle: (enabled: boolean) => void;
  onVolumeChange: (vol: number) => void;
  onResetPattern: () => void;

  // Setters for expanded parameters
  onWaveformChange: (type: 'sawtooth' | 'square') => void;
  onDecayChange: (val: number) => void;
  onEnvModChange: (val: number) => void;
  onPortamentoChange: (val: number) => void;
  onDelayFeedbackChange: (val: number) => void;
  onDelayMixChange: (val: number) => void;
  onApplyAIResults: (params: {
    cutoff: number;
    resonance: number;
    distortion: number;
    sidechainEnabled: boolean;
    waveform: 'sawtooth' | 'square';
    decay: number;
    envMod: number;
    portamento: number;
    delayFeedback: number;
    delayMix: number;
  }) => void;
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
  activeTrackName,
  
  waveform,
  decay,
  envMod,
  portamento,
  delayFeedback,
  delayMix,

  onStartEngine,
  onTogglePlay,
  onBpmChange,
  onCutoffChange,
  onResonanceChange,
  onDistortionChange,
  onSidechainToggle,
  onVolumeChange,
  onResetPattern,

  onWaveformChange,
  onDecayChange,
  onEnvModChange,
  onPortamentoChange,
  onDelayFeedbackChange,
  onDelayMixChange,
  onApplyAIResults
}: AudioEngineControlsProps) {
  
  // AI Forge states
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activePresetName, setActivePresetName] = useState<string>('Custom Squelch');
  const [aiExplanation, setAiExplanation] = useState<string | null>(
    'Default subtractive synthesis with classic analog lowpass filtering.'
  );

  const [generatedPreset, setGeneratedPreset] = useState<{
    name: string;
    cutoff: number;
    resonance: number;
    distortion: number;
    sidechainEnabled: boolean;
    waveform: 'sawtooth' | 'square';
    decay: number;
    envMod: number;
    portamento: number;
    delayFeedback: number;
    delayMix: number;
    explanation: string;
  } | null>(null);

  const [savedSuccess, setSavedSuccess] = useState(false);

  // Suggested prompt tags for users
  const SUGGESTIONS = [
    "Warm bubbling acid square sub",
    "Screaming high-resonance 303",
    "Industrial metallic warehouse drone",
    "Spacious celestial echoing sweep",
    "Tight punchy clicky sub-bass"
  ];

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setLoading(true);
    setError(null);
    setGeneratedPreset(null);
    setSavedSuccess(false);

    try {
      const response = await fetch('/api/generate-sound', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });

      if (!response.ok) {
        throw new Error(`Server returned error status: ${response.status}`);
      }

      const data = await response.json();
      setGeneratedPreset(data);
    } catch (err: any) {
      console.error('AI sound generation request failed:', err);
      setError(err.message || 'Connection failed during AI Sound design.');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyAI = () => {
    if (!generatedPreset) return;
    onApplyAIResults({
      cutoff: generatedPreset.cutoff,
      resonance: generatedPreset.resonance,
      distortion: generatedPreset.distortion,
      sidechainEnabled: generatedPreset.sidechainEnabled,
      waveform: generatedPreset.waveform,
      decay: generatedPreset.decay,
      envMod: generatedPreset.envMod,
      portamento: generatedPreset.portamento,
      delayFeedback: generatedPreset.delayFeedback,
      delayMix: generatedPreset.delayMix,
    });
    setActivePresetName(generatedPreset.name);
    setAiExplanation(generatedPreset.explanation);
    setGeneratedPreset(null); // Clear the review modal once applied
  };

  const handleSaveToLibrary = () => {
    if (!generatedPreset) return;
    saveSound(
      generatedPreset.name,
      generatedPreset.cutoff,
      generatedPreset.resonance,
      generatedPreset.distortion,
      generatedPreset.sidechainEnabled
    );
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
    }, 2500);
  };

  return (
    <div id="unified-sound-center-card" className="bg-[#161622] border-2 border-neutral-800 p-5 rounded-none flex flex-col gap-5 font-mono text-neutral-200">
      
      {/* HEADER BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-900 pb-3">
        <div className="flex items-center gap-2">
          <BrainCircuit className="w-5 h-5 text-[#00FFCC]" />
          <div>
            <h3 className="text-sm font-bold tracking-widest text-white uppercase">
              TechnoForge Synth & Sound Center
            </h3>
            <p className="text-[9px] text-[#00FFCC] font-mono mt-0.5 tracking-wide flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span>TRACK: <span className="text-white font-bold">{activeTrackName || 'AcidSynth'}</span></span>
              <span className="text-neutral-700">|</span>
              <span>PATCH: <span className="text-white font-bold">{activePresetName}</span></span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!engineStarted && (
            <span className="text-[9px] bg-amber-950/40 border border-amber-800/80 px-2.5 py-1 text-amber-400 rounded-none animate-pulse">
              OFFLINE (PLAY TO RUN GRAPH)
            </span>
          )}
          <span className="text-[10px] bg-neutral-900 border border-neutral-800 px-2 py-1 text-neutral-500 rounded-none shrink-0">
            10-Param Subtractive + FX
          </span>
        </div>
      </div>

      {/* SECTION 1: AI COGNITIVE SOUND FORGE */}
      <div className="bg-[#0F0F15] border border-neutral-900 p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h4 className="text-[10px] font-bold tracking-wider text-[#00FFCC] uppercase flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            AI Cognitive Sound Forge
          </h4>
          <span className="text-[8px] text-neutral-600 tracking-wider">GEMINI-3.5 DESIGN INTEGRATION</span>
        </div>

        <form onSubmit={handleGenerate} className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              required
              disabled={loading}
              placeholder="Describe sound: e.g., screechy metallic square wave with heavy reverb and glides..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="flex-1 bg-neutral-950 border border-neutral-800 text-xs px-3 py-2.5 focus:border-[#00FFCC] focus:outline-none text-white placeholder-neutral-600 rounded-none"
            />
            <button
              type="submit"
              disabled={loading || !prompt.trim()}
              className="bg-neutral-900 border border-neutral-800 hover:border-[#00FFCC] hover:bg-[#00FFCC]/10 text-xs font-mono uppercase px-4 py-2 text-neutral-400 hover:text-white transition-all shrink-0 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#00FFCC]" />
              {loading ? "Forging..." : "Forge Patch"}
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-[9px] text-neutral-600 uppercase tracking-wider mr-1">Vibe Tags:</span>
            {SUGGESTIONS.map((sug, idx) => (
              <button
                key={idx}
                type="button"
                disabled={loading}
                onClick={() => setPrompt(sug)}
                className="text-[9px] text-neutral-400 bg-neutral-950 hover:bg-neutral-900 hover:text-white border border-neutral-900 px-2 py-0.5 rounded-none cursor-pointer transition-all"
              >
                {sug}
              </button>
            ))}
          </div>
        </form>

        {error && (
          <div className="bg-red-950/20 border border-red-500/50 text-red-300 text-[11px] p-2.5 mt-1 font-mono leading-relaxed">
            <strong className="text-red-400 uppercase tracking-wide block mb-0.5">Synthesis Fault</strong>
            {error}
          </div>
        )}

        {/* AI GENERATION REVIEW SHEET */}
        {generatedPreset && (
          <div className="border border-[#00FFCC]/40 bg-neutral-950/90 p-3 mt-2 flex flex-col gap-3 animate-fadeIn">
            <div className="flex justify-between items-start border-b border-neutral-900 pb-2">
              <div>
                <span className="text-[8px] text-neutral-500 uppercase tracking-widest">FORGED CONFIGURATION READY</span>
                <h5 className="text-xs font-bold text-[#00FFCC] uppercase tracking-wide mt-0.5">
                  {generatedPreset.name}
                </h5>
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={handleApplyAI}
                  className="bg-neutral-900 border border-[#00FFCC] text-[#00FFCC] hover:bg-[#00FFCC]/10 text-[9px] font-mono font-bold uppercase px-2.5 py-1 cursor-pointer transition-colors"
                >
                  Apply Knobs
                </button>
                <button
                  onClick={handleSaveToLibrary}
                  className="bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white hover:border-neutral-700 text-[9px] font-mono uppercase px-2 py-1 cursor-pointer transition-colors"
                >
                  {savedSuccess ? "Saved!" : "Store Preset"}
                </button>
              </div>
            </div>
            <p className="text-[11px] text-neutral-400 italic bg-neutral-900/60 p-2 border-l border-[#00FFCC]">
              "{generatedPreset.explanation}"
            </p>
          </div>
        )}

        {loading && (
          <div className="border border-neutral-900 bg-neutral-950 p-4 text-center flex flex-col items-center justify-center gap-2 mt-2">
            <span className="text-[10px] text-[#00FFCC] tracking-widest uppercase font-bold animate-pulse">
              ANALYZING ACOUSTICS & COGNITIVE MAPPING...
            </span>
          </div>
        )}

        {aiExplanation && !generatedPreset && !loading && (
          <p className="text-[10px] text-neutral-500 italic bg-neutral-950 p-2 border-l border-neutral-800">
            PATCH DESIGN: {aiExplanation}
          </p>
        )}
      </div>

      {/* SECTION 2: SYNTHESIS HARDWARE DECK (10 KNOBS & MANUAL SLIDERS) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        
        {/* CORE ANALOG SOUND GENERATOR */}
        <div className="flex flex-col gap-3.5 bg-[#0F0F15] p-3.5 border border-neutral-900">
          <span className="text-[10px] font-bold tracking-wider text-[#FF00AA] uppercase flex items-center gap-1.5 border-b border-neutral-800 pb-1.5">
            <Waves className="w-3.5 h-3.5" />
            1. Oscillator & Filter
          </span>

          {/* Waveform Selection */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-neutral-400 mb-1">Oscillator Shape</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onWaveformChange('sawtooth')}
                className={`text-[10px] py-1.5 font-bold uppercase border transition-all cursor-pointer ${
                  waveform === 'sawtooth'
                    ? 'bg-[#FF00AA]/20 border-[#FF00AA] text-[#FF00AA]'
                    : 'bg-neutral-900 border-neutral-800 text-neutral-500 hover:border-neutral-700'
                }`}
              >
                SAWTOOTH
              </button>
              <button
                type="button"
                onClick={() => onWaveformChange('square')}
                className={`text-[10px] py-1.5 font-bold uppercase border transition-all cursor-pointer ${
                  waveform === 'square'
                    ? 'bg-[#FF00AA]/20 border-[#FF00AA] text-[#FF00AA]'
                    : 'bg-neutral-900 border-neutral-800 text-neutral-500 hover:border-neutral-700'
                }`}
              >
                SQUARE
              </button>
            </div>
          </div>

          {/* Filter Cutoff */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-neutral-400">Filter Cutoff</span>
              <span className="text-[#FF00AA] font-bold">{cutoff} Hz</span>
            </div>
            <input
              type="range"
              min="100"
              max="3500"
              step="50"
              value={cutoff}
              onChange={(e) => onCutoffChange(parseInt(e.target.value, 10))}
              className="w-full accent-[#FF00AA] bg-neutral-800 h-1 cursor-pointer"
            />
          </div>

          {/* Resonance Q */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-neutral-400">Filter Q (Resonance)</span>
              <span className="text-[#FF00AA] font-bold">x{resonance.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min="1"
              max="15"
              step="0.5"
              value={resonance}
              onChange={(e) => onResonanceChange(parseFloat(e.target.value))}
              className="w-full accent-[#FF00AA] bg-neutral-800 h-1 cursor-pointer"
            />
          </div>
        </div>

        {/* ENVELOPE MODULATION & SLIDE */}
        <div className="flex flex-col gap-3.5 bg-[#0F0F15] p-3.5 border border-neutral-900">
          <span className="text-[10px] font-bold tracking-wider text-[#00FFCC] uppercase flex items-center gap-1.5 border-b border-neutral-800 pb-1.5">
            <Sliders className="w-3.5 h-3.5" />
            2. Envelope & Glide
          </span>

          {/* Overdrive Distortion */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-neutral-400">Overdrive Distortion</span>
              <span className="text-[#00FFCC] font-bold">{Math.round(distortion * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={distortion}
              onChange={(e) => onDistortionChange(parseFloat(e.target.value))}
              className="w-full accent-[#00FFCC] bg-neutral-800 h-1 cursor-pointer"
            />
          </div>

          {/* Envelope Decay */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-neutral-400">Envelope Decay</span>
              <span className="text-[#00FFCC] font-bold">{decay.toFixed(2)}s</span>
            </div>
            <input
              type="range"
              min="0.05"
              max="1.2"
              step="0.05"
              value={decay}
              onChange={(e) => onDecayChange(parseFloat(e.target.value))}
              className="w-full accent-[#00FFCC] bg-neutral-800 h-1 cursor-pointer"
            />
          </div>

          {/* Filter Env Modulation Depth */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-neutral-400">Filter Sweep Mod Depth</span>
              <span className="text-[#00FFCC] font-bold">{envMod.toFixed(1)} Octaves</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="6.0"
              step="0.1"
              value={envMod}
              onChange={(e) => onEnvModChange(parseFloat(e.target.value))}
              className="w-full accent-[#00FFCC] bg-neutral-800 h-1 cursor-pointer"
            />
          </div>

          {/* Glide / Slide Portamento */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-neutral-400">Portamento Glide (Slide)</span>
              <span className="text-[#00FFCC] font-bold">{portamento === 0 ? "STACCATO" : `${Math.round(portamento * 1000)} ms`}</span>
            </div>
            <input
              type="range"
              min="0.0"
              max="0.4"
              step="0.02"
              value={portamento}
              onChange={(e) => onPortamentoChange(parseFloat(e.target.value))}
              className="w-full accent-[#00FFCC] bg-neutral-800 h-1 cursor-pointer"
            />
          </div>
        </div>

        {/* SPACIAL ECHO FX & MIX */}
        <div className="flex flex-col gap-3.5 bg-[#0F0F15] p-3.5 border border-neutral-900">
          <span className="text-[10px] font-bold tracking-wider text-pink-500 uppercase flex items-center gap-1.5 border-b border-neutral-800 pb-1.5">
            <Zap className="w-3.5 h-3.5" />
            3. Spacial Delay FX & Levels
          </span>

          {/* Delay Wet Level */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-neutral-400">Echo Delay Mix (Dry/Wet)</span>
              <span className="text-pink-500 font-bold">{Math.round(delayMix * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.0"
              max="0.75"
              step="0.05"
              value={delayMix}
              onChange={(e) => onDelayMixChange(parseFloat(e.target.value))}
              className="w-full accent-pink-500 bg-neutral-800 h-1 cursor-pointer"
            />
          </div>

          {/* Delay Feedback */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-neutral-400">Delay Feedback Echoes</span>
              <span className="text-pink-500 font-bold">{Math.round(delayFeedback * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.0"
              max="0.85"
              step="0.05"
              value={delayFeedback}
              onChange={(e) => onDelayFeedbackChange(parseFloat(e.target.value))}
              className="w-full accent-pink-500 bg-neutral-800 h-1 cursor-pointer"
            />
          </div>

          {/* Master Volume */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-neutral-400">Master Volume Out</span>
              <span className="text-pink-500 font-bold">{Math.round(masterVolume * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={masterVolume}
              onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
              className="w-full accent-pink-500 bg-neutral-800 h-1 cursor-pointer"
            />
          </div>

          {/* Sidechain & Reset Buttons */}
          <div className="grid grid-cols-2 gap-2 mt-1">
            <button
              type="button"
              onClick={() => onSidechainToggle(!sidechainEnabled)}
              className={`text-[9px] py-1.5 font-bold uppercase border transition-all cursor-pointer flex items-center justify-center gap-1 ${
                sidechainEnabled
                  ? 'bg-pink-950/20 border-pink-500 text-pink-500'
                  : 'bg-neutral-900 border-neutral-800 text-neutral-500 hover:border-neutral-700'
              }`}
            >
              <Zap className={`w-3 h-3 ${sidechainEnabled ? 'animate-pulse' : ''}`} />
              DUCKEY: {sidechainEnabled ? 'ON' : 'OFF'}
            </button>
            <button
              type="button"
              onClick={onResetPattern}
              className="text-[9px] py-1.5 font-bold uppercase bg-neutral-900 border border-neutral-800 hover:border-red-500 text-neutral-500 hover:text-red-400 transition-all flex items-center justify-center gap-1 cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              CLEAR GRID
            </button>
          </div>
        </div>

      </div>

      {/* SECTION 3: SYSTEM PLAYBACK TRANSPORT BAR */}
      <div className="border-t border-neutral-900 pt-4 flex flex-col sm:flex-row gap-4 items-center justify-between bg-neutral-950/40 p-3 mt-1">
        
        {/* Play/Stop Button */}
        <button
          id="transport-play-toggle-btn"
          onClick={onTogglePlay}
          className={`w-full sm:w-auto flex items-center justify-center gap-2 py-3 px-6 text-xs font-bold uppercase border-2 transition-all cursor-pointer ${
            isPlaying
              ? 'bg-red-950/60 border-red-600 text-red-400 hover:bg-red-900/80'
              : 'bg-[#00FFCC] border-[#00FFCC] text-[#0F0F15] hover:bg-[#00FFCC]/90 hover:shadow-[0_0_15px_rgba(0,255,204,0.25)]'
          }`}
        >
          {isPlaying ? (
            <>
              <Square className="w-4 h-4 fill-current animate-pulse" />
              Stop Sequencer Loop
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-current" />
              Power & Start Sequencer
            </>
          )}
        </button>

        {/* BPM Tempo control */}
        <div className="w-full sm:w-1/3 flex items-center gap-4 bg-neutral-900 border border-neutral-800 px-4 py-2">
          <div className="flex flex-col gap-0.5 min-w-[70px]">
            <span className="text-[8px] text-neutral-500 uppercase tracking-widest font-bold">TEMPO</span>
            <span className="text-[#00FFCC] text-xs font-bold font-mono whitespace-nowrap">{bpm} BPM</span>
          </div>
          <input
            id="bpm-input-slider"
            type="range"
            min="110"
            max="140"
            step="1"
            value={bpm}
            onChange={(e) => onBpmChange(parseInt(e.target.value, 10))}
            className="w-full accent-[#00FFCC] bg-neutral-800 h-1 cursor-pointer"
          />
        </div>

      </div>

    </div>
  );
}
