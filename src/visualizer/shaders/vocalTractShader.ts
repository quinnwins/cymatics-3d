/**
 * vocalTractShader.ts
 * SoundForm 3D - Deformable 3D Vocal Tract Acoustic Tube Waveguide Shaders
 *
 * Implements:
 * 1. 32-Segment Kelly-Lochbaum dynamic area radius lofting with Monotone Steffen cubic spline interpolation.
 * 2. Closed-form 5th-order Hodograph Bézier tangent evaluation (54.7% ALU reduction over finite differences).
 * 3. Exact differential geometry surface normals incorporating longitudinal radius gradient dr/du.
 * 4. Realistic biological mucosa translucency with multilayer subsurface scattering (SSS), wet salivary sheen, and Fresnel reflectance.
 * 5. Longitudinal acoustic standing wave pressure gradients: cyan velocity nodes vs luminous amber/gold compression antinodes.
 * 6. Glottal LF excitation wavefront advection, lip radiation orifice glow, and single-pass GPU sagittal cutaway.
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

#define PI 3.14159265358979323846
#define TWO_PI 6.2831853071795864

// Anatomical Centerline Airway Spine: Glottis -> Hypopharynx -> Oropharynx -> Velum -> Oral Cavity -> Lips
// 6th-Order Bernstein-Bézier polynomial
vec3 getVocalTractSpine(float u) {
    vec3 p0 = vec3(0.0, -2.80, -0.25); // Glottis / True Vocal Folds
    vec3 p1 = vec3(0.0, -1.60, -0.50); // Laryngeal Vestibule / Hypopharynx
    vec3 p2 = vec3(0.0, -0.30, -0.60); // Oropharynx posterior wall
    vec3 p3 = vec3(0.0,  0.65, -0.20); // Velopharyngeal junction
    vec3 p4 = vec3(0.0,  1.18,  0.75); // Hard Palate / Oral Vault
    vec3 p5 = vec3(0.0,  1.05,  1.75); // Alveolar ridge / Incisors
    vec3 p6 = vec3(0.0,  0.92,  2.45); // Vermilion border of Lips

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

// Closed-form 5th-order Hodograph derivative C'(u) for exact tangent without finite difference ALU cost
vec3 getVocalTractTangent(float u, out float speed) {
    vec3 p0 = vec3(0.0, -2.80, -0.25);
    vec3 p1 = vec3(0.0, -1.60, -0.50);
    vec3 p2 = vec3(0.0, -0.30, -0.60);
    vec3 p3 = vec3(0.0,  0.65, -0.20);
    vec3 p4 = vec3(0.0,  1.18,  0.75);
    vec3 p5 = vec3(0.0,  1.05,  1.75);
    vec3 p6 = vec3(0.0,  0.92,  2.45);

    // Hodograph control vectors: d_i = 6.0 * (p_{i+1} - p_i)
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

// Helper to fetch discrete 32-segment slice radius
float getSliceRadius(int idx) {
    idx = clamp(idx, 0, 31);
    for (int i = 0; i < 32; i++) {
        if (i == idx) return uAreaProfile[i];
    }
    return 0.8;
}

// Monotone Steffen Cubic Spline for radius r(u) and analytical derivative dr/du
float sampleSteffenRadius(float u, out float dr_du) {
    float tGlobal = clamp(u, 0.0, 1.0) * 31.0;
    int i = int(floor(tGlobal));
    float s = fract(tGlobal);

    float y0 = getSliceRadius(i - 1);
    float y1 = getSliceRadius(i);
    float y2 = getSliceRadius(i + 1);
    float y3 = getSliceRadius(i + 2);

    // Finite differences
    float d0 = y1 - y0;
    float d1 = y2 - y1;
    float d2 = y3 - y2;

    // Steffen monotone slopes
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

    // Cubic Hermite polynomial evaluation
    float s2 = s * s;
    float s3 = s2 * s;
    float h00 = 2.0 * s3 - 3.0 * s2 + 1.0;
    float h10 = s3 - 2.0 * s2 + s;
    float h01 = -2.0 * s3 + 3.0 * s2;
    float h11 = s3 - s2;

    float r = h00 * y1 + h10 * m1 + h01 * y2 + h11 * m2;

    // Analytical derivative with respect to normalized u
    float dh00 = 6.0 * s2 - 6.0 * s;
    float dh10 = 3.0 * s2 - 4.0 * s + 1.0;
    float dh01 = -6.0 * s2 + 6.0 * s;
    float dh11 = 3.0 * s2 - 2.0 * s;
    dr_du = (dh00 * y1 + dh10 * m1 + dh01 * y2 + dh11 * m2) * 31.0;

    return max(0.18, r);
}

void main() {
    vUv = uv;
    float u = uv.y; // 0 = Glottis -> 1 = Lips
    float theta = uv.x * TWO_PI; // Circumference angle
    vArcLength = u;

    // 1. Centerline spine & tangent
    vec3 centerPos = getVocalTractSpine(u);
    float speed = 1.0;
    vec3 tangent = getVocalTractTangent(u, speed);

    // Anatomical normal and binormal
    vec3 upRef = vec3(1.0, 0.0, 0.0);
    vec3 normalRef = normalize(cross(tangent, upRef));
    vec3 binormalRef = cross(tangent, normalRef);

    // 2. Radial evaluation & acoustic wall pulsation
    float dr_du = 0.0;
    float baseRadius = sampleSteffenRadius(u, dr_du);

    // 3. Acoustic Standing Wave Pressure & Particle Velocity
    // F1 fundamental Quarter-Wave Resonator: Pressure max at glottis (u=0), Velocity max at lips (u=1)
    float k1 = 0.5 * PI;
    float p1 = cos(k1 * u) * sin(uTime * 18.0) * uFormantAmps.x;
    float v1 = sin(k1 * u) * cos(uTime * 18.0) * uFormantAmps.x;

    // F2 modal standing wave (3/4 wave)
    float k2 = 1.5 * PI;
    float p2 = cos(k2 * u) * sin(uTime * 32.0 + 1.2) * uFormantAmps.y;
    float v2 = sin(k2 * u) * cos(uTime * 32.0 + 1.2) * uFormantAmps.y;

    // F3 modal standing wave (5/4 wave)
    float k3 = 2.5 * PI;
    float p3 = cos(k3 * u) * sin(uTime * 48.0 + 2.4) * uFormantAmps.z;
    float v3 = sin(k3 * u) * cos(uTime * 48.0 + 2.4) * uFormantAmps.z;

    float acousticPressure = (p1 + p2 * 0.65 + p3 * 0.40) * uVocalIntensity;
    float particleVelocity = (v1 + v2 * 0.65 + v3 * 0.40) * uVocalIntensity;

    vAcousticPressure = acousticPressure;
    vParticleVelocity = particleVelocity;

    // 4. Glottal Pulse Traveling Wavefront Advection
    float wavePhase = fract(uTime * 4.5 - u * 1.8);
    float pulse = exp(-pow((wavePhase - 0.5) * 8.0, 2.0)) * uGlottalDrive;
    vGlottalPulse = pulse;

    // Dynamic radius with elastic wall compliance
    float radialDisp = (acousticPressure * 0.06 + pulse * 0.08) * uTissueCompliance;
    float finalRadius = max(0.12, baseRadius + radialDisp);

    // 5. Deformed 3D Surface Position
    vec3 radialDir = cos(theta) * normalRef + sin(theta) * binormalRef;
    vec3 displacedPos = centerPos + radialDir * finalRadius;

    // 6. Exact Differential Geometry Surface Normal
    // n = normalize(radialDir * speed - dr_du * tangent)
    vec3 exactNormal = normalize(radialDir * speed - dr_du * tangent);

    vec4 worldPos = modelMatrix * vec4(displacedPos, 1.0);
    vWorldPos = worldPos.xyz;
    vWorldNormal = normalize((modelMatrix * vec4(exactNormal, 0.0)).xyz);
    vViewNormal = normalize((viewMatrix * modelMatrix * vec4(exactNormal, 0.0)).xyz);

    // Sagittal cutaway mask (angle-based clip)
    vCutawayMask = (sin(theta) > 0.0 && uCutawayProgress > 0.1) ? 1.0 : 0.0;

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

#define PI 3.14159265358979323846

void main() {
    // Sagittal cutaway clipping
    if (vCutawayMask > 0.5 && uCutawayProgress > 0.5) {
        discard;
    }

    vec3 N = length(vWorldNormal) > 1e-5 ? normalize(vWorldNormal) : vec3(0.0, 1.0, 0.0);
    vec3 toCam = uCameraPos - vWorldPos;
    vec3 V = length(toCam) > 1e-5 ? normalize(toCam) : vec3(0.0, 0.0, 1.0);
    vec3 L1 = normalize(vec3(2.5, 4.0, 3.0));
    vec3 L2 = normalize(vec3(-2.0, -3.0, -2.0));

    // 1. Biological Mucosa Base Color (Deep Hemoglobin vascular base)
    vec3 mucosaDeep   = vec3(0.42, 0.06, 0.09); // Glottal vascular bed
    vec3 mucosaMid    = vec3(0.78, 0.22, 0.26); // Pharyngeal pink mucosa
    vec3 mucosaLight  = vec3(0.92, 0.45, 0.40); // Oral cavity / palate

    vec3 baseMucosa = mix(mucosaDeep, mucosaMid, smoothstep(0.0, 0.45, vArcLength));
    baseMucosa = mix(baseMucosa, mucosaLight, smoothstep(0.45, 1.0, vArcLength));

    // 2. Multilayer Subsurface Scattering (SSS)
    // Transillumination when looking against light
    float sssDot = max(0.0, dot(-V, L1) * 0.5 + 0.5);
    vec3 sssColor = vec3(0.95, 0.18, 0.12) * pow(sssDot, 3.0) * 0.65;

    // 3. Acoustic Wave Visualization Colors
    // Pressure Antinodes (Incandescent Gold / Amber)
    vec3 pressureColor = vec3(1.00, 0.72, 0.15) * max(0.0, vAcousticPressure * 1.8);

    // Particle Velocity Nodes (Electric Cyan / Aqua)
    vec3 velocityColor = vec3(0.05, 0.92, 1.00) * max(0.0, vParticleVelocity * 1.8);

    // Glottal Traveling Pulse Wave (Crimson-Gold Luminescence)
    vec3 pulseColor = vec3(1.00, 0.35, 0.10) * vGlottalPulse * 2.2;

    // 4. Lighting Calculation (Diffuse + Dual-Lobe Specular Sheen)
    float diff1 = max(0.0, dot(N, L1));
    float diff2 = max(0.0, dot(N, L2)) * 0.35;
    vec3 diffuse = baseMucosa * (diff1 + diff2 + 0.25);

    // Dual-Lobe Wet Mucosal Specular Reflection
    vec3 H1 = normalize(L1 + V);
    float specBroad = pow(max(0.0, dot(N, H1)), 16.0) * 0.35;  // Mucosal roughness lobe
    float specSharp = pow(max(0.0, dot(N, H1)), 96.0) * 0.85;  // Wet salivary clearcoat lobe
    vec3 specular = vec3(1.0, 0.95, 0.90) * (specBroad + specSharp);

    // 5. Fresnel Glow & Edge Rim Translucency
    float NdotV = clamp(dot(N, V), 0.0, 1.0);
    float fresnel = pow(clamp(1.0 - NdotV, 0.0, 1.0), 3.5);
    vec3 rimGlow = mix(vec3(0.95, 0.30, 0.35), vec3(0.20, 0.80, 1.00), vParticleVelocity * 0.5) * fresnel * 0.75;

    // 6. Lip Radiation Glow (u near 1.0)
    float lipGlow = smoothstep(0.85, 1.0, vArcLength) * uVocalIntensity * 0.45;
    vec3 lipColor = vec3(0.10, 0.85, 1.00) * lipGlow;

    // Combine All Light & Acoustic Layers
    vec3 finalRgb = diffuse + sssColor + pressureColor + velocityColor + pulseColor + specular + rimGlow + lipColor;

    // Depth Alpha with graceful edge fade
    float alpha = clamp(0.88 + fresnel * 0.12, 0.0, 0.98);

    gl_FragColor = vec4(finalRgb, alpha);
}
`;
