/**
 * OncotripsyPhysics.ts
 * SoundForm 3D - Active Acoustic Phase Cancellation & Oncotripsy Physics
 *
 * Mathematical Formulations & Clinical Elastography Database:
 * 1. Active Noise Cancellation & Wave Superposition:
 *    p_net(x, t) = p_cancer(x, t) + p_therapeutic(x, t)
 *    <|p_net|^2> = (1/2) * [ A_c^2 + A_t^2 + 2 * A_c * A_t * cos(Delta_phi) ]
 *    Delta_phi = pi (180 deg) -> p_net = 0 (Complete Destructive Interference)
 *
 * 2. Oncotripsy Dynamic Strain Response (Ortiz/Mittelstein Model):
 *    epsilon(omega) = (sigma_0 / E) / sqrt( (1 - (omega/omega_0)^2)^2 + (2 * zeta * omega / omega_0)^2 )
 *    When omega = omega_cancer: epsilon_cancer >> epsilon_fail (~0.20 - 0.26) -> Lysis
 *                              epsilon_healthy << epsilon_fail (~0.50) -> 100% Preserved
 *
 * 3. 11th-Harmonic Heterodyne Fatigue Modulation (Holland Protocol):
 *    f_beat = f_carrier / 11.0
 *    Dynamic cyclic strain amplified via resonant fatigue accumulation.
 */

export interface ClinicalTumorProfile {
  id: string;
  name: string;
  organ: string;
  youngsModulusKPa: number;
  corticalTensionMNm: number;
  resonantFreqHz: number;
  strainFailureThreshold: number;
  qualityFactorQ: number;
  dampingRatioZeta: number;
  colorHex: number;
}

export interface OncotripsyState {
  tumorProfileId: string;
  frequencyHz: number;
  phaseDegrees: number;
  acousticPower: number;
  isAntiPhaseActive: boolean;
  isOncotripsyActive: boolean;
  isHeterodyneActive: boolean;
  isTimeReversalActive: boolean;
  viewMode: 'co-culture-pair' | 'spheroid-cluster';
}

export interface TherapyTelemetry {
  netPressurePa: number;
  cancellationEfficiencyPercent: number;
  cancerStrain: number;
  healthyStrain: number;
  cancerLysisPercent: number;
  healthyPreservedPercent: number;
  isCancerRupturing: boolean;
  strainSelectivityRatio: number;
  heterodyneFatigueMultiplier: number;
}

export class OncotripsyPhysics {
  public static readonly CLINICAL_PROFILES: Record<string, ClinicalTumorProfile> = {
    'u87-mg': {
      id: 'u87-mg',
      name: 'Glioblastoma Multiforme (U87)',
      organ: 'Brain Cerebrum',
      youngsModulusKPa: 0.15,
      corticalTensionMNm: 0.02,
      resonantFreqHz: 85.0,
      strainFailureThreshold: 0.22,
      qualityFactorQ: 3.2,
      dampingRatioZeta: 0.156,
      colorHex: 0xff0066,
    },
    'panc-1': {
      id: 'panc-1',
      name: 'Pancreatic Ductal Carcinoma (PANC-1)',
      organ: 'Pancreas',
      youngsModulusKPa: 0.28,
      corticalTensionMNm: 0.03,
      resonantFreqHz: 95.0,
      strainFailureThreshold: 0.20,
      qualityFactorQ: 4.0,
      dampingRatioZeta: 0.125,
      colorHex: 0xff3344,
    },
    'mda-mb-231': {
      id: 'mda-mb-231',
      name: 'Triple-Negative Breast (MDA-MB-231)',
      organ: 'Mammary Gland',
      youngsModulusKPa: 0.42,
      corticalTensionMNm: 0.05,
      resonantFreqHz: 118.0,
      strainFailureThreshold: 0.24,
      qualityFactorQ: 4.8,
      dampingRatioZeta: 0.104,
      colorHex: 0xff0099,
    },
    'hep-g2': {
      id: 'hep-g2',
      name: 'Hepatocellular Carcinoma (HepG2)',
      organ: 'Liver Parenchyma',
      youngsModulusKPa: 0.68,
      corticalTensionMNm: 0.07,
      resonantFreqHz: 142.0,
      strainFailureThreshold: 0.25,
      qualityFactorQ: 5.8,
      dampingRatioZeta: 0.086,
      colorHex: 0x10b981,
    },
    'saos-2': {
      id: 'saos-2',
      name: 'Osteosarcoma (SaOS-2)',
      organ: 'Bone Cortex',
      youngsModulusKPa: 1.80,
      corticalTensionMNm: 0.18,
      resonantFreqHz: 180.0,
      strainFailureThreshold: 0.26,
      qualityFactorQ: 7.5,
      dampingRatioZeta: 0.067,
      colorHex: 0xff8800,
    },
  };

  public static readonly HEALTHY_PROFILE: ClinicalTumorProfile = {
    id: 'mcf-10a',
    name: 'Healthy Human Somatic Stroma (MCF-10A)',
    organ: 'Normal Parenchyma',
    youngsModulusKPa: 3.50,
    corticalTensionMNm: 0.35,
    resonantFreqHz: 220.0,
    strainFailureThreshold: 0.50,
    qualityFactorQ: 12.0,
    dampingRatioZeta: 0.042,
    colorHex: 0x00e5ff,
  };

  /**
   * Calculates net acoustic pressure and cancellation efficiency under superposition
   */
  public static calculateActiveCancellation(
    amplitudeCancer: number,
    amplitudeTherapy: number,
    phaseOffsetDegrees: number
  ): { netPressure: number; efficiencyPercent: number } {
    const deltaPhiRad = (phaseOffsetDegrees * Math.PI) / 180.0;
    const meanSquared =
      0.5 *
      (amplitudeCancer * amplitudeCancer +
        amplitudeTherapy * amplitudeTherapy +
        2 * amplitudeCancer * amplitudeTherapy * Math.cos(deltaPhiRad));

    const netPressure = Math.sqrt(Math.max(0, meanSquared * 2));
    const maxPossible = amplitudeCancer + amplitudeTherapy;
    const cancellationPercent =
      maxPossible > 1e-6
        ? Math.max(0, Math.min(100, (1.0 - netPressure / maxPossible) * 100))
        : 100.0;

    return {
      netPressure,
      efficiencyPercent: cancellationPercent,
    };
  }

  /**
   * Calculates dynamic mechanical strain epsilon(omega) for a cell under acoustic driving
   */
  public static calculateDynamicStrain(
    frequencyHz: number,
    resonantFreqHz: number,
    youngsModulusPa: number,
    qualityFactor: number,
    incidentStressPa: number
  ): number {
    const omegaRatio = frequencyHz / resonantFreqHz;
    const dampingZeta = 1.0 / (2.0 * qualityFactor);

    const term1 = Math.pow(1.0 - omegaRatio * omegaRatio, 2);
    const term2 = Math.pow(2.0 * dampingZeta * omegaRatio, 2);
    const denominator = Math.sqrt(term1 + term2);

    const staticStrain = incidentStressPa / youngsModulusPa;
    return staticStrain / Math.max(0.001, denominator);
  }

  /**
   * Evaluates comprehensive therapy telemetry for given lab state
   */
  public static evaluateTherapyTelemetry(state: OncotripsyState): TherapyTelemetry {
    const tumor = this.CLINICAL_PROFILES[state.tumorProfileId] || this.CLINICAL_PROFILES['mda-mb-231'];
    const healthy = this.HEALTHY_PROFILE;

    // 1. Active Phase Cancellation
    const baseAmp = 10.0 * state.acousticPower;
    const therapyAmp = state.isAntiPhaseActive ? baseAmp : baseAmp * Math.min(1.0, state.acousticPower);
    const effectivePhase = state.isAntiPhaseActive ? 180.0 : state.phaseDegrees;

    const { netPressure, efficiencyPercent } = this.calculateActiveCancellation(
      baseAmp,
      therapyAmp,
      effectivePhase
    );

    // 2. Heterodyne Cyclic Fatigue Multiplier (Holland 11th harmonic)
    const heterodyneMultiplier = state.isHeterodyneActive ? 1.55 : 1.0;
    const incidentStress = (state.isOncotripsyActive ? 45.0 : 10.0) * state.acousticPower * heterodyneMultiplier;

    // 3. Dynamic Strain Calculations
    const cancerStrain = this.calculateDynamicStrain(
      state.frequencyHz,
      tumor.resonantFreqHz,
      tumor.youngsModulusKPa * 1000.0,
      tumor.qualityFactorQ,
      incidentStress
    );

    const healthyStrain = this.calculateDynamicStrain(
      state.frequencyHz,
      healthy.resonantFreqHz,
      healthy.youngsModulusKPa * 1000.0,
      healthy.qualityFactorQ,
      incidentStress
    );

    // 4. Lysis & Tissue Preservation
    const isCancerRupturing = cancerStrain >= tumor.strainFailureThreshold;
    const cancerLysis = Math.min(100, Math.max(0, (cancerStrain / tumor.strainFailureThreshold) * 100));
    const healthyPreserved = Math.max(0, Math.min(100, 100 - (healthyStrain / healthy.strainFailureThreshold) * 100));
    const strainSelectivityRatio = healthyStrain > 0 ? cancerStrain / healthyStrain : 99.0;

    return {
      netPressurePa: netPressure,
      cancellationEfficiencyPercent: efficiencyPercent,
      cancerStrain,
      healthyStrain,
      cancerLysisPercent: state.isOncotripsyActive ? Math.min(100, cancerLysis) : Math.min(70, cancerLysis),
      healthyPreservedPercent: healthyPreserved,
      isCancerRupturing,
      strainSelectivityRatio,
      heterodyneFatigueMultiplier: heterodyneMultiplier,
    };
  }
}
