/**
 * therapyInterferenceShader.ts
 * SoundForm 3D - Dual-Wave Interference, Active Phase Cancellation & Time-Reversal Beam Shaders
 *
 * Features:
 * - Real-time 3D wave collision plane showing constructive vs destructive interference (p1 + p2).
 * - Anti-phase cancellation: dynamic flatline silencing at Delta_phi = pi (180 deg).
 * - Time-Reversal Acoustic Beam (Converging phase-conjugate cone onto target coordinate).
 */

export const THERAPY_WAVE_INTERFERENCE_VERTEX_SHADER = `
precision highp float;

uniform float uTime;
uniform float uFrequency;
uniform float uPhaseOffsetRad;      // Delta_phi (0 -> 2pi)
uniform float uAmplitudePrimary;    // Chaotic cancer wave amplitude
uniform float uAmplitudeTherapy;    // Therapeutic wave amplitude
uniform int   uIsAntiPhaseActive;   // 1 = forced 180 deg anti-phase

varying vec2 vUv;
varying vec3 vWorldPosition;
varying float vNetPressure;
varying float vConstructiveIntensity;

#define PI 3.1415926535897932384626433832795

void main() {
    vUv = uv;
    vec3 pos = position;

    // Coordinate mapping [-1, 1] across plane
    float x = pos.x;
    float z = pos.z;

    // Wavenumbers for incident and therapeutic waves
    float k = 4.0;
    float omega = uFrequency * 0.05;

    // Primary chaotic cancer wave (radiating from left / center)
    float r1 = length(vec2(x + 2.5, z));
    float p1 = uAmplitudePrimary * cos(k * r1 - omega * uTime);

    // Therapeutic anti-phase beam (radiating from right)
    float r2 = length(vec2(x - 2.5, z));
    float phaseShift = (uIsAntiPhaseActive == 1) ? PI : uPhaseOffsetRad;
    float p2 = uAmplitudeTherapy * cos(k * r2 - omega * uTime + phaseShift);

    // Total Superposition Pressure Field
    float pNet = p1 + p2;
    vNetPressure = pNet;
    vConstructiveIntensity = abs(pNet) / max(0.01, uAmplitudePrimary + uAmplitudeTherapy);

    // Dynamic vertical displacement of the wave surface
    pos.y += pNet * 0.45;

    vec4 worldPos = modelMatrix * vec4(pos, 1.0);
    vWorldPosition = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

export const THERAPY_WAVE_INTERFERENCE_FRAGMENT_SHADER = `
precision highp float;

uniform float uTime;
uniform vec3 uCameraPosition;
uniform int uIsAntiPhaseActive;

varying vec2 vUv;
varying vec3 vWorldPosition;
varying float vNetPressure;
varying float vConstructiveIntensity;

void main() {
    float netAmp = abs(vNetPressure);

    // Colors:
    // Destructive Nodal Zone (Quiet): Translucent deep emerald/slate
    // Constructive Peaks: Luminous Electric Cyan / Gold
    // Anti-Phase Active Glow: Pristine calming cyan sheen
    vec3 quietColor = vec3(0.02, 0.15, 0.22);
    vec3 peakCyan = vec3(0.0, 0.9, 1.0);
    vec3 peakGold = vec3(1.0, 0.75, 0.2);

    vec3 waveColor = mix(quietColor, mix(peakCyan, peakGold, sin(vNetPressure * 3.0) * 0.5 + 0.5), vConstructiveIntensity);

    // Nodal grid lines
    float grid = step(0.96, fract(vUv.x * 24.0)) + step(0.96, fract(vUv.y * 24.0));
    waveColor += vec3(grid * 0.12);

    float alpha = clamp(0.25 + vConstructiveIntensity * 0.65, 0.15, 0.92);

    if (uIsAntiPhaseActive == 1 && netAmp < 0.15) {
        // Glowing peaceful aura along the silenced nodal plane
        waveColor = mix(waveColor, vec3(0.0, 1.0, 0.8), 0.6);
        alpha = 0.4;
    }

    gl_FragColor = vec4(waveColor, alpha);
}
`;

export const TIME_REVERSAL_BEAM_VERTEX_SHADER = `
precision highp float;

uniform float uTime;
uniform float uBeamIntensity;

varying vec2 vUv;
varying vec3 vWorldPosition;

void main() {
    vUv = uv;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

export const TIME_REVERSAL_BEAM_FRAGMENT_SHADER = `
precision highp float;

uniform float uTime;
uniform vec3 uCameraPosition;
uniform float uBeamIntensity;

varying vec2 vUv;
varying vec3 vWorldPosition;

void main() {
    // Cone coordinate: vUv.y = 0 (base) -> 1 (focal apex at tumor)
    float travelingPhase = fract(vUv.y * 8.0 - uTime * 4.0);
    float pulse = smoothstep(0.0, 0.2, travelingPhase) * (1.0 - smoothstep(0.2, 0.8, travelingPhase));

    // Focal concentration intensification toward apex
    float focalGlow = pow(vUv.y, 2.5) * 2.5;

    vec3 beamColor = mix(vec3(0.0, 0.8, 1.0), vec3(1.0, 0.85, 0.3), vUv.y);
    vec3 finalRgb = beamColor * (focalGlow + pulse * 1.5) * uBeamIntensity;

    float alpha = clamp((focalGlow * 0.4 + pulse * 0.35) * uBeamIntensity, 0.0, 0.95);
    gl_FragColor = vec4(finalRgb, alpha);
}
`;
