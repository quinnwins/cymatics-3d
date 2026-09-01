/**
 * AcoustofluidicSortingPhysics.ts
 * SoundForm 3D - Tilted Standing Acoustic Wave (TSAW) Microfluidic Nanofiltration
 *
 * Mathematical Foundations:
 * 1. Primary Acoustic Radiation Force (a^3 Scaling):
 *    F_rad = - (pi * p0^2 * V_p * beta_f / (2 * lambda)) * Phi * sin(2 * k * x_tilt)
 *    where V_p = (4/3) * pi * a^3 (Dominates for large CTCs, a ~ 8 - 12.5 um)
 *
 * 2. Acoustic Boundary-Layer Microstreaming Drag (a^1 Scaling):
 *    F_drag = 6 * pi * mu * a * (u_streaming - v_particle)
 *    (Dominates for nanoscale Extracellular Vesicles / Exosomes, a ~ 15 - 75 nm)
 *
 * 3. Critical Cutoff Diameter (d_cutoff):
 *    d_cutoff = sqrt( (3 * mu * c_f * f_D * u_x * sin(theta)) / (pi * f * E_ac * Phi) )
 *    - Particles with d > d_cutoff (CTCs) are deflected along standing wave nodes into waste/collection.
 *    - Nanovesicles with d < d_cutoff (EVs/Exosomes) follow laminar streamlines for 99.4% high-purity isolation.
 */

export interface AcoustofluidicState {
  acousticPowerW: number; // 0.1 - 5.0 W (RF transducer power)
  surfaceWaveFreqMHz: number; // 10 - 40 MHz (LiNbO3 SAW IDT frequency)
  tiltAngleDeg: number; // 5 - 45 degrees (TSAW tilt angle theta)
  sampleFlowRateUlMin: number; // 5 - 50 uL/min
  channelWidthUm: number; // 100 - 500 um
  channelLengthMm: number; // 5 - 25 mm
}

export interface SortingTelemetry {
  acousticEnergyDensityJm3: number;
  criticalCutoffDiameterNm: number;
  ctcDeflectionEfficiencyPercent: number;
  exosomePurityPercent: number;
  exosomeRecoveryRatePercent: number;
  shearStressPa: number;
  isSeparationOptimal: boolean;
}

export class AcoustofluidicSortingPhysics {
  public static readonly FLUID_DENSITY = 1000.0; // kg/m^3 (PBS buffer)
  public static readonly FLUID_SOUND_SPEED = 1495.0; // m/s
  public static readonly FLUID_VISCOSITY = 0.001; // Pa.s (Water at 20C)
  public static readonly FLUID_COMPRESSIBILITY = 4.54e-10; // 1/Pa

  // Specimen Physical Properties
  public static readonly CTC_DIAMETER_UM = 18.0; // Circulating Tumor Cell (15 - 25 um)
  public static readonly CTC_DENSITY = 1070.0; // kg/m^3
  public static readonly CTC_COMPRESSIBILITY = 3.95e-10; // 1/Pa

  public static readonly EXOSOME_DIAMETER_NM = 80.0; // Extracellular Vesicle (30 - 150 nm)
  public static readonly EXOSOME_DENSITY = 1140.0; // kg/m^3
  public static readonly EXOSOME_COMPRESSIBILITY = 3.40e-10; // 1/Pa

  /**
   * Calculates acoustic contrast factor Phi
   */
  public static calculateContrastFactor(densityKgM3: number, compressibilityPa: number): number {
    const f1 = 1.0 - compressibilityPa / this.FLUID_COMPRESSIBILITY;
    const f2 = (2.0 * (densityKgM3 - this.FLUID_DENSITY)) / (2.0 * densityKgM3 + this.FLUID_DENSITY);
    return f1 / 3.0 + f2 / 2.0;
  }

  /**
   * Calculates critical cutoff diameter d_cutoff in nanometers
   */
  public static calculateCriticalCutoff(state: AcoustofluidicState): number {
    const fHz = state.surfaceWaveFreqMHz * 1e6;
    const thetaRad = (state.tiltAngleDeg * Math.PI) / 180.0;
    // Acoustic energy density in LiNbO3 substrate: ~150 J/m^3 per Watt
    const Eac = Math.max(1.0, state.acousticPowerW * 150.0); // J/m^3
    const Phi = this.calculateContrastFactor(this.CTC_DENSITY, this.CTC_COMPRESSIBILITY);

    // Channel cross-section area in m^2
    const wM = state.channelWidthUm * 1e-6;
    const hM = 50e-6; // 50 um standard PDMS microchannel height
    const flowM3s = (state.sampleFlowRateUlMin * 1e-9) / 60.0;
    const ux = flowM3s / (wM * hM); // Mean longitudinal fluid velocity

    // d^2 = (3 * mu * c_f * u_x * sin(theta)) / (pi * f * E_ac * Phi) (Ding et al., PNAS 2014)
    const numerator = 3.0 * this.FLUID_VISCOSITY * this.FLUID_SOUND_SPEED * ux * Math.sin(thetaRad);
    const denominator = Math.PI * fHz * Eac * Math.max(0.01, Phi);

    const dCutoffM = Math.sqrt(Math.max(1e-18, numerator / denominator));
    return dCutoffM * 1e9; // Convert to nm
  }

  /**
   * Evaluates real-time sorting telemetry
   */
  public static evaluateSortingTelemetry(state: AcoustofluidicState): SortingTelemetry {
    const dCutoffNm = this.calculateCriticalCutoff(state);
    const Eac = Math.max(1.0, state.acousticPowerW * 150.0);

    // CTC Deflection: Scaled by particle size ratio and acoustic interaction length in channel
    const channelLengthFactor = Math.max(0.8, state.channelLengthMm / 10.0);
    const ctcRatio = (this.CTC_DIAMETER_UM * 1000.0) / Math.max(1.0, dCutoffNm);
    const ctcDeflection = Math.min(100.0, Math.max(0.0, 100.0 * (1.0 - Math.exp(-ctcRatio * channelLengthFactor * 0.95))));

    // Exosome Purity: Exosomes (80 nm) pass undeflected if 80 nm < dCutoff
    const exosomePurity = dCutoffNm > 150.0 ? Math.min(99.8, 92.0 + (dCutoffNm / 5000.0) * 7.8) : Math.max(40.0, (dCutoffNm / 150.0) * 92.0);
    const exosomeRecovery = Math.min(98.5, 90.0 + (state.sampleFlowRateUlMin / 50.0) * 8.5);

    // Wall shear stress in microchannel
    const wM = state.channelWidthUm * 1e-6;
    const hM = 50e-6;
    const flowM3s = (state.sampleFlowRateUlMin * 1e-9) / 60.0;
    const ux = flowM3s / (wM * hM);
    const shearStress = (6.0 * this.FLUID_VISCOSITY * ux) / hM;

    const isOptimal = dCutoffNm >= 300.0 && dCutoffNm <= 9000.0 && ctcDeflection > 90.0;

    return {
      acousticEnergyDensityJm3: Number(Eac.toFixed(2)),
      criticalCutoffDiameterNm: Number(dCutoffNm.toFixed(1)),
      ctcDeflectionEfficiencyPercent: Number(ctcDeflection.toFixed(1)),
      exosomePurityPercent: Number(exosomePurity.toFixed(1)),
      exosomeRecoveryRatePercent: Number(exosomeRecovery.toFixed(1)),
      shearStressPa: Number(shearStress.toFixed(3)),
      isSeparationOptimal: isOptimal,
    };
  }
}
