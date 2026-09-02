import * as THREE from 'three';
import { PalettePreset } from './ColorPalettes';
import { CYMATICS_CORE_GLSL } from './shaders/cymaticsCore';

export type ChladniMode = 'normal' | 'inverse';
export type ChamberGeometryType = 'cube' | 'cylinder' | 'sphere' | 'human';

export interface GpuParticleConfig {
  particleCount?: number;
  gorkovStrength?: number;
  stokesDrag?: number;
  acousticExcitation?: number;
  brownianIntensity?: number;
  particleScale?: number;
  chamberSize?: number;
}

// ----------------------------------------------------------------------------
// Analytical 3D Acoustic Radiation Trapping & Rayleigh Streaming Vertex Shader
// Computes Gor'kov Nodal Trapping, Tangent In-Plane Vortex Streaming,
// Droplet Sheath Flow, and Audio Spectral Kinetic Excitation directly per-vertex.
// ----------------------------------------------------------------------------
const PARTICLE_VERTEX_SHADER = `
${CYMATICS_CORE_GLSL}

uniform float uTime;
uniform float uParticleScale;
uniform float uChamberSize;
uniform int uChamberType;
uniform int uMode; // 0 = Normal Chladni (nodal p=0), 1 = Inverse Chladni (antinodes)
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

// 3D Cartesian Acoustic Cavity Pressure
float evalCartesianPressure(vec3 p, vec3 nml, float L) {
    vec3 k = (nml * PI) / (2.0 * L);
    float cX = cos(k.x * p.x); float cY = cos(k.y * p.y); float cZ = cos(k.z * p.z);
    float cX2 = cos(k.y * p.x); float cY2 = cos(k.z * p.y); float cZ2 = cos(k.x * p.z);
    float cX3 = cos(k.z * p.x); float cY3 = cos(k.x * p.y); float cZ3 = cos(k.y * p.z);

    float w1 = 1.0;
    float w2 = 0.55 + 0.35 * uBandEnergies.y;
    float w3 = 0.35 + 0.45 * uBandEnergies.z;

    return w1 * (cX * cY * cZ) - w2 * (cX2 * cY2 * cZ2) + w3 * (cX3 * cY3 * cZ3);
}

// 3D Cylindrical Cavity Pressure (Vertical Standing Cylinder along Y)
float evalCylindricalPressure(vec3 p, vec3 nml, float L) {
    float r = length(p.xz);
    float theta = (abs(p.x) < 1e-6 && abs(p.z) < 1e-6) ? 0.0 : atan(p.z, p.x);
    float n = max(0.5, nml.x);
    float m = max(0.0, nml.y);
    float l = max(0.0, nml.z);

    float k = PI * (n + 0.5 * m - 0.25) / L;
    float ky = (l * PI) / (2.0 * L);

    float bessel = evalBesselJ(m, k * r);
    float angular = cos(m * theta);
    float axial = cos(ky * p.y);

    return bessel * angular * axial;
}

// 3D Spherical Field with Spherical Harmonics L0-L3 & Radial Bessel Waves
float evalSphericalPressure(vec3 p, vec3 nml, float L) {
    float r = length(p);
    if (r < 1e-5) return 1.0;
    vec3 n = p / r;
    
    vec4 sh01 = evalSH_L0_L1(n);
    float sh2[5]; evalSH_L2(n, sh2);
    float sh3[7]; evalSH_L3(n, sh3);

    float u = (3.14159265 * (nml.x + 0.5) * r) / L;
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
    if (chamberType == 0) {
        return evalCartesianPressure(p, nml, L);
    } else if (chamberType == 1) {
        return evalCylindricalPressure(p, nml, L);
    } else if (chamberType == 2) {
        return evalSphericalPressure(p, nml, L);
    }
    return evalCartesianPressure(p, nml, L);
}

// Exact 3D Spatial Gradient via Central Finite Differences
vec3 evalPressureGradient(vec3 p, vec3 nml, float L, int chamberType, out float pressure) {
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

    // Adapt base position domain to match active chamber geometry with uniform density
    if (uChamberType == 1) {
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

    // 1. Exact 3D Gor'kov Nodal Manifold Projection
    // Snaps particles precisely onto the 3D nodal surfaces p(x,y,z) = 0
    float gradSq = dot(gradP, gradP);
    vec3 deltaNodal = - (pressure * gradP) / (gradSq + 0.04);
    
    // Smooth Gor'kov trapping blend
    float trapAmount = clamp(uGorkovStrength * 0.035, 0.5, 1.0);
    if (uMode == 1) {
        // Inverse Chladni: Trapping onto antinodes
        deltaNodal = -deltaNodal;
    }
    vec3 trappedPos = p0 + deltaNodal * trapAmount;

    // Refinement step 2 for razor-sharp nodal sheet definition
    float p2 = 0.0;
    vec3 g2 = evalPressureGradient(trappedPos, uModalNumbers, L, uChamberType, p2);
    float g2Sq = dot(g2, g2);
    vec3 normG2 = g2Sq > 1e-4 ? g2 / sqrt(g2Sq) : vec3(0.0);
    trappedPos = trappedPos - (p2 * g2) / (g2Sq + 0.04) * (trapAmount * 0.90);

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

    float streamPhase = uTime * (1.2 * audioScale) + aParticlePhase * 6.28318;
    vec3 streamingDisp = vTangent * (0.24 * sin(streamPhase) * audioScale);

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

    // 6. Strict Physical Chamber Boundary Confinement
    // Fills the full rectangular box in Cube mode, cylinder in Cylinder mode, sphere in Sphere mode
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
    float alpha = clamp(0.14 + excitation * 0.14, 0.06, 0.35);
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

  public getChamberGeometry(): ChamberGeometryType {
    return this.chamberType;
  }

  public setChamberSize(size: number): void {
    this.chamberSize = size;
    this.renderMaterial.uniforms.uChamberSize.value = size;
  }

  public setModalNumbers(n: number, m: number, l: number): void {
    this.modalNumbers.set(n, m, l);
    this.renderMaterial.uniforms.uModalNumbers.value.copy(this.modalNumbers);
  }

  public setModes(n: number, m: number, l: number): void {
    this.setModalNumbers(n, m, l);
  }

  public setGorkovStrength(strength: number): void {
    this.gorkovStrength = strength;
    this.renderMaterial.uniforms.uGorkovStrength.value = strength;
  }

  public setStokesDrag(drag: number): void {
    this.stokesDrag = drag;
    this.renderMaterial.uniforms.uStokesDrag.value = drag;
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
    const renderU = this.renderMaterial.uniforms;
    renderU.uTime.value = time;
    renderU.uModalNumbers.value.copy(this.modalNumbers);
    renderU.uBandEnergies.value.copy(bands);
    renderU.uHighEnergies.value.copy(highs);
    renderU.uChamberType.value = this.chamberType === 'cube' ? 0 : this.chamberType === 'cylinder' ? 1 : this.chamberType === 'sphere' ? 2 : 3;
    renderU.uChamberSize.value = this.chamberSize;
    renderU.uMode.value = this.chladniMode === 'normal' ? 0 : 1;
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
