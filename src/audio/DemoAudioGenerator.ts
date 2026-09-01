/**
 * Procedural Music & Audio Generator for Demo Tracks
 * Generates polyphonic musical arrangements using Web Audio API nodes.
 * Guarantees zero asset loading delays and immediate playback.
 */

export interface DemoTrack {
  id: string;
  name: string;
  genre: string;
  bpm: number;
  description: string;
}

export class DemoAudioGenerator {
  private ctx: AudioContext;
  private masterGain: GainNode;
  private activeTrackId: string | null = null;
  private isRunning = false;
  private stepTimer: number | null = null;
  private stepIndex = 0;

  // Active voice nodes for cleanup
  private activeNodes: (AudioNode & { stop?: (when?: number) => void })[] = [];

  public static readonly TRACKS: DemoTrack[] = [
    {
      id: 'cosmic-odyssey',
      name: '🌌 Cosmic Odyssey',
      genre: 'Ambient Space Synth',
      bpm: 90,
      description: 'Deep sub-bass pulses, ethereal chords, and crystalline harmonic arpeggios.',
    },
    {
      id: 'cyber-pulse',
      name: '⚡ Cyber Pulse',
      genre: 'Synthwave / Electronic',
      bpm: 124,
      description: 'Punchy kick transients, driving bassline, and bright resonant leads.',
    },
    {
      id: 'solfeggio-528',
      name: '💎 Solfeggio 528Hz Healing',
      genre: 'Harmonic Meditation',
      bpm: 60,
      description: 'Pure 528Hz transformation tone with singing bowl overtones and gentle wave modulation.',
    },
    {
      id: 'quantum-symphony',
      name: '🔮 Quantum Symphony',
      genre: 'Progressive Harmonic',
      bpm: 110,
      description: 'Multi-harmonic orchestral pads and dynamic filter sweeps across the full spectrum.',
    },
  ];

  constructor(audioContext: AudioContext, destination: AudioNode) {
    this.ctx = audioContext;
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.8, this.ctx.currentTime);
    this.masterGain.connect(destination);
  }

  public play(trackId: string): void {
    this.stop();
    this.activeTrackId = trackId;
    this.isRunning = true;
    this.stepIndex = 0;

    const track = DemoAudioGenerator.TRACKS.find(t => t.id === trackId) || DemoAudioGenerator.TRACKS[0];
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
      case 'cosmic-odyssey':
        this.stepCosmicOdyssey(step, now);
        break;
      case 'cyber-pulse':
        this.stepCyberPulse(step, now);
        break;
      case 'solfeggio-528':
        this.stepSolfeggio(step, now);
        break;
      case 'quantum-symphony':
        this.stepQuantumSymphony(step, now);
        break;
      default:
        this.stepCosmicOdyssey(step, now);
    }
  }

  // --- Track 1: Cosmic Odyssey ---
  private stepCosmicOdyssey(step: number, now: number): void {
    // Chord progression: Am -> F -> C -> G (changes every 16 steps)
    const chordIndex = Math.floor(step / 16);
    const chords = [
      [220, 261.63, 329.63, 440],   // Am
      [174.61, 220, 261.63, 349.23], // F
      [130.81, 164.81, 196, 261.63], // C
      [196, 246.94, 293.66, 392],    // G
    ];
    const currentChord = chords[chordIndex % chords.length];

    // Sub-bass hit on 1, 9
    if (step % 8 === 0) {
      const root = currentChord[0] / 2;
      this.triggerSubBass(root, 0.9, 0.8, now);
    }

    // Pad swell on step 0, 16, 32, 48
    if (step % 16 === 0) {
      this.triggerAmbientPad(currentChord, 3.5, now);
    }

    // Crystalline Bell Arpeggio on 16th notes
    if (step % 2 === 0) {
      const arpNote = currentChord[(step / 2) % currentChord.length] * 2;
      this.triggerBell(arpNote, 0.2, 0.3, now);
    }
  }

  // --- Track 2: Cyber Pulse ---
  private stepCyberPulse(step: number, now: number): void {
    // 4-on-the-floor kick
    if (step % 4 === 0) {
      this.triggerPunchyKick(now);
    }

    // Snare / Clap on 4, 12
    if (step % 8 === 4) {
      this.triggerSnareClap(now);
    }

    // Hi-hat on offbeats
    if (step % 2 === 1) {
      this.triggerHiHat(now, step % 4 === 2 ? 0.25 : 0.15);
    }

    // 16th Bassline: Dm pentatonic (73.42, 87.31, 98.00, 110.00, 130.81)
    const bassNotes = [73.42, 73.42, 146.83, 73.42, 87.31, 73.42, 110, 98];
    const note = bassNotes[step % bassNotes.length];
    this.triggerSynthBass(note, 0.18, 0.5, now);

    // Lead melody
    if (step % 4 === 0 && Math.random() > 0.3) {
      const leadNotes = [293.66, 349.23, 392.00, 440.00, 523.25, 587.33];
      const leadNote = leadNotes[Math.floor(Math.random() * leadNotes.length)];
      this.triggerPluckLead(leadNote, 0.4, 0.35, now);
    }
  }

  // --- Track 3: Solfeggio 528Hz Meditation ---
  private stepSolfeggio(step: number, now: number): void {
    if (step === 0 || step === 32) {
      // 528Hz Pure Solfeggio Tone & Harmonics
      this.triggerSineTone(528, 4.0, 0.5, now);
      this.triggerSineTone(528 * 1.5, 4.0, 0.2, now); // Fifth
      this.triggerSineTone(528 * 2, 4.0, 0.15, now);  // Octave
      this.triggerSineTone(264, 4.0, 0.4, now);        // Sub-octave
    }

    if (step % 8 === 0) {
      this.triggerSingingBowl(528 * (1 + (step / 8) * 0.1), 2.5, 0.25, now);
    }
  }

  // --- Track 4: Quantum Symphony ---
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

  // ==========================================
  // Audio Synthesis Voice Helpers
  // ==========================================

  private triggerSubBass(freq: number, duration: number, gainVal: number, now: number): void {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * 1.5, now);
    osc.frequency.exponentialRampToValueAtTime(freq, now + 0.08);

    gain.gain.setValueAtTime(gainVal, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + duration);
    this.trackVoice(osc);
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
    this.trackVoice(osc);
  }

  private triggerSnareClap(now: number): void {
    // Noise buffer
    const bufferSize = this.ctx.sampleRate * 0.15;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

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
    this.trackVoice(noise);
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
    this.trackVoice(osc);
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
    this.trackVoice(osc);
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
    this.trackVoice(osc);
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
    this.trackVoice(osc);
  }

  private triggerSineTone(freq: number, duration: number, vol: number, now: number): void {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(vol, now + 0.8);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + duration);
    this.trackVoice(osc);
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
    this.trackVoice(osc);
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
      this.trackVoice(osc);
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
      this.trackVoice(osc);
    });
  }

  private trackVoice(node: AudioNode & { stop?: (when?: number) => void }): void {
    this.activeNodes.push(node);
    if (this.activeNodes.length > 64) {
      const old = this.activeNodes.shift();
      try {
        if (old && typeof old.stop === 'function') old.stop();
        old?.disconnect();
      } catch {}
    }
  }

  public getIsRunning(): boolean {
    return this.isRunning;
  }

  public getActiveTrackId(): string | null {
    return this.activeTrackId;
  }
}
