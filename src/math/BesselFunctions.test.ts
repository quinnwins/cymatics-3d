import { describe, it, expect } from 'vitest';
import { BesselFunctions } from './BesselFunctions';

describe('BesselFunctions', () => {
  it('computes j0(0) = 1.0 without NaN/infinity', () => {
    expect(BesselFunctions.j0(0)).toBeCloseTo(1.0, 6);
    expect(BesselFunctions.j0(1e-5)).toBeCloseTo(1.0, 6);
  });

  it('computes j1(0) = 0.0 without NaN/infinity', () => {
    expect(BesselFunctions.j1(0)).toBeCloseTo(0.0, 6);
    expect(BesselFunctions.j1(1e-5)).toBeCloseTo(1e-5 / 3.0, 6);
  });

  it('computes known roots and values for j0(PI) and j1(1)', () => {
    // j0(pi) = sin(pi)/pi = 0
    expect(BesselFunctions.j0(Math.PI)).toBeCloseTo(0.0, 6);

    // j1(1) = (sin(1) - cos(1)) / 1^2 = 0.84147 - 0.54030 = 0.301168
    expect(BesselFunctions.j1(1.0)).toBeCloseTo(0.301168, 5);
  });

  it('evaluates higher order j2 and j3 smoothly in both small-argument and large-argument regimes', () => {
    expect(BesselFunctions.j2(0)).toBeCloseTo(0.0, 6);
    expect(BesselFunctions.j3(0)).toBeCloseTo(0.0, 6);
    expect(BesselFunctions.j3(0.1)).toBeCloseTo(0.0000095185, 8);
    expect(Number.isFinite(BesselFunctions.j2(2.5))).toBe(true);
    expect(Number.isFinite(BesselFunctions.j3(3.5))).toBe(true);
  });
});
