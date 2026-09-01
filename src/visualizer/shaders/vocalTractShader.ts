/**
 * vocalTractShader.ts
 * SoundForm 3D - Deformable 3D Vocal Tract Acoustic Tube Waveguide Shaders
 *
 * Implements:
 * 1. 16-Segment Kelly-Lochbaum dynamic area radius tube deformation along an anatomical centerline spline.
 * 2. Acoustic standing wave pressure field P(x, t) displaying nodes (cyan) vs antinodes (amber/gold).
 * 3. Translucent mucosal subsurface scattering (SSS) with chromatic Fresnel reflectance.
 * 4. Glottal LF-model excitation pulse propagation.
 */

export const VOCAL_TRACT_VERTEX_SHADER = `
precision highp float;

uniform float uTime;
uniform float uGlottalDrive;       // Laryngeal fundamental vibration (0..1)
uniform float uVocalIntensity;     // Acoustic energy (0..1)
uniform float uAreaProfile[16];    // 16-segment Kelly-Lochbaum area radius in cm
uniform vec4  uFormantFreqs;       // x=F1, y=F2, z=F3, w=F4 in Hz
uniform vec4  uFormantAmps;        // Formant modal amplitudes
uniform float uTissueCompliance;   // Wall elasticity compliance factor

varying vec3  vWorldPos;
varying vec3  vWorldNormal;
varying vec3  vViewNormal;
varying vec2  vUv;
varying float vArcLength;          // 0=Glottis -> 1=Lips
varying float vAcousticPressure;   // Standing wave pressure
varying float vParticleVelocity;   // Volume velocity
varying float vGlottalPulse;       // Excitation pulse

#define PI 3.14159265358979323846
#define TWO_PI 6.2831853071795864

// Centerline Spine: Glottis -> Pharynx -> Velum bend -> Oral Cavity -> Lips
vec3 getVocalTractSpine(float u) {
    vec3 p0 = vec3(0.0, -2.8, -0.2); // Glottis / Larynx
    vec3 p1 = vec3(0.0, -1.0, -0.5); // Hypopharynx / Oropharynx
    vec3 p2 = vec3(0.0,  0.5, -0.3); // Velopharyngeal junction
    vec3 p3 = vec3(0.0,  1.1,  0.8); // Hard Palate / Oral Cavity
    vec3 p4 = vec3(0.0,  1.0,  2.2); // Lips

    float t = u;
    float it = 1.0 - t;
    return it*it*it*it*p0 + 4.0*it*it*it*t*p1 + 6.0*it*it*t*t*p2 + 4.0*it*t*t*t*p3 + t*t*t*t*p4;
}

vec3 getVocalTractTangent(float u) {
    float du = 0.005;
    vec3 pA = getVocalTractSpine(clamp(u - du, 0.0, 1.0));
    vec3 pB = getVocalTractSpine(clamp(u + du, 0.0, 1.0));
    return normalize(pB - pA);
}

float sampleAreaRadius(float u) {
    float idxF = clamp(u * 15.0, 0.0, 15.0);
    int idx = int(floor(idxF));
    float frac = fract(idxF);

    // Unrolled sampling of uniform array
    float r0 = 0.8;
    float r1 = 0.8;
    for (int i = 0; i < 16; i++) {
        if (i == idx) r0 = uAreaProfile[i];
        if (i == idx + 1) r1 = uAreaProfile[i];
    }
    return mix(r0, r1, smoothstep(0.0, 1.0, frac));
}

void main() {
    vUv = uv;
    float u = uv.y; // Longitudinal coordinate along vocal tract (0=Glottis, 1=Lips)
    vArcLength = u;

    // 1. Evaluate Centerline Spine & Normal Frame
    vec3 spinePos = getVocalTractSpine(u);
    vec3 T = getVocalTractTangent(u);
    vec3 upRef = vec3(1.0, 0.0, 0.0);
    vec3 N = normalize(cross(T, upRef));
    vec3 B = cross(N, T);

    // 2. Lumen Radius from Kelly-Lochbaum Area Function
    float baseRadius = clamp(sampleAreaRadius(u) * 0.9, 0.25, 2.8);

    // Cross-sectional elliptical mouth/pharynx shaping
    float theta = uv.x * TWO_PI;
    float ellipticity = 0.22 * sin(u * PI);
    float radius = baseRadius * (1.0 + ellipticity * cos(2.0 * theta));

    // 3. Multi-Formant Acoustic Standing Wave Pressure
    float phaseSpeed = uTime * 12.0;
    float p1 = uFormantAmps.x * sin(1.0 * PI * u) * cos(phaseSpeed * 1.0);
    float p2 = uFormantAmps.y * sin(2.0 * PI * u) * cos(phaseSpeed * 2.1);
    float p3 = uFormantAmps.z * sin(3.0 * PI * u) * cos(phaseSpeed * 3.4);
    float p4 = uFormantAmps.w * sin(4.0 * PI * u) * cos(phaseSpeed * 4.8);
    float standingPressure = (p1 + p2 + p3 + p4) * uVocalIntensity;

    // Glottal excitation wave
    float pulseDist = mod(uTime * 4.5 - u * 3.2, 3.2);
    float glottalPulse = exp(-pulseDist * pulseDist * 7.0) * uGlottalDrive;
    float velocity = -(uFormantAmps.x * cos(1.0 * PI * u) + uFormantAmps.y * cos(2.0 * PI * u)) * uVocalIntensity;

    vAcousticPressure = standingPressure;
    vParticleVelocity = velocity;
    vGlottalPulse = glottalPulse;

    // 4. Elastic Wall Mechanical Compliance Deformation
    float wallDisplacement = (standingPressure * 0.09 + glottalPulse * 0.14) * uTissueCompliance;
    float finalRadius = max(radius + wallDisplacement, 0.1);

    // 5. Final 3D Vertex Position Reconstruction
    vec3 radialOffset = (N * cos(theta) + B * sin(theta)) * finalRadius;
    vec3 localPos = spinePos + radialOffset;

    vec4 worldPos = modelMatrix * vec4(localPos, 1.0);
    vWorldPos = worldPos.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * (N * cos(theta) + B * sin(theta)));
    vViewNormal = normalize(normalMatrix * (N * cos(theta) + B * sin(theta)));

    gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

export const VOCAL_TRACT_FRAGMENT_SHADER = `
precision highp float;

uniform float uTime;
uniform float uVocalIntensity;
uniform float uTherapyEntrainment; // 0=Natural, 1=Harmonized Medicine
uniform vec3  uColorNode;          // Cyan for pressure nodes
uniform vec3  uColorAntinode;      // Gold/Amber for antinodes
uniform vec3  uColorMucosa;        // Rose/crimson bio tissue
uniform vec3  uCameraPosition;

varying vec3  vWorldPos;
varying vec3  vWorldNormal;
varying vec3  vViewNormal;
varying vec2  vUv;
varying float vArcLength;
varying float vAcousticPressure;
varying float vParticleVelocity;
varying float vGlottalPulse;

void main() {
    vec3 N = normalize(vWorldNormal) * (gl_FrontFacing ? 1.0 : -1.0);
    vec3 V = normalize(uCameraPosition - vWorldPos);

    // 1. Chromatic Fresnel Reflectance
    float NdotV = max(dot(N, V), 0.0);
    float fresnel = pow(1.0 - NdotV, 3.2);
    vec3 fresnelColor = mix(vec3(0.3, 0.8, 1.0), vec3(1.0, 0.85, 0.35), uTherapyEntrainment) * fresnel * 1.6;

    // 2. Translucent Mucosa Subsurface Scattering
    vec3 sssColor = uColorMucosa * (0.35 + 0.65 * pow(NdotV, 1.5));

    // 3. Acoustic Standing Wave Pressure Nodes & Antinodes
    float absPressure = abs(vAcousticPressure);
    float absVelocity = abs(vParticleVelocity);

    vec3 antinodeGlow = uColorAntinode * pow(absPressure, 2.0) * 3.2;
    vec3 nodeGlow = uColorNode * pow(absVelocity, 1.8) * 2.2;

    // 4. Longitudinal Acoustic Particle Flux Streams
    float streamPhase = vArcLength * 45.0 - uTime * 18.0;
    float streamGrid = pow(max(sin(streamPhase), 0.0), 8.0) * uVocalIntensity;
    vec3 streamColor = vec3(0.0, 1.0, 0.85) * streamGrid * 1.5;

    // 5. Glottal Pulse Shockwave Highlight
    vec3 glottalFlash = vec3(1.0, 0.95, 0.7) * vGlottalPulse * 3.5;

    // 6. Radiation Orifice Glow (Lips at vArcLength = 1.0)
    float lipRadiation = smoothstep(0.85, 1.0, vArcLength) * uVocalIntensity;
    vec3 lipGlow = vec3(0.2, 0.9, 1.0) * lipRadiation * 2.0;

    // 7. Composite Optical Model
    vec3 finalColor = sssColor + antinodeGlow + nodeGlow + streamColor + glottalFlash + lipGlow + fresnelColor;
    float alpha = clamp(0.35 + fresnel * 0.65 + absPressure * 0.45 + vGlottalPulse * 0.5, 0.0, 0.95);

    gl_FragColor = vec4(finalColor, alpha);
}
`;
