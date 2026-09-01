import { describe, it, expect } from 'vitest';
import { ChladniPhysics } from './ChladniPhysics';

describe('ChladniPhysics - 3D Modal Physics & Gor\'kov Suite', () => {
  describe('Modal Resonance Frequencies in Air (c = 343 m/s)', () => {
    it('calculates exact 3D rectangular cavity eigenmode frequencies', () => {
      const f111 = ChladniPhysics.rectangularResonanceFrequency(1, 1, 1, 1.0, 1.0, 1.0);
      expect(f111).toBeCloseTo((343 / 2) * Math.sqrt(3), 3); // 297.047 Hz

      const f222 = ChladniPhysics.rectangularResonanceFrequency(2, 2, 2, 1.0, 1.0, 1.0);
      expect(f222).toBeCloseTo(343.0 * Math.sqrt(3), 3); // 594.093 Hz
    });
  });

  describe('Rectangular Eigenmode Nodal Planes (p = 0)', () => {
    it('verifies exact p = 0 at half-wavelength nodal planes', () => {
      // For normalized coordinates in [-1, 1], n=1 mode has p = cos(pi/2 * x) => zero at x = 1 and x = -1
      const pNode1 = ChladniPhysics.rectangularPressure(1.0, 0, 0, 1, 1, 1);
      expect(pNode1).toBeCloseTo(0.0, 6);

      // For n=2 mode, p = cos(pi * x) => zero at x = 0.5 and x = -0.5
      const pNode2 = ChladniPhysics.rectangularPressure(0.5, 0, 0, 2, 1, 1);
      expect(pNode2).toBeCloseTo(0.0, 6);
    });
  });

  describe('Gor\'kov Radiation Potential Force Vector F = -grad(U)', () => {
    it('verifies Normal mode Gor\'kov force points towards pressure nodes', () => {
      // In 1D mode (1,0,0), p = cos(pi/2 * x). Node is at x = 1.0
      // At x = 0.8 (left of node x=1.0), force must push RIGHT (positive fx) towards node
      const forceLeft = ChladniPhysics.computeGorkovForce(0.8, 0, 0, 1, 0, 0, 'rectangular', 'normal');
      expect(forceLeft.fx).toBeGreaterThan(0);

      // At x = 1.2 (right of node x=1.0), force must push LEFT (negative fx) towards node
      const forceRight = ChladniPhysics.computeGorkovForce(1.2, 0, 0, 1, 0, 0, 'rectangular', 'normal');
      expect(forceRight.fx).toBeLessThan(0);
    });

    it('verifies Inverse mode Gor\'kov force points towards pressure antinodes', () => {
      // In 1D mode (1,0,0), antinode is at x = 0.0 where p = 1.0
      // At x = 0.3 (displaced from antinode at x=0), inverse force must push LEFT (negative fx) towards antinode
      const forceInv = ChladniPhysics.computeGorkovForce(0.3, 0, 0, 1, 0, 0, 'rectangular', 'inverse');
      expect(forceInv.fx).toBeLessThan(0);
    });
  });

  describe('Cylindrical & Spherical Pressure Evaluations', () => {
    it('evaluates cylindrical and spherical cavity pressure without NaN', () => {
      const pCyl = ChladniPhysics.cylindricalPressure(0.5, 0.2, 0.3, 2, 2, 1);
      expect(Number.isFinite(pCyl)).toBe(true);

      const pSph = ChladniPhysics.sphericalPressure(0.4, 0.3, 0.5, 2, 1, 2);
      expect(Number.isFinite(pSph)).toBe(true);
    });
  });
});
