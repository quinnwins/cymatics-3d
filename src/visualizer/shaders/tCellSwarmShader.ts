/**
 * tCellSwarmShader.ts
 * SoundForm 3D - Cytotoxic CD8+ T-Cell Swarm & Perforin/Granzyme Degranulation Shaders
 *
 * Features:
 * - Instanced amoeboid deformable T-cell bodies with Simplex noise pseudopods.
 * - Immunological synapse Supramolecular Activation Cluster (SMAC) polarization.
 * - Directed lytic stream of Perforin / Granzyme B particles.
 */

export const TCELL_SWARM_VERTEX_SHADER = `
precision highp float;

uniform float uTime;
uniform float uAmoeboidDeformScale;

attribute vec4 aInstanceVelocity; // xyz = Velocity, w = State (0=Patrol, 1=Engaging, 2=Synapse, 3=Burst, 4=Detaching)
attribute vec4 aTargetMtocDir;    // xyz = Vector toward target, w = Synapse activation

varying vec3 vWorldPosition;
varying vec3 vWorldNormal;
varying vec2 vUv;
varying float vAgentState;
varying float vSynapseActive;
varying float vMtocPolarization;

vec4 permute(vec4 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + 1.0 * C.xxx;
    vec3 x2 = x0 - i2 + 2.0 * C.xxx;
    vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
    i = mod(i, 289.0);
    vec4 p = permute(permute(permute(
                i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

void main() {
    vUv = uv;
    vAgentState = aInstanceVelocity.w;
    vSynapseActive = aTargetMtocDir.w;

    vec3 localPos = position;
    vec3 baseDir = normalize(position);

    vec3 mtocDir = aTargetMtocDir.xyz;
    float mtocAlignment = dot(baseDir, mtocDir);
    vMtocPolarization = mtocAlignment;

    float speed = length(aInstanceVelocity.xyz);
    float noise = snoise(baseDir * 2.5 + vec3(uTime * 1.5, 0.0, speed));
    float pseudopod = noise * uAmoeboidDeformScale;

    if (vSynapseActive > 0.05) {
        if (mtocAlignment > 0.4) {
            localPos -= mtocDir * (0.08 * vSynapseActive);
        } else if (mtocAlignment < -0.4) {
            localPos -= mtocDir * (0.15 * vSynapseActive);
        }
    }

    vec3 displacedPos = localPos + baseDir * pseudopod;
    vec4 worldPos = instanceMatrix * vec4(displacedPos, 1.0);
    vWorldPosition = worldPos.xyz;

    mat3 instNormMat = mat3(instanceMatrix);
    vWorldNormal = normalize(instNormMat * normal);

    gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

export const TCELL_SWARM_FRAGMENT_SHADER = `
precision highp float;

uniform float uTime;
uniform vec3  uCameraPosition;
uniform vec3  uCd8RestingColor;   // Cyan / Azure
uniform vec3  uActivatedColor;    // Luminous Gold / Amber
uniform vec3  uSynapseGlowColor;  // Hot Crimson Lytic Burst

varying vec3 vWorldPosition;
varying vec3 vWorldNormal;
varying vec2 vUv;
varying float vAgentState;
varying float vSynapseActive;
varying float vMtocPolarization;

void main() {
    vec3 N = normalize(vWorldNormal);
    vec3 V = normalize(uCameraPosition - vWorldPosition);

    vec3 tCellColor = mix(uCd8RestingColor, uActivatedColor, vSynapseActive);

    if (vSynapseActive > 0.01 && vMtocPolarization > 0.45) {
        float smacRing = smoothstep(0.45, 0.85, vMtocPolarization);
        float lyticPulse = 0.5 + 0.5 * sin(uTime * 14.0);
        vec3 synapseEmission = uSynapseGlowColor * (smacRing * (2.0 + lyticPulse * 3.0));
        tCellColor = mix(tCellColor, synapseEmission, smacRing * vSynapseActive);
    }

    float nDotV = clamp(dot(N, V), 0.0, 1.0);
    float fresnel = pow(1.0 - nDotV, 3.2);

    vec3 finalRgb = tCellColor * (0.65 + fresnel * 1.8);
    float alpha = clamp(0.75 + fresnel * 0.25 + vSynapseActive * 0.2, 0.0, 0.98);

    gl_FragColor = vec4(finalRgb, alpha);
}
`;

export const PERFORIN_GRANZYME_VERTEX_SHADER = `
precision highp float;

uniform float uTime;

attribute vec3 aStreamOrigin;
attribute vec3 aStreamTarget;
attribute float aProgressOffset;

varying float vGranuleLife;

void main() {
    float t = fract(uTime * 3.5 + aProgressOffset);
    vGranuleLife = t;

    vec3 dir = aStreamTarget - aStreamOrigin;
    vec3 pos = aStreamOrigin + dir * t;
    pos.y += sin(t * 3.14159265) * 0.08;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    gl_PointSize = (3.5 + sin(t * 3.14159265) * 4.0) * (90.0 / -mvPosition.z);
}
`;

export const PERFORIN_GRANZYME_FRAGMENT_SHADER = `
precision highp float;

varying float vGranuleLife;

void main() {
    vec2 coord = gl_PointCoord - vec2(0.5);
    float distSq = dot(coord, coord);
    if (distSq > 0.25) discard;

    float glow = exp(-distSq * 18.0);
    vec3 perforinColor = mix(vec3(1.0, 0.1, 0.3), vec3(1.0, 0.8, 0.2), vGranuleLife);

    gl_FragColor = vec4(perforinColor * (1.5 + glow * 2.0), glow * (1.0 - vGranuleLife));
}
`;
