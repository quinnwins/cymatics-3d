import { BesselFunctions } from './BesselFunctions';

export type ChamberGeometryType = 'rectangular' | 'cylindrical' | 'spherical';

export interface ModalIndices {
  n: number;
  m: number;
  l: number;
}

export interface GorkovForceVector {
  fx: number;
  fy: number;
  fz: number;
  potential: number;
}

export class ChladniPhysics {
  public static readonly SPEED_OF_SOUND = 343.0; // m/s in air at 20°C
  public static readonly AIR_DENSITY = 1.204; // kg/m^3
  public static readonly PI = Math.PI;

  /**
   * Resonant frequency f_(n,m,l) of a rectangular rigid cavity of dimensions (Lx, Ly, Lz).
   * f = (c / 2) * sqrt((n/Lx)^2 + (m/Ly)^2 + (l/Lz)^2)
   */
  public static rectangularResonanceFrequency(
    n: number,
    m: number,
    l: number,
    Lx = 1.0,
    Ly = 1.0,
    Lz = 1.0,
    c = this.SPEED_OF_SOUND
  ): number {
    const term = Math.pow(n / Lx, 2) + Math.pow(m / Ly, 2) + Math.pow(l / Lz, 2);
    return (c / 2) * Math.sqrt(term);
  }

  /**
   * Evaluates 3D acoustic pressure field p(x,y,z) in a rectangular cavity.
   * Normalized coordinates in [-1, 1] mapped to [0, Lx], [0, Ly], [0, Lz].
   */
  public static rectangularPressure(
    x: number,
    y: number,
    z: number,
    n: number,
    m: number,
    l: number,
    degenerateMix = 0.0
  ): number {
    const kx = (n * Math.PI) / 2.0;
    const ky = (m * Math.PI) / 2.0;
    const kz = (l * Math.PI) / 2.0;

    const p1 = Math.cos(kx * x) * Math.cos(ky * y) * Math.cos(kz * z);
    if (degenerateMix <= 0.001) return p1;

    // Degenerate mode superposition for curved minimal-surface membranes
    const p2 = Math.cos(ky * x) * Math.cos(kz * y) * Math.cos(kx * z);
    const p3 = Math.cos(kz * x) * Math.cos(kx * y) * Math.cos(ky * z);
    const pSuper = (p1 + p2 - p3) * 0.57735;
    return p1 * (1 - degenerateMix) + pSuper * degenerateMix;
  }

  /**
   * Evaluates 3D acoustic pressure field p(r, theta, z) in a cylindrical cavity.
   * r in [0, 1], theta in [-PI, PI], y (z-axis) in [-1, 1].
   */
  public static cylindricalPressure(
    x: number,
    y: number,
    z: number,
    m: number,
    n: number,
    l: number
  ): number {
    const r = Math.sqrt(x * x + z * z);
    const theta = Math.atan2(z, x);

    // Approximate m-th order Bessel function for acoustic radial standing waves
    const kr = (n * Math.PI + (m * Math.PI) / 2) * r;
    const jm = Math.cos(kr - ((2 * m + 1) * Math.PI) / 4) / Math.sqrt(Math.max(0.1, kr));

    const angular = Math.cos(m * theta);
    const axial = Math.cos((l * Math.PI * (y + 1)) / 2.0);

    return jm * angular * axial;
  }

  /**
   * Evaluates 3D acoustic pressure field p(r, theta, phi) in a spherical resonator.
   */
  public static sphericalPressure(
    x: number,
    y: number,
    z: number,
    l: number,
    m: number,
    n: number
  ): number {
    const r = Math.sqrt(x * x + y * y + z * z);
    const kr = n * Math.PI * r;

    let jl: number;
    if (l === 0) {
      jl = BesselFunctions.j0(kr);
    } else if (l === 1) {
      jl = BesselFunctions.j1(kr);
    } else if (l === 2) {
      jl = BesselFunctions.j2(kr);
    } else if (l === 3) {
      jl = BesselFunctions.j3(kr);
    } else {
      jl = kr < 0.001 ? 0.0 : Math.sin(kr - (l * Math.PI) / 2) / kr;
    }

    if (r < 1e-6) {
      return l === 0 ? 1.0 : 0.0;
    }

    // Spherical harmonic angular component
    const cosTheta = Math.max(-1, Math.min(1, y / r));
    const phi = Math.atan2(z, x);
    const legendre = Math.pow(Math.abs(cosTheta), Math.max(0.1, l - m + 1));
    const azimuthal = Math.cos(m * phi);

    return jl * legendre * azimuthal;
  }

  /**
   * Computes the Gor'kov Acoustic Radiation Potential U and Force Vector F = -grad(U).
   * Normal Chladni (mode > 0): particles trap into pressure nodes (p = 0).
   * Inverse Chladni (mode < 0): particles levitate into pressure antinodes (|p| = max).
   */
  public static computeGorkovForce(
    x: number,
    y: number,
    z: number,
    n: number,
    m: number,
    l: number,
    geom: ChamberGeometryType = 'rectangular',
    mode: 'normal' | 'inverse' = 'normal',
    acousticPower = 1.0
  ): GorkovForceVector {
    const eps = 0.005;
    const evalP = (px: number, py: number, pz: number): number => {
      if (geom === 'rectangular') return this.rectangularPressure(px, py, pz, n, m, l);
      if (geom === 'cylindrical') return this.cylindricalPressure(px, py, pz, n, m, l);
      return this.sphericalPressure(px, py, pz, n, m, l);
    };

    const p0 = evalP(x, y, z);
    const pxPlus = evalP(x + eps, y, z);
    const pxMinus = evalP(x - eps, y, z);
    const pyPlus = evalP(x, y + eps, z);
    const pyMinus = evalP(x, y - eps, z);
    const pzPlus = evalP(x, y, z + eps);
    const pzMinus = evalP(x, y, z - eps);

    const gradPx = (pxPlus - pxMinus) / (2 * eps);
    const gradPy = (pyPlus - pyMinus) / (2 * eps);
    const gradPz = (pzPlus - pzMinus) / (2 * eps);

    // Gor'kov potential is proportional to <p^2> - beta * <|grad p|^2>
    const isNormal = mode === 'normal';
    const potential = isNormal ? p0 * p0 : -p0 * p0;

    // Force F = -grad(U)
    // For normal Chladni, F points towards p=0: F = -grad(p^2) = -2*p*grad(p)
    const sign = isNormal ? -1.0 : 1.0;
    const fx = sign * 2.0 * p0 * gradPx * acousticPower;
    const fy = sign * 2.0 * p0 * gradPy * acousticPower;
    const fz = sign * 2.0 * p0 * gradPz * acousticPower;

    return { fx, fy, fz, potential };
  }
}
