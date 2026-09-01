import { describe, it, expect } from 'vitest';
import { SphericalHarmonics } from './SphericalHarmonics';

describe('SphericalHarmonics', () => {
  it('evaluates degree l=0 monopole consistently', () => {
    const sh = SphericalHarmonics.evaluateL3(0, 0, 1);
    expect(sh.y00).toBeCloseTo(0.282095, 5);
  });

  it('evaluates degree l=1 dipole along coordinate axes', () => {
    // Top pole (0, 0, 1) -> y1_0 should be maximum
    const shZ = SphericalHarmonics.evaluateL3(0, 0, 1);
    expect(shZ.y1_0).toBeCloseTo(0.488603, 5);
    expect(shZ.y1_1).toBeCloseTo(0, 5);
    expect(shZ.y1_neg1).toBeCloseTo(0, 5);

    // X axis (1, 0, 0) -> y1_1 should be maximum
    const shX = SphericalHarmonics.evaluateL3(1, 0, 0);
    expect(shX.y1_1).toBeCloseTo(0.488603, 5);
  });

  it('evaluates degree l=2 quadrupole symmetry', () => {
    const shZ = SphericalHarmonics.evaluateL3(0, 0, 1);
    // For (0, 0, 1), 3z^2 - 1 = 2 -> y2_0 = 0.31539 * 2 = 0.63078
    expect(shZ.y2_0).toBeCloseTo(0.63078, 4);

    const shXY = SphericalHarmonics.evaluateL3(1 / Math.sqrt(2), 1 / Math.sqrt(2), 0);
    expect(shXY.y2_neg2).toBeCloseTo(1.092548 * 0.5, 4);
  });

  it('provides valid GLSL code snippet', () => {
    const glsl = SphericalHarmonics.getGLSLDefinition();
    expect(glsl).toContain('evalSH_L0_L1');
    expect(glsl).toContain('evalSH_L2');
    expect(glsl).toContain('evalSH_L3');
  });
});
