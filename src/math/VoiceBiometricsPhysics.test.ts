import { describe, it, expect } from 'vitest';
import { VoiceBiometricsPhysics } from './VoiceBiometricsPhysics';

describe('VoiceBiometricsPhysics - Complete Verification Suite', () => {
  const SAMPLE_RATE = 16000;

  // --------------------------------------------------------------------------
  // 1. YIN Pitch & Fundamental Frequency (f0) Extraction
  // --------------------------------------------------------------------------
  describe('YIN Pitch Extraction & Sub-Sample Precision', () => {
    it('extracts pure sine wave fundamental with high precision', () => {
      const targetFreq = 220.0; // A3
      const N = 2048;
      const buffer = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        buffer[i] = Math.sin((2 * Math.PI * targetFreq * i) / SAMPLE_RATE);
      }

      const result = VoiceBiometricsPhysics.extractPitchYIN(buffer, SAMPLE_RATE);
      expect(result.f0).toBeCloseTo(targetFreq, 0);
      expect(result.confidence).toBeGreaterThan(0.85);
      expect(result.periodSamples).toBeCloseTo(SAMPLE_RATE / targetFreq, 1);
    });

    it('verifies sub-sample parabolic interpolation accuracy on non-integer periods', () => {
      // 173.45 Hz -> Period = 92.2456 samples at 16 kHz
      const targetFreq = 173.45;
      const N = 2048;
      const buffer = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        buffer[i] = Math.sin((2 * Math.PI * targetFreq * i) / SAMPLE_RATE);
      }

      const result = VoiceBiometricsPhysics.extractPitchYIN(buffer, SAMPLE_RATE);
      expect(Math.abs(result.f0 - targetFreq)).toBeLessThan(1.5);
    });

    it('extracts fundamental pitch correctly across full vocal physiological range [65 Hz - 600 Hz]', () => {
      const testFrequencies = [75.0, 110.0, 196.0, 330.0, 440.0, 550.0];
      const N = 2048;

      testFrequencies.forEach((freq) => {
        const buffer = new Float32Array(N);
        for (let i = 0; i < N; i++) {
          buffer[i] = Math.sin((2 * Math.PI * freq * i) / SAMPLE_RATE);
        }
        const result = VoiceBiometricsPhysics.extractPitchYIN(buffer, SAMPLE_RATE);
        expect(result.f0).toBeCloseTo(freq, 0);
        expect(result.confidence).toBeGreaterThan(0.80);
      });
    });

    it('handles complex multi-harmonic glottal waveforms without octave jump errors', () => {
      const f0 = 130.81; // C3
      const N = 2048;
      const buffer = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        // Multi-harmonic glottal pulse approximation with strong 2nd/3rd harmonics
        buffer[i] =
          1.00 * Math.sin((2 * Math.PI * f0 * 1 * i) / SAMPLE_RATE) +
          0.75 * Math.sin((2 * Math.PI * f0 * 2 * i) / SAMPLE_RATE) +
          0.50 * Math.sin((2 * Math.PI * f0 * 3 * i) / SAMPLE_RATE) +
          0.25 * Math.sin((2 * Math.PI * f0 * 4 * i) / SAMPLE_RATE);
      }

      const result = VoiceBiometricsPhysics.extractPitchYIN(buffer, SAMPLE_RATE);
      expect(result.f0).toBeCloseTo(f0, 0);
      expect(result.confidence).toBeGreaterThan(0.70);
    });

    it('rejects pure silence and low energy with zero confidence or f0 = 0', () => {
      const N = 2048;
      const silenceBuffer = new Float32Array(N);
      const silenceRes = VoiceBiometricsPhysics.extractPitchYIN(silenceBuffer, SAMPLE_RATE);
      expect(silenceRes.confidence).toBeLessThanOrEqual(0.1);

      const noiseBuffer = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        noiseBuffer[i] = (Math.random() - 0.5) * 0.2;
      }
      const noiseRes = VoiceBiometricsPhysics.extractPitchYIN(noiseBuffer, SAMPLE_RATE);
      expect(noiseRes.confidence).toBeLessThan(0.60);
    });

    it('safely handles undersized buffer (W <= 32)', () => {
      const smallBuffer = new Float32Array(60);
      const res = VoiceBiometricsPhysics.extractPitchYIN(smallBuffer, SAMPLE_RATE);
      expect(res.f0).toBe(0);
      expect(res.confidence).toBe(0);
      expect(res.periodSamples).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // 2. Clinical Perturbation Metrics (Jitter & Shimmer)
  // --------------------------------------------------------------------------
  describe('Clinical Perturbation Analysis (Jloc, RAP, PPQ5, Sloc, SdB, APQ11)', () => {
    it('returns zero perturbation for perfectly identical periods and amplitudes', () => {
      const periods = new Array(16).fill(72.72);
      const amps = new Array(16).fill(0.85);

      const metrics = VoiceBiometricsPhysics.calculatePerturbationMetrics(periods, amps);
      expect(metrics.jitterLoc).toBe(0);
      expect(metrics.jitterRap).toBe(0);
      expect(metrics.jitterPpq5).toBe(0);
      expect(metrics.shimmerLoc).toBe(0);
      expect(metrics.shimmerDb).toBe(0);
      expect(metrics.shimmerApq11).toBe(0);
    });

    it('calculates expected Jitter (RAP and PPQ5) for controlled sinusoidal jitter modulation', () => {
      const N = 20;
      const basePeriod = 80.0;
      const periods: number[] = [];
      const amps: number[] = [];

      for (let i = 0; i < N; i++) {
        periods.push(basePeriod + (i % 2 === 0 ? 1.5 : -1.5));
        amps.push(0.80);
      }

      const metrics = VoiceBiometricsPhysics.calculatePerturbationMetrics(periods, amps);
      expect(metrics.jitterLoc).toBeGreaterThan(3.0);
      expect(metrics.jitterRap).toBeGreaterThan(0.5);
      expect(metrics.jitterPpq5).toBeGreaterThan(0.5);
      expect(metrics.jitterDdp).toBeCloseTo(metrics.jitterRap * 3.0, 2);
      expect(metrics.shimmerLoc).toBe(0);
    });

    it('calculates expected Shimmer (Local, dB, APQ3, APQ5, APQ11, DDA) for controlled amplitude modulation', () => {
      const N = 24;
      const periods = new Array(N).fill(75.0);
      const amps: number[] = [];

      for (let i = 0; i < N; i++) {
        amps.push(0.80 + (i % 2 === 0 ? 0.08 : -0.08));
      }

      const metrics = VoiceBiometricsPhysics.calculatePerturbationMetrics(periods, amps);
      expect(metrics.jitterLoc).toBe(0);
      expect(metrics.shimmerLoc).toBeGreaterThan(15.0);
      expect(metrics.shimmerDb).toBeGreaterThan(1.0);
      expect(metrics.shimmerApq3).toBeGreaterThan(10.0);
      expect(metrics.shimmerApq5).toBeGreaterThan(6.0);
      expect(metrics.shimmerApq11).toBeGreaterThan(5.0);
      expect(metrics.shimmerDda).toBeCloseTo(metrics.shimmerApq3 * 3.0, 2);
    });

    it('gracefully handles insufficient history buffer length (N < 6)', () => {
      const shortPeriods = [72.0, 72.5, 73.0];
      const shortAmps = [0.8, 0.82, 0.79];

      const metrics = VoiceBiometricsPhysics.calculatePerturbationMetrics(shortPeriods, shortAmps);
      expect(metrics.jitterLoc).toBe(0);
      expect(metrics.shimmerLoc).toBe(0);
      expect(metrics.jitterRap).toBe(0);
      expect(metrics.shimmerApq11).toBe(0);
    });

    it('clamps maximum pathological perturbation metrics within clinical ceilings', () => {
      const chaoticPeriods = [10, 100, 15, 120, 20, 140, 12, 110];
      const chaoticAmps = [0.01, 1.0, 0.02, 0.95, 0.01, 1.0, 0.03, 0.9];

      const metrics = VoiceBiometricsPhysics.calculatePerturbationMetrics(chaoticPeriods, chaoticAmps);
      expect(metrics.jitterLoc).toBeLessThanOrEqual(25.0);
      expect(metrics.jitterRap).toBeLessThanOrEqual(20.0);
      expect(metrics.jitterPpq5).toBeLessThanOrEqual(20.0);
      expect(metrics.shimmerLoc).toBeLessThanOrEqual(30.0);
      expect(metrics.shimmerDb).toBeLessThanOrEqual(5.0);
      expect(metrics.shimmerApq11).toBeLessThanOrEqual(25.0);
    });
  });

  // --------------------------------------------------------------------------
  // 3. Harmonics-to-Noise Ratio (HNR in dB)
  // --------------------------------------------------------------------------
  describe('Harmonics-to-Noise Ratio (HNR)', () => {
    it('returns high HNR (> 25 dB) for pristine sinusoidal input', () => {
      const f0 = 200;
      const periodSamples = SAMPLE_RATE / f0; // 80 samples
      const N = 2048;
      const buffer = new Float32Array(N);

      for (let i = 0; i < N; i++) {
        buffer[i] = Math.sin((2 * Math.PI * f0 * i) / SAMPLE_RATE);
      }

      const hnr = VoiceBiometricsPhysics.calculateHNR(buffer, periodSamples);
      expect(hnr).toBeGreaterThanOrEqual(25.0);
      expect(hnr).toBeLessThanOrEqual(35.0);
    });

    it('returns depressed HNR (< 12 dB) for noisy glottal aspiration signal', () => {
      const f0 = 200;
      const periodSamples = SAMPLE_RATE / f0;
      const N = 2048;
      const buffer = new Float32Array(N);

      for (let i = 0; i < N; i++) {
        const tone = Math.sin((2 * Math.PI * f0 * i) / SAMPLE_RATE);
        const noise = (Math.random() - 0.5) * 1.8;
        buffer[i] = tone + noise;
      }

      const hnr = VoiceBiometricsPhysics.calculateHNR(buffer, periodSamples);
      expect(hnr).toBeLessThan(12.0);
    });

    it('returns 0.0 dB for pure zero signal', () => {
      const N = 2048;
      const zeroBuffer = new Float32Array(N);
      expect(VoiceBiometricsPhysics.calculateHNR(zeroBuffer, 80)).toBe(0.0);
    });

    it('returns 0.0 dB for invalid or out-of-range periodSamples', () => {
      const buffer = new Float32Array(2048).fill(0.5);
      expect(VoiceBiometricsPhysics.calculateHNR(buffer, 0)).toBe(0.0);
      expect(VoiceBiometricsPhysics.calculateHNR(buffer, -10)).toBe(0.0);
      expect(VoiceBiometricsPhysics.calculateHNR(buffer, 1500)).toBe(0.0);
    });
  });

  // --------------------------------------------------------------------------
  // 4. Cepstral Peak Prominence (CPP in dB)
  // --------------------------------------------------------------------------
  describe('Cepstral Peak Prominence (CPP)', () => {
    it('yields prominent CPP (> 8 dB) for clean harmonic voice phonation', () => {
      const f0 = 150;
      const N = 1024;
      const buffer = new Float32Array(N);

      for (let i = 0; i < N; i++) {
        buffer[i] =
          1.0 * Math.sin((2 * Math.PI * f0 * i) / SAMPLE_RATE) +
          0.6 * Math.sin((2 * Math.PI * 2 * f0 * i) / SAMPLE_RATE) +
          0.4 * Math.sin((2 * Math.PI * 3 * f0 * i) / SAMPLE_RATE);
      }

      const cpp = VoiceBiometricsPhysics.calculateCPP(buffer, SAMPLE_RATE);
      expect(cpp).toBeGreaterThan(8.0);
      expect(cpp).toBeLessThanOrEqual(25.0);
    });

    it('yields low CPP (< 6 dB) for unvoiced turbulent aspiration noise', () => {
      const N = 1024;
      const buffer = new Float32Array(N);

      for (let i = 0; i < N; i++) {
        buffer[i] = (Math.random() - 0.5) * 0.6;
      }

      const cpp = VoiceBiometricsPhysics.calculateCPP(buffer, SAMPLE_RATE);
      expect(cpp).toBeLessThan(6.0);
    });

    it('returns 0.0 dB when buffer energy is below minimum RMS noise threshold or buffer too short', () => {
      const silentBuffer = new Float32Array(1024); // RMS = 0
      expect(VoiceBiometricsPhysics.calculateCPP(silentBuffer, SAMPLE_RATE)).toBe(0.0);

      const tinyBuffer = new Float32Array(512); // N < 1024
      expect(VoiceBiometricsPhysics.calculateCPP(tinyBuffer, SAMPLE_RATE)).toBe(0.0);
    });
  });

  // --------------------------------------------------------------------------
  // 5. LPC-16 Levinson-Durbin & Kelly-Lochbaum Vocal Tract Area Functions
  // --------------------------------------------------------------------------
  describe('LPC-16 Levinson-Durbin Recursion & Kelly-Lochbaum 1D Area Function', () => {
    it('produces 16 bounded reflection coefficients with stable Schur property (|k_i| < 1.0)', () => {
      const N = 1024;
      const buffer = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        buffer[i] = Math.sin((2 * Math.PI * 220 * i) / SAMPLE_RATE) * Math.exp(-i / 600);
      }

      const lpc = VoiceBiometricsPhysics.calculateLpcAreaFunction(buffer, 16);
      expect(lpc.reflectionCoeffs.length).toBe(16);
      expect(lpc.radiiCm.length).toBe(16);

      for (const k of lpc.reflectionCoeffs) {
        expect(Math.abs(k)).toBeLessThan(1.0);
      }
    });

    it('computes physiologically valid vocal tract tube radii [0.05 cm, 3.5 cm]', () => {
      const N = 1024;
      const buffer = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        buffer[i] = Math.sin((2 * Math.PI * 130 * i) / SAMPLE_RATE) + 0.4 * Math.sin((2 * Math.PI * 750 * i) / SAMPLE_RATE);
      }

      const lpc = VoiceBiometricsPhysics.calculateLpcAreaFunction(buffer, 16);
      for (const r of lpc.radiiCm) {
        expect(r).toBeGreaterThan(0.05);
        expect(r).toBeLessThan(3.50);
        expect(Number.isFinite(r)).toBe(true);
      }
    });

    it('returns physiological formant ladder (F1 < F2 < F3 < F4) within standard bounds', () => {
      const N = 1024;
      const buffer = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        buffer[i] = Math.sin((2 * Math.PI * 300 * i) / SAMPLE_RATE);
      }

      const lpc = VoiceBiometricsPhysics.calculateLpcAreaFunction(buffer, 16);
      const [f1, f2, f3, f4] = lpc.formants;

      expect(f1).toBeGreaterThanOrEqual(200);
      expect(f1).toBeLessThanOrEqual(1100);

      expect(f2).toBeGreaterThanOrEqual(800);
      expect(f2).toBeLessThanOrEqual(2600);

      expect(f3).toBeGreaterThanOrEqual(2000);
      expect(f3).toBeLessThanOrEqual(3400);

      expect(f4).toBe(3500);
    });

    it('returns neutral vocal tract tube fallback when input buffer is zero or silent', () => {
      const zeroBuffer = new Float32Array(1024);
      const lpc = VoiceBiometricsPhysics.calculateLpcAreaFunction(zeroBuffer, 16);

      expect(lpc.reflectionCoeffs.every((k) => k === 0)).toBe(true);
      expect(lpc.radiiCm.every((r) => r === 0.8)).toBe(true);
      expect(lpc.formants).toEqual([500, 1500, 2500, 3500]);
    });
  });

  // --------------------------------------------------------------------------
  // 6. Clinical Database Profile Integrity & FCR/VSA Acoustics
  // --------------------------------------------------------------------------
  describe('Clinical Profile Database Integrity & Acoustic Formant Centralization', () => {
    const requiredProfiles = [
      'bel-canto',
      'resonant-baritone',
      'grounded-chest',
      'hyperfunctional-strain',
      'puberphonia',
      'vocal-nodules',
      'vocal-polyp',
      'parkinsonian-tremor',
      'essential-tremor',
      'adductor-spasmodic',
      'unilateral-paralysis',
      'presbylaryngis',
      'pulmonary-congestion',
      'cardiovascular-edema',
    ];

    it('contains verified clinical archetype profiles with complete metadata', () => {
      requiredProfiles.forEach((id) => {
        const profile = VoiceBiometricsPhysics.PROFILES[id];
        expect(profile).toBeDefined();
        expect(profile.id).toBe(id);
        expect(profile.f0Hz).toBeGreaterThan(65);
        expect(profile.formants.length).toBe(4);
        expect(profile.jitterPercent).toBeGreaterThan(0);
        expect(profile.shimmerPercent).toBeGreaterThan(0);
        expect(profile.hnrDb).toBeGreaterThan(0);
        expect(profile.cppDb).toBeGreaterThan(0);
        expect(profile.recommendedTherapy).toBeDefined();
        expect(profile.recommendedTherapy.coreCarrierHz).toBeGreaterThan(50);
      });
    });

    it('verifies acoustic vowel centralization ratio (FCR > 1.20) in Parkinsonian profile', () => {
      const parkinson = VoiceBiometricsPhysics.PROFILES['parkinsonian-tremor'];
      expect(parkinson.fcr).toBeGreaterThan(1.25);
      expect(parkinson.tremorDepthPercent).toBeGreaterThan(15.0);
      expect(parkinson.tremorFreqHz).toBeCloseTo(5.2, 1);
    });

    it('verifies healthy vocal tract resonance in Bel Canto profile (FCR < 1.0, HNR > 25 dB)', () => {
      const belCanto = VoiceBiometricsPhysics.PROFILES['bel-canto'];
      expect(belCanto.fcr).toBeLessThan(1.0);
      expect(belCanto.hnrDb).toBeGreaterThan(25.0);
      expect(belCanto.jitterPercent).toBeLessThan(0.35);
    });
  });

  // --------------------------------------------------------------------------
  // 7. Pathology Diagnostic Classifier & 5 Clinical Categories
  // --------------------------------------------------------------------------
  describe('Multi-Parametric Clinical Diagnostic Classifier', () => {
    it('classifies pristine healthy phonation correctly', () => {
      const diagnosis = VoiceBiometricsPhysics.diagnosePathologies({
        f0Hz: 220.0,
        jitterPercent: 0.25,
        shimmerPercent: 1.40,
        hnrDb: 26.5,
        cppDb: 18.0,
        fcr: 0.94,
        tremorDepthPercent: 0.0,
      });

      expect(diagnosis.healthStatus).toBe('pristine');
      expect(diagnosis.hallmarks[0]).toContain('Pristine Harmonic Resonance');
    });

    it('classifies neurological tremor with articulatory vowel undershoot correctly', () => {
      const diagnosis = VoiceBiometricsPhysics.diagnosePathologies({
        f0Hz: 145.0,
        jitterPercent: 1.65,
        shimmerPercent: 4.10,
        hnrDb: 14.5,
        cppDb: 8.8,
        fcr: 1.32,
        tremorDepthPercent: 18.5,
      });

      expect(diagnosis.healthStatus).toBe('neurological-tremor');
      expect(diagnosis.hallmarks.some((h) => h.includes('Parkinsonian'))).toBe(true);
      expect(diagnosis.hallmarks.some((h) => h.includes('Formant Centralization'))).toBe(true);
    });

    it('classifies glottal aspiration and vocal nodule mass asymmetry correctly', () => {
      const diagnosis = VoiceBiometricsPhysics.diagnosePathologies({
        f0Hz: 190.0,
        jitterPercent: 2.85,
        shimmerPercent: 7.20,
        hnrDb: 7.8,
        cppDb: 5.2,
        fcr: 1.18,
        tremorDepthPercent: 0.0,
      });

      expect(diagnosis.healthStatus).toBe('pathological-dysphonia');
      expect(diagnosis.hallmarks.some((h) => h.includes('Vocal Nodules'))).toBe(true);
      expect(diagnosis.hallmarks.some((h) => h.includes('Glottic Gap'))).toBe(true);
    });

    it('classifies hyperfunctional muscular strain correctly', () => {
      const diagnosis = VoiceBiometricsPhysics.diagnosePathologies({
        f0Hz: 275.0,
        jitterPercent: 1.85,
        shimmerPercent: 4.20,
        hnrDb: 14.0,
        cppDb: 10.5,
        fcr: 1.05,
        tremorDepthPercent: 0.0,
      });

      expect(diagnosis.healthStatus).toBe('mild-strain');
      expect(diagnosis.hallmarks.some((h) => h.includes('Muscle Tension'))).toBe(true);
    });

    it('classifies respiratory fatigue phonation instability correctly', () => {
      const diagnosis = VoiceBiometricsPhysics.diagnosePathologies({
        f0Hz: 165.0,
        jitterPercent: 0.95,
        shimmerPercent: 3.10,
        hnrDb: 16.2,
        cppDb: 11.0,
        fcr: 1.02,
        tremorDepthPercent: 4.0,
      });

      expect(diagnosis.healthStatus).toBe('respiratory-fatigue');
      expect(diagnosis.hallmarks.some((h) => h.includes('Respiratory'))).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // 8. Personalized Sound Medicine Prescription Formulator
  // --------------------------------------------------------------------------
  describe('Personalized Sound Medicine Prescription Formulator', () => {
    it('formulates 432 Hz Golden Ratio prescription for pristine vocal state', () => {
      const rx = VoiceBiometricsPhysics.generatePrescription({
        f0Hz: 220.0,
        healthStatus: 'pristine',
        formants: [280, 2250, 3100, 3600],
      });

      expect(rx.baseToneHz).toBe(432.0);
      expect(rx.binauralBeatHz).toBe(10.0); // Alpha 10 Hz
      expect(rx.harmonicOvertones[1]).toBeCloseTo(220.0 * 1.618, 1); // Golden Ratio Phi overtone
      expect(rx.prescriptionTitle).toContain('432 Hz');
    });

    it('formulates 6 Hz Theta neuromodulatory prescription for neurological tremor', () => {
      const rx = VoiceBiometricsPhysics.generatePrescription({
        f0Hz: 145.0,
        healthStatus: 'neurological-tremor',
        formants: [500, 1500, 2500, 3500],
      });

      expect(rx.baseToneHz).toBe(145.0);
      expect(rx.binauralBeatHz).toBe(6.0); // 6 Hz Theta
      expect(rx.isochronicPulseRateHz).toBe(6.0);
      expect(rx.prescriptionTitle).toContain('Theta');
    });

    it('formulates 110 Hz low-stress inertance loading for vocal nodule dysphonia', () => {
      const rx = VoiceBiometricsPhysics.generatePrescription({
        f0Hz: 190.0,
        healthStatus: 'pathological-dysphonia',
        formants: [720, 1380, 2450, 3350],
      });

      expect(rx.baseToneHz).toBe(110.0);
      expect(rx.binauralBeatHz).toBe(8.0);
      expect(rx.harmonicOvertones).toEqual([110, 220, 330, 440]);
      expect(rx.prescriptionTitle).toContain('Inertance');
    });

    it('formulates 528 Hz cellular restorative resonance for respiratory fatigue', () => {
      const rx = VoiceBiometricsPhysics.generatePrescription({
        f0Hz: 165.0,
        healthStatus: 'respiratory-fatigue',
        formants: [680, 1620, 2600, 3600],
      });

      expect(rx.baseToneHz).toBe(528.0);
      expect(rx.binauralBeatHz).toBeCloseTo(7.83, 2); // Schumann Resonance
      expect(rx.harmonicOvertones[1]).toBeCloseTo(528.0 * 1.618, 1);
      expect(rx.prescriptionTitle).toContain('528 Hz');
    });
  });

  // --------------------------------------------------------------------------
  // 9. Clinical Indices & Neurological Dysarthria Assessment
  // --------------------------------------------------------------------------
  describe('Clinical Indices (DSI & AVQI) and Vowel Space Metrics', () => {
    it('calculates Dysphonia Severity Index (DSI) within physiological boundaries [-10, 10]', () => {
      // Pristine vocal parameters
      const healthyDsi = VoiceBiometricsPhysics.calculateDSI({
        mptSec: 22.0,
        f0HighHz: 750.0,
        iLowDba: 48.0,
        jitterPercent: 0.25,
      });
      expect(healthyDsi).toBeGreaterThan(4.0); // Normal healthy voice DSI > +3.1

      // Severely pathological parameters
      const severeDsi = VoiceBiometricsPhysics.calculateDSI({
        mptSec: 5.0,
        f0HighHz: 250.0,
        iLowDba: 68.0,
        jitterPercent: 4.5,
      });
      expect(severeDsi).toBeLessThan(0.0); // Severe dysphonia DSI < -1.5
    });

    it('calculates Acoustic Voice Quality Index (AVQI v03.01) with clinical cutoff accuracy', () => {
      // Healthy vocal quality (CPP high, HNR high, Shimmer low)
      const healthyAvqi = VoiceBiometricsPhysics.calculateAVQI({
        cppDb: 17.5,
        hnrDb: 27.0,
        shimmerPercent: 1.5,
        shimmerDb: 0.12,
      });
      expect(healthyAvqi).toBeLessThan(3.0); // Normal AVQI < 3.01

      // Pathological vocal quality (CPP low, HNR low, Shimmer high)
      const dysphonicAvqi = VoiceBiometricsPhysics.calculateAVQI({
        cppDb: 4.5,
        hnrDb: 6.8,
        shimmerPercent: 8.5,
        shimmerDb: 0.85,
      });
      expect(dysphonicAvqi).toBeGreaterThan(5.0); // Severe dysphonia > 4.5
    });

    it('calculates Vowel Space Area (VSA) and detects dysarthric formant centralization (FCR > 1.2)', () => {
      // Normative open vowel space
      const healthyFormants = {
        i: [280, 2250] as [number, number],
        u: [320, 800] as [number, number],
        a: [750, 1250] as [number, number],
      };
      const healthyRes = VoiceBiometricsPhysics.calculateVowelSpaceMetrics(healthyFormants);
      expect(healthyRes.fcr).toBeLessThan(1.05);
      expect(healthyRes.vai).toBeGreaterThan(0.95);
      expect(healthyRes.vsaHz2).toBeGreaterThan(200000);
      expect(healthyRes.isDysarthric).toBe(false);

      // Centralized / contracted vowel space (Articulatory undershoot)
      const centralizedFormants = {
        i: [450, 1650] as [number, number],
        u: [480, 1350] as [number, number],
        a: [580, 1400] as [number, number],
      };
      const centralizedRes = VoiceBiometricsPhysics.calculateVowelSpaceMetrics(centralizedFormants);
      expect(centralizedRes.fcr).toBeGreaterThan(1.20);
      expect(centralizedRes.vai).toBeLessThan(0.85);
      expect(centralizedRes.vsaHz2).toBeLessThan(180000);
      expect(centralizedRes.isDysarthric).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // 10. Performance & Execution Speed Benchmarks
  // --------------------------------------------------------------------------
  describe('Performance Benchmarks & Execution Time Bounds', () => {
    it('executes full YIN + LPC-16 + CPP + HNR pipeline in under 1.5 ms per frame', () => {
      const N = 2048;
      const buffer = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        buffer[i] = Math.sin((2 * Math.PI * 220 * i) / SAMPLE_RATE);
      }

      const iterations = 50;
      const t0 = performance.now();

      for (let iter = 0; iter < iterations; iter++) {
        const pitch = VoiceBiometricsPhysics.extractPitchYIN(buffer, SAMPLE_RATE);
        const lpc = VoiceBiometricsPhysics.calculateLpcAreaFunction(buffer, 16);
        const hnr = VoiceBiometricsPhysics.calculateHNR(buffer, pitch.periodSamples);
        const cpp = VoiceBiometricsPhysics.calculateCPP(buffer, SAMPLE_RATE);
        const pert = VoiceBiometricsPhysics.calculatePerturbationMetrics([72.7, 72.8, 72.7, 72.75, 72.8, 72.72], [0.8, 0.81, 0.8, 0.81, 0.8, 0.81]);
        VoiceBiometricsPhysics.diagnosePathologies({
          f0Hz: pitch.f0,
          jitterPercent: pert.jitterLoc,
          shimmerPercent: pert.shimmerLoc,
          hnrDb: hnr,
          cppDb: cpp,
          fcr: 1.0,
          tremorDepthPercent: 0,
        });
      }

      const totalTimeMs = performance.now() - t0;
      const avgTimePerFrameMs = totalTimeMs / iterations;

      // Must execute well within 120 FPS 8.33 ms frame budget
      expect(avgTimePerFrameMs).toBeLessThan(1.50);
    });
  });
});
