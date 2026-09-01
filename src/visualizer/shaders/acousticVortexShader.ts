/**
 * acousticVortexShader.ts
 * SoundForm 3D - Acoustic Orbital Angular Momentum (OAM) & Helical Vortex Wave Shaders
 *
 * Features:
 * - Helical phase wavefronts with topological charge l in {1, 2, 3}.
 * - Central phase singularity null core (p = 0 on axis).
 * - Bessel-Gauss radial amplitude envelope.
 * - Dynamic radiation torque shear displacement.
 */

export const ACOUSTIC_VORTEX_VERTEX_SHADER = `
precision highp float;

uniform float uTime;
uniform float uTopologicalCharge; // l = 1.0, 2.0, 3.0
uniform float uAcousticFrequency;  // Driving frequency omega
uniform float uWavenumberZ;        // kz propagation constant
uniform float uBeamWaist;          // w0
uniform float uHelicalAmplitude;   // Displacement amplitude
uniform float uAudioEnergy;

varying vec3 vWorldPosition;
varying vec3 vWorldNormal;
varying vec2 vUv;
varying float vPhase;
varying float vRadialDist;
varying float vAcousticIntensity;

#define TWO_PI 6.2831853071795864769252867665590

void main() {
    vUv = uv;
    vec3 pos = position;

    float r = length(pos.xy);
    float theta = atan(pos.y, pos.x);
    float z = pos.z;

    vRadialDist = r;

    // Helical Phase Calculation: Phi = l * theta - kz * z - omega * t
    float omega = uAcousticFrequency * 0.05;
    float phase = uTopologicalCharge * theta - uWavenumberZ * z - omega * uTime;
    vPhase = fract(phase / TWO_PI);

    // Laguerre-Gaussian / Bessel Radial Amplitude Envelope
    float normR = r / max(uBeamWaist, 0.001);
    float radialAmp = pow(normR, abs(uTopologicalCharge)) * exp(-normR * normR * 0.8);

    // Acoustic Pressure Amplitude & Displacement
    float pressureWave = radialAmp * cos(phase);
    vAcousticIntensity = abs(pressureWave);

    vec2 radialDir = r > 0.001 ? pos.xy / r : vec2(1.0, 0.0);
    float displacement = pressureWave * uHelicalAmplitude * (1.0 + uAudioEnergy * 1.5);
    
    pos.xy += radialDir * (displacement * 0.4);
    pos.z  += displacement * 0.6;

    vec4 worldPos = modelMatrix * vec4(pos, 1.0);
    vWorldPosition = worldPos.xyz;
    vWorldNormal = normalize(normalMatrix * normal);

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`;

export const ACOUSTIC_VORTEX_FRAGMENT_SHADER = `
precision highp float;

uniform float uTime;
uniform vec3  uCameraPosition;
uniform float uTopologicalCharge;
uniform vec3  uColorCore;
uniform vec3  uColorWavefront;
uniform float uPhaseContrast;
uniform float uBeamOpacity;
uniform float uFresnelPower;

varying vec3 vWorldPosition;
varying vec3 vWorldNormal;
varying vec2 vUv;
varying float vPhase;
varying float vRadialDist;
varying float vAcousticIntensity;

#define TWO_PI 6.2831853071795864769252867665590

vec3 phaseColorRamp(float t) {
    vec3 a = vec3(0.5, 0.5, 0.5);
    vec3 b = vec3(0.5, 0.5, 0.5);
    vec3 c = vec3(1.0, 1.0, 1.0);
    vec3 d = vec3(0.00, 0.33, 0.67);
    return a + b * cos(TWO_PI * (c * t + d));
}

void main() {
    vec3 N = normalize(vWorldNormal);
    vec3 V = normalize(uCameraPosition - vWorldPosition);

    float nDotV = clamp(dot(N, V), 0.0, 1.0);
    float fresnel = pow(1.0 - nDotV, uFresnelPower);

    vec3 phaseColor = phaseColorRamp(vPhase);
    float coreNullMask = smoothstep(0.05, 0.35, vRadialDist);
    
    float fringe = pow(0.5 + 0.5 * cos(vPhase * TWO_PI), uPhaseContrast);
    vec3 waveGlow = mix(uColorCore, uColorWavefront, fringe) * (1.0 + fringe * 2.0);

    vec3 finalRgb = mix(phaseColor * 0.8, waveGlow, vAcousticIntensity * 0.7);
    finalRgb *= coreNullMask;
    finalRgb += fresnel * uColorWavefront * 1.5;

    float alpha = clamp((vAcousticIntensity * 0.75 + fringe * 0.35 + fresnel * 0.5) * uBeamOpacity * coreNullMask, 0.0, 0.95);

    gl_FragColor = vec4(finalRgb, alpha);
}
`;
