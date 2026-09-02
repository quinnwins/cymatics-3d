import { CYMATICS_CORE_GLSL } from './cymaticsCore';

export const WAVEFRONT_VERTEX_SHADER = `
${CYMATICS_CORE_GLSL}

uniform float uTime;
uniform float uPropagationSpeed;
uniform float uHistoryHead;
uniform sampler2D uAudioHistory;
uniform vec4 uBandEnergies;
uniform vec2 uHighEnergies;
uniform vec4 uShockwaves[4];
uniform float uWaveDamping;

attribute float aShellIndex; // Concentric shell index [0..N-1]
attribute float aShellRadius;

varying vec3 vWorldNormal;
varying vec3 vLocalNormal;
varying vec3 vViewPosition;
varying vec2 vUv;
varying float vDisplacement;
varying float vRadius;
varying float vIntensity;

void main() {
    vUv = uv;
    vec3 basePos = position;
    float baseR = length(basePos);
    vec3 n = baseR > 1e-5 ? basePos / baseR : vec3(0.0, 1.0, 0.0);
    vLocalNormal = n;
    vRadius = baseR;

    // 1. Physical Retarded-Time lookup: tau = r / c
    float travelTime = baseR / max(uPropagationSpeed, 0.001);
    float historyRow = fract(uHistoryHead - travelTime * 0.15);

    // Map spherical coordinates (theta, phi) to frequency bin u in [0, 1]
    float freqU = clamp((n.y * 0.5 + 0.5) * 0.7 + (n.x * 0.5 + 0.5) * 0.3, 0.0, 1.0);
    vec4 audioSample = texture2D(uAudioHistory, vec2(freqU, historyRow));
    float spectralAmp = clamp(audioSample.r, 0.0, 10.0);

    // 2. Physical 3D Spherical Wave Propagation: (A/r) * exp(-alpha*r) * cos(kr - wt)
    float waveK = 3.14159 * (1.5 + freqU * 6.0);
    float wavePhase = waveK * baseR - uTime * 8.0 + audioSample.g * 6.28;
    float damping = exp(-uWaveDamping * baseR);
    float radialDisp = (spectralAmp / (0.8 + 0.35 * baseR)) * cos(wavePhase) * damping;

    // 3. Spherical Harmonics & Cymatic Deformation
    float cymaticsDisp = evaluateCymaticsDisplacement(
        basePos,
        uBandEnergies,
        uHighEnergies,
        1.5,
        uTime
    );

    // 4. Transient Shockwave Displacements
    float shockDisp = 0.0;
    for (int i = 0; i < 4; i++) {
        float birth = uShockwaves[i].x;
        float strength = uShockwaves[i].y;
        float speed = uShockwaves[i].z;
        if (birth > 0.0) {
            float dt = uTime - birth;
            if (dt >= 0.0 && dt < 4.0) {
                float frontR = speed * dt;
                float distFromFront = abs(baseR - frontR);
                float pulse = exp(-distFromFront * 3.5) * exp(-dt * 2.0) * strength;
                shockDisp += pulse * sin(distFromFront * 12.0 - dt * 15.0);
            }
        }
    }

    float totalDisp = radialDisp * 1.8 + cymaticsDisp * 1.2 + shockDisp * 2.5;
    vDisplacement = totalDisp;
    vIntensity = clamp(spectralAmp * 2.0 + abs(totalDisp) * 1.5, 0.0, 3.0);

    vec3 displacedPos = basePos + n * totalDisp;

    // Compute view position & normal
    vWorldNormal = normalize(normalMatrix * n);
    vec4 mvPosition = modelViewMatrix * vec4(displacedPos, 1.0);
    vViewPosition = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
}
`;

export const WAVEFRONT_FRAGMENT_SHADER = `
${CYMATICS_CORE_GLSL}

uniform float uTime;
uniform vec3 uPaletteA;
uniform vec3 uPaletteB;
uniform vec3 uPaletteC;
uniform vec3 uPaletteD;
uniform vec3 uCoreGlow;
uniform vec3 uAccent;
uniform vec4 uBandEnergies;

varying vec3 vWorldNormal;
varying vec3 vLocalNormal;
varying vec3 vViewPosition;
varying vec2 vUv;
varying float vDisplacement;
varying float vRadius;
varying float vIntensity;

void main() {
    vec3 N = length(vWorldNormal) > 1e-5 ? normalize(vWorldNormal) : vec3(0.0, 1.0, 0.0);
    vec3 V = length(vViewPosition) > 1e-5 ? normalize(vViewPosition) : vec3(0.0, 0.0, 1.0);

    // 1. 3D Spherical Coordinate Isobar Grid (Latitude, Longitude & Equator Radar Lines)
    float theta = acos(clamp(vLocalNormal.y, -1.0, 1.0)); // [0 .. PI]
    float phi = atan(vLocalNormal.z, vLocalNormal.x);      // [-PI .. PI]

    float latLines = abs(fract(theta / PI * 8.0) - 0.5);
    float lonLines = abs(fract(phi / TWO_PI * 12.0) - 0.5);
    float isobarGrid = smoothstep(0.40, 0.48, max(latLines, lonLines));
    float equatorGlow = smoothstep(0.05, 0.0, abs(vLocalNormal.y)) * 0.8;

    // 2. High-Frequency Traveling Acoustic Wave Pulse along Radial Direction
    float wavePhase = vRadius * 2.8 - uTime * 6.5 + vDisplacement * 2.0;
    float travelingCrest = pow(max(0.0, cos(wavePhase)), 8.0) * (0.4 + 1.2 * vIntensity);

    // 3. Tangential Fresnel Rim Glow
    float NdotV = clamp(abs(dot(N, V)), 0.0, 1.0);
    float fresnel = pow(clamp(1.0 - NdotV, 0.0, 1.0), 3.0);

    // 4. Strict Spatial Discard: Keep 85% of shell hollow so 3D depth and parallax are crystal-clear
    if (isobarGrid < 0.12 && travelingCrest < 0.06 && fresnel < 0.35 && equatorGlow < 0.1) {
        discard;
    }

    // Dynamic Cosine Palette
    float colorT = vRadius * 0.12 - uTime * 0.08 + vDisplacement * 0.3;
    vec3 palColor = cosinePalette(colorT, uPaletteA, uPaletteB, uPaletteC, uPaletteD);

    // Combine Line Color, Traveling Crest, and Core Glow
    vec3 finalRgb = palColor * (0.6 + 0.8 * vIntensity);
    finalRgb += uCoreGlow * (travelingCrest * 1.2 + equatorGlow);
    finalRgb += uAccent * (isobarGrid * 0.9 + fresnel * 1.5);

    float alpha = clamp(isobarGrid * 0.75 + travelingCrest * 0.85 + fresnel * 0.65 + equatorGlow, 0.0, 0.95);
    alpha *= exp(-0.045 * vRadius); // Spherical dissipation

    gl_FragColor = vec4(clamp(finalRgb, 0.0, 10.0), clamp(alpha, 0.0, 1.0));
}
`;
