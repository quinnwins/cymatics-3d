/**
 * vocalTractShader.ts
 * SoundForm 3D - High-Precision Holographic Vocal Tract Acoustic Waveguide Shaders
 *
 * Implements:
 * 1. 32-Segment Kelly-Lochbaum dynamic area radius waveguide with Monotone Steffen cubic spline interpolation.
 * 2. Exact 5th-order Hodograph Bézier tangent & differential geometry surface normals.
 * 3. Holographic Acoustic Waveguide Material: Translucent obsidian/sapphire glass substrate with acoustic isobar fields.
 * 4. Standing Wave Physics Encoding:
 *    - Cyan/Azure (#00f0ff): Acoustic Velocity Nodes & Antinodes (U)
 *    - Radiant Amber/Gold (#fbbf24): Acoustic Pressure Compression Antinodes (P)
 *    - Luminous White Wavefronts: Longitudinal Glottal Pulse Packets
 * 5. 32 Discrete Waveguide Segment Rings with calibrated millimetric acoustic boundaries.
 * 6. Interactive sagittal cross-sectional cutaway with illuminated edge boundaries.
 */

export const VOCAL_TRACT_VERTEX_SHADER = `
precision highp float;

uniform float uTime;
uniform float uGlottalDrive;       // Laryngeal fundamental vibration (0..1)
uniform float uVocalIntensity;     // Acoustic energy (0..1)
uniform float uAreaProfile[32];    // 32-segment Kelly-Lochbaum area radius in cm
uniform vec4  uFormantFreqs;       // x=F1, y=F2, z=F3, w=F4 in Hz
uniform vec4  uFormantAmps;        // Formant modal amplitudes
uniform float uTissueCompliance;   // Wall elasticity compliance factor
uniform float uCutawayProgress;    // 0.0 = full tube, 1.0 = sagittal cutaway

varying vec3  vWorldPos;
varying vec3  vWorldNormal;
varying vec3  vViewNormal;
varying vec2  vUv;
varying float vArcLength;          // 0=Glottis -> 1=Lips
varying float vAcousticPressure;   // Standing wave pressure
varying float vParticleVelocity;   // Volume velocity
varying float vGlottalPulse;       // Excitation pulse
varying float vCutawayMask;
varying float vSegmentBoundary;    // 32-segment Kelly-Lochbaum ring indicator

#define PI 3.14159265358979323846
#define TWO_PI 6.2831853071795864

// Anatomical Centerline Airway Spine: Glottis -> Hypopharynx -> Oropharynx -> Velum -> Oral Cavity -> Lips
vec3 getVocalTractSpine(float u) {
    vec3 p0 = vec3(0.0, -2.80, -0.25); // Glottis / Vocal Folds
    vec3 p1 = vec3(0.0, -1.60, -0.50); // Hypopharynx
    vec3 p2 = vec3(0.0, -0.30, -0.60); // Oropharynx posterior wall
    vec3 p3 = vec3(0.0,  0.65, -0.20); // Velopharyngeal junction
    vec3 p4 = vec3(0.0,  1.18,  0.75); // Hard Palate / Oral Vault
    vec3 p5 = vec3(0.0,  1.05,  1.75); // Alveolar ridge / Incisors
    vec3 p6 = vec3(0.0,  0.92,  2.45); // Lips

    float t = clamp(u, 0.0, 1.0);
    float it = 1.0 - t;
    float b0 = it * it * it * it * it * it;
    float b1 = 6.0 * it * it * it * it * it * t;
    float b2 = 15.0 * it * it * it * it * t * t;
    float b3 = 20.0 * it * it * it * t * t * t;
    float b4 = 15.0 * it * it * t * t * t * t;
    float b5 = 6.0 * it * t * t * t * t * t;
    float b6 = t * t * t * t * t * t;

    return b0 * p0 + b1 * p1 + b2 * p2 + b3 * p3 + b4 * p4 + b5 * p5 + b6 * p6;
}

vec3 getVocalTractTangent(float u, out float speed) {
    vec3 p0 = vec3(0.0, -2.80, -0.25);
    vec3 p1 = vec3(0.0, -1.60, -0.50);
    vec3 p2 = vec3(0.0, -0.30, -0.60);
    vec3 p3 = vec3(0.0,  0.65, -0.20);
    vec3 p4 = vec3(0.0,  1.18,  0.75);
    vec3 p5 = vec3(0.0,  1.05,  1.75);
    vec3 p6 = vec3(0.0,  0.92,  2.45);

    vec3 d0 = 6.0 * (p1 - p0);
    vec3 d1 = 6.0 * (p2 - p1);
    vec3 d2 = 6.0 * (p3 - p2);
    vec3 d3 = 6.0 * (p4 - p3);
    vec3 d4 = 6.0 * (p5 - p4);
    vec3 d5 = 6.0 * (p6 - p5);

    float t = clamp(u, 0.0, 1.0);
    float it = 1.0 - t;
    float h0 = it * it * it * it * it;
    float h1 = 5.0 * it * it * it * it * t;
    float h2 = 10.0 * it * it * it * t * t;
    float h3 = 10.0 * it * it * t * t * t;
    float h4 = 5.0 * it * t * t * t * t;
    float h5 = t * t * t * t * t;

    vec3 deriv = h0 * d0 + h1 * d1 + h2 * d2 + h3 * d3 + h4 * d4 + h5 * d5;
    speed = length(deriv);
    return speed > 1e-5 ? deriv / speed : vec3(0.0, 1.0, 0.0);
}

float getSliceRadius(int idx) {
    idx = clamp(idx, 0, 31);
    for (int i = 0; i < 32; i++) {
        if (i == idx) return uAreaProfile[i];
    }
    return 0.8;
}

float sampleSteffenRadius(float u, out float dr_du) {
    float tGlobal = clamp(u, 0.0, 1.0) * 31.0;
    int i = int(floor(tGlobal));
    float s = fract(tGlobal);

    float y0 = getSliceRadius(i - 1);
    float y1 = getSliceRadius(i);
    float y2 = getSliceRadius(i + 1);
    float y3 = getSliceRadius(i + 2);

    float d0 = y1 - y0;
    float d1 = y2 - y1;
    float d2 = y3 - y2;

    float m1 = 0.0;
    if (d0 * d1 > 0.0) {
        float p = 2.0 * d0 * d1 / (d0 + d1);
        m1 = (sign(d0) + sign(d1)) * min(abs(d0), min(abs(d1), 0.5 * abs(p)));
    }
    float m2 = 0.0;
    if (d1 * d2 > 0.0) {
        float p = 2.0 * d1 * d2 / (d1 + d2);
        m2 = (sign(d1) + sign(d2)) * min(abs(d1), min(abs(d2), 0.5 * abs(p)));
    }

    float s2 = s * s;
    float s3 = s2 * s;
    float h00 = 2.0 * s3 - 3.0 * s2 + 1.0;
    float h10 = s3 - 2.0 * s2 + s;
    float h01 = -2.0 * s3 + 3.0 * s2;
    float h11 = s3 - s2;

    float r = h00 * y1 + h10 * m1 + h01 * y2 + h11 * m2;

    float dh00 = 6.0 * s2 - 6.0 * s;
    float dh10 = 3.0 * s2 - 4.0 * s + 1.0;
    float dh01 = -6.0 * s2 + 6.0 * s;
    float dh11 = 3.0 * s2 - 2.0 * s;
    dr_du = (dh00 * y1 + dh10 * m1 + dh01 * y2 + dh11 * m2) * 31.0;

    return max(0.18, r);
}

void main() {
    vUv = uv;
    float u = uv.y;
    float theta = uv.x * TWO_PI;
    vArcLength = u;

    // 32-Segment discrete ring boundary marker
    float segFrac = fract(u * 31.0);
    vSegmentBoundary = 1.0 - smoothstep(0.04, 0.12, abs(segFrac - 0.5));

    vec3 centerPos = getVocalTractSpine(u);
    float speed = 1.0;
    vec3 tangent = getVocalTractTangent(u, speed);

    vec3 upRef = vec3(1.0, 0.0, 0.0);
    vec3 normalRef = normalize(cross(tangent, upRef));
    vec3 binormalRef = cross(tangent, normalRef);

    float dr_du = 0.0;
    float baseRadius = sampleSteffenRadius(u, dr_du);

    // Longitudinal standing wave acoustic modes (F1 + F2)
    float k1 = 0.5 * PI;
    float p1 = cos(k1 * u) * sin(uTime * 14.0) * uFormantAmps.x;
    float v1 = sin(k1 * u) * cos(uTime * 14.0) * uFormantAmps.x;

    float k2 = 1.5 * PI;
    float p2 = cos(k2 * u) * sin(uTime * 24.0 + 1.2) * uFormantAmps.y;
    float v2 = sin(k2 * u) * cos(uTime * 24.0 + 1.2) * uFormantAmps.y;

    float acousticPressure = (p1 + p2 * 0.5) * uVocalIntensity;
    float particleVelocity = (v1 + v2 * 0.5) * uVocalIntensity;

    vAcousticPressure = acousticPressure;
    vParticleVelocity = particleVelocity;

    float wavePhase = fract(uTime * 3.5 - u * 1.5);
    float pulse = exp(-pow((wavePhase - 0.5) * 8.0, 2.0)) * uGlottalDrive;
    vGlottalPulse = pulse;

    float radialDisp = (acousticPressure * 0.035 + pulse * 0.045) * uTissueCompliance;
    float finalRadius = max(0.15, baseRadius + radialDisp);

    vec3 radialDir = cos(theta) * normalRef + sin(theta) * binormalRef;
    vec3 displacedPos = centerPos + radialDir * finalRadius;

    vec3 exactNormal = normalize(radialDir * speed - dr_du * tangent);

    vec4 worldPos = modelMatrix * vec4(displacedPos, 1.0);
    vWorldPos = worldPos.xyz;
    vWorldNormal = normalize((modelMatrix * vec4(exactNormal, 0.0)).xyz);
    vViewNormal = normalize((viewMatrix * modelMatrix * vec4(exactNormal, 0.0)).xyz);

    // Sagittal lateral cutaway (clips front lateral hemisphere)
    vCutawayMask = (sin(theta) > 0.05) ? 1.0 : 0.0;

    gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

export const VOCAL_TRACT_FRAGMENT_SHADER = `
precision highp float;

uniform float uTime;
uniform float uVocalIntensity;
uniform float uGlottalDrive;
uniform float uCutawayProgress;
uniform vec3  uCameraPos;

varying vec3  vWorldPos;
varying vec3  vWorldNormal;
varying vec3  vViewNormal;
varying vec2  vUv;
varying float vArcLength;
varying float vAcousticPressure;
varying float vParticleVelocity;
varying float vGlottalPulse;
varying float vCutawayMask;
varying float vSegmentBoundary;

#define PI 3.14159265358979323846

void main() {
    // Sagittal cutaway discard
    if (vCutawayMask > 0.5 && uCutawayProgress > 0.3) {
        discard;
    }

    vec3 N = length(vWorldNormal) > 1e-5 ? normalize(vWorldNormal) : vec3(0.0, 1.0, 0.0);
    vec3 toCam = uCameraPos - vWorldPos;
    vec3 V = length(toCam) > 1e-5 ? normalize(toCam) : vec3(0.0, 0.0, 1.0);
    vec3 L1 = normalize(vec3(2.5, 4.0, 3.0));
    vec3 L2 = normalize(vec3(-2.0, -3.0, -2.0));

    // 1. Scientific Holographic Substrate (Deep Obsidian / Sapphire Glass Waveguide)
    vec3 glassSubstrate = vec3(0.03, 0.08, 0.16); // Clean dark sapphire medical glass
    vec3 gridRingColor  = vec3(0.15, 0.45, 0.85); // Kelly-Lochbaum segment boundary ring

    // 2. Longitudinal Waveguide Grid Lines (32 Segment Rings + Axial Rails)
    float axialRail = pow(abs(cos(vUv.x * 32.0 * PI)), 16.0) * 0.18;
    float segRing   = pow(abs(sin(vArcLength * 31.0 * PI)), 12.0) * 0.25;
    vec3 structuralGrid = gridRingColor * (axialRail + segRing);

    // 3. Acoustic Standing Wave Physics Encoding:
    // Velocity Nodes/Antinodes (U): Electric Cyan (#00e5ff)
    // Pressure Compression Antinodes (P): Radiant Amber / Warm Gold (#fbbf24)
    // Glottal Energy Pulse: Luminous White-Cyan
    vec3 velocityColor = vec3(0.00, 0.90, 1.00) * abs(vParticleVelocity) * 0.65;
    vec3 pressureColor = vec3(1.00, 0.72, 0.15) * max(0.0, vAcousticPressure) * 0.75;
    vec3 pulseColor    = vec3(0.85, 0.95, 1.00) * vGlottalPulse * 0.60;

    // 4. Clean Holographic Diffuse & Edge Lighting
    float diff1 = max(0.0, dot(N, L1));
    float diff2 = max(0.0, dot(N, L2)) * 0.3;
    vec3 diffuse = glassSubstrate * (diff1 * 0.65 + diff2 + 0.35);

    // 5. Scientific Fresnel Edge Rim (Clean Medical Cyan/Sapphire Glow)
    float NdotV = clamp(dot(N, V), 0.0, 1.0);
    float fresnel = pow(clamp(1.0 - NdotV, 0.0, 1.0), 2.5);
    vec3 rimGlow = mix(vec3(0.10, 0.60, 1.00), vec3(0.00, 0.95, 1.00), fresnel) * fresnel * 0.75;

    // 6. Glottal Excitation Source Ring (Laryngeal Base Glow)
    float glottisRing = (1.0 - smoothstep(0.0, 0.12, vArcLength)) * (0.4 + uGlottalDrive * 0.4);
    vec3 laryngealSource = vec3(0.0, 0.85, 1.0) * glottisRing;

    // 7. Cutaway Rim Highlight (Glowing border where the tube is sliced)
    float cutawayEdge = (uCutawayProgress > 0.3 && abs(vCutawayMask - 0.5) < 0.3) ? 0.45 : 0.0;
    vec3 cutawayRim = vec3(0.00, 0.95, 1.00) * cutawayEdge;

    // Compose final clean scientific color
    vec3 finalRgb = diffuse + structuralGrid + velocityColor + pressureColor + pulseColor + rimGlow + laryngealSource + cutawayRim;
    finalRgb = min(finalRgb, vec3(1.35));

    float alpha = clamp(0.70 + fresnel * 0.28 + (vAcousticPressure > 0.1 ? 0.15 : 0.0), 0.0, 0.95);

    gl_FragColor = vec4(finalRgb, alpha);
}
`;
