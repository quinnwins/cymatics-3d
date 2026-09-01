/**
 * AcousticDataExporter.ts
 * SoundForm 3D - Computational Acoustics & Clinical Vocal Dossier Exporter
 *
 * Generates:
 * 1. Comprehensive multi-parametric clinical vocal dossier (JSON, CSV, Markdown).
 * 2. VocalComparisonEngine for baseline vs. post-therapy comparative deltas.
 * 3. 1-Touch clean clipboard summary formatting for patient clinical notes.
 * 4. Acoustic chamber and radiation force simulation records.
 */

import { VocalBiomarkerReport } from '../math/VoiceBiometricsPhysics';
import { NobelTelemetry } from '../math/NobelBiophysics';

export interface ClinicalVocalDossier {
  dossierId: string;
  timestampUtc: string;
  softwareVersion: string;
  patientMode: 'live-microphone' | 'synthetic-profile';
  voiceProfileName?: string;
  biomarkers: {
    f0Hz: number;
    pitchConfidence: number;
    perturbation: {
      jitterPercent: number;
      jitterRapPercent: number;
      jitterPpq5Percent: number;
      shimmerPercent: number;
      shimmerDb: number;
      shimmerApq11Percent: number;
    };
    periodicity: {
      hnrDb: number;
      cppDb: number;
    };
    formants: {
      f1Hz: number;
      f2Hz: number;
      f3Hz: number;
      f4Hz: number;
      fcr: number;
    };
    clinicalIndices: {
      dsi?: number;
      avqi?: number;
    };
    neuromuscular: {
      tremorFreqHz: number;
      tremorDepthPercent: number;
    };
  };
  clinicalDiagnosis: {
    healthStatus: string;
    hallmarks: string[];
  };
  soundMedicinePrescription: {
    prescriptionTitle: string;
    baseToneHz: number;
    binauralBeatHz: number;
    harmonicOvertones: number[];
    isochronicPulseRateHz: number;
  };
  comparativeAnalysis?: {
    baselineF0Hz: number;
    deltaF0Hz: number;
    jitterReductionPercent: number;
    shimmerReductionPercent: number;
    hnrImprovementDb: number;
    cppImprovementDb: number;
  };
}

export interface AcousticSimulationRecord {
  exportId: string;
  timestampUtc: string;
  softwareVersion: string;
  chamberParameters: {
    geometry: 'rectangular' | 'cylindrical' | 'spherical';
    modalIndices: { n: number; m: number; l: number };
    resonantFrequencyHz: number;
    speedOfSoundMs: number;
    mediumDensityKgM3: number;
    acousticPower: number;
  };
  radiationForceField: {
    gorkovPotentialPeak: number;
    activeParticles: number;
    trappingMode: 'nodes' | 'antinodes';
  };
  vocalAcoustics?: VocalBiomarkerReport;
  biophysicalTelemetry?: NobelTelemetry;
}

export class AcousticDataExporter {
  public static triggerDownload(filename: string, content: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  public static generateVocalDossier(
    vocalReport: VocalBiomarkerReport,
    isLiveMic: boolean,
    profileName?: string,
    baselineReport?: VocalBiomarkerReport
  ): ClinicalVocalDossier {
    const now = new Date().toISOString();
    const id = 'VOX-' + Math.random().toString(36).substring(2, 10).toUpperCase();

    const dossier: ClinicalVocalDossier = {
      dossierId: id,
      timestampUtc: now,
      softwareVersion: 'SoundForm 3D v3.0 (Clinical Vocal Biometrics Engine)',
      patientMode: isLiveMic ? 'live-microphone' : 'synthetic-profile',
      voiceProfileName: profileName,
      biomarkers: {
        f0Hz: vocalReport.f0Hz,
        pitchConfidence: vocalReport.pitchConfidence,
        perturbation: {
          jitterPercent: vocalReport.jitterPercent,
          jitterRapPercent: vocalReport.jitterRapPercent,
          jitterPpq5Percent: vocalReport.jitterPpq5Percent,
          shimmerPercent: vocalReport.shimmerPercent,
          shimmerDb: vocalReport.shimmerDb,
          shimmerApq11Percent: vocalReport.shimmerApq11Percent,
        },
        periodicity: {
          hnrDb: vocalReport.hnrDb,
          cppDb: vocalReport.cppDb,
        },
        formants: {
          f1Hz: vocalReport.formantsHz[0],
          f2Hz: vocalReport.formantsHz[1],
          f3Hz: vocalReport.formantsHz[2],
          f4Hz: vocalReport.formantsHz[3],
          fcr: vocalReport.fcr,
        },
        clinicalIndices: {
          dsi: vocalReport.dsiScore,
          avqi: vocalReport.avqiScore,
        },
        neuromuscular: {
          tremorFreqHz: vocalReport.tremorFreqHz,
          tremorDepthPercent: vocalReport.tremorDepthPercent,
        },
      },
      clinicalDiagnosis: {
        healthStatus: vocalReport.healthStatus,
        hallmarks: vocalReport.diagnosticHallmarks,
      },
      soundMedicinePrescription: vocalReport.soundMedicinePrescription,
    };

    if (baselineReport && baselineReport.f0Hz > 0) {
      const jitterRed = baselineReport.jitterPercent > 0
        ? ((baselineReport.jitterPercent - vocalReport.jitterPercent) / baselineReport.jitterPercent) * 100
        : 0;
      const shimmerRed = baselineReport.shimmerPercent > 0
        ? ((baselineReport.shimmerPercent - vocalReport.shimmerPercent) / baselineReport.shimmerPercent) * 100
        : 0;

      dossier.comparativeAnalysis = {
        baselineF0Hz: baselineReport.f0Hz,
        deltaF0Hz: Number((vocalReport.f0Hz - baselineReport.f0Hz).toFixed(1)),
        jitterReductionPercent: Number(jitterRed.toFixed(1)),
        shimmerReductionPercent: Number(shimmerRed.toFixed(1)),
        hnrImprovementDb: Number((vocalReport.hnrDb - baselineReport.hnrDb).toFixed(1)),
        cppImprovementDb: Number((vocalReport.cppDb - baselineReport.cppDb).toFixed(1)),
      };
    }

    return dossier;
  }

  public static generateVocalMarkdownReport(dossier: ClinicalVocalDossier): string {
    const b = dossier.biomarkers;
    const comp = dossier.comparativeAnalysis;

    return `# Clinical Vocal Biometrics Dossier

**Dossier ID:** \`${dossier.dossierId}\`  
**Timestamp (UTC):** \`${dossier.timestampUtc}\`  
**Capture Mode:** \`${dossier.patientMode}\` ${dossier.voiceProfileName ? `(\`${dossier.voiceProfileName}\`)` : ''}  
**Diagnostic Classification:** **${dossier.clinicalDiagnosis.healthStatus.toUpperCase()}**

---

## 1. Acoustic Biomarker Profile

| Clinical Biomarker | Measured Value | Reference Norm | Interpretation |
| :--- | :--- | :--- | :--- |
| **Fundamental Pitch ($f_0$)** | **${b.f0Hz.toFixed(1)} Hz** | 85–255 Hz | Mean Glottal Contact Frequency |
| **Pitch Jitter ($J_{\\text{loc}}$)** | **${b.perturbation.jitterPercent.toFixed(2)}%** | $< 1.04\\%$ | Frequency Cycle-to-Cycle Perturbation |
| **Pitch Jitter (RAP)** | **${b.perturbation.jitterRapPercent.toFixed(2)}%** | $< 0.68\\%$ | Relative Average Perturbation |
| **Pitch Jitter (PPQ5)** | **${b.perturbation.jitterPpq5Percent.toFixed(2)}%** | $< 0.84\\%$ | 5-Point Period Perturbation Quotient |
| **Amplitude Shimmer ($S_{\\text{loc}}$)** | **${b.perturbation.shimmerPercent.toFixed(2)}%** | $< 3.81\\%$ | Amplitude Cycle-to-Cycle Perturbation |
| **Amplitude Shimmer ($S_{\\text{dB}}$)** | **${b.perturbation.shimmerDb.toFixed(2)} dB** | $< 0.35\\text{ dB}$ | Logarithmic Amplitude Variation |
| **Harmonics-to-Noise (HNR)** | **${b.periodicity.hnrDb.toFixed(1)} dB** | $> 15.0\\text{ dB}$ | Glottal Aspiration Turbulence |
| **Cepstral Peak (CPP)** | **${b.periodicity.cppDb.toFixed(1)} dB** | $> 9.0\\text{ dB}$ | True Spectral Periodicity Prominence |
| **Formant Centralization (FCR)** | **${b.formants.fcr.toFixed(2)}** | $< 1.15$ | Articulatory Vowel Space Centralization |
| **Dysphonia Severity Index (DSI)** | **${b.clinicalIndices.dsi?.toFixed(1) ?? 'N/A'}** | $> +1.6$ | Multi-parametric Voice Quality Score |
| **Acoustic Voice Quality (AVQI)** | **${b.clinicalIndices.avqi?.toFixed(2) ?? 'N/A'}** | $< 2.95$ | Dysphonia Severity Index v03.01 |

---

## 2. Formant Resonance Ladder (LPC-16)

- **$F_1$ (Pharyngeal / Depth):** \`${b.formants.f1Hz.toFixed(0)} Hz\`
- **$F_2$ (Oral / Articulation):** \`${b.formants.f2Hz.toFixed(0)} Hz\`
- **$F_3$ (Singer's Ring):** \`${b.formants.f3Hz.toFixed(0)} Hz\`
- **$F_4$ (Head Resonance):** \`${b.formants.f4Hz.toFixed(0)} Hz\`

---

## 3. Clinical Diagnostic Insights
${dossier.clinicalDiagnosis.hallmarks.map((h) => `- ${h}`).join('\n')}

---

## 4. Personalized Sound Medicine Prescription

- **Prescription Title:** ${dossier.soundMedicinePrescription.prescriptionTitle}
- **Fundamental Carrier:** \`${dossier.soundMedicinePrescription.baseToneHz.toFixed(1)} Hz\`
- **Binaural Entrainment:** \`${dossier.soundMedicinePrescription.binauralBeatHz.toFixed(1)} Hz\`
- **Isochronic Pulse:** \`${dossier.soundMedicinePrescription.isochronicPulseRateHz.toFixed(1)} Hz\`
- **Harmonic Overtones:** \`[${dossier.soundMedicinePrescription.harmonicOvertones.map((f) => f.toFixed(0)).join(', ')} Hz]\`

${
  comp
    ? `
---

## 5. Baseline vs. Post-Therapy Comparative Analytics

| Metric | Baseline | Post-Session | Differential Improvement |
| :--- | :--- | :--- | :--- |
| **Fundamental Pitch ($f_0$)** | ${comp.baselineF0Hz.toFixed(1)} Hz | ${b.f0Hz.toFixed(1)} Hz | $\\Delta ${comp.deltaF0Hz > 0 ? '+' : ''}${comp.deltaF0Hz} \\text{ Hz}$ |
| **Jitter Reduction** | — | — | **${comp.jitterReductionPercent > 0 ? '+' : ''}${comp.jitterReductionPercent}%** |
| **Shimmer Reduction** | — | — | **${comp.shimmerReductionPercent > 0 ? '+' : ''}${comp.shimmerReductionPercent}%** |
| **HNR Delta** | — | — | **${comp.hnrImprovementDb > 0 ? '+' : ''}${comp.hnrImprovementDb} dB** |
| **CPP Delta** | — | — | **${comp.cppImprovementDb > 0 ? '+' : ''}${comp.cppImprovementDb} dB** |
`
    : ''
}

---
*Generated by SoundForm 3D Clinical Acoustic Intelligence Engine.*
`;
  }

  public static generateVocalCSV(dossier: ClinicalVocalDossier): string {
    const b = dossier.biomarkers;
    const headers = [
      'dossier_id',
      'timestamp_utc',
      'patient_mode',
      'health_status',
      'f0_hz',
      'jitter_percent',
      'jitter_rap_percent',
      'jitter_ppq5_percent',
      'shimmer_percent',
      'shimmer_db',
      'hnr_db',
      'cpp_db',
      'f1_hz',
      'f2_hz',
      'f3_hz',
      'fcr',
      'dsi_score',
      'avqi_score',
      'rx_carrier_hz',
      'rx_binaural_hz',
    ];

    const values = [
      dossier.dossierId,
      dossier.timestampUtc,
      dossier.patientMode,
      dossier.clinicalDiagnosis.healthStatus,
      b.f0Hz,
      b.perturbation.jitterPercent,
      b.perturbation.jitterRapPercent,
      b.perturbation.jitterPpq5Percent,
      b.perturbation.shimmerPercent,
      b.perturbation.shimmerDb,
      b.periodicity.hnrDb,
      b.periodicity.cppDb,
      b.formants.f1Hz,
      b.formants.f2Hz,
      b.formants.f3Hz,
      b.formants.fcr,
      b.clinicalIndices.dsi ?? '',
      b.clinicalIndices.avqi ?? '',
      dossier.soundMedicinePrescription.baseToneHz,
      dossier.soundMedicinePrescription.binauralBeatHz,
    ];

    return `${headers.join(',')}\n${values.join(',')}\n`;
  }

  public static generateRecord(
    chamber: AcousticSimulationRecord['chamberParameters'],
    radiation: AcousticSimulationRecord['radiationForceField'],
    vocalReport?: VocalBiomarkerReport,
    biophysTelemetry?: NobelTelemetry
  ): AcousticSimulationRecord {
    const now = new Date().toISOString();
    const id = 'SIM-' + Math.random().toString(36).substring(2, 10).toUpperCase();

    const record: AcousticSimulationRecord = {
      exportId: id,
      timestampUtc: now,
      softwareVersion: 'SoundForm 3D v3.0 (Computational Acoustics Platform)',
      chamberParameters: chamber,
      radiationForceField: radiation,
      biophysicalTelemetry: biophysTelemetry,
    };

    if (vocalReport && vocalReport.f0Hz > 0) {
      record.vocalAcoustics = vocalReport;
    }

    return record;
  }

  public static generateMarkdownReport(record: AcousticSimulationRecord): string {
    let report = `# SoundForm 3D — Acoustic Simulation Report

**Export ID:** \`${record.exportId}\`  
**Timestamp (UTC):** \`${record.timestampUtc}\`  
**Platform:** \`${record.softwareVersion}\`  

---

## 1. Acoustic Chamber Configuration

| Parameter | Value | Unit / Description |
| :--- | :--- | :--- |
| **Chamber Geometry** | \`${record.chamberParameters.geometry.toUpperCase()}\` | Boundary condition |
| **Modal Indices $(n, m, l)$** | \`(${record.chamberParameters.modalIndices.n}, ${record.chamberParameters.modalIndices.m}, ${record.chamberParameters.modalIndices.l})\` | Standing wave integers |
| **Resonant Frequency $f_{n,m,l}$** | \`${record.chamberParameters.resonantFrequencyHz.toFixed(1)}\` | $\\text{Hz}$ |
| **Speed of Sound $c$** | \`${record.chamberParameters.speedOfSoundMs}\` | $\\text{m/s}$ |
| **Medium Density $\\rho_0$** | \`${record.chamberParameters.mediumDensityKgM3}\` | $\\text{kg/m}^3$ |
| **Acoustic Power** | \`${(record.chamberParameters.acousticPower * 100).toFixed(0)}%\` | Relative amplitude |

---

## 2. Acoustic Radiation Force & Particle Trapping

| Metric | Measured Value | Theoretical Significance |
| :--- | :--- | :--- |
| **Gor'kov Potential Peak $U_{\\max}$** | \`${record.radiationForceField.gorkovPotentialPeak.toExponential(3)}\` | $\\text{J}$ (Potential well depth) |
| **Active Trapped Particles** | \`${record.radiationForceField.activeParticles}\` | Particle count |
| **Trapping Regime** | \`${record.radiationForceField.trappingMode.toUpperCase()}\` | Gor'kov Force direction |
`;

    if (record.vocalAcoustics && record.vocalAcoustics.f0Hz > 0) {
      const v = record.vocalAcoustics;
      report += `
---

## 3. Vocal Acoustics Telemetry

| Metric | Measured Value | Unit / Significance |
| :--- | :--- | :--- |
| **Fundamental Pitch ($f_0$)** | \`${v.f0Hz.toFixed(1)} Hz\` | Mean Glottal Contact Frequency |
| **Pitch Jitter ($J_{\\text{loc}}$)** | \`${v.jitterPercent.toFixed(2)}%\` | Cycle-to-Cycle Perturbation |
| **Amplitude Shimmer ($S_{\\text{loc}}$)** | \`${v.shimmerPercent.toFixed(2)}%\` | Amplitude Perturbation |
| **Harmonics-to-Noise Ratio** | \`${v.hnrDb.toFixed(1)} dB\` | Spectral Periodicity |
| **Cepstral Peak Prominence** | \`${v.cppDb.toFixed(1)} dB\` | Hillenbrand Periodicity |
`;
    }

    report += `
---
*Generated by SoundForm 3D Acoustic Intelligence Platform.*
`;

    return report;
  }
}
