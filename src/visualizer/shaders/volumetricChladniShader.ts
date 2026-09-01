/**
 * SoundForm 3D - Volumetric Chladni Acoustic Raymarching Shaders
 * 
 * Mathematical Physics & Raymarching Features:
 * 1. Three Chamber Geometries:
 *    - Chamber 0 (Rectangular Cavity): Standing wave modes with degenerate modal superposition
 *      p(x,y,z) = alpha * p_{n,m,l} + beta * p_{m,l,n} + gamma * p_{l,n,m}
 *    - Chamber 1 (Cylindrical Chamber): Radial Bessel tubes, azimuthal petal planes, axial disks
 *      p(r, theta, z) = J_m(k_{m,n} r) * cos(m * theta) * cos(l * pi * z / L_z)
 *    - Chamber 2 (Spherical Chamber): Radial spherical Bessel shells, Legendre conical nodal petals, meridional slices
 *      p(r, theta, phi) = j_l(k * r) * P_l^m(cos theta) * cos(m * phi)
 * 2. Volumetric Raymarching with Taubin First-Order Distance Approximation:
 *    d(x) = |p(x)| / (||grad p(x)|| + eps)
 * 3. Optical Absorption-Emission Integration:
 *    - Smooth Gaussian core around p = 0 (translucent acoustic nodal membranes)
 *    - Surface normal N = grad p / ||grad p|| for physical Fresnel edge lighting,
 *      chromatic thin-film dispersion, and Inigo Quilez cosine palette coloring
 *    - Crisp chamber boundary clipping & faint glass envelope casing glow
 * 4. Branchless continuous modal interpolation (n, m, l) for buttery-smooth slider morphing
 */

export const VOLUMETRIC_CHLADNI_VERTEX_SHADER = `
varying vec3 vObjectPosition;
varying vec3 vWorldPosition;
varying vec3 vWorldNormal;
varying vec3 vObjectCameraPosition;

uniform mat4 uInverseModelMatrix;

void main() {
    vObjectPosition = position;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    vWorldNormal = normalize(normalMatrix * normal);

    // Calculate camera origin in canonical object coordinates [-1, 1]^3
    vObjectCameraPosition = (uInverseModelMatrix * vec4(cameraPosition, 1.0)).xyz;

    gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

export const VOLUMETRIC_CHLADNI_FRAGMENT_SHADER = `
#define PI 3.1415926535897932384626433832795
#define TWO_PI 6.2831853071795864769252867665590
#define HALF_PI 1.5707963267948966192313216916398

// Precision & Quality Settings
precision highp float;
precision highp int;

// ----------------------------------------------------------------------------
// Uniforms
// ----------------------------------------------------------------------------
uniform float uTime;
uniform int uChamberType;              // 0 = Rectangular, 1 = Cylindrical, 2 = Spherical
uniform vec3 uModes;                    // (n, m, l) modal wave numbers (continuous floats)
uniform vec3 uSuperposition;          // (alpha, beta, gamma) mixing weights for degenerate modes
uniform vec3 uChamberSize;            // Dimensions (Lx, Ly, Lz) / Radius
uniform float uThickness;              // Gaussian membrane core thickness sigma
uniform float uAbsorption;             // Optical absorption coefficient
uniform int uStepCount;                // Raymarching step count (e.g. 64 to 128)
uniform float uFresnelPower;           // Physical Fresnel exponent
uniform float uChromaticDispersion;    // Spectral thin-film dispersion strength

// Audio Reactivity Uniforms
uniform vec4 uBandEnergies;            // x=SubBass, y=Bass, z=LowMid, w=Mid
uniform vec2 uHighEnergies;            // x=HighMid, y=High
uniform float uFundamentalFreq;        // Fundamental Hz

// Inigo Quilez Cosine Palette Uniforms
uniform vec3 uPaletteA;
uniform vec3 uPaletteB;
uniform vec3 uPaletteC;
uniform vec3 uPaletteD;
uniform vec3 uCoreGlow;
uniform vec3 uAccent;

// Varyings
varying vec3 vObjectPosition;
varying vec3 vWorldPosition;
varying vec3 vWorldNormal;
varying vec3 vObjectCameraPosition;

// ----------------------------------------------------------------------------
// Inigo Quilez Cosine Color Palette
// ----------------------------------------------------------------------------
vec3 cosinePalette(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
    return a + b * cos(TWO_PI * (c * t + d));
}

// ----------------------------------------------------------------------------
// Continuous Cylindrical Bessel Function J_m(u) via Gauss-Chebyshev Quadrature
// Branchless, unconditionally stable, C^infinity smooth for continuous m >= 0 and u >= 0
// ----------------------------------------------------------------------------
float evalBesselJ(float m, float u) {
    float sum = 0.0;
    const int N = 16;
    for (int i = 0; i < N; i++) {
        float tau = PI * (float(i) + 0.5) / float(N);
        sum += cos(m * tau - u * sin(tau));
    }
    return sum / float(N);
}

// ----------------------------------------------------------------------------
// Continuous Spherical Bessel Function j_l(u)
// Uses j_l(u) = sqrt(pi / (2u)) * J_{l+0.5}(u) with series safeguard near u -> 0
// ----------------------------------------------------------------------------
float evalSphericalBessel(float l, float u) {
    float absU = abs(u);
    if (absU < 0.08) {
        // Taylor series near u -> 0: u^l / (2l+1)!!
        float u2 = absU * absU;
        if (l < 0.5) {
            return 1.0 - u2 * (1.0 / 6.0) + u2 * u2 * (1.0 / 120.0);
        } else if (l < 1.5) {
            return absU * (1.0 / 3.0) - absU * u2 * (1.0 / 30.0);
        } else if (l < 2.5) {
            return u2 * (1.0 / 15.0) - u2 * u2 * (1.0 / 210.0);
        } else {
            return (u2 * absU) * (1.0 / 105.0);
        }
    }
    float besselVal = evalBesselJ(l + 0.5, absU);
    return sqrt(HALF_PI / absU) * besselVal;
}

// ----------------------------------------------------------------------------
// Continuous Associated Legendre Function P_l^m(cos theta)
// Evaluated on w = cos(theta) with smooth Hermite interpolation between integer degrees
// ----------------------------------------------------------------------------
float evalLegendreP(float l, float m, float w) {
    float s = sqrt(max(0.0, 1.0 - w * w));
    int l0 = int(floor(clamp(l, 0.0, 4.0)));
    int m0 = int(floor(clamp(m, 0.0, float(l0))));
    
    // Evaluate basis polynomials up to l=4, m=4
    float p00 = 1.0;
    float p10 = w;
    float p11 = -s;
    float p20 = 0.5 * (3.0 * w * w - 1.0);
    float p21 = -3.0 * w * s;
    float p22 = 3.0 * (1.0 - w * w);
    float p30 = 0.5 * (5.0 * w * w * w - 3.0 * w);
    float p31 = -1.5 * (5.0 * w * w - 1.0) * s;
    float p32 = 15.0 * w * (1.0 - w * w);
    float p33 = -15.0 * s * s * s;
    float p40 = 0.125 * (35.0 * w * w * w * w - 30.0 * w * w + 3.0);
    float p41 = -2.5 * (7.0 * w * w * w - 3.0 * w) * s;
    float p42 = 7.5 * (7.0 * w * w - 1.0) * (1.0 - w * w);
    float p43 = -105.0 * w * s * s * s;
    float p44 = 105.0 * (1.0 - w * w) * (1.0 - w * w);

    float val = 0.0;
    if (l0 == 0) {
        val = p00;
    } else if (l0 == 1) {
        val = (m0 == 0) ? p10 : p11;
    } else if (l0 == 2) {
        val = (m0 == 0) ? p20 : (m0 == 1 ? p21 : p22);
    } else if (l0 == 3) {
        val = (m0 == 0) ? p30 : (m0 == 1 ? p31 : (m0 == 2 ? p32 : p33));
    } else {
        val = (m0 == 0) ? p40 : (m0 == 1 ? p41 : (m0 == 2 ? p42 : (m0 == 3 ? p43 : p44)));
    }

    // Continuous fractional blending across degrees
    float lFrac = fract(l);
    if (lFrac > 0.001) {
        float nextVal = p40;
        if (l0 == 0) nextVal = (m0 == 0 ? p10 : p11);
        else if (l0 == 1) nextVal = (m0 == 0 ? p20 : (m0 == 1 ? p21 : p22));
        else if (l0 == 2) nextVal = (m0 == 0 ? p30 : (m0 == 1 ? p31 : (m0 == 2 ? p32 : p33)));
        else if (l0 == 3) nextVal = (m0 == 0 ? p40 : (m0 == 1 ? p41 : (m0 == 2 ? p42 : (m0 == 3 ? p43 : p44))));
        val = mix(val, nextVal, smoothstep(0.0, 1.0, lFrac));
    }

    return val;
}

// ----------------------------------------------------------------------------
// Acoustic Resonator Pressure Fields p(x,y,z)
// ----------------------------------------------------------------------------

// 1. Rectangular Cavity Resonator Mode
float evalRectangularCavity(vec3 p, vec3 modes, vec3 weights) {
    vec3 mapped = (p + vec3(1.0)) * 0.5 * PI; // Maps [-1, 1] -> [0, PI]
    
    // Primary mode: p_{n,m,l}
    float p1 = cos(modes.x * mapped.x) * cos(modes.y * mapped.y) * cos(modes.z * mapped.z);
    
    // Degenerate permutated mode: p_{m,l,n}
    float p2 = cos(modes.y * mapped.x) * cos(modes.z * mapped.y) * cos(modes.x * mapped.z);
    
    // Degenerate permutated mode: p_{l,n,m}
    float p3 = cos(modes.z * mapped.x) * cos(modes.x * mapped.y) * cos(modes.y * mapped.z);

    return weights.x * p1 + weights.y * p2 + weights.z * p3;
}

// 2. Cylindrical Chamber Resonator Mode
float evalCylindricalChamber(vec3 p, vec3 modes) {
    float r = length(p.xy);
    float theta = atan(p.y, p.x);
    float zMapped = (p.z + 1.0) * 0.5 * PI;

    float n = max(0.5, modes.x);
    float m = max(0.0, modes.y);
    float l = max(0.0, modes.z);

    // Radial wavenumber k for n cylindrical nodes inside radius R = 1.0
    float k = PI * (n + 0.5 * m + 0.25);
    float besselRadial = evalBesselJ(m, k * r);
    float angularPetals = cos(m * theta);
    float axialDisks = cos(l * zMapped);

    return besselRadial * angularPetals * axialDisks;
}

// 3. Spherical Chamber Resonator Mode
float evalSphericalChamber(vec3 p, vec3 modes) {
    float r = length(p);
    if (r < 1e-5) return 1.0;
    
    float cosTheta = clamp(p.z / r, -1.0, 1.0);
    float phi = atan(p.y, p.x);

    float n = max(0.5, modes.x);
    float m = max(0.0, modes.y);
    float l = max(0.0, modes.z);

    // Radial wavenumber k for n spherical shells inside radius R = 1.0
    float k = PI * (n + 0.5 * l);
    float radialSphericalBessel = evalSphericalBessel(l, k * r);
    float conicalPetals = evalLegendreP(l, m, cosTheta);
    float azimuthalSlices = cos(m * phi);

    return radialSphericalBessel * conicalPetals * azimuthalSlices;
}

// Unified Pressure Field Evaluator
float evaluatePressure(vec3 p) {
    // Dynamic slow acoustic phase drift
    float timeOsc = sin(uTime * 0.5) * 0.05 * uBandEnergies.y;

    if (uChamberType == 0) {
        return evalRectangularCavity(p, uModes, uSuperposition) + timeOsc;
    } else if (uChamberType == 1) {
        return evalCylindricalChamber(p, uModes) + timeOsc;
    } else {
        return evalSphericalChamber(p, uModes) + timeOsc;
    }
}

// ----------------------------------------------------------------------------
// Analytical / Finite-Difference Gradient & Taubin Distance Approximation
// ----------------------------------------------------------------------------
vec3 computeGradient(vec3 p, out float pVal) {
    pVal = evaluatePressure(p);
    float maxK = PI * (max(uModes.x, max(uModes.y, uModes.z)) + 1.0);
    float h = clamp(0.035 / maxK, 0.0015, 0.008);
    vec3 grad;
    grad.x = evaluatePressure(p + vec3(h, 0.0, 0.0)) - evaluatePressure(p - vec3(h, 0.0, 0.0));
    grad.y = evaluatePressure(p + vec3(0.0, h, 0.0)) - evaluatePressure(p - vec3(0.0, h, 0.0));
    grad.z = evaluatePressure(p + vec3(0.0, 0.0, h)) - evaluatePressure(p - vec3(0.0, 0.0, h));
    return grad / (2.0 * h);
}

// Taubin First-Order Distance: d(x) = |p(x)| / (||grad p(x)|| + eps)
float computeTaubinDistance(vec3 p, out vec3 normal, out float pVal) {
    vec3 grad = computeGradient(p, pVal);
    float gradLen = length(grad);
    normal = (gradLen > 1e-5) ? (grad / gradLen) : vec3(0.0, 1.0, 0.0);
    return abs(pVal) / (gradLen + 1e-4);
}

// ----------------------------------------------------------------------------
// Boundary Clipping Tests with Smoothstep Edge Softness
// ----------------------------------------------------------------------------
float getChamberConfinement(vec3 p) {
    if (uChamberType == 0) {
        vec3 d = abs(p);
        float maxD = max(max(d.x, d.y), d.z);
        return smoothstep(1.02, 0.98, maxD);
    } else if (uChamberType == 1) {
        float r = length(p.xy);
        float z = abs(p.z);
        return smoothstep(1.02, 0.98, r) * smoothstep(1.02, 0.98, z);
    } else {
        float r = length(p);
        return smoothstep(1.02, 0.98, r);
    }
}

bool isInsideChamber(vec3 p) {
    return getChamberConfinement(p) > 0.001;
}

// ----------------------------------------------------------------------------
// Analytical Ray-Chamber Bounding Volume Intersections
// ----------------------------------------------------------------------------
bool intersectBoundingBox(vec3 ro, vec3 rd, vec3 boxMin, vec3 boxMax, out float tNear, out float tFar) {
    vec3 invR = 1.0 / (rd + vec3(1e-12 * sign(rd.x), 1e-12 * sign(rd.y), 1e-12 * sign(rd.z)));
    vec3 t0 = (boxMin - ro) * invR;
    vec3 t1 = (boxMax - ro) * invR;
    vec3 tmin = min(t0, t1);
    vec3 tmax = max(t0, t1);
    tNear = max(max(tmin.x, tmin.y), tmin.z);
    tFar = min(min(tmax.x, tmax.y), tmax.z);
    return tFar > max(tNear, 0.0);
}

bool intersectBoundingCylinder(vec3 ro, vec3 rd, out float tNear, out float tFar) {
    float a = rd.x * rd.x + rd.y * rd.y;
    float b = 2.0 * (ro.x * rd.x + ro.y * rd.y);
    float c = ro.x * ro.x + ro.y * ro.y - 1.0;

    float tCylNear = -1e9;
    float tCylFar = 1e9;

    if (a > 1e-6) {
        float discr = b * b - 4.0 * a * c;
        if (discr < 0.0) return false;
        float sqrtDiscr = sqrt(discr);
        tCylNear = (-b - sqrtDiscr) / (2.0 * a);
        tCylFar = (-b + sqrtDiscr) / (2.0 * a);
    } else if (c > 0.0) {
        return false;
    }

    // Intersect with z-caps [-1, 1]
    float invRz = 1.0 / (abs(rd.z) > 1e-6 ? rd.z : 1e-6);
    float tz0 = (-1.0 - ro.z) * invRz;
    float tz1 = (1.0 - ro.z) * invRz;
    float tzNear = min(tz0, tz1);
    float tzFar = max(tz0, tz1);

    tNear = max(tCylNear, tzNear);
    tFar = min(tCylFar, tzFar);

    return tFar > max(tNear, 0.0);
}

bool intersectBoundingSphere(vec3 ro, vec3 rd, out float tNear, out float tFar) {
    float b = dot(ro, rd);
    float c = dot(ro, ro) - 1.0;
    float discr = b * b - c;
    if (discr < 0.0) return false;
    float sqrtDiscr = sqrt(discr);
    tNear = -b - sqrtDiscr;
    tFar = -b + sqrtDiscr;
    return tFar > max(tNear, 0.0);
}

bool getChamberRayInterval(vec3 ro, vec3 rd, out float tNear, out float tFar) {
    if (uChamberType == 0) {
        return intersectBoundingBox(ro, rd, vec3(-1.0), vec3(1.0), tNear, tFar);
    } else if (uChamberType == 1) {
        return intersectBoundingCylinder(ro, rd, tNear, tFar);
    } else {
        return intersectBoundingSphere(ro, rd, tNear, tFar);
    }
}

// ----------------------------------------------------------------------------
// Low-Discrepancy Screen Dither Hash (Eliminates Banding Artifacts)
// ----------------------------------------------------------------------------
float screenHash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

// ----------------------------------------------------------------------------
// Henyey-Greenstein Forward Phase Function
// ----------------------------------------------------------------------------
float hgPhase(float cosTheta, float g) {
    float g2 = g * g;
    return (1.0 - g2) / (4.0 * PI * pow(max(0.0001, 1.0 + g2 - 2.0 * g * cosTheta), 1.5));
}

// ----------------------------------------------------------------------------
// Main Volumetric Raymarcher & Optical Emission-Absorption Integration
// ----------------------------------------------------------------------------
void main() {
    vec3 rayOrigin = vObjectCameraPosition;
    vec3 rayDir = normalize(vObjectPosition - rayOrigin);

    // Compute entry and exit interval into the acoustic chamber
    float tNear, tFar;
    if (!getChamberRayInterval(rayOrigin, rayDir, tNear, tFar)) {
        discard;
    }

    // Clamp entry if camera is inside chamber
    tNear = max(tNear, 0.0);
    float rayLength = tFar - tNear;
    if (rayLength <= 0.001) {
        discard;
    }

    // Dynamic Step Size & Jitter
    int steps = clamp(uStepCount, 40, 128);
    float stepSize = rayLength / float(steps);
    float jitter = screenHash(gl_FragCoord.xy);
    float t = tNear + stepSize * jitter;

    // Optical Spectral Integration Accumulators
    vec3 accumRadiance = vec3(0.0);
    vec3 accumTransmittance = vec3(1.0); // 3-channel spectral Beer-Lambert extinction

    // Membrane Core Width (sigma) dynamically modulated by SubBass & Bass
    float effectiveThickness = max(0.0035, uThickness * (1.0 + 0.35 * uBandEnergies.x));
    float sigmaSq2 = 2.0 * effectiveThickness * effectiveThickness;
    float audioGain = 1.0 + 1.8 * uBandEnergies.x + 1.2 * uBandEnergies.y + 0.6 * uBandEnergies.z;

    vec3 viewDir = -rayDir;
    vec3 spectralExtinction = vec3(1.35, 0.95, 0.70) * (uAbsorption * 28.0);

    // March through the 3D acoustic pressure volume
    for (int i = 0; i < 128; i++) {
        if (i >= steps || t >= tFar || dot(accumTransmittance, accumTransmittance) < 0.001) break;

        vec3 samplePos = rayOrigin + t * rayDir;
        float boundaryMask = getChamberConfinement(samplePos);

        if (boundaryMask > 0.001) {
            vec3 normal;
            float pVal;
            float distToNode = computeTaubinDistance(samplePos, normal, pVal);

            // 1. Smooth Gaussian Nodal Membrane Core (Translucent Sheets at p = 0)
            float density = exp(-(distToNode * distToNode) / sigmaSq2) * boundaryMask;

            if (density > 0.008) {
                // 2. Physical Fresnel Edge Lighting
                float NdotV = abs(dot(normal, viewDir));
                float fresnel = pow(clamp(1.0 - NdotV, 0.0, 1.0), uFresnelPower);

                // 3. Internal Forward Mie-Scattering toward acoustic core
                vec3 toEmitter = normalize(-samplePos);
                float cosScatter = dot(rayDir, toEmitter);
                float forwardScatter = hgPhase(cosScatter, 0.45);

                // 4. Chromatic Thin-Film Dispersion & Phase Interference
                float dispersionAngle = acos(clamp(NdotV, 0.0, 1.0));
                float filmPhase = dispersionAngle * 4.0 + distToNode * 40.0 + uTime * 0.35;
                vec3 chromaticColor = 0.5 + 0.5 * cos(TWO_PI * vec3(0.0, 0.33, 0.67) + filmPhase * uChromaticDispersion);

                // 5. Inigo Quilez Cosine Palette Coloring
                float paletteCoord = length(samplePos) * 0.35 + abs(pVal) * 0.4 + uTime * 0.05;
                vec3 paletteColor = cosinePalette(paletteCoord, uPaletteA, uPaletteB, uPaletteC, uPaletteD);

                // 6. Composite Nodal Membrane Radiance with Apple Radiant Tone Shoulder
                vec3 nodeEmission = mix(paletteColor, uCoreGlow, 0.35);
                nodeEmission += chromaticColor * (fresnel * 1.4);
                nodeEmission += uAccent * (pow(fresnel, 2.0) * 1.8 + forwardScatter * 1.2);

                // Center glowing resonance core
                float centerGlow = exp(-dot(samplePos, samplePos) * 2.5) * 0.35;
                nodeEmission += uCoreGlow * centerGlow;
                nodeEmission *= audioGain;

                // 7. Spectral Beer-Lambert Step Absorption
                vec3 stepOpticalDepth = density * spectralExtinction * stepSize;
                vec3 stepTransmittance = exp(-stepOpticalDepth);
                vec3 inScattered = nodeEmission * (vec3(1.0) - stepTransmittance);

                accumRadiance += accumTransmittance * inScattered;
                accumTransmittance *= stepTransmittance;
            }
        }

        t += stepSize;
    }

    // Subtle chamber glass hull luminescence (edge bounding cage glow)
    float hullEdge = pow(clamp(1.0 - abs(dot(vWorldNormal, normalize(vWorldPosition - cameraPosition))), 0.0, 1.0), 3.5);
    vec3 hullGlow = uAccent * (hullEdge * 0.16) * (1.0 + 0.5 * uHighEnergies.x);

    accumRadiance += accumTransmittance * hullGlow;
    float finalAlpha = clamp(1.0 - dot(accumTransmittance, vec3(0.3333)) + hullEdge * 0.08, 0.0, 1.0);

    if (finalAlpha < 0.005) {
        discard;
    }

    gl_FragColor = vec4(accumRadiance, finalAlpha);
}
`;
