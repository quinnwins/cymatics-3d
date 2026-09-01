/**
 * Spherical Harmonics (Real, Cartesian Basis)
 * Evaluates Y_l^m(x,y,z) on unit sphere S^2.
 * Pure polynomial evaluations without trigonometric singularities or branch divergence.
 */

export interface SphericalHarmonicsL0L3 {
  // Degree 0 (1 basis)
  y00: number;
  // Degree 1 (3 bases: y, z, x)
  y1_neg1: number;
  y1_0: number;
  y1_1: number;
  // Degree 2 (5 bases: xy, yz, 3z^2-1, xz, x^2-y^2)
  y2_neg2: number;
  y2_neg1: number;
  y2_0: number;
  y2_1: number;
  y2_2: number;
  // Degree 3 (7 bases)
  y3_neg3: number;
  y3_neg2: number;
  y3_neg1: number;
  y3_0: number;
  y3_1: number;
  y3_2: number;
  y3_3: number;
}

export class SphericalHarmonics {
  /**
   * Evaluate real spherical harmonics up to l=3 for a normalized direction (x, y, z).
   */
  public static evaluateL3(x: number, y: number, z: number): SphericalHarmonicsL0L3 {
    const x2 = x * x;
    const y2 = y * y;
    const z2 = z * z;
    const xy = x * y;
    const yz = y * z;
    const xz = x * z;

    return {
      // Degree 0
      y00: 0.28209479177387814, // 0.5 * sqrt(1/pi)

      // Degree 1
      y1_neg1: 0.4886025119029199 * y,
      y1_0: 0.4886025119029199 * z,
      y1_1: 0.4886025119029199 * x,

      // Degree 2
      y2_neg2: 1.0925484305920792 * xy,
      y2_neg1: 1.0925484305920792 * yz,
      y2_0: 0.31539156525252 * (3 * z2 - 1),
      y2_1: 1.0925484305920792 * xz,
      y2_2: 0.5462742152960396 * (x2 - y2),

      // Degree 3
      y3_neg3: 0.5900435899266435 * y * (3 * x2 - y2),
      y3_neg2: 2.890611442640554 * xy * z,
      y3_neg1: 0.4570457994644658 * y * (5 * z2 - 1),
      y3_0: 0.3731763325901154 * z * (5 * z2 - 3),
      y3_1: 0.4570457994644658 * x * (5 * z2 - 1),
      y3_2: 1.445305721320277 * z * (x2 - y2),
      y3_3: 0.5900435899266435 * x * (x2 - 3 * y2),
    };
  }

  /**
   * GLSL source code defining Cartesian Spherical Harmonics for shaders.
   */
  public static getGLSLDefinition(): string {
    return `
      vec4 evalSH_L0_L1(vec3 n) {
        return vec4(
          0.28209479177387814,
          0.4886025119029199 * n.y,
          0.4886025119029199 * n.z,
          0.4886025119029199 * n.x
        );
      }

      void evalSH_L2(vec3 n, out float Y2[5]) {
        float xy = n.x * n.y;
        float yz = n.y * n.z;
        float xz = n.x * n.z;
        float z2 = n.z * n.z;
        float x2_y2 = n.x * n.x - n.y * n.y;

        Y2[0] = 1.0925484305920792 * xy;
        Y2[1] = 1.0925484305920792 * yz;
        Y2[2] = 0.3153915652525200 * (3.0 * z2 - 1.0);
        Y2[3] = 1.0925484305920792 * xz;
        Y2[4] = 0.5462742152960396 * x2_y2;
      }

      void evalSH_L3(vec3 n, out float Y3[7]) {
        float x = n.x, y = n.y, z = n.z;
        float x2 = x * x, y2 = y * y, z2 = z * z;

        Y3[0] = 0.5900435899266435 * y * (3.0 * x2 - y2);
        Y3[1] = 2.8906114426405540 * x * y * z;
        Y3[2] = 0.4570457994644658 * y * (5.0 * z2 - 1.0);
        Y3[3] = 0.3731763325901154 * z * (5.0 * z2 - 3.0);
        Y3[4] = 0.4570457994644658 * x * (5.0 * z2 - 1.0);
        Y3[5] = 1.4453057213202770 * z * (x2 - y2);
        Y3[6] = 0.5900435899266435 * x * (x2 - 3.0 * y2);
      }
    `;
  }
}
