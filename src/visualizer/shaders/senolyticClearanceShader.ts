/**
 * senolyticClearanceShader.ts
 * SoundForm 3D - Senolytic Acoustic Fatigue Micro-Fractures, SASP Dispersion & Apoptotic Blebbing Shaders
 *
 * Biological Features:
 * - Enlarged flattened SASP-secreting senescent cell phenotype.
 * - Acoustic fatigue micro-fracture veins along rigid stress fibers.
 * - Caspase-3/9 apoptotic blebbing and Annexin V phosphatidylserine flip.
 * - Secretory SASP cytokine haze plume (IL-6, IL-8, MMP-3) and clearance dissolution.
 */

export const SENESCENT_CELL_VERTEX_SHADER = `
precision highp float;

uniform float uTime;
uniform float uAcousticFatigue;
uniform float uApoptosisProgress;
uniform float uAcousticIntensity;
uniform vec4  uAudioBands;

varying vec3 vWorldPosition;
varying vec3 vWorldNormal;
varying vec3 vObjectPosition;
varying vec2 vUv;
varying float vFatigueCrack;
varying float vBlebIntensity;
varying float vAnnexinVFlip;

vec4 permute(vec4 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + 1.0 * C.xxx;
    vec3 x2 = x0 - i2 + 2.0 * C.xxx;
    vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
    i = mod(i, 289.0);
    vec4 p = permute(permute(permute(
                i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

void main() {
    vUv = uv;
    float posLen = length(position);
    vec3 baseDir = posLen > 1e-5 ? position / posLen : vec3(0.0, 1.0, 0.0);

    // 1. Flattened Morphology
    vec3 flattenedPos = position;
    flattenedPos.y *= 0.55;

    // 2. Acoustic Fatigue Micro-Fracture Veins
    float fatigueNoise = snoise(position * 6.0 + vec3(uTime * 0.2, 0.0, 0.0));
    vFatigueCrack = smoothstep(0.7, 0.95, fatigueNoise) * uAcousticFatigue;

    // 3. Apoptotic Blebbing
    float blebNoise1 = snoise(position * 4.0 + vec3(0.0, uTime * 2.5, 0.0));
    float blebBubbles = max(blebNoise1, 0.0) * 0.35;
    
    float blebDisplacement = blebBubbles * uApoptosisProgress * (1.1 + uAudioBands.y);
    vBlebIntensity = blebBubbles * uApoptosisProgress;
    vAnnexinVFlip = clamp(uApoptosisProgress * 1.4, 0.0, 1.0);

    // 4. Apoptotic Condensation
    float cellShrinkage = 1.0 - uApoptosisProgress * 0.55;
    vec3 finalPos = (flattenedPos + baseDir * blebDisplacement) * cellShrinkage;
    vObjectPosition = finalPos;

    vec4 worldPos = modelMatrix * vec4(finalPos, 1.0);
    vWorldPosition = worldPos.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);

    gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

export const SENESCENT_CELL_FRAGMENT_SHADER = `
precision highp float;

uniform float uTime;
uniform vec3  uCameraPosition;
uniform vec3  uSaBetaGalColor;      // Indigo/Azure
uniform vec3  uGammaH2AxColor;       // Magenta Foci
uniform vec3  uMicroCrackColor;      // Luminescent Blue
uniform vec3  uAnnexinVColor;        // Apoptotic Emerald
uniform float uAcousticFatigue;
uniform float uApoptosisProgress;

varying vec3 vWorldPosition;
varying vec3 vWorldNormal;
varying vec3 vObjectPosition;
varying vec2 vUv;
varying float vFatigueCrack;
varying float vBlebIntensity;
varying float vAnnexinVFlip;

void main() {
    vec3 N = normalize(vWorldNormal);
    vec3 V = normalize(uCameraPosition - vWorldPosition);
    vec3 L = normalize(vec3(2.0, 4.0, 3.0));

    vec3 baseColor = uSaBetaGalColor;

    vec2 fociGrid = fract(vUv * 24.0) - 0.5;
    float fociMask = 1.0 - smoothstep(0.0, 0.14, length(fociGrid));
    baseColor += uGammaH2AxColor * fociMask * 1.6;

    vec3 crackGlow = uMicroCrackColor * vFatigueCrack * 3.5;
    vec3 apoptoticSurface = mix(baseColor, uAnnexinVColor, vAnnexinVFlip * 0.8);

    float diff = max(dot(N, L), 0.0);
    vec3 H = normalize(L + V);
    float spec = pow(max(dot(N, H), 0.0), 32.0) * 0.6;

    vec3 rawColor = apoptoticSurface * (diff * 0.7 + 0.3) + crackGlow + spec + uAnnexinVColor * vBlebIntensity * 1.2;
    vec3 finalColor = rawColor / (rawColor + vec3(1.0)) * 1.35; // Reinhard tone map

    float alpha = clamp((1.0 - uApoptosisProgress * 0.92) * 0.95, 0.0, 1.0);
    gl_FragColor = vec4(finalColor, alpha);
}
`;

export const SASP_HAZE_VERTEX_SHADER = `
precision highp float;

uniform float uTime;
uniform float uSaspSecretionRate;
uniform float uApoptosisProgress;

attribute vec3  aInitialVelocity;
attribute float aParticleSeed;

varying float vNormalizedLife;
varying vec3  vSaspColor;

void main() {
    float life = fract(uTime * 0.2 + aParticleSeed);
    vNormalizedLife = life;

    vec3 currentPos = position + aInitialVelocity * (life * 3.0) + vec3(sin(uTime + aParticleSeed * 6.28), cos(uTime * 0.8), 0.0) * 0.25;

    float activeScale = (1.0 - uApoptosisProgress) * uSaspSecretionRate;
    gl_PointSize = (1.0 - life) * activeScale * 26.0;
    vSaspColor = mix(vec3(0.85, 0.45, 0.05), vec3(0.55, 0.05, 0.75), life);

    gl_Position = projectionMatrix * modelViewMatrix * vec4(currentPos, 1.0);
}
`;

export const SASP_HAZE_FRAGMENT_SHADER = `
precision highp float;

varying float vNormalizedLife;
varying vec3  vSaspColor;

void main() {
    vec2 coord = gl_PointCoord - vec2(0.5);
    float dist = length(coord);
    if (dist > 0.5) discard;

    float cloud = pow(1.0 - smoothstep(0.0, 0.5, dist), 1.8);
    vec3 finalColor = vSaspColor * cloud * 1.4;
    float alpha = (1.0 - vNormalizedLife) * cloud * 0.4;

    gl_FragColor = vec4(finalColor, alpha);
}
`;
