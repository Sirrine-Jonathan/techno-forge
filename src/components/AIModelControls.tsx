import React, { useState } from 'react';
import { Sparkles, BrainCircuit, RefreshCw, AlertCircle, HelpCircle } from 'lucide-react';
import { ModelsLoadingState } from '../utils/magentaHelper';

interface AIModelControlsProps {
  loadingState: ModelsLoadingState;
  onEvolveMelody: (temperature: number) => void;
  onEvolveDrums: (temperature: number) => void;
}

export default function AIModelControls({
  loadingState,
  onEvolveMelody,
  onEvolveDrums
}: AIModelControlsProps) {
  const [temperature, setTemperature] = useState(1.15);
  const [evolvingMelody, setEvolvingMelody] = useState(false);
  const [evolvingDrums, setEvolvingDrums] = useState(false);

  const handleEvolveMelody = async () => {
    setEvolvingMelody(true);
    // Give UI a moment to show spinner
    setTimeout(async () => {
      await onEvolveMelody(temperature);
      setEvolvingMelody(false);
    }, 150);
  };

  const handleEvolveDrums = async () => {
    setEvolvingDrums(true);
    // Give UI a moment to show spinner
    setTimeout(async () => {
      await onEvolveDrums(temperature);
      setEvolvingDrums(false);
    }, 150);
  };

  return (
    <div id="ai-controls-card" className="bg-[#161622] border-2 border-neutral-800 p-5 rounded-none flex flex-col gap-4 font-mono">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold tracking-widest text-neutral-400 uppercase flex items-center gap-2">
          <BrainCircuit className="w-4 h-4 text-[#FF00AA]" />
          Magenta AI Pattern Evolver
        </h3>
        <span className="text-[10px] bg-neutral-900 border border-neutral-800 px-2 py-0.5 text-neutral-500 rounded">
          Local RNN Models
        </span>
      </div>

      <p className="text-xs text-neutral-400 leading-relaxed">
        Mutate and syncopate your current sequencer loops. This compiles your active grid notes into a Magenta NoteSequence, executes browser-side neural network inference, and writes back the prediction.
      </p>

      {/* STATUS AND LOADING BAR INDICATORS */}
      <div className="bg-[#0F0F15] p-3 border border-neutral-900 flex flex-col gap-2">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-neutral-500">MusicRNN Engine Status:</span>
          {loadingState.loading ? (
            <span className="text-[#00FFCC] font-bold flex items-center gap-1.5 animate-pulse">
              <RefreshCw className="w-3 h-3 animate-spin" />
              Downloading Weights...
            </span>
          ) : loadingState.error ? (
            <span className="text-amber-500 font-bold flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              Offline / Local Fallback Active
            </span>
          ) : (
            <span className="text-[#00FFCC] font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00FFCC] animate-ping" />
              Neural Models Connected
            </span>
          )}
        </div>

        {/* Load indicators */}
        <div className="grid grid-cols-2 gap-2 text-[10px] mt-1 text-neutral-400">
          <div className="flex items-center gap-2 bg-neutral-900 px-2 py-1 border border-neutral-800">
            <span className={`w-1.5 h-1.5 rounded-full ${loadingState.melodyLoaded ? 'bg-[#FF00AA]' : 'bg-neutral-700'}`} />
            Melody RNN: {loadingState.melodyLoaded ? 'READY' : 'LOCAL ENGINE'}
          </div>
          <div className="flex items-center gap-2 bg-neutral-900 px-2 py-1 border border-neutral-800">
            <span className={`w-1.5 h-1.5 rounded-full ${loadingState.drumsLoaded ? 'bg-[#00FFCC]' : 'bg-neutral-700'}`} />
            Drums RNN: {loadingState.drumsLoaded ? 'READY' : 'LOCAL ENGINE'}
          </div>
        </div>

        {loadingState.error && (
          <div className="text-[9px] text-neutral-500 mt-1 leading-relaxed italic">
            Note: Neural weights failed to download from Google cloud. The high-fidelity local algorithmic mutator is fully active to provide instantaneous pattern transpositions and offbeat injections.
          </div>
        )}
      </div>

      <div className="border-t border-neutral-900 my-1" />

      {/* CORE CONTROLS */}
      <div className="flex flex-col gap-4">
        {/* Creativity Slider (Temperature) */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-neutral-400 flex items-center gap-1">
              AI Temperature (Entropy)
              <HelpCircle className="w-3.5 h-3.5 text-neutral-600" title="Higher temperature generates more wild, syncopated mutations" />
            </span>
            <span className="text-[#FF00AA] font-bold">x {temperature.toFixed(2)}</span>
          </div>
          <input
            id="ai-temperature-slider"
            type="range"
            min="0.5"
            max="1.80"
            step="0.05"
            value={temperature}
            onChange={(e) => setTemperature(parseFloat(e.target.value))}
            className="w-full accent-[#FF00AA] bg-neutral-800 h-1 rounded-lg cursor-pointer"
          />
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Evolve Melody */}
          <button
            id="ai-evolve-melody-btn"
            disabled={evolvingMelody}
            onClick={handleEvolveMelody}
            className="flex items-center justify-center gap-2 bg-neutral-900 border border-[#FF00AA]/50 hover:border-[#FF00AA] text-[#FF00AA] hover:text-white hover:bg-pink-950/20 text-xs py-2.5 px-3 uppercase transition-all font-bold cursor-pointer active:scale-98 disabled:opacity-50"
          >
            {evolvingMelody ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Inference running...
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                Evolve Melody AI
              </>
            )}
          </button>

          {/* Evolve Drums */}
          <button
            id="ai-evolve-drums-btn"
            disabled={evolvingDrums}
            onClick={handleEvolveDrums}
            className="flex items-center justify-center gap-2 bg-neutral-900 border border-[#00FFCC]/50 hover:border-[#00FFCC] text-[#00FFCC] hover:text-white hover:bg-emerald-950/20 text-xs py-2.5 px-3 uppercase transition-all font-bold cursor-pointer active:scale-98 disabled:opacity-50"
          >
            {evolvingDrums ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Inference running...
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                Evolve Drums AI
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
