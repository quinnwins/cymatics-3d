import { describe, it, expect } from 'vitest';
import { AcousticDataExporter } from './AcousticDataExporter';

describe('AcousticDataExporter', () => {
  it('generates valid simulation JSON record with chamber and radiation telemetry', () => {
    const record = AcousticDataExporter.generateRecord(
      {
        geometry: 'rectangular',
        modalIndices: { n: 2, m: 1, l: 3 },
        resonantFrequencyHz: 440.0,
        speedOfSoundMs: 343.0,
        mediumDensityKgM3: 1.204,
        acousticPower: 0.85,
      },
      {
        gorkovPotentialPeak: 0.125,
        activeParticles: 262144,
        trappingMode: 'nodes',
      }
    );

    expect(record.exportId).toMatch(/^SIM-[A-Z0-9]{8}$/);
    expect(record.chamberParameters.geometry).toBe('rectangular');
    expect(record.chamberParameters.resonantFrequencyHz).toBe(440.0);
    expect(record.radiationForceField.activeParticles).toBe(262144);
    expect(record.softwareVersion).toContain('SoundForm 3D');
  });

  it('generates formatted markdown report', () => {
    const record = AcousticDataExporter.generateRecord(
      {
        geometry: 'cylindrical',
        modalIndices: { n: 1, m: 2, l: 0 },
        resonantFrequencyHz: 528.0,
        speedOfSoundMs: 343.0,
        mediumDensityKgM3: 1.204,
        acousticPower: 1.0,
      },
      {
        gorkovPotentialPeak: 0.45,
        activeParticles: 262144,
        trappingMode: 'nodes',
      },
      {
        f0Hz: 220.5,
        pitchConfidence: 0.95,
        jitterPercent: 0.32,
        jitterRapPercent: 0.18,
        jitterPpq5Percent: 0.22,
        shimmerPercent: 1.45,
        shimmerDb: 0.12,
        shimmerApq11Percent: 1.1,
        hnrDb: 24.5,
        cppDb: 15.2,
        formantsHz: [500, 1500, 2500, 3500],
        fcr: 0.98,
        vocalTractRadiiCm: [0.8, 0.9, 1.1, 1.2],
        tremorFreqHz: 0,
        tremorDepthPercent: 0,
        diagnosticHallmarks: [],
        healthStatus: 'pristine',
        soundMedicinePrescription: {
          baseToneHz: 220,
          binauralBeatHz: 10,
          harmonicOvertones: [220, 440],
          isochronicPulseRateHz: 5,
          prescriptionTitle: 'Harmonic Calibration',
        },
      }
    );

    const md = AcousticDataExporter.generateMarkdownReport(record);
    expect(md).toContain('# SoundForm 3D — Acoustic Simulation Report');
    expect(md).toContain('CYLINDRICAL');
    expect(md).toContain('220.5 Hz');
    expect(md).toContain('24.5 dB');
  });
});
