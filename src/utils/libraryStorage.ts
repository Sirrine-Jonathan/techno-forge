import { SoundPreset, TrackPreset, SongPreset, SequencerState, TrackType } from '../types';

const STORAGE_KEYS = {
  SONGS: 'technoforge_songs',
  SOUNDS: 'technoforge_sounds',
  TRACKS: 'technoforge_tracks',
};

// --- DEFAULT SOUND PRESETS TO SEED THE LIBRARY ---
export const DEFAULT_SOUNDS: SoundPreset[] = [
  {
    id: 'default-squelch',
    name: 'Classic Squelch',
    cutoff: 850,
    resonance: 8.5,
    distortion: 0.35,
    sidechainEnabled: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'default-deep-bass',
    name: 'Deep Sub-Oscillator',
    cutoff: 350,
    resonance: 3.0,
    distortion: 0.50,
    sidechainEnabled: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'default-acid-screamer',
    name: 'Acid Screamer',
    cutoff: 1800,
    resonance: 10.5,
    distortion: 0.85,
    sidechainEnabled: true,
    createdAt: new Date().toISOString(),
  },
];

// --- SONGS STORAGE ---
export function getSavedSongs(): SongPreset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SONGS);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Error reading saved songs:', e);
    return [];
  }
}

export function saveSong(name: string, sequencerState: SequencerState, bpm: number, soundPreset: Omit<SoundPreset, 'id' | 'createdAt'>): SongPreset {
  const songs = getSavedSongs();
  const newSong: SongPreset = {
    id: `song-${Date.now()}`,
    name: name.trim() || `Unnamed Song #${songs.length + 1}`,
    sequencerState,
    bpm,
    soundPreset,
    createdAt: new Date().toISOString(),
  };
  songs.push(newSong);
  localStorage.setItem(STORAGE_KEYS.SONGS, JSON.stringify(songs));
  return newSong;
}

export function deleteSong(id: string): SongPreset[] {
  let songs = getSavedSongs();
  songs = songs.filter((s) => s.id !== id);
  localStorage.setItem(STORAGE_KEYS.SONGS, JSON.stringify(songs));
  return songs;
}

// --- SOUNDS STORAGE ---
export function getSavedSounds(): SoundPreset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SOUNDS);
    const parsed = raw ? JSON.parse(raw) : [];
    // If empty, seed with defaults so the user has examples immediately!
    if (parsed.length === 0) {
      localStorage.setItem(STORAGE_KEYS.SOUNDS, JSON.stringify(DEFAULT_SOUNDS));
      return DEFAULT_SOUNDS;
    }
    return parsed;
  } catch (e) {
    console.error('Error reading saved sounds:', e);
    return DEFAULT_SOUNDS;
  }
}

export function saveSound(
  name: string, 
  cutoff: number, 
  resonance: number, 
  distortion: number, 
  sidechainEnabled: boolean,
  waveform?: 'sawtooth' | 'square',
  decay?: number,
  envMod?: number,
  portamento?: number,
  delayFeedback?: number,
  delayMix?: number
): SoundPreset {
  const sounds = getSavedSounds();
  const newSound: SoundPreset = {
    id: `sound-${Date.now()}`,
    name: name.trim() || `Custom Preset #${sounds.length + 1}`,
    cutoff,
    resonance,
    distortion,
    sidechainEnabled,
    waveform,
    decay,
    envMod,
    portamento,
    delayFeedback,
    delayMix,
    createdAt: new Date().toISOString(),
  };
  sounds.push(newSound);
  localStorage.setItem(STORAGE_KEYS.SOUNDS, JSON.stringify(sounds));
  return newSound;
}

export function deleteSound(id: string): SoundPreset[] {
  let sounds = getSavedSounds();
  sounds = sounds.filter((s) => s.id !== id);
  localStorage.setItem(STORAGE_KEYS.SOUNDS, JSON.stringify(sounds));
  return sounds;
}

// --- TRACK PATTERNS STORAGE ---
export function getSavedTracks(): TrackPreset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TRACKS);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Error reading saved tracks:', e);
    return [];
  }
}

export function saveTrack(
  name: string, 
  trackName: TrackType, 
  steps: boolean[], 
  pitches?: string[],
  noteLengths?: number[],
  soundPreset?: Omit<SoundPreset, 'id' | 'createdAt'>
): TrackPreset {
  const tracks = getSavedTracks();
  const newTrack: TrackPreset = {
    id: `track-${Date.now()}`,
    name: name.trim() || `${trackName} Loop #${tracks.length + 1}`,
    trackName,
    steps,
    pitches,
    noteLengths,
    soundPreset,
    createdAt: new Date().toISOString(),
  };
  tracks.push(newTrack);
  localStorage.setItem(STORAGE_KEYS.TRACKS, JSON.stringify(tracks));
  return newTrack;
}

export function deleteTrack(id: string): TrackPreset[] {
  let tracks = getSavedTracks();
  tracks = tracks.filter((t) => t.id !== id);
  localStorage.setItem(STORAGE_KEYS.TRACKS, JSON.stringify(tracks));
  return tracks;
}

// --- EXPORT DOWNLOAD TRIGGERS ---
export function exportDataAsJsonFile(data: any, fileName: string) {
  const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
    JSON.stringify(data, null, 2)
  )}`;
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', jsonString);
  downloadAnchor.setAttribute('download', fileName);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

// --- IMPORT PARSING & VALIDATION ENGINE ---
export function validateAndParseImportedJson(jsonText: string): {
  type: 'song' | 'sound' | 'track' | 'unknown';
  payload: any;
  error?: string;
} {
  try {
    const parsed = JSON.parse(jsonText);
    
    // Check if it's a song preset
    if (
      parsed &&
      typeof parsed === 'object' &&
      'sequencerState' in parsed &&
      'bpm' in parsed &&
      'soundPreset' in parsed
    ) {
      // Validate Song structure
      const seq = parsed.sequencerState;
      if (seq && Array.isArray(seq.tracks)) {
        return { type: 'song', payload: parsed };
      }
      return { type: 'unknown', payload: null, error: 'Malformed song sequencer state structure.' };
    }

    // Check if it's a sound preset
    if (
      parsed &&
      typeof parsed === 'object' &&
      'cutoff' in parsed &&
      'resonance' in parsed &&
      'distortion' in parsed &&
      'sidechainEnabled' in parsed &&
      !('sequencerState' in parsed)
    ) {
      return { type: 'sound', payload: parsed };
    }

    // Check if it's a track pattern preset
    if (
      parsed &&
      typeof parsed === 'object' &&
      'trackName' in parsed &&
      Array.isArray(parsed.steps)
    ) {
      return { type: 'track', payload: parsed };
    }

    return { type: 'unknown', payload: null, error: 'JSON does not match Technoforge specifications for Sound, Track, or Song presets.' };
  } catch (e: any) {
    return { type: 'unknown', payload: null, error: `Invalid JSON syntax: ${e.message}` };
  }
}
