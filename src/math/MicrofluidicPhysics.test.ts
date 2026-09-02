import { describe, it, expect } from 'vitest';
import { MicrofluidicPhysics } from './MicrofluidicPhysics';

describe('MicrofluidicPhysics - SSAW Acoustophoresis Telemetry', () => {
  it('calculates deterministic flow hydrodynamics and Reynolds number', () => {
    const telemetry = MicrofluidicPhysics.computeTelemetry(2.0, 1.0, 4, 0.016);
    
    expect(telemetry.flowVelocityMmS).toBe(1.85);
    expect(telemetry.volumetricFlowRateUlMin).toBeGreaterThan(15.0);
    expect(telemetry.reynoldsNumber).toBeLessThan(2.0); // Stokes laminar regime (Re << 1)
  });

  it('computes high separation purity under optimal acoustic power', () => {
    const telemetry = MicrofluidicPhysics.computeTelemetry(3.0, 1.0, 4, 0.016);

    expect(telemetry.separationPurityPercent).toBeGreaterThan(95.0);
    expect(telemetry.contrastPhiSomatic).toBeGreaterThan(0.0); // Node-focusing
    expect(telemetry.contrastPhiCtc).toBeLessThan(0.0); // Antinode-deflection
  });

  it('accumulates processed cell counts smoothly across time steps', () => {
    MicrofluidicPhysics.resetAccumulators(1000, 50);
    const t1 = MicrofluidicPhysics.computeTelemetry(2.0, 1.0, 4, 0.1);
    expect(t1.sortedSomaticCount).toBeGreaterThan(1000);
    expect(t1.divertedCtcCount).toBeGreaterThan(50);
  });
});
