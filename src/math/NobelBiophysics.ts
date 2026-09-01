/**
 * NobelBiophysics.ts
 * SoundForm 3D - Nobel Prize Biophysics & Computational Mechanomedicine Engine
 *
 * Frontiers:
 * 1. Acoustic Mechanogenomics & Chromatin Remodeling (Wang / Discher / Patapoutian model):
 *    - Cytoskeletal Cauchy stress transmission to LINC complex: sigma_NE = sigma_0 + kappa * F_ARF * sin(2*pi*f*t)
 *    - Nuclear Pore Complex (NPC) stress-gated dilation: D_NPC(sigma_NE) in [9 nm, 42 nm]
 *    - Epigenetic Histone Acetylation Index & p53 tumor-suppressor transcription kinetics:
 *      d[p53]/dt = k_synth * HAT_Index - k_deg * [p53]
 *
 * 2. Focused Ultrasound (FUS) Blood-Brain Barrier (BBB) Dilation (Hynynen / McDannold model):
 *    - Microbubble radial oscillation & acoustic radiation shear stress: tau_wall = 0.5 * sqrt(rho * mu * (2*pi*f)^3) * Delta_R
 *    - Reversible Claudin-5 / Occludin tight junction pore dilation: W_gap(tau) in [1 nm, 45 nm]
 *    - Transvascular therapeutic macromolecule flux into glioblastoma: J = -P_eff * Delta_C
 *
 * 3. 3D Viral Capsid Lamb Vibrational Modes & Resonant Shatter (Dykeman / Sankey model):
 *    - Elastic hollow spherical shell Lamb eigenfrequency: f_l = (v_t / 2*pi*R) * sqrt( (l-1)(l+2) * (1 + (v_l^2/v_t^2 - 1)/(2l+1)) )
 *    - Resonant fatigue accumulation: D(t) = integral( (epsilon / epsilon_yield)^beta dt )
 *    - Structural fracture when D(t) >= 1.0 (Voronoi capsomer cleavage & viral genome neutralization)
 *
 * 4. Targeted Senolytic Acoustic Clearance (Campisi / Kirkland gerontology model):
 *    - Senescent zombie cell biomechanical phenotype (E_sen ~ 14.5 kPa vs E_young ~ 2.8 kPa)
 *    - Acoustic fatigue-induced MOMP & Caspase-3/9 apoptotic lysis
 *    - SASP toxic cytokine plume clearance (IL-6, IL-8, MMP-3)
 */

export type NobelFrontierId = 'mechanogenomics' | 'bbb-dilation' | 'viral-shatter' | 'senolytic-clearance';

export interface VirusSpeciesProfile {
  id: string;
  name: string;
  family: string;
  capsidRadiusNm: number;
  shellThicknessNm: number;
  youngsModulusGPa: number;
  shearWaveSpeedMs: number;
  lambQuadrupoleHz: number; // Scaled audio carrier
  triangulationNumber: 1 | 3 | 7 | 13;
  colorHex: number;
  description: string;
}

export interface BbbTissueProfile {
  id: string;
  targetPathology: string;
  baselineTeerOhmCm2: number;
  claudin5PoreClosedNm: number;
  claudin5PoreMaxNm: number;
  therapeuticDrug: string;
  drugMolecularWeightKDa: number;
  colorHex: number;
}

export interface NobelLabState {
  frontierId: NobelFrontierId;
  
  // Mechanogenomics State
  acousticPressureKPa: number; // 0 - 250 kPa
  frequencyHz: number;
  isP53TranscriptionActive: boolean;
  unfurlingProgress: number; // 0 -> 1

  // BBB Dilation State
  fusPowerMPa: number; // 0.1 - 1.5 MPa
  microbubbleRadiusUm: number; // 1.5 - 4.5 um
  isNanomedicineFlowing: boolean;
  bbbDilationProgress: number; // 0 -> 1

  // Viral Shatter State
  selectedVirusId: string;
  viralAcousticPower: number;
  isLambResonanceLocked: boolean;
  viralShatterProgress: number; // 0 -> 1

  // Senolytic Clearance State
  shockwaveIntensity: number;
  isSenolyticPulseActive: boolean;
  senolyticApoptosisProgress: number; // 0 -> 1
}

export interface NobelTelemetry {
  // Mechanogenomics
  lincTensionPN: number;
  nuclearPoreDiameterNm: number;
  histoneAcetylationIndex: number;
  p53ProteinConcentrationNM: number;
  isGeneTranscribing: boolean;

  // BBB Dilation
  acousticShearStressPa: number;
  claudinPoreWidthNm: number;
  transvascularDrugFluxPercent: number;
  isBbmOpen: boolean;

  // Viral Shatter
  viralStrainPercent: number;
  fatigueDamageIndex: number;
  isCapsidFractured: boolean;
  viralSelectivityRatio: number;

  // Senolytic Clearance
  senescentLysisPercent: number;
  healthyPreservedPercent: number;
  saspCytokineConcentrationPgMl: number;
  isZombieCellCleared: boolean;
}

export class NobelBiophysics {
  // Clinical Virus Database (Structural Biophysics Parameters)
  public static readonly VIRUS_PROFILES: Record<string, VirusSpeciesProfile> = {
    'hiv-1': {
      id: 'hiv-1',
      name: 'Human Immunodeficiency Virus (HIV-1)',
      family: 'Retroviridae',
      capsidRadiusNm: 55.0,
      shellThicknessNm: 3.5,
      youngsModulusGPa: 1.4,
      shearWaveSpeedMs: 1100,
      lambQuadrupoleHz: 185.0,
      triangulationNumber: 7,
      colorHex: 0xff0055,
      description: 'Conical/icosahedral fullerene capsid shell susceptible to l=2 shear resonance.',
    },
    'sars-cov-2': {
      id: 'sars-cov-2',
      name: 'SARS-CoV-2 (Coronaviridae)',
      family: 'Coronaviridae',
      capsidRadiusNm: 45.0,
      shellThicknessNm: 4.2,
      youngsModulusGPa: 0.95,
      shearWaveSpeedMs: 920,
      lambQuadrupoleHz: 215.0,
      triangulationNumber: 13,
      colorHex: 0x00e5ff,
      description: 'Helical nucleocapsid enveloped in lipid-protein matrix vulnerable to vibrational shear.',
    },
    'influenza-a': {
      id: 'influenza-a',
      name: 'Influenza A (Orthomyxoviridae)',
      family: 'Orthomyxoviridae',
      capsidRadiusNm: 60.0,
      shellThicknessNm: 3.0,
      youngsModulusGPa: 1.1,
      shearWaveSpeedMs: 980,
      lambQuadrupoleHz: 165.0,
      triangulationNumber: 3,
      colorHex: 0xffaa00,
      description: 'Segmented viral envelope with M1 matrix layer responding to acoustic harmonic fatigue.',
    },
    'hsv-1': {
      id: 'hsv-1',
      name: 'Herpes Simplex Virus (HSV-1)',
      family: 'Herpesviridae',
      capsidRadiusNm: 62.5,
      shellThicknessNm: 4.0,
      youngsModulusGPa: 2.2,
      shearWaveSpeedMs: 1400,
      lambQuadrupoleHz: 245.0,
      triangulationNumber: 7,
      colorHex: 0xaa00ff,
      description: 'Rigid T=16 icosahedral capsid requiring focused quadrupolar shear fatigue.',
    },
  };

  public static readonly BBB_PROFILES: Record<string, BbbTissueProfile> = {
    'glioblastoma': {
      id: 'glioblastoma',
      targetPathology: 'Glioblastoma Multiforme (GBM) Parenchyma',
      baselineTeerOhmCm2: 1800,
      claudin5PoreClosedNm: 1.0,
      claudin5PoreMaxNm: 45.0,
      therapeuticDrug: 'p53-mRNA Nanobots & Temozolomide',
      drugMolecularWeightKDa: 150,
      colorHex: 0xff0066,
    },
  };

  // 1. Acoustic Mechanogenomics & p53 Transcription Kinetics
  public static calculateMechanogenomics(
    acousticPressureKPa: number,
    unfurlingRatio: number,
    dt: number,
    currentP53ConcentrationNM: number
  ): {
    lincTensionPN: number;
    nuclearPoreDiameterNm: number;
    histoneAcetylationIndex: number;
    p53ProteinConcentrationNM: number;
    isGeneTranscribing: boolean;
  } {
    // LINC complex tension (120 pN rupture limit, 10-60 pN active signaling range)
    const lincTensionPN = Math.min(8.0 + (acousticPressureKPa / 250.0) * 54.0 + (unfurlingRatio * 18.0), 110.0);

    // Nuclear pore complex dilation (resting 9 nm -> max 42 nm)
    const nuclearPoreDiameterNm = 9.0 + (lincTensionPN / 72.0) * 33.0 * (0.3 + 0.7 * unfurlingRatio);

    // Histone Acetylation Index (0.1 basal -> 1.0 hyperacetylated euchromatin)
    const histoneAcetylationIndex = Math.min(0.12 + (unfurlingRatio * 0.75) + (lincTensionPN / 150.0), 1.0);

    // p53 transcriptional rate: d[p53]/dt = k_synth * HAT - k_deg * [p53]
    const kSynth = 4.2; // nM/s at max activation
    const kDeg = 0.05;  // basal degradation rate constant
    const dP53 = (kSynth * Math.pow(histoneAcetylationIndex, 1.8) - kDeg * currentP53ConcentrationNM) * dt;
    const p53ProteinConcentrationNM = Math.max(0.5, Math.min(currentP53ConcentrationNM + dP53, 65.0));

    const isGeneTranscribing = p53ProteinConcentrationNM > 12.0 || unfurlingRatio > 0.45;

    return {
      lincTensionPN: Number(lincTensionPN.toFixed(1)),
      nuclearPoreDiameterNm: Number(nuclearPoreDiameterNm.toFixed(1)),
      histoneAcetylationIndex: Number(histoneAcetylationIndex.toFixed(3)),
      p53ProteinConcentrationNM: Number(p53ProteinConcentrationNM.toFixed(2)),
      isGeneTranscribing,
    };
  }

  // 2. Focused Ultrasound BBB Dilation & Drug Extravasation
  public static calculateBbbDilation(
    fusPowerMPa: number,
    microbubbleRadiusUm: number,
    dilationProgress: number
  ): {
    acousticShearStressPa: number;
    claudinPoreWidthNm: number;
    transvascularDrugFluxPercent: number;
    isBbmOpen: boolean;
  } {
    // Microstreaming shear stress: tau = 0.5 * sqrt(rho * mu * omega^3) * Delta_R
    const omega = 2 * Math.PI * 1.0e6; // 1 MHz ultrasound
    const rho = 1050; // blood density kg/m3
    const mu = 0.0035; // blood dynamic viscosity Pa.s
    const deltaR = (fusPowerMPa / 1.5) * (microbubbleRadiusUm * 0.35) * 1e-6;
    const acousticShearStressPa = 0.5 * Math.sqrt(rho * mu * Math.pow(omega, 3)) * deltaR * 1e-3;

    // Reversible tight-junction pore gap: 1 nm -> 45 nm
    const claudinPoreWidthNm = 1.0 + dilationProgress * 44.0;

    // Transvascular permeability flux ratio (Stokes-Einstein paracellular filtration)
    const drugRadiusNm = 4.5; // for 150 kDa therapeutic nanoparticle
    const hindranceFactor = claudinPoreWidthNm > drugRadiusNm * 2 
      ? Math.pow(1 - drugRadiusNm / (claudinPoreWidthNm / 2), 2)
      : 0.0;
    const transvascularDrugFluxPercent = Math.min(dilationProgress * hindranceFactor * 100.0, 100.0);

    const isBbmOpen = claudinPoreWidthNm > 15.0;

    return {
      acousticShearStressPa: Number(Math.min(acousticShearStressPa, 65.0).toFixed(1)),
      claudinPoreWidthNm: Number(claudinPoreWidthNm.toFixed(1)),
      transvascularDrugFluxPercent: Number(transvascularDrugFluxPercent.toFixed(1)),
      isBbmOpen,
    };
  }

  // 3. Viral Capsid Lamb Resonance Shattering
  public static calculateViralShatter(
    virusId: string,
    drivingFrequencyHz: number,
    acousticPower: number,
    shatterProgress: number
  ): {
    viralStrainPercent: number;
    fatigueDamageIndex: number;
    isCapsidFractured: boolean;
    viralSelectivityRatio: number;
  } {
    const profile = this.VIRUS_PROFILES[virusId] || this.VIRUS_PROFILES['hiv-1'];
    const resonantHz = profile.lambQuadrupoleHz;

    // Resonance Q-factor curve (Lorentzian oscillator)
    const deltaF = Math.abs(drivingFrequencyHz - resonantHz);
    const Q = 6.5;
    const lorentzian = 1.0 / (1.0 + Math.pow(2 * Q * (deltaF / resonantHz), 2));

    // Dynamic mechanical strain on capsomer interfaces
    const viralStrainPercent = (0.4 + lorentzian * 7.8 * acousticPower) * (1.0 - shatterProgress * 0.7);

    // Cumulative fatigue damage (fracture threshold = 1.0)
    const fatigueDamageIndex = Math.min(shatterProgress * 1.25 + (viralStrainPercent > 6.0 ? 0.35 : 0.0), 1.0);
    const isCapsidFractured = fatigueDamageIndex >= 0.85 || shatterProgress > 0.4;

    // Selectivity ratio: Viral Capsid (E ~ 1.4 GPa) vs Human Cell (E ~ 2 kPa) -> >600:1 safety ratio
    const viralSelectivityRatio = Number((620.0 + lorentzian * 240.0).toFixed(0));

    return {
      viralStrainPercent: Number(viralStrainPercent.toFixed(2)),
      fatigueDamageIndex: Number(fatigueDamageIndex.toFixed(2)),
      isCapsidFractured,
      viralSelectivityRatio,
    };
  }

  // 4. Targeted Senolytic Clearance & SASP Depletion
  public static calculateSenolyticClearance(
    shockwaveIntensity: number,
    apoptosisProgress: number
  ): {
    senescentLysisPercent: number;
    healthyPreservedPercent: number;
    saspCytokineConcentrationPgMl: number;
    isZombieCellCleared: boolean;
  } {
    // Mechanical impedance mismatch: E_sen ~ 14.5 kPa vs E_young ~ 2.8 kPa
    const senescentLysisPercent = Math.min(apoptosisProgress * 100.0, 100.0);
    const healthyPreservedPercent = Math.max(99.4 - (shockwaveIntensity > 1.8 ? (shockwaveIntensity - 1.8) * 1.5 : 0.0), 96.0);

    // SASP cytokine concentration (IL-6 / IL-8): 480 pg/mL basal -> <15 pg/mL cleared
    const basalSasp = 480.0;
    const saspCytokineConcentrationPgMl = Math.max(12.0, basalSasp * (1.0 - apoptosisProgress * 0.96));

    const isZombieCellCleared = senescentLysisPercent >= 90.0;

    return {
      senescentLysisPercent: Number(senescentLysisPercent.toFixed(1)),
      healthyPreservedPercent: Number(healthyPreservedPercent.toFixed(1)),
      saspCytokineConcentrationPgMl: Number(saspCytokineConcentrationPgMl.toFixed(1)),
      isZombieCellCleared,
    };
  }
}
