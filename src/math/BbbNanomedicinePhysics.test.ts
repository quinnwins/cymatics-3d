import { describe, it, expect } from 'vitest';
import { BbbNanomedicinePhysics } from './BbbNanomedicinePhysics';

describe('BbbNanomedicinePhysics - FUS BBB Permeation & Time-Window Engine', () => {
  it('calculates accurate hydrodynamic radius scaling across small molecules, mAbs, and LNPs', () => {
    const rTMZ = BbbNanomedicinePhysics.calculateHydrodynamicRadius(0.194); // Temozolomide (0.194 kDa)
    const rmAb = BbbNanomedicinePhysics.calculateHydrodynamicRadius(148.0); // Trastuzumab (148 kDa)
    const rLNP = BbbNanomedicinePhysics.calculateHydrodynamicRadius(12000.0); // mRNA-LNP

    expect(rTMZ).toBeCloseTo(0.36, 1);
    expect(rmAb).toBeCloseTo(5.50, 1);
    expect(rLNP).toBeGreaterThan(30.0);
  });

  it('predicts reversible biexponential Claudin-5 pore dilation and resealing', () => {
    const mi = 0.55;
    const rPMax = BbbNanomedicinePhysics.calculatePeakPoreRadius(mi);

    expect(rPMax).toBeGreaterThan(25.0); // Should dilate to 30 - 60 nm
    expect(rPMax).toBeLessThan(85.0);

    const rP2h = BbbNanomedicinePhysics.calculateDynamicPoreRadius(rPMax, 2.0);
    const rP12h = BbbNanomedicinePhysics.calculateDynamicPoreRadius(rPMax, 12.0);
    const rP24h = BbbNanomedicinePhysics.calculateDynamicPoreRadius(rPMax, 24.0);

    expect(rP2h).toBeLessThan(rPMax);
    expect(rP12h).toBeLessThan(rP2h);
    expect(rP24h).toBeLessThan(rP12h);
    expect(rP24h).toBeLessThan(6.0);
  });

  it('demonstrates selective steric exclusion and therapeutic delivery enhancement for Trastuzumab and Doxil', () => {
    const trastuzumab = BbbNanomedicinePhysics.CLINICAL_PRESETS.trastuzumab;
    const doxil = BbbNanomedicinePhysics.CLINICAL_PRESETS.doxil;

    const acoustics = {
      peakNegativePressureMPa: 0.65,
      frequencyMHz: 1.0,
      postSonicationTimeHours: 1.0,
      microbubbleType: 'definity' as const,
    };

    const telemetrymAb = BbbNanomedicinePhysics.evaluateDeliveryTelemetry(trastuzumab, acoustics);
    const telemetryDoxil = BbbNanomedicinePhysics.evaluateDeliveryTelemetry(doxil, acoustics);

    expect(telemetrymAb.permeationStatus).toBe('optimal');
    expect(telemetrymAb.effectiveTimeWindowHours).toBeGreaterThan(4.0);
    expect(telemetrymAb.deliveryEnhancementFold).toBeGreaterThan(50.0);

    expect(telemetryDoxil.soluteToPoreRatioLambda).toBeGreaterThan(telemetrymAb.soluteToPoreRatioLambda);
    expect(telemetryDoxil.accumulatedBrainDoseUgG).toBeGreaterThan(0.0);
  });
});
