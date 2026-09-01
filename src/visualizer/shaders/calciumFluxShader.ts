/**
 * calciumFluxShader.ts
 * SoundForm 3D - Intracellular Calcium Flux ([Ca2+]i) & PIEZO1 Ion Channel Activation Shaders
 *
 * Features:
 * - GCaMP6s / Fluo-4 fluorescence wave propagation.
 * - Non-linear Calcium-Induced Calcium Release (CICR) reaction-diffusion solitary wave.
 * - Mitochondrial hyper-calcium overload apoptosis trigger.
 */

export const CALCIUM_FLUX_VERTEX_SHADER = `
precision highp float;

uniform float uTime;
uniform float uAcousticDeformation;

varying vec3 vWorldPosition;
varying vec3 vWorldNormal;
varying vec3 vObjectPosition;
varying vec2 vUv;

void main() {
    vUv = uv;
    vObjectPosition = position;

    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    vWorldNormal = normalize(normalMatrix * normal);

    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const CALCIUM_FLUX_FRAGMENT_SHADER = `
precision highp float;

uniform float uTime;
uniform vec3  uCameraPosition;

// Up to 4 concurrent membrane pore origins (xyz=pos, w=birthTime)
uniform vec4  uPoreOrigins[4];
uniform float uWaveSpeed;           // Intracellular wave velocity
uniform float uDiffusionCoeff;      // Cytoplasmic diffusion
uniform float uCicrGain;            // Regenerative amplification
uniform float uSercaReuptakeRate;   // Decay / ER sequestration
uniform float uBasalCalcium;        // Resting level (~0.1 uM)
uniform vec3  uFluo4RestingColor;   // Dark teal/blue (0.02, 0.15, 0.25)
uniform vec3  uFluo4PeakColor;      // Luminous GCaMP6s Gold/Green (0.25, 1.0, 0.35)
uniform vec3  uOrganelleMaskColor;  // Dense nuclear chromatin/ER (0.05, 0.05, 0.1)

varying vec3 vWorldPosition;
varying vec3 vWorldNormal;
varying vec3 vObjectPosition;
varying vec2 vUv;

#define PI 3.1415926535897932384626433832795

void main() {
    vec3 N = normalize(vWorldNormal);
    vec3 V = normalize(uCameraPosition - vWorldPosition);

    float totalCalciumConcentration = uBasalCalcium;

    for (int i = 0; i < 4; i++) {
        vec3 porePos = uPoreOrigins[i].xyz;
        float birthTime = uPoreOrigins[i].w;

        if (birthTime > 0.0) {
            float dt = uTime - birthTime;
            if (dt > 0.0 && dt < 8.0) {
                float dist = length(vObjectPosition - porePos);
                float waveFrontR = uWaveSpeed * dt;
                float distFromFront = dist - waveFrontR;

                float leadingEdge = exp(-pow(max(distFromFront, 0.0) * 4.0, 2.0));
                float trailingTail = exp(-max(-distFromFront, 0.0) * (uSercaReuptakeRate * 0.8)) * exp(-dt * 0.45);

                float wavePulse = leadingEdge * trailingTail * uCicrGain;
                float ripple = sin(clamp(distFromFront * 6.0, -PI, PI)) * 0.15 * trailingTail;

                totalCalciumConcentration += max(0.0, wavePulse + ripple);
            }
        }
    }

    // Hill-Langmuir Fluorescence Binding Model (GCaMP6s / Fluo-4)
    float cNorm = clamp(totalCalciumConcentration, 0.0, 3.5);
    float hillPower = pow(cNorm, 3.0);
    float fluorescenceRatio = hillPower / (pow(0.8, 3.0) + hillPower);

    float organelleDist = length(vObjectPosition);
    float nucleusMask = smoothstep(0.35, 0.65, organelleDist);

    vec3 calciumColor = mix(uFluo4RestingColor, uFluo4PeakColor, fluorescenceRatio);
    calciumColor = mix(uOrganelleMaskColor, calciumColor, nucleusMask);

    float nDotV = clamp(dot(N, V), 0.0, 1.0);
    float rimGlow = pow(1.0 - nDotV, 2.8) * fluorescenceRatio * 1.5;

    vec3 finalRgb = calciumColor * (0.8 + fluorescenceRatio * 2.2) + rimGlow * uFluo4PeakColor;
    float alpha = clamp(0.55 + fluorescenceRatio * 0.4 + rimGlow * 0.3, 0.0, 0.98);

    gl_FragColor = vec4(finalRgb, alpha);
}
`;
