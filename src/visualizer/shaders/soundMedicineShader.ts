/**
 * soundMedicineShader.ts
 * SoundForm 3D - Restorative Bio-Acoustic Sound Medicine Hologram Shaders
 *
 * Implements:
 * 1. Logarithmic Golden Ratio (Phi = 1.618) Toroidal Waveguide with Solfeggio standing wave fringes.
 * 2. Entrainment stream particles guiding chaotic vocal jitter into coherent harmonic resonance.
 * 3. Chromatic Fresnel dispersion and crystalline laser caustic flare.
 */

export const SOUND_MEDICINE_HOLOGRAM_VERTEX_SHADER = `
precision highp float;

uniform float uTime;
uniform float uFieldExpansion;
uniform float uEntrainmentPhase;
uniform float uGoldenSpiralTorsion;

varying vec3  vWorldPos;
varying vec3  vWorldNormal;
varying vec2  vUv;
varying float vPhyllotaxisPhase;
varying float vHarmonicWave;

#define PHI 1.618033988749895
#define PI 3.14159265358979323846

void main() {
    vUv = uv;

    // 1. Logarithmic Golden Ratio Phyllotaxis Coordinate Mapping
    float theta = uv.x * 2.0 * PI;
    float phi = uv.y * PI;
    float phyllotaxisAngle = theta * PHI * uGoldenSpiralTorsion;
    vPhyllotaxisPhase = phyllotaxisAngle;

    // 2. Standing Wave Toroidal & Spherical Harmonic Deformation
    float waveK = 6.0;
    float waveSpeed = uTime * 4.5;
    
    float harmonic1 = sin(waveK * phi - waveSpeed) * cos(3.0 * theta);
    float harmonic2 = sin(waveK * 1.618 * phi + waveSpeed * 1.618) * sin(5.0 * theta);
    float standingWave = (harmonic1 * 0.6 + harmonic2 * 0.4) * uEntrainmentPhase;
    vHarmonicWave = standingWave;

    // 3. Golden Spiral Toroidal Manifold Morphing
    float rTorusMajor = 2.4 * uFieldExpansion;
    float rTorusMinor = (0.8 + 0.25 * standingWave) * uFieldExpansion;

    vec3 torusPos = vec3(
        (rTorusMajor + rTorusMinor * cos(phi + phyllotaxisAngle * 0.1)) * cos(theta),
        rTorusMinor * sin(phi + phyllotaxisAngle * 0.1) * 1.25,
        (rTorusMajor + rTorusMinor * cos(phi + phyllotaxisAngle * 0.1)) * sin(theta)
    );

    vec4 worldPos = modelMatrix * vec4(torusPos, 1.0);
    vWorldPos = worldPos.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);

    gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

export const SOUND_MEDICINE_HOLOGRAM_FRAGMENT_SHADER = `
precision highp float;

uniform float uTime;
uniform float uTherapyCoherence;   // 0.0 = Off, 1.0 = Pure Coherence
uniform vec3  uResonanceColorA;    // Aquamarine
uniform vec3  uResonanceColorB;    // Gold
uniform vec3  uResonanceColorC;    // Violet
uniform vec3  uCameraPosition;

varying vec3  vWorldPos;
varying vec3  vWorldNormal;
varying vec2  vUv;
varying float vPhyllotaxisPhase;
varying float vHarmonicWave;

#define PHI 1.618033988749895
#define PI 3.14159265358979323846

void main() {
    vec3 N = length(vWorldNormal) > 1e-5 ? normalize(vWorldNormal) : vec3(0.0, 1.0, 0.0);
    vec3 toCam = uCameraPosition - vWorldPos;
    vec3 V = length(toCam) > 1e-5 ? normalize(toCam) : vec3(0.0, 0.0, 1.0);

    // 1. Chromatic Fresnel Optical Dispersion (symmetric for double-sided translucent membrane)
    float NdotV = clamp(abs(dot(N, V)), 0.0, 1.0);
    float fresnel = pow(clamp(1.0 - NdotV, 0.0, 1.0), 2.8);

    // 2. Golden Spiral Interference Caustic Contours
    float spiralCoord = vUv.x * 24.0 * PHI - vUv.y * 12.0 - uTime * 2.2;
    float causticPattern = pow(0.5 + 0.5 * sin(spiralCoord), 6.0);

    // 3. Volumetric Acoustic Standing Wave Nodal Interference Rings
    float standingFringe = pow(0.5 + 0.5 * cos(vHarmonicWave * PI * 3.0), 4.0);

    // 4. Multi-Wavelength Holographic Tri-Color Blend
    vec3 waveColor = mix(uResonanceColorA, uResonanceColorB, 0.5 + 0.5 * sin(vPhyllotaxisPhase + uTime));
    waveColor = mix(waveColor, uResonanceColorC, fresnel);

    // 5. Coherent Laser Crystal Resonance Peak
    vec3 causticGlow = uResonanceColorB * causticPattern * 3.5 * uTherapyCoherence;
    vec3 standingGlow = uResonanceColorA * standingFringe * 2.0;
    vec3 rimGlow = waveColor * fresnel * 2.5;

    vec3 finalColor = waveColor * 0.35 + causticGlow + standingGlow + rimGlow;

    float scanline = 0.85 + 0.15 * sin(vWorldPos.y * 80.0 - uTime * 15.0);
    finalColor *= scanline;

    float alpha = clamp((fresnel * 0.75 + causticPattern * 0.55 + standingFringe * 0.45) * uTherapyCoherence, 0.0, 0.95);

    gl_FragColor = vec4(finalColor, alpha);
}
`;

export const GOLDEN_SPIRAL_FRAGMENT_SHADER = `
precision highp float;

uniform float uTime;
uniform float uEntrainmentSpeed;
uniform vec3  uStreamColor;

varying float vProgress;

void main() {
    float flow = fract(vProgress * 8.0 - uTime * uEntrainmentSpeed);
    float packet = smoothstep(0.0, 0.2, flow) * (1.0 - smoothstep(0.4, 1.0, flow));

    vec3 color = uStreamColor * (packet * 2.5 + 0.35);
    float alpha = packet * 0.85;

    gl_FragColor = vec4(color, alpha);
}
`;
