/**
 * bloodBrainBarrierShader.ts
 * SoundForm 3D - Blood-Brain Barrier Acoustic Dilation & Paracellular Extravasation Shaders
 *
 * Biological Features:
 * - Brain capillary cylindrical lumen with Claudin-5 tight junction network.
 * - Microbubble cavitation acoustic radiation waves.
 * - Reversible pore unzipping and transvascular nanomedicine / antibody streaming.
 */

export const BBB_CAPILLARY_VERTEX_SHADER = `
precision highp float;

uniform float uTime;
uniform float uAcousticPressure;
uniform float uCavitationFrequency;
uniform float uDilationProgress;
uniform vec3  uFocalSpotCenter;

varying vec3 vWorldPosition;
varying vec3 vWorldNormal;
varying vec2 vUv;
varying float vLocalDilation;
varying float vCavitationStress;

void main() {
    vUv = uv;
    vec3 basePos = position;

    float zCoord = position.z;
    vec4 worldPosBase = modelMatrix * vec4(position, 1.0);
    float distToFocus = length(worldPosBase.xyz - uFocalSpotCenter);
    float focalGaussian = exp(-pow(distToFocus * 0.5, 2.0));

    // Acoustic Cavitation Peristaltic Wave
    float cavitationPulsation = sin(uTime * uCavitationFrequency + zCoord * 2.5) * uAcousticPressure * focalGaussian;
    vCavitationStress = abs(cavitationPulsation) + focalGaussian * uAcousticPressure;

    // Capillary Wall Acoustic Dilation
    float dilationOffset = uDilationProgress * focalGaussian * 0.45 + cavitationPulsation * 0.1;
    vLocalDilation = clamp(uDilationProgress * focalGaussian, 0.0, 1.0);

    vec3 radialNormal = normalize(vec3(position.x, position.y, 0.0));
    vec3 displacedPos = position + radialNormal * dilationOffset;

    vec4 worldPos = modelMatrix * vec4(displacedPos, 1.0);
    vWorldPosition = worldPos.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * radialNormal);

    gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

export const BBB_CAPILLARY_FRAGMENT_SHADER = `
precision highp float;

uniform float uTime;
uniform vec3  uCameraPosition;
uniform vec3  uEndothelialColor;    // Endothelium Base
uniform vec3  uClaudin5TightColor;   // Sealed Tight Junction Green
uniform vec3  uDilatedJunctionColor; // Opened Cleft Gold/Cyan
uniform vec3  uAstrocyteEndFeetColor;// Abluminal Glia Blue

varying vec3 vWorldPosition;
varying vec3 vWorldNormal;
varying vec2 vUv;
varying float vLocalDilation;
varying float vCavitationStress;

vec2 hash22(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return fract(sin(p) * 43758.5453123);
}

float evalClaudinJunctions(vec2 uv, float dilation) {
    vec2 st = uv * vec2(10.0, 5.0);
    vec2 i_st = floor(st);
    vec2 f_st = fract(st);

    float minDist = 1.0;
    for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
            vec2 neighbor = vec2(float(x), float(y));
            vec2 point = hash22(i_st + neighbor);
            vec2 diff = neighbor + point - f_st;
            minDist = min(minDist, length(diff));
        }
    }

    float strandWidth = 0.08 + dilation * 0.16;
    return smoothstep(strandWidth, strandWidth - 0.04, minDist);
}

void main() {
    vec3 N = normalize(vWorldNormal);
    vec3 V = normalize(uCameraPosition - vWorldPosition);
    vec3 L = normalize(vec3(1.0, 3.0, 2.0));

    float junctionMask = evalClaudinJunctions(vUv, vLocalDilation);
    vec3 junctionColor = mix(uClaudin5TightColor, uDilatedJunctionColor, vLocalDilation);

    float astrocyteWeb = smoothstep(0.4, 0.45, fract(vUv.x * 20.0 + sin(vUv.y * 15.0) * 0.5));
    vec3 outerWallColor = mix(uEndothelialColor, uAstrocyteEndFeetColor, astrocyteWeb * 0.6);
    vec3 baseColor = mix(outerWallColor, junctionColor, junctionMask * (1.1 + vCavitationStress * 0.6));

    float diff = max(dot(N, L), 0.0);
    vec3 shockFlash = vec3(0.2, 0.6, 1.0) * vCavitationStress * 0.8;

    vec3 rawColor = baseColor * (diff * 0.6 + 0.4) + shockFlash;
    vec3 finalColor = rawColor / (rawColor + vec3(1.0)) * 1.35; // Reinhard tone map

    gl_FragColor = vec4(finalColor, 0.82);
}
`;

export const NANOBOT_STREAM_VERTEX_SHADER = `
precision highp float;

uniform float uTime;
uniform float uDilationProgress;
uniform float uStreamSpeed;
uniform vec3  uFocalSpotCenter;

attribute vec3  aInitialPosition;
attribute vec3  aTargetTumorPos;
attribute float aParticleSeed;

varying float vExtravasated;
varying vec3  vNanobotColor;

void main() {
    float progress = fract((uTime * uStreamSpeed) + aParticleSeed);
    float canCross = step(0.25, uDilationProgress);
    vExtravasated = canCross;

    vec3 bloodPos = aInitialPosition + vec3(0.0, 0.0, progress * 8.0 - 4.0);
    vec3 tumorPos = mix(bloodPos, aTargetTumorPos, clamp(progress * 1.5, 0.0, 1.0));
    vec3 finalPos = mix(bloodPos, tumorPos, canCross);

    vNanobotColor = mix(vec3(0.2, 0.7, 1.0), vec3(0.0, 1.0, 0.5), canCross);

    gl_PointSize = (1.0 + canCross * 0.6) * 12.0;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(finalPos, 1.0);
}
`;

export const NANOBOT_STREAM_FRAGMENT_SHADER = `
precision highp float;

varying float vExtravasated;
varying vec3  vNanobotColor;

void main() {
    vec2 coord = gl_PointCoord - vec2(0.5);
    float dist = length(coord);
    if (dist > 0.5) discard;

    float core = smoothstep(0.5, 0.1, dist);
    vec3 finalColor = vNanobotColor * (core * 2.0 + 0.5);

    gl_FragColor = vec4(finalColor, core);
}
`;
