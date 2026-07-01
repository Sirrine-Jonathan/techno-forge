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

  // 1. Find peak amplitude to support automatic input gain normalization
  let maxAbsVal = 0.001;
  for (let i = 0; i < totalSamples; i++) {
    const val = Math.abs(channelData[i]);
    if (val > maxAbsVal) maxAbsVal = val;
  }

  // Create normalized channel data for robust thresholding regardless of mic volume
  const normalizedData = new Float32Array(totalSamples);
  if (maxAbsVal > 0.005) {
    for (let i = 0; i < totalSamples; i++) {
      normalizedData[i] = channelData[i] / maxAbsVal;
    }
  } else {
    normalizedData.set(channelData);
  }

  // Calculate RMS energy on normalized data
  const blockCount = Math.floor((totalSamples - blockSize) / hopSize);
  const rmsValues: number[] = [];

  for (let b = 0; b < blockCount; b++) {
    const startIdx = b * hopSize;
    let sumSquares = 0;
    for (let i = 0; i < blockSize; i++) {
      const val = normalizedData[startIdx + i];
      sumSquares += val * val;
    }
    rmsValues.push(Math.sqrt(sumSquares / blockSize));
  }

  // Find max RMS for scaling threshold
  let maxRMS = 0.001;
  for (let i = 0; i < rmsValues.length; i++) {
    if (rmsValues[i] > maxRMS) maxRMS = rmsValues[i];
  }

  // 2. Onset Detection & Classification Loop
  let lastOnsetBlock = -10; // Prevent overlapping triggers
  let onsetCount = 0;
  
  for (let b = 4; b < blockCount - 1; b++) {
    const rms = rmsValues[b];
    
    // Ignore complete silence (now relative to max RMS to be highly adaptable)
    if (rms < Math.max(0.04, maxRMS * 0.15)) continue;

    // Check if current block energy is a local peak and rises rapidly
    const prevAvg = (rmsValues[b - 4] + rmsValues[b - 3] + rmsValues[b - 2] + rmsValues[b - 1]) / 4;
    
    // Slightly more generous ratio (1.45 instead of 1.75) for human voice onset detection
    if (rms > prevAvg * 1.45 && rms > rmsValues[b + 1] && (b - lastOnsetBlock) > 5) {
      lastOnsetBlock = b;
      onsetCount++;

      // Get the time of this onset in seconds
      const onsetTime = (b * hopSize) / sampleRate;
      const targetStep = Math.round(onsetTime / stepDuration) % 16;

      // Slice a larger block (1024) to prevent out-of-bounds in autocorrelation window + lag
      const startIdx = b * hopSize;
      const blockSamples = normalizedData.slice(startIdx, Math.min(normalizedData.length, startIdx + 1024));

      // Make sure blockSamples is padded if it's too short near the end of audio
      const paddedBlock = new Float32Array(1024);
      paddedBlock.set(blockSamples);

      // --- ZERO CROSSING RATE (ZCR) ---
      let crossings = 0;
      for (let i = 1; i < 512; i++) {
        if ((paddedBlock[i] >= 0 && paddedBlock[i - 1] < 0) || (paddedBlock[i] < 0 && paddedBlock[i - 1] >= 0)) {
          crossings++;
        }
      }
      const zcr = crossings / 512;

      // --- TIME-DOMAIN AUTOCORRELATION FOR HUMMING ---
      const minLag = Math.max(12, Math.floor(sampleRate / 350));
      const maxLag = Math.min(511, Math.ceil(sampleRate / 60));
      
      let maxCorrelation = -1;
      let bestLag = -1;

      for (let lag = minLag; lag <= maxLag; lag++) {
        let sumXY = 0;
        let sumXX = 0;
        let sumYY = 0;
        
        // Compute over a window of 256 samples
        const windowSize = 256;
        for (let i = 0; i < windowSize; i++) {
          const x = paddedBlock[i];
          const y = paddedBlock[i + lag]; // Safe because paddedBlock is 1024 long and i + lag <= 255 + 511 = 766
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
      } else if (maxCorrelation > 0.40 && bestLag > 0) {
        // Tonal and periodic -> Vocal humming! Map to AcidSynth
        const f0 = sampleRate / bestLag;
        
        if (f0 >= 60 && f0 <= 350) {
          const midi = Math.round(69 + 12 * Math.log2(f0 / 440));
          
          let acidMidi = midi;
          while (acidMidi > 48) acidMidi -= 12;
          while (acidMidi < 24) acidMidi += 12;
          
          const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
          const noteName = notes[acidMidi % 12];
          const octave = Math.floor(acidMidi / 12) - 1;
          const noteString = `${noteName}${octave}`;
          
          acidSteps[targetStep] = true;
          acidPitches[targetStep] = noteString;
        } else {
          kickSteps[targetStep] = true;
        }
      } else {
        kickSteps[targetStep] = true;
      }
    }
  }

  // 3. Fallback: If humming smoothly with no sharp onsets, onsetCount will be low.
  // In this case, map peak energy segments to AcidSynth and extract their pitches.
  if (onsetCount < 3) {
    // Determine step thresholds based on average energy
    const stepSampleLength = Math.floor(stepDuration * sampleRate);
    
    for (let step = 0; step < 16; step++) {
      const stepStart = step * stepSampleLength;
      if (stepStart + stepSampleLength > totalSamples) break;

      // Calculate step energy on normalized data
      let stepSumSquares = 0;
      for (let i = 0; i < stepSampleLength; i++) {
        const val = normalizedData[stepStart + i];
        stepSumSquares += val * val;
      }
      const stepRMS = Math.sqrt(stepSumSquares / stepSampleLength);

      // If step energy is significant, transcribe a hummed pitch
      if (stepRMS > 0.18) {
        // Run pitch detection on the middle of this step
        const pitchStart = stepStart + Math.floor(stepSampleLength / 4);
        const blockSamples = normalizedData.slice(pitchStart, Math.min(normalizedData.length, pitchStart + 1024));
        const paddedBlock = new Float32Array(1024);
        paddedBlock.set(blockSamples);

        const minLag = Math.max(12, Math.floor(sampleRate / 350));
        const maxLag = Math.min(511, Math.ceil(sampleRate / 60));
        
        let maxCorrelation = -1;
        let bestLag = -1;

        for (let lag = minLag; lag <= maxLag; lag++) {
          let sumXY = 0;
          let sumXX = 0;
          let sumYY = 0;
          
          const windowSize = 256;
          for (let i = 0; i < windowSize; i++) {
            const x = paddedBlock[i];
            const y = paddedBlock[i + lag];
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

        if (maxCorrelation > 0.35 && bestLag > 0) {
          const f0 = sampleRate / bestLag;
          if (f0 >= 60 && f0 <= 350) {
            const midi = Math.round(69 + 12 * Math.log2(f0 / 440));
            let acidMidi = midi;
            while (acidMidi > 48) acidMidi -= 12;
            while (acidMidi < 24) acidMidi += 12;
            
            const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
            const noteName = notes[acidMidi % 12];
            const octave = Math.floor(acidMidi / 12) - 1;
            const noteString = `${noteName}${octave}`;
            
            acidSteps[step] = true;
            acidPitches[step] = noteString;
          }
        }
      }
    }
  }

  // Ensure we also have a basic safety beat if nothing at all was captured
  let totalTriggers = 0;
  for (let i = 0; i < 16; i++) {
    if (kickSteps[i] || hiHatSteps[i] || clapSteps[i] || acidSteps[i]) {
      totalTriggers++;
    }
  }

  if (totalTriggers === 0) {
    // Safe default groove: kick on 1/5/9/13, hats on offbeats
    kickSteps[0] = true;
    kickSteps[4] = true;
    kickSteps[8] = true;
    kickSteps[12] = true;
    hiHatSteps[2] = true;
    hiHatSteps[6] = true;
    hiHatSteps[10] = true;
    hiHatSteps[14] = true;
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
