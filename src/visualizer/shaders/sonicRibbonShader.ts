import { CYMATICS_CORE_GLSL } from './cymaticsCore';

export const SONIC_RIBBON_VERTEX_SHADER = `
${CYMATICS_CORE_GLSL}

uniform float uTime;
uniform float uPropagationSpeed;
uniform float uHistoryHead;
uniform sampler2D uAudioHistory;
uniform vec4 uBandEnergies;
uniform vec2 uHighEnergies;

varying vec2 vUv;
varying float vDisplacement;
varying float vRadius;
varying vec3 vViewPosition;
varying vec3 vWorldNormal;

void main() {
    vUv = uv;
    
    // 3-turn Archimedean spiral
    float angle = uv.x * TWO_PI * 3.0 + uTime * 0.2;
    float r = 0.5 + uv.y * 7.5;
    vRadius = r;

    // Retarded-time texture sample
    float travelTime = r / uPropagationSpeed;
    float historyRow = fract(uHistoryHead - travelTime * 0.15);
    vec4 audioSample = texture2D(uAudioHistory, vec2(uv.x, historyRow));
    float spectralAmp = audioSample.r;

    // 3D displacement along Y and radial axis
    float dispY = spectralAmp * 2.2 * (1.0 / (0.8 + 0.2 * r));
    dispY += sin(r * 4.0 - uTime * 6.0) * 0.2 * uBandEnergies.y;
    vDisplacement = dispY;

    // Cylindrical / Spiral 3D Coordinates
    float x = r * cos(angle);
    float z = r * sin(angle);
    float y = dispY + (uv.y - 0.5) * 0.5;

    vec3 displacedPos = vec3(x, y, z);

    // Analytical Surface Derivatives for Frenet Normal Frame
    // Tangent along spiral u:
    float dAngle_du = TWO_PI * 3.0;
    vec3 dPos_du = vec3(-r * sin(angle) * dAngle_du, 0.0, r * cos(angle) * dAngle_du);

    // Tangent along radial v:
    float dr_dv = 7.5;
    float dY_dv = -dispY * (0.2 * dr_dv / (0.8 + 0.2 * r)) + 0.5;
    vec3 dPos_dv = vec3(dr_dv * cos(angle), dY_dv, dr_dv * sin(angle));

    vec3 ribNormal = normalize(cross(dPos_dv, dPos_du));
    vWorldNormal = normalize(normalMatrix * ribNormal);

    vec4 mvPosition = modelViewMatrix * vec4(displacedPos, 1.0);
    vViewPosition = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
}
`;

export const SONIC_RIBBON_FRAGMENT_SHADER = `
${CYMATICS_CORE_GLSL}

uniform float uTime;
uniform vec3 uPaletteA;
uniform vec3 uPaletteB;
uniform vec3 uPaletteC;
uniform vec3 uPaletteD;
uniform vec3 uCoreGlow;
uniform vec3 uAccent;

varying vec2 vUv;
varying float vDisplacement;
varying float vRadius;
varying vec3 vViewPosition;
varying vec3 vWorldNormal;

void main() {
    vec3 N = normalize(vWorldNormal);
    vec3 V = normalize(vViewPosition);

    float NdotV = abs(dot(N, V));
    float fresnel = pow(1.0 - NdotV, 3.0);

    // OKLab Cosine palette color
    float colorT = vUv.x + vRadius * 0.1 - uTime * 0.06;
    vec3 palColor = oklabCosinePalette(colorT, uPaletteA, uPaletteB, uPaletteC, uPaletteD);

    // Glowing crests on displacement peaks with Apple radiant tone
    vec3 crestColor = mix(palColor, uCoreGlow, clamp(vDisplacement * 1.5, 0.0, 1.0));
    vec3 finalRgb = appleRadiantGlow(crestColor, clamp(vDisplacement * 1.4, 0.0, 2.5), 0.4);
    finalRgb += uAccent * (fresnel * 1.8 + smoothstep(0.8, 1.0, vDisplacement) * 1.5);

    // Anti-Aliased Derivative Wireframe Grid Lines (No Moire)
    vec2 gridCoord = vUv * vec2(64.0, 32.0);
    vec2 gridDelta = fwidth(gridCoord);
    vec2 gridLine = smoothstep(vec2(0.5) - gridDelta * 1.5, vec2(0.5), fract(gridCoord)) *
                    (1.0 - smoothstep(vec2(0.5), vec2(0.5) + gridDelta * 1.5, fract(gridCoord)));
    float wireframe = max(gridLine.x, gridLine.y);
    finalRgb += vec3(wireframe * 0.45);

    float alpha = clamp(0.35 + fresnel * 0.65 + vDisplacement * 0.8, 0.0, 0.96);
    alpha *= exp(-0.06 * vRadius);

    gl_FragColor = vec4(finalRgb, alpha);
}
`;

