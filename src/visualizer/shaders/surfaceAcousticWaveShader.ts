/**
 * surfaceAcousticWaveShader.ts
 * SoundForm 3D - Standing & Traveling Surface Acoustic Wave (SSAW) Visual Indicator
 * Simulates piezoelectric LiNbO3 substrate Rayleigh wave interference across the fluid microchannel.
 */

export const SAW_VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldPosition;

  void main() {
    vUv = uv;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

export const SAW_FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  uniform float uTime;
  uniform float uFrequency;        // Acoustic frequency downmix
  uniform float uAcousticPower;    // Radiation intensity (0.1 - 3.0x)
  uniform float uNodeCount;        // Number of standing wave nodes across channel
  uniform vec3 uNodeColor;         // Emerald / Cyan for Pressure Nodes
  uniform vec3 uAntinodeColor;     // Magenta / Rose for Pressure Antinodes
  uniform vec3 uIdtGlowColor;      // Gold / Amber for IDT Transducer crests

  varying vec2 vUv;
  varying vec3 vWorldPosition;

  #define PI 3.1415926535897932384626433832795

  void main() {
    // Coordinate mapping: u in [0, 1] across channel transverse width (X-axis)
    float x = (vUv.x - 0.5) * 8.0; // [-4.0, +4.0] units
    float z = (vUv.y - 0.5) * 16.0; // [-8.0, +8.0] units

    // Active acoustic cavity zone: z in [-4.0, +4.0]
    float acousticZone = 1.0 - smoothstep(3.5, 4.5, abs(z));

    float k = (uNodeCount * PI) / 8.0;
    float omega = uFrequency * 0.04;

    // Two counter-propagating Rayleigh surface acoustic waves from Left & Right IDTs
    float waveLeft = cos(k * (x + 4.0) - omega * uTime);
    float waveRight = cos(k * (4.0 - x) - omega * uTime);
    
    // Standing wave interference profile: P(x) = cos(kx) * cos(omega*t)
    float standingPressure = (waveLeft + waveRight) * 0.5;
    float pressureIntensity = abs(standingPressure) * uAcousticPower;

    // Pressure Nodes: standingPressure ~ 0 (Kinetic trapping line where healthy cells gather)
    // Pressure Antinodes: |standingPressure| ~ max (Expulsion zones for cancer cells)
    float nodeProximity = 1.0 - smoothstep(0.0, 0.40, abs(standingPressure));
    float antinodeProximity = smoothstep(0.45, 1.0, abs(standingPressure));

    // IDT Acoustic Emission wavefront streaks
    float idtWavefronts = sin(k * x * 2.0 - uTime * 4.0) * 0.5 + 0.5;
    
    // Channel edge attenuation (IDT boundary damping)
    float edgeFade = smoothstep(0.0, 0.06, vUv.x) * (1.0 - smoothstep(0.94, 1.0, vUv.x));
    float flowFade = smoothstep(0.0, 0.04, vUv.y) * (1.0 - smoothstep(0.96, 1.0, vUv.y));

    // Color compositing
    vec3 col = mix(vec3(0.01, 0.03, 0.06), uNodeColor, nodeProximity * 0.75);
    col = mix(col, uAntinodeColor, antinodeProximity * 0.85 * uAcousticPower);
    col += uIdtGlowColor * idtWavefronts * 0.22 * uAcousticPower;

    // Centerline Acoustic Node Guide Glow
    float centerNodeGuide = 1.0 - smoothstep(0.0, 0.06, abs(vUv.x - 0.5));
    col += uNodeColor * centerNodeGuide * 0.5;

    float alpha = (0.20 + pressureIntensity * 0.40 + centerNodeGuide * 0.25) * edgeFade * flowFade * (0.35 + 0.65 * acousticZone);

    gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.85));
  }
`;
