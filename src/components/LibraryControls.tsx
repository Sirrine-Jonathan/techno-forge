import React, { useState, useEffect, useRef } from 'react';
import { 
  FolderHeart, Save, Download, Upload, Trash2, Check, Music, 
  Layers, Volume2, AlertTriangle, Sparkles, FileJson, FileText 
} from 'lucide-react';
import { SequencerState, TrackType, SoundPreset, TrackPreset, SongPreset } from '../types';
import { 
  getSavedSongs, saveSong, deleteSong,
  getSavedSounds, saveSound, deleteSound,
  getSavedTracks, saveTrack, deleteTrack,
  exportDataAsJsonFile, validateAndParseImportedJson
} from '../utils/libraryStorage';

interface LibraryControlsProps {
  currentSequencerState: SequencerState;
  currentBpm: number;
  currentCutoff: number;
  currentResonance: number;
  currentDistortion: number;
  currentSidechainEnabled: boolean;
  currentWaveform: 'sawtooth' | 'square';
  currentDecay: number;
  currentEnvMod: number;
  currentPortamento: number;
  currentDelayFeedback: number;
  currentDelayMix: number;

  onLoadSong: (song: SongPreset) => void;
  onLoadSound: (sound: Omit<SoundPreset, 'id' | 'createdAt'>) => void;
  onLoadTrack: (trackName: TrackType, steps: boolean[], pitches?: string[], noteLengths?: number[], soundPreset?: Omit<SoundPreset, 'id' | 'createdAt'>) => void;
}

export default function LibraryControls({
  currentSequencerState,
  currentBpm,
  currentCutoff,
  currentResonance,
  currentDistortion,
  currentSidechainEnabled,
  currentWaveform,
  currentDecay,
  currentEnvMod,
  currentPortamento,
  currentDelayFeedback,
  currentDelayMix,
  onLoadSong,
  onLoadSound,
  onLoadTrack
}: LibraryControlsProps) {
  // Database state lists
  const [songs, setSongs] = useState<SongPreset[]>([]);
  const [sounds, setSounds] = useState<SoundPreset[]>([]);
  const [tracks, setTracks] = useState<TrackPreset[]>([]);

  // Local entry input fields
  const [songInputName, setSongInputName] = useState('');
  const [soundInputName, setSoundInputName] = useState('');
  const [trackInputName, setTrackInputName] = useState('');
  const [selectedTrackToSave, setSelectedTrackToSave] = useState<TrackType>('AcidSynth');

  // Drag-and-drop / file import UI states
  const [importStatus, setImportStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
    parsedData?: { type: string; payload: any };
  }>({ type: null, message: '' });

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Success indicator badges
  const [successAction, setSuccessAction] = useState<string | null>(null);

  // Load lists on mount and sync selected track
  useEffect(() => {
    refreshLibrary();
  }, []);

  useEffect(() => {
    if (currentSequencerState.tracks.length > 0) {
      const exists = currentSequencerState.tracks.some(t => t.name === selectedTrackToSave);
      if (!exists) {
        setSelectedTrackToSave(currentSequencerState.tracks[0].name);
      }
    }
  }, [currentSequencerState.tracks, selectedTrackToSave]);

  const refreshLibrary = () => {
    setSongs(getSavedSongs());
    setSounds(getSavedSounds());
    setTracks(getSavedTracks());
  };

  const triggerNotification = (message: string) => {
    setSuccessAction(message);
    setTimeout(() => {
      setSuccessAction(null);
    }, 2500);
  };

  // --- ACTIONS: SAVE & LOAD SONGS ---
  const handleSaveSong = (e: React.FormEvent) => {
    e.preventDefault();
    const soundData = {
      cutoff: currentCutoff,
      resonance: currentResonance,
      distortion: currentDistortion,
      sidechainEnabled: currentSidechainEnabled,
      name: soundInputName.trim() || 'Custom Synth Model',
      waveform: currentWaveform,
      decay: currentDecay,
      envMod: currentEnvMod,
      portamento: currentPortamento,
      delayFeedback: currentDelayFeedback,
      delayMix: currentDelayMix
    };
    const saved = saveSong(songInputName, currentSequencerState, currentBpm, soundData);
    setSongInputName('');
    refreshLibrary();
    triggerNotification(`Saved song: "${saved.name}"`);
  };

  const handleLoadSong = (song: SongPreset) => {
    onLoadSong(song);
    triggerNotification(`Loaded song: "${song.name}"`);
  };

  const handleDeleteSong = (id: string, name: string) => {
    deleteSong(id);
    refreshLibrary();
    triggerNotification(`Deleted song: "${name}"`);
  };

  // --- ACTIONS: SAVE & LOAD ATOMIC SOUND PRESETS ---
  const handleSaveSound = (e: React.FormEvent) => {
    e.preventDefault();
    const saved = saveSound(
      soundInputName,
      currentCutoff,
      currentResonance,
      currentDistortion,
      currentSidechainEnabled,
      currentWaveform,
      currentDecay,
      currentEnvMod,
      currentPortamento,
      currentDelayFeedback,
      currentDelayMix
    );
    setSoundInputName('');
    refreshLibrary();
    triggerNotification(`Saved sound: "${saved.name}"`);
  };

  const handleLoadSound = (sound: SoundPreset) => {
    onLoadSound({
      name: sound.name,
      cutoff: sound.cutoff,
      resonance: sound.resonance,
      distortion: sound.distortion,
      sidechainEnabled: sound.sidechainEnabled,
      waveform: sound.waveform,
      decay: sound.decay,
      envMod: sound.envMod,
      portamento: sound.portamento,
      delayFeedback: sound.delayFeedback,
      delayMix: sound.delayMix
    });
    triggerNotification(`Loaded sound model: "${sound.name}"`);
  };

  const handleDeleteSound = (id: string, name: string) => {
    deleteSound(id);
    refreshLibrary();
    triggerNotification(`Deleted sound: "${name}"`);
  };

  // --- ACTIONS: SAVE & LOAD TRACK PATTERNS ---
  const handleSaveTrack = (e: React.FormEvent) => {
    e.preventDefault();
    const targetTrack = currentSequencerState.tracks.find(t => t.name === selectedTrackToSave);
    if (!targetTrack) return;

    const isSynth = selectedTrackToSave !== 'Kick' && selectedTrackToSave !== 'HiHat' && selectedTrackToSave !== 'Clap';
    const pitchesToSave = isSynth ? (targetTrack.pitches || [...currentSequencerState.pitches]) : undefined;
    const noteLengthsToSave = isSynth ? targetTrack.noteLengths : undefined;

    const soundPresetToSave = isSynth ? {
      name: trackInputName,
      cutoff: targetTrack.cutoff !== undefined ? targetTrack.cutoff : currentCutoff,
      resonance: targetTrack.resonance !== undefined ? targetTrack.resonance : currentResonance,
      distortion: targetTrack.distortion !== undefined ? targetTrack.distortion : currentDistortion,
      sidechainEnabled: targetTrack.sidechainEnabled !== undefined ? targetTrack.sidechainEnabled : currentSidechainEnabled,
      waveform: targetTrack.waveform || currentWaveform,
      decay: targetTrack.decay !== undefined ? targetTrack.decay : currentDecay,
      envMod: targetTrack.envMod !== undefined ? targetTrack.envMod : currentEnvMod,
      portamento: targetTrack.portamento !== undefined ? targetTrack.portamento : currentPortamento,
      delayFeedback: targetTrack.delayFeedback !== undefined ? targetTrack.delayFeedback : currentDelayFeedback,
      delayMix: targetTrack.delayMix !== undefined ? targetTrack.delayMix : currentDelayMix,
    } : undefined;

    const saved = saveTrack(
      trackInputName,
      selectedTrackToSave,
      targetTrack.steps,
      pitchesToSave,
      noteLengthsToSave,
      soundPresetToSave
    );
    setTrackInputName('');
    refreshLibrary();
    triggerNotification(`Saved ${selectedTrackToSave} track: "${saved.name}"`);
  };

  const handleLoadTrackPattern = (trackPreset: TrackPreset, targetTrackOverride?: TrackType) => {
    const destinationTrack = targetTrackOverride || trackPreset.trackName;
    onLoadTrack(destinationTrack, trackPreset.steps, trackPreset.pitches, trackPreset.noteLengths, trackPreset.soundPreset);
    triggerNotification(`Loaded pattern into ${destinationTrack}: "${trackPreset.name}"`);
  };

  const handleDeleteTrackPattern = (id: string, name: string) => {
    deleteTrack(id);
    refreshLibrary();
    triggerNotification(`Deleted track preset: "${name}"`);
  };

  // --- EXPORTS TO FILE ---
  const handleExportSong = (song: SongPreset) => {
    const exportData = {
      ...song,
      exporter: 'TechnoForge AI Studio',
      version: '1.1.0'
    };
    exportDataAsJsonFile(exportData, `${song.name.toLowerCase().replace(/\s+/g, '_')}_song.json`);
    triggerNotification(`Exported song file: "${song.name}"`);
  };

  const handleExportSound = (sound: SoundPreset) => {
    const exportData = {
      ...sound,
      exporter: 'TechnoForge AI Studio',
      version: '1.1.0'
    };
    exportDataAsJsonFile(exportData, `${sound.name.toLowerCase().replace(/\s+/g, '_')}_preset.json`);
    triggerNotification(`Exported sound file: "${sound.name}"`);
  };

  const handleExportTrack = (trackPreset: TrackPreset) => {
    const exportData = {
      ...trackPreset,
      exporter: 'TechnoForge AI Studio',
      version: '1.1.0'
    };
    exportDataAsJsonFile(exportData, `${trackPreset.name.toLowerCase().replace(/\s+/g, '_')}_pattern.json`);
    triggerNotification(`Exported track pattern file: "${trackPreset.name}"`);
  };

  // --- ACTIONS: IMPORT FROM FILE DRAG/DROP ---
  const processImportedText = (text: string) => {
    const result = validateAndParseImportedJson(text);
    if (result.type === 'unknown') {
      setImportStatus({
        type: 'error',
        message: result.error || 'The uploaded file does not conform to preset definitions.'
      });
    } else {
      setImportStatus({
        type: 'success',
        message: `Validated ${result.type.toUpperCase()} template file!`,
        parsedData: { type: result.type, payload: result.payload }
      });
    }
  };

  const handleFileUploadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      processImportedText(text);
    };
    reader.readAsText(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      processImportedText(text);
    };
    reader.readAsText(file);
  };

  // Apply parsed data directly to app state OR save to library
  const handleApplyImportedData = () => {
    if (!importStatus.parsedData) return;
    const { type, payload } = importStatus.parsedData;

    if (type === 'song') {
      onLoadSong(payload as SongPreset);
      triggerNotification(`Imported & applied active song project: "${payload.name}"`);
    } else if (type === 'sound') {
      onLoadSound(payload as SoundPreset);
      triggerNotification(`Imported & applied sound preset: "${payload.name}"`);
    } else if (type === 'track') {
      const preset = payload as TrackPreset;
      onLoadTrack(preset.trackName, preset.steps, preset.pitches, preset.noteLengths, preset.soundPreset);
      triggerNotification(`Imported & applied pattern to track ${preset.trackName}: "${preset.name}"`);
    }
    
    // Reset status
    setImportStatus({ type: null, message: '' });
  };

  const handleAddImportedToLibrary = () => {
    if (!importStatus.parsedData) return;
    const { type, payload } = importStatus.parsedData;

    if (type === 'song') {
      const s = payload as SongPreset;
      saveSong(s.name, s.sequencerState, s.bpm, s.soundPreset);
      triggerNotification(`Added song to library: "${s.name}"`);
    } else if (type === 'sound') {
      const snd = payload as SoundPreset;
      saveSound(
        snd.name,
        snd.cutoff,
        snd.resonance,
        snd.distortion,
        snd.sidechainEnabled,
        snd.waveform,
        snd.decay,
        snd.envMod,
        snd.portamento,
        snd.delayFeedback,
        snd.delayMix
      );
      triggerNotification(`Added atomic sound to library: "${snd.name}"`);
    } else if (type === 'track') {
      const p = payload as TrackPreset;
      saveTrack(p.name, p.trackName, p.steps, p.pitches, p.noteLengths, p.soundPreset);
      triggerNotification(`Added track pattern to library: "${p.name}"`);
    }

    refreshLibrary();
    setImportStatus({ type: null, message: '' });
  };

  return (
    <div id="library-controls-card" className="bg-[#161622] border-2 border-neutral-800 p-5 rounded flex flex-col gap-6 relative">
      
      {/* NOTIFICATION FLOATING BADGE */}
      {successAction && (
        <div className="absolute top-4 right-4 z-50 bg-[#00FFCC] text-neutral-950 font-mono text-[10px] uppercase font-bold px-3 py-1 border border-[#00FFCC] animate-bounce flex items-center gap-1.5">
          <Check className="w-3.5 h-3.5 stroke-[3px]" />
          {successAction}
        </div>
      )}

      {/* HEADER BAR */}
      <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
        <div className="flex items-center gap-2">
          <FolderHeart className="w-5 h-5 text-[#00FFCC]" />
          <h3 className="font-sans font-bold text-sm text-white tracking-wide uppercase">
            TechnoForge Song & Preset Library
          </h3>
        </div>
        <span className="text-[10px] font-mono text-neutral-500 bg-[#0F0F15] px-2 py-0.5 border border-neutral-900">
          DATA MANAGEMENT TERMINAL
        </span>
      </div>

      {/* THREE COLUMN GRID: SONGS, ATOMIC SOUNDS, AND PATTERNS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* COLUMN 1: SONGS (Full Projects) */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-200 border-b border-neutral-900 pb-1.5">
            <Music className="w-4 h-4 text-[#FF00AA]" />
            1. SONG LIBRARY
          </div>

          {/* Save Song Form */}
          <form onSubmit={handleSaveSong} className="flex gap-2">
            <input
              type="text"
              required
              placeholder="New Song Name..."
              value={songInputName}
              onChange={(e) => setSongInputName(e.target.value)}
              className="flex-1 bg-neutral-950 border border-neutral-800 text-xs px-2.5 py-1.5 focus:border-[#FF00AA] focus:outline-none font-mono text-white placeholder-neutral-600 rounded-none"
            />
            <button
              type="submit"
              className="bg-neutral-900 border border-neutral-800 hover:border-[#FF00AA] hover:bg-[#FF00AA]/10 hover:text-white px-3 text-xs font-mono uppercase transition-all duration-150 cursor-pointer flex items-center gap-1 text-neutral-400"
            >
              <Save className="w-3.5 h-3.5 text-[#FF00AA]" />
              Save
            </button>
          </form>

          {/* Songs List */}
          <div className="bg-neutral-950/80 border border-neutral-900 max-h-[160px] overflow-y-auto p-1.5 flex flex-col gap-1.5 min-h-[120px]">
            {songs.length === 0 ? (
              <span className="text-[10px] text-neutral-600 font-mono p-4 text-center block">
                No songs stored locally.
              </span>
            ) : (
              songs.map((song) => (
                <div key={song.id} className="flex items-center justify-between bg-[#11111a] border border-neutral-900 p-2 hover:border-[#FF00AA]/40 transition-all">
                  <div className="flex flex-col min-w-0 pr-2">
                    <span className="text-xs font-medium text-neutral-200 truncate font-sans">{song.name}</span>
                    <span className="text-[9px] text-neutral-500 font-mono mt-0.5">
                      BPM: {song.bpm} • {new Date(song.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleLoadSong(song)}
                      className="bg-neutral-900 border border-neutral-800 hover:border-[#00FFCC] text-[10px] px-2 py-0.5 text-neutral-400 hover:text-[#00FFCC] uppercase font-mono cursor-pointer transition-colors"
                    >
                      Load
                    </button>
                    <button
                      onClick={() => handleExportSong(song)}
                      title="Export file"
                      className="p-1 border border-neutral-900 hover:border-blue-500 text-neutral-600 hover:text-blue-400 bg-neutral-950 cursor-pointer transition-colors"
                    >
                      <Download className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleDeleteSong(song.id, song.name)}
                      title="Delete"
                      className="p-1 border border-neutral-900 hover:border-red-500 text-neutral-600 hover:text-red-400 bg-neutral-950 cursor-pointer transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* COLUMN 2: ATOMIC SOUNDS (Synth Sound Models) */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-200 border-b border-neutral-900 pb-1.5">
            <Volume2 className="w-4 h-4 text-[#00FFCC]" />
            2. SOUNDS LIBRARY
          </div>

          {/* Save Sound Form */}
          <form onSubmit={handleSaveSound} className="flex gap-2">
            <input
              type="text"
              required
              placeholder="Sound Preset Name..."
              value={soundInputName}
              onChange={(e) => setSoundInputName(e.target.value)}
              className="flex-1 bg-neutral-950 border border-neutral-800 text-xs px-2.5 py-1.5 focus:border-[#00FFCC] focus:outline-none font-mono text-white placeholder-neutral-600 rounded-none"
            />
            <button
              type="submit"
              className="bg-neutral-900 border border-neutral-800 hover:border-[#00FFCC] hover:bg-[#00FFCC]/10 hover:text-white px-3 text-xs font-mono uppercase transition-all duration-150 cursor-pointer flex items-center gap-1 text-neutral-400"
            >
              <Save className="w-3.5 h-3.5 text-[#00FFCC]" />
              Save
            </button>
          </form>

          {/* Sounds list */}
          <div className="bg-neutral-950/80 border border-neutral-900 max-h-[160px] overflow-y-auto p-1.5 flex flex-col gap-1.5 min-h-[120px]">
            {sounds.length === 0 ? (
              <span className="text-[10px] text-neutral-600 font-mono p-4 text-center block">
                No sound presets stored locally.
              </span>
            ) : (
              sounds.map((sound) => (
                <div key={sound.id} className="flex items-center justify-between bg-[#11111a] border border-neutral-900 p-2 hover:border-[#00FFCC]/40 transition-all">
                  <div className="flex flex-col min-w-0 pr-2">
                    <span className="text-xs font-medium text-neutral-200 truncate font-sans">{sound.name}</span>
                    <span className="text-[9px] text-neutral-500 font-mono mt-0.5">
                      Cutoff: {sound.cutoff}Hz • Res: {sound.resonance} • Dist: {Math.round(sound.distortion * 100)}%
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleLoadSound(sound)}
                      className="bg-neutral-900 border border-neutral-800 hover:border-[#00FFCC] text-[10px] px-2 py-0.5 text-neutral-400 hover:text-[#00FFCC] uppercase font-mono cursor-pointer transition-colors"
                    >
                      Load
                    </button>
                    <button
                      onClick={() => handleExportSound(sound)}
                      title="Export file"
                      className="p-1 border border-neutral-900 hover:border-blue-500 text-neutral-600 hover:text-blue-400 bg-neutral-950 cursor-pointer transition-colors"
                    >
                      <Download className="w-3 h-3" />
                    </button>
                    {/* Only allow deleting if it's not a standard read-only preset key */}
                    {!sound.id.startsWith('default-') ? (
                      <button
                        onClick={() => handleDeleteSound(sound.id, sound.name)}
                        title="Delete"
                        className="p-1 border border-neutral-900 hover:border-red-500 text-neutral-600 hover:text-red-400 bg-neutral-950 cursor-pointer transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    ) : (
                      <span className="p-1 border border-transparent text-neutral-700 bg-transparent text-[9px] font-mono select-none">
                        DEF
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* COLUMN 3: TRACK PATTERNS */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-200 border-b border-neutral-900 pb-1.5">
            <Layers className="w-4 h-4 text-orange-400" />
            3. PATTERN LIBRARY
          </div>

          {/* Save Pattern Form */}
          <form onSubmit={handleSaveTrack} className="flex flex-col sm:flex-row gap-2">
            <select
              value={selectedTrackToSave}
              onChange={(e) => setSelectedTrackToSave(e.target.value as TrackType)}
              className="bg-neutral-950 border border-neutral-800 text-[10px] text-neutral-300 font-mono px-2 py-1.5 focus:border-orange-400 focus:outline-none focus:text-white rounded-none cursor-pointer shrink-0"
            >
              {currentSequencerState.tracks.map((track) => (
                <option key={track.name} value={track.name}>
                  {track.name}
                </option>
              ))}
            </select>
            <div className="flex flex-1 gap-2">
              <input
                type="text"
                required
                placeholder="Pattern Name..."
                value={trackInputName}
                onChange={(e) => setTrackInputName(e.target.value)}
                className="flex-1 bg-neutral-950 border border-neutral-800 text-xs px-2.5 py-1.5 focus:border-orange-400 focus:outline-none font-mono text-white placeholder-neutral-600 rounded-none"
              />
              <button
                type="submit"
                className="bg-neutral-900 border border-neutral-800 hover:border-orange-400 hover:bg-orange-400/10 hover:text-white px-3 text-xs font-mono uppercase transition-all duration-150 cursor-pointer flex items-center gap-1 text-neutral-400"
              >
                <Save className="w-3.5 h-3.5 text-orange-400" />
                Save
              </button>
            </div>
          </form>

          {/* Tracks list */}
          <div className="bg-neutral-950/80 border border-neutral-900 max-h-[160px] overflow-y-auto p-1.5 flex flex-col gap-1.5 min-h-[120px]">
            {tracks.length === 0 ? (
              <span className="text-[10px] text-neutral-600 font-mono p-4 text-center block">
                No track patterns stored locally.
              </span>
            ) : (
              tracks.map((track) => (
                <div key={track.id} className="flex items-center justify-between bg-[#11111a] border border-neutral-900 p-2 hover:border-orange-400/40 transition-all">
                  <div className="flex flex-col min-w-0 pr-2">
                    <span className="text-xs font-medium text-neutral-200 truncate font-sans">{track.name}</span>
                    <span className="text-[9px] text-neutral-500 font-mono mt-0.5">
                      Type: <span className="text-orange-400">{track.trackName}</span> • {new Date(track.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleLoadTrackPattern(track)}
                      className="bg-neutral-900 border border-neutral-800 hover:border-orange-400 text-[10px] px-2 py-0.5 text-neutral-400 hover:text-orange-400 uppercase font-mono cursor-pointer transition-colors"
                    >
                      Load
                    </button>
                    <button
                      onClick={() => handleExportTrack(track)}
                      title="Export file"
                      className="p-1 border border-neutral-900 hover:border-blue-500 text-neutral-600 hover:text-blue-400 bg-neutral-950 cursor-pointer transition-colors"
                    >
                      <Download className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleDeleteTrackPattern(track.id, track.name)}
                      title="Delete"
                      className="p-1 border border-neutral-900 hover:border-red-500 text-neutral-600 hover:text-red-400 bg-neutral-950 cursor-pointer transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* DRAG-AND-DROP FILE IMPORT SECTOR */}
      <div className="border-t border-neutral-800/80 pt-4 flex flex-col gap-3">
        <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-200">
          <Upload className="w-4 h-4 text-sky-400" />
          FILE IMPORT & DRAG-AND-DROP INTAKE ZONE
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Dropzone field */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded p-5 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${
              isDragging 
                ? 'border-[#00FFCC] bg-[#00FFCC]/5' 
                : 'border-neutral-800 bg-[#0F0F15] hover:border-neutral-700 hover:bg-neutral-950/40'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              accept=".json"
              onChange={handleFileUploadChange}
              className="hidden"
            />
            <FileJson className="w-7 h-7 text-neutral-500" />
            <span className="text-xs text-neutral-300 font-medium">
              Drag & Drop Preset JSON here or <span className="text-[#00FFCC] underline">browse file</span>
            </span>
            <span className="text-[10px] text-neutral-600 font-mono">
              Supports: .json Song, Sound Preset, or Pattern
            </span>
          </div>

          {/* Import Processing Visual Control Box */}
          <div className="bg-[#0F0F15] border border-neutral-900 p-4 flex flex-col justify-between min-h-[110px]">
            {importStatus.type === null ? (
              <div className="flex flex-col items-center justify-center text-center py-4 h-full">
                <FileText className="w-5 h-5 text-neutral-700 mb-1" />
                <span className="text-[11px] text-neutral-500 font-mono uppercase tracking-wider">
                  No imported data loaded yet
                </span>
              </div>
            ) : importStatus.type === 'error' ? (
              <div className="flex flex-col gap-3 h-full justify-between">
                <div className="flex gap-2 text-red-400 items-start">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold font-sans">Import Failure</span>
                    <span className="text-[10px] font-mono leading-relaxed mt-0.5 text-red-200">
                      {importStatus.message}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setImportStatus({ type: null, message: '' })}
                  className="w-full bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700 text-[10px] uppercase font-mono py-1 cursor-pointer"
                >
                  Clear Log
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3 h-full justify-between">
                <div className="flex gap-2 text-[#00FFCC] items-start">
                  <Check className="w-4 h-4 shrink-0 mt-0.5 stroke-[3px]" />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold font-sans">Validation Successful</span>
                    <span className="text-[10px] font-mono mt-0.5 text-neutral-300 leading-relaxed">
                      {importStatus.message} Type detected: <strong className="text-white bg-neutral-900 px-1">{importStatus.parsedData?.type.toUpperCase()}</strong>
                    </span>
                    <span className="text-[11px] text-[#00FFCC] font-bold mt-1 block truncate">
                      "{importStatus.parsedData?.payload.name}"
                    </span>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={handleApplyImportedData}
                    className="flex-1 bg-neutral-900 border border-[#00FFCC] text-[#00FFCC] hover:bg-[#00FFCC]/10 text-[10px] py-1.5 uppercase font-mono font-bold tracking-wider cursor-pointer"
                  >
                    Apply Preset Now
                  </button>
                  <button
                    onClick={handleAddImportedToLibrary}
                    className="flex-1 bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white hover:border-neutral-700 text-[10px] py-1.5 uppercase font-mono cursor-pointer"
                  >
                    Save to Library
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
