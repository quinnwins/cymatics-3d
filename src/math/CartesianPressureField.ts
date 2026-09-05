/** The existing cube trap field, in normalized chamber coordinates [-1, 1].
 * This is a model field amplitude, not calibrated pressure in pascals. */
export function cartesianPressure(x: number, y: number, z: number,
  modes: readonly number[], bass: number, lowMid: number): number {
  const c = (u: number, m: number) => Math.cos(u * m * Math.PI / 2);
  return c(x, modes[0]) * c(y, modes[1]) * c(z, modes[2])
    - (0.55 + 0.35 * bass) * c(x, modes[1]) * c(y, modes[2]) * c(z, modes[0])
    + (0.35 + 0.45 * lowMid) * c(x, modes[2]) * c(y, modes[0]) * c(z, modes[1]);
}

export function sampleCartesianPressure(size: number, modes: readonly number[], bass: number, lowMid: number): Float32Array {
  const cosines = modes.map(mode => Float64Array.from({ length: size }, (_, i) => Math.cos((2 * i / (size - 1) - 1) * mode * Math.PI / 2)));
  const [a, b, c] = cosines;
  const result = new Float32Array(size ** 3);
  const w2 = -(0.55 + 0.35 * bass), w3 = 0.35 + 0.45 * lowMid;
  let i = 0;
  for (let z = 0; z < size; z++) for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    result[i++] = a[x] * b[y] * c[z] + w2 * b[x] * c[y] * a[z] + w3 * c[x] * a[y] * b[z];
  }
  return result;
}

// Shared verbatim with the original live GPU particle field. Keep CPU and GLSL
// parity covered by numerical tests and a real GPU readback during verification.
export const CARTESIAN_PRESSURE_GLSL = `
// Single-Pass Analytical 3D Cartesian Acoustic Cavity Pressure & Gradient
vec3 evalCartesianGradAndPressure(vec3 p, vec3 nml, float L, out float pressure) {
    vec3 k = (nml * PI) / (2.0 * L);
    float cX = cos(k.x * p.x); float sX = sin(k.x * p.x);
    float cY = cos(k.y * p.y); float sY = sin(k.y * p.y);
    float cZ = cos(k.z * p.z); float sZ = sin(k.z * p.z);

    float cX2 = cos(k.y * p.x); float sX2 = sin(k.y * p.x);
    float cY2 = cos(k.z * p.y); float sY2 = sin(k.z * p.y);
    float cZ2 = cos(k.x * p.z); float sZ2 = sin(k.x * p.z);

    float cX3 = cos(k.z * p.x); float sX3 = sin(k.z * p.x);
    float cY3 = cos(k.x * p.y); float sY3 = sin(k.x * p.y);
    float cZ3 = cos(k.y * p.z); float sZ3 = sin(k.y * p.z);

    float w1 = 1.0;
    float w2 = 0.55 + 0.35 * uBandEnergies.y;
    float w3 = 0.35 + 0.45 * uBandEnergies.z;

    pressure = w1 * (cX * cY * cZ) - w2 * (cX2 * cY2 * cZ2) + w3 * (cX3 * cY3 * cZ3);

    vec3 g1 = vec3(-k.x * sX * cY * cZ, -k.y * cX * sY * cZ, -k.z * cX * cY * sZ);
    vec3 g2 = vec3(-k.y * sX2 * cY2 * cZ2, -k.z * cX2 * sY2 * cZ2, -k.x * cX2 * cY2 * sZ2);
    vec3 g3 = vec3(-k.z * sX3 * cY3 * cZ3, -k.x * cX3 * sY3 * cZ3, -k.y * cX3 * cY3 * sZ3);

    return w1 * g1 - w2 * g2 + w3 * g3;
}

`;
