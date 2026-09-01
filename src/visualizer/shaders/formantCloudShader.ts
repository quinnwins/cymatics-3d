/**
 * formantCloudShader.ts
 * SoundForm 3D - 3D Formant Trajectory & IPA Vowel Quadrangle Manifold Shaders
 *
 * Visualizes:
 * 1. 3D Formant Space (F1 x F2 x F3 on Traunmüller Bark scale) with 15,000 Instanced Particle Sprites.
 * 2. 7 Calibrated IPA Vowel Clusters: /i/, /u/, /ɑ/, /æ/, /ɔ/, /ɛ/, /ə/ (Schwa).
 * 3. Acoustic Vowel Centralization (FCR) morphing towards neutral Schwa centroid.
 * 4. Floor Projection Shader with Bark Grid & Active Quadrant Luminescence.
 */

export const FORMANT_CLOUD_VERTEX_SHADER = `
precision highp float;

attribute vec3  aInstanceFormant;  // Target (F1, F2, F3) in Traunmüller Bark 3D space
attribute float aInstanceCPP;      // Cepstral Peak Prominence (dB)
attribute float aInstanceJitter;   // Frequency perturbation %
attribute float aInstanceCluster;  // 0=/i/, 1=/u/, 2=/ɑ/, 3=/æ/, 4=/ɔ/, 5=/ɛ/, 6=/ə/ (Schwa)

uniform float uTime;
uniform float uCentralization;      // 0.0 = Open Healthy, 1.0 = Centralized Pathological (FCR)
uniform float uTherapyStabilize;   // 0.0 = Natural, 1.0 = Stabilized

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

    // 1. Pathological Centralization toward Neutral Schwa Centroid (0.30, 0.03, -0.17)
    vec3 schwaCenter = vec3(0.30, 0.03, -0.17);
    vec3 baseTarget = mix(aInstanceFormant, schwaCenter, uCentralization * 0.75);

    // 2. Perturbation Dispersion Cloud (Jitter / Shimmer / Low CPP)
    float dysphonicSpread = (1.0 - smoothstep(6.0, 18.0, aInstanceCPP)) * (1.0 + aInstanceJitter * 5.0);
    dysphonicSpread *= (1.0 - uTherapyStabilize * 0.85);

    vec3 randomDrift = hash33(aInstanceFormant * 133.7 + vec3(uTime * 0.35)) * dysphonicSpread * 0.15;

    // 3. Subtle micro-orbital respiration dynamics
    float orbitSpeed = uTime * (1.8 + aInstanceCluster * 0.4);
    vec3 orbitOffset = vec3(
        sin(orbitSpeed + aInstanceFormant.x * 8.0) * 0.025,
        cos(orbitSpeed + aInstanceFormant.y * 8.0) * 0.025,
        sin(orbitSpeed * 1.3 + aInstanceFormant.z * 8.0) * 0.025
    );

    vec3 finalFormantPos = baseTarget + randomDrift + orbitOffset;
    vFormantCoord = finalFormantPos;

    vec4 worldPos = modelMatrix * vec4(finalFormantPos, 1.0);
    vec4 mvPos = viewMatrix * worldPos;

    float pointScale = mix(28.0, 60.0, smoothstep(6.0, 20.0, aInstanceCPP));
    gl_PointSize = clamp((pointScale / max(-mvPos.z, 0.001)), 2.5, 48.0);

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

    float gaussian = exp(-distSq * 4.5);

    // 7 Calibrated IPA Cardinal Vowel Color Palette
    vec3 c_i   = vec3(0.00, 0.90, 1.00); // /i/ (Close Front) - Electric Cyan
    vec3 c_u   = vec3(0.55, 0.20, 0.95); // /u/ (Close Back) - Royal Violet
    vec3 c_a   = vec3(1.00, 0.72, 0.10); // /ɑ/ (Open Back) - Radiant Amber
    vec3 c_ae  = vec3(0.05, 0.90, 0.45); // /æ/ (Near-Open Front) - Emerald Green
    vec3 c_open_o = vec3(0.95, 0.45, 0.10); // /ɔ/ (Open-Mid Back) - Warm Tangerine
    vec3 c_open_e = vec3(0.15, 0.75, 0.95); // /ɛ/ (Open-Mid Front) - Sky Blue
    vec3 c_schwa  = vec3(1.00, 0.28, 0.35); // /ə/ (Central Schwa) - Coral Ruby

    vec3 vowelColor = c_schwa;
    if (vCluster < 0.5) {
        vowelColor = c_i;
    } else if (vCluster < 1.5) {
        vowelColor = c_u;
    } else if (vCluster < 2.5) {
        vowelColor = c_a;
    } else if (vCluster < 3.5) {
        vowelColor = c_ae;
    } else if (vCluster < 4.5) {
        vowelColor = c_open_o;
    } else if (vCluster < 5.5) {
        vowelColor = c_open_e;
    } else {
        vowelColor = c_schwa;
    }

    // Pathological Dysphonia Color Shift (Desaturation toward dull grey-crimson)
    vec3 pathologicalColor = vec3(0.75, 0.35, 0.40);
    float pathologyFactor = clamp((1.0 - smoothstep(7.0, 16.0, vCPP)) + vJitter * 2.0, 0.0, 1.0);
    vec3 finalRgb = mix(vowelColor, pathologicalColor, pathologyFactor * 0.75);

    // Alpha modulation based on CPP clarity
    float alpha = gaussian * mix(0.40, 0.92, smoothstep(6.0, 18.0, vCPP));

    gl_FragColor = vec4(finalRgb, alpha);
}
`;

export const FLOOR_GRID_VERTEX_SHADER = `
precision highp float;
varying vec2 vUv;
varying vec3 vWorldPos;

void main() {
    vUv = uv;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

export const FLOOR_GRID_FRAGMENT_SHADER = `
precision highp float;

uniform vec2  uSpeakerF1F2Projected; // (X, Z) normalized floor coordinates
uniform float uVoiceEnergy;          // 0.0 (silent) to 1.0 (voicing)
uniform float uTime;

varying vec2 vUv;
varying vec3 vWorldPos;

void main() {
    vec2 pos = (vUv - 0.5) * 4.8;

    // 1. Procedural Grid Lines
    vec2 gridCoord = abs(fract(pos * 2.0 - 0.5) - 0.5) / fwidth(pos * 2.0);
    float gridLine = 1.0 - min(min(gridCoord.x, gridCoord.y), 1.0);

    // 2. Quadrant Axes
    float axisX = 1.0 - min(abs(pos.x) / fwidth(pos.x), 1.0);
    float axisZ = 1.0 - min(abs(pos.y) / fwidth(pos.y), 1.0);

    // 3. Live Speaker Formant Locus Luminescence
    float distToSpeaker = length(pos - uSpeakerF1F2Projected);
    float activeLocus = exp(-distToSpeaker * distToSpeaker * 3.5) * uVoiceEnergy;

    // 4. Quadrant Color Assignment
    vec3 qColor = vec3(0.0, 0.85, 1.0); // Q1: Close-Front (/i/)
    if (uSpeakerF1F2Projected.x < 0.0 && uSpeakerF1F2Projected.y > 0.0) {
        qColor = vec3(0.55, 0.20, 0.95); // Q2: Close-Back (/u/)
    } else if (uSpeakerF1F2Projected.x < 0.0 && uSpeakerF1F2Projected.y <= 0.0) {
        qColor = vec3(1.00, 0.72, 0.10); // Q3: Open-Back (/ɑ/)
    } else if (uSpeakerF1F2Projected.x >= 0.0 && uSpeakerF1F2Projected.y <= 0.0) {
        qColor = vec3(0.05, 0.90, 0.45); // Q4: Open-Front (/æ/)
    }

    vec3 baseColor = vec3(0.03, 0.08, 0.14);
    vec3 finalColor = baseColor + vec3(0.0, 0.45, 0.75) * (gridLine * 0.18 + (axisX + axisZ) * 0.35);
    finalColor += qColor * (activeLocus * (1.8 + 0.3 * sin(uTime * 8.0)));

    float alpha = clamp(0.12 + activeLocus * 0.75 + (axisX + axisZ) * 0.2, 0.0, 0.92);
    gl_FragColor = vec4(finalColor, alpha);
}
`;
