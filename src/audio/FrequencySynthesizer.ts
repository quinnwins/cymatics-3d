/**
 * Pure Frequency & Harmonic Series Audio Synthesizer
 * Generates fundamental frequency f0, overtones 1f0..8f0,
 * Stereo Binaural Beat Carrier modulation (Left/Right ear offset),
 * and Active Acoustic Phase Cancellation & Heterodyne Beat Modulation.
 */

export type WaveformType = 'sine' | 'triangle' | 'sawtooth' | 'square' | 'organ';

export interface HarmonicWeights {
  h1: number; // 1f0 (Fundamental)
  h2: number; // 2f0 (Octave)
  h3: number; // 3f0 (Octave + Fifth)
  h4: number; // 4f0 (2 Octaves)
  h5: number; // 5f0 (2 Octaves + Major Third)
  h6: number; // 6f0 (2 Octaves + Fifth)
  h7: number; // 7f0 (Harmonic 7th)
  h8: number; // 8f0 (3 Octaves)
}

export class FrequencySynthesizer {
  private ctx: AudioContext;
  private masterGain: GainNode;
  private harmonicOscs: OscillatorNode[] = [];
  private harmonicGains: GainNode[] = [];

  // Stereo Binaural Beats Sub-Graph
  private binauralRightPanner: StereoPannerNode | null = null;
  private binauralRightOsc: OscillatorNode | null = null;
  private binauralRightGain: GainNode | null = null;
  private binauralBeatOffset = 7.83; // Schumann default
  private isBinauralActive = false;

  // Therapy Heterodyne Modulation System
  private heterodyneLfo: OscillatorNode | null = null;
  private heterodyneGain: GainNode | null = null;

  private isPlaying = false;
  public frequency = 432; // Default Solfeggio frequency
  public waveform: WaveformType = 'sine';
  public harmonics: HarmonicWeights = {
    h1: 1.0,
    h2: 0.467,
    h3: 0.299,
    h4: 0.218,
    h5: 0.170,
    h6: 0.139,
    h7: 0.117,
    h8: 0.101,
  };

  constructor(audioContext: AudioContext, destinationNode: AudioNode) {
    this.ctx = audioContext;
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0, this.ctx.currentTime);
    this.masterGain.connect(destinationNode);

    this.setupHarmonicGraph();
    this.setupBinauralGraph();
  }

  private setupHarmonicGraph(): void {
    // 8 Harmonics
    for (let i = 1; i <= 8; i++) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = this.waveform === 'organ' ? 'sine' : this.waveform;
      osc.frequency.setValueAtTime(this.frequency * i, this.ctx.currentTime);

      const weight = (this.harmonics as unknown as Record<string, number>)[`h${i}`] || 0;
      const totalWeight = Object.values(this.harmonics).reduce((a, b) => a + b, 0);
      const normalizedWeight = (weight / Math.max(1.0, totalWeight)) * 0.5;

      gain.gain.setValueAtTime(normalizedWeight, this.ctx.currentTime);

      osc.connect(gain);
      gain.connect(this.masterGain);

      try {
        osc.start();
      } catch {
        // Safe start guard
      }

      this.harmonicOscs.push(osc);
      this.harmonicGains.push(gain);
    }
  }

  private setupBinauralGraph(): void {
    try {
      if (typeof this.ctx.createStereoPanner === 'function') {
        this.binauralRightPanner = this.ctx.createStereoPanner();
        this.binauralRightPanner.pan.setValueAtTime(0.9, this.ctx.currentTime);

        this.binauralRightOsc = this.ctx.createOscillator();
        this.binauralRightGain = this.ctx.createGain();
        this.binauralRightGain.gain.setValueAtTime(0, this.ctx.currentTime);

        this.binauralRightOsc.type = 'sine';
        this.binauralRightOsc.frequency.setValueAtTime(this.frequency + this.binauralBeatOffset, this.ctx.currentTime);
        this.binauralRightOsc.connect(this.binauralRightGain);
        this.binauralRightGain.connect(this.binauralRightPanner);
        this.binauralRightPanner.connect(this.masterGain);

        this.binauralRightOsc.start();
      }
    } catch {
      // Fallback if StereoPannerNode is not supported in environment
    }
  }

  public getFrequency(): number {
    return this.frequency;
  }

  public setFrequency(freq: number, rampTime = 0.04): void {
    this.frequency = Math.max(1, Math.min(22000, freq));
    const now = this.ctx.currentTime;

    for (let i = 0; i < this.harmonicOscs.length; i++) {
      const harmonicIndex = i + 1;
      const targetFreq = Math.min(22000, this.frequency * harmonicIndex);
      this.harmonicOscs[i].frequency.cancelScheduledValues(now);
      this.harmonicOscs[i].frequency.setTargetAtTime(targetFreq, now, rampTime);
    }

    if (this.binauralRightOsc) {
      const rightTarget = Math.min(22000, this.frequency + this.binauralBeatOffset);
      this.binauralRightOsc.frequency.cancelScheduledValues(now);
      this.binauralRightOsc.frequency.setTargetAtTime(rightTarget, now, rampTime);
    }
  }

  public setBinauralBeat(offsetHz: number, active: boolean): void {
    this.binauralBeatOffset = Math.max(0.1, Math.min(60, offsetHz));
    this.isBinauralActive = active;
    const now = this.ctx.currentTime;

    if (this.binauralRightOsc) {
      const rightTarget = Math.min(22000, this.frequency + this.binauralBeatOffset);
      this.binauralRightOsc.frequency.cancelScheduledValues(now);
      this.binauralRightOsc.frequency.setTargetAtTime(rightTarget, now, 0.04);
    }

    if (this.binauralRightGain) {
      this.binauralRightGain.gain.cancelScheduledValues(now);
      this.binauralRightGain.gain.setTargetAtTime(active ? 0.35 : 0, now, 0.05);
    }
  }

  public setHarmonicWeight(index: number, weight: number): void {
    const key = `h${index}` as keyof HarmonicWeights;
    this.harmonics[key] = Math.max(0, Math.min(1, weight));

    const totalWeight = Object.values(this.harmonics).reduce((a, b) => a + b, 0);

    for (let i = 0; i < this.harmonicGains.length; i++) {
      const w = (this.harmonics as unknown as Record<string, number>)[`h${i + 1}`] || 0;
      const normalizedWeight = (w / Math.max(1.0, totalWeight)) * 0.5;
      const now = this.ctx.currentTime;
      this.harmonicGains[i].gain.cancelScheduledValues(now);
      this.harmonicGains[i].gain.setTargetAtTime(normalizedWeight, now, 0.05);
    }
  }

  public setWaveform(type: WaveformType): void {
    this.waveform = type;
    const oscType: OscillatorType = type === 'organ' ? 'sine' : type;
    for (let i = 0; i < this.harmonicOscs.length; i++) {
      this.harmonicOscs[i].type = oscType;
    }
    if (this.binauralRightOsc) {
      this.binauralRightOsc.type = oscType;
    }
  }

  /**
   * Real-Time Web Audio Destructive Phase Cancellation & Heterodyne Beat Modulation
   * Computes acoustic superposition: p_net = p1 + p2
   * At deltaPhi = 180 deg (anti-phase), physical sound completely cancels in headphones/speakers!
   */
  public setTherapyAudioState(
    freqHz: number,
    phaseDeg: number,
    power: number,
    isAntiPhase: boolean,
    isHeterodyne: boolean
  ): void {
    this.setFrequency(freqHz, 0.02);

    const deltaPhiRad = isAntiPhase ? Math.PI : (phaseDeg * Math.PI) / 180.0;
    const netInterferenceMultiplier = Math.sqrt(Math.max(0, 0.5 * (1.0 + Math.cos(deltaPhiRad))));

    const now = this.ctx.currentTime;
    const targetVolume = Math.min(1.0, 0.6 * power * netInterferenceMultiplier);

    // Apply exact physical wave cancellation to synthesizer output
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setTargetAtTime(targetVolume, now, 0.03);

    // Heterodyne 11th Harmonic Beat Modulation
    if (isHeterodyne) {
      const beatFreq = Math.max(1, freqHz / 11.0);
      if (!this.heterodyneLfo || !this.heterodyneGain) {
        this.heterodyneLfo = this.ctx.createOscillator();
        this.heterodyneGain = this.ctx.createGain();
        this.heterodyneLfo.frequency.setValueAtTime(beatFreq, now);
        this.heterodyneGain.gain.setValueAtTime(0, now);
        this.heterodyneGain.gain.setTargetAtTime(0.35, now, 0.04);
        this.heterodyneLfo.connect(this.heterodyneGain);
        this.heterodyneGain.connect(this.masterGain.gain);
        try {
          this.heterodyneLfo.start();
        } catch {
          // Guard
        }
      } else {
        this.heterodyneLfo.frequency.setTargetAtTime(beatFreq, now, 0.05);
        this.heterodyneGain.gain.cancelScheduledValues(now);
        this.heterodyneGain.gain.setTargetAtTime(0.35, now, 0.04);
      }
    } else if (this.heterodyneLfo && this.heterodyneGain) {
      this.heterodyneGain.gain.cancelScheduledValues(now);
      this.heterodyneGain.gain.setTargetAtTime(0, now, 0.05);
    }
  }

  public start(volume = 0.7): void {
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    const now = this.ctx.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setTargetAtTime(volume, now, 0.08);
    this.isPlaying = true;
  }

  public stop(): void {
    const now = this.ctx.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setTargetAtTime(0, now, 0.08);
    if (this.heterodyneGain) {
      this.heterodyneGain.gain.cancelScheduledValues(now);
      this.heterodyneGain.gain.setTargetAtTime(0, now, 0.05);
    }
    this.isPlaying = false;
  }

  public setVolume(vol: number): void {
    if (!this.isPlaying) return;
    const now = this.ctx.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setTargetAtTime(Math.max(0, Math.min(1, vol)), now, 0.05);
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }
}
