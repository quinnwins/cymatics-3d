import { CYMATICS_CORE_GLSL } from './cymaticsCore';

export const CYMATICS_VERTEX_SHADER = `
${CYMATICS_CORE_GLSL}

// Simulation & Modal Wave Uniforms
uniform float uTime;
uniform vec4 uDrivePhases;
uniform vec3 uModes;                    // (n, m, l) modal wave numbers
uniform int uChamberType;              // 0 = Cube, 1 = Cylinder, 2 = Sphere
uniform float uFundamentalFreq;        // Resonant driving frequency (Hz)
uniform float uAcousticPressure;       // Acoustic intensity / driving pressure
uniform float uHarmonicMultiplier;
uniform vec4 uBandEnergies;            // x=SubBass, y=Bass, z=LowMid, w=Mid
uniform vec2 uHighEnergies;            // x=HighMid, y=High
uniform vec3 uCameraPos;

// Varyings to Fragment Shader
varying vec3 vWorldNormal;
varying vec3 vWorldPosition;
varying vec3 vViewPosition;
varying vec3 vLocalPosition;
varying vec2 vUv;
varying float vDisplacement;
varying float vNodalValue;
varying float vFluidEnergy;

// ----------------------------------------------------------------------------
// Physical 3D Levitating Acoustic Fluid Droplet Modal Deformation Field
// Computes multi-pole spherical harmonics, Faraday waves & Bessel modes
// ----------------------------------------------------------------------------
// Physical 3D Levitating Acoustic Fluid Droplet Modal Deformation Field
// Computes multi-pole spherical harmonics, Faraday waves & Bessel modes
// Dynamically driven by acoustic frequency spectrum and audio transients
// ----------------------------------------------------------------------------
float evalDropletModalDisplacement(vec3 p) {
    float r = length(p);
    if (r < 1e-5) return 0.0;
    vec3 n = p / r;
    float x = n.x, y = n.y, z = n.z;
    float x2 = x * x, y2 = y * y, z2 = z * z;

    float theta = acos(clamp(z, -1.0, 1.0));
    float phi = (abs(x) < 1e-6 && abs(y) < 1e-6) ? 0.0 : atan(y, x);

    float nMode = max(1.0, uModes.x);
    float mMode = max(1.0, uModes.y);
    float lMode = max(1.0, uModes.z);

    // Audio energy factors
    float subBass = uBandEnergies.x;
    float bass = uBandEnergies.y;
    float lowMid = uBandEnergies.z;
    float mid = uBandEnergies.w;
    float highMid = uHighEnergies.x;
    float high = uHighEnergies.y;

    // 1. L0 Monopole Breathing Mode (Volumetric Radial Pulsation)
    float Y00 = 0.28209479;
    float breathFreq = uFundamentalFreq * 0.02 + subBass * 6.0;
    float amp0 = (0.16 / (1.0 + 0.08 * nMode)) * (0.8 + subBass * 2.2);
    float dispL0 = amp0 * Y00 * sin(uDrivePhases.x);

    // 2. L1 Dipole Mode (Acoustic Radiation Levitation Axis Wobble)
    float Y10 = 0.48860251 * z;
    float Y11 = 0.48860251 * x;
    float amp1 = 0.09 * clamp(nMode / 2.5, 0.5, 2.0) * (0.6 + bass * 1.5);
    float dispL1 = amp1 * (Y10 * cos(uTime * 3.2) + Y11 * sin(uTime * 2.8));

    // 3. L2 Quadrupole Spheroidal Shear Mode (Prolate-Oblate Squash & Stretch)
    float Y20 = 0.31539157 * (3.0 * z2 - 1.0);
    float Y22 = 0.54627422 * (x2 - y2);
    float quadFreq = uFundamentalFreq * 0.04 + bass * 8.0;
    float amp2 = 0.24 * clamp(mMode / 1.8, 0.6, 2.5) * (0.7 + bass * 2.4 + subBass * 1.8);
    float dispL2 = amp2 * (Y20 * cos(uDrivePhases.y) + Y22 * sin(uDrivePhases.z));

    // 4. L3 Octupole Multi-Lobed Resonance (Tetrahedral & Clover Lobes)
    float Y30 = 0.37317633 * z * (5.0 * z2 - 3.0);
    float Y32 = 1.44530572 * z * (x2 - y2);
    float Y33 = 0.59004359 * x * (x2 - 3.0 * y2);
    float amp3 = 0.18 * clamp(lMode / 1.8, 0.5, 2.2) * (0.6 + lowMid * 2.2 + mid * 1.6);
    float dispL3 = amp3 * (Y30 * sin(uTime * 4.2) + Y32 * cos(uTime * 3.6 + phi * lMode) + Y33 * sin(uTime * 3.2 + phi * 2.0));

    // 5. L4 Star Lobes / Faraday Polygonal Waves (5-Point / 8-Point Star Droplet)
    float Y40 = 0.10578555 * (35.0 * z2 * z2 - 30.0 * z2 + 3.0);
    float Y44 = 0.59004359 * (x2 * (x2 - 3.0 * y2) - y2 * (3.0 * x2 - y2));
    float amp4 = 0.16 * clamp((nMode + mMode) / 3.5, 0.4, 2.2) * (0.6 + mid * 2.0 + highMid * 1.8);
    float dispL4 = amp4 * (Y40 * 0.35 + Y44 * cos(mMode * phi - uTime * 2.5));

    // 6. Radial Spherical Bessel Standing Wave Harmonics (Capillary Wave Ripple Skin)
    float k = PI * sqrt(nMode * nMode + mMode * mMode + lMode * lMode) * 0.75;
    float j0 = sphericalBessel_j0(k * r);
    float j2 = sphericalBessel_j2(k * r * 1.5);
    float dispBessel = (j0 * 0.12 + j2 * 0.09) * sin(uDrivePhases.w + phi * (mMode + 1.0)) * (0.7 + highMid * 2.2 + high * 2.5);

    // 7. Chamber Boundary & Multi-Frequency Harmonic Eigenstates
    float dispGeom = 0.0;
    if (uChamberType == 0) {
        dispGeom = cos(nMode * PI * x * 0.9) * cos(mMode * PI * y * 0.9) * cos(lMode * PI * z * 0.9) * 0.10;
    } else if (uChamberType == 1) {
        dispGeom = cos(mMode * phi) * cos(lMode * PI * z * 0.9) * 0.10;
    } else {
        dispGeom = cos(mMode * phi) * sin(lMode * theta) * 0.10;
    }
    dispGeom *= (0.8 + bass * 1.5);

    float totalDisp = (dispL0 + dispL1 + dispL2 + dispL3 + dispL4 + dispBessel + dispGeom);
    return totalDisp * uAcousticPressure * uHarmonicMultiplier;
}

void main() {
    vUv = uv;
    vec3 basePos = position;
    float r = length(basePos);
    vec3 n = r > 1e-5 ? basePos / r : vec3(0.0, 1.0, 0.0);
    vLocalPosition = basePos;

    // Evaluate exact cymatics fluid modal deformation
    float disp = evalDropletModalDisplacement(basePos);
    vDisplacement = disp;
    vNodalValue = abs(disp); // Near 0 = Nodal boundary plane / line
    vFluidEnergy = abs(disp) * 2.0 + uBandEnergies.x * 1.5 + uBandEnergies.y * 1.0;

    // Singularity-Free Orthonormal Tangent Frame (Frisvad / Duff formulation)
    vec3 tX, tY;
    buildOrthonormalBasis(n, tX, tY);

    float eps = 0.008;
    vec3 pX = basePos + tX * eps;
    vec3 pY = basePos + tY * eps;

    float dispX = evalDropletModalDisplacement(pX);
    float dispY = evalDropletModalDisplacement(pY);

    vec3 pDisplaced = basePos + n * disp;
    vec3 pXDisplaced = pX + (length(pX) > 1e-5 ? normalize(pX) : vec3(0.0, 1.0, 0.0)) * dispX;
    vec3 pYDisplaced = pY + (length(pY) > 1e-5 ? normalize(pY) : vec3(0.0, 1.0, 0.0)) * dispY;

    vec3 calcNormal = normalize(cross(pXDisplaced - pDisplaced, pYDisplaced - pDisplaced));

    vWorldNormal = normalize(normalMatrix * calcNormal);
    vec4 worldPos = modelMatrix * vec4(pDisplaced, 1.0);
    vWorldPosition = worldPos.xyz;

    vec4 mvPosition = modelViewMatrix * vec4(pDisplaced, 1.0);
    vViewPosition = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
}
`;

export const CYMATICS_FRAGMENT_SHADER = `
${CYMATICS_CORE_GLSL}

precision highp float;

// Uniforms
uniform float uTime;
uniform vec3 uCameraPos;
uniform vec3 uPaletteA;
uniform vec3 uPaletteB;
uniform vec3 uPaletteC;
uniform vec3 uPaletteD;
uniform vec3 uCoreGlow;
uniform vec3 uAccent;
uniform vec4 uBandEnergies;            // x=SubBass, y=Bass, z=LowMid, w=Mid
uniform vec2 uHighEnergies;            // x=HighMid, y=High
uniform vec3 uSubsurfaceColor;
uniform float uSubsurfacePower;
uniform float uSubsurfaceScale;

// Varyings
varying vec3 vWorldNormal;
varying vec3 vWorldPosition;
varying vec3 vViewPosition;
varying vec3 vLocalPosition;
varying vec2 vUv;
varying float vDisplacement;
varying float vNodalValue;
varying float vFluidEnergy;

// ----------------------------------------------------------------------------
// Forward Subsurface Scattering Approximation
// ----------------------------------------------------------------------------
vec3 computeFluidSSS(vec3 lightDir, vec3 viewDir, vec3 normal, float thickness, vec3 sssColor) {
    vec3 vSubLight = lightDir + normal * 0.45;
    float fLdotV = pow(clamp(dot(viewDir, -vSubLight), 0.0, 1.0), uSubsurfacePower) * uSubsurfaceScale;
    return (fLdotV + 0.12) * (1.0 - thickness) * sssColor;
}

void main() {
    vec3 N = length(vWorldNormal) > 1e-5 ? normalize(vWorldNormal) : vec3(0.0, 1.0, 0.0);
    vec3 V = length(vViewPosition) > 1e-5 ? normalize(vViewPosition) : vec3(0.0, 0.0, 1.0);

    // Double-sided lighting support
    if (!gl_FrontFacing) {
        N = -N;
    }

    float NdotV = clamp(dot(N, V), 0.0, 1.0);

    // 1. Calibrated 3-Point Studio Lighting Vectors & Colors
    // Key Light: 4500K Warm Key (3.0, 5.0, 4.0)
    vec3 L1 = normalize(vec3(3.0, 5.0, 4.0));
    vec3 keyColor = vec3(1.0, 0.94, 0.88) * 1.7;

    // Fill Light: 6500K Cool Fill (-4.0, 2.0, 3.0)
    vec3 L2 = normalize(vec3(-4.0, 2.0, 3.0));
    vec3 fillColor = vec3(0.85, 0.92, 1.0) * 0.85;

    // Rim / Back Light: Soft Neutral Back Light (0.0, 4.0, -5.0)
    vec3 L3 = normalize(vec3(0.0, 4.0, -5.0));
    vec3 rimLightColor = vec3(0.95, 0.98, 1.0) * 1.5;

    // 2. Fluid / Lipid Bilayer Chromatic Dispersion Fresnel Rim
    float F0 = 0.045;
    float fresnelR = F0 + (1.0 - F0) * pow(clamp(1.0 - NdotV, 0.0, 1.0), 3.6);
    float fresnelG = F0 + (1.0 - F0) * pow(clamp(1.0 - NdotV, 0.0, 1.0), 4.2);
    float fresnelB = F0 + (1.0 - F0) * pow(clamp(1.0 - NdotV, 0.0, 1.0), 4.8);
    vec3 chromaticFresnel = vec3(fresnelR, fresnelG, fresnelB);

    // 3. Subsurface Scattering (Semi-Translucent Organic Acoustic Fluid)
    float rLocal = length(vLocalPosition);
    float opticalThickness = clamp(rLocal * 0.42 + (1.0 - NdotV) * 0.35, 0.0, 1.0);
    vec3 sss1 = computeFluidSSS(L1, V, N, opticalThickness, uSubsurfaceColor);
    vec3 sss3 = computeFluidSSS(L3, V, N, opticalThickness, uSubsurfaceColor * 1.3);
    vec3 totalSSS = (sss1 * keyColor + sss3 * rimLightColor) * (1.0 + uBandEnergies.x * 1.4);

    // 4. Inigo Quilez Cosine Color Palette in OKLab Space
    float paletteCoord = rLocal * 0.28 + vDisplacement * 1.6;
    vec3 baseFluidColor = oklabCosinePalette(paletteCoord, uPaletteA, uPaletteB, uPaletteC, uPaletteD);

    // 5. Standing Wave Nodal Line Luminescence (Glows along acoustic equilibrium zones)
    float nodalLine = 1.0 - smoothstep(0.0, 0.09, vNodalValue);
    vec3 nodalGlow = uAccent * (nodalLine * 0.22) * (1.0 + uBandEnergies.z * 0.8);

    // 6. Internal Dense Resonant Core (Balanced acoustic pressure hotspot, calibrated for radius)
    float coreDist = rLocal;
    float coreMask = exp(-coreDist * coreDist * 4.5);
    vec3 internalCore = uCoreGlow * (coreMask * 0.30) * (1.0 + uBandEnergies.x * 0.8 + uBandEnergies.y * 0.5);

    // 7. Diffuse Lighting with Rich Base Color
    float diff1 = max(dot(N, L1), 0.0);
    float diff2 = max(dot(N, L2), 0.0);
    float diff3 = max(dot(N, L3), 0.0);
    vec3 diffuse = (diff1 * keyColor + diff2 * fillColor + diff3 * rimLightColor * 0.4) * baseFluidColor * 0.80;

    // 8. Dual-Lobe Blinn-Phong Specular (Wet Fluid Sheen & Wave Ridges)
    vec3 H1 = normalize(L1 + V);
    vec3 H3 = normalize(L3 + V);
    float spec1 = pow(max(dot(N, H1), 0.0), 64.0) * 1.2;
    float spec3 = pow(max(dot(N, H3), 0.0), 32.0) * 0.6;
    vec3 specular = (spec1 * keyColor + spec3 * rimLightColor) * (1.0 + chromaticFresnel * 1.2);

    // 9. Composite Fluid Shading with Energy-Conserving Tone Curve
    vec3 finalColor = diffuse + totalSSS * 0.30 + internalCore + nodalGlow + specular + chromaticFresnel * uAccent * 0.35;


    // Dynamic Organic Fluid Translucency (Permits back particles and internal core to shine through)
    float alpha = clamp(0.52 + chromaticFresnel.g * 0.35 + coreMask * 0.18, 0.22, 0.86);

    gl_FragColor = vec4(finalColor, alpha);
}
`;


