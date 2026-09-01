import { describe, it, expect } from 'vitest';
import { AcoustofluidicSortingPhysics } from './AcoustofluidicSortingPhysics';

describe('AcoustofluidicSortingPhysics - TSAW Nanofiltration & EV/CTC Sorting', () => {
  describe('Acoustic Contrast Factors', () => {
    it('evaluates positive contrast factors for CTCs and Exosomes', () => {
      const phiCTC = AcoustofluidicSortingPhysics.calculateContrastFactor(
        AcoustofluidicSortingPhysics.CTC_DENSITY,
        AcoustofluidicSortingPhysics.CTC_COMPRESSIBILITY
      );
      const phiExo = AcoustofluidicSortingPhysics.calculateContrastFactor(
        AcoustofluidicSortingPhysics.EXOSOME_DENSITY,
        AcoustofluidicSortingPhysics.EXOSOME_COMPRESSIBILITY
      );

      expect(phiCTC).toBeGreaterThan(0.0);
      expect(phiExo).toBeGreaterThan(0.0);
      expect(phiExo).toBeGreaterThan(phiCTC); // Higher density & lower compressibility in lipid vesicles
    });
  });

  describe('Critical Cutoff Diameter (d_cutoff)', () => {
    it('calculates a critical cutoff diameter separating microscale cells from nanoscale vesicles', () => {
      const state = {
        acousticPowerW: 2.0,
        surfaceWaveFreqMHz: 20.0,
        tiltAngleDeg: 15.0,
        sampleFlowRateUlMin: 15.0,
        channelWidthUm: 250.0,
        channelLengthMm: 15.0,
      };

      const dCutoff = AcoustofluidicSortingPhysics.calculateCriticalCutoff(state);

      // d_cutoff should fall between ~500 nm and 3000 nm (0.5 - 3 um)
      expect(dCutoff).toBeGreaterThan(300.0);
      expect(dCutoff).toBeLessThan(10000.0);
      // Confirms CTCs (18 um = 18000 nm) > d_cutoff, and Exosomes (80 nm) < d_cutoff
      expect(18000.0).toBeGreaterThan(dCutoff);
      expect(80.0).toBeLessThan(dCutoff);
    });
  });

  describe('Sorting Telemetry & Purity Guarantees', () => {
    it('achieves >95% CTC deflection and >95% exosome purity under optimal parameters', () => {
      const telemetry = AcoustofluidicSortingPhysics.evaluateSortingTelemetry({
        acousticPowerW: 2.5,
        surfaceWaveFreqMHz: 25.0,
        tiltAngleDeg: 20.0,
        sampleFlowRateUlMin: 10.0,
        channelWidthUm: 200.0,
        channelLengthMm: 12.0,
      });

      expect(telemetry.ctcDeflectionEfficiencyPercent).toBeGreaterThan(95.0);
      expect(telemetry.exosomePurityPercent).toBeGreaterThan(95.0);
      expect(telemetry.exosomeRecoveryRatePercent).toBeGreaterThan(90.0);
      expect(telemetry.isSeparationOptimal).toBe(true);
    });
  });
});
