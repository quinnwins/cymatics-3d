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
    vec3 n = normalize(basePos);

    // 1. Spatiotemporal Retarded-Time Audio Sample
    float travelTime = baseR / uPropagationSpeed;
    float historyRow = fract(uHistoryHead - travelTime * 0.15);
    vec4 audioSample = texture2D(uAudioHistory, vec2(aParticleFreq, historyRow));
    float localAmp = audioSample.r;

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
            float frontR = speed * dt;
            float distFromFront = abs(baseR - frontR);
            float pulse = exp(-distFromFront * 4.0) * exp(-dt * 2.0) * strength;
            shockDisp += pulse * sin(distFromFront * 14.0 - dt * 18.0);
        }
    }

    // Compose final 3D position
    float totalDisp = radialDisp * 1.6 + cymaticsDisp * 1.5 + shockDisp * 2.8;
    vec3 displacedPos = basePos + n * totalDisp;

    // 5. Dynamic Cosine Palette
    float colorT = aParticleFreq + baseR * 0.08 - uTime * 0.05 + totalDisp * 0.2;
    vec3 palColor = cosinePalette(colorT, uPaletteA, uPaletteB, uPaletteC, uPaletteD);

    // Intensity boost on transient or heavy sub-bass
    float intensity = clamp(localAmp * 2.5 + abs(totalDisp) * 0.8 + shockDisp * 1.5, 0.0, 3.5);
    vIntensity = intensity;

    vec3 finalColor = palColor * (0.6 + 1.2 * intensity);
    finalColor += uCoreGlow * (uBandEnergies.x * 1.5);
    finalColor += uAccent * shockDisp;

    vColor = vec4(finalColor, 1.0);

    vec4 mvPosition = modelViewMatrix * vec4(displacedPos, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    // Soft camera near-plane depth fade to prevent harsh clipping
    float zDist = -mvPosition.z;
    vDepthFade = smoothstep(0.4, 1.2, zDist);

    // Point size with distance attenuation
    gl_PointSize = clamp((2.5 + 6.0 * intensity + shockDisp * 8.0) * uParticleScale * (220.0 / max(zDist, 0.1)), 1.5, 64.0);
}
`;

export const PARTICLE_FRAGMENT_SHADER = `
precision highp float;

varying vec4 vColor;
varying float vIntensity;
varying float vDepthFade;

void main() {
    vec2 pCoord = gl_PointCoord * 2.0 - 1.0;
    float r2 = dot(pCoord, pCoord);
    if (r2 > 1.0) discard;

    // 1. Exact Spherical Normal Reconstruction
    float zNorm = sqrt(1.0 - r2);
    vec3 impostorNormal = vec3(pCoord.x, -pCoord.y, zNorm);

    // 2. View-Space Directional Lighting & Microfacet Specular
    vec3 lightDir = normalize(vec3(0.5, 0.8, 1.0));
    float NdotL = max(dot(impostorNormal, lightDir), 0.0);
    float spec = pow(max(dot(impostorNormal, normalize(lightDir + vec3(0.0, 0.0, 1.0))), 0.0), 28.0);

    // 3. Multi-Wavelength Chromatic Airy Fringe Dispersion
    float rR = sqrt(r2) * 1.03;
    float rG = sqrt(r2);
    float rB = sqrt(r2) * 0.97;

    vec3 chromaticAlpha = vec3(
        exp(-rR * rR * 9.0),
        exp(-rG * rG * 10.0),
        exp(-rB * rB * 11.5)
    );

    float coreGaussian = exp(-r2 * 12.0);
    float edgeAA = smoothstep(1.0, 0.82, sqrt(r2));

    vec3 baseRgb = vColor.rgb * (0.65 + 0.75 * NdotL);
    vec3 finalRgb = baseRgb * chromaticAlpha + vec3(spec * 1.2 * vIntensity);
    float finalAlpha = clamp(coreGaussian * edgeAA * vDepthFade, 0.0, 1.0);

    gl_FragColor = vec4(finalRgb, finalAlpha);
}
`;

