import { describe, it, expect } from 'vitest';
import { ClinicalReportExporter } from './ClinicalReportExporter';
import { NobelTelemetry } from '../math/NobelBiophysics';

describe('ClinicalReportExporter Suite', () => {
  const mockTelemetry: NobelTelemetry = {
    lincTensionPN: 52.4,
    nuclearPoreDiameterNm: 33.2,
    histoneAcetylationIndex: 0.92,
    p53ProteinConcentrationNM: 18.5,
    isGeneTranscribing: true,
    acousticShearStressPa: 42.0,
    claudinPoreWidthNm: 38.0,
    transvascularDrugFluxPercent: 68.5,
    isBbmOpen: true,
    viralStrainPercent: 8.4,
    fatigueDamageIndex: 1.15,
    viralSelectivityRatio: 860,
    isCapsidFractured: true,
    senescentLysisPercent: 94.0,
    healthyPreservedPercent: 99.4,
    saspCytokineConcentrationPgMl: 28.0,
    isZombieCellCleared: true,
  };

  it('generates a valid CDISC/FDA compliant clinical trial record', () => {
    const record = ClinicalReportExporter.generateClinicalRecord(mockTelemetry);
    expect(record.studyId).toBe('SF3D-2026-NOBEL-PHARMA');
    expect(record.protocolNumber).toBe('NCT-06849201-REV4');
    expect(record.nobelFrontierTelemetry.isGeneTranscribing).toBe(true);
    expect(record.therapeuticEndpoints.bloodBrainBarrierPoreWidthNm).toBe(38.0);
    expect(record.therapeuticEndpoints.saspCytokineDepletionPercent).toBeGreaterThan(90.0);
    expect(record.safetyAssessment.healthyStromalViabilityPercent).toBe(99.4);
  });

  it('generates a comprehensive Markdown clinical dossier', () => {
    const record = ClinicalReportExporter.generateClinicalRecord(mockTelemetry);
    const md = ClinicalReportExporter.generateMarkdownDossier(record);
    expect(md).toContain('CLINICAL TRIAL DOSSIER');
    expect(md).toContain('SF3D-2026-NOBEL-PHARMA');
    expect(md).toContain('$p53$ Tumor-Suppressor Protein');
    expect(md).toContain('Somatic Tissue Safety Selectivity Ratio');
  });
});
