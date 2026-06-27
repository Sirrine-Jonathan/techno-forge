import React, { useState } from 'react';
import { Music, Eye, Volume2, HelpCircle } from 'lucide-react';
import { TrackType, SequencerState } from '../types';

interface SequencerGridProps {
  sequencerState: SequencerState;
  activeStep: number;
  isPlaying: boolean;
  onToggleStep: (trackName: TrackType, stepIndex: number) => void;
  onUpdatePitch: (stepIndex: number, pitch: string) => void;
  onPreviewPitch: (pitch: string) => void;
}

// Techno minor pentatonic scale notes for easy custom basslines
const ACID_SCALE = [
  'C1', 'D#1', 'F1', 'G1', 'A#1',
  'C2', 'D#2', 'F2', 'G2', 'A#2',
  'C3', 'D#3', 'F3', 'G3', 'A#3'
];

export default function SequencerGrid({
  sequencerState,
  activeStep,
  isPlaying,
  onToggleStep,
  onUpdatePitch,
  onPreviewPitch
}: SequencerGridProps) {
  const [activePitchPicker, setActivePitchPicker] = useState<number | null>(null);

  const getStepColorClass = (trackName: TrackType, isActive: boolean, isCurrentPlayStep: boolean) => {
    if (trackName === 'AcidSynth') {
      if (isActive) {
        return isCurrentPlayStep
          ? 'bg-[#FF00AA] border-[#FF00AA] text-[#0F0F15] shadow-[0_0_15px_rgba(255,0,170,0.8)] scale-98 font-bold'
          : 'bg-pink-950/40 border-[#FF00AA]/80 text-[#FF00AA] hover:bg-pink-950/60 font-bold';
      }
      return isCurrentPlayStep
        ? 'bg-neutral-800 border-neutral-700 text-neutral-400'
        : 'bg-neutral-900/60 border-neutral-800 hover:border-neutral-700 text-neutral-600';
    } else {
      // Drum track: Kick, HiHat, Clap
      if (isActive) {
        return isCurrentPlayStep
          ? 'bg-[#00FFCC] border-[#00FFCC] text-[#0F0F15] shadow-[0_0_15px_rgba(0,255,204,0.8)] scale-98 font-bold'
          : 'bg-emerald-950/40 border-[#00FFCC]/80 text-[#00FFCC] hover:bg-emerald-950/60 font-bold';
      }
      return isCurrentPlayStep
        ? 'bg-neutral-800 border-neutral-700 text-neutral-400'
        : 'bg-neutral-900/60 border-neutral-800 hover:border-neutral-700 text-neutral-600';
    }
  };

  const handleStepClick = (e: React.MouseEvent, trackName: TrackType, stepIdx: number, isActive: boolean) => {
    // If clicking AcidSynth and it is already active, toggle pitch picker, otherwise toggle step state
    if (trackName === 'AcidSynth' && isActive) {
      setActivePitchPicker(stepIdx);
    } else {
      onToggleStep(trackName, stepIdx);
      setActivePitchPicker(null);
    }
  };

  const handlePitchSelect = (stepIdx: number, pitch: string) => {
    onUpdatePitch(stepIdx, pitch);
    onPreviewPitch(pitch);
    setActivePitchPicker(null);
  };

  return (
    <div id="sequencer-grid-card" className="bg-[#161622] border-2 border-neutral-800 p-5 rounded-none flex flex-col gap-4 font-mono select-none">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold tracking-widest text-neutral-400 uppercase flex items-center gap-2">
          <Music className="w-4 h-4 text-[#FF00AA]" />
          Sequencer Grid Matrix (16-Step)
        </h3>
        <span className="text-[10px] bg-neutral-900 border border-neutral-800 px-2 py-0.5 text-[#FF00AA] rounded animate-pulse uppercase">
          Dynamic Grid
        </span>
      </div>

      {/* TRACK MATRIX HOUSING WITH HORIZONTAL TOUCH SCROLL ON MOBILE */}
      <div className="w-full overflow-x-auto pb-2 select-none touch-pan-x scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-[#0F0F15]">
        <div className="flex flex-col gap-2 relative min-w-[680px] md:min-w-0">
          
          {/* STEP HEADERS */}
          <div className="grid grid-cols-[85px_repeat(16,1fr)] gap-1 px-1 items-center">
            <div className="text-[10px] text-neutral-500 uppercase font-bold tracking-wider">Track</div>
            {Array.from({ length: 16 }).map((_, stepIdx) => (
              <div
                key={stepIdx}
                className={`text-center text-[9px] font-bold py-1 transition-all duration-100 ${
                  activeStep === stepIdx && isPlaying
                    ? 'text-[#00FFCC] border-b border-[#00FFCC] scale-110'
                    : 'text-neutral-500'
                }`}
              >
                {(stepIdx + 1).toString().padStart(2, '0')}
              </div>
            ))}
          </div>

          {/* TRACK ROWS */}
          {sequencerState.tracks.map((track) => {
            const isAcid = track.name === 'AcidSynth';
            return (
              <div
                key={track.name}
                className="grid grid-cols-[85px_repeat(16,1fr)] gap-1 items-center bg-[#0F0F15]/60 p-1 border border-neutral-900"
              >
                {/* TRACK LABEL */}
                <div className="flex flex-col pr-1 border-r border-neutral-800">
                  <span className={`text-[11px] font-bold uppercase ${isAcid ? 'text-[#FF00AA]' : 'text-neutral-300'}`}>
                    {track.name}
                  </span>
                  <span className="text-[8px] text-neutral-500 uppercase tracking-widest">
                    {isAcid ? 'TB-303 Synth' : 'SAMPLED'}
                  </span>
                </div>

                {/* STEP GRID CELLS */}
                {track.steps.map((isActive, stepIdx) => {
                  const isCurrentPlayStep = activeStep === stepIdx && isPlaying;
                  return (
                    <div key={stepIdx} className="relative aspect-square min-h-[34px] w-full">
                      <button
                        id={`step-${track.name}-${stepIdx}`}
                        onClick={(e) => handleStepClick(e, track.name, stepIdx, isActive)}
                        className={`w-full h-full border text-[10px] cursor-pointer flex flex-col items-center justify-center transition-all rounded-none ${getStepColorClass(
                          track.name,
                          isActive,
                          isCurrentPlayStep
                        )}`}
                      >
                        {/* Visual indicator of step number or pitch if AcidSynth */}
                        {isAcid && isActive ? (
                          <div className="flex flex-col items-center justify-center leading-none">
                            <span className="text-[8px] tracking-tighter opacity-80 font-bold">
                              {sequencerState.pitches[stepIdx]}
                            </span>
                            <span className="text-[7px] text-[10px] opacity-40 font-mono">✎</span>
                          </div>
                        ) : null}
                      </button>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* AcidSynth pitch picker viewport-fixed popup overlay (Immune to parent overflow clipping) */}
      {activePitchPicker !== null && (
        <div 
          className="fixed inset-0 bg-[#000000]/80 backdrop-blur-xs flex items-center justify-center z-50 p-4 transition-all"
          onClick={() => setActivePitchPicker(null)}
        >
          <div 
            className="bg-[#161622] border-2 border-[#FF00AA] p-4 flex flex-col gap-3 shadow-[0_0_30px_rgba(255,0,170,0.5)] w-full max-w-[280px]"
            onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
          >
            <div className="flex items-center justify-between border-b border-neutral-800 pb-1.5">
              <span className="text-xs font-bold text-neutral-200 uppercase tracking-wider">
                Step {activePitchPicker + 1} Note Select
              </span>
              <button
                onClick={() => setActivePitchPicker(null)}
                className="text-xs text-[#FF00AA] hover:text-white px-2 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>
            
            <div className="grid grid-cols-3 gap-1.5 max-h-[180px] overflow-y-auto pr-1">
              {ACID_SCALE.map((note) => (
                <button
                  key={note}
                  onClick={() => handlePitchSelect(activePitchPicker, note)}
                  className={`text-[10px] py-2 border transition-all uppercase rounded-none font-bold cursor-pointer ${
                    sequencerState.pitches[activePitchPicker] === note
                      ? 'bg-[#FF00AA] border-[#FF00AA] text-[#0F0F15]'
                      : 'bg-[#0F0F15] border-neutral-800 text-neutral-400 hover:border-neutral-500 hover:text-white'
                  }`}
                >
                  {note}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-2 mt-1">
              <button
                onClick={() => {
                  onToggleStep('AcidSynth', activePitchPicker);
                  setActivePitchPicker(null);
                }}
                className="text-[10px] bg-red-950 hover:bg-red-900 text-red-400 border border-red-800 hover:text-red-200 py-2 font-bold uppercase transition-all w-full text-center cursor-pointer"
              >
                De-activate Step
              </button>
              <button
                onClick={() => setActivePitchPicker(null)}
                className="text-[10px] bg-neutral-900 hover:bg-neutral-800 text-neutral-400 py-2 font-bold uppercase transition-all w-full text-center border border-neutral-800 cursor-pointer"
              >
                Keep Active
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QUICK INSTRUCTIONS FOOTER */}
      <div className="flex items-center gap-2 bg-[#0F0F15] border border-neutral-900 p-2 text-[10px] text-neutral-500">
        <HelpCircle className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
        <span>
          Click empty squares to trigger. Click active <strong className="text-[#FF00AA]">AcidSynth</strong> steps to customize their bass notes.
        </span>
      </div>
    </div>
  );
}
