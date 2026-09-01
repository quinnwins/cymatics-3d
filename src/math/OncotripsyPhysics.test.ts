import { describe, it, expect } from 'vitest';
import { OncotripsyPhysics, OncotripsyState } from './OncotripsyPhysics';

describe('OncotripsyPhysics - Clinical AFM Elastography & Oncotripsy', () => {
  describe('Active Phase Cancellation', () => {
    it('cancels to 0 pressure at 180 degrees anti-phase (100% cancellation)', () => {
      const { netPressure, efficiencyPercent } = OncotripsyPhysics.calculateActiveCancellation(10.0, 10.0, 180.0);
      expect(netPressure).toBeCloseTo(0, 4);
      expect(efficiencyPercent).toBeCloseTo(100, 2);
    });

    it('doubles amplitude at 0 degrees in-phase (constructive interference)', () => {
      const { netPressure, efficiencyPercent } = OncotripsyPhysics.calculateActiveCancellation(10.0, 10.0, 0.0);
      expect(netPressure).toBeCloseTo(20.0, 4);
      expect(efficiencyPercent).toBeCloseTo(0, 2);
    });
  });

  describe('Clinical Tumor AFM Profiles & Selective Strain Mismatch', () => {
    it('demonstrates selective rupture across all clinical tumor types at their resonance', () => {
      const tumorKeys = ['u87-mg', 'panc-1', 'mda-mb-231', 'hep-g2', 'saos-2'];

      for (const key of tumorKeys) {
        const tumor = OncotripsyPhysics.CLINICAL_PROFILES[key];
        const state: OncotripsyState = {
          tumorProfileId: key,
          frequencyHz: tumor.resonantFreqHz,
          phaseDegrees: 0,
          acousticPower: 1.0,
          isAntiPhaseActive: false,
          isOncotripsyActive: true,
          isHeterodyneActive: true,
          isTimeReversalActive: false,
          viewMode: 'co-culture-pair',
        };

        const tel = OncotripsyPhysics.evaluateTherapyTelemetry(state);

        // Cancer strain exceeds its rupture threshold
        expect(tel.cancerStrain).toBeGreaterThan(tumor.strainFailureThreshold);

        // Healthy tissue remains protected (> 85% preserved)
        expect(tel.healthyPreservedPercent).toBeGreaterThan(85.0);

        // High selectivity ratio across all phenotypes (> 4.5:1 for bone sarcoma, > 10:1 for carcinoma/glioma)
        expect(tel.strainSelectivityRatio).toBeGreaterThan(4.5);
      }
    });
  });
});
