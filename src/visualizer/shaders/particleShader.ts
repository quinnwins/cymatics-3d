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

    // Acoustic Wavefront Excitation: Particles ignite when wave energy passes through them
    float excitation = clamp(localAmp * 2.8 + abs(totalDisp) * 1.6 + shockDisp * 2.5, 0.0, 3.0);
    vIntensity = excitation;

    vec3 finalColor = palColor * (0.2 + 0.9 * excitation);
    finalColor += uCoreGlow * (uBandEnergies.x * excitation * 0.8);
    finalColor += uAccent * (shockDisp * 1.5);

    // Particle alpha: subtle ambient dust, glowing on acoustic wave passage
    float pAlpha = clamp(0.04 + excitation * 0.65, 0.0, 0.9);
    vColor = vec4(finalColor, pAlpha);

    vec4 mvPosition = modelViewMatrix * vec4(displacedPos, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    // Point size with distance attenuation & clamping
    float pSize = (1.0 + 2.5 * excitation + shockDisp * 4.0) * uParticleScale * (100.0 / -mvPosition.z);
    gl_PointSize = clamp(pSize, 1.0, 28.0);
}
`;

export const PARTICLE_FRAGMENT_SHADER = `
precision highp float;

varying vec4 vColor;
varying float vIntensity;

void main() {
    // Render smooth anti-aliased Gaussian circular particle
    vec2 coord = gl_PointCoord - vec2(0.5);
    float distSq = dot(coord, coord);
    if (distSq > 0.25) discard;

    float alpha = exp(-distSq * 18.0) * vColor.a;
    float core = smoothstep(0.03, 0.0, distSq) * vIntensity;

    vec3 finalRgb = vColor.rgb + vec3(1.0) * (core * 0.5);
    gl_FragColor = vec4(finalRgb, alpha);
}
`;
