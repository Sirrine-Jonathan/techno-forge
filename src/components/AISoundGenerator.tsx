import React, { useState } from 'react';
import { Sparkles, BrainCircuit, RefreshCw, Check, Save, HelpCircle } from 'lucide-react';
import { SoundPreset } from '../types';
import { saveSound } from '../utils/libraryStorage';

interface AISoundGeneratorProps {
  onApplySound: (sound: { cutoff: number; resonance: number; distortion: number; sidechainEnabled: boolean }) => void;
}

export default function AISoundGenerator({ onApplySound }: AISoundGeneratorProps) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Generated sound state
  const [generatedPreset, setGeneratedPreset] = useState<{
    name: string;
    cutoff: number;
    resonance: number;
    distortion: number;
    sidechainEnabled: boolean;
    explanation: string;
  } | null>(null);

  const [savedSuccess, setSavedSuccess] = useState(false);

  // Suggestions that users can click to pre-fill
  const SUGGESTIONS = [
    "Screaming 303 acid squelch",
    "Deep sub-harmonic techno bass",
    "Gritty industrial warehouse synth",
    "Liquid bubbling modular pulse",
    "Bright hollow digital beep"
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
      setError(err.message || 'Network connection failed during AI Sound design.');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (!generatedPreset) return;
    onApplySound({
      cutoff: generatedPreset.cutoff,
      resonance: generatedPreset.resonance,
      distortion: generatedPreset.distortion,
      sidechainEnabled: generatedPreset.sidechainEnabled,
    });
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
    // Trigger callback in some other window or just show success badge
    setTimeout(() => {
      setSavedSuccess(false);
    }, 2500);
  };

  return (
    <div id="ai-sound-generator-card" className="bg-[#161622] border-2 border-neutral-800 p-5 rounded flex flex-col gap-4">
      
      {/* HEADER SECTION */}
      <div className="flex items-center justify-between border-b border-neutral-900 pb-3">
        <div className="flex items-center gap-2">
          <BrainCircuit className="w-5 h-5 text-[#00FFCC]" />
          <h3 className="font-sans font-bold text-sm text-white tracking-wide uppercase">
            AI Cognitive Sound Forge
          </h3>
        </div>
        <span className="text-[10px] font-mono text-neutral-500 bg-[#0F0F15] px-2 py-0.5 border border-neutral-900 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-[#00FFCC] animate-pulse" />
          GEMINI-3.5 SYNTHESIS
        </span>
      </div>

      <p className="text-xs text-neutral-400 leading-relaxed">
        Describe any sound or acoustic vibe in plain English. The Gemini neural engine translates your prompt into precise analog subtractive synthesis VCF cutoff, resonance (Q), distortion clipping, and 4/4 sidechain envelope parameters.
      </p>

      {/* PROMPT FORM INPUT */}
      <form onSubmit={handleGenerate} className="flex flex-col gap-3">
        <div className="flex gap-2">
          <input
            type="text"
            required
            disabled={loading}
            placeholder="e.g. Warm dark cavernous bassline with high saturation..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="flex-1 bg-neutral-950 border border-neutral-800 text-xs px-3 py-2.5 focus:border-[#00FFCC] focus:outline-none font-mono text-white placeholder-neutral-600 rounded-none disabled:opacity-55"
          />
          <button
            type="submit"
            disabled={loading || !prompt.trim()}
            className="bg-neutral-900 border border-neutral-800 hover:border-[#00FFCC] hover:bg-[#00FFCC]/10 hover:text-white px-4 text-xs font-mono uppercase transition-all duration-150 cursor-pointer flex items-center gap-2 text-neutral-400 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            {loading ? (
              <RefreshCw className="w-3.5 h-3.5 text-[#00FFCC] animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-[#00FFCC]" />
            )}
            {loading ? "Forging..." : "Forge Patch"}
          </button>
        </div>

        {/* CLICKABLE SUGGESTION CHIPS */}
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-[10px] text-neutral-500 font-mono uppercase tracking-wider mr-1">
            Prompt Ideas:
          </span>
          {SUGGESTIONS.map((sug, idx) => (
            <button
              key={idx}
              type="button"
              disabled={loading}
              onClick={() => setPrompt(sug)}
              className="text-[10px] font-mono text-neutral-400 bg-neutral-950 hover:bg-neutral-900 hover:text-white border border-neutral-900 hover:border-neutral-700 px-2.5 py-1 rounded-none cursor-pointer transition-all disabled:opacity-55"
            >
              {sug}
            </button>
          ))}
        </div>
      </form>

      {/* ERROR DISPLAY */}
      {error && (
        <div className="bg-red-950/40 border border-red-500/50 text-red-200 text-xs p-3 font-mono leading-relaxed mt-1">
          <strong className="text-red-400 uppercase tracking-wide block mb-1">AI Engine Error</strong>
          {error}
        </div>
      )}

      {/* GENERATION RESULTS BOARD */}
      {generatedPreset && (
        <div className="border border-[#00FFCC]/30 bg-[#0F0F15]/90 p-4 mt-2 flex flex-col gap-4 animate-fadeIn">
          
          {/* Patch details header */}
          <div className="flex justify-between items-start border-b border-neutral-900 pb-2.5">
            <div className="flex flex-col">
              <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">
                AI DESIGNED SYNTH VOICE
              </span>
              <h4 className="text-sm font-bold text-[#00FFCC] tracking-wide font-sans mt-0.5">
                {generatedPreset.name}
              </h4>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleApply}
                className="bg-neutral-900 border border-[#00FFCC] text-[#00FFCC] hover:bg-[#00FFCC]/10 text-[10px] font-mono font-bold uppercase px-3 py-1 cursor-pointer transition-colors"
              >
                Apply Parameters Now
              </button>
              <button
                onClick={handleSaveToLibrary}
                className="bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white hover:border-neutral-700 text-[10px] font-mono uppercase px-3 py-1 cursor-pointer transition-colors flex items-center gap-1"
              >
                {savedSuccess ? (
                  <Check className="w-3 h-3 text-[#00FFCC]" />
                ) : (
                  <Save className="w-3 h-3 text-neutral-500" />
                )}
                {savedSuccess ? "Saved!" : "Save to Library"}
              </button>
            </div>
          </div>

          {/* Explanation quote */}
          <div className="text-xs text-neutral-400 leading-relaxed italic font-sans bg-neutral-950/60 p-3 border-l-2 border-[#00FFCC]/50">
            "{generatedPreset.explanation}"
          </div>

          {/* Raw synthesized knobs readout */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            
            <div className="bg-neutral-950 p-2.5 border border-neutral-900 text-center">
              <span className="text-[9px] font-mono text-neutral-500 uppercase block">Cutoff (VCF)</span>
              <span className="text-xs font-mono font-bold text-white mt-1 block">
                {generatedPreset.cutoff} Hz
              </span>
            </div>

            <div className="bg-neutral-950 p-2.5 border border-neutral-900 text-center">
              <span className="text-[9px] font-mono text-neutral-500 uppercase block">Resonance (Q)</span>
              <span className="text-xs font-mono font-bold text-white mt-1 block">
                {generatedPreset.resonance}
              </span>
            </div>

            <div className="bg-neutral-950 p-2.5 border border-neutral-900 text-center">
              <span className="text-[9px] font-mono text-neutral-500 uppercase block">Distortion</span>
              <span className="text-xs font-mono font-bold text-white mt-1 block">
                {Math.round(generatedPreset.distortion * 100)}%
              </span>
            </div>

            <div className="bg-neutral-950 p-2.5 border border-neutral-900 text-center">
              <span className="text-[9px] font-mono text-neutral-500 uppercase block">Sidechain</span>
              <span className={`text-xs font-mono font-bold mt-1 block ${generatedPreset.sidechainEnabled ? 'text-[#FF00AA]' : 'text-neutral-500'}`}>
                {generatedPreset.sidechainEnabled ? "ENABLED" : "BYPASSED"}
              </span>
            </div>

          </div>

        </div>
      )}

      {/* LOADING INDICATION GRAPH */}
      {loading && (
        <div className="border border-neutral-900 bg-[#0F0F15] p-5 text-center flex flex-col items-center justify-center gap-3 mt-2 min-h-[140px] animate-pulse">
          <RefreshCw className="w-8 h-8 text-[#00FFCC] animate-spin" />
          <span className="text-[11px] font-mono text-[#00FFCC] uppercase tracking-widest font-bold">
            FORGING WAVEFORM PARAMETERS...
          </span>
          <span className="text-[10px] text-neutral-500 leading-relaxed max-w-xs italic font-sans">
            "Running neural synthesis heuristics to map linguistic properties to voltage-controlled frequencies..."
          </span>
        </div>
      )}

    </div>
  );
}
