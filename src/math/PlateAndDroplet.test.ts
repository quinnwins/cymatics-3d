import { describe, it, expect } from 'vitest';
import { CymaticsPlateMesh } from '../visualizer/CymaticsPlateMesh';
import { CymaticsMesh } from '../visualizer/CymaticsMesh';

describe('Structural Plate & Rayleigh Droplet Physics', () => {
  describe('Rayleigh Capillary Droplet Eigenmodes', () => {
    it('verifies exact theoretical Rayleigh frequency ratio f3 / f2 = sqrt(15/4) ~ 1.9365', () => {
      const f2 = CymaticsMesh.rayleighDropletEigenfrequency(2);
      const f3 = CymaticsMesh.rayleighDropletEigenfrequency(3);
      const ratio = f3 / f2;
      const theoreticalRatio = Math.sqrt(15 / 4); // sqrt( (3*2*5) / (2*1*4) ) = sqrt(30 / 8) = sqrt(3.75)
      expect(ratio).toBeCloseTo(theoreticalRatio, 5);
    });

    it('verifies exact theoretical Rayleigh frequency ratio f4 / f2 = 3.0', () => {
      const f2 = CymaticsMesh.rayleighDropletEigenfrequency(2);
      const f4 = CymaticsMesh.rayleighDropletEigenfrequency(4);
      // f4 / f2 = sqrt( (4*3*6) / (2*1*4) ) = sqrt( 72 / 8 ) = sqrt(9) = 3.0
      expect(f4 / f2).toBeCloseTo(3.0, 5);
    });

    it('verifies physical scaling with droplet radius (omega proportional to R^(-3/2))', () => {
      const r1 = 0.002;
      const r2 = 0.004; // 2x radius
      const fR1 = CymaticsMesh.rayleighDropletEigenfrequency(2, r1);
      const fR2 = CymaticsMesh.rayleighDropletEigenfrequency(2, r2);

      // (r2 / r1)^(-1.5) = 2^(-1.5) = 1 / sqrt(8) ~ 0.35355
      expect(fR2 / fR1).toBeCloseTo(Math.pow(2, -1.5), 5);
    });
  });

  describe('Kirchhoff-Love Thin-Plate Structural Dynamics', () => {
    it('verifies plate natural frequencies scale strictly as 1 / L^2', () => {
      const size1 = 0.30;
      const size2 = 0.60; // 2x size
      const fSize1 = CymaticsPlateMesh.plateNaturalFrequency(2, 2, size1);
      const fSize2 = CymaticsPlateMesh.plateNaturalFrequency(2, 2, size2);

      // (size1 / size2)^2 = (0.5)^2 = 0.25
      expect(fSize2 / fSize1).toBeCloseTo(0.25, 4);
    });

    it('verifies plate natural frequencies scale linearly with thickness h', () => {
      // f \propto \sqrt{D / (\rho h)} = \sqrt{ [E h^3 / (12(1-\nu^2))] / (\rho h) } = h \sqrt{E / [12\rho(1-\nu^2)]}
      const h1 = 0.001;
      const h2 = 0.002;
      const fH1 = CymaticsPlateMesh.plateNaturalFrequency(2, 2, 0.3, h1);
      const fH2 = CymaticsPlateMesh.plateNaturalFrequency(2, 2, 0.3, h2);

      expect(fH2 / fH1).toBeCloseTo(2.0, 4);
    });
  });
});
