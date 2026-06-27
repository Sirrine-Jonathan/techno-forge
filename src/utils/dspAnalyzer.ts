import { DSPAnalysisResult } from '../types';

/**
 * Analyze an AudioBuffer of vocal recording (up to 30 seconds) and extract:
 * 1. Drum onsets (Kick, HiHat, Clap)
 * 2. Humming pitches (mapped to AcidSynth)
 *
 * @param audioBuffer The recorded mono vocal channel buffer
 * @param bpm The current BPM of the sequencer
 * @returns A structured matrix of active steps and corresponding AcidSynth pitches
 */
export function analyzeVocalAudio(audioBuffer: AudioBuffer, bpm: number): DSPAnalysisResult {
  const sampleRate = audioBuffer.sampleRate;
  const channelData = audioBuffer.getChannelData(0);
  const totalSamples = channelData.length;

  // Initialize empty grid matrices
  const kickSteps = new Array(16).fill(false);
  const hiHatSteps = new Array(16).fill(false);
  const clapSteps = new Array(16).fill(false);
  const acidSteps = new Array(16).fill(false);
  const acidPitches = new Array(16).fill('C2');

  // Math config
  const stepDuration = (60 / bpm) / 4; // 16th note duration in seconds
  const blockSize = 512;
  const hopSize = 256; // 50% overlap

  // 1. Calculate RMS energy for each overlapping block
  const blockCount = Math.floor((totalSamples - blockSize) / hopSize);
  const rmsValues: number[] = [];

  for (let b = 0; b < blockCount; b++) {
    const startIdx = b * hopSize;
    let sumSquares = 0;
    for (let i = 0; i < blockSize; i++) {
      const val = channelData[startIdx + i];
      sumSquares += val * val;
    }
    rmsValues.push(Math.sqrt(sumSquares / blockSize));
  }

  // 2. Onset Detection & Classification Loop
  let lastOnsetBlock = -10; // Prevent overlapping triggers (refractory period)
  
  for (let b = 4; b < blockCount - 1; b++) {
    const rms = rmsValues[b];
    
    // Ignore complete silence
    if (rms < 0.015) continue;

    // Check if current block energy is a local peak and rises rapidly compared to the preceding average
    const prevAvg = (rmsValues[b - 4] + rmsValues[b - 3] + rmsValues[b - 2] + rmsValues[b - 1]) / 4;
    
    if (rms > prevAvg * 1.75 && rms > rmsValues[b + 1] && (b - lastOnsetBlock) > 5) {
      lastOnsetBlock = b;

      // We have found an onset! Get the time of this onset in seconds
      const onsetTime = (b * hopSize) / sampleRate;
      const targetStep = Math.round(onsetTime / stepDuration) % 16;

      // Extract the 512 samples for spectral analysis
      const startIdx = b * hopSize;
      const blockSamples = channelData.slice(startIdx, startIdx + blockSize);

      // --- ZERO CROSSING RATE (ZCR) ---
      let crossings = 0;
      for (let i = 1; i < blockSize; i++) {
        if ((blockSamples[i] >= 0 && blockSamples[i - 1] < 0) || (blockSamples[i] < 0 && blockSamples[i - 1] >= 0)) {
          crossings++;
        }
      }
      const zcr = crossings / blockSize;

      // --- TIME-DOMAIN AUTOCORRELATION FOR HUMMING ---
      // Search lags corresponding to vocal range: 60Hz to 350Hz
      const minLag = Math.max(12, Math.floor(sampleRate / 350));
      const maxLag = Math.min(blockSize - 1, Math.ceil(sampleRate / 60));
      
      let maxCorrelation = -1;
      let bestLag = -1;

      for (let lag = minLag; lag <= maxLag; lag++) {
        let sumXY = 0;
        let sumXX = 0;
        let sumYY = 0;
        
        // Compute over a window of 256 samples
        const windowSize = 256;
        for (let i = 0; i < windowSize; i++) {
          const x = blockSamples[i];
          const y = blockSamples[i + lag];
          sumXY += x * y;
          sumXX += x * x;
          sumYY += y * y;
        }

        const rNorm = sumXX > 0 && sumYY > 0 ? sumXY / Math.sqrt(sumXX * sumYY) : 0;
        if (rNorm > maxCorrelation) {
          maxCorrelation = rNorm;
          bestLag = lag;
        }
      }

      // --- ONSET CLASSIFICATION DECISION TREE ---
      if (zcr > 0.28) {
        // High-frequency dominant -> HiHat
        hiHatSteps[targetStep] = true;
      } else if (zcr > 0.13) {
        // Mid-frequency noisy -> Clap
        clapSteps[targetStep] = true;
      } else if (maxCorrelation > 0.45 && bestLag > 0) {
        // Tonal and periodic -> Vocal humming! Map to AcidSynth
        const f0 = sampleRate / bestLag;
        
        // Filter out artifacts outside 60Hz - 350Hz
        if (f0 >= 60 && f0 <= 350) {
          const midi = Math.round(69 + 12 * Math.log2(f0 / 440));
          
          // Clamp to warm, resonant acid bass register (C1 to C3 / MIDI 24 to 48)
          let acidMidi = midi;
          while (acidMidi > 48) acidMidi -= 12;
          while (acidMidi < 24) acidMidi += 12;
          
          // Convert MIDI to note string representation
          const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
          const noteName = notes[acidMidi % 12];
          const octave = Math.floor(acidMidi / 12) - 1;
          const noteString = `${noteName}${octave}`;
          
          acidSteps[targetStep] = true;
          acidPitches[targetStep] = noteString;
        } else {
          // If the frequency calculation leaks, classify as Kick
          kickSteps[targetStep] = true;
        }
      } else {
        // Low-frequency non-periodic noise -> Kick drum
        kickSteps[targetStep] = true;
      }
    }
  }

  return {
    tracks: {
      Kick: kickSteps,
      HiHat: hiHatSteps,
      Clap: clapSteps,
      AcidSynth: acidSteps,
    },
    pitches: acidPitches,
  };
}
