/**
 * sonodynamicCavitationShader.ts
 * SoundForm 3D - Sonoluminescence Flash & Singlet Oxygen (1O2) Reactive GPU Shaders
 *
 * Features:
 * - Adiabatic cavitation collapse with >5,000 K Bremsstrahlung flash.
 * - Reactive Oxygen Species (1O2, .OH) particle dispersion with phosphorescent color transitions.
 */

export const CAVITATION_FLASH_VERTEX_SHADER = `
precision highp float;

uniform float uTime;
uniform float uFlashProgress; // 0.0 = Start of collapse, 1.0 = Fully dissipated
uniform float uShockwaveRadius;

varying vec3 vWorldPosition;
varying vec3 vWorldNormal;
varying float vFlashIntensity;

void main() {
    float expansion = pow(clamp(uFlashProgress, 0.0, 1.0), 0.35) * uShockwaveRadius;
    vec3 displacedPos = position * (0.05 + expansion);

    vec4 worldPos = modelMatrix * vec4(displacedPos, 1.0);
    vWorldPosition = worldPos.xyz;
    vWorldNormal = normalize(normalMatrix * normal);

    vFlashIntensity = exp(-uFlashProgress * 6.5) * smoothstep(0.0, 0.05, uFlashProgress);

    gl_Position = projectionMatrix * modelViewMatrix * vec4(displacedPos, 1.0);
}
`;

export const CAVITATION_FLASH_FRAGMENT_SHADER = `
precision highp float;

uniform float uFlashProgress;
uniform vec3  uCameraPosition;
uniform vec3  uSonoluminescenceColor; // Luminous Blue/Violet
uniform vec3  uHotCoreColor;           // Overdriven white-violet

varying vec3 vWorldPosition;
varying vec3 vWorldNormal;
varying float vFlashIntensity;

void main() {
    vec3 N = normalize(vWorldNormal);
    vec3 V = normalize(uCameraPosition - vWorldPosition);

    float nDotV = clamp(dot(N, V), 0.0, 1.0);
    float rimShock = pow(1.0 - nDotV, 3.5);

    vec3 flashRgb = mix(uSonoluminescenceColor, uHotCoreColor, vFlashIntensity * 1.4);
    flashRgb += rimShock * uSonoluminescenceColor * 3.0;

    vec3 finalColor = flashRgb * (vFlashIntensity * 5.0 + rimShock * 2.0);
    float alpha = clamp((vFlashIntensity * 0.95 + rimShock * 0.75) * exp(-uFlashProgress * 3.0), 0.0, 1.0);

    gl_FragColor = vec4(finalColor, alpha);
}
`;

export const SINGLET_OXYGEN_PARTICLE_VERTEX_SHADER = `
precision highp float;

uniform float uTime;
uniform float uSystemAge;       // Normalized age of current burst
uniform float uSingletLifetime; // Physical decay constant
uniform float uParticleBaseSize;

attribute vec3 aInitialVelocity;
attribute float aBirthTime;
attribute float aRandomSeed;

varying vec4 vRosColor;
varying float vOxidativeActivity;

vec3 hash33(vec3 p) {
    p = fract(p * vec3(0.1031, 0.1030, 0.0973));
    p += dot(p, p.yxz + 33.33);
    return fract((p.xxy + p.yxx) * p.zyx) * 2.0 - 1.0;
}

void main() {
    float age = uSystemAge - aBirthTime;
    if (age < 0.0 || age > uSingletLifetime) {
        gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
        gl_PointSize = 0.0;
        return;
    }

    float normAge = age / uSingletLifetime; // 0.0 (nascent) -> 1.0 (quenched)

    float drag = exp(-normAge * 4.0);
    vec3 turbulentDrift = hash33(position * 3.0 + vec3(uTime * 0.4, aRandomSeed, 0.0)) * 0.35;
    vec3 currentPos = position + (aInitialVelocity * (1.0 - drag) * 0.6) + turbulentDrift * normAge;

    vec3 nascentColor = vec3(0.15, 0.9, 1.0);
    vec3 excitedColor = vec3(0.95, 0.2, 0.85);
    vec3 quenchedColor = vec3(0.3, 0.05, 0.4);

    vec3 rosRgb;
    if (normAge < 0.35) {
        rosRgb = mix(nascentColor, excitedColor, normAge / 0.35);
    } else {
        rosRgb = mix(excitedColor, quenchedColor, (normAge - 0.35) / 0.65);
    }

    vOxidativeActivity = exp(-normAge * 3.2);
    float alpha = exp(-normAge * 2.5) * (0.3 + vOxidativeActivity * 0.7);
    vRosColor = vec4(rosRgb * (1.0 + vOxidativeActivity * 2.5), alpha);

    vec4 mvPosition = modelViewMatrix * vec4(currentPos, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    float pSize = (uParticleBaseSize + vOxidativeActivity * 4.5) * (140.0 / -mvPosition.z);
    gl_PointSize = clamp(pSize, 1.5, 48.0);
}
`;

export const SINGLET_OXYGEN_PARTICLE_FRAGMENT_SHADER = `
precision highp float;

varying vec4 vRosColor;
varying float vOxidativeActivity;

void main() {
    vec2 coord = gl_PointCoord - vec2(0.5);
    float distSq = dot(coord, coord);
    if (distSq > 0.25) discard;

    float corona = exp(-distSq * 16.0);
    float hotCore = smoothstep(0.06, 0.0, distSq) * (1.0 + vOxidativeActivity * 3.0);

    vec3 finalRgb = vRosColor.rgb * corona + vec3(hotCore * 0.8);
    float finalAlpha = corona * vRosColor.a;

    gl_FragColor = vec4(finalRgb, finalAlpha);
}
`;
