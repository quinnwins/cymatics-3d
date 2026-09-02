import { describe, it, expect } from 'vitest';
import { AcousticEigenmodes } from './AcousticEigenmodes';

describe('AcousticEigenmodes', () => {
  it('returns exact NIST DLMF 10.75 roots for cylindrical cavity Bessel derivatives', () => {
    // m = 0, n = 1: 3.831706
    expect(AcousticEigenmodes.getCylindricalBesselDerivativeRoot(0, 1)).toBeCloseTo(3.831706, 5);
    // m = 1, n = 1: 1.841184
    expect(AcousticEigenmodes.getCylindricalBesselDerivativeRoot(1, 1)).toBeCloseTo(1.841184, 5);
    // m = 2, n = 2: 6.706133
    expect(AcousticEigenmodes.getCylindricalBesselDerivativeRoot(2, 2)).toBeCloseTo(6.706133, 5);
    // m = 3, n = 3: 11.345924
    expect(AcousticEigenmodes.getCylindricalBesselDerivativeRoot(3, 3)).toBeCloseTo(11.345924, 5);
  });

  it('evaluates numerical derivative J\'_m(alpha\'_{mn}) ~ 0 at tabulated roots', () => {
    const eps = 1e-4;
    // For m=1, root alpha'_{1,1} = 1.841184
    const r11 = AcousticEigenmodes.getCylindricalBesselDerivativeRoot(1, 1);
    const jPlus = AcousticEigenmodes.evalBesselJ(1, r11 + eps);
    const jMinus = AcousticEigenmodes.evalBesselJ(1, r11 - eps);
    const deriv = (jPlus - jMinus) / (2 * eps);
    expect(Math.abs(deriv)).toBeLessThan(1e-3);

    // For m=2, root alpha'_{2,1} = 3.054237
    const r21 = AcousticEigenmodes.getCylindricalBesselDerivativeRoot(2, 1);
    const j2Plus = AcousticEigenmodes.evalBesselJ(2, r21 + eps);
    const j2Minus = AcousticEigenmodes.evalBesselJ(2, r21 - eps);
    const deriv2 = (j2Plus - j2Minus) / (2 * eps);
    expect(Math.abs(deriv2)).toBeLessThan(1e-3);
  });

  it('computes exact spherical Bessel derivative roots from NIST DLMF 10.75', () => {
    // l = 0, n = 1: 4.493409
    expect(AcousticEigenmodes.getSphericalBesselDerivativeRoot(0, 1)).toBeCloseTo(4.493409, 5);
    // l = 1, n = 1: 2.081576
    expect(AcousticEigenmodes.getSphericalBesselDerivativeRoot(1, 1)).toBeCloseTo(2.081576, 5);
    // l = 2, n = 1: 3.342094
    expect(AcousticEigenmodes.getSphericalBesselDerivativeRoot(2, 1)).toBeCloseTo(3.342094, 5);
  });

  it('calculates cylindrical cavity resonance frequencies physically proportional to c', () => {
    const freqAir = AcousticEigenmodes.cylindricalResonanceFrequency(1, 1, 0, 0.05, 0.10, 343.2);
    const freqWater = AcousticEigenmodes.cylindricalResonanceFrequency(1, 1, 0, 0.05, 0.10, 1482.0);

    expect(freqWater / freqAir).toBeCloseTo(1482.0 / 343.2, 4);
    // f = (c / 2pi) * (alpha'_{1,1} / R) = (343.2 / (2 * pi)) * (1.841184 / 0.05) ~ 2011.8 Hz
    expect(freqAir).toBeCloseTo(2011.8, 0);
  });

  it('correctly determines positive contrast factor for polystyrene and negative for microbubbles', () => {
    const water = AcousticEigenmodes.MEDIA.water;
    const poly = AcousticEigenmodes.PARTICLES.polystyrene;
    const bubble = AcousticEigenmodes.PARTICLES.airBubble;

    const contrastPoly = AcousticEigenmodes.computeAcousticContrast(water, poly);
    // Polystyrene is denser and stiffer than water => f1 > 0, f2 > 0, Phi > 0 (normal Chladni node trapping)
    expect(contrastPoly.f1).toBeGreaterThan(0);
    expect(contrastPoly.f2).toBeGreaterThan(0);
    expect(contrastPoly.phi).toBeGreaterThan(0);

    const contrastBubble = AcousticEigenmodes.computeAcousticContrast(water, bubble);
    // Air bubble in water has higher compressibility (lower bulk modulus) and lower density => negative contrast (antinode trapping)
    expect(contrastBubble.f1).toBeLessThan(0);
    expect(contrastBubble.f2).toBeLessThan(0);
    expect(contrastBubble.phi).toBeLessThan(0);
  });
});
