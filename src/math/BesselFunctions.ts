/**
 * BesselFunctions.ts
 * Spherical Bessel Functions of the First Kind: j_0(u), j_1(u), j_2(u), j_3(u)
 *
 * Implements high-precision Maclaurin series expansions for |u| < 0.25
 * to prevent catastrophic floating-point cancellation in closed-form trigonometry.
 */

export class BesselFunctions {
  public static j0(u: number): number {
    const absU = Math.abs(u);
    if (absU < 0.25) {
      const u2 = u * u;
      return 1.0 - u2 / 6.0 + (u2 * u2) / 120.0 - (u2 * u2 * u2) / 5040.0;
    }
    return Math.sin(u) / u;
  }

  public static j1(u: number): number {
    const absU = Math.abs(u);
    if (absU < 0.25) {
      const u2 = u * u;
      return u / 3.0 - (u * u2) / 30.0 + (u * u2 * u2) / 840.0 - (u * u2 * u2 * u2) / 45360.0;
    }
    return (Math.sin(u) - u * Math.cos(u)) / (u * u);
  }

  public static j2(u: number): number {
    const absU = Math.abs(u);
    if (absU < 0.25) {
      const u2 = u * u;
      return u2 / 15.0 - (u2 * u2) / 210.0 + (u2 * u2 * u2) / 7560.0 - (u2 * u2 * u2 * u2) / 498960.0;
    }
    const u2 = u * u;
    const u3 = u2 * u;
    return (3.0 / u3 - 1.0 / u) * Math.sin(u) - (3.0 / u2) * Math.cos(u);
  }

  public static j3(u: number): number {
    const absU = Math.abs(u);
    if (absU < 0.25) {
      const u2 = u * u;
      const u3 = u2 * u;
      return u3 / 105.0 - (u3 * u2) / 1890.0 + (u3 * u2 * u2) / 83160.0 - (u3 * u2 * u2 * u2) / 6486480.0;
    }
    const u2 = u * u;
    const u3 = u2 * u;
    const u4 = u2 * u2;
    return (15.0 / u4 - 6.0 / u2) * Math.sin(u) - (15.0 / u3 - 1.0 / u) * Math.cos(u);
  }

  public static getGLSLDefinition(): string {
    return `
      float sphericalBessel_j0(float u) {
        if (abs(u) < 0.25) {
          float u2 = u * u;
          return 1.0 - u2 * (1.0 / 6.0) + u2 * u2 * (1.0 / 120.0) - u2 * u2 * u2 * (1.0 / 5040.0);
        }
        return sin(u) / u;
      }

      float sphericalBessel_j1(float u) {
        if (abs(u) < 0.25) {
          float u2 = u * u;
          return u * (1.0 / 3.0) - u * u2 * (1.0 / 30.0) + u * u2 * u2 * (1.0 / 840.0);
        }
        return (sin(u) - u * cos(u)) / (u * u);
      }

      float sphericalBessel_j2(float u) {
        if (abs(u) < 0.25) {
          float u2 = u * u;
          return u2 * (1.0 / 15.0) - u2 * u2 * (1.0 / 210.0) + u2 * u2 * u2 * (1.0 / 7560.0);
        }
        float u2 = u * u;
        float u3 = u2 * u;
        return (3.0 / u3 - 1.0 / u) * sin(u) - (3.0 / u2) * cos(u);
      }

      float sphericalBessel_j3(float u) {
        if (abs(u) < 0.25) {
          float u2 = u * u;
          float u3 = u2 * u;
          return u3 * (1.0 / 105.0) - u3 * u2 * (1.0 / 1890.0) + u3 * u2 * u2 * (1.0 / 83160.0);
        }
        float u2 = u * u;
        float u3 = u2 * u;
        float u4 = u2 * u2;
        return (15.0 / u4 - 6.0 / u2) * sin(u) - (15.0 / u3 - 1.0 / u) * cos(u);
      }
    `;
  }
}
