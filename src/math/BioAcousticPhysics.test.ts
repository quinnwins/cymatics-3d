import { describe, it, expect } from 'vitest';
import { BioAcousticPhysics } from './BioAcousticPhysics';

describe('BioAcousticPhysics - Cellular Biomechanics & Acoustophoresis', () => {
  describe('Rayleigh Droplet Resonance Frequencies', () => {
    it('calculates higher resonance for healthy cells vs softened cancer cells', () => {
      const R = 10e-6; // 10 um
      const rho = 1050; // kg/m^3

      // Healthy: sigma = 0.35 mN/m
      const fHealthy = BioAcousticPhysics.calculateRayleighFrequency(2, R, 0.35e-3, rho);
      expect(fHealthy).toBeGreaterThan(7000);
      expect(fHealthy).toBeLessThan(9500); // ~8.21 kHz

      // Cancer: sigma = 0.04 mN/m
      const fCancer = BioAcousticPhysics.calculateRayleighFrequency(2, R, 0.04e-3, rho);
      expect(fCancer).toBeGreaterThan(2000);
      expect(fCancer).toBeLessThan(3500); // ~2.78 kHz

      // Cancer cell resonant frequency must be significantly lower due to cortex softening
      expect(fHealthy / fCancer).toBeCloseTo(Math.sqrt(0.35 / 0.04), 2);
    });
  });

  describe('Gor\'kov Acoustic Contrast Factor (Phi)', () => {
    it('verifies healthy cell contrast is positive (node migrant)', () => {
      const phiHealthy = BioAcousticPhysics.calculateAcousticContrast(1080.0, 4.02e-10);
      expect(phiHealthy).toBeGreaterThan(0);
    });

    it('verifies softened cancer cell contrast is shifted lower/negative (antinode migrant)', () => {
      const phiCancer = BioAcousticPhysics.calculateAcousticContrast(1045.0, 4.38e-10);
      const phiHealthy = BioAcousticPhysics.calculateAcousticContrast(1080.0, 4.02e-10);
      expect(phiCancer).toBeLessThan(phiHealthy);
    });
  });

  describe('Specimen Database Completeness', () => {
    it('contains all 5 canonical bio-acoustic specimens', () => {
      const keys = Object.keys(BioAcousticPhysics.SPECIMENS);
      expect(keys).toContain('healthy-somatic');
      expect(keys).toContain('malignant-cancer');
      expect(keys).toContain('viral-capsid');
      expect(keys).toContain('bacterial-wall');
      expect(keys).toContain('histotripsy-cavitation');
    });
  });
});
