import React, { useState, useEffect, useRef } from 'react';
import * as Tone from 'tone';
import { Sliders, BrainCircuit, Mic, Waves, HelpCircle, RefreshCw, Volume2, Sparkles, MonitorPlay } from 'lucide-react';
import { SequencerState, TrackType, DSPAnalysisResult } from './types';
import { generateAllSampleUrls } from './utils/audioGenerator';
import { loadMagentaModels, ModelsLoadingState, evolveMelodyWithMagenta, evolveDrumsWithMagenta } from './utils/magentaHelper';
import SequencerGrid from './components/SequencerGrid';
import AudioEngineControls from './components/AudioEngineControls';
import AIModelControls from './components/AIModelControls';
import VocalRecorder from './components/VocalRecorder';
import AudioVisualizer from './components/AudioVisualizer';

// Standard blank template for tracks
const createEmptySequencerState = (): SequencerState => ({
  tracks: [
    { name: 'Kick', steps: new Array(16).fill(false) },
    { name: 'HiHat', steps: new Array(16).fill(false) },
    { name: 'Clap', steps: new Array(16).fill(false) },
    { name: 'AcidSynth', steps: new Array(16).fill(false) }
  ],
  pitches: new Array(16).fill('C2')
});

export default function App() {
  // --- STATE ---
  const [sequencerState, setSequencerState] = useState<SequencerState>(createEmptySequencerState());
  const [activeStep, setActiveStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(128);
  const [cutoff, setCutoff] = useState(800);
  const [resonance, setResonance] = useState(6.0);
  const [distortion, setDistortion] = useState(0.35);
  const [sidechainEnabled, setSidechainEnabled] = useState(true);
  const [masterVolume, setMasterVolume] = useState(0.85);
  const [engineStarted, setEngineStarted] = useState(false);
  const [engineLoading, setEngineLoading] = useState(false);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);

  // Magenta model loading status
  const [modelsLoading, setModelsLoading] = useState<ModelsLoadingState>({
    melodyLoaded: false,
    drumsLoaded: false,
    loading: true,
    error: null
  });

  // --- AUDIO REFS (TO PREVENT RE-INITIALIZATION LATEST CLOSURE PROBLEMS) ---
  const samplerKickRef = useRef<Tone.Sampler | null>(null);
  const samplerHiHatRef = useRef<Tone.Sampler | null>(null);
  const samplerClapRef = useRef<Tone.Sampler | null>(null);
  const acidSynthRef = useRef<Tone.MonoSynth | null>(null);
  const distortionNodeRef = useRef<Tone.Distortion | null>(null);
  const filterNodeRef = useRef<Tone.Filter | null>(null);
  const duckingGainRef = useRef<Tone.Gain | null>(null);
  const volumeNodeRef = useRef<Tone.Volume | null>(null);
  const masterVolumeNodeRef = useRef<Tone.Volume | null>(null);

  // Refs for scheduler to access fresh state without closure stale lags
  const stateRef = useRef(sequencerState);
  const stepCounterRef = useRef(0);
  const sidechainEnabledRef = useRef(sidechainEnabled);

  useEffect(() => {
    stateRef.current = sequencerState;
  }, [sequencerState]);

  useEffect(() => {
    sidechainEnabledRef.current = sidechainEnabled;
  }, [sidechainEnabled]);

  // --- MAGENTA INITIALIZATION ON MOUNT ---
  useEffect(() => {
    loadMagentaModels((state) => {
      setModelsLoading(state);
    });

    // Cleanup Transport loop on unmount
    return () => {
      Tone.getTransport().stop();
      Tone.getTransport().cancel();
    };
  }, []);

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

      // 4. Create TB-303 Acid MonoSynth
      acidSynthRef.current = new Tone.MonoSynth({
        oscillator: { type: 'sawtooth' },
        envelope: {
          attack: 0.005,
          decay: 0.20,
          sustain: 0.10,
          release: 0.15
        },
        filterEnvelope: {
          attack: 0.008,
          decay: 0.22,
          sustain: 0.15,
          baseFrequency: 300,
          octaves: 3.2
        }
      });

      // 5. Create DSP effects chain
      distortionNodeRef.current = new Tone.Distortion(distortion);
      filterNodeRef.current = new Tone.Filter({
        type: 'lowpass',
        frequency: cutoff,
        Q: resonance
      });
      duckingGainRef.current = new Tone.Gain(1.0);
      volumeNodeRef.current = new Tone.Volume(-2); // Fixed Acid Synth volume level relative to master

      // 6. Connect Acid Synth Chain to Master Volume
      acidSynthRef.current.connect(distortionNodeRef.current);
      distortionNodeRef.current.connect(filterNodeRef.current);
      filterNodeRef.current.connect(duckingGainRef.current);
      duckingGainRef.current.connect(volumeNodeRef.current);
      volumeNodeRef.current.connect(masterVolumeNodeRef.current);

      // 7. Schedule our 16-step interval Transport Loop
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

      // 1. Play Kick Drum
      if (currentState.tracks[0].steps[step] && samplerKickRef.current) {
        samplerKickRef.current.triggerAttackRelease('C2', '8n', time);
      }

      // 2. Play HiHat
      if (currentState.tracks[1].steps[step] && samplerHiHatRef.current) {
        samplerHiHatRef.current.triggerAttackRelease('C2', '8n', time);
      }

      // 3. Play Clap
      if (currentState.tracks[2].steps[step] && samplerClapRef.current) {
        samplerClapRef.current.triggerAttackRelease('C2', '8n', time);
      }

      // 4. Play TB-303 Acid Synth
      if (currentState.tracks[3].steps[step] && acidSynthRef.current) {
        const pitch = currentState.pitches[step];
        acidSynthRef.current.triggerAttackRelease(pitch, '16n', time);
      }

      // 5. 4/4 Kick Ducking Sidechain Gain Envelope Envelope
      if (sidechainEnabledRef.current && (step === 0 || step === 4 || step === 8 || step === 12)) {
        if (duckingGainRef.current) {
          duckingGainRef.current.gain.cancelScheduledValues(time);
          duckingGainRef.current.gain.setValueAtTime(1.0, time);
          duckingGainRef.current.gain.linearRampToValueAtTime(0.1, time + 0.02);
          duckingGainRef.current.gain.linearRampToValueAtTime(1.0, time + 0.17);
        }
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

  const updateCutoff = (newCutoff: number) => {
    setCutoff(newCutoff);
    if (filterNodeRef.current) {
      filterNodeRef.current.frequency.setValueAtTime(newCutoff, Tone.now());
    }
  };

  const updateResonance = (newQ: number) => {
    setResonance(newQ);
    if (filterNodeRef.current) {
      filterNodeRef.current.Q.setValueAtTime(newQ, Tone.now());
    }
  };

  const updateDistortion = (amount: number) => {
    setDistortion(amount);
    if (distortionNodeRef.current) {
      distortionNodeRef.current.distortion = amount;
    }
  };

  const updateMasterVolume = (vol: number) => {
    setMasterVolume(vol);
    if (masterVolumeNodeRef.current) {
      masterVolumeNodeRef.current.volume.value = Tone.gainToDb(vol);
    }
  };

  // --- MANUAL OVERRIDES ---
  const toggleStepManually = (trackName: TrackType, stepIdx: number) => {
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

    // Low-latency sound audition preview when manually clicking notes!
    if (!isPlaying && engineStarted) {
      if (trackName === 'Kick' && samplerKickRef.current) {
        samplerKickRef.current.triggerAttackRelease('C2', '8n');
      } else if (trackName === 'HiHat' && samplerHiHatRef.current) {
        samplerHiHatRef.current.triggerAttackRelease('C2', '8n');
      } else if (trackName === 'Clap' && samplerClapRef.current) {
        samplerClapRef.current.triggerAttackRelease('C2', '8n');
      } else if (trackName === 'AcidSynth' && acidSynthRef.current) {
        const pitch = sequencerState.pitches[stepIdx];
        acidSynthRef.current.triggerAttackRelease(pitch, '16n');
      }
    }
  };

  const updatePitchManually = (stepIdx: number, pitch: string) => {
    setSequencerState((prev) => {
      const updatedPitches = [...prev.pitches];
      updatedPitches[stepIdx] = pitch;
      return { ...prev, pitches: updatedPitches };
    });
  };

  const auditionNotePreview = (pitch: string) => {
    if (acidSynthRef.current && engineStarted) {
      acidSynthRef.current.triggerAttackRelease(pitch, '8n');
    }
  };

  const resetPattern = () => {
    setSequencerState(createEmptySequencerState());
  };

  // --- MAGENTA NEURAL NETWORK INFERENCE COUPLERS ---
  const handleEvolveMelody = async (temperature: number) => {
    const acidTrack = sequencerState.tracks.find(t => t.name === 'AcidSynth')!;
    const result = await evolveMelodyWithMagenta(acidTrack.steps, sequencerState.pitches, temperature);
    
    setSequencerState((prev) => {
      const updatedTracks = prev.tracks.map((t) => {
        if (t.name === 'AcidSynth') {
          return { ...t, steps: result.steps };
        }
        return t;
      });
      return {
        tracks: updatedTracks,
        pitches: result.pitches
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
        { name: 'Kick', steps: result.tracks.Kick },
        { name: 'HiHat', steps: result.tracks.HiHat },
        { name: 'Clap', steps: result.tracks.Clap },
        { name: 'AcidSynth', steps: result.tracks.AcidSynth }
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
    if (presetName === 'classicAcid') {
      // 4x4 Kick
      state.tracks[0].steps = [true, false, false, false, true, false, false, false, true, false, false, false, true, false, false, false];
      // Offbeat HiHat
      state.tracks[1].steps = [false, false, true, false, false, false, true, false, false, false, true, false, false, false, true, false];
      // Backbeat Clap
      state.tracks[2].steps = [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, false];
      // Acid Bouncing Bassline
      state.tracks[3].steps = [true, true, false, true, true, false, true, true, false, true, true, false, true, false, true, true];
      state.pitches = ['C2', 'C2', 'C2', 'D#2', 'C2', 'C2', 'G2', 'C2', 'C2', 'A#2', 'C2', 'C2', 'C3', 'C2', 'D#2', 'A#1'];
      setBpm(126);
      updateCutoff(950);
      updateResonance(8.5);
      updateDistortion(0.40);
    } else if (presetName === 'industrial') {
      // Syncopated heavy kick
      state.tracks[0].steps = [true, false, false, true, true, false, false, false, true, false, true, false, true, false, false, true];
      // Fast 16th hats
      state.tracks[1].steps = [true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true];
      // Backbeat claps
      state.tracks[2].steps = [false, false, false, false, true, false, false, false, false, false, false, false, true, false, true, false];
      // Rolling bassline
      state.tracks[3].steps = [true, false, true, false, true, false, true, false, true, false, true, false, true, false, true, false];
      state.pitches = ['A1', 'A1', 'C2', 'C2', 'D#2', 'D#2', 'A1', 'A1', 'G1', 'G1', 'A1', 'A1', 'C2', 'C2', 'A1', 'A1'];
      setBpm(132);
      updateCutoff(650);
      updateResonance(4.0);
      updateDistortion(0.65);
    }

    setSequencerState(state);
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
            Core Version: 1.0.0 // Architecture: Browser Sandbox • Fully Local Audio Graph
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
            onToggleStep={toggleStepManually}
            onUpdatePitch={updatePitchManually}
            onPreviewPitch={auditionNotePreview}
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
              onStartEngine={startAudioEngine}
              onTogglePlay={togglePlayback}
              onBpmChange={updateBpm}
              onCutoffChange={updateCutoff}
              onResonanceChange={updateResonance}
              onDistortionChange={updateDistortion}
              onSidechainToggle={setSidechainEnabled}
              onVolumeChange={updateMasterVolume}
              onResetPattern={resetPattern}
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

            {/* TECH DOCUMENTATION MANUAL */}
            <div id="tech-docs-card" className="bg-[#161622]/50 border border-neutral-900 p-5 rounded-none flex flex-col gap-3 font-mono text-xs text-neutral-400">
              <h4 className="text-[11px] font-bold tracking-widest text-neutral-300 uppercase flex items-center gap-1">
                <HelpCircle className="w-3.5 h-3.5 text-neutral-500" />
                SYSTEM MANUAL & HARDWARE SPECS
              </h4>
              <ul className="list-disc pl-4 space-y-1.5 leading-relaxed text-[11px]">
                <li>
                  <strong className="text-white">Pure Client-Side Synthesis:</strong> Sample buffers are dynamically written in-memory on startup. No external network request blocks.
                </li>
                <li>
                  <strong className="text-white">Dual-Path DSP Transcriber:</strong> Zero Crossing Rates separate hi-hat noise from bass impacts. Fundamental frequencies use autocorrelation over the vocal register.
                </li>
                <li>
                  <strong className="text-white">Active Neural Inference:</strong> The Magenta RNN model executes in your local browser sandbox to syncopate existing sequencer states.
                </li>
                <li>
                  <strong className="text-white">TB-303 Modeling:</strong> Monosynth is shaped by a high-resonance lowpass filter, overdrive distortion, and 4/4 sidechain ducking.
                </li>
              </ul>
            </div>

          </section>

        </div>

      </main>

      <footer className="max-w-6xl mx-auto w-full text-center border-t border-neutral-900 pt-6 mt-4 font-mono text-[10px] text-neutral-600 uppercase tracking-widest">
        TECHNOFORGE AI STUDIO © 2026 // DESIGNED FOR ULTRA LOW LATENCY LOCAL MUSIC INFERENCE
      </footer>

    </div>
  );
}
