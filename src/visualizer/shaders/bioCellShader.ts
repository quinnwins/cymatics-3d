/**
 * bioCellShader.ts
 * SoundForm 3D - Viscoelastic Deformable Cell Membrane & Cavitation Lysis Shaders
 *
 * Features:
 * - Spherical Harmonics (L0 breathing, L1 dipole, L2 quadrupole, L3 octupole, L4 icosahedral).
 * - Rayleigh Surface Acoustic Wave (SAW) circumferential deformation.
 * - Chaotic Malignant Blebbing via 3D Simplex noise with cortical tension decoupling.
 * - Subsurface Scattering (SSS) & Chromatic Fresnel reflection through lipid bilayer.
 * - Intracellular organelle/nucleus chromatin glow and actin filament cortical web.
 * - Voronoi Cavitation Perforation and glowing lysis tear edges for Histotripsy.
 */

export const BIO_CELL_MEMBRANE_VERTEX_SHADER = `
precision highp float;

// Transform Uniforms
uniform mat4 modelMatrix;
uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;
uniform mat3 normalMatrix;
uniform mat4 modelViewMatrix;

// Simulation & Physics Uniforms
uniform float uTime;
uniform float uDiseaseState;        // 0.0 = Rigid Healthy, 1.0 = Softened Malignant, 2.0 = Viral Capsid, 3.0 = Bacteria
uniform float uCorticalTension;     // 1.0 (tense/healthy) -> 0.1 (flaccid/cancer)
uniform float uAcousticFrequency;   // Driving acoustic Hz
uniform float uAcousticIntensity;   // Acoustic pressure Pa / amplitude
uniform vec4  uModalAmplitudesL0L3; // x=L0 (breath), y=L1 (dipole), z=L2 (quadrupole), w=L3 (octupole)
uniform float uL4IcosahedralAmp;    // Viral capsid / high-order harmonic
uniform float uBlebFrequency;
uniform float uBlebScale;

// Audio Frequency Reactive Bands
uniform vec4  uAudioBands;          // x=SubBass, y=Bass, z=LowMid, w=High

// Cavitation / Lysis Rupture Uniforms
uniform float uRuptureProgress;     // 0.0 = Intact, 1.0 = Fully Lysed
uniform vec3  uShockwaveOrigin;
uniform float uShockwaveRadius;

// Varyings to Fragment Shader
varying vec3 vWorldPosition;
varying vec3 vWorldNormal;
varying vec3 vObjectPosition;
varying vec3 vViewNormal;
varying vec2 vUv;
varying float vDeformationIntensity;
varying float vActinIntegrity;
varying float vLocalRupture;

#define PI 3.1415926535897932384626433832795
#define TWO_PI 6.2831853071795864769252867665590

// ----------------------------------------------------------------------------
// Simplex 3D Noise for Chaotic Blebbing & Surface Micro-Turbulence
// ----------------------------------------------------------------------------
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
    vec3  ns = n_ * D.wyz - D.xzx;

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

// ----------------------------------------------------------------------------
// Real Spherical Harmonics Basis Evaluations
// ----------------------------------------------------------------------------
float evalSH(vec3 dir, vec4 ampsL0L3, float ampL4, float time, float disease) {
    float x = dir.x, y = dir.y, z = dir.z;
    float x2 = x * x, y2 = y * y, z2 = z * z;
    float r = 0.0;

    // L=0 Monopole Breathing Mode: Radial volumetric pulsation
    float Y00 = 0.28209479;
    float breathFreq = uAcousticFrequency * 0.05 + uAudioBands.x * 4.0;
    r += ampsL0L3.x * Y00 * sin(breathFreq * time);

    // L=1 Dipole Translation / Vibration
    float Y10 = 0.48860251 * z;
    float Y11 = 0.48860251 * x;
    r += ampsL0L3.y * (Y10 * cos(time * 3.0) + Y11 * sin(time * 2.5));

    // L=2 Quadrupole Spheroidal Prolate-Oblate Mode (Shear resonance)
    float Y20 = 0.31539157 * (3.0 * z2 - 1.0);
    float Y22 = 0.54627422 * (x2 - y2);
    float quadFreq = uAcousticFrequency * 0.1 + uAudioBands.y * 6.0;
    r += ampsL0L3.z * (Y20 * cos(quadFreq * time) + Y22 * sin(quadFreq * time * 1.3));

    // L=3 Octupole Multi-Lobed Resonance
    float Y30 = 0.37317633 * z * (5.0 * z2 - 3.0);
    float Y32 = 1.44530572 * z * (x2 - y2);
    r += ampsL0L3.w * (Y30 * sin(time * 4.2) + Y32 * cos(time * 3.7));

    // L=4 / Icosahedral Symmetry Mode (Viral Capsid / High Order Rigidity)
    float Y40 = 0.10578555 * (35.0 * z2 * z2 - 30.0 * z2 + 3.0);
    float Y44 = 0.59004359 * (x2 * (x2 - 3.0 * y2) - y2 * (3.0 * x2 - y2));
    float icosahedral = Y40 + 0.84515425 * Y44;
    r += ampL4 * icosahedral;

    return r;
}

// ----------------------------------------------------------------------------
// Rayleigh Surface Acoustic Wave (Traveling & Standing Waves)
// ----------------------------------------------------------------------------
float evalRayleighWave(vec3 pos, float time, float freq) {
    float theta = acos(clamp(pos.z, -1.0, 1.0));
    float phi = atan(pos.y, pos.x);
    float waveK = 6.0;
    float wavePhase = freq * 0.2 * time;
    float standingWave = sin(waveK * theta) * cos(4.0 * phi - wavePhase);
    return standingWave * 0.08 * (1.0 + uAudioBands.z * 1.5);
}

void main() {
    vUv = uv;
    vec3 baseDir = normalize(position);

    // 1. Spherical Harmonics Displacement
    float shDisp = evalSH(baseDir, uModalAmplitudesL0L3, uL4IcosahedralAmp, uTime, uDiseaseState);

    // 2. Rayleigh SAW Displacement
    float sawDisp = evalRayleighWave(baseDir, uTime, uAcousticFrequency);

    // 3. Cancerous Blebbing / Viscoelastic Relaxation
    float blebNoise = snoise(baseDir * uBlebScale + vec3(0.0, 0.0, uTime * uBlebFrequency));
    float blebNoise2 = snoise(baseDir * (uBlebScale * 2.1) - vec3(uTime * 0.8, 0.0, 0.0));
    float blebMask = smoothstep(0.2, 0.85, blebNoise + blebNoise2 * 0.4);
    
    // Softened cortex allows internal hydrostatic pressure to herniate out
    float blebDisp = (1.0 - uCorticalTension) * blebMask * (0.35 + 0.25 * uAudioBands.y);

    // Combined Viscoelastic Displacement
    float totalDisplacement = (shDisp + sawDisp + blebDisp) * uAcousticIntensity;
    vDeformationIntensity = abs(totalDisplacement) + blebMask * (1.0 - uCorticalTension);
    vActinIntegrity = uCorticalTension * (1.0 - blebMask * 0.7);

    // Cavitation Shockwave Local Perturbation
    vec3 worldBasePos = (modelMatrix * vec4(position, 1.0)).xyz;
    float distToShock = length(worldBasePos - uShockwaveOrigin);
    float shockDistort = sin(clamp(uShockwaveRadius - distToShock, 0.0, 2.0) * 12.0) * exp(-abs(uShockwaveRadius - distToShock) * 3.0);
    vLocalRupture = smoothstep(uShockwaveRadius - 0.5, uShockwaveRadius + 0.5, distToShock) * uRuptureProgress;

    vec3 displacedPosition = position + baseDir * (totalDisplacement + shockDistort * 0.25);
    vObjectPosition = displacedPosition;

    // Normal recalculation with numerical tangent offsets
    float eps = 0.015;
    vec3 tangentX = normalize(cross(baseDir, vec3(0.0, 1.0, 0.001)));
    vec3 tangentY = normalize(cross(baseDir, tangentX));
    
    vec3 pX = position + tangentX * eps;
    vec3 pY = position + tangentY * eps;
    float dispX = (evalSH(normalize(pX), uModalAmplitudesL0L3, uL4IcosahedralAmp, uTime, uDiseaseState) + 
                   (1.0 - uCorticalTension) * smoothstep(0.2, 0.85, snoise(normalize(pX) * uBlebScale + vec3(0.0, 0.0, uTime * uBlebFrequency)))) * uAcousticIntensity;
    float dispY = (evalSH(normalize(pY), uModalAmplitudesL0L3, uL4IcosahedralAmp, uTime, uDiseaseState) + 
                   (1.0 - uCorticalTension) * smoothstep(0.2, 0.85, snoise(normalize(pY) * uBlebScale + vec3(0.0, 0.0, uTime * uBlebFrequency)))) * uAcousticIntensity;
    
    vec3 posDX = (pX + normalize(pX) * dispX) - displacedPosition;
    vec3 posDY = (pY + normalize(pY) * dispY) - displacedPosition;
    vec3 calculatedNormal = normalize(cross(posDX, posDY));

    vWorldNormal = normalize(normalMatrix * calculatedNormal);
    vViewNormal  = normalize((modelViewMatrix * vec4(calculatedNormal, 0.0)).xyz);
    
    vec4 worldPos = modelMatrix * vec4(displacedPosition, 1.0);
    vWorldPosition = worldPos.xyz;

    gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

export const BIO_CELL_MEMBRANE_FRAGMENT_SHADER = `
precision highp float;

// Uniforms
uniform float uTime;
uniform vec3  uCameraPosition;
uniform float uDiseaseState;          // 0.0 = Healthy, 1.0 = Malignant/Cancer, 2.0 = Viral Capsid
uniform float uCorticalTension;
uniform float uRefractiveIndex;       // ~1.46 for lipid bilayer
uniform float uSubsurfaceDistortion;
uniform float uSubsurfacePower;
uniform float uSubsurfaceScale;
uniform vec3  uSubsurfaceColor;
uniform vec3  uBilayerLipidHeadColor;
uniform vec3  uCoreNucleusColor;
uniform float uCoreRadius;            // Internal organelle relative radius (~0.45)
uniform float uActinGridDensity;

// Cosine Color Palette (Inigo Quilez)
uniform vec3  uPaletteA;
uniform vec3  uPaletteB;
uniform vec3  uPaletteC;
uniform vec3  uPaletteD;

// Rupture & Voronoi Lysis Uniforms
uniform float uRuptureProgress;
uniform float uLysisEdgeGlow;
uniform vec3  uLysisGlowColor;

// Audio Energy
uniform vec4  uAudioBands;

// Varyings
varying vec3 vWorldPosition;
varying vec3 vWorldNormal;
varying vec3 vObjectPosition;
varying vec3 vViewNormal;
varying vec2 vUv;
varying float vDeformationIntensity;
varying float vActinIntegrity;
varying float vLocalRupture;

#define PI 3.1415926535897932384626433832795
#define TWO_PI 6.2831853071795864769252867665590

vec3 cosinePalette(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
    return a + b * cos(TWO_PI * (c * t + d));
}

vec2 hash22(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return fract(sin(p) * 43758.5453123);
}

float voronoiFilaments(vec2 uv, float density) {
    vec2 g = floor(uv * density);
    vec2 f = fract(uv * density);
    float d1 = 1.0;
    float d2 = 1.0;

    for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
            vec2 lattice = vec2(float(x), float(y));
            vec2 offset = hash22(g + lattice);
            vec2 diff = lattice + offset - f;
            float dist = length(diff);
            if (dist < d1) {
                d2 = d1;
                d1 = dist;
            } else if (dist < d2) {
                d2 = dist;
            }
        }
    }
    return d2 - d1;
}

vec3 computeSSS(vec3 lightDir, vec3 viewDir, vec3 normal, float thickness, vec3 sssColor) {
    vec3 vSubLight = lightDir + normal * uSubsurfaceDistortion;
    float fLdotV = pow(clamp(dot(viewDir, -vSubLight), 0.0, 1.0), uSubsurfacePower) * uSubsurfaceScale;
    return (fLdotV + 0.15) * (1.0 - thickness) * sssColor;
}

void main() {
    vec3 N = normalize(vWorldNormal);
    vec3 V = normalize(uCameraPosition - vWorldPosition);
    vec3 L1 = normalize(vec3(1.5, 3.0, 2.0));
    vec3 L2 = normalize(vec3(-2.0, -1.0, -1.5));

    // 1. Chromatic Fresnel Reflectance (Thin-film lipid dispersion)
    float F0 = 0.04;
    float nDotV = clamp(dot(N, V), 0.0, 1.0);
    float fresnelR = F0 + (1.0 - F0) * pow(1.0 - nDotV, 3.8);
    float fresnelG = F0 + (1.0 - F0) * pow(1.0 - nDotV, 4.4);
    float fresnelB = F0 + (1.0 - F0) * pow(1.0 - nDotV, 5.0);
    vec3 chromaticFresnel = vec3(fresnelR, fresnelG, fresnelB);

    // 2. Inigo Quilez Palette Disease State Grading
    float paletteT = vDeformationIntensity * 0.7 + uDiseaseState * 0.4 + uAudioBands.z * 0.3;
    vec3 baseMembraneColor = cosinePalette(paletteT, uPaletteA, uPaletteB, uPaletteC, uPaletteD);

    // 3. Cytoskeletal Actin Lattice (Filament web on inner membrane cortex)
    float actinLattice = voronoiFilaments(vUv * vec2(2.0, 1.0), uActinGridDensity);
    float filamentMask = smoothstep(0.04, 0.12, actinLattice);
    vec3 actinFilamentColor = mix(vec3(0.1, 0.8, 0.9), vec3(0.9, 0.2, 0.3), uDiseaseState);
    vec3 corticalLayer = mix(actinFilamentColor * 1.6, baseMembraneColor, filamentMask + (1.0 - vActinIntegrity) * 0.8);

    // 4. Subsurface Scattering (Semi-translucent bilayer)
    float estimatedThickness = clamp(length(vObjectPosition) * 0.7 + (1.0 - nDotV) * 0.3, 0.0, 1.0);
    vec3 sss1 = computeSSS(L1, V, N, estimatedThickness, uSubsurfaceColor);
    vec3 sss2 = computeSSS(L2, V, N, estimatedThickness, uSubsurfaceColor * 0.5);
    vec3 totalSSS = sss1 + sss2;

    // 5. Internal Dense Organelle / Chromatin Core Lighting
    float coreDist = length(vObjectPosition);
    float coreMask = smoothstep(uCoreRadius + 0.15, uCoreRadius - 0.1, coreDist);
    vec3 nucleusGlow = uCoreNucleusColor * coreMask * (1.2 + uAudioBands.x * 2.0);

    // 6. Diffuse & Specular Lighting
    float diff1 = max(dot(N, L1), 0.0);
    float diff2 = max(dot(N, L2), 0.0) * 0.35;
    vec3 diffuse = (diff1 + diff2) * corticalLayer;
    
    vec3 H1 = normalize(L1 + V);
    float spec1 = pow(max(dot(N, H1), 0.0), 48.0) * 0.8;
    vec3 specular = vec3(spec1) * (1.0 + chromaticFresnel * 2.0);

    // Composite Membrane Shading
    vec3 finalColor = diffuse + totalSSS + nucleusGlow + specular + chromaticFresnel * uBilayerLipidHeadColor * 1.5;

    // 7. Cavitation Lysis & Voronoi Perforation (Histotripsy rupture effect)
    if (uRuptureProgress > 0.001) {
        float ruptureVoronoi = voronoiFilaments(vUv, 24.0);
        float perforationThreshold = uRuptureProgress * 1.2;
        
        if (ruptureVoronoi < perforationThreshold) {
            float edgeDist = perforationThreshold - ruptureVoronoi;
            if (edgeDist < 0.08) {
                float edgeGlow = (1.0 - edgeDist / 0.08) * uLysisEdgeGlow;
                gl_FragColor = vec4(uLysisGlowColor * edgeGlow * 3.0, 1.0);
                return;
            }
            discard; // Membrane perforated open
        }
    }

    float alpha = clamp(0.72 + chromaticFresnel.g * 0.28 + coreMask * 0.25, 0.0, 1.0);
    gl_FragColor = vec4(finalColor, alpha);
}
`;
