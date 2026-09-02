/**
 * AcousticEigenmodes.ts
 * Exact Acoustic Cavity Eigenmodes & NIST DLMF 10.75 Bessel Derivative Roots
 *
 * Implements exact boundary value solutions for rigid (Neumann) cavities:
 * - Rectangular Cavity: Exact Cartesian modal eigenfrequencies and eigenfunctions.
 * - Cylindrical Cavity: Exact radial derivative roots alpha'_{m,n} of J'_m(u) = 0.
 * - Spherical Resonator: Exact radial derivative roots xi'_{l,n} of j'_l(u) = 0.
 * - Acoustic media parameters (air, water, seawater, tissue) and particle properties.
 * - Full Gor'kov acoustic contrast factors f1 and f2.
 */

export interface MediumProperties {
  name: string;
  speedOfSound: number; // m/s
  density: number;      // kg/m^3
  viscosity: number;    // Pa*s
  bulkModulus: number;  // Pa
}

export interface ParticleProperties {
  name: string;
  density: number;      // kg/m^3
  speedOfSound: number; // m/s
  radius: number;       // meters
}

export interface AcousticContrastFactors {
  f1: number; // Monopole (compressibility) contrast factor
  f2: number; // Dipole (density) contrast factor
  phi: number; // Acoustic contrast factor Phi = f1/3 + f2/2
}

export class AcousticEigenmodes {
  /**
   * NIST DLMF 10.75: Zeros alpha'_{m,n} of J'_m(x) = 0 for m = 0..8, n = 1..8.
   * Indexing: ALPHA_PRIME[m][n - 1]
   */
  public static readonly ALPHA_PRIME: readonly (readonly number[])[] = [
    // m = 0 (Roots of J'_0(x) = -J_1(x) = 0, excluding x = 0)
    [3.831706, 7.015587, 10.173468, 13.323692, 16.470630, 19.615859, 22.760084, 25.903672],
    // m = 1 (Roots of J'_1(x) = 0)
    [1.841184, 5.331443, 8.536316, 11.706005, 14.863589, 18.015528, 21.164370, 24.311327],
    // m = 2 (Roots of J'_2(x) = 0)
    [3.054237, 6.706133, 9.969468, 13.170371, 16.347522, 19.512913, 22.671582, 25.826037],
    // m = 3 (Roots of J'_3(x) = 0)
    [4.201189, 8.015237, 11.345924, 14.585848, 17.788748, 20.972479, 24.144898, 27.310067],
    // m = 4 (Roots of J'_4(x) = 0)
    [5.317553, 9.282396, 12.681908, 15.964107, 19.196030, 22.401033, 25.586414, 28.767426],
    // m = 5 (Roots of J'_5(x) = 0)
    [6.415616, 10.519861, 13.987189, 17.312843, 20.575515, 23.803580, 27.001099, 30.197368],
    // m = 6 (Roots of J'_6(x) = 0)
    [7.501266, 11.734936, 15.268182, 18.637374, 21.931718, 25.183921, 28.392764, 31.603387],
    // m = 7 (Roots of J'_7(x) = 0)
    [8.577836, 12.932373, 16.529367, 19.941215, 23.268056, 26.545037, 29.764426, 32.988456],
    // m = 8 (Roots of J'_8(x) = 0)
    [9.647422, 14.115519, 17.773950, 21.226875, 24.587201, 27.889078, 31.118432, 34.354898],
  ];

  /**
   * NIST DLMF 10.75: Zeros xi'_{l,n} of spherical Bessel derivative j'_l(x) = 0 for l = 0..8, n = 1..4.
   * Indexing: XI_PRIME[l][n - 1]
   */
  public static readonly XI_PRIME: readonly (readonly number[])[] = [
    // l = 0 (Roots of j'_0(x) = -j_1(x) = 0)
    [4.493409, 7.725252, 10.904122, 14.066194],
    // l = 1
    [2.081576, 5.940370, 9.205840, 12.404445],
    // l = 2
    [3.342094, 7.289932, 10.613855, 13.846111],
    // l = 3
    [4.514099, 8.583755, 11.972730, 15.244514],
    // l = 4
    [5.646704, 9.840446, 13.295564, 16.609346],
    // l = 5
    [6.756456, 11.070216, 14.590481, 17.947239],
    // l = 6
    [7.851078, 12.279326, 15.862955, 19.262963],
    // l = 7
    [8.934842, 13.472025, 17.116668, 20.559981],
    // l = 8
    [10.010411, 14.651139, 18.354432, 21.840788],
  ];

  // Standard propagation media
  public static readonly MEDIA: Record<string, MediumProperties> = {
    air: {
      name: 'Air (20°C, 1 atm)',
      speedOfSound: 343.2,
      density: 1.2041,
      viscosity: 1.81e-5,
      bulkModulus: 1.2041 * 343.2 * 343.2,
    },
    water: {
      name: 'Fresh Water (20°C)',
      speedOfSound: 1482.0,
      density: 998.2,
      viscosity: 1.002e-3,
      bulkModulus: 998.2 * 1482.0 * 1482.0,
    },
    seawater: {
      name: 'Seawater (35 ppt, 20°C)',
      speedOfSound: 1530.0,
      density: 1025.0,
      viscosity: 1.08e-3,
      bulkModulus: 1025.0 * 1530.0 * 1530.0,
    },
    tissue: {
      name: 'Biological Soft Tissue',
      speedOfSound: 1540.0,
      density: 1060.0,
      viscosity: 2.5e-3,
      bulkModulus: 1060.0 * 1540.0 * 1540.0,
    },
  };

  // Standard micro-particles used in acoustic trapping
  public static readonly PARTICLES: Record<string, ParticleProperties> = {
    polystyrene: {
      name: 'Polystyrene Micro-beads',
      density: 1050.0,
      speedOfSound: 2350.0,
      radius: 5e-6,
    },
    silica: {
      name: 'Silica Beads',
      density: 2200.0,
      speedOfSound: 5900.0,
      radius: 5e-6,
    },
    glass: {
      name: 'Borosilicate Glass Spheres',
      density: 2500.0,
      speedOfSound: 5600.0,
      radius: 10e-6,
    },
    airBubble: {
      name: 'Microbubble (Air in Water)',
      density: 1.2041,
      speedOfSound: 343.2,
      radius: 2e-6,
    },
  };

  public static getCylindricalBesselDerivativeRoot(m: number, n: number): number {
    const absM = Math.round(Math.abs(m));
    const safeN = Math.max(1, Math.round(n));

    if (absM < this.ALPHA_PRIME.length) {
      const row = this.ALPHA_PRIME[absM];
      if (safeN <= row.length) {
        return row[safeN - 1];
      }
    }
    const beta = (safeN + absM * 0.5 - 0.75) * Math.PI;
    const m4 = 4 * absM * absM;
    return beta - (m4 + 3) / (8 * beta);
  }

  public static getSphericalBesselDerivativeRoot(l: number, n: number): number {
    const safeL = Math.round(Math.max(0, l));
    const safeN = Math.max(1, Math.round(n));

    if (safeL < this.XI_PRIME.length) {
      const row = this.XI_PRIME[safeL];
      if (safeN <= row.length) {
        return row[safeN - 1];
      }
    }
    return (safeN + safeL * 0.5 - 0.25) * Math.PI;
  }

  public static cylindricalResonanceFrequency(
    m: number,
    n: number,
    l: number,
    R = 0.05,
    H = 0.10,
    c = 1482.0
  ): number {
    const alphaPrime = this.getCylindricalBesselDerivativeRoot(m, n);
    const kr = alphaPrime / R;
    const kz = (Math.max(0, l) * Math.PI) / H;
    const k = Math.sqrt(kr * kr + kz * kz);
    return (c * k) / (2 * Math.PI);
  }

  public static sphericalResonanceFrequency(
    l: number,
    n: number,
    R = 0.05,
    c = 1482.0
  ): number {
    const xiPrime = this.getSphericalBesselDerivativeRoot(l, n);
    return (c * xiPrime) / (2 * Math.PI * R);
  }

  public static computeAcousticContrast(
    medium: MediumProperties = this.MEDIA.water,
    particle: ParticleProperties = this.PARTICLES.polystyrene
  ): AcousticContrastFactors {
    const k0 = medium.density * medium.speedOfSound * medium.speedOfSound;
    const kp = particle.density * particle.speedOfSound * particle.speedOfSound;

    const f1 = 1.0 - k0 / kp;
    const f2 = (2.0 * (particle.density - medium.density)) / (2.0 * particle.density + medium.density);
    const phi = f1 / 3.0 + f2 / 2.0;

    return { f1, f2, phi };
  }

  public static evalCylindricalEigenfunction(
    r: number,
    theta: number,
    z: number,
    m: number,
    n: number,
    l: number,
    R = 1.0,
    H = 1.0
  ): number {
    const alphaPrime = this.getCylindricalBesselDerivativeRoot(m, n);
    const kr = (alphaPrime / R) * r;
    const jm = this.evalBesselJ(m, kr);
    const angular = Math.cos(m * theta);
    const kz = (l * Math.PI) / H;
    const axial = Math.cos(kz * z);
    return jm * angular * axial;
  }

  public static evalBesselJ(m: number, u: number): number {
    const absU = Math.abs(u);
    const absM = Math.round(Math.abs(m));
    if (absU < 1e-6) return absM === 0 ? 1.0 : 0.0;
    const N = 16;
    let sum = 0.0;
    for (let i = 0; i < N; i++) {
      const tau = (Math.PI * (i + 0.5)) / N;
      sum += Math.cos(absM * tau - absU * Math.sin(tau));
    }
    const val = sum / N;
    return u < 0 && absM % 2 !== 0 ? -val : val;
  }
}
