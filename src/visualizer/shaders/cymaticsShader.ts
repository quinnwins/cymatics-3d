import { CYMATICS_CORE_GLSL } from './cymaticsCore';

export const CYMATICS_VERTEX_SHADER = `
${CYMATICS_CORE_GLSL}

uniform float uTime;
uniform vec4 uBandEnergies;
uniform vec2 uHighEnergies;
uniform float uFundamentalFreq;
uniform float uHarmonicMultiplier;
uniform float uWavenumber;

varying vec3 vWorldNormal;
varying vec3 vViewPosition;
varying vec3 vLocalPosition;
varying float vDisplacement;
varying float vNodalValue;

void main() {
    vec3 basePos = position;
    float r = length(basePos);
    vec3 n = normalize(basePos);
    vLocalPosition = basePos;

    // Evaluate exact cymatics & spherical harmonics modal displacement
    float disp = evaluateCymaticsDisplacement(
        basePos,
        uBandEnergies,
        uHighEnergies,
        uWavenumber,
        uTime
    ) * uHarmonicMultiplier;

    vDisplacement = disp;
    vNodalValue = abs(disp); // Near 0 = Nodal line / boundary

    // Analytical / Finite-difference normal recalculation for crisp reflections
    float eps = 0.006;
    vec3 tX = normalize(cross(n, vec3(0.0, 1.0, 0.001)));
    vec3 tY = normalize(cross(n, tX));

    vec3 pX = basePos + tX * eps;
    vec3 pY = basePos + tY * eps;

    float dispX = evaluateCymaticsDisplacement(pX, uBandEnergies, uHighEnergies, uWavenumber, uTime) * uHarmonicMultiplier;
    float dispY = evaluateCymaticsDisplacement(pY, uBandEnergies, uHighEnergies, uWavenumber, uTime) * uHarmonicMultiplier;

    vec3 pDisplaced = basePos + n * disp;
    vec3 pXDisplaced = pX + normalize(pX) * dispX;
    vec3 pYDisplaced = pY + normalize(pY) * dispY;

    vec3 calcNormal = normalize(cross(pXDisplaced - pDisplaced, pYDisplaced - pDisplaced));

    vWorldNormal = normalize(normalMatrix * calcNormal);
    vec4 mvPosition = modelViewMatrix * vec4(pDisplaced, 1.0);
    vViewPosition = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
}
`;

export const CYMATICS_FRAGMENT_SHADER = `
${CYMATICS_CORE_GLSL}

uniform float uTime;
uniform vec3 uPaletteA;
uniform vec3 uPaletteB;
uniform vec3 uPaletteC;
uniform vec3 uPaletteD;
uniform vec3 uCoreGlow;
uniform vec3 uAccent;
uniform vec4 uBandEnergies;

varying vec3 vWorldNormal;
varying vec3 vViewPosition;
varying vec3 vLocalPosition;
varying float vDisplacement;
varying float vNodalValue;

void main() {
    vec3 N = normalize(vWorldNormal);
    vec3 V = normalize(vViewPosition);

    // Fresnel reflection
    float NdotV = max(dot(N, V), 0.0);
    float fresnel = pow(1.0 - NdotV, 3.0);

    // Nodal line luminescence (standing wave nodal lines glow like sacred geometry)
    float nodalLine = smoothstep(0.06, 0.0, vNodalValue);

    // Iridescent thin-film interference
    float phase = dot(vLocalPosition, vec3(1.0, 2.0, 3.0)) * 0.4 + vDisplacement * 6.0 - uTime * 0.15;
    vec3 interferenceColor = cosinePalette(phase, uPaletteA, uPaletteB, uPaletteC, uPaletteD);

    // Composite crystalline surface
    vec3 surfaceColor = mix(interferenceColor * 0.4, uCoreGlow, nodalLine * 0.8);
    surfaceColor += fresnel * uAccent * 2.0;

    // Specular highlight
    vec3 lightDir = normalize(vec3(1.0, 2.0, 3.0));
    vec3 H = normalize(lightDir + V);
    float spec = pow(max(dot(N, H), 0.0), 32.0);
    surfaceColor += vec3(spec * 1.5);

    float alpha = clamp(0.35 + fresnel * 0.65 + nodalLine * 0.5, 0.0, 0.95);
    gl_FragColor = vec4(surfaceColor, alpha);
}
`;
