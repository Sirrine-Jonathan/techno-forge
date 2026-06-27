// @ts-ignore
import { INoteSequence } from '@magenta/music/es6/core';
// @ts-ignore
import { MusicRNN } from '@magenta/music/es6/music_rnn';

// MIDI note conversions
const NOTES_SCALE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function noteToMidi(noteName: string): number {
  const match = noteName.match(/^([A-G]#?)(\d+)$/);
  if (!match) return 36; // Default to C2
  const name = match[1];
  const octave = parseInt(match[2], 10);
  const semitones = NOTES_SCALE.indexOf(name);
  return (octave + 1) * 12 + semitones;
}

export function midiToNote(midi: number): string {
  const noteName = NOTES_SCALE[midi % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${noteName}${octave}`;
}

// Checkpoint URLs for Magenta.js
const MELODY_CHECKPOINT = 'https://storage.googleapis.com/magentadata/js/checkpoints/music_rnn/melody_rnn';
const DRUMS_CHECKPOINT = 'https://storage.googleapis.com/magentadata/js/checkpoints/music_rnn/drum_kit_rnn';

let melodyModel: MusicRNN | null = null;
let drumsModel: MusicRNN | null = null;

export interface ModelsLoadingState {
  melodyLoaded: boolean;
  drumsLoaded: boolean;
  loading: boolean;
  error: string | null;
}

/**
 * Initializes and loads the Magenta MusicRNN checkpoint models in the browser
 */
export async function loadMagentaModels(
  onProgress: (state: ModelsLoadingState) => void
): Promise<void> {
  const state: ModelsLoadingState = {
    melodyLoaded: false,
    drumsLoaded: false,
    loading: true,
    error: null,
  };
  onProgress(state);

  try {
    // 1. Load Melody Model
    melodyModel = new MusicRNN(MELODY_CHECKPOINT);
    await melodyModel.initialize();
    state.melodyLoaded = true;
    onProgress({ ...state });

    // 2. Load Drums Model
    drumsModel = new MusicRNN(DRUMS_CHECKPOINT);
    await drumsModel.initialize();
    state.drumsLoaded = true;
    state.loading = false;
    onProgress({ ...state });
  } catch (err: any) {
    console.warn('Magenta loading failed or was blocked. Falling back to local high-fidelity AI mutators.', err);
    state.loading = false;
    state.error = err.message || 'Network blocked or models unavailable';
    onProgress({ ...state });
  }
}

/**
 * FALLBACK ALGORITHMIC TECHNO MUTATOR (AI-like local generator)
 * Performs classic TB-303 acid house style transposition, slide, syncopation and offbeat drum injections.
 */
export function mutateSequenceAlgorithmic(
  trackName: 'Kick' | 'HiHat' | 'Clap' | 'AcidSynth',
  steps: boolean[],
  pitches?: string[]
): { steps: boolean[]; pitches?: string[] } {
  const mutatedSteps = [...steps];
  const mutatedPitches = pitches ? [...pitches] : undefined;

  // Let's seed some notes if the grid is completely blank to make it interactive!
  const activeCount = steps.filter(Boolean).length;
  if (activeCount === 0) {
    if (trackName === 'Kick') {
      [0, 4, 8, 12].forEach(i => { mutatedSteps[i] = true; });
    } else if (trackName === 'HiHat') {
      [2, 6, 10, 14].forEach(i => { mutatedSteps[i] = true; });
    } else if (trackName === 'Clap') {
      [4, 12].forEach(i => { mutatedSteps[i] = true; });
    } else if (trackName === 'AcidSynth' && mutatedPitches) {
      [0, 3, 7, 10, 12].forEach((idx, i) => {
        mutatedSteps[idx] = true;
        mutatedPitches[idx] = i % 2 === 0 ? 'C2' : 'G2';
      });
    }
    return { steps: mutatedSteps, pitches: mutatedPitches };
  }

  // Algorithmic mutations based on voice type
  if (trackName === 'AcidSynth' && mutatedPitches) {
    for (let i = 0; i < 16; i++) {
      const rand = Math.random();
      if (mutatedSteps[i]) {
        if (rand < 0.15) {
          // De-active step (thin out pattern)
          mutatedSteps[i] = false;
        } else if (rand < 0.35) {
          // Transpose pitch up/down a perfect fifth (7 semitones) or perfect fourth (5 semitones) or octave
          const currentMidi = noteToMidi(mutatedPitches[i]);
          const shift = Math.random() > 0.5 ? 7 : -5;
          let newMidi = currentMidi + shift;
          // Clamp inside resonant acid register
          while (newMidi > 48) newMidi -= 12;
          while (newMidi < 24) newMidi += 12;
          mutatedPitches[i] = midiToNote(newMidi);
        } else if (rand < 0.50) {
          // Slide note to the next step
          const nextIdx = (i + 1) % 16;
          mutatedSteps[nextIdx] = true;
          mutatedPitches[nextIdx] = mutatedPitches[i];
        }
      } else {
        if (rand < 0.1) {
          // Insert a syncopated acid step!
          mutatedSteps[i] = true;
          // Inherit pitch from neighbor or use standard C2/D#2/G2
          const prevPitch = mutatedPitches[(i - 1 + 16) % 16] || 'C2';
          const midi = noteToMidi(prevPitch);
          const variations = [0, 3, 7, 12]; // Minor pentatonic intervals
          const interval = variations[Math.floor(Math.random() * variations.length)];
          let newMidi = midi + interval;
          while (newMidi > 48) newMidi -= 12;
          while (newMidi < 24) newMidi += 12;
          mutatedPitches[i] = midiToNote(newMidi);
        }
      }
    }
  } else if (trackName === 'Kick') {
    // Kick drum mutations: maintain heavy downbeats but inject occasional double kicks/ghost kicks
    for (let i = 0; i < 16; i++) {
      if (i % 4 === 0) {
        mutatedSteps[i] = true; // Protect core techno downbeat
      } else {
        const rand = Math.random();
        if (mutatedSteps[i] && rand < 0.25) {
          mutatedSteps[i] = false; // Mute offbeat kick
        } else if (!mutatedSteps[i] && rand < 0.12) {
          mutatedSteps[i] = true; // Add double-kick (e.g. index 14 or 15)
        }
      }
    }
  } else if (trackName === 'HiHat') {
    // HiHat mutations: inject high-speed offbeats or dynamic rolls
    for (let i = 0; i < 16; i++) {
      if (i % 4 === 2) {
        if (Math.random() < 0.9) mutatedSteps[i] = true; // Standard techno offbeat open-hat
      } else {
        const rand = Math.random();
        if (mutatedSteps[i] && rand < 0.3) {
          mutatedSteps[i] = false;
        } else if (!mutatedSteps[i] && rand < 0.15) {
          mutatedSteps[i] = true; // Add 16th note sizzle hihat
        }
      }
    }
  } else if (trackName === 'Clap') {
    // Clap mutations: classic backbeats on steps 4 and 12 (indices 4, 12) with occasional pre-clap or delay
    for (let i = 0; i < 16; i++) {
      if (i === 4 || i === 12) {
        if (Math.random() < 0.85) mutatedSteps[i] = true;
      } else {
        const rand = Math.random();
        if (mutatedSteps[i] && rand < 0.4) {
          mutatedSteps[i] = false;
        } else if (!mutatedSteps[i] && rand < 0.08) {
          mutatedSteps[i] = true; // Add syncopated pre-clap
        }
      }
    }
  }

  return { steps: mutatedSteps, pitches: mutatedPitches };
}

/**
 * Evolves the AcidSynth melody sequence using client-side Magenta MusicRNN.
 * Falls back automatically to the local TB-303 mutator if models aren't ready.
 */
export async function evolveMelodyWithMagenta(
  steps: boolean[],
  pitches: string[],
  temperature: number = 1.15
): Promise<{ steps: boolean[]; pitches: string[] }> {
  if (!melodyModel) {
    console.log('Melody model not initialized yet. Using local Techno Mutator.');
    const mutation = mutateSequenceAlgorithmic('AcidSynth', steps, pitches);
    return { steps: mutation.steps, pitches: mutation.pitches! };
  }

  try {
    // 1. Serialize active steps into a Magenta NoteSequence
    const notesArray: any[] = [];
    for (let i = 0; i < 16; i++) {
      if (steps[i]) {
        const midi = noteToMidi(pitches[i]);
        notesArray.push({
          pitch: midi,
          quantizedStartStep: i,
          quantizedEndStep: i + 1,
        });
      }
    }

    // Seed if empty
    if (notesArray.length === 0) {
      notesArray.push({ pitch: 36, quantizedStartStep: 0, quantizedEndStep: 1 });
    }

    const inputSeq: INoteSequence = {
      notes: notesArray,
      quantizationInfo: { stepsPerQuarter: 4 },
      totalQuantizedSteps: 16,
    };

    // 2. Query MusicRNN to continue sequence
    // We continue the sequence for 16 steps (step indices 16 to 31)
    const outputSeq = await melodyModel.continueSequence(inputSeq, 16, temperature);

    // 3. Deserialize prediction back into our 16-step grid (mapping steps 16-31 to 0-15)
    const newSteps = new Array(16).fill(false);
    const newPitches = [...pitches];

    if (outputSeq && outputSeq.notes) {
      for (const note of outputSeq.notes) {
        const step = (note.quantizedStartStep || 0) - 16;
        if (step >= 0 && step < 16) {
          newSteps[step] = true;
          newPitches[step] = midiToNote(note.pitch || 36);
        }
      }
    }

    // If prediction came back empty, fall back to algorithm so user always gets a pattern
    if (newSteps.filter(Boolean).length === 0) {
      return { steps: mutateSequenceAlgorithmic('AcidSynth', steps, pitches).steps, pitches };
    }

    return { steps: newSteps, pitches: newPitches };
  } catch (err) {
    console.error('Magenta melody prediction error, falling back to local mutator:', err);
    const mutation = mutateSequenceAlgorithmic('AcidSynth', steps, pitches);
    return { steps: mutation.steps, pitches: mutation.pitches! };
  }
}

/**
 * Evolves the drum track patterns collectively using Magenta MusicRNN drum model.
 * Falls back to local algorithmic syncopation if not loaded.
 */
export async function evolveDrumsWithMagenta(
  kick: boolean[],
  hihat: boolean[],
  clap: boolean[],
  temperature: number = 1.15
): Promise<{ kick: boolean[]; hihat: boolean[]; clap: boolean[] }> {
  if (!drumsModel) {
    console.log('Drums model not initialized yet. Using local drum mutators.');
    const mutatedKick = mutateSequenceAlgorithmic('Kick', kick).steps;
    const mutatedHiHat = mutateSequenceAlgorithmic('HiHat', hihat).steps;
    const mutatedClap = mutateSequenceAlgorithmic('Clap', clap).steps;
    return { kick: mutatedKick, hihat: mutatedHiHat, clap: mutatedClap };
  }

  try {
    const notesArray: any[] = [];
    // Map drums to standard GM drum pitches
    // Kick = 36, HiHat = 42, Clap = 39
    for (let i = 0; i < 16; i++) {
      if (kick[i]) {
        notesArray.push({ pitch: 36, quantizedStartStep: i, quantizedEndStep: i + 1, isDrum: true });
      }
      if (hihat[i]) {
        notesArray.push({ pitch: 42, quantizedStartStep: i, quantizedEndStep: i + 1, isDrum: true });
      }
      if (clap[i]) {
        notesArray.push({ pitch: 39, quantizedStartStep: i, quantizedEndStep: i + 1, isDrum: true });
      }
    }

    // Seed empty sequence
    if (notesArray.length === 0) {
      notesArray.push({ pitch: 36, quantizedStartStep: 0, quantizedEndStep: 1, isDrum: true });
      notesArray.push({ pitch: 42, quantizedStartStep: 2, quantizedEndStep: 3, isDrum: true });
    }

    const inputSeq: INoteSequence = {
      notes: notesArray,
      quantizationInfo: { stepsPerQuarter: 4 },
      totalQuantizedSteps: 16,
    };

    const outputSeq = await drumsModel.continueSequence(inputSeq, 16, temperature);

    const newKick = new Array(16).fill(false);
    const newHiHat = new Array(16).fill(false);
    const newClap = new Array(16).fill(false);

    if (outputSeq && outputSeq.notes) {
      for (const note of outputSeq.notes) {
        const step = (note.quantizedStartStep || 0) - 16;
        if (step >= 0 && step < 16) {
          const pitch = note.pitch || 36;
          // Classify drum notes based on typical general MIDI mappings
          // Kick: 35, 36
          // Snare/Clap: 38, 39, 40
          // Hats: 42, 44, 46
          if (pitch === 36 || pitch === 35) {
            newKick[step] = true;
          } else if (pitch === 42 || pitch === 44 || pitch === 46) {
            newHiHat[step] = true;
          } else {
            // Treat snare/claps/others as Claps
            newClap[step] = true;
          }
        }
      }
    }

    // Safeguard empty result
    if (newKick.filter(Boolean).length === 0 && newHiHat.filter(Boolean).length === 0) {
      return {
        kick: mutateSequenceAlgorithmic('Kick', kick).steps,
        hihat: mutateSequenceAlgorithmic('HiHat', hihat).steps,
        clap: mutateSequenceAlgorithmic('Clap', clap).steps,
      };
    }

    return { kick: newKick, hihat: newHiHat, clap: newClap };
  } catch (err) {
    console.error('Magenta drums prediction error, falling back to local mutators:', err);
    return {
      kick: mutateSequenceAlgorithmic('Kick', kick).steps,
      hihat: mutateSequenceAlgorithmic('HiHat', hihat).steps,
      clap: mutateSequenceAlgorithmic('Clap', clap).steps,
    };
  }
}
