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
varying vec3 vViewPosition;
varying vec2 vUv;
varying float vDisplacement;
varying float vRadius;
varying float vIntensity;
varying vec3 vWorldPos;

void main() {
    vUv = uv;
    vec3 basePos = position;
    float baseR = length(basePos);
    vec3 n = normalize(basePos);
    vRadius = baseR;

    // 1. Physical Retarded-Time lookup: tau = r / c
    float travelTime = baseR / uPropagationSpeed;
    float historyRow = fract(uHistoryHead - travelTime * 0.15);

    // Map spherical coordinates (theta, phi) to frequency bin u in [0, 1]
    float freqU = clamp((n.y * 0.5 + 0.5) * 0.7 + (n.x * 0.5 + 0.5) * 0.3, 0.0, 1.0);
    vec4 audioSample = texture2D(uAudioHistory, vec2(freqU, historyRow));
    float spectralAmp = audioSample.r;

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
            float frontR = speed * dt;
            float distFromFront = abs(baseR - frontR);
            float pulse = exp(-distFromFront * 3.5) * exp(-dt * 2.0) * strength;
            shockDisp += pulse * sin(distFromFront * 12.0 - dt * 15.0);
        }
    }

    float totalDisp = radialDisp * 1.8 + cymaticsDisp * 1.2 + shockDisp * 2.5;
    vDisplacement = totalDisp;
    vIntensity = clamp(spectralAmp * 2.0 + abs(totalDisp) * 1.5, 0.0, 3.0);

    vec3 displacedPos = basePos + n * totalDisp;

    // Analytical Tangent-Space Wave Slope Normal Perturbation
    vec3 b1, b2;
    buildOrthonormalBasis(n, b1, b2);
    float slopeU = -radialDisp * waveK * 0.45;
    float slopeV = cymaticsDisp * 0.35;
    vec3 perturbedNormal = normalize(n - b1 * slopeU - b2 * slopeV);

    vWorldNormal = normalize(normalMatrix * perturbedNormal);
    vec4 mvPosition = modelViewMatrix * vec4(displacedPos, 1.0);
    vViewPosition = -mvPosition.xyz;
    vWorldPos = (modelMatrix * vec4(displacedPos, 1.0)).xyz;
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
varying vec3 vViewPosition;
varying vec2 vUv;
varying float vDisplacement;
varying float vRadius;
varying float vIntensity;
varying vec3 vWorldPos;

void main() {
    vec3 N = normalize(vWorldNormal);
    vec3 V = normalize(vViewPosition);

    // Microfacet GGX specular highlight on wave crests
    vec3 lightDir = normalize(vec3(0.4, 0.9, 0.5));
    vec3 H = normalize(lightDir + V);
    float NdotH = max(dot(N, H), 0.0);
    float spec = pow(NdotH, 36.0) * (0.8 + 1.2 * vIntensity);

    // Physical Fresnel reflection on glancing angles
    float NdotV = max(dot(N, V), 0.0);
    float fresnel = pow(1.0 - NdotV, 3.0);

    // Dynamic OKLab cosine palette color based on radial distance and displacement
    float colorT = vRadius * 0.12 - uTime * 0.08 + vDisplacement * 0.5;
    vec3 palColor = oklabCosinePalette(colorT, uPaletteA, uPaletteB, uPaletteC, uPaletteD);

    // Core glowing wave crests with Apple radiant glow shoulder
    vec3 crestColor = mix(palColor, uCoreGlow, clamp(vDisplacement * 2.0, 0.0, 1.0));
    vec3 finalRgb = appleRadiantGlow(crestColor, vIntensity * 0.8, 0.45);
    finalRgb += fresnel * uAccent * 2.2 + vec3(spec * 1.5);

    // Outer edge soft exponential distance decay
    float alpha = clamp(0.12 + fresnel * 0.88 + abs(vDisplacement) * 1.4, 0.0, 0.96);
    alpha *= exp(-0.05 * vRadius);

    gl_FragColor = vec4(finalRgb, alpha);
}
`;

