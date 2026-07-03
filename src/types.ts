export type TrackType = string;

export interface GridTrack {
  name: TrackType;
  steps: boolean[];
  muted?: boolean;
  pitches?: string[]; // Per-track pitches for synths, length 16
  noteLengths?: number[]; // Per-step duration in 16th-note columns for synth notes
  cutoff?: number;
  resonance?: number;
  distortion?: number;
  sidechainEnabled?: boolean;
  waveform?: 'sawtooth' | 'square';
  decay?: number;
  envMod?: number;
  portamento?: number;
  delayFeedback?: number;
  delayMix?: number;
}

export interface SequencerState {
  tracks: GridTrack[];
  pitches: string[]; // Fallback or global pitch array
}

export interface DSPAnalysisResult {
  tracks: {
    [trackName: string]: boolean[];
  };
  pitches: string[];
}

export interface SoundPreset {
  id: string;
  name: string;
  cutoff: number;
  resonance: number;
  distortion: number;
  sidechainEnabled: boolean;
  createdAt: string;
  waveform?: 'sawtooth' | 'square';
  decay?: number;
  envMod?: number;
  portamento?: number;
  delayFeedback?: number;
  delayMix?: number;
}

export interface TrackPreset {
  id: string;
  name: string;
  trackName: TrackType;
  steps: boolean[];
  pitches?: string[]; // Only for Synth
  noteLengths?: number[]; // Only for Synth
  soundPreset?: Omit<SoundPreset, 'id' | 'createdAt'>;
  createdAt: string;
}

export interface SongPreset {
  id: string;
  name: string;
  sequencerState: SequencerState;
  bpm: number;
  soundPreset: Omit<SoundPreset, 'id' | 'createdAt'>;
  createdAt: string;
}
