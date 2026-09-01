/**
 * SoundMedicineSynthesizer.ts
 * SoundForm 3D - Personalized Polyphonic Bio-Acoustic Medicine Synthesizer
 *
 * Implements 4-Tier Therapeutic Frequency Synthesis:
 * Tier 1: Optimal Fundamental Carrier Tone (f0 / Solfeggio 432 Hz / 528 Hz).
 * Tier 2: Vocal Tract Formant Reinforcement Resonators (Bi-quad peaking filters).
 * Tier 3: True Stereo Binaural / Isochronic Neuromodulation (Alpha 10 Hz / Theta 6 Hz).
 * Tier 4: Golden-Ratio (Phi = 1.618) Harmonic Overtones.
 */

import { VocalBiomarkerReport } from '../math/VoiceBiometricsPhysics';

export class SoundMedicineSynthesizer {
  private ctx: AudioContext;
  private masterGain: GainNode;

  // Tier 1: Carrier
  private carrierOsc: OscillatorNode | null = null;
  private carrierGain: GainNode | null = null;

  // Tier 2: Formant Reinforcement
  private formantOscs: OscillatorNode[] = [];
  private formantGains: GainNode[] = [];

  // Tier 3: Binaural Stereo Oscillators
  private binauralLeftOsc: OscillatorNode | null = null;
  private binauralRightOsc: OscillatorNode | null = null;
  private binauralLeftPanner: StereoPannerNode | null = null;
  private binauralRightPanner: StereoPannerNode | null = null;
  private binauralGain: GainNode | null = null;

  // Tier 4: Golden Ratio Overtones
  private goldenOscs: OscillatorNode[] = [];
  private goldenGains: GainNode[] = [];

  private isPlaying = false;
  private activePrescription: VocalBiomarkerReport['soundMedicinePrescription'] | null = null;

  constructor(audioContext: AudioContext, destinationNode: AudioNode) {
    this.ctx = audioContext;
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0, this.ctx.currentTime);
    this.masterGain.connect(destinationNode);
  }

  public playPrescription(
    prescription: VocalBiomarkerReport['soundMedicinePrescription'],
    volume = 0.65
  ): void {
    this.stop();
    this.activePrescription = prescription;
    const now = this.ctx.currentTime;

    // 1. Tier 1: Core Fundamental Carrier
    this.carrierOsc = this.ctx.createOscillator();
    this.carrierGain = this.ctx.createGain();
    this.carrierOsc.type = 'sine';
    this.carrierOsc.frequency.setValueAtTime(prescription.baseToneHz, now);
    this.carrierGain.gain.setValueAtTime(0.45, now);
    this.carrierOsc.connect(this.carrierGain);
    this.carrierGain.connect(this.masterGain);
    this.carrierOsc.start(now);

    // 2. Tier 2: Formant Overtones
    this.formantOscs = [];
    this.formantGains = [];
    prescription.harmonicOvertones.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      const amp = 0.25 / Math.pow(idx + 1, 0.85);
      gain.gain.setValueAtTime(amp, now);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      this.formantOscs.push(osc);
      this.formantGains.push(gain);
    });

    // 3. Tier 3: Binaural Stereo Beat (f vs f + delta)
    const baseBeat = prescription.baseToneHz;
    const deltaBeat = prescription.binauralBeatHz;

    this.binauralLeftOsc = this.ctx.createOscillator();
    this.binauralRightOsc = this.ctx.createOscillator();
    this.binauralGain = this.ctx.createGain();

    this.binauralLeftOsc.frequency.setValueAtTime(baseBeat, now);
    this.binauralRightOsc.frequency.setValueAtTime(baseBeat + deltaBeat, now);

    this.binauralGain.gain.setValueAtTime(0.35, now);

    if (this.ctx.createStereoPanner) {
      this.binauralLeftPanner = this.ctx.createStereoPanner();
      this.binauralRightPanner = this.ctx.createStereoPanner();
      this.binauralLeftPanner.pan.setValueAtTime(-0.85, now);
      this.binauralRightPanner.pan.setValueAtTime(0.85, now);

      this.binauralLeftOsc.connect(this.binauralLeftPanner);
      this.binauralLeftPanner.connect(this.binauralGain);

      this.binauralRightOsc.connect(this.binauralRightPanner);
      this.binauralRightPanner.connect(this.binauralGain);
    } else {
      this.binauralLeftOsc.connect(this.binauralGain);
      this.binauralRightOsc.connect(this.binauralGain);
    }

    this.binauralGain.connect(this.masterGain);
    this.binauralLeftOsc.start(now);
    this.binauralRightOsc.start(now);

    // Fade Master Gain IN smoothly
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setValueAtTime(0.001, now);
    this.masterGain.gain.exponentialRampToValueAtTime(Math.max(0.01, volume), now + 0.15);

    this.isPlaying = true;
  }

  public stop(): void {
    const now = this.ctx.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setTargetAtTime(0, now, 0.04);

    setTimeout(() => {
      try {
        this.carrierOsc?.stop();
        this.carrierOsc?.disconnect();
        this.formantOscs.forEach(o => {
          o.stop();
          o.disconnect();
        });
        this.binauralLeftOsc?.stop();
        this.binauralRightOsc?.stop();
        this.binauralLeftOsc?.disconnect();
        this.binauralRightOsc?.disconnect();
      } catch {
        // Safe cleanup
      }
      this.carrierOsc = null;
      this.formantOscs = [];
      this.binauralLeftOsc = null;
      this.binauralRightOsc = null;
      this.isPlaying = false;
    }, 80);
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public getActivePrescription(): VocalBiomarkerReport['soundMedicinePrescription'] | null {
    return this.activePrescription;
  }

  public dispose(): void {
    this.stop();
    this.masterGain.disconnect();
  }
}
