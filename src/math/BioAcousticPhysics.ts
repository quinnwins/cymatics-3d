/**
 * BioAcousticPhysics.ts
 * SoundForm 3D - Cellular Biomechanics, Acoustic Contrast & Pathogen Resonances
 *
 * Mathematical Formulations:
 * 1. Rayleigh Droplet / Liquid-Core Cortical Tension Eigenmodes:
 *    f_n = (1 / 2pi) * sqrt( n(n-1)(n+2) * sigma_eff / (rho_cell * R^3) )
 * 2. Gor'kov Acoustic Radiation Contrast Factor:
 *    Phi(rho_rel, beta_rel) = (1/3) * (1 - beta_c / beta_0) + (1/2) * ( (2 * (rho_c - rho_0)) / (2 * rho_c + rho_0) )
 * 3. Thin Elastic Spherical Shell Lamb Modes (Viral Capsid GHz Resonance):
 *    f_00 = v_L / (2pi * R) where v_L = sqrt( E / (rho * (1 - nu)) )
 * 4. Bacterial Peptidoglycan Cell Wall Shear Modes:
 *    f_torsion = (m / 2L) * sqrt( G / rho_wall )
 * 5. Standard Linear Solid / Kelvin-Voigt Viscoelastic Relaxation:
 *    tau = eta / E
 */

export interface BioSpecimenProfile {
  id: string;
  name: string;
  category: 'cell' | 'pathogen' | 'therapeutic';
  badge: string;
  description: string;
  radiusMicroMeters: number;      // R in um
  youngsModulusKPa: number;       // E in kPa (GPa for virus, MPa for bacteria)
  corticalTensionMNm: number;     // sigma in mN/m
  densityKgM3: number;            // rho in kg/m^3
  compressibilityPa: number;      // beta in Pa^-1
  viscosityMPaS: number;          // eta in mPa*s
  naturalFrequencyHz: number;     // Real biophysical frequency
  audibleDownmixHz: number;       // Psychoacoustically scaled audible pitch (40-2000 Hz)
  acousticContrastPhi: number;    // Gor'kov Phi factor (+Node / -Antinode)
  blebTendency: number;           // 0.0 (none) -> 1.0 (severe malignant blebbing)
  qualityFactorQ: number;         // Mechanical resonance Q
  dampingRatioZeta: number;       // Viscous damping ratio
  acousticImpedanceMRayl: number; // Z = rho * c
}

export class BioAcousticPhysics {
  public static readonly FLUID_DENSITY = 1000.0; // kg/m^3 (water / PBS buffer)
  public static readonly FLUID_SOUND_SPEED = 1495.0; // m/s
  public static readonly FLUID_COMPRESSIBILITY = 1.0 / (1000.0 * 1495.0 * 1495.0); // ~4.47e-10 Pa^-1
  public static readonly FLUID_VISCOSITY = 0.001; // Pa*s (1 mPa*s)

  public static readonly SPECIMENS: Record<string, BioSpecimenProfile> = {
    'healthy-somatic': {
      id: 'healthy-somatic',
      name: 'Healthy Somatic Cell',
      category: 'cell',
      badge: 'Firm Cortex',
      description: 'A healthy, rigid cell with a strong outer layer that holds its shape under sound pressure.',
      radiusMicroMeters: 10.0,
      youngsModulusKPa: 3.2,
      corticalTensionMNm: 0.35,
      densityKgM3: 1080.0,
      compressibilityPa: 4.02e-10,
      viscosityMPaS: 4.5,
      naturalFrequencyHz: 8210.0,
      audibleDownmixHz: 220.0, // A3 note
      acousticContrastPhi: 0.18,
      blebTendency: 0.02,
      qualityFactorQ: 12.5,
      dampingRatioZeta: 0.04,
      acousticImpedanceMRayl: 1.63,
    },
    'malignant-cancer': {
      id: 'malignant-cancer',
      name: 'Metastatic Cancer Cell',
      category: 'cell',
      badge: 'Soft Cortex',
      description: 'A softened cell with a weakened outer wall that deforms easily under sound waves.',
      radiusMicroMeters: 11.5,
      youngsModulusKPa: 0.35,
      corticalTensionMNm: 0.04,
      densityKgM3: 1045.0,
      compressibilityPa: 5.48e-10,
      viscosityMPaS: 1.8,
      naturalFrequencyHz: 2780.0,
      audibleDownmixHz: 110.0, // A2 note
      acousticContrastPhi: -0.06,
      blebTendency: 0.88,
      qualityFactorQ: 3.2,
      dampingRatioZeta: 0.16,
      acousticImpedanceMRayl: 1.54,
    },
    'viral-capsid': {
      id: 'viral-capsid',
      name: 'Viral Capsid (SARS / Adeno)',
      category: 'pathogen',
      badge: 'Rigid Shell',
      description: 'A tiny, rigid protein shell with high natural vibration frequencies.',
      radiusMicroMeters: 0.045, // 45 nm
      youngsModulusKPa: 1.4e6, // 1.4 GPa
      corticalTensionMNm: 2.5,
      densityKgM3: 1350.0,
      compressibilityPa: 3.1e-10,
      viscosityMPaS: 0.8,
      naturalFrequencyHz: 5.34e9, // 5.34 GHz
      audibleDownmixHz: 880.0, // A5 note
      acousticContrastPhi: 0.45,
      blebTendency: 0.0,
      qualityFactorQ: 45.0,
      dampingRatioZeta: 0.011,
      acousticImpedanceMRayl: 2.05,
    },
    'bacterial-wall': {
      id: 'bacterial-wall',
      name: 'Bacterial Cell Wall (E. coli)',
      category: 'pathogen',
      badge: 'Tough Wall',
      description: 'A stiff bacterial wall that withstands internal pressure.',
      radiusMicroMeters: 0.5,
      youngsModulusKPa: 2.5e4, // 25 MPa
      corticalTensionMNm: 1.2,
      densityKgM3: 1180.0,
      compressibilityPa: 3.65e-10,
      viscosityMPaS: 2.1,
      naturalFrequencyHz: 23.6e6, // 23.6 MHz
      audibleDownmixHz: 440.0, // A4 note
      acousticContrastPhi: 0.26,
      blebTendency: 0.05,
      qualityFactorQ: 18.0,
      dampingRatioZeta: 0.028,
      acousticImpedanceMRayl: 1.82,
    },
    'histotripsy-cavitation': {
      id: 'histotripsy-cavitation',
      name: 'Ultrasound Cavitation',
      category: 'therapeutic',
      badge: 'High Power',
      description: 'Intense sound waves creating micro-bubbles that break down targeted cell walls.',
      radiusMicroMeters: 10.0,
      youngsModulusKPa: 0.05,
      corticalTensionMNm: 0.01,
      densityKgM3: 1020.0,
      compressibilityPa: 8.5e-10,
      viscosityMPaS: 0.9,
      naturalFrequencyHz: 1.2e6, // 1.2 MHz ultrasound
      audibleDownmixHz: 55.0, // Sub-bass cavitation boom (A1)
      acousticContrastPhi: -0.85,
      blebTendency: 1.0,
      qualityFactorQ: 0.8,
      dampingRatioZeta: 0.65,
      acousticImpedanceMRayl: 1.48,
    },
  };

  /**
   * Calculates the Rayleigh droplet surface oscillation frequency (Hz) for mode n
   */
  public static calculateRayleighFrequency(
    n: number,
    radiusMeters: number,
    corticalTensionNm: number,
    densityKgM3 = 1050.0
  ): number {
    if (n < 2 || radiusMeters <= 0 || densityKgM3 <= 0 || corticalTensionNm < 0) return 0;
    const numerator = n * (n - 1) * (n + 2) * corticalTensionNm;
    const denominator = densityKgM3 * Math.pow(radiusMeters, 3);
    return (1 / (2 * Math.PI)) * Math.sqrt(numerator / denominator);
  }

  /**
   * Calculates the Gor'kov Acoustic Contrast Factor Phi
   * Phi > 0: Particle/cell migrates to pressure nodes (p = 0)
   * Phi < 0: Particle/cell migrates to pressure antinodes (|p| = max)
   */
  public static calculateAcousticContrast(
    cellDensity: number,
    cellCompressibility: number,
    fluidDensity = BioAcousticPhysics.FLUID_DENSITY,
    fluidCompressibility = BioAcousticPhysics.FLUID_COMPRESSIBILITY
  ): number {
    const rho_rel = cellDensity / fluidDensity;
    const beta_rel = cellCompressibility / fluidCompressibility;
    const f1 = 1 - beta_rel;
    const f2 = (2 * (rho_rel - 1)) / (2 * rho_rel + 1);
    return (1 / 3) * f1 + 0.5 * f2;
  }

  /**
   * Calculates viscoelastic relaxation time constant tau (seconds)
   */
  public static calculateRelaxationTime(viscosityPaS: number, youngsModulusPa: number): number {
    if (youngsModulusPa <= 0) return 0;
    return viscosityPaS / youngsModulusPa;
  }

  /**
   * Calculates acoustic radiation force (Newtons) in a 1D standing wave
   */
  public static calculateGorkovRadiationForce(
    cellRadiusM: number,
    positionX: number,
    wavelengthM: number,
    acousticPressurePa: number,
    contrastPhi: number,
    fluidDensity = BioAcousticPhysics.FLUID_DENSITY,
    fluidSoundSpeed = BioAcousticPhysics.FLUID_SOUND_SPEED
  ): number {
    if (wavelengthM <= 0 || fluidDensity <= 0 || fluidSoundSpeed <= 0 || cellRadiusM <= 0) return 0;
    const k = (2 * Math.PI) / wavelengthM;
    const E_ac = (acousticPressurePa * acousticPressurePa) / (4 * fluidDensity * fluidSoundSpeed * fluidSoundSpeed);
    return -4 * Math.PI * Math.pow(cellRadiusM, 3) * k * E_ac * contrastPhi * Math.sin(2 * k * positionX);
  }
}
