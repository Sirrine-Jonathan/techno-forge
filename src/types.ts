export type TrackType = 'Kick' | 'HiHat' | 'Clap' | 'AcidSynth';

export interface GridTrack {
  name: TrackType;
  steps: boolean[];
}

export interface SequencerState {
  tracks: GridTrack[];
  pitches: string[]; // Parallel pitch array for AcidSynth steps, length 16
}

export interface DSPAnalysisResult {
  tracks: {
    Kick: boolean[];
    HiHat: boolean[];
    Clap: boolean[];
    AcidSynth: boolean[];
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
}

export interface TrackPreset {
  id: string;
  name: string;
  trackName: TrackType;
  steps: boolean[];
  pitches?: string[]; // Only for AcidSynth
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

