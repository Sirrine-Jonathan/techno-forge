import React, { useState } from 'react';
import { 
  Music, Volume2, VolumeX, HelpCircle, Plus, Trash2, FolderOpen, Eraser, Edit3, Settings2
} from 'lucide-react';
import { TrackType, SequencerState, TrackPreset } from '../types';

interface SequencerGridProps {
  sequencerState: SequencerState;
  activeStep: number;
  isPlaying: boolean;
  selectedTrackName: string;
  onToggleStep: (trackName: string, stepIndex: number) => void;
  onUpdatePitch: (trackName: string, stepIndex: number, pitch: string) => void;
  onPreviewPitch: (pitch: string) => void;
  onSelectTrack: (trackName: string) => void;
  onAddTrack: (trackName: string) => void;
  onRemoveTrack: (trackName: string) => void;
  onRenameTrack?: (oldName: string, newName: string) => void;
  onToggleMute: (trackName: string) => void;
  onClearTrack: (trackName: string) => void;
  trackPresets: TrackPreset[];
  onLoadTrackPattern: (preset: TrackPreset, trackName: string) => void;
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
  selectedTrackName,
  onToggleStep,
  onUpdatePitch,
  onPreviewPitch,
  onSelectTrack,
  onAddTrack,
  onRemoveTrack,
  onRenameTrack,
  onToggleMute,
  onClearTrack,
  trackPresets,
  onLoadTrackPattern
}: SequencerGridProps) {
  const [activePitchPicker, setActivePitchPicker] = useState<{ trackName: string; stepIdx: number } | null>(null);
  const [activeLoadMenuTrack, setActiveLoadMenuTrack] = useState<string | null>(null);
  
  // Track adding UI states
  const [newTrackName, setNewTrackName] = useState('');
  const [showAddTrackForm, setShowAddTrackForm] = useState(false);

  // Track renaming states
  const [editingTrackName, setEditingTrackName] = useState<string | null>(null);
  const [renameInputVal, setRenameInputVal] = useState('');

  const getStepColorClass = (trackName: string, isActive: boolean, isCurrentPlayStep: boolean) => {
    const isSynth = trackName !== 'Kick' && trackName !== 'HiHat' && trackName !== 'Clap';
    if (isSynth) {
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

  const handleStepClick = (e: React.MouseEvent, trackName: string, stepIdx: number, isActive: boolean) => {
    const isSynth = trackName !== 'Kick' && trackName !== 'HiHat' && trackName !== 'Clap';
    if (isSynth && isActive) {
      setActivePitchPicker({ trackName, stepIdx });
    } else {
      onToggleStep(trackName, stepIdx);
      setActivePitchPicker(null);
    }
  };

  const handlePitchSelect = (trackName: string, stepIdx: number, pitch: string) => {
    onUpdatePitch(trackName, stepIdx, pitch);
    onPreviewPitch(pitch);
    setActivePitchPicker(null);
  };

  const handleAddTrackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newTrackName.trim();
    if (!name) return;
    
    // Prevent name collisions with drums or existing tracks
    const existing = sequencerState.tracks.some(t => t.name.toLowerCase() === name.toLowerCase());
    if (existing || ['kick', 'hihat', 'clap'].includes(name.toLowerCase())) {
      alert('Track name already exists or is reserved for drum tracks.');
      return;
    }

    onAddTrack(name);
    setNewTrackName('');
    setShowAddTrackForm(false);
  };

  const startRenameFlow = (trackName: string) => {
    setEditingTrackName(trackName);
    setRenameInputVal(trackName);
  };

  const submitRename = () => {
    if (!editingTrackName || !onRenameTrack) return;
    const name = renameInputVal.trim();
    if (name && name !== editingTrackName) {
      onRenameTrack(editingTrackName, name);
    }
    setEditingTrackName(null);
  };

  const handleClearTrackClick = (trackName: string) => {
    if (confirm(`Clear all steps on "${trackName}"?`)) {
      onClearTrack(trackName);
      if (activePitchPicker?.trackName === trackName) {
        setActivePitchPicker(null);
      }
    }
  };

  // Sort tracks: all synths first, then drums (HiHat, Clap, Kick)
  const synthTracks = sequencerState.tracks.filter(
    (t) => t.name !== 'Kick' && t.name !== 'HiHat' && t.name !== 'Clap'
  );
  const drumTracks = sequencerState.tracks.filter(
    (t) => t.name === 'HiHat' || t.name === 'Clap' || t.name === 'Kick'
  );
  const drumOrder: Record<string, number> = { HiHat: 1, Clap: 2, Kick: 3 };
  drumTracks.sort((a, b) => (drumOrder[a.name] || 99) - (drumOrder[b.name] || 99));

  const sortedTracks = [...synthTracks, ...drumTracks];

  return (
    <div id="sequencer-grid-card" className="bg-[#161622] border-2 border-neutral-800 p-5 rounded-none flex flex-col gap-4 font-mono select-none">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h3 className="text-sm font-bold tracking-widest text-neutral-400 uppercase flex items-center gap-2">
          <Music className="w-4 h-4 text-[#FF00AA]" />
          Multi-Track Sequencer Grid (16-Step)
        </h3>
        
        <div className="flex items-center gap-2">
          {/* Add Synth Track Button */}
          <button
            onClick={() => setShowAddTrackForm(!showAddTrackForm)}
            className="bg-neutral-900 hover:bg-[#FF00AA]/10 border border-neutral-800 hover:border-[#FF00AA] px-3 py-1 text-[11px] font-bold uppercase transition-all flex items-center gap-1 text-neutral-300 hover:text-white cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-[#FF00AA]" />
            Add Synth Track
          </button>
          
          <span className="text-[10px] bg-neutral-900 border border-neutral-800 px-2 py-1 text-[#FF00AA] rounded uppercase shrink-0">
            {synthTracks.length} Synth{synthTracks.length !== 1 ? 's' : ''} • 3 Drums
          </span>
        </div>
      </div>

      {/* Inline Form to Add Synth Track */}
      {showAddTrackForm && (
        <form onSubmit={handleAddTrackSubmit} className="bg-neutral-950 p-3 border border-neutral-900 flex flex-col sm:flex-row gap-2.5 items-center">
          <div className="text-[11px] text-[#FF00AA] uppercase font-bold tracking-wider shrink-0">New Synth Track:</div>
          <input
            type="text"
            required
            autoFocus
            placeholder="e.g. Sub Bass, Lead Synth, Acid 2..."
            value={newTrackName}
            onChange={(e) => setNewTrackName(e.target.value)}
            className="flex-1 w-full bg-[#161622] border border-neutral-800 text-xs px-2.5 py-1.5 text-white focus:border-[#FF00AA] focus:outline-none placeholder-neutral-600 font-mono"
          />
          <div className="flex gap-2 w-full sm:w-auto shrink-0 justify-end">
            <button
              type="submit"
              className="bg-[#FF00AA] text-black hover:bg-pink-600 px-4 py-1.5 text-[10px] font-bold uppercase cursor-pointer"
            >
              Create
            </button>
            <button
              type="button"
              onClick={() => setShowAddTrackForm(false)}
              className="bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-800 px-3 py-1.5 text-[10px] font-bold uppercase cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* TRACK MATRIX HOUSING WITH HORIZONTAL TOUCH SCROLL ON MOBILE */}
      <div className="w-full overflow-x-auto pb-2 select-none touch-pan-x scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-[#0F0F15]">
        <div className="flex flex-col gap-2 relative min-w-[850px]">
          
          {/* STEP HEADERS */}
          <div className="grid grid-cols-[210px_repeat(16,1fr)] gap-1 px-1 items-center">
            <div className="text-[10px] text-neutral-500 uppercase font-bold tracking-wider">Tracks & Control Deck</div>
            {Array.from({ length: 16 }).map((_, stepIdx) => (
              <div
                key={stepIdx}
                className={`text-center text-[10px] font-bold py-1 transition-all duration-100 ${
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
          {sortedTracks.map((track) => {
            const isSynth = track.name !== 'Kick' && track.name !== 'HiHat' && track.name !== 'Clap';
            const isSelected = selectedTrackName === track.name;
            const isMuted = !!track.muted;
            const currentPitches = track.pitches || sequencerState.pitches;

            return (
              <div
                key={track.name}
                className={`grid grid-cols-[210px_repeat(16,1fr)] gap-1 items-center p-1.5 border transition-all ${
                  isSynth && isSelected 
                    ? 'bg-[#1a111f] border-[#FF00AA]/50 shadow-[inset_0_0_10px_rgba(255,0,170,0.1)]' 
                    : 'bg-[#0F0F15]/60 border-neutral-900'
                } ${isMuted ? 'opacity-60' : ''}`}
              >
                {/* TRACK HEADER COLUMN (210px) */}
                <div className="flex items-center justify-between pr-2.5 border-r border-neutral-800 h-full min-h-[44px]">
                  
                  {/* Title & Info */}
                  <div className="flex flex-col min-w-0 flex-1 justify-center">
                    {editingTrackName === track.name ? (
                      <div className="flex items-center gap-1 pr-1">
                        <input
                          type="text"
                          value={renameInputVal}
                          onChange={(e) => setRenameInputVal(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') submitRename();
                            if (e.key === 'Escape') setEditingTrackName(null);
                          }}
                          className="bg-neutral-950 border border-[#FF00AA] text-[10px] text-white px-1 py-0.5 focus:outline-none w-full font-mono font-bold"
                          autoFocus
                        />
                        <button
                          onClick={submitRename}
                          className="text-emerald-400 hover:text-white text-xs font-bold"
                        >
                          ✓
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 group">
                        <span 
                          onClick={() => {
                            if (isSynth) {
                              onSelectTrack(track.name);
                            }
                          }}
                          className={`text-xs font-bold uppercase truncate cursor-pointer ${
                            isSynth 
                              ? isSelected 
                                ? 'text-[#FF00AA] drop-shadow-[0_0_8px_rgba(255,0,170,0.5)]' 
                                : 'text-neutral-300 hover:text-white'
                              : 'text-neutral-400'
                          }`}
                          title={isSynth ? "Click to Select and Edit sound parameters" : ""}
                        >
                          {track.name}
                        </span>
                        
                        {isSynth && onRenameTrack && (
                          <button
                            onClick={() => startRenameFlow(track.name)}
                            className="opacity-0 group-hover:opacity-100 text-neutral-600 hover:text-[#FF00AA] transition-opacity p-0.5 cursor-pointer"
                            title="Rename Track"
                          >
                            <Edit3 className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </div>
                    )}
                    
                    <span className="text-[8px] text-neutral-500 uppercase tracking-widest mt-0.5 select-none">
                      {isSynth ? 'TB-303 SYNTH VOICE' : 'SAMPLED DRUM'} {isMuted ? '• MUTED' : ''}
                    </span>
                  </div>

                  {/* Operational Controls Block */}
                  <div className="flex items-center gap-1 ml-1 shrink-0">
                    <button
                      onClick={() => onToggleMute(track.name)}
                      className={`p-1 border transition-colors cursor-pointer ${
                        isMuted
                          ? 'bg-amber-950/40 border-amber-500 text-amber-300 hover:text-white'
                          : 'bg-neutral-950 border-neutral-800 text-neutral-500 hover:border-amber-400 hover:text-amber-300'
                      }`}
                      title={isMuted ? 'Unmute Track' : 'Mute Track'}
                    >
                      {isMuted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                    </button>

                    <button
                      onClick={() => handleClearTrackClick(track.name)}
                      className="p-1 bg-neutral-950 border border-neutral-800 hover:border-orange-400 text-neutral-500 hover:text-orange-300 transition-colors cursor-pointer"
                      title="Clear Track Steps"
                    >
                      <Eraser className="w-3 h-3" />
                    </button>

                    {isSynth && (
                      <>
                        {/* Selector indicator */}
                        <button
                          onClick={() => onSelectTrack(track.name)}
                          className={`px-1.5 py-0.5 text-[9px] font-bold uppercase transition-all rounded-xs border cursor-pointer ${
                            isSelected
                              ? 'bg-[#FF00AA] border-[#FF00AA] text-black font-extrabold'
                              : 'bg-neutral-900 border-neutral-800 text-neutral-500 hover:text-neutral-300 hover:border-neutral-700'
                          }`}
                          title="Click to select this synth to edit with physical knobs"
                        >
                          EDIT
                        </button>

                        {/* Quick Load Pattern Button */}
                        <button
                          onClick={() => setActiveLoadMenuTrack(activeLoadMenuTrack === track.name ? null : track.name)}
                          className="p-1 bg-neutral-950 border border-neutral-800 hover:border-orange-400 text-neutral-500 hover:text-orange-400 transition-colors cursor-pointer"
                          title="Load pattern template for this track"
                        >
                          <FolderOpen className="w-3 h-3" />
                        </button>

                        {/* Delete Track button */}
                        <button
                          disabled={synthTracks.length <= 1}
                          onClick={() => {
                            if (confirm(`Are you sure you want to delete track "${track.name}"?`)) {
                              onRemoveTrack(track.name);
                            }
                          }}
                          className="p-1 bg-neutral-950 border border-neutral-800 hover:border-red-500 text-neutral-500 hover:text-red-400 disabled:opacity-30 disabled:hover:border-neutral-800 disabled:hover:text-neutral-500 transition-colors cursor-pointer"
                          title="Delete Synth Track"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </>
                    )}
                    
                    {!isSynth && (
                      <button
                        onClick={() => setActiveLoadMenuTrack(activeLoadMenuTrack === track.name ? null : track.name)}
                        className="p-1 bg-neutral-950 border border-neutral-800 hover:border-emerald-400 text-neutral-500 hover:text-[#00FFCC] transition-colors cursor-pointer"
                        title="Load drum pattern template"
                      >
                        <FolderOpen className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                </div>

                {/* STEP GRID CELLS */}
                {track.steps.map((isActive, stepIdx) => {
                  const isCurrentPlayStep = activeStep === stepIdx && isPlaying;
                  return (
                    <div key={stepIdx} className="relative aspect-square min-h-[38px] w-full">
                      <button
                        id={`step-${track.name}-${stepIdx}`}
                        onClick={(e) => handleStepClick(e, track.name, stepIdx, isActive)}
                        className={`w-full h-full border text-[10px] cursor-pointer flex flex-col items-center justify-center transition-all rounded-none ${getStepColorClass(
                          track.name,
                          isActive,
                          isCurrentPlayStep
                        )}`}
                      >
                        {/* Visual indicator of note pitch if Synth and active */}
                        {isSynth && isActive ? (
                          <div className="flex flex-col items-center justify-center leading-none">
                            <span className="text-[8px] tracking-tighter opacity-90 font-bold font-mono">
                              {currentPitches[stepIdx] || 'C2'}
                            </span>
                            <span className="text-[7px] opacity-40 font-mono">✎</span>
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

      {/* QUICK FLOATING TRACK LOADER DROPDOWN POPUP */}
      {activeLoadMenuTrack !== null && (
        <div 
          className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 transition-all"
          onClick={() => setActiveLoadMenuTrack(null)}
        >
          <div 
            className="bg-[#161622] border-2 border-orange-400 p-4 flex flex-col gap-3 shadow-[0_0_30px_rgba(251,146,60,0.4)] w-full max-w-[340px]"
            onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
          >
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
              <span className="text-xs font-bold text-neutral-200 uppercase tracking-wider flex items-center gap-1">
                <FolderOpen className="w-3.5 h-3.5 text-orange-400" />
                Load Pattern into: {activeLoadMenuTrack}
              </span>
              <button
                onClick={() => setActiveLoadMenuTrack(null)}
                className="text-xs text-orange-400 hover:text-white px-2 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>
            
            <div className="flex flex-col gap-1.5 max-h-[220px] overflow-y-auto pr-1">
              {(() => {
                const targetTrackIsSynth = activeLoadMenuTrack !== 'Kick' && activeLoadMenuTrack !== 'HiHat' && activeLoadMenuTrack !== 'Clap';
                
                const filteredPresets = trackPresets.filter((preset) => {
                  const presetIsSynth = preset.trackName !== 'Kick' && preset.trackName !== 'HiHat' && preset.trackName !== 'Clap';
                  if (targetTrackIsSynth) {
                    return presetIsSynth;
                  } else {
                    return preset.trackName.toLowerCase() === activeLoadMenuTrack.toLowerCase();
                  }
                });

                if (filteredPresets.length === 0) {
                  return (
                    <div className="text-[10px] text-neutral-500 font-mono text-center py-6 border border-dashed border-neutral-800">
                      No matching presets saved yet.<br/>Create one in the Preset Library below!
                    </div>
                  );
                }

                return filteredPresets.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => {
                      onLoadTrackPattern(preset, activeLoadMenuTrack);
                      setActiveLoadMenuTrack(null);
                    }}
                    className="text-[11px] p-2 bg-[#0F0F15] hover:bg-neutral-900 border border-neutral-800 hover:border-orange-400 text-neutral-300 hover:text-white text-left transition-all font-mono uppercase flex items-center justify-between group cursor-pointer"
                  >
                    <span className="truncate flex-1 font-bold">{preset.name}</span>
                    <span className="text-[8px] text-neutral-500 group-hover:text-orange-400 shrink-0 ml-2">
                      Load Pattern
                    </span>
                  </button>
                ));
              })()}
            </div>

            <button
              onClick={() => setActiveLoadMenuTrack(null)}
              className="text-[10px] bg-neutral-900 hover:bg-neutral-800 text-neutral-400 py-2 font-bold uppercase transition-all w-full text-center border border-neutral-800 cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* AcidSynth pitch picker viewport-fixed popup overlay (Immune to parent overflow clipping) */}
      {activePitchPicker !== null && (
        <div 
          className="fixed inset-0 bg-[#000000]/85 backdrop-blur-xs flex items-center justify-center z-50 p-4 transition-all"
          onClick={() => setActivePitchPicker(null)}
        >
          <div 
            className="bg-[#161622] border-2 border-[#FF00AA] p-4 flex flex-col gap-3 shadow-[0_0_30px_rgba(255,0,170,0.5)] w-full max-w-[300px]"
            onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
          >
            <div className="flex items-center justify-between border-b border-neutral-800 pb-1.5">
              <span className="text-xs font-bold text-neutral-200 uppercase tracking-wider flex items-center gap-1">
                <Settings2 className="w-3.5 h-3.5 text-[#FF00AA]" />
                {activePitchPicker.trackName}: Step {activePitchPicker.stepIdx + 1} Pitch
              </span>
              <button
                onClick={() => setActivePitchPicker(null)}
                className="text-xs text-[#FF00AA] hover:text-white px-2 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>
            
            <div className="grid grid-cols-3 gap-1.5 max-h-[180px] overflow-y-auto pr-1">
              {ACID_SCALE.map((note) => {
                const targetTrack = sequencerState.tracks.find(t => t.name === activePitchPicker.trackName);
                const currentNote = targetTrack?.pitches?.[activePitchPicker.stepIdx] || sequencerState.pitches[activePitchPicker.stepIdx];
                return (
                  <button
                    key={note}
                    onClick={() => handlePitchSelect(activePitchPicker.trackName, activePitchPicker.stepIdx, note)}
                    className={`text-[10px] py-2 border transition-all uppercase rounded-none font-bold cursor-pointer ${
                      currentNote === note
                        ? 'bg-[#FF00AA] border-[#FF00AA] text-[#0F0F15]'
                        : 'bg-[#0F0F15] border-neutral-800 text-neutral-400 hover:border-neutral-500 hover:text-white'
                    }`}
                  >
                    {note}
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 gap-2 mt-1">
              <button
                onClick={() => {
                  onToggleStep(activePitchPicker.trackName, activePitchPicker.stepIdx);
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-[#0F0F15] border border-neutral-900 p-2 text-[10px] text-neutral-500">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
          <span>
            Click empty cells to activate. Active synth steps open note selection. Switch <strong className="text-[#FF00AA]">EDIT</strong> focus to route physical dials.
          </span>
        </div>
        <div className="text-[#FF00AA] font-bold text-[9px] uppercase tracking-wider select-none animate-pulse">
          ⚡ Dual-Synth DAW Engine Live
        </div>
      </div>
    </div>
  );
}
