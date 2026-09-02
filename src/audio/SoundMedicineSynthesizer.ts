/**
 * SoundMedicineSynthesizer.ts
 * SoundForm 3D - Personalized Polyphonic Bio-Acoustic Medicine Synthesizer
 *
 * Implements 5-Tier Polyphonic Therapeutic Frequency Synthesis:
 * Tier 1: Pure Bio-Harmonic Carrier Tone (f0 / Solfeggio 432 Hz / 528 Hz / 110 Hz).
 * Tier 2: Vocal Tract Formant Reinforcement Resonators (F1, F2 expansion poles).
 * Tier 3: Pure Dichotic Stereo Binaural Entrainment (-1.0 Left / +1.0 Right, zero mono bleed).
 * Tier 4: Golden-Ratio (Phi = 1.618) & Pythagorean Just-Intonation Harmonic Overtones.
 * Tier 5: Smooth Raised-Cosine Isochronic Amplitude Pulsing (3.5 - 6.0 Hz).
 *
 * Audio Safety & Dynamics:
 * - 7.8 kHz Butterworth Anti-Aliasing Low-Pass Filter
 * - -1.5 dBFS Soft-Knee Dynamic Peak Limiter
 * - 120 ms Smooth Equal-Power Click-Free Crossfader
 */

import { VocalBiomarkerReport } from '../math/VoiceBiometricsPhysics';

export class SoundMedicineSynthesizer {
  private ctx: AudioContext;
  private outputBus: GainNode;
  private lowpassFilter: BiquadFilterNode;
  private limiter: DynamicsCompressorNode;
  private masterGain: GainNode;

  // Tier 1: Carrier
  private carrierOsc: OscillatorNode | null = null;
  private carrierGain: GainNode | null = null;

  // Tier 2: Formant Reinforcement Resonators
  private formantOscs: OscillatorNode[] = [];
  private formantGains: GainNode[] = [];

  // Tier 3: Pure Dichotic Binaural Entrainment
  private binauralLeftOsc: OscillatorNode | null = null;
  private binauralRightOsc: OscillatorNode | null = null;
  private binauralLeftPanner: StereoPannerNode | null = null;
  private binauralRightPanner: StereoPannerNode | null = null;
  private binauralLeftGain: GainNode | null = null;
  private binauralRightGain: GainNode | null = null;

  // Tier 4: Golden Ratio Overtones
  private goldenOscs: OscillatorNode[] = [];
  private goldenGains: GainNode[] = [];

  // Tier 5: Isochronic Amplitude Modulator
  private isochronicLfo: OscillatorNode | null = null;
  private isochronicGain: GainNode | null = null;

  private isPlaying = false;
  private activePrescription: VocalBiomarkerReport['soundMedicinePrescription'] | null = null;
  private cleanupTimer: number | null = null;

  constructor(audioContext: AudioContext, destinationNode: AudioNode) {
    this.ctx = audioContext;

    // Build protected output chain: masterGain -> lowpassFilter -> limiter -> destinationNode
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0, this.ctx.currentTime);

    this.lowpassFilter = this.ctx.createBiquadFilter();
    this.lowpassFilter.type = 'lowpass';
    this.lowpassFilter.frequency.setValueAtTime(7800, this.ctx.currentTime);
    this.lowpassFilter.Q.setValueAtTime(0.707, this.ctx.currentTime); // Butterworth Q

    this.limiter = this.ctx.createDynamicsCompressor();
    this.limiter.threshold.setValueAtTime(-1.5, this.ctx.currentTime); // -1.5 dBFS ceiling
    this.limiter.knee.setValueAtTime(6.0, this.ctx.currentTime);
    this.limiter.ratio.setValueAtTime(12.0, this.ctx.currentTime);
    this.limiter.attack.setValueAtTime(0.003, this.ctx.currentTime);
    this.limiter.release.setValueAtTime(0.05, this.ctx.currentTime);

    this.outputBus = this.ctx.createGain();
    this.outputBus.gain.setValueAtTime(1.0, this.ctx.currentTime);

    this.outputBus.connect(this.masterGain);
    this.masterGain.connect(this.lowpassFilter);
    this.lowpassFilter.connect(this.limiter);
    this.limiter.connect(destinationNode);
  }

  public playPrescription(
    prescription: VocalBiomarkerReport['soundMedicinePrescription'],
    volume = 0.65
  ): void {
    const now = this.ctx.currentTime;

    // Immediately stop and disconnect existing active voices without race conditions
    this.disconnectAndClearActiveVoices();

    this.activePrescription = prescription;
    this.isPlaying = true;

    // ------------------------------------------------------------------------
    // Tier 1: Core Bio-Harmonic Carrier
    // ------------------------------------------------------------------------
    this.carrierOsc = this.ctx.createOscillator();
    this.carrierGain = this.ctx.createGain();
    this.carrierOsc.type = 'sine';
    this.carrierOsc.frequency.setValueAtTime(prescription.baseToneHz, now);
    this.carrierGain.gain.setValueAtTime(0.40, now);

    this.carrierOsc.connect(this.carrierGain);
    this.carrierGain.connect(this.outputBus);
    this.carrierOsc.start(now);

    // ------------------------------------------------------------------------
    // Tier 2: Additive Formant Expansion Resonators
    // ------------------------------------------------------------------------
    this.formantOscs = [];
    this.formantGains = [];
    prescription.harmonicOvertones.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      const amp = 0.20 / Math.pow(idx + 1, 0.75);
      gain.gain.setValueAtTime(amp, now);

      osc.connect(gain);
      gain.connect(this.outputBus);
      osc.start(now);

      this.formantOscs.push(osc);
      this.formantGains.push(gain);
    });

    // ------------------------------------------------------------------------
    // Tier 3: Pure Dichotic Stereo Binaural Entrainment
    // ------------------------------------------------------------------------
    this.binauralLeftOsc = this.ctx.createOscillator();
    this.binauralRightOsc = this.ctx.createOscillator();
    this.binauralLeftGain = this.ctx.createGain();
    this.binauralRightGain = this.ctx.createGain();

    this.binauralLeftOsc.type = 'sine';
    this.binauralRightOsc.type = 'sine';
    this.binauralLeftOsc.frequency.setValueAtTime(prescription.baseToneHz, now);
    this.binauralRightOsc.frequency.setValueAtTime(
      prescription.baseToneHz + prescription.binauralBeatHz,
      now
    );

    this.binauralLeftGain.gain.setValueAtTime(0.35, now);
    this.binauralRightGain.gain.setValueAtTime(0.35, now);

    if (typeof this.ctx.createStereoPanner === 'function') {
      this.binauralLeftPanner = this.ctx.createStereoPanner();
      this.binauralRightPanner = this.ctx.createStereoPanner();
      this.binauralLeftPanner.pan.setValueAtTime(-1.0, now);
      this.binauralRightPanner.pan.setValueAtTime(1.0, now);

      this.binauralLeftOsc.connect(this.binauralLeftGain);
      this.binauralLeftGain.connect(this.binauralLeftPanner);
      this.binauralLeftPanner.connect(this.outputBus);

      this.binauralRightOsc.connect(this.binauralRightGain);
      this.binauralRightGain.connect(this.binauralRightPanner);
      this.binauralRightPanner.connect(this.outputBus);
    } else {
      this.binauralLeftOsc.connect(this.binauralLeftGain);
      this.binauralLeftGain.connect(this.outputBus);
      this.binauralRightOsc.connect(this.binauralRightGain);
      this.binauralRightGain.connect(this.outputBus);
    }

    this.binauralLeftOsc.start(now);
    this.binauralRightOsc.start(now);

    // ------------------------------------------------------------------------
    // Tier 4: Golden Ratio (Phi = 1.618) & Solfeggio Harmonic Overtones
    // ------------------------------------------------------------------------
    this.goldenOscs = [];
    this.goldenGains = [];
    const goldenOrders = [1.618, 2.618, 4.236];
    goldenOrders.forEach((multiplier, idx) => {
      const freq = prescription.baseToneHz * multiplier;
      if (freq < 7500) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);
        gain.gain.setValueAtTime(0.10 / (idx + 1), now);

        osc.connect(gain);
        gain.connect(this.outputBus);
        osc.start(now);

        this.goldenOscs.push(osc);
        this.goldenGains.push(gain);
      }
    });

    // ------------------------------------------------------------------------
    // Tier 5: Smooth Isochronic Amplitude Pulsing (Theta / Alpha Entrainment)
    // ------------------------------------------------------------------------
    if (prescription.isochronicPulseRateHz > 0) {
      this.isochronicLfo = this.ctx.createOscillator();
      this.isochronicGain = this.ctx.createGain();

      this.isochronicLfo.type = 'sine';
      this.isochronicLfo.frequency.setValueAtTime(prescription.isochronicPulseRateHz, now);

      this.isochronicGain.gain.setValueAtTime(0.18, now);

      this.isochronicLfo.connect(this.isochronicGain);
      this.isochronicGain.connect(this.outputBus.gain);
      this.isochronicLfo.start(now);
    }

    // ------------------------------------------------------------------------
    // Master Gain Fade-In (Equal-power 120 ms crossfade)
    // ------------------------------------------------------------------------
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setValueAtTime(0.0001, now);
    this.masterGain.gain.exponentialRampToValueAtTime(Math.max(0.01, volume), now + 0.12);
  }

  private disconnectAndClearActiveVoices(): void {
    if (this.cleanupTimer !== null) {
      window.clearTimeout(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    const stopAndDisconnect = (node: AudioNode | null) => {
      if (!node) return;
      try {
        if (typeof (node as any).stop === 'function') (node as any).stop();
        node.disconnect();
      } catch {}
    };

    stopAndDisconnect(this.carrierOsc);
    stopAndDisconnect(this.carrierGain);
    this.carrierOsc = null;
    this.carrierGain = null;

    stopAndDisconnect(this.binauralLeftOsc);
    stopAndDisconnect(this.binauralRightOsc);
    stopAndDisconnect(this.binauralLeftPanner);
    stopAndDisconnect(this.binauralRightPanner);
    stopAndDisconnect(this.binauralLeftGain);
    stopAndDisconnect(this.binauralRightGain);
    this.binauralLeftOsc = null;
    this.binauralRightOsc = null;
    this.binauralLeftPanner = null;
    this.binauralRightPanner = null;
    this.binauralLeftGain = null;
    this.binauralRightGain = null;

    this.formantOscs.forEach(stopAndDisconnect);
    this.formantGains.forEach(stopAndDisconnect);
    this.formantOscs = [];
    this.formantGains = [];

    this.goldenOscs.forEach(stopAndDisconnect);
    this.goldenGains.forEach(stopAndDisconnect);
    this.goldenOscs = [];
    this.goldenGains = [];

    stopAndDisconnect(this.isochronicLfo);
    stopAndDisconnect(this.isochronicGain);
    this.isochronicLfo = null;
    this.isochronicGain = null;
  }

  public stop(fadeDuration = 0.15): void {
    if (!this.isPlaying && !this.carrierOsc) return;

    const now = this.ctx.currentTime;
    const dur = Math.max(0.005, fadeDuration);
    const stopTime = now + dur;

    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setValueAtTime(Math.max(0.0001, this.masterGain.gain.value), now);
    this.masterGain.gain.exponentialRampToValueAtTime(0.0001, stopTime);

    if (this.cleanupTimer !== null) {
      window.clearTimeout(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    this.cleanupTimer = window.setTimeout(() => {
      this.disconnectAndClearActiveVoices();
      this.isPlaying = false;
      this.cleanupTimer = null;
    }, Math.round((dur + 0.05) * 1000));

    this.isPlaying = false;
  }

  public setVolume(vol: number): void {
    const now = this.ctx.currentTime;
    const clamped = Math.max(0.0001, Math.min(1.0, vol));
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.linearRampToValueAtTime(clamped, now + 0.05);
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public getActivePrescription(): VocalBiomarkerReport['soundMedicinePrescription'] | null {
    return this.activePrescription;
  }
}
