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
