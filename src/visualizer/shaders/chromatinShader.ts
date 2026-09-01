/**
 * chromatinShader.ts
 * SoundForm 3D - Nuclear Mechanogenomics & Chromatin Fractal Unfurling Shaders
 *
 * Biological Features:
 * - Deformable Nuclear Lamina & Envelope under LINC complex acoustic shear tension.
 * - 8-Fold Symmetric Nuclear Pore Complex (NPC) stress-gated dilation rings.
 * - 3D Fractal Chromatin Fiber decondensation (Heterochromatin -> Euchromatin transition).
 * - Nascent mRNA transcription ribonucleoprotein burst particles.
 */

export const NUCLEAR_LAMINA_VERTEX_SHADER = `
precision highp float;

uniform float uTime;
uniform float uAcousticIntensity;
uniform float uAcousticFrequency;
uniform vec3  uAcousticVector;
uniform float uLaminaStiffness;
uniform vec4  uAudioBands;

varying vec3 vWorldPosition;
varying vec3 vWorldNormal;
varying vec3 vObjectPosition;
varying vec2 vUv;
varying float vPoreMask;
varying float vAcousticStrain;

#define PI 3.1415926535897932384626433832795

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

// 8-Fold Nuclear Pore Complex Ring Lattice
float evalNuclearPoreLattice(vec2 uv) {
    vec2 grid = fract(uv * 14.0) - 0.5;
    float dist = length(grid);
    float angle = atan(grid.y, grid.x);
    float eightFold = cos(8.0 * angle);
    float poreRing = smoothstep(0.35, 0.28, dist) * (1.0 - smoothstep(0.18, 0.12, dist));
    float porePlugs = smoothstep(0.12, 0.0, dist) * (0.5 + 0.5 * eightFold);
    return poreRing + porePlugs * 1.5;
}

void main() {
    vUv = uv;
    vec3 baseDir = normalize(position);
    
    // 1. Acoustic Pressure Wave Shear Displacement
    float wavePhase = dot(position, uAcousticVector) * 4.0 - uTime * (uAcousticFrequency * 0.05 + 2.0);
    float acousticShear = sin(wavePhase) * uAcousticIntensity * (1.1 - uLaminaStiffness * 0.5);
    
    // 2. LINC Complex Intermediate Filament Strain
    float laminaTurbulence = snoise(baseDir * 3.0 + vec3(0.0, 0.0, uTime * 0.4)) * (0.2 + uAudioBands.y * 0.3);
    float totalDisplacement = (acousticShear * 0.25 + laminaTurbulence * 0.15) * (1.0 + uAudioBands.x);
    
    vAcousticStrain = abs(acousticShear) * 2.0 + abs(laminaTurbulence);
    vPoreMask = evalNuclearPoreLattice(uv);
    
    // Nuclear pore dimpling
    float poreDimple = vPoreMask * -0.04;
    vec3 displacedPosition = position + baseDir * (totalDisplacement + poreDimple);
    vObjectPosition = displacedPosition;

    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vec4 worldPos = modelMatrix * vec4(displacedPosition, 1.0);
    vWorldPosition = worldPos.xyz;

    gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

export const NUCLEAR_LAMINA_FRAGMENT_SHADER = `
precision highp float;

uniform float uTime;
uniform vec3  uCameraPosition;
uniform vec3  uHeterochromatinColor; // Locked Deep Purple
uniform vec3  uEuchromatinColor;     // Active Radiant Gold
uniform vec3  uLaminaMeshColor;       // Lamin A/C Cyan-Indigo
uniform float uUnfurlingRatio;        // 0.0 -> 1.0
uniform float uTranscriptionRate;

varying vec3 vWorldPosition;
varying vec3 vWorldNormal;
varying vec3 vObjectPosition;
varying vec2 vUv;
varying float vPoreMask;
varying float vAcousticStrain;

void main() {
    vec3 N = normalize(vWorldNormal);
    vec3 V = normalize(uCameraPosition - vWorldPosition);
    vec3 L = normalize(vec3(2.0, 4.0, 3.0));

    // Fresnel Translucency of Nuclear Envelope
    float nDotV = clamp(dot(N, V), 0.0, 1.0);
    float fresnel = pow(1.0 - nDotV, 3.0);

    // Nuclear Lamina Fibrous Mesh (Intermediate Filaments)
    vec2 grid = fract(vUv * 48.0) - 0.5;
    float filament = smoothstep(0.08, 0.02, abs(grid.x) * abs(grid.y));
    
    // Color blend: Heterochromatin (Locked) -> Euchromatin (Active Unfurled)
    float localActive = clamp(uUnfurlingRatio + vAcousticStrain * 0.35, 0.0, 1.0);
    vec3 coreGlow = mix(uHeterochromatinColor, uEuchromatinColor, localActive);

    // Nuclear Pore Complex Channel (Octagonal Emerald/Gold Gate)
    vec3 poreColor = mix(vec3(0.0, 0.95, 0.75), vec3(1.0, 0.9, 0.3), localActive);
    vec3 baseSurface = mix(uLaminaMeshColor * (0.4 + 0.6 * filament), poreColor, vPoreMask * 0.85);

    // Diffuse + Specular
    float diff = max(dot(N, L), 0.0);
    vec3 H = normalize(L + V);
    float spec = pow(max(dot(N, H), 0.0), 32.0) * 0.75;

    vec3 rawColor = baseSurface * (diff * 0.7 + 0.3) + coreGlow * (0.35 + 0.65 * localActive) + spec + fresnel * uLaminaMeshColor * 1.5;
    vec3 finalColor = rawColor / (rawColor + vec3(1.0)) * 1.35; // Reinhard tone map

    float alpha = clamp(0.72 + fresnel * 0.28 - vPoreMask * 0.25, 0.1, 0.95);
    gl_FragColor = vec4(finalColor, alpha);
}
`;

export const CHROMATIN_FIBER_VERTEX_SHADER = `
precision highp float;

uniform float uTime;
uniform float uUnfurlingRatio;
uniform float uAcousticFrequency;
uniform float uAcousticIntensity;
uniform vec4  uAudioBands;

attribute vec3 aFractalOffset;
attribute float aCompactionDensity;
attribute float aLoopPhase;

varying vec3 vWorldPosition;
varying float vCompaction;
varying float vLoopActivity;

void main() {
    vCompaction = aCompactionDensity;
    
    vec3 unfoldDir = normalize(position - aFractalOffset + vec3(0.001));
    float acousticUnwind = sin(uTime * 3.0 + aLoopPhase + uAcousticFrequency * 0.02) * uAcousticIntensity * 0.35;
    
    float localUnfurling = clamp(uUnfurlingRatio * (1.5 - aCompactionDensity * 0.8) + acousticUnwind, 0.0, 1.0);
    vLoopActivity = localUnfurling;

    float loopExpansion = localUnfurling * (0.85 + 0.35 * uAudioBands.z);
    vec3 displacedPos = position + unfoldDir * loopExpansion;

    vec4 worldPos = modelMatrix * vec4(displacedPos, 1.0);
    vWorldPosition = worldPos.xyz;

    gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

export const CHROMATIN_FIBER_FRAGMENT_SHADER = `
precision highp float;

uniform vec3 uHeterochromatinColor;
uniform vec3 uEuchromatinColor;
uniform vec3 uHistoneAcetylColor;

varying vec3 vWorldPosition;
varying float vCompaction;
varying float vLoopActivity;

void main() {
    vec3 baseColor = mix(uHeterochromatinColor, uEuchromatinColor, vLoopActivity);
    vec3 histoneMarks = uHistoneAcetylColor * smoothstep(0.65, 0.95, vLoopActivity) * 2.0;
    vec3 finalColor = baseColor * (0.8 + 0.5 * vLoopActivity) + histoneMarks;

    gl_FragColor = vec4(finalColor, 0.92);
}
`;

export const TRANSCRIPTION_BURST_VERTEX_SHADER = `
precision highp float;

uniform float uTime;
uniform float uParticleLifetime;
uniform float uAcousticIntensity;

attribute vec3  aInitialVelocity;
attribute float aBirthTime;
attribute vec3  aOriginPore;

varying float vNormalizedAge;
varying vec3  vParticleColor;

void main() {
    float age = mod(uTime - aBirthTime, uParticleLifetime);
    vNormalizedAge = clamp(age / uParticleLifetime, 0.0, 1.0);

    vec3 currentPos = position + aInitialVelocity * (age * 1.2) + (aOriginPore - position) * pow(vNormalizedAge, 2.0);
    gl_PointSize = (1.0 - vNormalizedAge) * (14.0 + uAcousticIntensity * 10.0);
    vParticleColor = mix(vec3(1.0, 0.88, 0.3), vec3(0.1, 0.95, 0.7), vNormalizedAge);

    gl_Position = projectionMatrix * modelViewMatrix * vec4(currentPos, 1.0);
}
`;

export const TRANSCRIPTION_BURST_FRAGMENT_SHADER = `
precision highp float;

varying float vNormalizedAge;
varying vec3  vParticleColor;

void main() {
    vec2 coord = gl_PointCoord - vec2(0.5);
    float dist = length(coord);
    if (dist > 0.5) discard;

    float core = smoothstep(0.5, 0.0, dist);
    float glow = pow(core, 2.0);

    vec3 finalColor = vParticleColor * (glow * 2.2 + core);
    float alpha = (1.0 - vNormalizedAge) * glow;

    gl_FragColor = vec4(finalColor, alpha);
}
`;
