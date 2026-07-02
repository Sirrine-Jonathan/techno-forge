import React, { useState, useEffect, useRef } from 'react';
import * as Tone from 'tone';
import { Sliders, BrainCircuit, Mic, Waves, HelpCircle, RefreshCw, Volume2, Sparkles, MonitorPlay } from 'lucide-react';
import { SequencerState, TrackType, DSPAnalysisResult, SongPreset, SoundPreset, GridTrack } from './types';
import { generateAllSampleUrls } from './utils/audioGenerator';
import { loadMagentaModels, ModelsLoadingState, evolveMelodyWithMagenta, evolveDrumsWithMagenta } from './utils/magentaHelper';
import { getSavedTracks } from './utils/libraryStorage';
import SequencerGrid from './components/SequencerGrid';
import AudioEngineControls from './components/AudioEngineControls';
import AIModelControls from './components/AIModelControls';
import VocalRecorder from './components/VocalRecorder';
import AudioVisualizer from './components/AudioVisualizer';
import LibraryControls from './components/LibraryControls';

// Standard blank template for tracks
const createEmptySequencerState = (): SequencerState => ({
  tracks: [
    { 
      name: 'AcidSynth', 
      steps: new Array(16).fill(false),
      pitches: new Array(16).fill('C2'),
      cutoff: 800,
      resonance: 6.0,
      distortion: 0.35,
      sidechainEnabled: true,
      waveform: 'sawtooth',
      decay: 0.20,
      envMod: 3.2,
      portamento: 0.05,
      delayFeedback: 0.40,
      delayMix: 0.20
    },
    { name: 'HiHat', steps: new Array(16).fill(false) },
    { name: 'Clap', steps: new Array(16).fill(false) },
    { name: 'Kick', steps: new Array(16).fill(false) }
  ],
  pitches: new Array(16).fill('C2')
});

interface SynthVoice {
  synth: Tone.MonoSynth;
  distortion: Tone.Distortion;
  filter: Tone.Filter;
  delay: Tone.FeedbackDelay;
  duckingGain: Tone.Gain;
  volume: Tone.Volume;
}

export default function App() {
  // --- STATE ---
  const [sequencerState, setSequencerState] = useState<SequencerState>(createEmptySequencerState());
  const [selectedTrackName, setSelectedTrackName] = useState<string>('AcidSynth');
  
  const [activeStep, setActiveStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(128);
  const [masterVolume, setMasterVolume] = useState(0.85);
  const [engineStarted, setEngineStarted] = useState(false);
  const [engineLoading, setEngineLoading] = useState(false);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);

  // Active Synthesis Knobs (Representing the currently selected synth track)
  const [cutoff, setCutoff] = useState(800);
  const [resonance, setResonance] = useState(6.0);
  const [distortion, setDistortion] = useState(0.35);
  const [sidechainEnabled, setSidechainEnabled] = useState(true);
  const [waveform, setWaveform] = useState<'sawtooth' | 'square'>('sawtooth');
  const [decay, setDecay] = useState(0.20);
  const [envMod, setEnvMod] = useState(3.2);
  const [portamento, setPortamento] = useState(0.05);
  const [delayFeedback, setDelayFeedback] = useState(0.40);
  const [delayMix, setDelayMix] = useState(0.20);

  // Track presets list (for loading pattern presets)
  const [trackPresets, setTrackPresets] = useState(() => getSavedTracks());

  // Magenta model loading status
  const [modelsLoading, setModelsLoading] = useState<ModelsLoadingState>({
    melodyLoaded: false,
    drumsLoaded: false,
    loading: true,
    error: null
  });

  // --- AUDIO REFS ---
  const samplerKickRef = useRef<Tone.Sampler | null>(null);
  const samplerHiHatRef = useRef<Tone.Sampler | null>(null);
  const samplerClapRef = useRef<Tone.Sampler | null>(null);
  const masterVolumeNodeRef = useRef<Tone.Volume | null>(null);

  // Map storing dynamic synthesizers for each track name
  const synthVoicesRef = useRef<Map<string, SynthVoice>>(new Map());

  // Refs for scheduler to access fresh state without closure lags
  const stateRef = useRef(sequencerState);
  const stepCounterRef = useRef(0);

  useEffect(() => {
    stateRef.current = sequencerState;
  }, [sequencerState]);

  // Sync active edit track parameter states with sequencerState changes
  useEffect(() => {
    const activeTrack = sequencerState.tracks.find(t => t.name === selectedTrackName);
    if (activeTrack) {
      setCutoff(activeTrack.cutoff !== undefined ? activeTrack.cutoff : 800);
      setResonance(activeTrack.resonance !== undefined ? activeTrack.resonance : 6.0);
      setDistortion(activeTrack.distortion !== undefined ? activeTrack.distortion : 0.35);
      setSidechainEnabled(activeTrack.sidechainEnabled !== undefined ? activeTrack.sidechainEnabled : true);
      setWaveform(activeTrack.waveform || 'sawtooth');
      setDecay(activeTrack.decay !== undefined ? activeTrack.decay : 0.20);
      setEnvMod(activeTrack.envMod !== undefined ? activeTrack.envMod : 3.2);
      setPortamento(activeTrack.portamento !== undefined ? activeTrack.portamento : 0.05);
      setDelayFeedback(activeTrack.delayFeedback !== undefined ? activeTrack.delayFeedback : 0.40);
      setDelayMix(activeTrack.delayMix !== undefined ? activeTrack.delayMix : 0.20);
    }
  }, [selectedTrackName, sequencerState.tracks]);

  // --- MAGENTA INITIALIZATION ON MOUNT ---
  useEffect(() => {
    loadMagentaModels((state) => {
      setModelsLoading(state);
    });

    // Cleanup Transport loop on unmount
    return () => {
      Tone.getTransport().stop();
      Tone.getTransport().cancel();
      // Dispose dynamic synth voices to prevent memory leaks
      synthVoicesRef.current.forEach((voice) => {
        voice.synth.dispose();
        voice.distortion.dispose();
        voice.filter.dispose();
        voice.delay.dispose();
        voice.duckingGain.dispose();
        voice.volume.dispose();
      });
      synthVoicesRef.current.clear();
    };
  }, []);

  // --- SYNTHESIZER VOICE FACTORY ---
  const createSynthVoice = (trackName: string, config: Partial<GridTrack>): SynthVoice => {
    const synth = new Tone.MonoSynth({
      oscillator: { type: config.waveform || 'sawtooth' },
      envelope: {
        attack: 0.005,
        decay: config.decay !== undefined ? config.decay : 0.20,
        sustain: 0.10,
        release: 0.15
      },
      filterEnvelope: {
        attack: 0.008,
        decay: (config.decay !== undefined ? config.decay : 0.20) + 0.02,
        sustain: 0.15,
        baseFrequency: 300,
        octaves: config.envMod !== undefined ? config.envMod : 3.2
      },
      portamento: config.portamento !== undefined ? config.portamento : 0.05
    });

    const distortionNode = new Tone.Distortion({
      distortion: config.distortion !== undefined ? config.distortion : 0.35,
      oversample: '4x'
    });

    const filterNode = new Tone.Filter({
      type: 'lowpass',
      frequency: config.cutoff !== undefined ? config.cutoff : 800,
      Q: config.resonance !== undefined ? config.resonance : 6.0
    });

    const delayNode = new Tone.FeedbackDelay({
      delayTime: '8n.',
      feedback: config.delayFeedback !== undefined ? config.delayFeedback : 0.40,
      wet: config.delayMix !== undefined ? config.delayMix : 0.20
    });

    const duckingGain = new Tone.Gain(1.0);
    const volumeNode = new Tone.Volume(-2);

    synth.connect(distortionNode);
    distortionNode.connect(filterNode);
    filterNode.connect(delayNode);
    delayNode.connect(duckingGain);
    duckingGain.connect(volumeNode);

    if (masterVolumeNodeRef.current) {
      volumeNode.connect(masterVolumeNodeRef.current);
    }

    return {
      synth,
      distortion: distortionNode,
      filter: filterNode,
      delay: delayNode,
      duckingGain,
      volume: volumeNode
    };
  };

  // --- AUDIO SYNTH GRAPH CREATION (LAZY LOAD ON CLICK) ---
  const startAudioEngine = async (autoPlay: boolean = false) => {
    if (engineStarted || engineLoading) return;
    setEngineLoading(true);

    try {
      // 1. Initialize Web Audio Context
      await Tone.start();
      console.log('Tone.js Context Started successfully!');

      // 2. Generate in-memory synthesized WAV samples
      const urls = await generateAllSampleUrls();

      // Create Master Volume and Destination
      masterVolumeNodeRef.current = new Tone.Volume(Tone.gainToDb(masterVolume)).toDestination();

      // Create native Analyser
      const nativeAnalyser = Tone.getContext().rawContext.createAnalyser();
      nativeAnalyser.fftSize = 256;
      masterVolumeNodeRef.current.connect(nativeAnalyser);
      setAnalyser(nativeAnalyser);

      // 3. Create Samplers connected to Master Volume
      samplerKickRef.current = new Tone.Sampler({
        urls: { C2: urls.kick },
        volume: 2
      }).connect(masterVolumeNodeRef.current);

      samplerHiHatRef.current = new Tone.Sampler({
        urls: { C2: urls.hihat },
        volume: -4
      }).connect(masterVolumeNodeRef.current);

      samplerClapRef.current = new Tone.Sampler({
        urls: { C2: urls.clap },
        volume: -2
      }).connect(masterVolumeNodeRef.current);

      // 4. Create TB-303 synthesizers for each synth track in sequencerState
      sequencerState.tracks.forEach((track) => {
        const isSynth = track.name !== 'Kick' && track.name !== 'HiHat' && track.name !== 'Clap';
        if (isSynth) {
          const voice = createSynthVoice(track.name, track);
          synthVoicesRef.current.set(track.name, voice);
        }
      });

      // 5. Schedule our 16-step interval Transport Loop
      setupSequencerLoop();

      setEngineStarted(true);
      setEngineLoading(false);

      // Load a nice starting Acid Loop as default to show off the system!
      loadPreset('classicAcid');

      if (autoPlay) {
        stepCounterRef.current = 0;
        setActiveStep(0);
        Tone.getTransport().start();
        setIsPlaying(true);
      }

    } catch (err) {
      console.error('Failed to initialize Audio Engine graph:', err);
      setEngineLoading(false);
    }
  };

  // --- SEQUENCER INTERVAL SCHEDULER ---
  const setupSequencerLoop = () => {
    // Cancel any old schedulers to prevent overlaps
    Tone.getTransport().cancel();

    Tone.getTransport().scheduleRepeat((time) => {
      const step = stepCounterRef.current;
      const currentState = stateRef.current;

      const kickTrack = currentState.tracks.find(t => t.name === 'Kick');
      const hihatTrack = currentState.tracks.find(t => t.name === 'HiHat');
      const clapTrack = currentState.tracks.find(t => t.name === 'Clap');

      // 1. Play Kick Drum
      if (kickTrack && kickTrack.steps[step] && samplerKickRef.current) {
        samplerKickRef.current.triggerAttackRelease('C2', '8n', time);
      }

      // 2. Play HiHat
      if (hihatTrack && hihatTrack.steps[step] && samplerHiHatRef.current) {
        samplerHiHatRef.current.triggerAttackRelease('C2', '8n', time);
      }

      // 3. Play Clap
      if (clapTrack && clapTrack.steps[step] && samplerClapRef.current) {
        samplerClapRef.current.triggerAttackRelease('C2', '8n', time);
      }

      // 4. Play all TB-303 Acid Synths
      currentState.tracks.forEach((track) => {
        const isSynth = track.name !== 'Kick' && track.name !== 'HiHat' && track.name !== 'Clap';
        if (isSynth && track.steps[step]) {
          const voice = synthVoicesRef.current.get(track.name);
          if (voice) {
            const trackPitches = track.pitches || currentState.pitches;
            const pitch = trackPitches[step] || 'C2';
            voice.synth.triggerAttackRelease(pitch, '16n', time);
          }
        }
      });

      // 5. Sidechain ducking applied individually per synth voice channel
      if (step === 0 || step === 4 || step === 8 || step === 12) {
        currentState.tracks.forEach((track) => {
          const isSynth = track.name !== 'Kick' && track.name !== 'HiHat' && track.name !== 'Clap';
          if (isSynth) {
            const hasSidechain = track.sidechainEnabled !== undefined ? track.sidechainEnabled : true;
            if (hasSidechain) {
              const voice = synthVoicesRef.current.get(track.name);
              if (voice) {
                voice.duckingGain.gain.cancelScheduledValues(time);
                voice.duckingGain.gain.setValueAtTime(1.0, time);
                voice.duckingGain.gain.linearRampToValueAtTime(0.1, time + 0.02);
                voice.duckingGain.gain.linearRampToValueAtTime(1.0, time + 0.17);
              }
            }
          }
        });
      }

      // 6. Schedule React visual state update
      Tone.getDraw().schedule(() => {
        setActiveStep(step);
      }, time);

      // Increment step index
      stepCounterRef.current = (stepCounterRef.current + 1) % 16;
    }, '16n');

    // Config default Transport settings
    Tone.getTransport().bpm.value = bpm;
  };

  // --- PLAYBACK CONTROLS ---
  const togglePlayback = () => {
    if (!engineStarted) {
      startAudioEngine(true);
      return;
    }

    if (isPlaying) {
      Tone.getTransport().stop();
      setIsPlaying(false);
    } else {
      // Ensure step counter resets to the visual step 0 when play begins
      stepCounterRef.current = 0;
      setActiveStep(0);
      Tone.getTransport().start();
      setIsPlaying(true);
    }
  };

  const updateBpm = (newBpm: number) => {
    setBpm(newBpm);
    Tone.getTransport().bpm.value = newBpm;
  };

  // --- SOUND PARAMETERS ROUTING FOR SELECTED TRACK ---
  const updateCutoff = (newCutoff: number) => {
    setCutoff(newCutoff);
    setSequencerState((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) =>
        t.name === selectedTrackName ? { ...t, cutoff: newCutoff } : t
      ),
    }));
    const voice = synthVoicesRef.current.get(selectedTrackName);
    if (voice) {
      voice.filter.frequency.setValueAtTime(newCutoff, Tone.now());
    }
  };

  const updateResonance = (newQ: number) => {
    setResonance(newQ);
    setSequencerState((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) =>
        t.name === selectedTrackName ? { ...t, resonance: newQ } : t
      ),
    }));
    const voice = synthVoicesRef.current.get(selectedTrackName);
    if (voice) {
      voice.filter.Q.setValueAtTime(newQ, Tone.now());
    }
  };

  const updateDistortion = (amount: number) => {
    setDistortion(amount);
    setSequencerState((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) =>
        t.name === selectedTrackName ? { ...t, distortion: amount } : t
      ),
    }));
    const voice = synthVoicesRef.current.get(selectedTrackName);
    if (voice) {
      voice.distortion.distortion = amount;
    }
  };

  const handleToggleSidechain = (enabled: boolean) => {
    setSidechainEnabled(enabled);
    setSequencerState((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) =>
        t.name === selectedTrackName ? { ...t, sidechainEnabled: enabled } : t
      ),
    }));
  };

  const updateMasterVolume = (vol: number) => {
    setMasterVolume(vol);
    if (masterVolumeNodeRef.current) {
      masterVolumeNodeRef.current.volume.value = Tone.gainToDb(vol);
    }
  };

  const updateWaveform = (type: 'sawtooth' | 'square') => {
    setWaveform(type);
    setSequencerState((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) =>
        t.name === selectedTrackName ? { ...t, waveform: type } : t
      ),
    }));
    const voice = synthVoicesRef.current.get(selectedTrackName);
    if (voice) {
      voice.synth.oscillator.type = type;
    }
  };

  const updateDecay = (val: number) => {
    setDecay(val);
    setSequencerState((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) =>
        t.name === selectedTrackName ? { ...t, decay: val } : t
      ),
    }));
    const voice = synthVoicesRef.current.get(selectedTrackName);
    if (voice) {
      voice.synth.envelope.decay = val;
      voice.synth.filterEnvelope.decay = val + 0.02;
    }
  };

  const updateEnvMod = (val: number) => {
    setEnvMod(val);
    setSequencerState((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) =>
        t.name === selectedTrackName ? { ...t, envMod: val } : t
      ),
    }));
    const voice = synthVoicesRef.current.get(selectedTrackName);
    if (voice) {
      voice.synth.filterEnvelope.octaves = val;
    }
  };

  const updatePortamento = (val: number) => {
    setPortamento(val);
    setSequencerState((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) =>
        t.name === selectedTrackName ? { ...t, portamento: val } : t
      ),
    }));
    const voice = synthVoicesRef.current.get(selectedTrackName);
    if (voice) {
      voice.synth.portamento = val;
    }
  };

  const updateDelayFeedback = (val: number) => {
    setDelayFeedback(val);
    setSequencerState((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) =>
        t.name === selectedTrackName ? { ...t, delayFeedback: val } : t
      ),
    }));
    const voice = synthVoicesRef.current.get(selectedTrackName);
    if (voice) {
      voice.delay.feedback.value = val;
    }
  };

  const updateDelayMix = (val: number) => {
    setDelayMix(val);
    setSequencerState((prev) => ({
      ...prev,
      tracks: prev.tracks.map((t) =>
        t.name === selectedTrackName ? { ...t, delayMix: val } : t
      ),
    }));
    const voice = synthVoicesRef.current.get(selectedTrackName);
    if (voice) {
      voice.delay.wet.value = val;
    }
  };

  const handleApplyAIResults = (params: {
    cutoff: number;
    resonance: number;
    distortion: number;
    sidechainEnabled: boolean;
    waveform: 'sawtooth' | 'square';
    decay: number;
    envMod: number;
    portamento: number;
    delayFeedback: number;
    delayMix: number;
  }) => {
    updateCutoff(params.cutoff);
    updateResonance(params.resonance);
    updateDistortion(params.distortion);
    handleToggleSidechain(params.sidechainEnabled);
    updateWaveform(params.waveform);
    updateDecay(params.decay);
    updateEnvMod(params.envMod);
    updatePortamento(params.portamento);
    updateDelayFeedback(params.delayFeedback);
    updateDelayMix(params.delayMix);
  };

  // --- MANUAL OVERRIDES ---
  const toggleStepManually = (trackName: string, stepIdx: number) => {
    setSequencerState((prev) => {
      const updatedTracks = prev.tracks.map((t) => {
        if (t.name === trackName) {
          const updatedSteps = [...t.steps];
          updatedSteps[stepIdx] = !updatedSteps[stepIdx];
          return { ...t, steps: updatedSteps };
        }
        return t;
      });
      return { ...prev, tracks: updatedTracks };
    });

    // Audition preview note
    if (!isPlaying && engineStarted) {
      if (trackName === 'Kick' && samplerKickRef.current) {
        samplerKickRef.current.triggerAttackRelease('C2', '8n');
      } else if (trackName === 'HiHat' && samplerHiHatRef.current) {
        samplerHiHatRef.current.triggerAttackRelease('C2', '8n');
      } else if (trackName === 'Clap' && samplerClapRef.current) {
        samplerClapRef.current.triggerAttackRelease('C2', '8n');
      } else {
        const voice = synthVoicesRef.current.get(trackName);
        if (voice) {
          const track = sequencerState.tracks.find(t => t.name === trackName);
          const trackPitches = track?.pitches || sequencerState.pitches;
          const pitch = trackPitches[stepIdx] || 'C2';
          voice.synth.triggerAttackRelease(pitch, '16n');
        }
      }
    }
  };

  const updatePitchManually = (trackName: string, stepIdx: number, pitch: string) => {
    setSequencerState((prev) => {
      const updatedTracks = prev.tracks.map((t) => {
        if (t.name === trackName) {
          const trackPitches = t.pitches ? [...t.pitches] : [...prev.pitches];
          trackPitches[stepIdx] = pitch;
          return { ...t, pitches: trackPitches };
        }
        return t;
      });
      return { ...prev, tracks: updatedTracks };
    });
  };

  const auditionNotePreview = (pitch: string) => {
    if (engineStarted) {
      const voice = synthVoicesRef.current.get(selectedTrackName);
      if (voice) {
        voice.synth.triggerAttackRelease(pitch, '8n');
      }
    }
  };

  const resetPattern = () => {
    setSequencerState(createEmptySequencerState());
    
    // Select default 'AcidSynth'
    setSelectedTrackName('AcidSynth');

    // Clean up dynamic Tone synth voices
    if (engineStarted) {
      synthVoicesRef.current.forEach((voice) => {
        voice.synth.dispose();
        voice.distortion.dispose();
        voice.filter.dispose();
        voice.delay.dispose();
        voice.duckingGain.dispose();
        voice.volume.dispose();
      });
      synthVoicesRef.current.clear();

      // Create only one synth
      const defaultTrack = createEmptySequencerState().tracks[0];
      const voice = createSynthVoice(defaultTrack.name, defaultTrack);
      synthVoicesRef.current.set(defaultTrack.name, voice);
    }
  };

  // --- MULTI-TRACK MANIPULATION WORKFLOWS ---
  const handleAddTrack = (name: string) => {
    const defaultParams = {
      name,
      steps: new Array(16).fill(false),
      pitches: new Array(16).fill('C2'),
      cutoff: 800,
      resonance: 6.0,
      distortion: 0.35,
      sidechainEnabled: true,
      waveform: 'sawtooth' as const,
      decay: 0.20,
      envMod: 3.2,
      portamento: 0.05,
      delayFeedback: 0.40,
      delayMix: 0.20
    };

    setSequencerState((prev) => ({
      ...prev,
      tracks: [...prev.tracks, defaultParams]
    }));

    // Instantly construct Tone.js engine voice if started
    if (engineStarted) {
      const voice = createSynthVoice(name, defaultParams);
      synthVoicesRef.current.set(name, voice);
    }

    setSelectedTrackName(name);
  };

  const handleRemoveTrack = (name: string) => {
    // Keep at least one synth track
    const synthTracks = sequencerState.tracks.filter(
      (t) => t.name !== 'Kick' && t.name !== 'HiHat' && t.name !== 'Clap'
    );
    if (synthTracks.length <= 1) return;

    // Clean up Tone.js nodes
    const voice = synthVoicesRef.current.get(name);
    if (voice) {
      voice.synth.dispose();
      voice.distortion.dispose();
      voice.filter.dispose();
      voice.delay.dispose();
      voice.duckingGain.dispose();
      voice.volume.dispose();
      synthVoicesRef.current.delete(name);
    }

    setSequencerState((prev) => ({
      ...prev,
      tracks: prev.tracks.filter(t => t.name !== name)
    }));

    if (selectedTrackName === name) {
      const remaining = synthTracks.filter(t => t.name !== name);
      if (remaining.length > 0) {
        setSelectedTrackName(remaining[0].name);
      }
    }
  };

  const handleRenameTrack = (oldName: string, newName: string) => {
    setSequencerState((prev) => ({
      ...prev,
      tracks: prev.tracks.map(t => t.name === oldName ? { ...t, name: newName } : t)
    }));

    // Transfer synth voice reference key
    if (synthVoicesRef.current.has(oldName)) {
      const voice = synthVoicesRef.current.get(oldName)!;
      synthVoicesRef.current.delete(oldName);
      synthVoicesRef.current.set(newName, voice);
    }

    if (selectedTrackName === oldName) {
      setSelectedTrackName(newName);
    }
  };

  // --- MAGENTA NEURAL NETWORK INFERENCE COUPLERS ---
  const handleEvolveMelody = async (temperature: number) => {
    const targetTrack = sequencerState.tracks.find(t => t.name === selectedTrackName);
    if (!targetTrack) return;
    const currentPitches = targetTrack.pitches || sequencerState.pitches;
    const result = await evolveMelodyWithMagenta(targetTrack.steps, currentPitches, temperature);
    
    setSequencerState((prev) => {
      const updatedTracks = prev.tracks.map((t) => {
        if (t.name === selectedTrackName) {
          return { 
            ...t, 
            steps: result.steps,
            pitches: result.pitches
          };
        }
        return t;
      });
      return {
        ...prev,
        tracks: updatedTracks
      };
    });
  };

  const handleEvolveDrums = async (temperature: number) => {
    const kickTrack = sequencerState.tracks.find(t => t.name === 'Kick')!;
    const hatTrack = sequencerState.tracks.find(t => t.name === 'HiHat')!;
    const clapTrack = sequencerState.tracks.find(t => t.name === 'Clap')!;

    const result = await evolveDrumsWithMagenta(kickTrack.steps, hatTrack.steps, clapTrack.steps, temperature);

    setSequencerState((prev) => {
      const updatedTracks = prev.tracks.map((t) => {
        if (t.name === 'Kick') return { ...t, steps: result.kick };
        if (t.name === 'HiHat') return { ...t, steps: result.hihat };
        if (t.name === 'Clap') return { ...t, steps: result.clap };
        return t;
      });
      return { ...prev, tracks: updatedTracks };
    });
  };

  // --- DSP TRANSCRIPTION COMPLETION HANDLER ---
  const handleVocalTranscription = (result: DSPAnalysisResult) => {
    setSequencerState({
      tracks: [
        { 
          name: 'AcidSynth', 
          steps: result.tracks.AcidSynth,
          pitches: result.pitches,
          cutoff: 800,
          resonance: 6.0,
          distortion: 0.35,
          sidechainEnabled: true,
          waveform: 'sawtooth',
          decay: 0.20,
          envMod: 3.2,
          portamento: 0.05,
          delayFeedback: 0.40,
          delayMix: 0.20
        },
        { name: 'HiHat', steps: result.tracks.HiHat },
        { name: 'Clap', steps: result.tracks.Clap },
        { name: 'Kick', steps: result.tracks.Kick }
      ],
      pitches: result.pitches
    });
  };

  // --- GENUINE TECHNO PRESETS FOR INSTANT PREVIEWS ---
  const loadPreset = (presetName: 'classicAcid' | 'industrial' | 'empty') => {
    if (presetName === 'empty') {
      resetPattern();
      return;
    }

    const state = createEmptySequencerState();
    const getTrackRef = (name: string) => state.tracks.find(t => t.name === name)!;

    if (presetName === 'classicAcid') {
      // 4x4 Kick
      getTrackRef('Kick').steps = [true, false, false, false, true, false, false, false, true, false, false, false, true, false, false, false];
      // Offbeat HiHat
      getTrackRef('HiHat').steps = [false, false, true, false, false, false, true, false, false, false, true, false, false, false, true, false];
      // Backbeat Clap
      getTrackRef('Clap').steps = [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, false];
      // Acid Bouncing Bassline
      const acid = getTrackRef('AcidSynth');
      acid.steps = [true, true, false, true, true, false, true, true, false, true, true, false, true, false, true, true];
      acid.pitches = ['C2', 'C2', 'C2', 'D#2', 'C2', 'C2', 'G2', 'C2', 'C2', 'A#2', 'C2', 'C2', 'C3', 'C2', 'D#2', 'A#1'];
      acid.cutoff = 950;
      acid.resonance = 8.5;
      acid.distortion = 0.40;
      acid.waveform = 'sawtooth';
      acid.decay = 0.18;
      acid.envMod = 3.8;
      acid.portamento = 0.08;
      acid.delayFeedback = 0.35;
      acid.delayMix = 0.15;

      setBpm(126);
    } else if (presetName === 'industrial') {
      // Syncopated heavy kick
      getTrackRef('Kick').steps = [true, false, false, true, true, false, false, false, true, false, true, false, true, false, false, true];
      // Fast 16th hats
      getTrackRef('HiHat').steps = [true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true];
      // Backbeat claps
      getTrackRef('Clap').steps = [false, false, false, false, true, false, false, false, false, false, false, false, true, false, true, false];
      // Rolling bassline
      const acid = getTrackRef('AcidSynth');
      acid.steps = [true, false, true, false, true, false, true, false, true, false, true, false, true, false, true, false];
      acid.pitches = ['A1', 'A1', 'C2', 'C2', 'D#2', 'D#2', 'A1', 'A1', 'G1', 'G1', 'A1', 'A1', 'C2', 'C2', 'A1', 'A1'];
      acid.cutoff = 650;
      acid.resonance = 4.0;
      acid.distortion = 0.65;
      acid.waveform = 'square';
      acid.decay = 0.28;
      acid.envMod = 2.2;
      acid.portamento = 0.04;
      acid.delayFeedback = 0.55;
      acid.delayMix = 0.32;

      setBpm(132);
    }

    setSequencerState(state);

    // Ifstarted, dispose and recreate Tone.js voices
    if (engineStarted) {
      synthVoicesRef.current.forEach((voice) => {
        voice.synth.dispose();
        voice.distortion.dispose();
        voice.filter.dispose();
        voice.delay.dispose();
        voice.duckingGain.dispose();
        voice.volume.dispose();
      });
      synthVoicesRef.current.clear();

      state.tracks.forEach((track) => {
        const isSynth = track.name !== 'Kick' && track.name !== 'HiHat' && track.name !== 'Clap';
        if (isSynth) {
          const voice = createSynthVoice(track.name, track);
          synthVoicesRef.current.set(track.name, voice);
        }
      });
    }

    const firstSynth = state.tracks.find(t => t.name !== 'Kick' && t.name !== 'HiHat' && t.name !== 'Clap');
    if (firstSynth) {
      setSelectedTrackName(firstSynth.name);
    }
  };

  // --- LIBRARY DATABASE INTEGRATION HANDLERS ---
  const handleLoadSong = (song: SongPreset) => {
    setSequencerState(song.sequencerState);
    updateBpm(song.bpm);

    // If engine started, completely sync/rebuild active voices mapping
    if (engineStarted) {
      synthVoicesRef.current.forEach((voice) => {
        voice.synth.dispose();
        voice.distortion.dispose();
        voice.filter.dispose();
        voice.delay.dispose();
        voice.duckingGain.dispose();
        voice.volume.dispose();
      });
      synthVoicesRef.current.clear();

      song.sequencerState.tracks.forEach((track) => {
        const isSynth = track.name !== 'Kick' && track.name !== 'HiHat' && track.name !== 'Clap';
        if (isSynth) {
          const voice = createSynthVoice(track.name, track);
          synthVoicesRef.current.set(track.name, voice);
        }
      });
    }

    // Select the first synth track found
    const firstSynth = song.sequencerState.tracks.find(t => t.name !== 'Kick' && t.name !== 'HiHat' && t.name !== 'Clap');
    if (firstSynth) {
      setSelectedTrackName(firstSynth.name);
    }
  };

  const handleLoadSound = (sound: Omit<SoundPreset, 'id' | 'createdAt'>) => {
    updateCutoff(sound.cutoff);
    updateResonance(sound.resonance);
    updateDistortion(sound.distortion);
    handleToggleSidechain(sound.sidechainEnabled);
    updateWaveform(sound.waveform || 'sawtooth');
    updateDecay(sound.decay !== undefined ? sound.decay : 0.22);
    updateEnvMod(sound.envMod !== undefined ? sound.envMod : 3.2);
    updatePortamento(sound.portamento !== undefined ? sound.portamento : 0.05);
    updateDelayFeedback(sound.delayFeedback !== undefined ? sound.delayFeedback : 0.40);
    updateDelayMix(sound.delayMix !== undefined ? sound.delayMix : 0.20);
  };

  const handleLoadTrackPattern = (
    trackName: string, 
    steps: boolean[], 
    pitches?: string[],
    soundPreset?: Omit<SoundPreset, 'id' | 'createdAt'>
  ) => {
    setSequencerState((prev) => {
      const updatedTracks = prev.tracks.map((t) => {
        if (t.name === trackName) {
          const updated = {
            ...t,
            steps: [...steps],
            pitches: pitches ? [...pitches] : t.pitches
          };
          if (soundPreset) {
            updated.cutoff = soundPreset.cutoff;
            updated.resonance = soundPreset.resonance;
            updated.distortion = soundPreset.distortion;
            updated.sidechainEnabled = soundPreset.sidechainEnabled;
            updated.waveform = soundPreset.waveform;
            updated.decay = soundPreset.decay;
            updated.envMod = soundPreset.envMod;
            updated.portamento = soundPreset.portamento;
            updated.delayFeedback = soundPreset.delayFeedback;
            updated.delayMix = soundPreset.delayMix;
          }
          return updated;
        }
        return t;
      });
      return {
        ...prev,
        tracks: updatedTracks
      };
    });

    if (trackName === selectedTrackName && soundPreset) {
      setCutoff(soundPreset.cutoff);
      setResonance(soundPreset.resonance);
      setDistortion(soundPreset.distortion);
      setSidechainEnabled(soundPreset.sidechainEnabled);
      setWaveform(soundPreset.waveform || 'sawtooth');
      setDecay(soundPreset.decay !== undefined ? soundPreset.decay : 0.20);
      setEnvMod(soundPreset.envMod !== undefined ? soundPreset.envMod : 3.2);
      setPortamento(soundPreset.portamento !== undefined ? soundPreset.portamento : 0.05);
      setDelayFeedback(soundPreset.delayFeedback !== undefined ? soundPreset.delayFeedback : 0.40);
      setDelayMix(soundPreset.delayMix !== undefined ? soundPreset.delayMix : 0.20);
    }

    if (engineStarted && soundPreset) {
      const voice = synthVoicesRef.current.get(trackName);
      if (voice) {
        voice.filter.frequency.setValueAtTime(soundPreset.cutoff, Tone.now());
        voice.filter.Q.setValueAtTime(soundPreset.resonance, Tone.now());
        voice.distortion.distortion = soundPreset.distortion;
        voice.synth.oscillator.type = soundPreset.waveform || 'sawtooth';
        voice.synth.envelope.decay = soundPreset.decay !== undefined ? soundPreset.decay : 0.20;
        voice.synth.filterEnvelope.decay = (soundPreset.decay !== undefined ? soundPreset.decay : 0.20) + 0.02;
        voice.synth.filterEnvelope.octaves = soundPreset.envMod !== undefined ? soundPreset.envMod : 3.2;
        voice.synth.portamento = soundPreset.portamento !== undefined ? soundPreset.portamento : 0.05;
        voice.delay.feedback.value = soundPreset.delayFeedback !== undefined ? soundPreset.delayFeedback : 0.40;
        voice.delay.wet.value = soundPreset.delayMix !== undefined ? soundPreset.delayMix : 0.20;
      }
    }
  };

  const handleLoadTrackPreset = (preset: any, trackName: string) => {
    handleLoadTrackPattern(trackName, preset.steps, preset.pitches, preset.soundPreset);
  };

  return (
    <div className="min-h-screen bg-[#0F0F15] text-neutral-200 font-sans p-4 md:p-8 flex flex-col gap-6">
      
      {/* HEADER / VISUAL BRANDING BAR */}
      <header className="max-w-6xl mx-auto w-full flex flex-col sm:flex-row justify-between items-start sm:items-center border-b-2 border-neutral-800 pb-4 gap-4">
        <div className="flex flex-col">
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white flex items-center gap-2">
            <span className="bg-gradient-to-r from-[#00FFCC] to-[#FF00AA] bg-clip-text text-transparent">
              TECHNOFORGE AI STUDIO
            </span>
          </h1>
          <p className="font-mono text-[10px] text-neutral-500 uppercase tracking-widest mt-1">
            Core Version: 1.1.0 // Architecture: Dynamic Multi-Synth Orchestrator
          </p>
        </div>

        {/* TOP STATUS ROW */}
        <div className="flex items-center gap-3 font-mono">
          <div className="flex items-center gap-2 bg-[#161622] border border-neutral-800 px-3 py-1.5 rounded text-xs">
            <span className={`w-2 h-2 rounded-full ${engineStarted ? 'bg-[#00FFCC] animate-pulse' : 'bg-neutral-600'}`} />
            <span className="text-neutral-400">Audio Graph:</span>
            <span className="font-bold text-white">{engineStarted ? 'ONLINE' : 'OFFLINE'}</span>
          </div>

          <div className="flex items-center gap-2 bg-[#161622] border border-neutral-800 px-3 py-1.5 rounded text-xs">
            <MonitorPlay className="w-3.5 h-3.5 text-[#FF00AA]" />
            <span className="text-neutral-400">Step:</span>
            <span className="font-bold text-[#FF00AA]">{isPlaying ? (activeStep + 1).toString().padStart(2, '0') : '--'}</span>
          </div>
        </div>
      </header>

      {/* DEMO LOOPS / PRESETS RAIL */}
      <div className="max-w-6xl mx-auto w-full flex flex-wrap items-center gap-3 bg-[#161622] border-2 border-neutral-800 p-3 font-mono">
        <span className="text-xs text-neutral-400 font-bold uppercase tracking-wider flex items-center gap-1">
          <Volume2 className="w-3.5 h-3.5 text-[#00FFCC]" />
          Quick Studio Presets:
        </span>
        <button
          onClick={() => { if (!engineStarted) startAudioEngine(); else loadPreset('classicAcid'); }}
          className="text-xs bg-neutral-900 border border-neutral-800 hover:border-[#FF00AA] text-neutral-300 hover:text-white px-3 py-1 uppercase transition-all cursor-pointer"
        >
          Classic Acid House
        </button>
        <button
          onClick={() => { if (!engineStarted) startAudioEngine(); else loadPreset('industrial'); }}
          className="text-xs bg-neutral-900 border border-neutral-800 hover:border-[#00FFCC] text-neutral-300 hover:text-white px-3 py-1 uppercase transition-all cursor-pointer"
        >
          Industrial Techno 132BPM
        </button>
        <button
          onClick={() => loadPreset('empty')}
          className="text-xs bg-neutral-900 border border-neutral-800 hover:border-red-500 text-neutral-400 hover:text-red-400 px-3 py-1 uppercase transition-all cursor-pointer"
        >
          Clear Workspace
        </button>
      </div>

      {/* CORE WORKSPACE GRID */}
      <main className="max-w-6xl mx-auto w-full flex flex-col gap-6">

        {/* MASTER SIGNAL VISUALIZER MONITOR */}
        <section aria-label="Master Audio Signal Monitor">
          <AudioVisualizer
            analyser={analyser}
            engineStarted={engineStarted}
            isPlaying={isPlaying}
          />
        </section>
        
        {/* ROW 1: THE SEQUENCER MATRIX */}
        <section aria-label="Sequencer Matrix Board">
          <SequencerGrid
            sequencerState={sequencerState}
            activeStep={activeStep}
            isPlaying={isPlaying}
            selectedTrackName={selectedTrackName}
            onToggleStep={toggleStepManually}
            onUpdatePitch={updatePitchManually}
            onPreviewPitch={auditionNotePreview}
            onSelectTrack={setSelectedTrackName}
            onAddTrack={handleAddTrack}
            onRemoveTrack={handleRemoveTrack}
            onRenameTrack={handleRenameTrack}
            trackPresets={trackPresets}
            onLoadTrackPattern={handleLoadTrackPreset}
          />
        </section>

        {/* ROW 2: CONTROLS & MODEL MODULATORS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* LEFT COLUMN: SOUND PARAMETERS */}
          <section className="flex flex-col gap-6" aria-label="Synthesis Controls">
            <AudioEngineControls
              isPlaying={isPlaying}
              bpm={bpm}
              cutoff={cutoff}
              resonance={resonance}
              distortion={distortion}
              sidechainEnabled={sidechainEnabled}
              masterVolume={masterVolume}
              engineStarted={engineStarted}
              waveform={waveform}
              decay={decay}
              envMod={envMod}
              portamento={portamento}
              delayFeedback={delayFeedback}
              delayMix={delayMix}
              onStartEngine={startAudioEngine}
              onTogglePlay={togglePlayback}
              onBpmChange={updateBpm}
              onCutoffChange={updateCutoff}
              onResonanceChange={updateResonance}
              onDistortionChange={updateDistortion}
              onSidechainToggle={handleToggleSidechain}
              onVolumeChange={updateMasterVolume}
              onResetPattern={resetPattern}
              onWaveformChange={updateWaveform}
              onDecayChange={updateDecay}
              onEnvModChange={updateEnvMod}
              onPortamentoChange={updatePortamento}
              onDelayFeedbackChange={updateDelayFeedback}
              onDelayMixChange={updateDelayMix}
              onApplyAIResults={handleApplyAIResults}
              activeTrackName={selectedTrackName}
            />

            <VocalRecorder
              bpm={bpm}
              engineStarted={engineStarted}
              onTranscriptionComplete={handleVocalTranscription}
            />
          </section>

          {/* RIGHT COLUMN: AI MODULATOR MODELS */}
          <section className="flex flex-col gap-6" aria-label="AI Generative Assistants">
            <AIModelControls
              loadingState={modelsLoading}
              onEvolveMelody={handleEvolveMelody}
              onEvolveDrums={handleEvolveDrums}
            />

            {/* TECH DOCUMENTATION MANUAL - COLLAPSIBLE FOR FUNCTIONALITY FIRST, INFO SECOND */}
            <details id="tech-docs-card" className="group bg-[#161622]/50 border border-neutral-900 p-5 rounded-none flex flex-col gap-3 font-mono text-xs text-neutral-400">
              <summary className="list-none cursor-pointer select-none flex items-center justify-between">
                <h4 className="text-[11px] font-bold tracking-widest text-neutral-300 uppercase flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-neutral-500" />
                  SYSTEM MANUAL & HARDWARE SPECS
                </h4>
                <span className="text-[9px] text-[#00FFCC] group-open:hidden uppercase font-bold tracking-widest bg-neutral-950/60 border border-neutral-800 px-2 py-0.5 rounded">
                  Expand Info
                </span>
                <span className="text-[9px] text-neutral-500 hidden group-open:inline uppercase font-bold tracking-widest bg-neutral-950/60 border border-neutral-800 px-2 py-0.5 rounded">
                  Collapse Info
                </span>
              </summary>
              <ul className="list-disc pl-4 mt-3 space-y-2 leading-relaxed text-[11px] group-open:animate-fadeIn">
                <li>
                  <strong className="text-white">Multi-Synthesizer Core:</strong> Added dynamic voice registers. Each synth track handles its own independent oscillator nodes and effects buses.
                </li>
                <li>
                  <strong className="text-white">Dials Selection Mapping:</strong> Changing parameter controls on the hardware deck auto-routs signals to the currently focused synth track.
                </li>
                <li>
                  <strong className="text-white">Pure Client-Side Synthesis:</strong> Sample buffers are dynamically written in-memory on startup. No external network request blocks.
                </li>
                <li>
                  <strong className="text-white">Dual-Path DSP Transcriber:</strong> Zero Crossing Rates separate hi-hat noise from bass impacts. Fundamental frequencies use autocorrelation over the vocal register.
                </li>
                <li>
                  <strong className="text-white">Active Neural Inference:</strong> The Magenta RNN model executes in your local browser sandbox to syncopate focused track states.
                </li>
              </ul>
            </details>

          </section>

        </div>

        {/* ROW 3: PRESETS LIBRARY & IMPORT/EXPORT TERMINAL */}
        <section aria-label="TechnoForge Song & Preset Library">
          <LibraryControls
            currentSequencerState={sequencerState}
            currentBpm={bpm}
            currentCutoff={cutoff}
            currentResonance={resonance}
            currentDistortion={distortion}
            currentSidechainEnabled={sidechainEnabled}
            currentWaveform={waveform}
            currentDecay={decay}
            currentEnvMod={envMod}
            currentPortamento={portamento}
            currentDelayFeedback={delayFeedback}
            currentDelayMix={delayMix}
            onLoadSong={handleLoadSong}
            onLoadSound={handleLoadSound}
            onLoadTrack={handleLoadTrackPattern}
          />
        </section>

      </main>

      <footer className="max-w-6xl mx-auto w-full text-center border-t border-neutral-900 pt-6 mt-4 font-mono text-[10px] text-neutral-600 uppercase tracking-widest">
        TECHNOFORGE AI STUDIO © 2026 // DESIGNED FOR ULTRA LOW LATENCY LOCAL MUSIC INFERENCE
      </footer>

    </div>
  );
}
