import { describe, it, expect } from 'vitest';
import { ClinicalProtocolExporter } from './ClinicalProtocolExporter';
import { OncotripsyOptimizer } from '../math/OncotripsyOptimizer';
import { OncotripsyPhysics } from '../math/OncotripsyPhysics';

describe('ClinicalProtocolExporter - Wet-Lab Dossier & Translation Exporter', () => {
  it('generates a valid, parseable JSON schema protocol dossier with all mandatory sections', () => {
    const glioblastoma = OncotripsyPhysics.CLINICAL_PROFILES['u87-mg'];
    const protocol = OncotripsyOptimizer.optimizeClinicalProfile(glioblastoma);

    const jsonStr = ClinicalProtocolExporter.generateClinicalJson(protocol);
    const parsed = JSON.parse(jsonStr);

    expect(parsed.$schema).toBe('http://json-schema.org/draft-07/schema#');
    expect(parsed.dossierMetadata.dossierId).toContain('WLP-');
    expect(parsed.dossierMetadata.targetPhenotype.cellLine).toBe(glioblastoma.name);
    expect(parsed.acousticTransducerHardware.centerFrequencyMHz).toBe(1.0);
    expect(parsed.acousticAblationParameters.focalAcousticPressures.peakNegativePressureMPa).toBeGreaterThan(0);
    expect(parsed.predictedBiophysicalYield.expectedTumorLysisPercent).toBeGreaterThanOrEqual(90.0);
    expect(parsed.predictedBiophysicalYield.healthyTissueSafetyIndexPercent).toBeGreaterThanOrEqual(70.0);
  });

  it('generates a comprehensive, publication-grade Markdown Standard Operating Procedure (SOP)', () => {
    const breastCancer = OncotripsyPhysics.CLINICAL_PROFILES['mda-mb-231'];
    const protocol = OncotripsyOptimizer.optimizeClinicalProfile(breastCancer);

    const mdStr = ClinicalProtocolExporter.generateClinicalMarkdown(protocol);

    expect(mdStr).toContain('# SoundForm 3D — Wet-Lab Translation Protocol Dossier');
    expect(mdStr).toContain('Triple-Negative Breast (MDA-MB-231)');
    expect(mdStr).toContain('Transducer Hardware & Benchtop Setup');
    expect(mdStr).toContain('Acoustic Dosimetry & Non-Thermal Bioheat Parameter Table');
    expect(mdStr).toContain('Specimen Preparation & Environmental Conditioning');
    expect(mdStr).toContain('Step-by-Step Sonication Procedure');
    expect(mdStr).toContain('Multi-Parametric Validation Assay Endpoints');
    expect(mdStr).toContain('Annexin V-FITC / Propidium Iodide (PI) Flow Cytometry');
    expect(mdStr).toContain('PASSED: CEM43');
  });
});
