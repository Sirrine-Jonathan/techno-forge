// Synthesize Kick, HiHat, and Clap samples entirely in-memory using Web Audio OfflineAudioContext.
// This outputs high-quality WAV Blobs that are loaded into Tone.Sampler offline.

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

export function bufferToWav(buffer: AudioBuffer): Blob {
  const numOfChan = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  
  const resultLength = buffer.length * numOfChan * 2 + 44;
  const arrayBuffer = new ArrayBuffer(resultLength);
  const view = new DataView(arrayBuffer);
  
  let pos = 0;
  writeString(view, pos, 'RIFF'); pos += 4;
  view.setUint32(pos, resultLength - 8, true); pos += 4;
  writeString(view, pos, 'WAVE'); pos += 4;
  
  writeString(view, pos, 'fmt '); pos += 4;
  view.setUint32(pos, 16, true); pos += 4;
  view.setUint16(pos, format, true); pos += 2;
  view.setUint16(pos, numOfChan, true); pos += 2;
  view.setUint32(pos, sampleRate, true); pos += 4;
  view.setUint32(pos, sampleRate * numOfChan * (bitDepth / 8), true); pos += 4;
  view.setUint16(pos, numOfChan * (bitDepth / 8), true); pos += 2;
  view.setUint16(pos, bitDepth, true); pos += 2;
  
  writeString(view, pos, 'data'); pos += 4;
  view.setUint32(pos, resultLength - pos - 4, true); pos += 4;
  
  const channels: Float32Array[] = [];
  for (let i = 0; i < numOfChan; i++) {
    channels.push(buffer.getChannelData(i));
  }
  
  const len = buffer.length;
  for (let i = 0; i < len; i++) {
    for (let channelIndex = 0; channelIndex < numOfChan; channelIndex++) {
      let sample = channels[channelIndex][i];
      // Clip sample values to [-1, 1]
      sample = Math.max(-1, Math.min(1, sample));
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(pos, intSample, true);
      pos += 2;
    }
  }
  
  return new Blob([view], { type: 'audio/wav' });
}

// Generates white noise buffer array
function fillWhiteNoise(array: Float32Array) {
  for (let i = 0; i < array.length; i++) {
    array[i] = Math.random() * 2 - 1;
  }
}

export async function generateKickBuffer(): Promise<AudioBuffer> {
  const sampleRate = 44100;
  const duration = 0.25;
  const ctx = new OfflineAudioContext(1, sampleRate * duration, sampleRate);
  
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  
  osc.frequency.setValueAtTime(150, 0);
  osc.frequency.exponentialRampToValueAtTime(45, duration);
  
  gain.gain.setValueAtTime(1.0, 0);
  gain.gain.exponentialRampToValueAtTime(0.001, duration - 0.01);
  
  osc.connect(gain);
  gain.connect(ctx.destination);
  
  osc.start(0);
  osc.stop(duration);
  
  return await ctx.startRendering();
}

export async function generateHiHatBuffer(): Promise<AudioBuffer> {
  const sampleRate = 44100;
  const duration = 0.08;
  const ctx = new OfflineAudioContext(1, sampleRate * duration, sampleRate);
  
  // Noise generator
  const bufferSize = sampleRate * duration;
  const buffer = ctx.createBuffer(1, bufferSize, sampleRate);
  const data = buffer.getChannelData(0);
  fillWhiteNoise(data);
  
  const noiseSource = ctx.createBufferSource();
  noiseSource.buffer = buffer;
  
  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.setValueAtTime(8000, 0);
  
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.8, 0);
  gain.gain.exponentialRampToValueAtTime(0.001, duration - 0.005);
  
  noiseSource.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  
  noiseSource.start(0);
  return await ctx.startRendering();
}

export async function generateClapBuffer(): Promise<AudioBuffer> {
  const sampleRate = 44100;
  const duration = 0.2;
  const ctx = new OfflineAudioContext(1, sampleRate * duration, sampleRate);
  
  const bufferSize = sampleRate * duration;
  const buffer = ctx.createBuffer(1, bufferSize, sampleRate);
  const data = buffer.getChannelData(0);
  fillWhiteNoise(data);
  
  const noiseSource = ctx.createBufferSource();
  noiseSource.buffer = buffer;
  
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(1200, 0);
  filter.Q.setValueAtTime(3, 0);
  
  const gain = ctx.createGain();
  // 3 short burst transients at the beginning (re-triggers)
  gain.gain.setValueAtTime(0.0, 0);
  gain.gain.setValueAtTime(0.8, 0.002);
  gain.gain.exponentialRampToValueAtTime(0.01, 0.012);
  
  gain.gain.setValueAtTime(0.8, 0.015);
  gain.gain.exponentialRampToValueAtTime(0.01, 0.025);
  
  gain.gain.setValueAtTime(0.8, 0.03);
  // Main body decay
  gain.gain.exponentialRampToValueAtTime(0.001, duration - 0.01);
  
  noiseSource.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  
  noiseSource.start(0);
  return await ctx.startRendering();
}

export interface SampleUrls {
  kick: string;
  hihat: string;
  clap: string;
}

export async function generateAllSampleUrls(): Promise<SampleUrls> {
  const [kickBuf, hihatBuf, clapBuf] = await Promise.all([
    generateKickBuffer(),
    generateHiHatBuffer(),
    generateClapBuffer()
  ]);
  
  const kickBlob = bufferToWav(kickBuf);
  const hihatBlob = bufferToWav(hihatBuf);
  const clapBlob = bufferToWav(clapBuf);
  
  return {
    kick: URL.createObjectURL(kickBlob),
    hihat: URL.createObjectURL(hihatBlob),
    clap: URL.createObjectURL(clapBlob)
  };
}
