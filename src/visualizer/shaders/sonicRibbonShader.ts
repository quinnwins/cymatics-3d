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
    
    // Longitudinal parameter u along 4.5-turn spiral curve:
    float u = uv.x;
    // Transverse width parameter v across the ribbon (-0.5 to +0.5):
    float v = uv.y - 0.5;

    float turns = 4.5;
    float theta = u * TWO_PI * turns + uTime * 0.15;
    float r = 0.75 + u * 6.2;
    vRadius = r;

    // Retarded-time texture sample along the acoustic spiral propagation path
    float travelTime = r / uPropagationSpeed;
    float historyRow = fract(uHistoryHead - travelTime * 0.15);
    vec4 audioSample = texture2D(uAudioHistory, vec2(u, historyRow));
    float spectralAmp = audioSample.r;

    // Acoustic displacement and dynamic standing wave elevation
    float dispY = spectralAmp * 1.8 * (1.0 / (0.8 + 0.18 * r));
    dispY += sin(u * TWO_PI * 6.0 - uTime * 3.5) * 0.25 * (uBandEnergies.y + 0.3);
    vDisplacement = dispY;

    // Centerline 3D trajectory
    float cx = r * cos(theta);
    float cz = r * sin(theta);
    float cy = dispY + sin(u * TWO_PI * 2.0 - uTime * 1.2) * 0.4;

    // Tangent vector along centerline
    float dTheta_du = TWO_PI * turns;
    float dr_du = 6.2;
    vec3 T = normalize(vec3(
        dr_du * cos(theta) - r * sin(theta) * dTheta_du,
        0.0,
        dr_du * sin(theta) + r * cos(theta) * dTheta_du
    ));

    // Binormal transverse vector for ribbon width (width = 0.45 units)
    vec3 Up = vec3(0.0, 1.0, 0.0);
    vec3 B = normalize(cross(T, Up));
    vec3 N_surf = normalize(cross(B, T));

    // Extrude vertex across ribbon width
    float ribbonWidth = 0.42 * (1.0 + u * 0.3);
    vec3 displacedPos = vec3(cx, cy, cz) + B * (v * ribbonWidth) + N_surf * (v * 0.1);

    vViewNormal = normalize(normalMatrix * N_surf);

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
varying vec3 vViewNormal;

void main() {
    vec3 N = normalize(vViewNormal);
    vec3 V = normalize(vViewPosition);

    float NdotV = abs(dot(N, V));
    float fresnel = pow(1.0 - NdotV, 2.6);

    // OKLab Cosine palette color along trajectory
    float colorT = vUv.x * 1.5 + vRadius * 0.08 - uTime * 0.06;
    vec3 palColor = oklabCosinePalette(colorT, uPaletteA, uPaletteB, uPaletteC, uPaletteD);

    // Glowing crests on displacement peaks with Apple radiant tone
    vec3 crestColor = mix(palColor, uCoreGlow, clamp(vDisplacement * 1.5, 0.0, 1.0));
    vec3 finalRgb = appleRadiantGlow(crestColor, clamp(vDisplacement * 1.2, 0.0, 2.0), 0.25);
    finalRgb += uAccent * (fresnel * 0.85 + smoothstep(0.4, 1.0, vDisplacement) * 0.6);

    // Luminous ribbon borders (glowing physical edges)
    float edgeDist = abs(vUv.y - 0.5) * 2.0;
    float borderGlow = smoothstep(0.7, 0.98, edgeDist);
    finalRgb = mix(finalRgb, uAccent, borderGlow * 0.85);

    // Anti-Aliased Derivative Wireframe Grid Lines (No Moire)
    vec2 gridCoord = vec2(vUv.x * 128.0, vUv.y * 6.0);
    vec2 gridDelta = fwidth(gridCoord);
    vec2 gridLine = smoothstep(vec2(0.5) - gridDelta * 1.5, vec2(0.5), fract(gridCoord)) *
                    (1.0 - smoothstep(vec2(0.5), vec2(0.5) + gridDelta * 1.5, fract(gridCoord)));
    float wireframe = max(gridLine.x, gridLine.y);
    finalRgb += uAccent * (wireframe * 0.6);

    float alpha = clamp(0.40 + fresnel * 0.45 + borderGlow * 0.5 + wireframe * 0.35 + vDisplacement * 0.5, 0.0, 0.96);
    alpha *= exp(-0.035 * vRadius);

    gl_FragColor = vec4(finalRgb, alpha);
}
`;

