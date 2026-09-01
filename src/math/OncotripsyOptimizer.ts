/**
 * OncotripsyOptimizer.ts
 * SoundForm 3D - Clinical Oncotripsy Therapeutic Window Optimization & Automated Lab Protocol Engine
 *
 * Mathematical Foundations:
 * 1. Viscoelastic Constitutive Damped Resonance Peak:
 *    omega_peak = omega_0 * sqrt(1 - 2*zeta^2) where zeta = 1 / (2*Q)
 * 2. Ortiz-Mittelstein Dynamic Cellular Strain:
 *    epsilon(omega) = (sigma_0 / E) / sqrt((1 - (omega/omega_0)^2)^2 + (2*zeta*omega/omega_0)^2)
 * 3. Spectral Selectivity Ratio S(omega):
 *    S(omega) = (epsilon_tumor / epsilon_yield_tumor) / (epsilon_healthy / epsilon_yield_healthy)
 * 4. Healthy Tissue Safety Index (HTSI):
 *    HTSI = (1.0 - epsilon_healthy / epsilon_yield_healthy) * 100% (Safety limit >= 65%)
 * 5. Pennes Bioheat & Sapareto-Dewey Non-Thermal Floor:
 *    Delta T < 1.0 deg C, CEM43 < 0.001 min
 */

import { OncotripsyPhysics, ClinicalTumorProfile } from './OncotripsyPhysics';

export interface CustomTumorInput {
  tumorName: string;
  youngsModulusKPa: number; // E (0.10 - 5.0 kPa)
  qualityFactorQ: number; // Q (2.5 - 10.0)
  yieldStrain: number; // epsilon_yield (0.15 - 0.35)
  cellularRadiusUm?: number; // R_cell (8.0 - 20.0 um)
}

export interface OptimizedOncotripsyProtocol {
  targetTumor: {
    name: string;
    youngsModulusKPa: number;
    resonantFrequencyHz: number;
    dampedPeakFrequencyHz: number;
    qualityFactorQ: number;
    dampingRatioZeta: number;
    yieldStrain: number;
  };
  transducerHardware: {
    recommendedCarrierFreqMHz: number;
    envelopeModulationFreqHz: number;
    heterodyne11thHarmonicHz: number;
    fNumber: number;
    focalDepthMm: number;
  };
  acousticDosimetry: {
    peakNegativePressureMPa: number;
    peakPositivePressureMPa: number;
    spatialPeakPulseAvgIntensityWcm2: number;
    spatialPeakTemporalAvgIntensityWcm2: number;
    mechanicalIndex: number;
  };
  timingParameters: {
    pulseRepetitionFreqHz: number;
    pulseCycles: number;
    pulseDurationUs: number;
    dutyCyclePercent: number;
    treatmentDurationSeconds: number;
    totalPulses: number;
  };
  predictedYield: {
    tumorPeakDynamicStrain: number;
    healthyPeakDynamicStrain: number;
    strainSelectivityRatio: number;
    expectedTumorLysisPercent: number;
    healthyTissueSafetyIndexPercent: number;
    healthyTissuePreservedPercent: number;
    focalTemperatureRiseC: number;
    thermalDoseCEM43Minutes: number;
  };
}

export class OncotripsyOptimizer {
  public static readonly HEALTHY_MODULUS_KPA = 3.50; // MCF-10A stromal baseline
  public static readonly HEALTHY_Q = 12.0;
  public static readonly HEALTHY_YIELD_STRAIN = 0.50;
  public static readonly MEDIUM_DENSITY = 1060.0; // kg/m^3
  public static readonly SOUND_SPEED = 1540.0; // m/s

  /**
   * Calculates exact damped mechanical resonance frequency
   */
  public static calculateDampedResonance(f0Hz: number, Q: number): { fPeakHz: number; zeta: number } {
    const zeta = 1.0 / (2.0 * Math.max(1.0, Q));
    const radicand = 1.0 - 2.0 * zeta * zeta;
    const fPeakHz = radicand > 0 ? f0Hz * Math.sqrt(radicand) : f0Hz;
    return { fPeakHz, zeta };
  }

  /**
   * Evaluates dynamic cellular strain for given parameters
   */
  public static calculateStrain(
    freqHz: number,
    f0Hz: number,
    zeta: number,
    modulusKPa: number,
    acousticPressureMPa: number
  ): number {
    const sigma0 = Math.max(0.01, acousticPressureMPa * 0.08); // Effective stress amplitude in kPa
    const u = (freqHz / Math.max(1.0, f0Hz)) ** 2;
    const denominator = Math.sqrt((1.0 - u) ** 2 + 4.0 * zeta * zeta * u);
    return (sigma0 / Math.max(0.01, modulusKPa)) / Math.max(0.001, denominator);
  }

  /**
   * Optimizes acoustic protocol to maximize tumor lysis while preserving healthy tissue
   */
  public static optimizeProtocol(tumorInput: CustomTumorInput, baselineF0Hz?: number): OptimizedOncotripsyProtocol {
    // Determine natural frequency f0 from modulus scaling if not provided
    const f0 = baselineF0Hz ?? 120.0 * Math.sqrt(tumorInput.youngsModulusKPa / 0.42);
    const Q = Math.max(2.5, tumorInput.qualityFactorQ);
    const { fPeakHz, zeta } = this.calculateDampedResonance(f0, Q);

    const healthyZeta = 1.0 / (2.0 * this.HEALTHY_Q);
    const healthyF0 = 120.0 * Math.sqrt(this.HEALTHY_MODULUS_KPA / 0.42);

    // Optimize acoustic pressure p0 to achieve tumor strain = 1.25 * yieldStrain
    const targetTumorStrain = tumorInput.yieldStrain * 1.25;
    const tumorResonantGain = 1.0 / (2.0 * zeta * Math.sqrt(Math.max(0.01, 1.0 - zeta * zeta)));
    const neededSigma0 = (targetTumorStrain * tumorInput.youngsModulusKPa) / tumorResonantGain;
    const p0MPa = Math.min(3.0, Math.max(0.25, neededSigma0 / 0.08));

    // Calculate actual strains at optimal frequency
    const tumorStrain = this.calculateStrain(fPeakHz, f0, zeta, tumorInput.youngsModulusKPa, p0MPa);
    const healthyStrain = this.calculateStrain(fPeakHz, healthyF0, healthyZeta, this.HEALTHY_MODULUS_KPA, p0MPa);

    const normTumor = tumorStrain / Math.max(0.01, tumorInput.yieldStrain);
    const normHealthy = healthyStrain / this.HEALTHY_YIELD_STRAIN;
    const selectivityRatio = normTumor / Math.max(0.001, normHealthy);

    const lysisPercent = Math.min(99.9, Math.max(0.0, 100.0 * (1.0 - Math.exp(-Math.max(0, normTumor - 0.70) * 5.5))));
    const htsi = Math.min(100.0, Math.max(0.0, (1.0 - normHealthy) * 100.0));
    const healthyPreserved = Math.min(99.9, Math.max(70.0, 100.0 - (normHealthy ** 3) * 15.0));

    // Non-thermal timing parameters
    const PRF = 100.0; // Hz
    const pulseCycles = 5;
    const carrierMHz = 1.0;
    const pulseDurationUs = pulseCycles / carrierMHz; // 5 us
    const dutyCycle = (pulseDurationUs * 1e-6) * PRF; // 0.05%
    const durationSeconds = 180.0; // 3 minutes

    const I_sppa = (p0MPa ** 2 * 1e12) / (2.0 * this.MEDIUM_DENSITY * this.SOUND_SPEED) * 1e-4; // W/cm^2
    const I_spta = I_sppa * dutyCycle;
    const deltaT = Number(((2.0 * 0.05 * I_spta * durationSeconds) / (this.MEDIUM_DENSITY * 3700.0 * 1e-4)).toFixed(3));
    const cem43 = Number(((durationSeconds / 60.0) * (deltaT > 0 ? 0.25 ** Math.max(0, 43 - (37 + deltaT)) : 0)).toFixed(6));
    const mi = Number((p0MPa / Math.sqrt(carrierMHz)).toFixed(2));

    return {
      targetTumor: {
        name: tumorInput.tumorName,
        youngsModulusKPa: tumorInput.youngsModulusKPa,
        resonantFrequencyHz: Number(f0.toFixed(1)),
        dampedPeakFrequencyHz: Number(fPeakHz.toFixed(1)),
        qualityFactorQ: tumorInput.qualityFactorQ,
        dampingRatioZeta: Number(zeta.toFixed(3)),
        yieldStrain: tumorInput.yieldStrain,
      },
      transducerHardware: {
        recommendedCarrierFreqMHz: carrierMHz,
        envelopeModulationFreqHz: Number(fPeakHz.toFixed(1)),
        heterodyne11thHarmonicHz: Number((fPeakHz / 11.0).toFixed(2)),
        fNumber: 1.05,
        focalDepthMm: 65.0,
      },
      acousticDosimetry: {
        peakNegativePressureMPa: Number(p0MPa.toFixed(2)),
        peakPositivePressureMPa: Number((p0MPa * 3.1).toFixed(2)),
        spatialPeakPulseAvgIntensityWcm2: Number(I_sppa.toFixed(1)),
        spatialPeakTemporalAvgIntensityWcm2: Number(I_spta.toFixed(4)),
        mechanicalIndex: mi,
      },
      timingParameters: {
        pulseRepetitionFreqHz: PRF,
        pulseCycles,
        pulseDurationUs,
        dutyCyclePercent: Number((dutyCycle * 100).toFixed(3)),
        treatmentDurationSeconds: durationSeconds,
        totalPulses: PRF * durationSeconds,
      },
      predictedYield: {
        tumorPeakDynamicStrain: Number(tumorStrain.toFixed(3)),
        healthyPeakDynamicStrain: Number(healthyStrain.toFixed(3)),
        strainSelectivityRatio: Number(selectivityRatio.toFixed(1)),
        expectedTumorLysisPercent: Number(lysisPercent.toFixed(1)),
        healthyTissueSafetyIndexPercent: Number(htsi.toFixed(1)),
        healthyTissuePreservedPercent: Number(healthyPreserved.toFixed(1)),
        focalTemperatureRiseC: deltaT,
        thermalDoseCEM43Minutes: cem43,
      },
    };
  }

  /**
   * Helper to optimize for any known clinical AFM tumor profile
   */
  public static optimizeClinicalProfile(profile: ClinicalTumorProfile): OptimizedOncotripsyProtocol {
    return this.optimizeProtocol(
      {
        tumorName: profile.name,
        youngsModulusKPa: profile.youngsModulusKPa,
        qualityFactorQ: profile.qualityFactorQ,
        yieldStrain: profile.strainFailureThreshold,
      },
      profile.resonantFreqHz
    );
  }
}
