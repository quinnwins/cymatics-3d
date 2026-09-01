import { describe, it, expect } from 'vitest';
import { HistotripsyPhysics } from './HistotripsyPhysics';

describe('HistotripsyPhysics - Cavitation Shockwaves & Thermal Dosimetry Proofs', () => {
  describe('Intrinsic Nucleation Threshold (-26 MPa)', () => {
    it('detects subthreshold tensile pressure vs above-threshold cavitation', () => {
      expect(HistotripsyPhysics.isIntrinsicThresholdReached(15.0)).toBe(false);
      expect(HistotripsyPhysics.isIntrinsicThresholdReached(25.9)).toBe(false);
      expect(HistotripsyPhysics.isIntrinsicThresholdReached(26.0)).toBe(true);
      expect(HistotripsyPhysics.isIntrinsicThresholdReached(32.0)).toBe(true);
    });
  });

  describe('Water-Hammer Microjet Shock Mechanics', () => {
    it('evaluates microjet velocity and gigapascal shockwave pressures above threshold', () => {
      const { microjetVelocityMs, waterHammerPressureGPa } = HistotripsyPhysics.calculateWaterHammerShock(28.0);
      expect(microjetVelocityMs).toBeGreaterThanOrEqual(350.0);
      expect(waterHammerPressureGPa).toBeGreaterThanOrEqual(0.25);
    });

    it('returns proportional acoustic pre-stresses below intrinsic threshold', () => {
      const { microjetVelocityMs, waterHammerPressureGPa } = HistotripsyPhysics.calculateWaterHammerShock(13.0);
      expect(microjetVelocityMs).toBeLessThan(100.0);
      expect(waterHammerPressureGPa).toBeLessThan(0.1);
    });
  });

  describe('Pennes Thermal Suppression Proof (Non-Thermal Histotripsy vs HIFU)', () => {
    it('guarantees temperature rise Delta T < 1.2 deg C and negligible CEM43 thermal dose', () => {
      const { focalTemperatureRiseC, thermalDoseCEM43Min } = HistotripsyPhysics.calculateThermalDosimetry(
        30.0, // 30 MPa peak negative pressure
        50.0, // 50 Hz PRF
        2.0   // 2 cycles
      );

      // Histotripsy remains strictly mechanical: temperature rise is clinically negligible (< 1.2 deg C)
      expect(focalTemperatureRiseC).toBeLessThanOrEqual(1.2);
      // CEM43 is orders of magnitude below the 240 min thermal necrosis threshold
      expect(thermalDoseCEM43Min).toBeLessThan(0.001);
    });
  });

  describe('Selective Vessel/Bile Duct Sparing vs Carcinoma Fractionation', () => {
    it('fractionates malignant carcinoma while sparing collagenous vascular conduits', () => {
      const carcinomaTelemetry = HistotripsyPhysics.evaluateHistotripsyTelemetry({
        acousticPowerMPa: 30.0,
        pulseRepetitionFreqHz: 50,
        pulseCycles: 2,
        dutyCyclePercent: 0.01,
        isShockwaveActive: true,
        targetTissue: 'carcinoma',
      });

      const vesselTelemetry = HistotripsyPhysics.evaluateHistotripsyTelemetry({
        acousticPowerMPa: 30.0,
        pulseRepetitionFreqHz: 50,
        pulseCycles: 2,
        dutyCyclePercent: 0.01,
        isShockwaveActive: true,
        targetTissue: 'blood-vessel',
      });

      expect(carcinomaTelemetry.fractionationEfficiencyPercent).toBeGreaterThan(60.0);
      expect(carcinomaTelemetry.isIntrinsicThresholdExceeded).toBe(true);

      // Vascular structures are protected by their high tensile collagen matrix
      expect(vesselTelemetry.fractionationEfficiencyPercent).toBeLessThan(5.0);
      expect(vesselTelemetry.isVesselSparingActive).toBe(true);
    });

    it('produces identical valid positive telemetry for negative tensile pressure inputs', () => {
      const telNeg = HistotripsyPhysics.evaluateHistotripsyTelemetry({
        acousticPowerMPa: -30.0,
        pulseRepetitionFreqHz: 50,
        pulseCycles: 2,
        dutyCyclePercent: 0.01,
        isShockwaveActive: true,
        targetTissue: 'carcinoma',
      });
      const telPos = HistotripsyPhysics.evaluateHistotripsyTelemetry({
        acousticPowerMPa: 30.0,
        pulseRepetitionFreqHz: 50,
        pulseCycles: 2,
        dutyCyclePercent: 0.01,
        isShockwaveActive: true,
        targetTissue: 'carcinoma',
      });
      expect(telNeg).toEqual(telPos);
      expect(telNeg.cavitationCloudRadiusMm).toBeGreaterThan(0);
      expect(telNeg.fractionationEfficiencyPercent).toBeGreaterThan(0);
    });
  });
});
