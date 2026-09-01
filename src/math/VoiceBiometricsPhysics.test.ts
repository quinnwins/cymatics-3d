import { describe, it, expect } from 'vitest';
import { VoiceBiometricsPhysics } from './VoiceBiometricsPhysics';

describe('VoiceBiometricsPhysics - Vocal DSP & Sound Medicine', () => {
  describe('YIN Pitch Extraction', () => {
    it('accurately extracts fundamental pitch from pure sine wave', () => {
      const sampleRate = 16000;
      const targetFreq = 220; // A3
      const N = 2048;
      const buffer = new Float32Array(N);

      for (let i = 0; i < N; i++) {
        buffer[i] = Math.sin((2 * Math.PI * targetFreq * i) / sampleRate);
      }

      const result = VoiceBiometricsPhysics.extractPitchYIN(buffer, sampleRate);
      expect(result.f0).toBeCloseTo(targetFreq, 0);
      expect(result.confidence).toBeGreaterThan(0.85);
    });

    it('handles harmonic multi-tone phonation input', () => {
      const sampleRate = 16000;
      const f0 = 130;
      const N = 2048;
      const buffer = new Float32Array(N);

      for (let i = 0; i < N; i++) {
        buffer[i] =
          1.0 * Math.sin((2 * Math.PI * f0 * i) / sampleRate) +
          0.6 * Math.sin((2 * Math.PI * 2 * f0 * i) / sampleRate) +
          0.3 * Math.sin((2 * Math.PI * 3 * f0 * i) / sampleRate);
      }

      const result = VoiceBiometricsPhysics.extractPitchYIN(buffer, sampleRate);
      expect(result.f0).toBeCloseTo(f0, 0);
      expect(result.confidence).toBeGreaterThan(0.75);
    });
  });

  describe('Clinical Perturbation Metrics', () => {
    it('calculates low jitter and shimmer for periodic steady input', () => {
      const periods = [72.7, 72.8, 72.7, 72.75, 72.8, 72.72, 72.78, 72.7];
      const amps = [0.85, 0.86, 0.85, 0.855, 0.85, 0.86, 0.85, 0.855];

      const metrics = VoiceBiometricsPhysics.calculatePerturbationMetrics(periods, amps);
      expect(metrics.jitterLoc).toBeLessThan(0.5); // < 0.5% (healthy)
      expect(metrics.shimmerLoc).toBeLessThan(2.0); // < 2.0% (healthy)
    });

    it('calculates elevated jitter and shimmer for dysphonic input', () => {
      const periods = [70.0, 75.2, 68.1, 74.0, 69.5, 76.0, 68.0, 75.5];
      const amps = [0.85, 0.60, 0.92, 0.55, 0.88, 0.62, 0.95, 0.58];

      const metrics = VoiceBiometricsPhysics.calculatePerturbationMetrics(periods, amps);
      expect(metrics.jitterLoc).toBeGreaterThan(1.5); // > 1.5% (pathological)
      expect(metrics.shimmerLoc).toBeGreaterThan(5.0); // > 5.0% (pathological)
    });
  });

  describe('LPC-16 Area Function & Formants', () => {
    it('generates 16 reflection coefficients and tube radii within physiological bounds', () => {
      const N = 1024;
      const buffer = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        buffer[i] = Math.sin((2 * Math.PI * 220 * i) / 16000) * Math.exp(-i / 800);
      }

      const lpc = VoiceBiometricsPhysics.calculateLpcAreaFunction(buffer, 16);
      expect(lpc.reflectionCoeffs.length).toBe(16);
      expect(lpc.radiiCm.length).toBe(16);

      // Area radii must be positive and within reasonable vocal tract range [0.1, 3.5] cm
      for (const r of lpc.radiiCm) {
        expect(r).toBeGreaterThan(0.05);
        expect(r).toBeLessThan(3.5);
      }
    });
  });

  describe('Clinical Diagnostic Classifier & Sound Medicine Generator', () => {
    it('diagnoses Parkinsonian tremor and generates theta stabilization prescription', () => {
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
      expect(diagnosis.hallmarks.some(h => h.includes('Parkinsonian'))).toBe(true);

      const rx = VoiceBiometricsPhysics.generatePrescription({
        f0Hz: 145.0,
        healthStatus: diagnosis.healthStatus,
        formants: [500, 1500, 2500, 3500],
      });

      expect(rx.binauralBeatHz).toBe(6.0); // 6 Hz Theta
      expect(rx.prescriptionTitle).toContain('Theta');
    });

    it('diagnoses vocal nodules and generates low-stress inertance prescription', () => {
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
      expect(diagnosis.hallmarks.some(h => h.includes('Glottal Aspiration'))).toBe(true);

      const rx = VoiceBiometricsPhysics.generatePrescription({
        f0Hz: 190.0,
        healthStatus: diagnosis.healthStatus,
        formants: [720, 1380, 2450, 3350],
      });

      expect(rx.baseToneHz).toBe(110.0);
      expect(rx.prescriptionTitle).toContain('Inertance');
    });
  });
});
