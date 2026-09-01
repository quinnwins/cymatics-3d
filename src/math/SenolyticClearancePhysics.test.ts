import { describe, it, expect } from 'vitest';
import { SenolyticClearancePhysics } from './SenolyticClearancePhysics';

describe('SenolyticClearancePhysics - Targeted Acoustic Clearance & SASP Plume Dispersion', () => {
  it('calculates higher effective stiffness in senescent cells due to vimentin cage intermediate filaments', () => {
    const effYoung = SenolyticClearancePhysics.calculateEffectiveModulus(
      SenolyticClearancePhysics.PRESET_YOUNG_FIBROBLAST
    );
    const effSen = SenolyticClearancePhysics.calculateEffectiveModulus(
      SenolyticClearancePhysics.PRESET_SENESCENT_FIBROBLAST
    );

    expect(effSen).toBeGreaterThan(effYoung * 4.0); // >4x stiffness difference
  });

  it('triggers selective MOMP activation and Caspase-3 cleavage in senescent cells while sparing healthy stroma', () => {
    const params = {
      peakPressureMPa: 0.45,
      carrierFrequencyMHz: 1.0,
      pulseRepetitionFreqHz: 1000.0,
      pulseDurationUs: 20.0,
      exposureDurationSec: 15.0,
    };

    const telemetrySen = SenolyticClearancePhysics.evaluateSenolyticTelemetry(
      SenolyticClearancePhysics.PRESET_SENESCENT_FIBROBLAST,
      params
    );
    const telemetryYoung = SenolyticClearancePhysics.evaluateSenolyticTelemetry(
      SenolyticClearancePhysics.PRESET_YOUNG_FIBROBLAST,
      params
    );

    expect(telemetrySen.cumulativeFatigueDamageD).toBeGreaterThan(1.0);
    expect(telemetrySen.mompActivationProbability).toBeGreaterThan(0.95);
    expect(telemetrySen.cleavedCaspase3ConcentrationNM).toBeGreaterThan(
      SenolyticClearancePhysics.CASPASE3_THRESH_NM
    );
    expect(telemetrySen.senolyticLysisPercentage).toBeGreaterThanOrEqual(95.0);
    expect(telemetrySen.saspCytokineConcentrationPgMl).toBeLessThan(25.0); // Depleted from 480 pg/mL
    expect(telemetrySen.isTreatmentSelective).toBe(true);

    expect(telemetryYoung.youngTissuePreservedPercentage).toBeGreaterThanOrEqual(99.0);
    expect(telemetryYoung.focalTemperatureRiseC).toBeLessThan(0.20);
    expect(telemetryYoung.thermalDoseCEM43Minutes).toBeLessThan(0.0001);
  });
});
