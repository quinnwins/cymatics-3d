/**
 * formantCloudShader.ts
 * SoundForm 3D - 3D Formant Trajectory & Vowel Space Manifold Shaders
 *
 * Visualizes:
 * 1. 3D Formant Space (F1 x F2 x F3) with 20,000 Instanced Particle Sprites.
 * 2. Vowel Triangle Area (VSA) and Centralization towards neutral Schwa in Parkinsonian/dysphonic states.
 * 3. Dynamic Real-Time Trajectory Streamline Ribbon.
 * 4. Healthy Vowel Hull (Open Cyan Triangle) vs Pathological Warning Hull (Crimson Shrunk Sphere).
 */

export const FORMANT_CLOUD_VERTEX_SHADER = `
precision highp float;

attribute vec3  aInstanceFormant;  // Target (F1, F2, F3) in normalized [0, 1] space
attribute float aInstanceCPP;      // Cepstral Peak Prominence (dB)
attribute float aInstanceJitter;   // Frequency perturbation %
attribute float aInstanceCluster;  // 0=/i/, 1=/u/, 2=/a/, 3=Schwa

uniform float uTime;
uniform float uCentralization;      // 0.0 = Open Healthy, 1.0 = Centralized Parkinsonian
uniform float uTherapyStabilize;   // 0.0 = Chaotic, 1.0 = Entrained Harmonized

varying vec3  vFormantCoord;
varying float vCPP;
varying float vJitter;
varying float vCluster;

vec3 hash33(vec3 p) {
    p = fract(p * vec3(443.897, 441.423, 437.195));
    p += dot(p, p.yxz + 19.19);
    return fract((p.xxy + p.yxx) * p.zyx) * 2.0 - 1.0;
}

void main() {
    vCluster = aInstanceCluster;
    vCPP = aInstanceCPP;
    vJitter = aInstanceJitter;

    // 1. Pathological Centralization toward Neutral Schwa (0.5, 0.5, 0.5)
    vec3 schwaCenter = vec3(0.5, 0.5, 0.5);
    vec3 baseTarget = mix(aInstanceFormant, schwaCenter, uCentralization * 0.72);

    // 2. Chaotic Dysphonic Jitter & Shimmer Dispersion Cloud
    float dysphonicSpread = (1.0 - smoothstep(6.0, 18.0, aInstanceCPP)) * (1.0 + aInstanceJitter * 6.0);
    dysphonicSpread *= (1.0 - uTherapyStabilize * 0.85);

    vec3 randomDrift = hash33(aInstanceFormant * 133.7 + vec3(uTime * 0.4)) * dysphonicSpread * 0.12;
    
    // 3. Orbital Micro-Vortex dynamics around formant attractor
    float orbitSpeed = uTime * (2.0 + aInstanceCluster * 0.8);
    vec3 orbitOffset = vec3(
        sin(orbitSpeed + aInstanceFormant.x * 12.0) * 0.02,
        cos(orbitSpeed + aInstanceFormant.y * 12.0) * 0.02,
        sin(orbitSpeed * 1.4 + aInstanceFormant.z * 12.0) * 0.02
    ) * (1.0 + uTherapyStabilize * 0.5);

    vec3 finalFormantPos = (baseTarget + randomDrift + orbitOffset - vec3(0.5)) * 5.5;
    vFormantCoord = finalFormantPos;

    vec4 worldPos = modelMatrix * vec4(finalFormantPos, 1.0);
    vec4 mvPos = viewMatrix * worldPos;

    float pointScale = mix(24.0, 56.0, smoothstep(6.0, 20.0, aInstanceCPP));
    gl_PointSize = clamp((pointScale / max(-mvPos.z, 0.001)), 2.0, 64.0);

    gl_Position = projectionMatrix * mvPos;
}
`;

export const FORMANT_CLOUD_FRAGMENT_SHADER = `
precision highp float;

uniform float uTime;
uniform float uCentralization;
uniform float uTherapyStabilize;

varying vec3  vFormantCoord;
varying float vCPP;
varying float vJitter;
varying float vCluster;

void main() {
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float distSq = dot(p, p);
    if (distSq > 1.0) discard;

    float gaussian = exp(-distSq * 4.2);

    // Vowel Landmark Color Ramp: /i/ = Cyan, /u/ = Purple, /a/ = Emerald, Schwa = Amber
    vec3 c_i = vec3(0.0, 0.9, 1.0);
    vec3 c_u = vec3(0.5, 0.15, 0.95);
    vec3 c_a = vec3(0.05, 1.0, 0.5);
    vec3 c_schwa = vec3(1.0, 0.38, 0.1);

    vec3 vowelColor;
    if (vCluster < 0.8) {
        vowelColor = c_i;
    } else if (vCluster < 1.8) {
        vowelColor = c_u;
    } else if (vCluster < 2.8) {
        vowelColor = c_a;
    } else {
        vowelColor = c_schwa;
    }

    vowelColor = mix(vowelColor, c_schwa, uCentralization * 0.85);
    vec3 goldenMedicineColor = vec3(0.95, 0.85, 1.0);
    vowelColor = mix(vowelColor, goldenMedicineColor, uTherapyStabilize * 0.65);

    float coreSparkle = pow(gaussian, 3.0) * (1.5 + 0.5 * sin(uTime * 8.0 + vFormantCoord.x * 2.0));
    vec3 finalRgb = vowelColor * (gaussian * 1.8 + coreSparkle);
    float alpha = gaussian * clamp(vCPP / 18.0, 0.25, 0.95);

    gl_FragColor = vec4(finalRgb, alpha);
}
`;

export const FORMANT_HULL_VERTEX_SHADER = `
precision highp float;

varying vec3 vWorldNormal;
varying vec3 vWorldPos;
varying vec2 vUv;

void main() {
    vUv = uv;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

export const FORMANT_HULL_FRAGMENT_SHADER = `
precision highp float;

uniform float uTime;
uniform float uIsPathological;
uniform float uPulsingWarning;
uniform vec3  uCameraPosition;

varying vec3 vWorldNormal;
varying vec3 vWorldPos;
varying vec2 vUv;

void main() {
    vec3 N = normalize(vWorldNormal);
    vec3 V = normalize(uCameraPosition - vWorldPos);
    float fresnel = pow(1.0 - max(dot(N, V), 0.0), 3.0);

    vec2 grid = abs(fract(vUv * 16.0 - 0.5) - 0.5) / max(fwidth(vUv * 16.0), vec2(0.001));
    float line = 1.0 - min(min(grid.x, grid.y), 1.0);

    vec3 healthyColor = vec3(0.0, 0.9, 0.8);
    vec3 warningColor = vec3(1.0, 0.15, 0.35);

    vec3 baseColor = mix(healthyColor, warningColor, uIsPathological);
    float pulse = 1.0 + 0.4 * sin(uTime * 6.0) * uPulsingWarning;
    vec3 emissive = baseColor * (fresnel * 1.8 + line * 2.2) * pulse;

    float alpha = clamp(fresnel * 0.55 + line * 0.65, 0.0, 0.85);
    gl_FragColor = vec4(emissive, alpha);
}
`;
