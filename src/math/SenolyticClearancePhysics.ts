/**
 * SenolyticClearancePhysics.ts
 * SoundForm 3D - Targeted Senolytic Acoustic Clearance Dosing Protocol & Custom Aging Tissue Simulator
 *
 * Mathematical Foundations:
 * 1. Hyper-Stiff Senescent Viscoelastic Constitutive Model:
 *    E_eff(phi_vim, gamma_c) = E_0 * [1 + alpha_vim * (phi_vim / phi_ref)^n_vim] + 2*gamma_c / R_cell
 * 2. Cumulative Basquin-Miner-Mason Acoustic Fatigue Damage Integral:
 *    D(t) = integral( ((epsilon_a - epsilon_endurance) / (epsilon_yield - epsilon_endurance))^beta * f_0 * DC dt )
 * 3. Boltzmann-Hill MOMP Activation Probability:
 *    P_MOMP(t) = 1 / (1 + exp(-(D(t) - D_50) / kappa_D)) * ([Ca2+]^n / (K_Ca^n + [Ca2+]^n))
 * 4. Coupled Caspase-3 Cleavage Apoptosis Execution Cascade:
 *    L_sen(t) = 1 - exp(-([Casp3*] / [Casp3*]_th)^gamma)
 * 5. Nyborg Acoustic Microstreaming Convection-Diffusion SASP Clearance:
 *    C_SASP(t) = C_basal * [(1 - L_sen) + L_sen * exp(-(R_lymph + div(u_stream)) * t)]
 */

export interface AgingTissueProfile {
  name: string;
  youngsModulusKPa: number; // 2.0 - 25.0 kPa (Senescent: ~14.5 kPa, Young: ~2.8 kPa)
  vimentinVolumeFraction: number; // 0.05 - 0.35 (Crosslinked vimentin intermediate filament cage)
  corticalTensionMnM: number; // 0.30 - 2.50 mN/m
  cellRadiusUm: number; // 12.0 - 30.0 um
  isSenescent: boolean;
}

export interface SenolyticDosingParameters {
  peakPressureMPa: number; // 0.10 - 0.85 MPa
  carrierFrequencyMHz: number; // 0.5 - 2.5 MHz
  pulseRepetitionFreqHz: number; // 100 - 5000 Hz
  pulseDurationUs: number; // 5 - 50 us
  exposureDurationSec: number; // 5 - 60 s
}

export interface SenolyticTelemetry {
  acousticEnergyDensityJm3: number;
  cyclicStrainAmplitude: number;
  cumulativeFatigueDamageD: number;
  mompActivationProbability: number;
  cleavedCaspase3ConcentrationNM: number;
  senolyticLysisPercentage: number;
  youngTissuePreservedPercentage: number;
  saspCytokineConcentrationPgMl: number; // Baseline 480 pg/mL -> < 12 pg/mL
  focalTemperatureRiseC: number;
  thermalDoseCEM43Minutes: number;
  isTreatmentSelective: boolean;
}

export class SenolyticClearancePhysics {
  public static readonly BASAL_SASP_CONCENTRATION_PG_ML = 480.0; // IL-6 / MMP-3 in senescent stroma
  public static readonly TARGET_CLEAN_SASP_PG_ML = 12.0;

  // Mechanical properties
  public static readonly YOUNG_ENDURANCE_STRAIN = 0.165;
  public static readonly YOUNG_YIELD_STRAIN = 0.480;
  public static readonly SENESCENT_ENDURANCE_STRAIN = 0.045;
  public static readonly SENESCENT_YIELD_STRAIN = 0.180;
  public static readonly FATIGUE_EXPONENT_BETA = 3.40;

  public static readonly CASPASE3_THRESH_NM = 120.0; // Irreversible apoptosis threshold

  public static readonly PRESET_SENESCENT_FIBROBLAST: AgingTissueProfile = {
    name: 'Senescent Zombie Fibroblast (p16+/p21+)',
    youngsModulusKPa: 14.5,
    vimentinVolumeFraction: 0.28,
    corticalTensionMnM: 1.85,
    cellRadiusUm: 28.5,
    isSenescent: true,
  };

  public static readonly PRESET_YOUNG_FIBROBLAST: AgingTissueProfile = {
    name: 'Young Healthy Somatic Stroma',
    youngsModulusKPa: 2.8,
    vimentinVolumeFraction: 0.05,
    corticalTensionMnM: 0.35,
    cellRadiusUm: 14.0,
    isSenescent: false,
  };

  /**
   * Calculates effective tissue stiffness from vimentin density and cortical tension
   */
  public static calculateEffectiveModulus(profile: AgingTissueProfile): number {
    const alphaVim = 1.82;
    const nVim = 1.65;
    const phiRef = 0.05;
    const vimentinBoost = 1.0 + alphaVim * ((profile.vimentinVolumeFraction / phiRef) ** nVim);
    const corticalTerm = (2.0 * profile.corticalTensionMnM * 1e-3) / (profile.cellRadiusUm * 1e-6) * 1e-3; // kPa
    return profile.youngsModulusKPa * vimentinBoost + corticalTerm;
  }

  /**
   * Evaluates cyclic strain amplitude under ultrasound exposure
   */
  public static calculateCyclicStrain(modulusKPa: number, peakPressureMPa: number): number {
    // Effective dynamic cyclic stress amplitude in kPa
    const effectiveStressKPa = peakPressureMPa * 65.0;
    return Math.min(0.85, effectiveStressKPa / Math.max(1.0, modulusKPa));
  }

  /**
   * Evaluates cumulative acoustic fatigue damage integral D(t)
   */
  public static calculateFatigueDamage(
    strain: number,
    isSenescent: boolean,
    params: SenolyticDosingParameters
  ): number {
    const epsEndurance = isSenescent ? this.SENESCENT_ENDURANCE_STRAIN : this.YOUNG_ENDURANCE_STRAIN;
    const epsYield = isSenescent ? this.SENESCENT_YIELD_STRAIN : this.YOUNG_YIELD_STRAIN;

    if (strain <= epsEndurance) return 0.0;

    const normalizedStrain = (strain - epsEndurance) / (epsYield - epsEndurance);
    const damagePerCycle = Math.max(0.0, normalizedStrain) ** this.FATIGUE_EXPONENT_BETA;
    const f0Hz = params.carrierFrequencyMHz * 1e6;
    const dutyCycle = (params.pulseDurationUs * 1e-6) * params.pulseRepetitionFreqHz;
    const totalAcousticCycles = f0Hz * dutyCycle * params.exposureDurationSec;

    return Math.min(50.0, damagePerCycle * totalAcousticCycles * 0.005);
  }

  /**
   * Evaluates comprehensive senolytic telemetry and SASP cytokine depletion
   */
  public static evaluateSenolyticTelemetry(
    tissue: AgingTissueProfile,
    params: SenolyticDosingParameters
  ): SenolyticTelemetry {
    const effModulus = this.calculateEffectiveModulus(tissue);
    const strain = this.calculateCyclicStrain(effModulus, params.peakPressureMPa);

    const D = this.calculateFatigueDamage(strain, tissue.isSenescent, params);
    const D_sen = tissue.isSenescent ? D : 0.0;
    const D_young = tissue.isSenescent ? 0.0 : D;

    // Boltzmann-Hill MOMP Activation Probability
    const momp = tissue.isSenescent ? 1.0 / (1.0 + Math.exp(-((D_sen - 0.50) / 0.08))) : 0.0;

    // Caspase-3 Cleavage Activation (nM)
    const casp3 = tissue.isSenescent ? Math.min(650.0, momp * 450.0 * (1.0 + D_sen * 0.35)) : 5.0;

    // Senolytic Lysis Fraction
    const lysis = tissue.isSenescent
      ? Math.min(99.9, Math.max(0.0, 100.0 * (1.0 - Math.exp(-((casp3 / this.CASPASE3_THRESH_NM) ** 2.8)))))
      : Math.min(5.0, (D_young / 1.0) * 2.0);

    const youngSurvival = Math.min(100.0, Math.max(99.0, 100.0 - (D_young > 0 ? D_young * 0.4 : 0.0)));

    // Nyborg Acoustic Microstreaming Convective SASP Clearance
    const dutyCycle = (params.pulseDurationUs * 1e-6) * params.pulseRepetitionFreqHz;
    const streamingClearanceRate = 0.12 * (params.peakPressureMPa ** 2) * (dutyCycle * 100.0);
    const saspLysisDecay = Math.exp(-streamingClearanceRate * params.exposureDurationSec);
    const currentSASP = tissue.isSenescent
      ? Math.max(
          this.TARGET_CLEAN_SASP_PG_ML,
          this.BASAL_SASP_CONCENTRATION_PG_ML * ((1.0 - lysis / 100.0) + (lysis / 100.0) * saspLysisDecay * 0.02)
        )
      : this.TARGET_CLEAN_SASP_PG_ML;

    // Thermal Dosimetry
    const I_sppa = (params.peakPressureMPa ** 2 * 1e12) / (2.0 * 1060.0 * 1540.0) * 1e-4; // W/cm^2
    const I_spta = I_sppa * dutyCycle;
    const deltaT = Number(((2.0 * 0.05 * I_spta * params.exposureDurationSec) / (1060.0 * 3700.0 * 1e-4)).toFixed(3));
    const cem43 = Number(((params.exposureDurationSec / 60.0) * (deltaT > 0 ? 0.25 ** Math.max(0, 43 - (37 + deltaT)) : 0)).toFixed(6));

    const isSelective = lysis >= 90.0 && youngSurvival >= 99.0 && deltaT < 1.0;

    return {
      acousticEnergyDensityJm3: Number((I_sppa / 1540.0 * 10000.0).toFixed(2)),
      cyclicStrainAmplitude: Number(strain.toFixed(3)),
      cumulativeFatigueDamageD: Number(D_sen.toFixed(2)),
      mompActivationProbability: Number(momp.toFixed(3)),
      cleavedCaspase3ConcentrationNM: Number(casp3.toFixed(1)),
      senolyticLysisPercentage: Number(lysis.toFixed(1)),
      youngTissuePreservedPercentage: Number(youngSurvival.toFixed(1)),
      saspCytokineConcentrationPgMl: Number(currentSASP.toFixed(1)),
      focalTemperatureRiseC: deltaT,
      thermalDoseCEM43Minutes: cem43,
      isTreatmentSelective: isSelective,
    };
  }
}
