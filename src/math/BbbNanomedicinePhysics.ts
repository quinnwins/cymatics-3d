/**
 * BbbNanomedicinePhysics.ts
 * SoundForm 3D - Focused Ultrasound (FUS) Blood-Brain Barrier (BBB) Nanomedicine Permeation & Time-Window Engine
 *
 * Mathematical Foundations:
 * 1. Stokes-Einstein Hydrodynamic Radius:
 *    r_H = 0.483 * (MW_kDa)^0.386 nm for globular biologics / antibodies
 *    D_inf = (k_B * T) / (6 * pi * eta * r_H)
 * 2. Peak Claudin-5 Paracellular Pore Dilation:
 *    r_p_max = r_p_0 + Delta_r_p * (MI - MI_th)^2 / ((MI_50 - MI_th)^2 + (MI - MI_th)^2)
 * 3. Biexponential Paracellular Barrier Resealing:
 *    r_p(t) = r_p_0 + (r_p_max - r_p_0) * [A_fast * exp(-k_fast * t) + (1 - A_fast) * exp(-k_slow * t)]
 * 4. Brenner-Faxén / Deen Steric & Hydrodynamic Hindrance Factors:
 *    lambda(t) = r_H / r_p(t)
 *    Phi(lambda) = (1 - lambda)^2
 *    H_d(lambda) = 1 - 2.104*lambda + 2.089*lambda^3 - 0.948*lambda^5
 * 5. Kedem-Katchalsky Transvascular Mass Extravasation Flux:
 *    J(t) = P_eff(t) * C_p(t) where P_eff = (eps_p / Delta_x) * D_inf * Phi * H_d
 */

export interface NanomedicineSpecimen {
  id: string;
  name: string;
  indication: string;
  molecularWeightKDa: number;
  hydrodynamicRadiusNm: number;
  plasmaHalfLifeHours: number;
  standardDoseUgMl: number;
  isCustom?: boolean;
}

export interface BbbAcousticParameters {
  peakNegativePressureMPa: number; // 0.1 - 1.5 MPa
  frequencyMHz: number; // 0.5 - 2.5 MHz
  postSonicationTimeHours: number; // 0.0 - 24.0 h (Time scrubber)
  microbubbleType: 'definity' | 'sonovue' | 'optison';
}

export interface BbbDeliveryTelemetry {
  mechanicalIndex: number;
  peakPoreRadiusNm: number;
  currentPoreRadiusNm: number;
  soluteToPoreRatioLambda: number;
  stericHindranceFactor: number; // Phi * H_d (0.0 - 1.0)
  dynamicPermeabilityCoefficientCmS: number;
  instantaneousFluxUgCm2Min: number;
  effectiveTimeWindowHours: number;
  accumulatedBrainDoseUgG: number;
  deliveryEnhancementFold: number;
  permeationStatus: 'optimal' | 'restricted' | 'excluded';
  barrierResealingProgressPercent: number;
}

export class BbbNanomedicinePhysics {
  public static readonly BOLTZMANN_K = 1.380649e-23; // J/K
  public static readonly BODY_TEMP_K = 310.15; // 37 C (310.15 K)
  public static readonly INTERSTITIAL_VISCOSITY = 0.0007; // Pa.s (Interstitium at 37C)
  public static readonly BASAL_PORE_RADIUS_NM = 0.70; // Intact tight-junction slit radius
  public static readonly MAX_PORE_DILATION_CEILING_NM = 85.0; // Max non-destructive pore dilation
  public static readonly PORE_DENSITY_PER_CM2 = 2.5e9; // pores/cm^2
  public static readonly JUNCTION_PATH_LENGTH_UM = 0.40; // 400 nm cleft length
  public static readonly BRAIN_MICROVASCULAR_AREA_CM2_PER_G = 150.0; // cm^2 / g brain tissue

  // Biexponential Resealing Kinetics
  public static readonly A_FAST = 0.70;
  public static readonly T_HALF_FAST_HOURS = 1.80; // Rapid Claudin-5 endocytic re-clustering
  public static readonly T_HALF_SLOW_HOURS = 14.0; // Actin cytoskeleton & TEER stabilization

  public static readonly CLINICAL_PRESETS: Record<string, NanomedicineSpecimen> = {
    temozolomide: {
      id: 'temozolomide',
      name: 'Temozolomide (TMZ)',
      indication: 'Standard GBM Alkylator',
      molecularWeightKDa: 0.194,
      hydrodynamicRadiusNm: 0.38,
      plasmaHalfLifeHours: 1.8,
      standardDoseUgMl: 25.0,
    },
    methotrexate: {
      id: 'methotrexate',
      name: 'Methotrexate (MTX)',
      indication: 'CNS Lymphoma & Glioma',
      molecularWeightKDa: 0.454,
      hydrodynamicRadiusNm: 0.55,
      plasmaHalfLifeHours: 3.5,
      standardDoseUgMl: 50.0,
    },
    trastuzumab: {
      id: 'trastuzumab',
      name: 'Trastuzumab (Herceptin mAb)',
      indication: 'HER2+ Brain Metastases',
      molecularWeightKDa: 148.0,
      hydrodynamicRadiusNm: 5.50,
      plasmaHalfLifeHours: 504.0, // 21 days
      standardDoseUgMl: 100.0,
    },
    aav9: {
      id: 'aav9',
      name: 'AAV9 Capsid Vector',
      indication: 'CNS Gene Therapy / SMA',
      molecularWeightKDa: 4500.0,
      hydrodynamicRadiusNm: 13.0,
      plasmaHalfLifeHours: 4.0,
      standardDoseUgMl: 15.0,
    },
    mrna_lnp: {
      id: 'mrna_lnp',
      name: 'mRNA-Lipid Nanoparticle (LNP)',
      indication: 'Glioblastoma Immunotherapy',
      molecularWeightKDa: 12000.0,
      hydrodynamicRadiusNm: 35.0,
      plasmaHalfLifeHours: 4.5,
      standardDoseUgMl: 30.0,
    },
    doxil: {
      id: 'doxil',
      name: 'Doxil (Liposomal Doxorubicin)',
      indication: 'Glioblastoma & Metastatic Lesions',
      molecularWeightKDa: 150000.0,
      hydrodynamicRadiusNm: 42.0,
      plasmaHalfLifeHours: 45.0,
      standardDoseUgMl: 40.0,
    },
    abraxane: {
      id: 'abraxane',
      name: 'Abraxane (Albumin-Paclitaxel)',
      indication: 'Recurrent High-Grade Glioma',
      molecularWeightKDa: 350000.0,
      hydrodynamicRadiusNm: 65.0,
      plasmaHalfLifeHours: 15.0,
      standardDoseUgMl: 60.0,
    },
  };

  /**
   * Calculates hydrodynamic radius from molecular weight
   */
  public static calculateHydrodynamicRadius(mwKDa: number): number {
    if (mwKDa < 1.0) {
      return 0.35 * (mwKDa / 0.18) ** (1 / 3);
    }
    // Calibrated for globular proteins and monoclonal antibodies (e.g. 148 kDa -> 5.50 nm)
    return 0.483 * (mwKDa ** 0.485);
  }

  /**
   * Calculates unhindered Stokes-Einstein diffusion coefficient (m^2/s)
   */
  public static calculateBulkDiffusivity(rH_nm: number): number {
    const rH_m = Math.max(0.1, rH_nm) * 1e-9;
    return (this.BOLTZMANN_K * this.BODY_TEMP_K) / (6.0 * Math.PI * this.INTERSTITIAL_VISCOSITY * rH_m);
  }

  /**
   * Calculates peak pore radius under FUS microbubble acoustic exposure
   */
  public static calculatePeakPoreRadius(mi: number): number {
    const miThresh = 0.22;
    const mi50 = 0.60;
    if (mi <= miThresh) return this.BASAL_PORE_RADIUS_NM;

    const num = (mi - miThresh) ** 2;
    const den = (mi50 - miThresh) ** 2 + num;
    return this.BASAL_PORE_RADIUS_NM + this.MAX_PORE_DILATION_CEILING_NM * (num / den);
  }

  /**
   * Calculates dynamic pore radius at time t (hours) post-sonication
   */
  public static calculateDynamicPoreRadius(peakPoreRadiusNm: number, tHours: number): number {
    if (tHours <= 0) return peakPoreRadiusNm;

    const kFast = Math.LN2 / this.T_HALF_FAST_HOURS;
    const kSlow = Math.LN2 / this.T_HALF_SLOW_HOURS;

    const decay = this.A_FAST * Math.exp(-kFast * tHours) + (1.0 - this.A_FAST) * Math.exp(-kSlow * tHours);
    return this.BASAL_PORE_RADIUS_NM + (peakPoreRadiusNm - this.BASAL_PORE_RADIUS_NM) * decay;
  }

  /**
   * Brenner-Faxen / Deen hydrodynamic hindrance polynomial
   */
  public static calculateStericHindrance(rH_nm: number, rP_nm: number): number {
    if (rP_nm <= this.BASAL_PORE_RADIUS_NM || rH_nm >= rP_nm) return 0.0;

    const lambda = rH_nm / rP_nm;
    if (lambda >= 1.0) return 0.0;

    const phi = (1.0 - lambda) ** 2; // Steric entrance partition
    const hd = 1.0 - 2.104 * lambda + 2.089 * (lambda ** 3) - 0.948 * (lambda ** 5);
    return Math.max(0.0, phi * Math.max(0.0, hd));
  }

  /**
   * Evaluates comprehensive delivery telemetry and time-window metrics
   */
  public static evaluateDeliveryTelemetry(
    drug: NanomedicineSpecimen,
    acoustics: BbbAcousticParameters
  ): BbbDeliveryTelemetry {
    const mi = acoustics.peakNegativePressureMPa / Math.sqrt(Math.max(0.1, acoustics.frequencyMHz));
    const rPMax = this.calculatePeakPoreRadius(mi);
    const rPCurrent = this.calculateDynamicPoreRadius(rPMax, acoustics.postSonicationTimeHours);

    const lambda = drug.hydrodynamicRadiusNm / Math.max(0.1, rPCurrent);
    const steric = this.calculateStericHindrance(drug.hydrodynamicRadiusNm, rPCurrent);

    const Dinf = this.calculateBulkDiffusivity(drug.hydrodynamicRadiusNm); // m^2/s
    const fractionalPoreArea = this.PORE_DENSITY_PER_CM2 * Math.PI * ((rPCurrent * 1e-7) ** 2);
    const deltaX_cm = this.JUNCTION_PATH_LENGTH_UM * 1e-4; // 400 nm in cm
    const Peff_cm_s = (fractionalPoreArea / deltaX_cm) * (Dinf * 1e4) * steric;

    // Plasma concentration decay
    const kElim = Math.LN2 / Math.max(0.1, drug.plasmaHalfLifeHours);
    const Cp = drug.standardDoseUgMl * Math.exp(-kElim * acoustics.postSonicationTimeHours);

    // Instantaneous flux: J(t) = P_eff * C_p in ug / (cm^2 * min)
    const fluxUgCm2Min = Peff_cm_s * Cp * 60.0;

    // Calculate effective time window (hours) until r_p(t) <= r_H or flux < 5% of peak
    let windowHours = 0.0;
    for (let t = 0.1; t <= 24.0; t += 0.2) {
      const rpT = this.calculateDynamicPoreRadius(rPMax, t);
      if (rpT <= drug.hydrodynamicRadiusNm * 1.05) {
        windowHours = t;
        break;
      }
      windowHours = t;
    }

    // Accumulated dose integration across time window (ug / g brain)
    const dt = 0.2; // hour step
    let accumulatedFlux = 0.0;
    const maxT = Math.min(24.0, Math.max(acoustics.postSonicationTimeHours, windowHours));
    for (let t = 0.0; t <= maxT; t += dt) {
      const rpT = this.calculateDynamicPoreRadius(rPMax, t);
      const stT = this.calculateStericHindrance(drug.hydrodynamicRadiusNm, rpT);
      const fracAreaT = this.PORE_DENSITY_PER_CM2 * Math.PI * ((rpT * 1e-7) ** 2);
      const peffT = (fracAreaT / deltaX_cm) * (Dinf * 1e4) * stT;
      const cpT = drug.standardDoseUgMl * Math.exp(-kElim * t);
      accumulatedFlux += peffT * cpT * (dt * 3600.0); // ug/cm^2
    }
    const totalDoseUgG = accumulatedFlux * this.BRAIN_MICROVASCULAR_AREA_CM2_PER_G;

    // Baseline unopened BBB penetration
    const baselineSteric = this.calculateStericHindrance(drug.hydrodynamicRadiusNm, this.BASAL_PORE_RADIUS_NM);
    const enhancementFold = baselineSteric > 0 ? (steric / baselineSteric) : (steric > 0 ? (steric * 450.0) : 1.0);

    const resealingPercent = Math.min(
      100.0,
      Math.max(0.0, ((rPMax - rPCurrent) / Math.max(0.1, rPMax - this.BASAL_PORE_RADIUS_NM)) * 100.0)
    );

    let status: 'optimal' | 'restricted' | 'excluded' = 'optimal';
    if (lambda >= 1.0) status = 'excluded';
    else if (lambda > 0.35) status = 'restricted';

    return {
      mechanicalIndex: Number(mi.toFixed(2)),
      peakPoreRadiusNm: Number(rPMax.toFixed(1)),
      currentPoreRadiusNm: Number(rPCurrent.toFixed(1)),
      soluteToPoreRatioLambda: Number(lambda.toFixed(3)),
      stericHindranceFactor: Number(steric.toFixed(3)),
      dynamicPermeabilityCoefficientCmS: Number(Peff_cm_s.toExponential(3)),
      instantaneousFluxUgCm2Min: Number(fluxUgCm2Min.toFixed(4)),
      effectiveTimeWindowHours: Number(windowHours.toFixed(1)),
      accumulatedBrainDoseUgG: Number(totalDoseUgG.toFixed(1)),
      deliveryEnhancementFold: Number(enhancementFold.toFixed(1)),
      permeationStatus: status,
      barrierResealingProgressPercent: Number(resealingPercent.toFixed(1)),
    };
  }
}
