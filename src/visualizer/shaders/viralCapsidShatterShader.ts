/**
 * viralCapsidShatterShader.ts
 * SoundForm 3D - Viral Capsid Lamb Resonance Standing Wave & Voronoi Shattering Shaders
 *
 * Biological Features:
 * - Icosahedral Geodesic Symmetry (T=7 / T=13).
 * - Spheroidal Lamb acoustic eigenmodes (l=2 quadrupole standing wave).
 * - Resonance Q-factor mechanical strain build-up.
 * - Voronoi capsomer cleavage, ballistic fragment dispersion, and genome core dissolution.
 */

export const VIRAL_CAPSID_VERTEX_SHADER = `
precision highp float;

uniform float uTime;
uniform float uAcousticFrequency;
uniform float uLambResonantFreq;
uniform float uAcousticIntensity;
uniform float uShatterProgress;
uniform int   uLambModeL;
uniform int   uLambModeM;

attribute vec3 aCapsomerCenter;
attribute float aIsPentamer;
attribute vec3 aShardNormal;

varying vec3 vWorldPosition;
varying vec3 vWorldNormal;
varying vec3 vObjectPosition;
varying float vStressIntensity;
varying float vIsPentamer;

#define PI 3.1415926535897932384626433832795

float evalLegendre(int l, int m, float cosTheta) {
    float sinTheta = sqrt(max(1.0 - cosTheta * cosTheta, 0.0));
    if (l == 2) {
        if (m == 0) return 0.5 * (3.0 * cosTheta * cosTheta - 1.0);
        if (m == 2) return 3.0 * sinTheta * sinTheta;
    } else if (l == 3) {
        if (m == 0) return 0.5 * (5.0 * pow(cosTheta, 3.0) - 3.0 * cosTheta);
        if (m == 2) return 15.0 * cosTheta * sinTheta * sinTheta;
    }
    return cosTheta;
}

float evalLambEigenmode(vec3 pos, float time, float resonanceGain) {
    float pLen = length(pos);
    vec3 nPos = pLen > 1e-5 ? pos / pLen : vec3(0.0, 1.0, 0.0);
    float cosTheta = clamp(nPos.z, -1.0, 1.0);
    float phi = (abs(nPos.x) < 1e-6 && abs(nPos.y) < 1e-6) ? 0.0 : atan(nPos.y, nPos.x);

    float legendre = evalLegendre(uLambModeL, uLambModeM, cosTheta);
    float harmonic = legendre * cos(float(uLambModeM) * phi);
    
    float standingWave = harmonic * cos(uAcousticFrequency * 0.08 * time);
    return standingWave * resonanceGain;
}

void main() {
    vIsPentamer = aIsPentamer;
    float pLen0 = length(position);
    vec3 baseDir = pLen0 > 1e-5 ? position / pLen0 : vec3(0.0, 1.0, 0.0);

    // 1. Acoustic Resonance Lorentzian Q-Factor
    float freqDiff = abs(uAcousticFrequency - uLambResonantFreq);
    float resonanceQ = 1.0 / (1.0 + pow(freqDiff * 0.12, 2.0));
    float resonanceGain = uAcousticIntensity * (1.0 + resonanceQ * 7.5);

    // 2. Lamb Spheroidal Standing Wave Displacement
    float lambDisp = evalLambEigenmode(position, uTime, resonanceGain);
    vStressIntensity = abs(lambDisp) * 3.5;

    // 3. Explosive Voronoi Shard Shatter Mechanics
    vec3 shatterDisp = vec3(0.0);
    if (uShatterProgress > 0.001) {
        float shatterSpeed = pow(uShatterProgress, 0.45) * 4.2;
        vec3 spinAxis = cross(aShardNormal, vec3(0.0, 1.0, 0.0));
        shatterDisp = aShardNormal * shatterSpeed + sin(uTime * 10.0 + position.x) * spinAxis * (uShatterProgress * 0.4);
    }

    vec3 finalPos = position + baseDir * (lambDisp * 0.18) + shatterDisp;
    vObjectPosition = finalPos;

    vec4 worldPos = modelMatrix * vec4(finalPos, 1.0);
    vWorldPosition = worldPos.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);

    gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

export const VIRAL_CAPSID_FRAGMENT_SHADER = `
precision highp float;

uniform float uTime;
uniform vec3  uCameraPosition;
uniform vec3  uHexonColor;          // Hexamer Cyan/Blue
uniform vec3  uPentonColor;         // Pentamer Vertices Magenta
uniform vec3  uResonanceStressColor;// Lamb Peak Shear Yellow
uniform vec3  uFractureEdgeGlow;    // Rupture Seams Cyan
uniform float uShatterProgress;

varying vec3 vWorldPosition;
varying vec3 vWorldNormal;
varying vec3 vObjectPosition;
varying float vStressIntensity;
varying float vIsPentamer;

void main() {
    vec3 N = normalize(vWorldNormal);
    vec3 V = normalize(uCameraPosition - vWorldPosition);
    vec3 L = normalize(vec3(2.0, 3.0, 2.5));

    vec3 capsomerBase = mix(uHexonColor, uPentonColor, vIsPentamer);
    vec3 stressColor = mix(capsomerBase, uResonanceStressColor, clamp(vStressIntensity, 0.0, 1.0));

    float diff = max(dot(N, L), 0.0);
    vec3 H = normalize(L + V);
    float spec = pow(max(dot(N, H), 0.0), 36.0) * 0.8;

    float fractureGlow = smoothstep(0.05, 0.35, uShatterProgress) * (1.0 - uShatterProgress);
    vec3 seamFlash = uFractureEdgeGlow * fractureGlow * 3.0;

    vec3 rawColor = stressColor * (diff * 0.7 + 0.3) + spec + seamFlash;
    vec3 finalColor = rawColor / (rawColor + vec3(1.0)) * 1.35; // Reinhard tone map

    float alpha = clamp(1.0 - uShatterProgress * 0.85, 0.0, 1.0);
    gl_FragColor = vec4(finalColor, alpha);
}
`;

export const VIRAL_GENOME_CORE_VERTEX_SHADER = `
precision highp float;

uniform float uTime;
uniform float uShatterProgress;

attribute vec3 aGenomeFoldVector;

varying vec3 vWorldPosition;
varying float vDissolution;

void main() {
    float expansion = uShatterProgress * 2.0;
    vec3 displacedPos = position * (1.0 + expansion) + aGenomeFoldVector * sin(uTime * 4.0 + position.y) * expansion;
    vDissolution = uShatterProgress;

    vec4 worldPos = modelMatrix * vec4(displacedPos, 1.0);
    vWorldPosition = worldPos.xyz;

    gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

export const VIRAL_GENOME_CORE_FRAGMENT_SHADER = `
precision highp float;

uniform vec3 uGenomeCoreColor;
varying float vDissolution;

void main() {
    vec3 glow = uGenomeCoreColor * (1.8 + 2.5 * vDissolution);
    float alpha = clamp((1.0 - vDissolution * 0.95) * 0.85, 0.0, 1.0);
    gl_FragColor = vec4(glow, alpha);
}
`;
