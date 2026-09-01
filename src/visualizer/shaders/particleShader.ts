import { CYMATICS_CORE_GLSL } from './cymaticsCore';

export const PARTICLE_VERTEX_SHADER = `
${CYMATICS_CORE_GLSL}

uniform float uTime;
uniform float uPropagationSpeed;
uniform float uHistoryHead;
uniform sampler2D uAudioHistory;
uniform vec4 uBandEnergies;
uniform vec2 uHighEnergies;
uniform vec4 uShockwaves[4];
uniform vec3 uPaletteA;
uniform vec3 uPaletteB;
uniform vec3 uPaletteC;
uniform vec3 uPaletteD;
uniform vec3 uCoreGlow;
uniform vec3 uAccent;
uniform float uParticleScale;

attribute float aParticleFreq;
attribute float aParticlePhase;
attribute float aShellRadius;

varying vec4 vColor;
varying float vIntensity;
varying float vDepthFade;

void main() {
    vec3 basePos = position;
    float baseR = length(basePos);
    vec3 n = baseR > 1e-5 ? basePos / baseR : vec3(0.0, 1.0, 0.0);

    // 1. Spatiotemporal Retarded-Time Audio Sample
    float travelTime = baseR / max(uPropagationSpeed, 0.001);
    float historyRow = fract(uHistoryHead - travelTime * 0.15);
    vec4 audioSample = texture2D(uAudioHistory, vec2(aParticleFreq, historyRow));
    float localAmp = clamp(audioSample.r, 0.0, 10.0);

    // 2. Physical Spherical Wave Propagation
    float waveK = 3.14159 * (1.2 + aParticleFreq * 7.0);
    float wavePhase = waveK * baseR - uTime * 7.0 + aParticlePhase * 6.28;
    float radialDisp = (localAmp / (0.6 + 0.3 * baseR)) * cos(wavePhase);

    // 3. Acoustic Force Field Advection & Cymatic Displacement
    float cymaticsDisp = evaluateCymaticsDisplacement(
        basePos,
        uBandEnergies,
        uHighEnergies,
        1.8,
        uTime
    );

    // 4. Shockwave Pulses
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
                float pulse = exp(-distFromFront * 4.0) * exp(-dt * 2.0) * strength;
                shockDisp += pulse * sin(distFromFront * 14.0 - dt * 18.0);
            }
        }
    }

    // Compose final 3D position
    float totalDisp = radialDisp * 1.6 + cymaticsDisp * 1.5 + shockDisp * 2.8;
    vec3 displacedPos = basePos + n * totalDisp;

    // 5. Dynamic Cosine Palette
    float colorT = aParticleFreq + baseR * 0.08 - uTime * 0.05 + totalDisp * 0.2;
    vec3 palColor = cosinePalette(colorT, uPaletteA, uPaletteB, uPaletteC, uPaletteD);

    // Intensity boost on transient or heavy sub-bass
    float intensity = clamp(localAmp * 1.8 + abs(totalDisp) * 0.6 + shockDisp * 1.2, 0.0, 3.0);
    vIntensity = intensity;

    vec3 finalColor = palColor * (0.80 + 0.40 * intensity);
    finalColor += uCoreGlow * (uBandEnergies.x * 0.6);
    finalColor += uAccent * (shockDisp * 0.8);

    vColor = vec4(finalColor, 0.90 + 0.10 * intensity);

    vec4 mvPosition = modelViewMatrix * vec4(displacedPos, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    // Soft camera near-plane depth fade to prevent harsh clipping
    float zDist = max(0.1, -mvPosition.z);
    vDepthFade = smoothstep(0.3, 1.2, zDist);

    // Point size with calibrated distance attenuation (fine acoustic nebula points)
    gl_PointSize = clamp((0.9 + 1.1 * intensity + shockDisp * 1.5) * uParticleScale * (75.0 / max(zDist, 0.15)), 1.0, 12.0);
}
`;

export const PARTICLE_FRAGMENT_SHADER = `
precision highp float;

uniform vec3 uAccent;

varying vec4 vColor;
varying float vIntensity;
varying float vDepthFade;

void main() {
    vec2 pCoord = gl_PointCoord * 2.0 - 1.0;
    float r2 = dot(pCoord, pCoord);
    if (r2 > 1.0) discard;

    // Soft Gaussian Core with subtle Airy edge falloff
    float coreGaussian = exp(-r2 * 4.5);
    float edgeSoft = 1.0 - smoothstep(0.6, 1.0, clamp(sqrt(max(0.0, r2)), 0.0, 1.0));

    vec3 finalRgb = vColor.rgb * (1.0 + vIntensity * 0.4);
    float finalAlpha = clamp(vColor.a * coreGaussian * edgeSoft * vDepthFade, 0.0, 1.0);

    if (isnan(finalRgb.r) || isnan(finalRgb.g) || isnan(finalRgb.b) || isnan(finalAlpha) ||
        isinf(finalRgb.r) || isinf(finalRgb.g) || isinf(finalRgb.b) || isinf(finalAlpha)) {
        discard;
    }

    gl_FragColor = vec4(clamp(finalRgb, 0.0, 10.0), clamp(finalAlpha, 0.0, 1.0));
}
`;

