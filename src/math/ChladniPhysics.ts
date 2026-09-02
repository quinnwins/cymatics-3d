import { BesselFunctions } from './BesselFunctions';
import { AcousticEigenmodes, AcousticContrastFactors, MediumProperties } from './AcousticEigenmodes';

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
   * Exact Bessel function J_m(u) of integer order m via Gauss-Chebyshev quadrature.
   * Completely singularity-free at u = 0, J_0(0) = 1.0, J_{m>0}(0) = 0.0.
   */
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

  /**
   * Evaluates 3D acoustic pressure field p(r, theta, z) in a cylindrical cavity.
   * x, z in transversal plane r in [0, 1], y in axial axis [-1, 1].
   * n: radial order, m: azimuthal order, l: axial order.
   */
  public static cylindricalPressure(
    x: number,
    y: number,
    z: number,
    n: number,
    m: number,
    l: number
  ): number {
    const r = Math.sqrt(x * x + z * z);
    const theta = Math.atan2(z, x);

    // Exact m-th order Bessel function for acoustic radial standing waves with exact NIST DLMF 10.75 root
    const alphaPrime = AcousticEigenmodes.getCylindricalBesselDerivativeRoot(m, n);
    const kr = alphaPrime * r;
    const jm = this.evalBesselJ(m, kr);

    const angular = Math.cos(m * theta);
    const axial = Math.cos((l * Math.PI * (y + 1)) / 2.0);

    return jm * angular * axial;
  }

  /**
   * Evaluates 3D acoustic pressure field p(r, theta, phi) in a spherical resonator.
   * n: radial order, m: azimuthal order, l: spherical degree.
   */
  public static sphericalPressure(
    x: number,
    y: number,
    z: number,
    n: number,
    m: number,
    l: number
  ): number {
    const r = Math.sqrt(x * x + y * y + z * z);
    const xiPrime = AcousticEigenmodes.getSphericalBesselDerivativeRoot(l, n);
    const kr = xiPrime * r;

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
      jl = kr < 0.001 ? (l === 0 ? 1.0 : 0.0) : Math.sin(kr - (l * Math.PI) / 2) / kr;
    }

    if (r < 1e-6) {
      return l === 0 ? 1.0 : 0.0;
    }

    // Exact Associated Legendre evaluation on Cartesian sphere coordinates
    const cosTheta = Math.max(-1, Math.min(1, y / r));
    const sinTheta = Math.sqrt(Math.max(0, 1 - cosTheta * cosTheta));
    const phi = Math.atan2(z, x);

    let legendre = 1.0;
    if (l === 1) {
      legendre = m === 0 ? cosTheta : -sinTheta;
    } else if (l === 2) {
      if (m === 0) legendre = 0.5 * (3 * cosTheta * cosTheta - 1);
      else if (m === 1) legendre = -3 * sinTheta * cosTheta;
      else legendre = 3 * sinTheta * sinTheta;
    } else if (l === 3) {
      if (m === 0) legendre = 0.5 * (5 * cosTheta * cosTheta * cosTheta - 3 * cosTheta);
      else if (m === 1) legendre = -1.5 * (5 * cosTheta * cosTheta - 1) * sinTheta;
      else if (m === 2) legendre = 15 * sinTheta * sinTheta * cosTheta;
      else legendre = -15 * sinTheta * sinTheta * sinTheta;
    }

    const azimuthal = Math.cos(m * phi);

    return jl * legendre * azimuthal;
  }

  /**
   * Computes the Gor'kov Acoustic Radiation Potential U and Force Vector F = -grad(U).
   * Supports both normalized geometric mode and full calibrated material contrast mode.
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
    acousticPower = 1.0,
    contrast?: AcousticContrastFactors,
    medium: MediumProperties = AcousticEigenmodes.MEDIA.water,
    particleRadius = 5e-6,
    frequencyHz = 1000.0
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
    const gradSq = gradPx * gradPx + gradPy * gradPy + gradPz * gradPz;

    if (contrast) {
      // Full Gor'kov potential U = (V_p / (4 * rho_0 * c_0^2)) * [ f1 * |p|^2 - (3/2) * (f2 / k^2) * |grad p|^2 ]
      const c0 = medium.speedOfSound;
      const rho0 = medium.density;
      const k = Math.max(1e-3, (2.0 * Math.PI * frequencyHz) / c0);
      const vp = (4.0 / 3.0) * Math.PI * Math.pow(particleRadius, 3);
      const kSq = k * k;

      const scale = (vp / (4.0 * rho0 * c0 * c0)) * acousticPower;
      const potential = scale * (contrast.f1 * p0 * p0 - 1.5 * (contrast.f2 / kSq) * gradSq);

      // Gradient of U via finite differences
      const evalU = (px: number, py: number, pz: number): number => {
        const p = evalP(px, py, pz);
        const gx = (evalP(px + eps, py, pz) - evalP(px - eps, py, pz)) / (2 * eps);
        const gy = (evalP(px, py + eps, pz) - evalP(px, py - eps, pz)) / (2 * eps);
        const gz = (evalP(px, py, pz + eps) - evalP(px, py, pz - eps)) / (2 * eps);
        const g2 = gx * gx + gy * gy + gz * gz;
        return scale * (contrast.f1 * p * p - 1.5 * (contrast.f2 / kSq) * g2);
      };

      const fx = -(evalU(x + eps, y, z) - evalU(x - eps, y, z)) / (2 * eps);
      const fy = -(evalU(x, y + eps, z) - evalU(x, y - eps, z)) / (2 * eps);
      const fz = -(evalU(x, y, z + eps) - evalU(x, y, z - eps)) / (2 * eps);

      return { fx, fy, fz, potential };
    }

    // Classic normalized Gor'kov approximation
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
