/**
 * cymaticsPlateShader.ts
 * SoundForm 3D - Physical 2D Resonant Cymatics / Chladni Sand Plate Shader Suite
 *
 * Implements genuine Chladni-Waller standing wave modal physics:
 * - Square plate Chladni eigenfunctions: a*cos(n*pi*x)*cos(m*pi*y) - b*cos(m*pi*x)*cos(n*pi*y)
 * - Circular Bessel plate eigenfunctions: J_m(k*r) * cos(m*theta)
 * - High-contrast dark satin metal plate with razor-sharp luminous sand mandalas
 * - Fully responsive to Wave Speed, Sound Absorption, Glow Brightness, Particle Density, and Particle Size
 * - Strict plate surface confinement (sand stays strictly on plate with zero drifting)
 */

import { CYMATICS_CORE_GLSL } from './cymaticsCore';

export const CYMATICS_PLATE_VERTEX_SHADER = `
${CYMATICS_CORE_GLSL}

uniform float uTime;
uniform vec3 uModes;               // (n, m, l) modal frequencies
uniform float uChamberType;        // 0.0 = Cartesian square plate, 1.0 = Circular Bessel plate
uniform float uFundamentalFreq;    // Audio fundamental frequency
uniform float uWaveSpeed;          // Wave propagation speed
uniform float uWaveDamping;        // Medium absorption / damping
uniform vec4 uBandEnergies;        // x=SubBass, y=Bass, z=LowMid, w=Mid
uniform vec2 uHighEnergies;        // x=HighMid, y=High
uniform float uPlateSize;          // Spatial diameter of plate

varying vec2 vLocalPos;
varying vec3 vWorldPos;
varying vec3 vNormal;
varying vec3 vViewPosition;
varying float vModalValue;
varying float vDisplacement;
varying float vNodalSharpness;

void main() {
    // Unrotated PlaneGeometry has local x in [-W/2, W/2] and y in [-H/2, H/2]
    vec2 p = position.xy / (uPlateSize * 0.5);
    vLocalPos = p;
    float r = length(p);
    float theta = atan(p.y, p.x);

    // Dynamic modal wave indices
    float nMode = max(1.0, uModes.x);
    float mMode = max(1.0, uModes.y);

    // 1. Classic Chladni-Waller Square Plate Standing Wave Equation:
    float chladni1 = cos(nMode * PI * p.x) * cos(mMode * PI * p.y) - 0.72 * cos(mMode * PI * p.x) * cos(nMode * PI * p.y);
    
    // Superposition with higher harmonic overtone
    float n2 = mMode + 1.0;
    float m2 = nMode + 2.0;
    float chladni2 = cos(n2 * PI * p.x) * cos(m2 * PI * p.y) - 0.65 * cos(m2 * PI * p.x) * cos(n2 * PI * p.y);
    float chladniSquare = chladni1 * 0.75 + chladni2 * 0.25 * (uBandEnergies.z * 1.5 + 0.3);

    // 2. Circular Bessel Cymatics Plate Equation:
    float besselArg1 = nMode * PI * r * 1.6;
    float bessel1 = evalBesselJ(mMode, besselArg1) * cos(mMode * theta);
    float besselArg2 = (nMode + 1.0) * PI * r * 2.0;
    float bessel2 = evalBesselJ(max(0.0, mMode - 1.0), besselArg2) * cos((mMode + 1.0) * theta);
    float chladniCircle = bessel1 * 0.8 + bessel2 * 0.2;

    // Blend between Square Chladni Plate and Circular Cymatics Plate
    float modalVal = mix(chladniSquare, chladniCircle, uChamberType);
    vModalValue = modalVal;

    // Speed-controlled wave vibration rate
    float speedFactor = uWaveSpeed * 0.18;
    float vibrationFreq = uTime * (uFundamentalFreq * 0.05 + 16.0) * speedFactor;
    
    // Treble harmonic ripple
    float trebleRipple = sin(r * (uFundamentalFreq * 0.04 + 14.0) - uTime * 6.0 * speedFactor) * uHighEnergies.x * 0.06;

    // Physical Vertical Plate Flexure (Displacement along local Z axis)
    float bassKick = uBandEnergies.x * 1.8 + uBandEnergies.y * 1.2;
    float dispZ = (modalVal * 0.06 + trebleRipple * 0.015) * sin(vibrationFreq) * (1.0 + bassKick * 1.4);
    
    // Damping-controlled boundary attenuation
    float edgeDist = mix(max(abs(p.x), abs(p.y)), r, uChamberType);
    float dampingWidth = clamp(1.0 - uWaveDamping * 1.2, 0.75, 0.98);
    float edgeDamping = smoothstep(1.01, dampingWidth, edgeDist);
    dispZ *= edgeDamping;
    vDisplacement = dispZ;
    vNodalSharpness = edgeDamping;

    // Displace vertex along local Z (which points UP in world Y after mesh rotation)
    vec3 displacedPos = position + vec3(0.0, 0.0, dispZ);
    
    // Compute normal perturbation from wave spatial gradient
    float eps = 0.015;
    float p1_x = cos(nMode * PI * (p.x + eps)) * cos(mMode * PI * p.y) - 0.72 * cos(mMode * PI * (p.x + eps)) * cos(nMode * PI * p.y);
    float p1_y = cos(nMode * PI * p.x) * cos(mMode * PI * (p.y + eps)) - 0.72 * cos(mMode * PI * p.x) * cos(nMode * PI * (p.y + eps));
    float dP_dx = (p1_x - chladni1) / eps;
    float dP_dy = (p1_y - chladni1) / eps;
    
    vec3 perturbedNormal = normalize(vec3(-dP_dx * dispZ * 2.5, -dP_dy * dispZ * 2.5, 1.0));
    vNormal = normalize(normalMatrix * perturbedNormal);

    vec4 worldPos4 = modelMatrix * vec4(displacedPos, 1.0);
    vWorldPos = worldPos4.xyz;
    
    vec4 mvPosition = modelViewMatrix * vec4(displacedPos, 1.0);
    vViewPosition = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
}
`;

export const CYMATICS_PLATE_FRAGMENT_SHADER = `
${CYMATICS_CORE_GLSL}

uniform float uTime;
uniform float uChamberType;
uniform vec3 uModes;
uniform float uWaveDamping;
uniform vec4 uBandEnergies;
uniform vec2 uHighEnergies;

// Palette & Radiant Colors
uniform vec3 uPaletteA;
uniform vec3 uPaletteB;
uniform vec3 uPaletteC;
uniform vec3 uPaletteD;
uniform vec3 uCoreGlow;
uniform vec3 uAccent;

varying vec2 vLocalPos;
varying vec3 vWorldPos;
varying vec3 vNormal;
varying vec3 vViewPosition;
varying float vModalValue;
varying float vDisplacement;
varying float vNodalSharpness;

// Hash functions for multi-scale procedural sand grain micro-texture
float hash21(vec2 p) {
    p = fract(p * vec2(234.34, 435.345));
    p += dot(p, p + 34.23);
    return fract(p.x * p.y);
}

float sandNoise(vec2 p) {
    float n1 = hash21(p * 500.0);
    float n2 = hash21(p * 1000.0 + 17.3);
    return n1 * 0.65 + n2 * 0.35;
}

void main() {
    vec2 p = vLocalPos;
    float r = length(p);
    
    // Boundary perimeter clip
    float edgeDist = mix(max(abs(p.x), abs(p.y)), r, uChamberType);
    if (edgeDist > 1.005) {
        discard;
    }

    vec3 N = length(vNormal) > 1e-4 ? normalize(vNormal) : vec3(0.0, 1.0, 0.0);
    vec3 V = length(vViewPosition) > 1e-4 ? normalize(vViewPosition) : vec3(0.0, 0.0, 1.0);
    float NdotV = clamp(dot(N, V), 0.0, 1.0);
    float fresnel = pow(1.0 - NdotV, 4.0);

    // ========================================================================
    // 1. Dark Anodized Carbon-Steel Acoustic Base Plate (High Contrast)
    // ========================================================================
    // Sleek, deep obsidian metal plate with subtle brushed concentric finish
    vec3 metalPlate = vec3(0.012, 0.014, 0.018);
    float latheTexture = sin(r * 180.0) * 0.015;
    metalPlate += latheTexture;

    // ========================================================================
    // 2. Physical Chladni Nodal Lines & Sand Accumulation (w = 0)
    // ========================================================================
    float nodalDist = abs(vModalValue);
    
    // Anti-aliased nodal curve sharpness using screen-space derivatives
    float dP_screen = nodalDist / (fwidth(vModalValue) * 1.75 + 0.0008);
    float nodalCore = smoothstep(1.0, 0.0, dP_screen);
    float nodalGlowZone = exp(-nodalDist * 16.0);

    // Sand grain texture specifically on the nodal lines
    float grain = sandNoise(p);
    float sandCoverage = smoothstep(0.18, 0.90, nodalGlowZone * (0.5 + grain * 0.9));

    // ========================================================================
    // 3. OKLab Palette Theming & Vibrant Sand Color
    // ========================================================================
    float tPal = clamp(r * 0.35 + nodalDist * 0.4, 0.0, 1.0);
    vec3 paletteColor = oklabCosinePalette(tPal, uPaletteA, uPaletteB, uPaletteC, uPaletteD);

    // High-contrast luminous quartz sand grains
    vec3 sandGrainColor = mix(vec3(0.95, 0.97, 1.0), uAccent * 0.85, 0.35);
    
    // Radiant neon core strictly along the nodal line center
    float bassAgitation = uBandEnergies.x * 1.8 + uBandEnergies.y * 1.2;
    vec3 nodalLight = appleRadiantGlow(paletteColor, nodalCore * (1.8 + bassAgitation * 1.2), 0.85);

    // ========================================================================
    // 4. Studio Specular Highlights on Dark Metal
    // ========================================================================
    vec3 L1 = normalize(vec3(3.0, 5.0, 3.5));
    vec3 H1 = normalize(L1 + V);
    float spec1 = pow(max(dot(N, H1), 0.0), 48.0);
    
    vec3 L2 = normalize(vec3(-3.5, 2.5, -2.5));
    vec3 H2 = normalize(L2 + V);
    float spec2 = pow(max(dot(N, H2), 0.0), 24.0);

    vec3 metalSpecular = vec3(spec1 * 0.45 + spec2 * 0.25) * mix(vec3(1.0), uAccent, 0.15);

    // ========================================================================
    // 5. Center Acoustic Exciter Standoff & Subtle Dark Bevel Rim
    // ========================================================================
    float centerExciter = smoothstep(0.07, 0.035, r);
    vec3 exciterColor = mix(vec3(0.08, 0.10, 0.14), uAccent * 1.8, 0.4 + bassAgitation * 0.25);

    // Crisp, subtle rim bevel (clean dark border, zero blown-out glow)
    float chamferHighlight = smoothstep(0.985, 0.998, edgeDist) * 0.4;
    vec3 rimHighlight = mix(vec3(0.2, 0.25, 0.35), uAccent, 0.5) * chamferHighlight;

    // ========================================================================
    // 6. Final High-Contrast Composite
    // ========================================================================
    vec3 finalColor = metalPlate;
    
    // Add nodal line core light
    finalColor += nodalLight * (nodalCore * 0.65 + nodalGlowZone * 0.10);
    
    // Overlay crisp sand mandalas
    finalColor = mix(finalColor, sandGrainColor, sandCoverage * 0.92);
    
    // Center exciter mount & beveled rim highlight
    finalColor = mix(finalColor, exciterColor, centerExciter * 0.85);
    finalColor += rimHighlight;
    
    // Metallic specular & subtle edge fresnel
    finalColor += metalSpecular;
    finalColor += uCoreGlow * (fresnel * 0.15);

    // Anti-aliased outer edge opacity
    float alpha = smoothstep(1.005, 0.988, edgeDist);

    gl_FragColor = vec4(finalColor, alpha);
}
`;

export const PLATE_DUST_VERTEX_SHADER = `
${CYMATICS_CORE_GLSL}

uniform float uTime;
uniform vec3 uModes;
uniform float uChamberType;
uniform float uFundamentalFreq;
uniform float uWaveSpeed;
uniform float uWaveDamping;
uniform vec4 uBandEnergies;
uniform vec2 uHighEnergies;
uniform float uParticleScale;
uniform float uPlateSize;

uniform vec3 uPaletteA;
uniform vec3 uPaletteB;
uniform vec3 uPaletteC;
uniform vec3 uPaletteD;
uniform vec3 uCoreGlow;
uniform vec3 uAccent;

attribute float aParticleSeed;
attribute float aParticlePhase;

varying vec4 vColor;
varying float vIntensity;

void main() {
    // Initial particle coordinates distributed across the plate surface
    vec3 p0 = position;
    vec2 p = p0.xz / (uPlateSize * 0.5);
    float r = length(p);
    float theta = atan(p.y, p.x);

    float nMode = max(1.0, uModes.x);
    float mMode = max(1.0, uModes.y);

    // 1. Physical Chladni standing wave modal value at this coordinate
    float chladni1 = cos(nMode * PI * p.x) * cos(mMode * PI * p.y) - 0.72 * cos(mMode * PI * p.x) * cos(nMode * PI * p.y);
    float n2 = mMode + 1.0;
    float m2 = nMode + 2.0;
    float chladni2 = cos(n2 * PI * p.x) * cos(m2 * PI * p.y) - 0.65 * cos(m2 * PI * p.x) * cos(n2 * PI * p.y);
    float chladniSquare = chladni1 * 0.75 + chladni2 * 0.25 * (uBandEnergies.z * 1.5 + 0.3);

    float besselArg1 = nMode * PI * r * 1.6;
    float bessel1 = evalBesselJ(mMode, besselArg1) * cos(mMode * theta);
    float besselArg2 = (nMode + 1.0) * PI * r * 2.0;
    float bessel2 = evalBesselJ(max(0.0, mMode - 1.0), besselArg2) * cos((mMode + 1.0) * theta);
    float chladniCircle = bessel1 * 0.8 + bessel2 * 0.2;

    float modalVal = mix(chladniSquare, chladniCircle, uChamberType);

    // 2. Exact Analytical & Numerical Gradient of Acoustic Modal Field
    vec2 gradP;
    if (uChamberType < 0.5) {
        // Analytical derivative for Cartesian Square Plate (High performance, exact gradient)
        float dC1_dx = -nMode * PI * sin(nMode * PI * p.x) * cos(mMode * PI * p.y) + 0.72 * mMode * PI * sin(mMode * PI * p.x) * cos(nMode * PI * p.y);
        float dC1_dy = -mMode * PI * cos(nMode * PI * p.x) * sin(mMode * PI * p.y) + 0.72 * nMode * PI * cos(mMode * PI * p.x) * sin(nMode * PI * p.y);
        
        float dC2_dx = -n2 * PI * sin(n2 * PI * p.x) * cos(m2 * PI * p.y) + 0.65 * m2 * PI * sin(m2 * PI * p.x) * cos(n2 * PI * p.y);
        float dC2_dy = -m2 * PI * cos(n2 * PI * p.x) * sin(m2 * PI * p.y) + 0.65 * n2 * PI * cos(m2 * PI * p.x) * sin(n2 * PI * p.y);
        
        float overtoneWeight = 0.25 * (uBandEnergies.z * 1.5 + 0.3);
        gradP = vec2(dC1_dx * 0.75 + dC2_dx * overtoneWeight, dC1_dy * 0.75 + dC2_dy * overtoneWeight);
    } else {
        // Efficient finite-difference gradient for Circular Bessel Plate
        float eps = 0.015;
        vec2 p_dx = p + vec2(eps, 0.0);
        vec2 p_dy = p + vec2(0.0, eps);
        float r_dx = length(p_dx);
        float th_dx = atan(p_dx.y, p_dx.x);
        float b_dx = evalBesselJ(mMode, nMode * PI * r_dx * 1.6) * cos(mMode * th_dx);
        float r_dy = length(p_dy);
        float th_dy = atan(p_dy.y, p_dy.x);
        float b_dy = evalBesselJ(mMode, nMode * PI * r_dy * 1.6) * cos(mMode * th_dy);
        gradP = vec2((b_dx - bessel1) / eps, (b_dy - bessel1) / eps);
    }

    float gradLen = length(gradP);
    vec2 normGrad = gradLen > 1e-4 ? gradP / gradLen : vec2(0.0);

    // 3. Gor'kov Acoustic Radiation Trapping Force:
    // Pushes sand grains precisely toward nodal lines (modalVal == 0)
    float bassKick = uBandEnergies.x * 1.8 + uBandEnergies.y * 1.2;
    float gorkovStrength = 0.88 + uBandEnergies.x * 0.35 + uBandEnergies.y * 0.20;
    float distToNode = modalVal / (gradLen + 0.18);
    vec2 trapDisp = -distToNode * normGrad * gorkovStrength;

    // 4. Acoustic Micro-Streaming Surface Jitter & Dynamic Beat Dancing
    float speedFactor = uWaveSpeed * 0.18;
    float streamSpeed = uTime * (2.2 + bassKick * 3.2) * speedFactor + aParticlePhase;
    vec2 streamVortex = vec2(
        sin(p.y * 5.0 + streamSpeed + aParticleSeed * 6.28),
        cos(p.x * 5.0 + streamSpeed + aParticleSeed * 6.28)
    ) * (0.008 + bassKick * 0.022 + uBandEnergies.z * 0.015);

    vec2 finalP = p + trapDisp + streamVortex;
    
    // Strict Boundary Clamping: Sand stays strictly inside the plate perimeter rim
    if (uChamberType < 0.5) {
        finalP = clamp(finalP, vec2(-0.93), vec2(0.93));
    } else {
        float finalR = length(finalP);
        if (finalR > 0.93) {
            finalP = (finalP / finalR) * 0.93;
        }
    }
    
    // 5. Strict Surface Confinement (Sand rides directly ON the vibrating plate metal)
    float plateDispY = (modalVal * 0.04) * sin(uTime * (uFundamentalFreq * 0.05 + 16.0) * speedFactor) * (1.0 + bassKick);
    
    // Micro-vibration skittering height directly on the metal surface
    float microSkitter = abs(modalVal) * (0.0025 + bassKick * 0.007) * (0.5 + 0.5 * sin(uTime * 30.0 * speedFactor + aParticlePhase * 5.0));
    
    // Sand rests flat right on the plate surface
    float yPos = 0.004 + plateDispY + microSkitter;

    // Convert to local coordinates on top of the plate
    vec3 localPos = vec3(finalP.x * (uPlateSize * 0.5), yPos, finalP.y * (uPlateSize * 0.5));

    // Color palette evaluation
    float tPal = clamp(r * 0.35 + abs(modalVal) * 0.4, 0.0, 1.0);
    vec3 palColor = oklabCosinePalette(tPal, uPaletteA, uPaletteB, uPaletteC, uPaletteD);
    
    // Nodal sand particles glow with crisp quartz white / golden accent tint
    float isNodal = smoothstep(0.28, 0.0, abs(modalVal));
    vec3 dustColor = mix(palColor, uAccent * 0.85, 0.35 + isNodal * 0.45);
    dustColor += vec3(isNodal * 0.12);
    
    vColor = vec4(dustColor, 0.36 + isNodal * 0.12);
    vIntensity = 0.65 + isNodal * 0.25;

    vec4 mvPosition = modelViewMatrix * vec4(localPos, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    // Crisp fine quartz sand grain point scale
    float pSize = (uParticleScale * 10.0) / (-mvPosition.z);
    gl_PointSize = clamp(pSize * (0.7 + aParticleSeed * 0.4 + isNodal * 0.3), 1.0, 12.0);
}
`;

export const PLATE_DUST_FRAGMENT_SHADER = `
varying vec4 vColor;
varying float vIntensity;

void main() {
    // Crisp circular granular sand grain sprite
    vec2 coord = gl_PointCoord - vec2(0.5);
    float r = length(coord);
    if (r > 0.5) discard;

    // High-resolution anti-aliased sand grain boundary
    float alpha = smoothstep(0.5, 0.2, r);
    float coreHotness = smoothstep(0.25, 0.0, r);

    vec3 rgb = vColor.rgb * vIntensity + vec3(coreHotness * 0.4);
    gl_FragColor = vec4(rgb, alpha * vColor.a);
}
`;
