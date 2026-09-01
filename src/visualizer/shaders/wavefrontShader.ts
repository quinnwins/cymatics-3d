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
varying vec3 vViewPosition;
varying vec2 vUv;
varying float vDisplacement;
varying float vRadius;
varying float vIntensity;

void main() {
    vec3 N = normalize(vWorldNormal);
    vec3 V = normalize(vViewPosition);

    // Fresnel glow on glancing tangential angles (thin spherical shell edge)
    float NdotV = max(dot(N, V), 0.0);
    float fresnel = pow(1.0 - NdotV, 3.5);

    // Propagating wave crest highlight
    float waveCrest = smoothstep(0.15, 0.6, abs(vDisplacement) * 2.5);
    
    // Discard empty space between wave crests to prevent additive saturation
    if (waveCrest < 0.05 && fresnel < 0.25) discard;

    // Dynamic cosine palette color based on radial distance
    float colorT = vRadius * 0.1 - uTime * 0.06 + vDisplacement * 0.3;
    vec3 palColor = cosinePalette(colorT, uPaletteA, uPaletteB, uPaletteC, uPaletteD);

    // Core glowing wave crests
    vec3 crestColor = mix(palColor, uCoreGlow, waveCrest);
    vec3 finalRgb = crestColor * (0.5 + 1.2 * vIntensity) + fresnel * uAccent * 1.8;

    float alpha = clamp(waveCrest * 0.7 + fresnel * 0.5, 0.0, 0.85);
    alpha *= exp(-0.08 * vRadius); // Spherical energy decay

    gl_FragColor = vec4(finalRgb, alpha);
}
`;
