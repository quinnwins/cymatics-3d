import { describe, it, expect } from 'vitest';
import { NobelBiophysics } from './NobelBiophysics';

describe('NobelBiophysics Mathematical Engine', () => {
  it('correctly calculates LINC complex stress and p53 transcription kinetics', () => {
    const baseline = NobelBiophysics.calculateMechanogenomics(0, 0, 1.0, 5.0);
    expect(baseline.lincTensionPN).toBeGreaterThanOrEqual(8.0);
    expect(baseline.nuclearPoreDiameterNm).toBeGreaterThanOrEqual(9.0);
    expect(baseline.histoneAcetylationIndex).toBeLessThanOrEqual(0.3);

    const activated = NobelBiophysics.calculateMechanogenomics(200, 0.9, 1.0, 5.0);
    expect(activated.lincTensionPN).toBeGreaterThan(50.0);
    expect(activated.nuclearPoreDiameterNm).toBeGreaterThan(25.0);
    expect(activated.histoneAcetylationIndex).toBeGreaterThan(0.8);
    expect(activated.p53ProteinConcentrationNM).toBeGreaterThan(5.0);
    expect(activated.isGeneTranscribing).toBe(true);
  });

  it('correctly calculates FUS microbubble cavitation and reversible BBB pore dilation', () => {
    const sealed = NobelBiophysics.calculateBbbDilation(0.1, 2.0, 0.0);
    expect(sealed.claudinPoreWidthNm).toBe(1.0);
    expect(sealed.transvascularDrugFluxPercent).toBe(0.0);
    expect(sealed.isBbmOpen).toBe(false);

    const open = NobelBiophysics.calculateBbbDilation(1.2, 3.5, 0.85);
    expect(open.acousticShearStressPa).toBeGreaterThan(10.0);
    expect(open.claudinPoreWidthNm).toBeGreaterThan(30.0);
    expect(open.transvascularDrugFluxPercent).toBeGreaterThan(45.0);
    expect(open.isBbmOpen).toBe(true);
  });

  it('correctly models viral capsid Lamb resonance and Voronoi fracture mechanics', () => {
    const hiv = NobelBiophysics.VIRUS_PROFILES['hiv-1'];
    expect(hiv).toBeDefined();

    // Off-resonance
    const offResonance = NobelBiophysics.calculateViralShatter('hiv-1', 400.0, 1.0, 0.0);
    expect(offResonance.viralStrainPercent).toBeLessThan(3.0);
    expect(offResonance.isCapsidFractured).toBe(false);

    // Exact quadrupolar Lamb resonance
    const onResonance = NobelBiophysics.calculateViralShatter('hiv-1', hiv.lambQuadrupoleHz, 1.0, 0.0);
    expect(onResonance.viralStrainPercent).toBeGreaterThan(7.0);
    expect(onResonance.viralSelectivityRatio).toBeGreaterThan(600);

    // Shattered condition
    const shattered = NobelBiophysics.calculateViralShatter('hiv-1', hiv.lambQuadrupoleHz, 1.0, 0.9);
    expect(shattered.isCapsidFractured).toBe(true);
  });

  it('correctly simulates selective senolytic acoustic clearance and SASP depletion', () => {
    const initial = NobelBiophysics.calculateSenolyticClearance(1.0, 0.0);
    expect(initial.senescentLysisPercent).toBe(0.0);
    expect(initial.healthyPreservedPercent).toBeGreaterThan(99.0);
    expect(initial.saspCytokineConcentrationPgMl).toBe(480.0);
    expect(initial.isZombieCellCleared).toBe(false);

    const cleared = NobelBiophysics.calculateSenolyticClearance(1.5, 0.95);
    expect(cleared.senescentLysisPercent).toBe(95.0);
    expect(cleared.healthyPreservedPercent).toBeGreaterThan(99.0);
    expect(cleared.saspCytokineConcentrationPgMl).toBeLessThan(50.0);
    expect(cleared.isZombieCellCleared).toBe(true);
  });
});
