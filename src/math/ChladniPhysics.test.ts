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
      // For normalized coordinates in [-1, 1], n=2 mode has p = cos(pi * x) => zero at x = 0.5
      const pNode = ChladniPhysics.rectangularPressure(0.5, 0.0, 0.0, 2, 1, 1);
      expect(pNode).toBeCloseTo(0.0, 6);
    });
  });

  describe('Gor\'kov Radiation Potential Force Vector F = -grad(U)', () => {
    it('verifies Normal mode Gor\'kov force points towards pressure nodes', () => {
      // In 1D mode (2,0,0), p = cos(pi * x). Node is at x = 0.5.
      // At x = 0.6 (right of node at 0.5), force must push LEFT (negative fx) towards node
      const forceRight = ChladniPhysics.computeGorkovForce(0.6, 0, 0, 2, 0, 0, 'rectangular', 'normal');
      expect(forceRight.fx).toBeLessThan(0);

      // At x = 0.4 (left of node at 0.5), force must push RIGHT (positive fx) towards node
      const forceLeft = ChladniPhysics.computeGorkovForce(0.4, 0, 0, 2, 0, 0, 'rectangular', 'normal');
      expect(forceLeft.fx).toBeGreaterThan(0);
    });

    it('verifies Inverse mode Gor\'kov force points towards pressure antinodes', () => {
      // In inverse mode, particle is pushed away from node at 0.5 towards antinode
      const forceInv = ChladniPhysics.computeGorkovForce(0.6, 0, 0, 2, 0, 0, 'rectangular', 'inverse');
      expect(forceInv.fx).toBeGreaterThan(0);
    });
  });

  describe('Cylindrical & Spherical Pressure Evaluations', () => {
    it('evaluates cylindrical and spherical cavity pressure without NaN', () => {
      const pCyl = ChladniPhysics.cylindricalPressure(0.5, 0.2, 0.3, 2, 2, 1);
      expect(Number.isFinite(pCyl)).toBe(true);

      const pSph = ChladniPhysics.sphericalPressure(0.4, 0.3, 0.5, 2, 1, 2);
      expect(Number.isFinite(pSph)).toBe(true);
    });

    it('computes finite Gor\'kov force vectors in cylindrical and spherical geometries', () => {
      const gCyl = ChladniPhysics.computeGorkovForce(0.3, 0.1, 0.2, 2, 1, 1, 'cylindrical', 'normal');
      expect(Number.isFinite(gCyl.fx)).toBe(true);
      expect(Number.isFinite(gCyl.fy)).toBe(true);
      expect(Number.isFinite(gCyl.fz)).toBe(true);
      expect(Number.isFinite(gCyl.potential)).toBe(true);

      const gSph = ChladniPhysics.computeGorkovForce(0.2, 0.3, 0.1, 2, 1, 1, 'spherical', 'normal');
      expect(Number.isFinite(gSph.fx)).toBe(true);
      expect(Number.isFinite(gSph.fy)).toBe(true);
      expect(Number.isFinite(gSph.fz)).toBe(true);
      expect(Number.isFinite(gSph.potential)).toBe(true);
    });

    it('computes calibrated Gor\'kov force with true acoustic contrast factors f1 and f2', () => {
      const poly = { f1: 0.65, f2: 0.05, phi: 0.24 }; // Polystyrene in water
      const gCal = ChladniPhysics.computeGorkovForce(
        0.6, 0, 0, 2, 0, 0, 'rectangular', 'normal', 1.0, poly
      );
      expect(Number.isFinite(gCal.fx)).toBe(true);
      expect(Number.isFinite(gCal.potential)).toBe(true);
      // Polystyrene has positive f1 and f2, so force at x = 0.6 pushes toward node at x = 0.5 (fx < 0)
      expect(gCal.fx).toBeLessThan(0);
    });
  });
});

