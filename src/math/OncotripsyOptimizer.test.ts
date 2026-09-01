import { describe, it, expect } from 'vitest';
import { OncotripsyOptimizer } from './OncotripsyOptimizer';
import { OncotripsyPhysics } from './OncotripsyPhysics';

describe('OncotripsyOptimizer - Multi-Parameter Therapeutic Window & Protocol Engine', () => {
  it('calculates exact damped mechanical resonance peak shifted below undamped frequency', () => {
    const { fPeakHz, zeta } = OncotripsyOptimizer.calculateDampedResonance(120.0, 4.0);
    expect(zeta).toBeCloseTo(0.125, 3);
    // f_peak = 120 * sqrt(1 - 2*(0.125)^2) = 120 * sqrt(1 - 0.03125) = 120 * 0.98425 = 118.11 Hz
    expect(fPeakHz).toBeLessThan(120.0);
    expect(fPeakHz).toBeGreaterThan(117.0);
  });

  it('optimizes protocols across all 5 clinical AFM cancer phenotypes with >90% lysis and >70% safety index', () => {
    const profiles = Object.values(OncotripsyPhysics.CLINICAL_PROFILES);

    profiles.forEach(p => {
      const protocol = OncotripsyOptimizer.optimizeClinicalProfile(p);

      expect(protocol.targetTumor.name).toBe(p.name);
      expect(protocol.predictedYield.expectedTumorLysisPercent).toBeGreaterThanOrEqual(90.0);
      expect(protocol.predictedYield.healthyTissueSafetyIndexPercent).toBeGreaterThanOrEqual(70.0);
      expect(protocol.predictedYield.strainSelectivityRatio).toBeGreaterThan(5.0);
      expect(protocol.predictedYield.focalTemperatureRiseC).toBeLessThan(0.20);
      expect(protocol.predictedYield.thermalDoseCEM43Minutes).toBeLessThan(0.001);
    });
  });

  it('generates complete transducer hardware, timing, and acoustic dosimetry specifications', () => {
    const customTumor = {
      tumorName: 'Patient-Derived Glioblastoma Spheroid',
      youngsModulusKPa: 0.20,
      qualityFactorQ: 3.5,
      yieldStrain: 0.20,
    };

    const protocol = OncotripsyOptimizer.optimizeProtocol(customTumor);

    expect(protocol.transducerHardware.recommendedCarrierFreqMHz).toBe(1.0);
    expect(protocol.transducerHardware.envelopeModulationFreqHz).toBeGreaterThan(0);
    expect(protocol.transducerHardware.heterodyne11thHarmonicHz).toBeCloseTo(
      protocol.transducerHardware.envelopeModulationFreqHz / 11.0,
      1
    );
    expect(protocol.timingParameters.dutyCyclePercent).toBeLessThan(0.1);
    expect(protocol.timingParameters.totalPulses).toBe(18000);
    expect(protocol.acousticDosimetry.mechanicalIndex).toBeLessThan(3.0);
  });
});
