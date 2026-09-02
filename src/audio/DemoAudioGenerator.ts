/**
 * Procedural Music & Audio Generator for Demo Tracks
 * Generates polyphonic musical arrangements using Web Audio API nodes.
 * Guarantees zero asset loading delays and immediate playback.
 */

export type DemoTrackCategory = 'cosmic' | 'electronic' | 'classical' | 'organic' | 'vocal';

export interface DemoTrack {
  id: string;
  name: string;
  category: DemoTrackCategory;
  genre: string;
  bpm: number;
  description: string;
}

export class DemoAudioGenerator {
  private ctx: AudioContext;
  private masterGain: GainNode;
  private activeTrackId: string | null = null;
  private lastTrackId: string = 'cosmic-odyssey';
  private isRunning = false;
  private stepTimer: number | null = null;
  private stepIndex = 0;

  // Cached reusable noise buffers for high-performance zero-GC synthesis
  private whiteNoiseBuffer: AudioBuffer | null = null;
  private pinkNoiseBuffer: AudioBuffer | null = null;

  // Active voice nodes for cleanup and memory safety
  private activeNodes: (AudioNode & { stop?: (when?: number) => void })[] = [];

  public static readonly TRACKS: DemoTrack[] = [
    // Category 1: Cosmic & Ambient
    {
      id: 'cosmic-odyssey',
      name: 'Cosmic Odyssey',
      category: 'cosmic',
      genre: 'Deep Space Ambient',
      bpm: 84,
      description: 'Deep sub-bass, atmospheric chords, and crystalline harmonic arpeggios.',
    },
    {
      id: 'event-horizon',
      name: 'Event Horizon',
      category: 'cosmic',
      genre: 'Dark Gravitational Drone',
      bpm: 56,
      description: 'Ultra-low sub-audible gravitational rumbles, Phrygian beat interference, and cosmic wind.',
    },
    {
      id: 'nebula-cloudscape',
      name: 'Nebula Cloudscape',
      category: 'cosmic',
      genre: 'Ethereal Space Ambient',
      bpm: 72,
      description: 'Shimmering Lydian modal chords, celestial pads, and warm chorus modulation.',
    },

    // Category 2: Electronic & Beats
    {
      id: 'cyber-pulse',
      name: 'Cyber Pulse',
      category: 'electronic',
      genre: 'Cyberpunk Synthwave',
      bpm: 124,
      description: 'Punchy kick rhythm, driving 16th bassline, and resonant synth leads.',
    },
    {
      id: 'quantum-glitch',
      name: 'Quantum Glitch',
      category: 'electronic',
      genre: 'IDM Breakbeat',
      bpm: 138,
      description: 'Polyrhythmic breakbeats, FM glitch percussions, pitch clicks, and 808 sub-booms.',
    },
    {
      id: 'neon-cybernetics',
      name: 'Neon Cybernetics',
      category: 'electronic',
      genre: 'Acid Techno & Cyber',
      bpm: 132,
      description: 'Resonant 303 acid basslines with real-time filter sweeps and industrial kicks.',
    },

    // Category 3: Classical & Acoustic
    {
      id: 'quantum-symphony',
      name: 'Harmonic Symphony',
      category: 'classical',
      genre: 'Chamber Orchestral',
      bpm: 108,
      description: 'Layered melodic strings, warm orchestral pads, and dynamic frequency sweeps.',
    },
    {
      id: 'celestial-harp',
      name: 'Celestial Harp',
      category: 'classical',
      genre: 'Concert Harp & Cello',
      bpm: 96,
      description: 'Cascading acoustic harp arpeggios, natural wood body damping, and deep cello.',
    },
    {
      id: 'baroque-resonance',
      name: 'Baroque Resonance',
      category: 'classical',
      genre: 'Pipe Organ & Harpsichord',
      bpm: 100,
      description: 'Cathedral pipe organ multi-rank harmonics and bright Bach-style counterpoint.',
    },

    // Category 4: Organic & Natural
    {
      id: 'ocean-bioluminescence',
      name: 'Ocean Bioluminescence',
      category: 'organic',
      genre: 'Submarine Hydro-Acoustic',
      bpm: 54,
      description: 'Low-frequency tidal surges, hydro-acoustic drones, water droplets, and whale calls.',
    },
    {
      id: 'forest-canopy',
      name: 'Forest Canopy',
      category: 'organic',
      genre: 'Bio-Acoustic Kalimba',
      bpm: 88,
      description: 'Wooden kalimba tines, rhythmic leaf rustling, bird calls, and warm earth tones.',
    },
    {
      id: 'primal-earth',
      name: 'Primal Shamanic Earth',
      category: 'organic',
      genre: 'Frame Drum & Didgeridoo',
      bpm: 78,
      description: 'Resonant leather frame drum, circular-breathing didgeridoo formants, and shakers.',
    },

    // Category 5: Vocal & Meditation
    {
      id: 'solfeggio-528',
      name: '528 Hz Ambient Drone',
      category: 'vocal',
      genre: 'Sacred Solfeggio',
      bpm: 60,
      description: '528 Hz pure tone with warm harmonic overtones, singing bowls, and alpha entrainment.',
    },
    {
      id: 'monastic-chant',
      name: 'Gregorian Monastic Chant',
      category: 'vocal',
      genre: 'Formant Choir & Cathedral',
      bpm: 64,
      description: 'Polyphonic vowel-formant choir synthesizing authentic monastic Latin chants and monk drone.',
    },
    {
      id: 'om-crystal-bowls',
      name: 'OM & Crystal Bowls',
      category: 'vocal',
      genre: '432 Hz OM Alchemy',
      bpm: 52,
      description: 'Deep 432 Hz OM throat resonance, overtone harmonics, quartz crystal bowls, and prana breath.',
    },
  ];

  public getIsPlaying(): boolean {
    return this.isRunning;
  }

  constructor(audioContext: AudioContext, destination: AudioNode) {
    this.ctx = audioContext;
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.8, this.ctx.currentTime);
    this.masterGain.connect(destination);
    this.initNoiseBuffers();
  }

  private initNoiseBuffers(): void {
    try {
      const sampleRate = this.ctx.sampleRate || 44100;
      const bufferLength = Math.floor(sampleRate * 2.0); // 2 second reusable loops

      // 1. White Noise Buffer
      this.whiteNoiseBuffer = this.ctx.createBuffer(1, bufferLength, sampleRate);
      const whiteData = this.whiteNoiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferLength; i++) {
        whiteData[i] = Math.random() * 2 - 1;
      }

      // 2. Pink Noise Buffer (Paul Kellet's filtered method)
      this.pinkNoiseBuffer = this.ctx.createBuffer(1, bufferLength, sampleRate);
      const pinkData = this.pinkNoiseBuffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferLength; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        pinkData[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
      }
    } catch {
      // Audio context might be mocked in tests
    }
  }

  public play(trackId?: string): void {
    const selectedId = trackId || this.lastTrackId || 'cosmic-odyssey';
    this.stop();
    this.activeTrackId = selectedId;
    this.lastTrackId = selectedId;
    this.isRunning = true;
    this.stepIndex = 0;

    const track = DemoAudioGenerator.TRACKS.find(t => t.id === selectedId) || DemoAudioGenerator.TRACKS[0];
    const intervalMs = (60 / track.bpm / 4) * 1000; // 16th notes

    this.stepTimer = window.setInterval(() => {
      if (!this.isRunning) return;
      this.tickStep(track.id, this.stepIndex);
      this.stepIndex = (this.stepIndex + 1) % 64;
    }, intervalMs);
  }

  public stop(): void {
    this.isRunning = false;
    if (this.stepTimer !== null) {
      clearInterval(this.stepTimer);
      this.stepTimer = null;
    }
    this.activeNodes.forEach(node => {
      try {
        if (typeof node.stop === 'function') node.stop();
        node.disconnect();
      } catch {}
    });
    this.activeNodes = [];
    this.activeTrackId = null;
  }

  private tickStep(trackId: string, step: number): void {
    const now = this.ctx.currentTime;

    switch (trackId) {
      // Cosmic & Ambient
      case 'cosmic-odyssey':
        this.stepCosmicOdyssey(step, now);
        break;
      case 'event-horizon':
        this.stepEventHorizon(step, now);
        break;
      case 'nebula-cloudscape':
        this.stepNebulaCloudscape(step, now);
        break;

      // Electronic & Beats
      case 'cyber-pulse':
        this.stepCyberPulse(step, now);
        break;
      case 'quantum-glitch':
        this.stepQuantumGlitch(step, now);
        break;
      case 'neon-cybernetics':
        this.stepNeonCybernetics(step, now);
        break;

      // Classical & Acoustic
      case 'quantum-symphony':
        this.stepQuantumSymphony(step, now);
        break;
      case 'celestial-harp':
        this.stepCelestialHarp(step, now);
        break;
      case 'baroque-resonance':
        this.stepBaroqueResonance(step, now);
        break;

      // Organic & Natural
      case 'ocean-bioluminescence':
        this.stepOceanBioluminescence(step, now);
        break;
      case 'forest-canopy':
        this.stepForestCanopy(step, now);
        break;
      case 'primal-earth':
        this.stepPrimalEarth(step, now);
        break;

      // Vocal & Meditation
      case 'solfeggio-528':
        this.stepSolfeggio(step, now);
        break;
      case 'monastic-chant':
        this.stepMonasticChant(step, now);
        break;
      case 'om-crystal-bowls':
        this.stepOmCrystalBowls(step, now);
        break;

      default:
        this.stepCosmicOdyssey(step, now);
    }
  }

  // =========================================================================
  // Track 1: Cosmic Odyssey (Ambient Synth, 84 BPM)
  // =========================================================================
  private stepCosmicOdyssey(step: number, now: number): void {
    const chordIndex = Math.floor(step / 16);
    const chords = [
      [220, 261.63, 329.63, 440],   // Am
      [174.61, 220, 261.63, 349.23], // F
      [130.81, 164.81, 196, 261.63], // C
      [196, 246.94, 293.66, 392],    // G
    ];
    const currentChord = chords[chordIndex % chords.length];

    if (step % 8 === 0) {
      const root = currentChord[0] / 2;
      this.triggerSubBass(root, 0.9, 0.8, now);
    }

    if (step % 16 === 0) {
      this.triggerAmbientPad(currentChord, 3.5, now);
    }

    if (step % 2 === 0) {
      const arpNote = currentChord[(step / 2) % currentChord.length] * 2;
      this.triggerBell(arpNote, 0.2, 0.3, now);
    }
  }

  // =========================================================================
  // Track 2: Event Horizon (Dark Gravitational Drone, 56 BPM)
  // =========================================================================
  private stepEventHorizon(step: number, now: number): void {
    // Phrygian Drone: D1 (36.71 Hz), Eb1 (38.89 Hz), A1 (55.00 Hz)
    if (step % 32 === 0) {
      this.triggerSubBass(36.71, 4.5, 0.85, now);
      this.triggerSineTone(37.21, 4.5, 0.35, now); // 0.5 Hz gravitational beat
      this.triggerNoiseSweep(80, 2400, 4.0, 0.15, now);
    }

    if (step % 16 === 0) {
      const rootNotes = [73.42, 77.78, 110.00, 146.83];
      const note = rootNotes[(step / 16) % rootNotes.length];
      this.triggerAmbientPad([note, note * 1.5, note * 2.0], 3.8, now);
    }

    if (step % 8 === 4) {
      this.triggerBell(622.25, 0.8, 0.18, now); // Eb5 dissonant shimmer
    }
  }

  // =========================================================================
  // Track 3: Nebula Cloudscape (Ethereal Space Ambient, 72 BPM)
  // =========================================================================
  private stepNebulaCloudscape(step: number, now: number): void {
    const lydianChords = [
      [185.00, 233.08, 261.63, 369.99], // F#maj7#11
      [207.65, 261.63, 311.13, 415.30], // G#6
      [233.08, 277.18, 349.23, 466.16], // A#m7
      [246.94, 311.13, 369.99, 493.88], // Bmaj7
    ];
    const chord = lydianChords[Math.floor(step / 16) % lydianChords.length];

    if (step % 16 === 0) {
      this.triggerAmbientPad(chord, 4.2, now);
      this.triggerSubBass(chord[0] / 2, 2.0, 0.6, now);
    }

    // High polyrhythmic celestial sparkles
    if (step % 3 === 0) {
      const note = chord[(step % chord.length)] * 2;
      this.triggerBell(note, 0.35, 0.22, now);
    }
  }

  // =========================================================================
  // Track 4: Cyber Pulse (Cyberpunk Synthwave, 124 BPM)
  // =========================================================================
  private stepCyberPulse(step: number, now: number): void {
    if (step % 4 === 0) {
      this.triggerPunchyKick(now);
    }

    if (step % 8 === 4) {
      this.triggerSnareClap(now);
    }

    if (step % 2 === 1) {
      this.triggerHiHat(now, step % 4 === 3 ? 0.25 : 0.15);
    }

    const bassNotes = [73.42, 73.42, 146.83, 73.42, 87.31, 73.42, 110, 98];
    const note = bassNotes[step % bassNotes.length];
    this.triggerSynthBass(note, 0.18, 0.5, now);

    if (step % 4 === 0 && Math.random() > 0.3) {
      const leadNotes = [293.66, 349.23, 392.00, 440.00, 523.25, 587.33];
      const leadNote = leadNotes[Math.floor(Math.random() * leadNotes.length)];
      this.triggerPluckLead(leadNote, 0.4, 0.35, now);
    }
  }

  // =========================================================================
  // Track 5: Quantum Glitch (IDM Breakbeat, 138 BPM)
  // =========================================================================
  private stepQuantumGlitch(step: number, now: number): void {
    // Syncopated 808 Sub Kick on Euclidean steps: 0, 6, 10, 16, 22, 26, 28
    const kickSteps = [0, 6, 10, 16, 22, 26, 28];
    if (kickSteps.includes(step % 32)) {
      this.trigger808Sub(now);
    }

    // Glitch Percussions on syncopated 16th triplets
    if (step % 4 === 2 || step % 7 === 0) {
      this.triggerGlitchPerc(880 * (1 + (step % 5) * 0.4), now);
    }

    if (step % 8 === 4) {
      this.triggerSnareClap(now);
    }

    if (step % 2 === 1) {
      this.triggerHiHat(now, 0.18);
    }

    // Melodic Micro-stabs (C Dorian: 130.81, 155.56, 196.00, 233.08)
    if (step % 8 === 0 || step % 8 === 3) {
      const notes = [130.81, 155.56, 196.00, 233.08];
      this.triggerPluckLead(notes[(step / 3) % notes.length] * 2, 0.15, 0.3, now);
    }
  }

  // =========================================================================
  // Track 6: Neon Cybernetics (Acid Techno & Cyber, 132 BPM)
  // =========================================================================
  private stepNeonCybernetics(step: number, now: number): void {
    // 4-on-the-floor heavy kick
    if (step % 4 === 0) {
      this.triggerPunchyKick(now);
    }

    // Offbeat open hi-hat
    if (step % 4 === 2) {
      this.triggerHiHat(now, 0.28);
    }

    // TB-303 Acid line: E Minor (82.41, 98.00, 110.00, 123.47, 146.83, 164.81)
    const acidPattern = [82.41, 82.41, 164.81, 98.00, 82.41, 123.47, 146.83, 82.41];
    const acidNote = acidPattern[step % acidPattern.length];
    const isAccented = step % 8 === 0 || step % 8 === 3 || step % 8 === 6;
    this.triggerAcidBass(acidNote, isAccented ? 2800 : 900, 0.16, isAccented ? 0.6 : 0.4, now);

    // Supersaw Pluck
    if (step % 16 === 8) {
      this.triggerSupersawLead(329.63, 0.4, 0.35, now);
    }
  }

  // =========================================================================
  // Track 7: Quantum Symphony (Chamber Orchestral, 108 BPM)
  // =========================================================================
  private stepQuantumSymphony(step: number, now: number): void {
    const scales = [
      [146.83, 220.00, 293.66, 369.99, 440.00], // D Maj
      [164.81, 246.94, 329.63, 392.00, 493.88], // E Min
      [196.00, 293.66, 392.00, 493.88, 587.33], // G Maj
      [220.00, 329.63, 440.00, 554.37, 659.25], // A Maj
    ];
    const currentScale = scales[Math.floor(step / 16) % scales.length];

    if (step % 16 === 0) {
      this.triggerOrchestralPad(currentScale, 4.0, now);
    }

    if (step % 2 === 0) {
      const idx = (step / 2) % currentScale.length;
      this.triggerPluckLead(currentScale[idx] * 2, 0.3, 0.3, now);
    }

    if (step % 8 === 0) {
      this.triggerSubBass(currentScale[0] / 2, 1.2, 0.7, now);
    }
  }

  // =========================================================================
  // Track 8: Celestial Harp (Concert Harp & Cello, 96 BPM)
  // =========================================================================
  private stepCelestialHarp(step: number, now: number): void {
    const gMajorPent = [196.00, 220.00, 246.94, 293.66, 329.63, 392.00, 440.00, 493.88, 587.33, 659.25];
    
    // Cascading harp arpeggios on every 16th step
    const noteIdx = (step % 16 < 8) ? (step % 8) : (15 - (step % 16));
    const harpNote = gMajorPent[noteIdx % gMajorPent.length];
    this.triggerStringHarp(harpNote, 0.6, 0.35, now);

    // Deep Cello Bass on downbeats
    if (step % 16 === 0) {
      const celloRoots = [98.00, 110.00, 130.81, 146.83];
      const root = celloRoots[(step / 16) % celloRoots.length];
      this.triggerOrchestralPad([root, root * 1.5], 3.8, now);
    }
  }

  // =========================================================================
  // Track 9: Baroque Resonance (Pipe Organ & Harpsichord, 100 BPM)
  // =========================================================================
  private stepBaroqueResonance(step: number, now: number): void {
    const gMinorScale = [98.00, 116.54, 146.83, 196.00, 233.08, 293.66, 392.00];

    // Cathedral Pipe Organ on every 8 steps
    if (step % 8 === 0) {
      const root = gMinorScale[(step / 8) % 4];
      this.triggerOrganPipe(root, 1.8, 0.45, now);
      this.triggerSubBass(root / 2, 1.6, 0.65, now);
    }

    // Harpsichord Counterpoint Pluck on 16th notes
    if (step % 2 === 0) {
      const note = gMinorScale[(step * 2) % gMinorScale.length];
      this.triggerPluckLead(note * 2, 0.18, 0.3, now);
    }
  }

  // =========================================================================
  // Track 10: Ocean Bioluminescence (Submarine Hydro-Acoustic, 54 BPM)
  // =========================================================================
  private stepOceanBioluminescence(step: number, now: number): void {
    // Ocean surf pink noise swell every 24 steps
    if (step % 24 === 0) {
      this.triggerNoiseSweep(150, 1800, 4.5, 0.22, now);
    }

    // Hydro-drone sub throb
    if (step % 16 === 0) {
      this.triggerSubBass(41.20, 3.5, 0.75, now);
      this.triggerSineTone(41.65, 3.5, 0.3, now); // 0.45 Hz underwater wave throb
    }

    // Water droplet sploshes
    if (step % 4 === 1 || step % 7 === 3) {
      const dropFreq = 1200 + ((step * 173) % 1800);
      this.triggerWaterDroplet(dropFreq, now);
    }

    // Singing Whale Call
    if (step === 16 || step === 44) {
      this.triggerSineTone(165, 3.0, 0.25, now);
    }
  }

  // =========================================================================
  // Track 11: Forest Canopy (Bio-Acoustic Kalimba, 88 BPM)
  // =========================================================================
  private stepForestCanopy(step: number, now: number): void {
    const kalimbaNotes = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33];

    // Polyrhythmic Kalimba Tines
    if (step % 3 === 0 || step % 4 === 2) {
      const note = kalimbaNotes[(step * 3) % kalimbaNotes.length];
      this.triggerKalimbaTine(note, 0.7, 0.4, now);
    }

    // Earth drone on downbeats
    if (step % 16 === 0) {
      this.triggerSubBass(65.41, 2.5, 0.6, now);
      this.triggerAmbientPad([130.81, 196.00, 261.63], 3.2, now);
    }

    // Bird chirps
    if (step === 6 || step === 22 || step === 46) {
      this.triggerWaterDroplet(3400 + (step * 80), now);
    }
  }

  // =========================================================================
  // Track 12: Primal Shamanic Earth (Frame Drum & Didgeridoo, 78 BPM)
  // =========================================================================
  private stepPrimalEarth(step: number, now: number): void {
    // Shamanic Frame Drum on steps 0, 3, 8, 10
    if (step % 16 === 0 || step % 16 === 3 || step % 16 === 8 || step % 16 === 10) {
      this.triggerFrameDrum(now);
    }

    // Shaker groove on 16th notes
    if (step % 2 === 1) {
      this.triggerHiHat(now, step % 4 === 3 ? 0.22 : 0.12);
    }

    // Didgeridoo Formant Drone (69.3 Hz C#2)
    if (step % 16 === 0) {
      this.triggerDidgeridoo(69.30, 3.2, 0.5, now);
    }
  }

  // =========================================================================
  // Track 13: Solfeggio 528Hz Meditation (Sacred Solfeggio, 60 BPM)
  // =========================================================================
  private stepSolfeggio(step: number, now: number): void {
    if (step === 0 || step === 32) {
      // 528Hz Pure Solfeggio Tone & Harmonics
      this.triggerSineTone(528, 4.0, 0.5, now);
      this.triggerSineTone(528 * 1.5, 4.0, 0.2, now); // Fifth (792 Hz)
      this.triggerSineTone(528 * 2, 4.0, 0.15, now);  // Octave (1056 Hz)
      this.triggerSineTone(264, 4.0, 0.4, now);        // Sub-octave (264 Hz)
    }

    if (step % 8 === 0) {
      this.triggerSingingBowl(528 * (1 + (step / 8) * 0.1), 2.5, 0.25, now);
    }
  }

  // =========================================================================
  // Track 14: Gregorian Monastic Chant (Formant Choir, 64 BPM)
  // =========================================================================
  private stepMonasticChant(step: number, now: number): void {
    // D Dorian chant melodies: D3 (146.83), F3 (174.61), G3 (196.00), A3 (220.00)
    const chantNotes = [146.83, 174.61, 196.00, 220.00, 196.00, 174.61, 164.81, 146.83];
    const phraseIdx = Math.floor(step / 8) % chantNotes.length;
    const currentNote = chantNotes[phraseIdx];

    if (step % 8 === 0) {
      // Vowel formants /O/ (500, 900 Hz) and /A/ (700, 1200 Hz)
      this.triggerVocalChant(currentNote, step % 16 === 0 ? 500 : 700, 2.8, 0.45, now);
    }

    if (step % 16 === 0) {
      // Deep Monk Sub-Bass
      this.triggerSubBass(73.42, 3.5, 0.65, now);
    }
  }

  // =========================================================================
  // Track 15: OM & Crystal Bowls (432 Hz OM Alchemy, 52 BPM)
  // =========================================================================
  private stepOmCrystalBowls(step: number, now: number): void {
    // 432 Hz Verdi Tuning OM Fundamental & Overtones
    if (step % 16 === 0) {
      this.triggerSineTone(108.00, 4.5, 0.6, now); // Sub-fundamental OM
      this.triggerSineTone(216.00, 4.5, 0.45, now); // Root OM
      this.triggerSingingBowl(432.00, 4.8, 0.35, now); // 432 Hz Quartz Crystal Bowl
    }

    if (step % 8 === 4) {
      this.triggerBell(864.00, 1.8, 0.2, now); // Harmonic overtone
    }

    // Prana breath noise swell every 32 steps
    if (step % 32 === 0) {
      this.triggerNoiseSweep(200, 1100, 5.0, 0.18, now);
    }
  }

  // =========================================================================
  // Core Procedural Voice Synthesis Helpers
  // =========================================================================

  private triggerSubBass(freq: number, duration: number, gainVal: number, now: number): void {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * 1.5, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq), now + 0.08);

    gain.gain.setValueAtTime(gainVal, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + duration);
    this.trackVoice(osc, gain);
  }

  private triggerPunchyKick(now: number): void {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(35, now + 0.12);

    gain.gain.setValueAtTime(1.0, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.3);
    this.trackVoice(osc, gain);
  }

  private trigger808Sub(now: number): void {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(32, now + 0.18);

    gain.gain.setValueAtTime(1.0, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.65);
    this.trackVoice(osc, gain);
  }

  private triggerFrameDrum(now: number): void {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(95, now);
    osc.frequency.exponentialRampToValueAtTime(46, now + 0.12);

    gain.gain.setValueAtTime(0.9, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.45);
    this.trackVoice(osc, gain);
  }

  private triggerGlitchPerc(freq: number, now: number): void {
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq * 1.8, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 0.3), now + 0.04);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(freq, now);
    filter.Q.setValueAtTime(6.0, now);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.05);
    this.trackVoice(osc, filter, gain);
  }

  private triggerSnareClap(now: number): void {
    let noise: AudioBufferSourceNode;
    if (this.whiteNoiseBuffer) {
      noise = this.ctx.createBufferSource();
      noise.buffer = this.whiteNoiseBuffer;
    } else {
      const bufferSize = Math.floor(this.ctx.sampleRate * 0.15);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
    }

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1800;
    filter.Q.value = 1.2;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.6, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noise.start(now);
    noise.stop(now + 0.15);
    this.trackVoice(noise, filter, gain);
  }

  private triggerHiHat(now: number, vol = 0.2): void {
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(8000, now);

    filter.type = 'highpass';
    filter.frequency.value = 7000;

    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.05);
    this.trackVoice(osc, filter, gain);
  }

  private triggerSynthBass(freq: number, duration: number, vol: number, now: number): void {
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, now);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, now);
    filter.frequency.exponentialRampToValueAtTime(150, now + duration);

    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + duration);
    this.trackVoice(osc, filter, gain);
  }

  private triggerAcidBass(freq: number, cutoff: number, duration: number, vol: number, now: number): void {
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, now);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoff, now);
    filter.frequency.exponentialRampToValueAtTime(200, now + duration);
    filter.Q.setValueAtTime(8.0, now);

    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + duration);
    this.trackVoice(osc, filter, gain);
  }

  private triggerPluckLead(freq: number, duration: number, vol: number, now: number): void {
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, now);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(3500, now);
    filter.frequency.exponentialRampToValueAtTime(400, now + duration);

    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + duration);
    this.trackVoice(osc, filter, gain);
  }

  private triggerSupersawLead(freq: number, duration: number, vol: number, now: number): void {
    [-12, 0, 12].forEach(detuneCents => {
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq * Math.pow(2, detuneCents / 1200), now);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2400, now);

      gain.gain.setValueAtTime(vol / 3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + duration);
      this.trackVoice(osc, filter, gain);
    });
  }

  private triggerStringHarp(freq: number, duration: number, vol: number, now: number): void {
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2800, now);
    filter.frequency.exponentialRampToValueAtTime(600, now + duration);

    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + duration);
    this.trackVoice(osc, filter, gain);
  }

  private triggerOrganPipe(freq: number, duration: number, vol: number, now: number): void {
    [1.0, 2.0, 3.0].forEach((multiplier, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq * multiplier, now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(vol / (idx + 1), now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + duration);
      this.trackVoice(osc, gain);
    });
  }

  private triggerKalimbaTine(freq: number, duration: number, vol: number, now: number): void {
    const osc = this.ctx.createOscillator();
    const oscOvertone = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);

    oscOvertone.type = 'sine';
    oscOvertone.frequency.setValueAtTime(freq * 2.98, now);

    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    oscOvertone.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    oscOvertone.start(now);
    osc.stop(now + duration);
    oscOvertone.stop(now + duration);
    this.trackVoice(osc, oscOvertone, gain);
  }

  private triggerWaterDroplet(freq: number, now: number): void {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.8, now + 0.04);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.06);
    this.trackVoice(osc, gain);
  }

  private triggerDidgeridoo(freq: number, duration: number, vol: number, now: number): void {
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, now);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(450, now);
    filter.Q.setValueAtTime(3.5, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(vol, now + 0.2);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + duration);
    this.trackVoice(osc, filter, gain);
  }

  private triggerVocalChant(freq: number, formantCutoff: number, duration: number, vol: number, now: number): void {
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, now);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(formantCutoff, now);
    filter.Q.setValueAtTime(5.0, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(vol, now + 0.4);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + duration);
    this.trackVoice(osc, filter, gain);
  }

  private triggerNoiseSweep(startFreq: number, endFreq: number, duration: number, vol: number, now: number): void {
    let noise: AudioBufferSourceNode;
    if (this.pinkNoiseBuffer || this.whiteNoiseBuffer) {
      noise = this.ctx.createBufferSource();
      noise.buffer = (this.pinkNoiseBuffer || this.whiteNoiseBuffer)!;
    } else {
      const bufferSize = Math.floor(this.ctx.sampleRate * 0.5);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
    }

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(startFreq, now);
    filter.frequency.linearRampToValueAtTime(endFreq, now + duration * 0.5);
    filter.frequency.linearRampToValueAtTime(startFreq, now + duration);
    filter.Q.setValueAtTime(2.0, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(vol, now + duration * 0.3);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noise.start(now);
    noise.stop(now + duration);
    this.trackVoice(noise, filter, gain);
  }

  private triggerBell(freq: number, duration: number, vol: number, now: number): void {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + duration);
    this.trackVoice(osc, gain);
  }

  private triggerSineTone(freq: number, duration: number, vol: number, now: number): void {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);

    const targetVol = Math.max(0.0001, vol);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(targetVol, now + 0.8);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + duration);
    this.trackVoice(osc, gain);
  }

  private triggerSingingBowl(freq: number, duration: number, vol: number, now: number): void {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + duration);
    this.trackVoice(osc, gain);
  }

  private triggerAmbientPad(notes: number[], duration: number, now: number): void {
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.12, now + 1.2);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + duration);
      this.trackVoice(osc, gain);
    });
  }

  private triggerOrchestralPad(notes: number[], duration: number, now: number): void {
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(400 + idx * 200, now);
      filter.frequency.linearRampToValueAtTime(1500, now + duration * 0.5);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.08, now + 0.8);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + duration);
      this.trackVoice(osc, filter, gain);
    });
  }

  private trackVoice(source: AudioNode, ...extraNodes: AudioNode[]): void {
    const allVoiceNodes = [source, ...extraNodes];
    this.activeNodes.push(...allVoiceNodes);

    const cleanup = () => {
      allVoiceNodes.forEach(node => {
        try {
          if (typeof (node as any).stop === 'function') (node as any).stop();
          node.disconnect();
        } catch {}
      });
      this.activeNodes = this.activeNodes.filter(n => !allVoiceNodes.includes(n));
    };

    if ('onended' in source) {
      (source as any).onended = cleanup;
    }

    if (this.activeNodes.length > 128) {
      const old = this.activeNodes.shift();
      try {
        if (old && typeof (old as any).stop === 'function') (old as any).stop();
        old?.disconnect();
      } catch {}
    }
  }

  public getIsRunning(): boolean {
    return this.isRunning;
  }

  public getActiveTrackId(): string {
    return this.activeTrackId || this.lastTrackId || 'cosmic-odyssey';
  }

  public getLastTrackId(): string {
    return this.lastTrackId;
  }
}
