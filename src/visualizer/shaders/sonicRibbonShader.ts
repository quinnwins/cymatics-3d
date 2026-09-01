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

void main() {
    vUv = uv;
    // uv.x: Angular angle around cylinder / ribbon [0..1]
    // uv.y: Radial distance from center [0..1] (0 = center source, 1 = outer edge)
    
    float angle = uv.x * TWO_PI * 3.0 + uTime * 0.2; // 3-turn Archimedean spiral
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

void main() {
    // Cosine palette color
    float colorT = vUv.x + vRadius * 0.1 - uTime * 0.06;
    vec3 palColor = cosinePalette(colorT, uPaletteA, uPaletteB, uPaletteC, uPaletteD);

    // Glowing crests on displacement peaks
    vec3 finalRgb = mix(palColor * 0.7, uCoreGlow, clamp(vDisplacement * 1.5, 0.0, 1.0));
    finalRgb += uAccent * smoothstep(0.8, 1.0, vDisplacement);

    // Grid wireframe highlight effect
    float gridU = abs(fract(vUv.x * 64.0) - 0.5);
    float gridV = abs(fract(vUv.y * 32.0) - 0.5);
    float gridLine = smoothstep(0.46, 0.5, max(gridU, gridV));
    finalRgb += vec3(gridLine * 0.3);

    float alpha = clamp(0.4 + vDisplacement * 0.8, 0.0, 0.95);
    alpha *= exp(-0.08 * vRadius);

    gl_FragColor = vec4(finalRgb, alpha);
}
`;
