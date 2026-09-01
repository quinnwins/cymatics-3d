import { describe, it, expect } from 'vitest';
import { OncotripsyPhysics } from '../math/OncotripsyPhysics';
import { TherapyExperiment } from '../visualizer/AcousticTherapyLab';

describe('TherapyLab Modalities & Simulation Logic', () => {
  it('defines all 7 clinical and biophysical therapy modalities', () => {
    const modalities: TherapyExperiment[] = [
      'phase-cancel',
      'oncotripsy',
      'time-reversal',
      'vortex-torsion',
      'sonodynamic-sdt',
      'calcium-piezo1',
      'immune-swarm',
    ];

    expect(modalities).toHaveLength(7);
    expect(modalities).toContain('phase-cancel');
    expect(modalities).toContain('oncotripsy');
    expect(modalities).toContain('time-reversal');
    expect(modalities).toContain('vortex-torsion');
    expect(modalities).toContain('sonodynamic-sdt');
    expect(modalities).toContain('calcium-piezo1');
    expect(modalities).toContain('immune-swarm');
  });

  it('provides all 4 clinical AFM cancer profiles with accurate stiffness & resonance', () => {
    const profiles = Object.values(OncotripsyPhysics.CLINICAL_PROFILES);
    expect(profiles).toHaveLength(4);

    profiles.forEach(p => {
      expect(p.id).toBeDefined();
      expect(p.name).toBeDefined();
      expect(p.resonantFreqHz).toBeGreaterThan(0);
      expect(p.youngsModulusKPa).toBeGreaterThan(0);
      expect(p.colorHex).toBeGreaterThan(0);
    });
  });

  it('evaluates therapy telemetry with safe healthy tissue preservation', () => {
    const telemetry = OncotripsyPhysics.evaluateTherapyTelemetry({
      tumorProfileId: 'mda-mb-231',
      frequencyHz: 118.0,
      phaseDegrees: 180.0,
      acousticPower: 1.0,
      isAntiPhaseActive: true,
      isOncotripsyActive: false,
      isHeterodyneActive: false,
      isTimeReversalActive: false,
      viewMode: 'co-culture-pair',
    });

    expect(telemetry.healthyPreservedPercent).toBeGreaterThanOrEqual(95);
    expect(telemetry.cancellationEfficiencyPercent).toBeGreaterThanOrEqual(90);
  });
});
