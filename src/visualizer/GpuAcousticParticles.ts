import { CARTESIAN_PRESSURE_GLSL } from '../math/CartesianPressureField';
import * as THREE from 'three';
import { PalettePreset } from './ColorPalettes';
import { CYMATICS_CORE_GLSL } from './shaders/cymaticsCore';
import { SHAPE_SDF_GLSL } from './shaders/shapeSdfLibrary';
import { AcousticEigenmodes } from '../math/AcousticEigenmodes';

export type ChladniMode = 'normal' | 'inverse';
export type ChamberGeometryType = 'cube' | 'cylinder' | 'sphere' | 'human';
export type ParticleSimulationMode = 'equilibrium' | 'dynamic';
export type FieldShapeType =
  | 'free-field'
  | 'superquadric'
  | 'torus'
  | 'octahedron'
  | 'tetrahedron'
  | 'dodecahedron'
  | 'helix'
  | 'heart'
  | 'custom';

export interface SuperquadricParams {
  eps1: number; // axial curvature [0.08, 4.0]
  eps2: number; // equatorial curvature [0.08, 4.0]
  pinch: number; // vertical taper [-0.8, 0.8]
  lobes: number; // radial petals [0, 12]
  lobeAmp: number; // petal depth [0, 0.4]
}

export interface GpuParticleConfig {
  particleCount?: number;
  gorkovStrength?: number;
  stokesDrag?: number;
  acousticExcitation?: number;
  brownianIntensity?: number;
  particleScale?: number;
  chamberSize?: number;
  simulationMode?: ParticleSimulationMode;
}

// ----------------------------------------------------------------------------
// Analytical 3D Acoustic Radiation Trapping & Rayleigh Streaming Vertex Shader
// Computes Gor'kov Nodal Trapping, Tangent In-Plane Vortex Streaming,
// Droplet Sheath Flow, and Audio Spectral Kinetic Excitation directly per-vertex.
// ----------------------------------------------------------------------------
const PARTICLE_VERTEX_SHADER = `
${CYMATICS_CORE_GLSL}
${SHAPE_SDF_GLSL}

uniform float uTime;
uniform float uParticleScale;
uniform float uChamberSize;
uniform int uChamberType;
uniform int uMode; // 0 = Normal Chladni (nodal p=0), 1 = Inverse Chladni (antinodes)
uniform int uSimMode; // 0 = Equilibrium Preview, 1 = Dynamic Acoustophoresis
uniform int uFieldMode; // 0 = Cavity Chamber, 1 = Field Mode (Unbound)
uniform int uFieldShapeType; // 0=Free-field, 1=Superquadric, 2=Torus, 3=Octahedron, 4=Tetrahedron, 5=Dodecahedron, 6=Helix, 7=Heart, 8=Custom
uniform vec4 uSuperquadricParams; // x=eps1, y=eps2, z=pinch, w=lobes
uniform float uSuperquadricLobeAmp;
uniform float uFieldBoundaryStrength;
uniform float uRadialRoot;
uniform float uSphericalRoot;
uniform float uAcousticContrast;
uniform vec3 uModalNumbers;
uniform vec4 uBandEnergies;
uniform vec2 uHighEnergies;
uniform vec4 uShockwaves[4];
uniform float uGorkovStrength;
uniform float uStokesDrag;
uniform float uBrownianMotion;

uniform vec3 uPaletteA;
uniform vec3 uPaletteB;
uniform vec3 uPaletteC;
uniform vec3 uPaletteD;
uniform vec3 uCoreGlow;
uniform vec3 uAccent;

attribute float aParticleSeed;
attribute float aParticlePhase;

varying vec4 vColor;
varying float vIntensity;
varying float vSpeed;
varying float vDepthFade;

${CARTESIAN_PRESSURE_GLSL}

// 3D Cylindrical Cavity Pressure (Vertical Standing Cylinder along Y) with exact NIST DLMF 10.75 root
float evalCylindricalPressure(vec3 p, vec3 nml, float L) {
    float r = length(p.xz);
    float theta = (abs(p.x) < 1e-6 && abs(p.z) < 1e-6) ? 0.0 : atan(p.z, p.x);
    float m = max(0.0, nml.y);
    float l = max(0.0, nml.z);

    float k = (uRadialRoot > 0.0 ? uRadialRoot : PI * (max(0.5, nml.x) + 0.5 * m - 0.25)) / L;
    float ky = (l * PI) / (2.0 * L);

    float bessel = evalBesselJ(m, k * r);
    float angular = cos(m * theta);
    float axial = cos(ky * p.y);

    return bessel * angular * axial;
}

// 3D Spherical Field with Spherical Harmonics L0-L3 & Radial Bessel Waves with exact root
float evalSphericalPressure(vec3 p, vec3 nml, float L) {
    float r = length(p);
    if (r < 1e-5) return 1.0;
    vec3 n = p / r;
    
    vec4 sh01 = evalSH_L0_L1(n);
    float sh2[5]; evalSH_L2(n, sh2);
    float sh3[7]; evalSH_L3(n, sh3);

    float u = (uSphericalRoot > 0.0 ? uSphericalRoot * r : 3.14159265 * (nml.x + 0.5) * r) / L;
    float j0 = sphericalBessel_j0(u);
    float j1 = sphericalBessel_j1(u * (nml.y / max(nml.x, 1.0)));
    float j2 = sphericalBessel_j2(u * (nml.z / max(nml.x, 1.0)));
    float j3 = sphericalBessel_j3(u * 0.8);

    float mode0 = (0.7 + uBandEnergies.x * 2.2) * j0 * sh01.x * 2.5;
    float mode1 = (0.6 + uBandEnergies.y * 1.8) * j1 * (sh01.y * sin(uTime * 2.4) + sh01.w * cos(uTime * 2.0));
    float mode2 = (0.5 + uBandEnergies.z * 1.5) * j2 * (sh2[0] * cos(nml.y * n.x * 2.0) + sh2[2] * 0.8 + sh2[4]);
    float mode3 = (0.4 + uBandEnergies.w * 1.2) * j3 * (sh3[0] + sh3[3] * sin(nml.z * n.z * 2.0) + sh3[6]);

    return (mode0 + mode1 + mode2 + mode3) * (1.0 / (1.0 + 0.08 * r));
}

// Unified Chamber Pressure Evaluator
float evalChamberPressure(vec3 p, vec3 nml, float L, int chamberType) {
    if (chamberType == 1) {
        return evalCylindricalPressure(p, nml, L);
    } else if (chamberType == 2) {
        return evalSphericalPressure(p, nml, L);
    }
    float pDirect = 0.0;
    evalCartesianGradAndPressure(p, nml, L, pDirect);
    return pDirect;
}

// 3D Spatial Gradient (single-pass analytical in Cartesian, finite differences in Cyl/Sph)
vec3 evalPressureGradient(vec3 p, vec3 nml, float L, int chamberType, out float pressure) {
    if (chamberType == 0) {
        return evalCartesianGradAndPressure(p, nml, L, pressure);
    }
    pressure = evalChamberPressure(p, nml, L, chamberType);
    float eps = clamp(0.006 * L, 0.001, 0.012);
    float dx = evalChamberPressure(p + vec3(eps, 0.0, 0.0), nml, L, chamberType) - evalChamberPressure(p - vec3(eps, 0.0, 0.0), nml, L, chamberType);
    float dy = evalChamberPressure(p + vec3(0.0, eps, 0.0), nml, L, chamberType) - evalChamberPressure(p - vec3(0.0, eps, 0.0), nml, L, chamberType);
    float dz = evalChamberPressure(p + vec3(0.0, 0.0, eps), nml, L, chamberType) - evalChamberPressure(p - vec3(0.0, 0.0, eps), nml, L, chamberType);
    return vec3(dx, dy, dz) / (2.0 * eps);
}

void main() {
    vec3 p0 = position;
    float L = uChamberSize;

    // Adapt base position domain to match active chamber geometry or field mode
    if (uFieldMode == 1) {
        if (uFieldShapeType == 0) {
            // Unbounded Free-Field: Preserve the full 3D low-discrepancy (R3) volume distribution
            // Every particle is an independent 3D point of acoustic dust, free from box walls
            p0 = position;
        } else if (uFieldShapeType == 8) {
            // Custom 3D Mesh: Keep exact sampled surface positions without SDF reprojection
        } else {
            // Analytical geometric shapes (Torus, Superquadric, Octahedron, Tetrahedron, Dodecahedron, Helix, Heart):
            // Retain full 3D particle dust distribution and smoothly confine points outside the shape manifold
            float d0 = evaluateFieldShapeSDF(p0, uFieldShapeType, uSuperquadricParams, uSuperquadricLobeAmp, L * 0.92);
            if (d0 > 0.0) {
                float r = length(p0);
                if (r > 1e-4) {
                    p0 *= clamp(1.0 - (d0 / r), 0.1, 0.95);
                }
            }
        }
    } else if (uChamberType == 1) {
        // Full 4-Quadrant Shirley-Chiu concentric mapping from square [-L, L]^2 to 360° circular cylinder
        vec2 uv = p0.xz / (L * 0.95);
        float r = 0.0;
        float phi = 0.0;
        if (abs(uv.x) > 1e-6 || abs(uv.y) > 1e-6) {
            if (uv.x >= -uv.y) {
                if (uv.x > uv.y) {
                    r = uv.x;
                    phi = (PI * 0.25) * (uv.y / uv.x);
                } else {
                    r = uv.y;
                    phi = (PI * 0.25) * (2.0 - uv.x / uv.y);
                }
            } else {
                if (uv.x < uv.y) {
                    r = -uv.x;
                    phi = (PI * 0.25) * (4.0 + uv.y / uv.x);
                } else {
                    r = -uv.y;
                    phi = (PI * 0.25) * (6.0 - uv.x / uv.y);
                }
            }
        }
        float radiusDisc = abs(r) * (L * 0.95);
        p0.x = radiusDisc * cos(phi);
        p0.z = radiusDisc * sin(phi);
        p0.y = clamp(p0.y, -L * 0.95, L * 0.95);
    } else if (uChamberType == 2) {
        // Uniform 3D sphere volume distribution (r proportional to u^(1/3))
        float rTot = length(p0);
        vec3 dir = rTot > 1e-5 ? p0 / rTot : vec3(0.0, 1.0, 0.0);
        float seedVal = clamp(aParticleSeed, 0.0001, 1.0);
        float mappedRadius = (L * 0.95) * pow(seedVal, 1.0 / 3.0);
        p0 = dir * mappedRadius;
    }

    float pressure = 0.0;
    vec3 gradP = evalPressureGradient(p0, uModalNumbers, L, uChamberType, pressure);

    // 1. 3D Gor'kov Nodal Manifold Projection / Dynamic Acoustophoresis
    // Snaps particles precisely onto the 3D nodal surfaces p(x,y,z) = 0
    float gradSq = dot(gradP, gradP);
    vec3 deltaNodal = - (pressure * gradP) / (gradSq + 0.04);
    
    // Contrast factor: positive contrast moves to nodes; negative moves to antinodes
    float contrastSign = uAcousticContrast >= 0.0 ? 1.0 : -1.0;
    if (uMode == 1) contrastSign = -contrastSign;
    deltaNodal *= contrastSign;

    float trapAmount = clamp(uGorkovStrength * 0.035, 0.5, 1.0);
    if (uSimMode == 1) {
        // Exact wave mode: strict analytical nodal convergence
        trapAmount = 1.0;
    }
    vec3 trappedPos = p0 + deltaNodal * trapAmount;

    // Refinement step 2 for razor-sharp nodal sheet definition
    float p2 = 0.0;
    vec3 g2 = evalPressureGradient(trappedPos, uModalNumbers, L, uChamberType, p2);
    float g2Sq = dot(g2, g2);
    vec3 normG2 = g2Sq > 1e-4 ? g2 / sqrt(g2Sq) : vec3(0.0);
    float refineFactor = uSimMode == 1 ? 0.98 : 0.85;
    trappedPos = trappedPos - (p2 * g2) / (g2Sq + 0.04) * (trapAmount * refineFactor);

    // 2. Continuous 3D Rayleigh In-Plane Streaming Flow (confined strictly to the nodal sheet)
    float audioScale = 0.85 + uBandEnergies.x * 2.2 + uBandEnergies.y * 1.5;
    vec3 k = (uModalNumbers * PI) / (2.0 * L);
    
    vec3 vRayleigh = vec3(
        -sin(2.0 * k.x * trappedPos.x) * cos(2.0 * k.y * trappedPos.y) * cos(k.z * trappedPos.z),
        +cos(2.0 * k.x * trappedPos.x) * sin(2.0 * k.y * trappedPos.y) * cos(k.z * trappedPos.z),
        +sin(2.0 * k.z * trappedPos.z) * cos(2.0 * k.x * trappedPos.x) * sin(k.y * trappedPos.y)
    );

    // Tangential projection onto the nodal sheet tangent plane (preserves razor-sharp sheet lines)
    vec3 vTangent = vRayleigh - normG2 * dot(vRayleigh, normG2);

    float streamDamping = clamp(1.2 / max(0.4, uStokesDrag), 0.3, 2.5);
    float streamPhase = uTime * (1.2 * audioScale) + aParticlePhase * 6.28318;
    vec3 streamingDisp = vTangent * (0.24 * sin(streamPhase) * audioScale * streamDamping);

    // 3. In-Plane Beat Jitter (confined strictly to the tangent plane of the nodal sheet)
    vec3 rawJitter = vec3(
        sin(trappedPos.x * 5.0 + uTime * 4.0 + aParticleSeed * 10.0),
        cos(trappedPos.y * 5.0 + uTime * 3.5 + aParticleSeed * 10.0),
        sin(trappedPos.z * 5.0 + uTime * 4.5 + aParticleSeed * 10.0)
    );
    vec3 jitterTangent = rawJitter - normG2 * dot(rawJitter, normG2);
    vec3 jitterDisp = jitterTangent * (0.015 + uBandEnergies.x * 0.025) * uBrownianMotion;

    // 4. Central Droplet Sheath Flow & Deflection (radius 1.15)
    vec3 currentPos = trappedPos + streamingDisp + jitterDisp;
    float rDrop = length(currentPos);
    if (rDrop < 1.35 && rDrop > 1e-4) {
        vec3 nDrop = currentPos / rDrop;
        float repel = smoothstep(1.35, 0.90, rDrop);
        currentPos += nDrop * (repel * 0.35);
    }

    // 5. Shockwave Pulses
    float rPos = length(currentPos);
    vec3 nShock = rPos > 1e-4 ? currentPos / rPos : vec3(0.0, 1.0, 0.0);
    float shockDisp = 0.0;
    for (int i = 0; i < 4; i++) {
        float birth = uShockwaves[i].x;
        float strength = uShockwaves[i].y;
        float speed = uShockwaves[i].z;
        if (birth > 0.0) {
            float dt = uTime - birth;
            if (dt >= 0.0 && dt < 4.0) {
                float frontR = speed * dt;
                float distFromFront = abs(rPos - frontR);
                float pulse = exp(-distFromFront * 3.5) * exp(-dt * 2.0) * strength;
                shockDisp += pulse * sin(distFromFront * 12.0 - dt * 18.0);
            }
        }
    }
    currentPos += nShock * (shockDisp * 0.8);

    // 6. Boundary Confinement & Field Mode Unbounding
    if (uFieldMode == 1) {
        if (uFieldShapeType == 0) {
            // Unbounded Free-Field: open acoustic radiation with smooth distance continuation
            float rTot = length(currentPos);
            if (rTot > L * 2.5 && rTot > 1e-4) {
                currentPos = (currentPos / rTot) * (L * 2.5);
            }
        } else if (uFieldShapeType == 8) {
            // Custom 3D Mesh: Keep open field with generous bounds matching mesh normalization
            float rTot = length(currentPos);
            if (rTot > L * 2.2 && rTot > 1e-4) {
                currentPos = (currentPos / rTot) * (L * 2.2);
            }
        } else {
            // Arbitrary Shape Manifold via Signed Distance Field (SDF)
            float shapeDist = evaluateFieldShapeSDF(currentPos, uFieldShapeType, uSuperquadricParams, uSuperquadricLobeAmp, L * 0.95);
            if (shapeDist > 0.0) {
                vec3 shapeN = computeFieldShapeNormal(currentPos, uFieldShapeType, uSuperquadricParams, uSuperquadricLobeAmp, L * 0.95);
                currentPos -= shapeN * (shapeDist * clamp(uFieldBoundaryStrength, 0.6, 1.2));
            }
        }
    } else {
        // Classic Physical Cavity Chamber Boundary Confinement
        if (uChamberType == 0) {
            // Cube: [-L * 0.96, L * 0.96]^3 (Fills all 6 flat square faces wall-to-wall)
            currentPos = clamp(currentPos, -vec3(L * 0.96), vec3(L * 0.96));
        } else if (uChamberType == 1) {
            // Vertical Cylinder: Radius in XZ <= L * 0.96, Height in Y in [-L * 0.96, L * 0.96]
            float rXZ = length(currentPos.xz);
            if (rXZ > L * 0.96 && rXZ > 1e-4) {
                currentPos.xz = (currentPos.xz / rXZ) * (L * 0.96);
            }
            currentPos.y = clamp(currentPos.y, -L * 0.96, L * 0.96);
        } else if (uChamberType == 2) {
            // Sphere: Radius L * 0.96
            float rTot = length(currentPos);
            if (rTot > L * 0.96 && rTot > 1e-4) {
                currentPos = (currentPos / rTot) * (L * 0.96);
            }
        }
    }

    // 7. Kinetic Speed & Visual OKLab Excitation
    float speed = length(streamingDisp + jitterDisp * 2.0);
    vSpeed = speed;
    float excitation = clamp(speed * 3.0 + abs(pressure) * 1.2 + uBandEnergies.x * 1.5 + shockDisp * 1.5, 0.0, 3.0);
    vIntensity = excitation;

    float colorPhase = length(currentPos) * 0.12 + speed * 0.20 - uTime * 0.04 + aParticleSeed * 0.2;
    vec3 palColor = oklabCosinePalette(colorPhase, uPaletteA, uPaletteB, uPaletteC, uPaletteD);

    vec3 finalColor = palColor * (0.85 + 0.30 * excitation);
    finalColor += uCoreGlow * (excitation * 0.30);
    finalColor += uAccent * (clamp(speed * 0.25, 0.0, 0.6));

    // Refined translucent opacity for ultra-dense 262k particle planar sheets
    float alpha = clamp(0.045 + excitation * 0.055, 0.025, 0.12);
    vColor = vec4(finalColor, alpha);

    // Camera Transform
    vec4 mvPosition = modelViewMatrix * vec4(currentPos, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    float zDist = max(0.1, -mvPosition.z);
    vDepthFade = smoothstep(0.3, 1.2, zDist);

    // Crisp point size calibrated for 262k particles
    float pSize = (0.50 + excitation * 0.30) * uParticleScale * (28.0 / max(zDist, 0.25));
    gl_PointSize = clamp(pSize, 0.8, 2.8);
}
`;

const PARTICLE_RENDER_FRAGMENT_SHADER = `
precision highp float;

varying vec4 vColor;
varying float vIntensity;
varying float vSpeed;
varying float vDepthFade;

void main() {
    vec2 pCoord = gl_PointCoord * 2.0 - 1.0;
    float r2 = dot(pCoord, pCoord);
    if (r2 > 1.0) discard;

    // Soft Gaussian core for elegant acoustic particle tracer glow
    float coreGaussian = exp(-r2 * 4.5);
    float edgeSoft = 1.0 - smoothstep(0.65, 1.0, sqrt(r2));

    vec3 finalRgb = vColor.rgb * (0.95 + vIntensity * 0.30);
    float finalAlpha = clamp(vColor.a * coreGaussian * edgeSoft * vDepthFade, 0.0, 1.0);

    gl_FragColor = vec4(finalRgb, finalAlpha);
}
`;

export class GpuAcousticParticles {
  public group: THREE.Group;
  private readonly particleCount: number = 262144; // 262k particles for ultra-dense, filled acoustic geometry
  private activeParticleCount: number = 262144;

  // Particle Mesh & Render Pipeline
  private pointsMesh: THREE.Points;
  private renderMaterial: THREE.ShaderMaterial;

  // Acoustic Simulation State
  private chladniMode: ChladniMode = 'normal';
  private chamberType: ChamberGeometryType = 'cube';
  private chamberSize = 1.95;
  private modalNumbers = new THREE.Vector3(1.0, 1.0, 1.0);
  private gorkovStrength = 35.0;
  private stokesDrag = 2.8;
  private acousticExcitation = 1.0;
  private brownianMotion = 0.8;
  private particleScale = 1.0;
  private simulationMode: ParticleSimulationMode = 'equilibrium';
  private acousticContrast = 0.24;
  private activeMedium = 'water';
  private activeParticle = 'polystyrene';

  // Field Mode State
  private fieldMode = false;
  private fieldShapeType: FieldShapeType = 'free-field';
  private lastCustomMeshSamples: Float32Array | null = null;
  private superquadricParams: SuperquadricParams = {
    eps1: 1.0,
    eps2: 1.0,
    pinch: 0.0,
    lobes: 0.0,
    lobeAmp: 0.0,
  };

  constructor(_renderer: THREE.WebGLRenderer, initialPalette: PalettePreset, config?: GpuParticleConfig) {
    this.group = new THREE.Group();
    this.group.position.y = 0.45;

    if (config?.particleCount !== undefined) this.particleCount = config.particleCount;
    this.activeParticleCount = this.particleCount;

    if (config?.gorkovStrength !== undefined) this.gorkovStrength = config.gorkovStrength;
    if (config?.stokesDrag !== undefined) this.stokesDrag = config.stokesDrag;
    if (config?.acousticExcitation !== undefined) this.acousticExcitation = config.acousticExcitation;
    if (config?.brownianIntensity !== undefined) this.brownianMotion = config.brownianIntensity;
    if (config?.particleScale !== undefined) this.particleScale = config.particleScale;
    if (config?.chamberSize !== undefined) this.chamberSize = config.chamberSize;
    if (config?.simulationMode !== undefined) this.simulationMode = config.simulationMode;

    // 1. Initialize Particle Geometry with 3D Low-Discrepancy (R3) Volume Distribution
    const particleGeometry = this.buildParticleGeometry();

    // 2. Initialize Direct 120 FPS Acoustic Shader Material
    this.renderMaterial = new THREE.ShaderMaterial({
      vertexShader: PARTICLE_VERTEX_SHADER,
      fragmentShader: PARTICLE_RENDER_FRAGMENT_SHADER,
      uniforms: {
        uTime: { value: 0 },
        uParticleScale: { value: this.particleScale },
        uChamberSize: { value: this.chamberSize },
        uChamberType: { value: 0 },
        uMode: { value: 0 },
        uSimMode: { value: this.simulationMode === 'equilibrium' ? 0 : 1 },
        uFieldMode: { value: 0 },
        uFieldShapeType: { value: 0 },
        uSuperquadricParams: { value: new THREE.Vector4(1.0, 1.0, 0.0, 0.0) },
        uSuperquadricLobeAmp: { value: 0.0 },
        uFieldBoundaryStrength: { value: 0.95 },
        uRadialRoot: { value: 1.841184 },
        uSphericalRoot: { value: 2.081576 },
        uAcousticContrast: { value: this.acousticContrast },
        uModalNumbers: { value: this.modalNumbers.clone() },
        uGorkovStrength: { value: this.gorkovStrength },
        uStokesDrag: { value: this.stokesDrag },
        uBrownianMotion: { value: this.brownianMotion },
        uBandEnergies: { value: new THREE.Vector4() },
        uHighEnergies: { value: new THREE.Vector2() },
        uShockwaves: {
          value: [
            new THREE.Vector4(0, 0, 7.5, 0),
            new THREE.Vector4(0, 0, 7.5, 0),
            new THREE.Vector4(0, 0, 7.5, 0),
            new THREE.Vector4(0, 0, 7.5, 0),
          ],
        },
        uPaletteA: { value: initialPalette.a.clone() },
        uPaletteB: { value: initialPalette.b.clone() },
        uPaletteC: { value: initialPalette.c.clone() },
        uPaletteD: { value: initialPalette.d.clone() },
        uCoreGlow: { value: initialPalette.coreGlow.clone() },
        uAccent: { value: initialPalette.accent.clone() },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });

    this.pointsMesh = new THREE.Points(particleGeometry, this.renderMaterial);
    this.pointsMesh.frustumCulled = false;
    this.group.add(this.pointsMesh);
  }

  private buildParticleGeometry(): THREE.BufferGeometry {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(this.particleCount * 3);
    const particleSeeds = new Float32Array(this.particleCount);
    const particlePhases = new Float32Array(this.particleCount);

    const L = this.chamberSize;
    const phi3 = 1.22074408460575947536;
    const a1 = 1.0 / phi3;
    const a2 = 1.0 / (phi3 * phi3);
    const a3 = 1.0 / (phi3 * phi3 * phi3);

    for (let i = 0; i < this.particleCount; i++) {
      // 3D Low-Discrepancy (R3) Quasi-Random Sequence:
      // Invariant Property: ANY prefix [0, K] fills the entire 3D volume uniformly from wall to wall!
      const ux = (0.5 + i * a1) % 1.0;
      const uy = (0.5 + i * a2) % 1.0;
      const uz = (0.5 + i * a3) % 1.0;

      const jx = (Math.random() - 0.5) * 0.003;
      const jy = (Math.random() - 0.5) * 0.003;
      const jz = (Math.random() - 0.5) * 0.003;

      const posX = ((ux + jx) * 2.0 - 1.0) * (L * 0.95);
      const posY = ((uy + jy) * 2.0 - 1.0) * (L * 0.95);
      const posZ = ((uz + jz) * 2.0 - 1.0) * (L * 0.95);

      positions[i * 3 + 0] = posX;
      positions[i * 3 + 1] = posY;
      positions[i * 3 + 2] = posZ;

      particleSeeds[i] = (i * 0.61803398875) % 1.0;
      particlePhases[i] = (i * 0.38196601125) % 1.0;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aParticleSeed', new THREE.BufferAttribute(particleSeeds, 1));
    geo.setAttribute('aParticlePhase', new THREE.BufferAttribute(particlePhases, 1));
    geo.setDrawRange(0, this.activeParticleCount);

    return geo;
  }

  public setChladniMode(mode: ChladniMode): void {
    this.chladniMode = mode;
    this.renderMaterial.uniforms.uMode.value = mode === 'normal' ? 0 : 1;
  }

  public getChladniMode(): ChladniMode {
    return this.chladniMode;
  }

  public setChamberGeometry(type: ChamberGeometryType): void {
    this.chamberType = type;
    const typeInt = type === 'cube' ? 0 : type === 'cylinder' ? 1 : type === 'sphere' ? 2 : 3;
    this.renderMaterial.uniforms.uChamberType.value = typeInt;
  }

  public setChamberType(type: ChamberGeometryType): void {
    this.setChamberGeometry(type);
  }

  public getChamberSize(): number { return this.chamberSize; }

  public getChamberGeometry(): ChamberGeometryType {
    return this.chamberType;
  }

  public setFieldMode(enabled: boolean): void {
    const wasCustom = this.fieldMode && this.fieldShapeType === 'custom';
    this.fieldMode = enabled;
    this.renderMaterial.uniforms.uFieldMode.value = enabled ? 1 : 0;
    if (!enabled && wasCustom) {
      this.resetParticleDistribution();
    } else if (enabled && this.fieldShapeType === 'custom' && this.lastCustomMeshSamples) {
      this.setCustomMeshSamples(this.lastCustomMeshSamples);
    }
  }

  public getFieldMode(): boolean {
    return this.fieldMode;
  }

  public setFieldShape(shape: FieldShapeType, params?: Partial<SuperquadricParams>): void {
    const prevShape = this.fieldShapeType;
    this.fieldShapeType = shape;
    if (prevShape === 'custom' && shape !== 'custom') {
      this.resetParticleDistribution();
    } else if (shape === 'custom' && this.lastCustomMeshSamples) {
      this.setCustomMeshSamples(this.lastCustomMeshSamples);
    }

    const shapeMap: Record<FieldShapeType, number> = {
      'free-field': 0,
      'superquadric': 1,
      'torus': 2,
      'octahedron': 3,
      'tetrahedron': 4,
      'dodecahedron': 5,
      'helix': 6,
      'heart': 7,
      'custom': 8,
    };
    this.renderMaterial.uniforms.uFieldShapeType.value = shapeMap[shape] ?? 0;
    if (params) {
      if (params.eps1 !== undefined) this.superquadricParams.eps1 = params.eps1;
      if (params.eps2 !== undefined) this.superquadricParams.eps2 = params.eps2;
      if (params.pinch !== undefined) this.superquadricParams.pinch = params.pinch;
      if (params.lobes !== undefined) this.superquadricParams.lobes = params.lobes;
      if (params.lobeAmp !== undefined) this.superquadricParams.lobeAmp = params.lobeAmp;
    }
    const sq = this.superquadricParams;
    this.renderMaterial.uniforms.uSuperquadricParams.value.set(sq.eps1, sq.eps2, sq.pinch, sq.lobes);
    this.renderMaterial.uniforms.uSuperquadricLobeAmp.value = sq.lobeAmp;
  }

  public setFieldBoundaryStrength(strength: number): void {
    this.renderMaterial.uniforms.uFieldBoundaryStrength.value = strength;
  }

  public getFieldShape(): FieldShapeType {
    return this.fieldShapeType;
  }

  public getSuperquadricParams(): Readonly<SuperquadricParams> {
    return { ...this.superquadricParams };
  }

  public setCustomMeshSamples(samples: Float32Array): void {
    this.lastCustomMeshSamples = samples;
    const posAttr = this.pointsMesh.geometry.getAttribute('position') as THREE.BufferAttribute;
    if (!posAttr) return;
    const posArray = posAttr.array as Float32Array;
    for (let i = 0; i < posArray.length; i++) {
      posArray[i] = samples[i % samples.length];
    }
    posAttr.needsUpdate = true;
  }

  public resetParticleDistribution(): void {
    const freshGeo = this.buildParticleGeometry();
    this.pointsMesh.geometry.dispose();
    this.pointsMesh.geometry = freshGeo;
  }

  public setChamberSize(size: number): void {
    this.chamberSize = size;
    this.renderMaterial.uniforms.uChamberSize.value = size;
  }

  public setModalNumbers(n: number, m: number, l: number): void {
    this.modalNumbers.set(n, m, l);
    this.renderMaterial.uniforms.uModalNumbers.value.copy(this.modalNumbers);
    const rRoot = AcousticEigenmodes.getCylindricalBesselDerivativeRoot(m, n);
    const sRoot = AcousticEigenmodes.getSphericalBesselDerivativeRoot(l, n);
    this.renderMaterial.uniforms.uRadialRoot.value = rRoot;
    this.renderMaterial.uniforms.uSphericalRoot.value = sRoot;
  }

  public setModes(n: number, m: number, l: number): void {
    this.setModalNumbers(n, m, l);
  }

  public setSimulationMode(mode: ParticleSimulationMode): void {
    this.simulationMode = mode;
    this.renderMaterial.uniforms.uSimMode.value = mode === 'equilibrium' ? 0 : 1;
  }

  public getSimulationMode(): ParticleSimulationMode {
    return this.simulationMode;
  }

  public setMedium(mediumKey: string): void {
    if (AcousticEigenmodes.MEDIA[mediumKey]) {
      this.activeMedium = mediumKey;
      this.updateContrast();
    }
  }

  public setParticleMaterial(particleKey: string): void {
    if (AcousticEigenmodes.PARTICLES[particleKey]) {
      this.activeParticle = particleKey;
      this.updateContrast();
    }
  }

  private updateContrast(): void {
    const med = AcousticEigenmodes.MEDIA[this.activeMedium] || AcousticEigenmodes.MEDIA.water;
    const part = AcousticEigenmodes.PARTICLES[this.activeParticle] || AcousticEigenmodes.PARTICLES.polystyrene;
    const contrast = AcousticEigenmodes.computeAcousticContrast(med, part);
    this.acousticContrast = contrast.phi;
    this.renderMaterial.uniforms.uAcousticContrast.value = this.acousticContrast;
  }

  public setGorkovStrength(strength: number): void {
    this.gorkovStrength = strength;
    this.renderMaterial.uniforms.uGorkovStrength.value = strength;
  }

  public setStokesDrag(drag: number): void {
    this.stokesDrag = drag;
    this.renderMaterial.uniforms.uStokesDrag.value = drag;
  }

  public setBrownianMotion(amount: number): void {
    this.brownianMotion = amount;
    if (this.renderMaterial?.uniforms?.uBrownianMotion) {
      this.renderMaterial.uniforms.uBrownianMotion.value = amount;
    }
  }

  public getBrownianMotion(): number {
    return this.brownianMotion;
  }

  public setAcousticExcitation(excitation: number): void {
    this.acousticExcitation = excitation;
  }

  public setParticleScale(scale: number): void {
    this.particleScale = scale;
    this.renderMaterial.uniforms.uParticleScale.value = scale;
  }

  public setParticleDensity(count: number): void {
    const clamped = Math.max(1024, Math.min(this.particleCount, Math.round(count)));
    this.activeParticleCount = clamped;
    if (this.pointsMesh && this.pointsMesh.geometry) {
      this.pointsMesh.geometry.setDrawRange(0, clamped);
    }
    // Dynamic point size scaling so lower density modes maintain complete structural presence
    const densityRatio = clamped / this.particleCount;
    const densityScale = Math.pow(1.0 / Math.max(0.1, densityRatio), 0.22);
    this.renderMaterial.uniforms.uParticleScale.value = this.particleScale * densityScale;
  }

  public setParticleCount(count: number): void {
    this.setParticleDensity(count);
  }

  public getParticleCount(): number {
    return this.activeParticleCount;
  }

  public setPalette(palette: PalettePreset): void {
    const u = this.renderMaterial.uniforms;
    u.uPaletteA.value.copy(palette.a);
    u.uPaletteB.value.copy(palette.b);
    u.uPaletteC.value.copy(palette.c);
    u.uPaletteD.value.copy(palette.d);
    u.uCoreGlow.value.copy(palette.coreGlow);
    u.uAccent.value.copy(palette.accent);
  }

  public resetParticles(): void {
    const posAttr = this.pointsMesh.geometry.getAttribute('position') as THREE.BufferAttribute;
    if (!posAttr) return;
    const arr = posAttr.array as Float32Array;
    const L = this.chamberSize;
    const phi3 = 1.22074408460575947536;
    const a1 = 1.0 / phi3;
    const a2 = 1.0 / (phi3 * phi3);
    const a3 = 1.0 / (phi3 * phi3 * phi3);

    for (let i = 0; i < this.particleCount; i++) {
      const ux = (0.5 + i * a1) % 1.0;
      const uy = (0.5 + i * a2) % 1.0;
      const uz = (0.5 + i * a3) % 1.0;

      const jx = (Math.random() - 0.5) * 0.003;
      const jy = (Math.random() - 0.5) * 0.003;
      const jz = (Math.random() - 0.5) * 0.003;

      arr[i * 3 + 0] = ((ux + jx) * 2.0 - 1.0) * (L * 0.95);
      arr[i * 3 + 1] = ((uy + jy) * 2.0 - 1.0) * (L * 0.95);
      arr[i * 3 + 2] = ((uz + jz) * 2.0 - 1.0) * (L * 0.95);
    }
    posAttr.needsUpdate = true;
  }

  public update(
    time: number,
    _dt: number,
    bands: THREE.Vector4,
    highs: THREE.Vector2,
    shockwaves: THREE.Vector4[],
    _fundamentalHz = 432
  ): void {
    const safeDt = Math.min(Math.max(0, _dt), 0.033);
    const renderU = this.renderMaterial.uniforms;
    renderU.uTime.value = time;
    renderU.uModalNumbers.value.copy(this.modalNumbers);
    renderU.uBandEnergies.value.copy(bands);
    renderU.uHighEnergies.value.copy(highs);
    renderU.uChamberType.value = this.chamberType === 'cube' ? 0 : this.chamberType === 'cylinder' ? 1 : this.chamberType === 'sphere' ? 2 : 3;
    renderU.uChamberSize.value = this.chamberSize;
    renderU.uMode.value = this.chladniMode === 'normal' ? 0 : 1;
    renderU.uSimMode.value = this.simulationMode === 'equilibrium' ? 0 : 1;
    renderU.uAcousticContrast.value = this.acousticContrast;
    renderU.uGorkovStrength.value = this.gorkovStrength;
    renderU.uStokesDrag.value = this.stokesDrag;
    renderU.uBrownianMotion.value = this.brownianMotion;

    for (let i = 0; i < 4; i++) {
      if (shockwaves[i]) {
        (renderU.uShockwaves.value[i] as THREE.Vector4).copy(shockwaves[i]);
      }
    }
  }

  public setVisible(visible: boolean): void {
    this.group.visible = visible;
  }

  public isVisible(): boolean {
    return this.group.visible;
  }

  public dispose(): void {
    this.renderMaterial.dispose();
    this.pointsMesh.geometry.dispose();
  }
}
