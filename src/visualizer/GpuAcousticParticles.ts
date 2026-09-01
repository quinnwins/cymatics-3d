import * as THREE from 'three';
import { PalettePreset } from './ColorPalettes';
import { CYMATICS_CORE_GLSL } from './shaders/cymaticsCore';

export type ChladniMode = 'normal' | 'inverse';
export type ChamberGeometryType = 'cube' | 'cylinder' | 'sphere';

export interface GpuParticleConfig {
  simResolution?: number; // 512 -> 262,144 particles
  gorkovStrength?: number;
  stokesDrag?: number;
  acousticExcitation?: number;
  brownianIntensity?: number;
  particleScale?: number;
  chamberSize?: number;
}

// ----------------------------------------------------------------------------
// GPGPU Velocity Simulation Shader
// Computes Gor'kov Radiation Force F = -∇U, Stokes Drag, Shockwaves, and Boundaries
// ----------------------------------------------------------------------------
const GPU_VELOCITY_UPDATE_SHADER = `
${CYMATICS_CORE_GLSL}

uniform sampler2D uPosTexture;
uniform sampler2D uVelTexture;
uniform float uDeltaTime;
uniform float uTime;
uniform int uMode; // 0 = Normal Chladni (nodal p=0), 1 = Inverse Chladni (antinode centers)
uniform int uChamberType; // 0 = Cube, 1 = Cylinder, 2 = Sphere
uniform float uChamberSize;
uniform vec3 uModalNumbers; // (n, m, l) 3D standing wave mode indices
uniform vec4 uBandEnergies; // x=SubBass, y=Bass, z=LowMid, w=Mid
uniform vec2 uHighEnergies; // x=HighMid, y=High
uniform float uFundamentalFreq;
uniform float uGorkovStrength;
uniform float uStokesDrag;
uniform float uAcousticExcitation;
uniform float uBrownianMotion;
uniform vec4 uShockwaves[4];

varying vec2 vUv;

// 3D Simplex / Hash Noise for Acoustic Streaming Micro-Turbulence
float hash31(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

vec3 hash33(vec3 p) {
    p = fract(p * vec3(0.1031, 0.1030, 0.0973));
    p += dot(p, p.yxz + 33.33);
    return fract((p.xxy + p.yxx) * p.zyx) * 2.0 - 1.0;
}

// Continuous Bessel J_m(u)
float evalBesselJ(float m, float u) {
    float sum = 0.0;
    const int N = 12;
    for (int i = 0; i < N; i++) {
        float tau = PI * (float(i) + 0.5) / float(N);
        sum += cos(m * tau - u * sin(tau));
    }
    return sum / float(N);
}

// 3D Cartesian Acoustic Cavity Pressure and Exact Analytical Gradient
void evalCartesianPressureAndGradient(
    vec3 p, 
    vec3 nml, 
    float L, 
    out float pressure, 
    out vec3 gradP
) {
    vec3 k = (nml * PI) / L;
    
    // Primary Modal Eigenfunction: cos(kx * x) * cos(ky * y) * cos(kz * z)
    float cX = cos(k.x * p.x);
    float cY = cos(k.y * p.y);
    float cZ = cos(k.z * p.z);
    float sX = sin(k.x * p.x);
    float sY = sin(k.y * p.y);
    float sZ = sin(k.z * p.z);

    // Permuted Degenerate / Harmonic Mode 2: cos(ky * x) * cos(kz * y) * cos(kx * z)
    float cX2 = cos(k.y * p.x); float cY2 = cos(k.z * p.y); float cZ2 = cos(k.x * p.z);
    float sX2 = sin(k.y * p.x); float sY2 = sin(k.z * p.y); float sZ2 = sin(k.x * p.z);

    // Permuted Degenerate / Harmonic Mode 3: cos(kz * x) * cos(kx * y) * cos(ky * z)
    float cX3 = cos(k.z * p.x); float cY3 = cos(k.x * p.y); float cZ3 = cos(k.y * p.z);
    float sX3 = sin(k.z * p.x); float sY3 = sin(k.x * p.y); float sZ3 = sin(k.y * p.z);

    // Superposition weights driven by audio spectral energy
    float w1 = 1.0;
    float w2 = 0.55 + 0.35 * uBandEnergies.y;
    float w3 = 0.35 + 0.45 * uBandEnergies.z;

    pressure = w1 * (cX * cY * cZ) - w2 * (cX2 * cY2 * cZ2) + w3 * (cX3 * cY3 * cZ3);

    // Analytical Spatial Gradient ∇p = (∂p/∂x, ∂p/∂y, ∂p/∂z)
    float dpdx = w1 * (-k.x * sX * cY * cZ) - w2 * (-k.y * sX2 * cY2 * cZ2) + w3 * (-k.z * sX3 * cY3 * cZ3);
    float dpdy = w1 * (-k.y * cX * sY * cZ) - w2 * (-k.z * cX2 * sY2 * cZ2) + w3 * (-k.x * cX3 * sY3 * cZ3);
    float dpdz = w1 * (-k.z * cX * cY * sZ) - w2 * (-k.x * cX2 * cY2 * sZ2) + w3 * (-k.y * cX3 * cY3 * sZ3);

    gradP = vec3(dpdx, dpdy, dpdz);
}

// 3D Cylindrical Cavity Pressure and Gradient
void evalCylindricalPressureAndGradient(
    vec3 p,
    vec3 nml,
    float L,
    out float pressure,
    out vec3 gradP
) {
    float r = length(p.xy);
    float theta = atan(p.y, p.x);
    float n = max(0.5, nml.x);
    float m = max(0.0, nml.y);
    float l = max(0.0, nml.z);

    float k = PI * (n + 0.5 * m + 0.25) / L;
    float kz = (l * PI) / (L * 2.0);

    float bessel = evalBesselJ(m, k * r);
    float angular = cos(m * theta);
    float axial = cos(kz * p.z);

    pressure = bessel * angular * axial;

    // Numerical gradient for Bessel dynamics
    float eps = 0.01;
    float rPlus = evalBesselJ(m, k * (r + eps));
    float rMinus = evalBesselJ(m, k * max(0.0, r - eps));
    float dbesselDr = (rPlus - rMinus) / (2.0 * eps);

    vec2 nXY = r > 1e-4 ? p.xy / r : vec2(1.0, 0.0);
    vec2 gradXY = dbesselDr * angular * axial * nXY;
    float gradZ = -bessel * angular * kz * sin(kz * p.z);

    gradP = vec3(gradXY, gradZ);
}

// 3D Spherical Resonator Acoustic Pressure and Finite-Difference Gradient
void evalSphericalPressureAndGradient(
    vec3 p, 
    float wavenumber, 
    out float pressure, 
    out vec3 gradP
) {
    pressure = evaluateCymaticsDisplacement(p, uBandEnergies, uHighEnergies, wavenumber, uTime);
    
    // Central finite differences for exact gradient
    float eps = 0.008;
    float px = evaluateCymaticsDisplacement(p + vec3(eps, 0.0, 0.0), uBandEnergies, uHighEnergies, wavenumber, uTime);
    float mx = evaluateCymaticsDisplacement(p - vec3(eps, 0.0, 0.0), uBandEnergies, uHighEnergies, wavenumber, uTime);
    float py = evaluateCymaticsDisplacement(p + vec3(0.0, eps, 0.0), uBandEnergies, uHighEnergies, wavenumber, uTime);
    float my = evaluateCymaticsDisplacement(p - vec3(0.0, eps, 0.0), uBandEnergies, uHighEnergies, wavenumber, uTime);
    float pz = evaluateCymaticsDisplacement(p + vec3(0.0, 0.0, eps), uBandEnergies, uHighEnergies, wavenumber, uTime);
    float mz = evaluateCymaticsDisplacement(p - vec3(0.0, 0.0, eps), uBandEnergies, uHighEnergies, wavenumber, uTime);

    gradP = vec3(px - mx, py - my, pz - mz) / (2.0 * eps);
}

void main() {
    vec4 posData = texture2D(uPosTexture, vUv);
    vec4 velData = texture2D(uVelTexture, vUv);

    vec3 pos = posData.xyz;
    float particleMass = max(posData.w, 0.1);
    vec3 vel = velData.xyz;

    float pressure = 0.0;
    vec3 gradP = vec3(0.0);

    float L = uChamberSize;

    if (uChamberType == 0) {
        // Cartesian Mode
        evalCartesianPressureAndGradient(pos, uModalNumbers, L, pressure, gradP);
    } else if (uChamberType == 1) {
        // Cylindrical Mode
        evalCylindricalPressureAndGradient(pos, uModalNumbers, L, pressure, gradP);
    } else {
        // Spherical Mode
        float k = (2.0 * PI * max(uFundamentalFreq, 100.0)) / 343.0;
        k = clamp(k * 0.15, 1.2, 4.5);
        evalSphericalPressureAndGradient(pos, k, pressure, gradP);
    }

    // 1. Gor'kov Acoustic Radiation Force Field
    // Normal Chladni (mode 0): F = -p * ∇p (drives particles to p = 0 nodal membranes)
    // Inverse Chladni (mode 1): F = +p * ∇p (drives particles to antinode centers)
    vec3 F_gorkov = vec3(0.0);
    float audioAmp = 0.5 + uBandEnergies.x * 2.2 + uBandEnergies.y * 1.5;
    
    if (uMode == 0) {
        F_gorkov = -pressure * gradP * (uGorkovStrength * audioAmp);
    } else {
        F_gorkov = +pressure * gradP * (uGorkovStrength * audioAmp);
    }

    // 2. Viscous Stokes Drag Force
    vec3 F_drag = -vel * uStokesDrag;

    // 3. Acoustic Streaming & Micro-Turbulence (Brownian Jitter)
    vec3 noiseDir = hash33(pos * 4.0 + vec3(uTime * 0.5, uTime * 0.3, uTime * 0.7));
    vec3 F_streaming = noiseDir * (uBrownianMotion * (0.2 + uHighEnergies.x * 0.8));

    // 4. Acoustic Transient Shockwaves
    vec3 F_shock = vec3(0.0);
    float r = length(pos);
    vec3 nPos = r > 0.001 ? pos / r : vec3(0.0, 1.0, 0.0);

    for (int i = 0; i < 4; i++) {
        float birth = uShockwaves[i].x;
        float strength = uShockwaves[i].y;
        float speed = uShockwaves[i].z;
        if (birth > 0.0) {
            float dt = uTime - birth;
            float frontR = speed * dt;
            float distFromFront = abs(r - frontR);
            float pulse = exp(-distFromFront * 3.5) * exp(-dt * 2.5) * strength;
            F_shock += nPos * (pulse * 25.0 * sin(distFromFront * 12.0 - dt * 20.0));
        }
    }

    // 5. Boundary Confinement Force (Elastic Repulsive Wall)
    vec3 F_boundary = vec3(0.0);
    if (uChamberType == 0) {
        // Cube boundary
        float margin = L * 0.08;
        vec3 dDist = abs(pos) - vec3(L - margin);
        vec3 excess = max(dDist, vec3(0.0));
        F_boundary = -sign(pos) * excess * excess * 180.0;
    } else if (uChamberType == 1) {
        // Cylinder boundary
        float margin = L * 0.08;
        float rXY = length(pos.xy);
        float excessR = max(rXY - (L - margin), 0.0);
        float excessZ = max(abs(pos.z) - (L - margin), 0.0);
        vec2 nXY = rXY > 1e-4 ? pos.xy / rXY : vec2(0.0);
        F_boundary.xy = -nXY * (excessR * excessR * 180.0);
        F_boundary.z = -sign(pos.z) * (excessZ * excessZ * 180.0);
    } else {
        // Sphere boundary
        float margin = L * 0.08;
        float excess = max(r - (L - margin), 0.0);
        F_boundary = -nPos * (excess * excess * 180.0);
    }

    // Total Force Integration
    vec3 F_total = F_gorkov + F_drag + F_streaming + F_shock + F_boundary;
    vec3 acceleration = F_total / particleMass;

    // Symplectic Euler / Verlet velocity update
    vec3 newVel = vel + acceleration * uDeltaTime;

    // Physical Speed Clamp for Numerical Stability
    float speed = length(newVel);
    float maxSpeed = 16.0;
    if (speed > maxSpeed) {
        newVel = (newVel / speed) * maxSpeed;
    }

    // Store updated velocity in rgb, acoustic pressure magnitude in a
    gl_FragColor = vec4(newVel, abs(pressure));
}
`;

// ----------------------------------------------------------------------------
// GPGPU Position Simulation Shader
// ----------------------------------------------------------------------------
const GPU_POSITION_UPDATE_SHADER = `
precision highp float;

uniform sampler2D uPosTexture;
uniform sampler2D uVelTexture;
uniform float uDeltaTime;
uniform int uChamberType;
uniform float uChamberSize;
uniform float uTime;
uniform float uReset;

varying vec2 vUv;

// Pseudo-random distribution generator
float rand(vec2 co) {
    return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
}

vec3 getInitialPosition(vec2 uv, float chamberSize, int chamberType) {
    float r1 = rand(uv + vec2(uTime * 0.01, 0.12));
    float r2 = rand(uv + vec2(0.34, uTime * 0.02));
    float r3 = rand(uv + vec2(0.56, 0.78));

    if (chamberType == 0) {
        // Uniform cube distribution
        return (vec3(r1, r2, r3) * 2.0 - 1.0) * (chamberSize * 0.85);
    } else if (chamberType == 1) {
        // Uniform cylinder distribution
        float theta = r1 * 2.0 * 3.14159265;
        float rad = sqrt(r2) * (chamberSize * 0.85);
        float z = (r3 * 2.0 - 1.0) * (chamberSize * 0.85);
        return vec3(rad * cos(theta), rad * sin(theta), z);
    } else {
        // Uniform sphere distribution
        float theta = r1 * 2.0 * 3.14159265;
        float phi = acos(2.0 * r2 - 1.0);
        float rad = pow(r3, 0.3333) * (chamberSize * 0.85);
        return vec3(
            rad * sin(phi) * cos(theta),
            rad * cos(phi),
            rad * sin(phi) * sin(theta)
        );
    }
}

void main() {
    vec4 posData = texture2D(uPosTexture, vUv);
    vec4 velData = texture2D(uVelTexture, vUv);

    vec3 pos = posData.xyz;
    float particleMass = posData.w;
    vec3 vel = velData.xyz;

    float L = uChamberSize;

    // Check reset or invalid bounds
    bool isOutOfBounds = false;
    if (uChamberType == 0) {
        if (any(greaterThan(abs(pos), vec3(L * 1.05)))) isOutOfBounds = true;
    } else if (uChamberType == 1) {
        if (length(pos.xy) > L * 1.05 || abs(pos.z) > L * 1.05) isOutOfBounds = true;
    } else {
        if (length(pos) > L * 1.05) isOutOfBounds = true;
    }

    if (uReset > 0.5 || isOutOfBounds || isnan(pos.x)) {
        vec3 reseededPos = getInitialPosition(vUv, L, uChamberType);
        gl_FragColor = vec4(reseededPos, particleMass);
        return;
    }

    // Position integration
    vec3 newPos = pos + vel * uDeltaTime;

    // Hard Boundary Restitution
    if (uChamberType == 0) {
        newPos = clamp(newPos, -vec3(L * 0.98), vec3(L * 0.98));
    } else if (uChamberType == 1) {
        float rXY = length(newPos.xy);
        if (rXY > L * 0.98) {
            newPos.xy = (newPos.xy / rXY) * (L * 0.98);
        }
        newPos.z = clamp(newPos.z, -L * 0.98, L * 0.98);
    } else {
        float r = length(newPos);
        if (r > L * 0.98) {
            newPos = (newPos / r) * (L * 0.98);
        }
    }

    gl_FragColor = vec4(newPos, particleMass);
}
`;

// ----------------------------------------------------------------------------
// Fullscreen Quad Vertex Shader for FBO passes
// ----------------------------------------------------------------------------
const GPU_QUAD_VERTEX_SHADER = `
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

// ----------------------------------------------------------------------------
// Particle Volumetric Point Rendering Shaders
// ----------------------------------------------------------------------------
const PARTICLE_RENDER_VERTEX_SHADER = `
${CYMATICS_CORE_GLSL}

uniform sampler2D uPosTexture;
uniform sampler2D uVelTexture;
uniform float uTime;
uniform float uParticleScale;
uniform vec4 uBandEnergies;
uniform vec2 uHighEnergies;
uniform vec3 uPaletteA;
uniform vec3 uPaletteB;
uniform vec3 uPaletteC;
uniform vec3 uPaletteD;
uniform vec3 uCoreGlow;
uniform vec3 uAccent;

attribute vec2 aParticleUv;
attribute float aParticleSeed;

varying vec4 vColor;
varying float vIntensity;
varying float vSpeed;

void main() {
    vec4 posData = texture2D(uPosTexture, aParticleUv);
    vec4 velData = texture2D(uVelTexture, aParticleUv);

    vec3 pos = posData.xyz;
    vec3 vel = velData.xyz;
    float acousticPressure = velData.w;

    float speed = length(vel);
    vSpeed = speed;

    // Kinetic & Acoustic Excitation Energy
    float excitation = clamp(speed * 0.35 + acousticPressure * 1.8 + uBandEnergies.x * 2.0, 0.0, 4.0);
    vIntensity = excitation;

    // Inigo Quilez Cosine Palette Color Interpolation with Doppler Shift
    float colorPhase = aParticleSeed + length(pos) * 0.12 + speed * 0.25 - uTime * 0.04;
    vec3 palColor = cosinePalette(colorPhase, uPaletteA, uPaletteB, uPaletteC, uPaletteD);

    // Composite glowing particle color
    vec3 finalColor = palColor * (0.4 + 0.9 * excitation);
    finalColor += uCoreGlow * (excitation * 0.85);
    finalColor += uAccent * (clamp(speed * 0.3, 0.0, 1.5));

    // Particle alpha: subtle ambient dust, glowing on acoustic resonance
    float alpha = clamp(0.12 + excitation * 0.55, 0.0, 0.95);
    vColor = vec4(finalColor, alpha);

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    // Point size with physical distance attenuation & kinetic flare
    float pSize = (1.8 + excitation * 2.8 + speed * 0.6) * uParticleScale * (120.0 / -mvPosition.z);
    gl_PointSize = clamp(pSize, 1.5, 36.0);
}
`;

const PARTICLE_RENDER_FRAGMENT_SHADER = `
precision highp float;

varying vec4 vColor;
varying float vIntensity;
varying float vSpeed;

void main() {
    // Render smooth anti-aliased Gaussian point sprite with hot core
    vec2 coord = gl_PointCoord - vec2(0.5);
    float distSq = dot(coord, coord);
    if (distSq > 0.25) discard;

    // Volumetric Gaussian Falloff
    float alpha = exp(-distSq * 18.0) * vColor.a;

    // Crystalline Luminous Hot Core
    float core = smoothstep(0.04, 0.0, distSq) * (1.0 + vIntensity * 1.5);

    vec3 finalRgb = vColor.rgb + vec3(core * 0.6);
    gl_FragColor = vec4(finalRgb, alpha);
}
`;

export class GpuAcousticParticles {
  public group: THREE.Group;
  private renderer: THREE.WebGLRenderer;

  // Ping-Pong FBO Render Targets (512x512 = 262,144 particles)
  private readonly simResolution: number;
  private readonly particleCount: number;

  private posTargetA!: THREE.WebGLRenderTarget;
  private posTargetB!: THREE.WebGLRenderTarget;
  private velTargetA!: THREE.WebGLRenderTarget;
  private velTargetB!: THREE.WebGLRenderTarget;

  private currentPosTarget!: THREE.WebGLRenderTarget;
  private nextPosTarget!: THREE.WebGLRenderTarget;
  private currentVelTarget!: THREE.WebGLRenderTarget;
  private nextVelTarget!: THREE.WebGLRenderTarget;

  // Offscreen Quad Simulation Pipeline
  private simScene: THREE.Scene;
  private simCamera: THREE.OrthographicCamera;
  private simQuad: THREE.Mesh;
  private velSimMaterial: THREE.ShaderMaterial;
  private posSimMaterial: THREE.ShaderMaterial;

  // Particle Mesh & Render Pipeline
  private pointsMesh: THREE.Points;
  private renderMaterial: THREE.ShaderMaterial;

  // Acoustic Simulation State
  private chladniMode: ChladniMode = 'normal';
  private chamberType: ChamberGeometryType = 'cube';
  private chamberSize = 3.2;
  private modalNumbers = new THREE.Vector3(3.0, 2.0, 4.0);
  private gorkovStrength = 35.0;
  private stokesDrag = 2.8;
  private acousticExcitation = 1.0;
  private brownianMotion = 0.8;
  private particleScale = 1.0;
  private isInitialized = false;

  constructor(renderer: THREE.WebGLRenderer, initialPalette: PalettePreset, config?: GpuParticleConfig) {
    this.group = new THREE.Group();
    this.renderer = renderer;
    this.simResolution = config?.simResolution ?? 512;
    this.particleCount = this.simResolution * this.simResolution;

    if (config?.gorkovStrength !== undefined) this.gorkovStrength = config.gorkovStrength;
    if (config?.stokesDrag !== undefined) this.stokesDrag = config.stokesDrag;
    if (config?.acousticExcitation !== undefined) this.acousticExcitation = config.acousticExcitation;
    if (config?.brownianIntensity !== undefined) this.brownianMotion = config.brownianIntensity;
    if (config?.particleScale !== undefined) this.particleScale = config.particleScale;
    if (config?.chamberSize !== undefined) this.chamberSize = config.chamberSize;

    // 1. Initialize Ping-Pong Render Targets
    this.initRenderTargets();

    // 2. Offscreen Quad & Simulation Materials
    this.simScene = new THREE.Scene();
    this.simCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    this.velSimMaterial = new THREE.ShaderMaterial({
      vertexShader: GPU_QUAD_VERTEX_SHADER,
      fragmentShader: GPU_VELOCITY_UPDATE_SHADER,
      uniforms: {
        uPosTexture: { value: null },
        uVelTexture: { value: null },
        uDeltaTime: { value: 0.016 },
        uTime: { value: 0 },
        uMode: { value: 0 }, // 0 = Normal, 1 = Inverse
        uChamberType: { value: 0 }, // 0 = Cube, 1 = Cylinder, 2 = Sphere
        uChamberSize: { value: this.chamberSize },
        uModalNumbers: { value: this.modalNumbers.clone() },
        uBandEnergies: { value: new THREE.Vector4() },
        uHighEnergies: { value: new THREE.Vector2() },
        uFundamentalFreq: { value: 432 },
        uGorkovStrength: { value: this.gorkovStrength },
        uStokesDrag: { value: this.stokesDrag },
        uAcousticExcitation: { value: this.acousticExcitation },
        uBrownianMotion: { value: this.brownianMotion },
        uShockwaves: {
          value: [
            new THREE.Vector4(0, 0, 7.5, 0),
            new THREE.Vector4(0, 0, 7.5, 0),
            new THREE.Vector4(0, 0, 7.5, 0),
            new THREE.Vector4(0, 0, 7.5, 0),
          ],
        },
      },
      depthWrite: false,
      depthTest: false,
    });

    this.posSimMaterial = new THREE.ShaderMaterial({
      vertexShader: GPU_QUAD_VERTEX_SHADER,
      fragmentShader: GPU_POSITION_UPDATE_SHADER,
      uniforms: {
        uPosTexture: { value: null },
        uVelTexture: { value: null },
        uDeltaTime: { value: 0.016 },
        uChamberType: { value: 0 },
        uChamberSize: { value: this.chamberSize },
        uTime: { value: 0 },
        uReset: { value: 0.0 },
      },
      depthWrite: false,
      depthTest: false,
    });

    this.simQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.velSimMaterial);
    this.simScene.add(this.simQuad);

    // 3. Initialize Particle Render Mesh & Geometry
    const particleGeometry = this.buildParticleGeometry();

    this.renderMaterial = new THREE.ShaderMaterial({
      vertexShader: PARTICLE_RENDER_VERTEX_SHADER,
      fragmentShader: PARTICLE_RENDER_FRAGMENT_SHADER,
      uniforms: {
        uPosTexture: { value: null },
        uVelTexture: { value: null },
        uTime: { value: 0 },
        uParticleScale: { value: this.particleScale },
        uBandEnergies: { value: new THREE.Vector4() },
        uHighEnergies: { value: new THREE.Vector2() },
        uPaletteA: { value: initialPalette.a.clone() },
        uPaletteB: { value: initialPalette.b.clone() },
        uPaletteC: { value: initialPalette.c.clone() },
        uPaletteD: { value: initialPalette.d.clone() },
        uCoreGlow: { value: initialPalette.coreGlow.clone() },
        uAccent: { value: initialPalette.accent.clone() },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.pointsMesh = new THREE.Points(particleGeometry, this.renderMaterial);
    this.pointsMesh.frustumCulled = false;
    this.group.add(this.pointsMesh);

    // 4. Seed initial particle FBO textures
    this.seedInitialFboData();
  }

  private initRenderTargets(): void {
    const isWebGL2 = this.renderer.capabilities.isWebGL2;
    const renderType = isWebGL2 ? THREE.FloatType : THREE.HalfFloatType;

    const rtOptions: THREE.RenderTargetOptions = {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat,
      type: renderType,
      depthBuffer: false,
      stencilBuffer: false,
    };

    this.posTargetA = new THREE.WebGLRenderTarget(this.simResolution, this.simResolution, rtOptions);
    this.posTargetB = new THREE.WebGLRenderTarget(this.simResolution, this.simResolution, rtOptions);
    this.velTargetA = new THREE.WebGLRenderTarget(this.simResolution, this.simResolution, rtOptions);
    this.velTargetB = new THREE.WebGLRenderTarget(this.simResolution, this.simResolution, rtOptions);

    this.currentPosTarget = this.posTargetA;
    this.nextPosTarget = this.posTargetB;
    this.currentVelTarget = this.velTargetA;
    this.nextVelTarget = this.velTargetB;
  }

  private buildParticleGeometry(): THREE.BufferGeometry {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(this.particleCount * 3);
    const particleUvs = new Float32Array(this.particleCount * 2);
    const particleSeeds = new Float32Array(this.particleCount);

    let idx = 0;
    for (let y = 0; y < this.simResolution; y++) {
      for (let x = 0; x < this.simResolution; x++) {
        const u = (x + 0.5) / this.simResolution;
        const v = (y + 0.5) / this.simResolution;

        particleUvs[idx * 2 + 0] = u;
        particleUvs[idx * 2 + 1] = v;
        particleSeeds[idx] = Math.random();

        positions[idx * 3 + 0] = 0;
        positions[idx * 3 + 1] = 0;
        positions[idx * 3 + 2] = 0;

        idx++;
      }
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aParticleUv', new THREE.BufferAttribute(particleUvs, 2));
    geo.setAttribute('aParticleSeed', new THREE.BufferAttribute(particleSeeds, 1));

    return geo;
  }

  private seedInitialFboData(): void {
    const posArray = new Float32Array(this.particleCount * 4);
    const velArray = new Float32Array(this.particleCount * 4);

    const L = this.chamberSize;
    for (let i = 0; i < this.particleCount; i++) {
      // Random uniform distribution in chamber volume
      posArray[i * 4 + 0] = (Math.random() * 2 - 1) * (L * 0.85);
      posArray[i * 4 + 1] = (Math.random() * 2 - 1) * (L * 0.85);
      posArray[i * 4 + 2] = (Math.random() * 2 - 1) * (L * 0.85);
      posArray[i * 4 + 3] = 0.5 + Math.random() * 0.5; // Mass / Inertia

      velArray[i * 4 + 0] = (Math.random() * 2 - 1) * 0.05;
      velArray[i * 4 + 1] = (Math.random() * 2 - 1) * 0.05;
      velArray[i * 4 + 2] = (Math.random() * 2 - 1) * 0.05;
      velArray[i * 4 + 3] = 0.0; // Initial excitation
    }

    const posTex = new THREE.DataTexture(posArray, this.simResolution, this.simResolution, THREE.RGBAFormat, THREE.FloatType);
    posTex.needsUpdate = true;
    const velTex = new THREE.DataTexture(velArray, this.simResolution, this.simResolution, THREE.RGBAFormat, THREE.FloatType);
    velTex.needsUpdate = true;

    // Render initial data into current FBOs
    const initMat = new THREE.MeshBasicMaterial({ map: posTex });
    this.simQuad.material = initMat;
    this.renderer.setRenderTarget(this.currentPosTarget);
    this.renderer.render(this.simScene, this.simCamera);

    initMat.map = velTex;
    this.renderer.setRenderTarget(this.currentVelTarget);
    this.renderer.render(this.simScene, this.simCamera);

    this.renderer.setRenderTarget(null);
    posTex.dispose();
    velTex.dispose();
    initMat.dispose();

    this.isInitialized = true;
  }

  public setChladniMode(mode: ChladniMode): void {
    this.chladniMode = mode;
    this.velSimMaterial.uniforms.uMode.value = mode === 'normal' ? 0 : 1;
  }

  public getChladniMode(): ChladniMode {
    return this.chladniMode;
  }

  public setChamberGeometry(type: ChamberGeometryType): void {
    this.chamberType = type;
    const typeInt = type === 'cube' ? 0 : type === 'cylinder' ? 1 : 2;
    this.velSimMaterial.uniforms.uChamberType.value = typeInt;
    this.posSimMaterial.uniforms.uChamberType.value = typeInt;
  }

  public getChamberGeometry(): ChamberGeometryType {
    return this.chamberType;
  }

  public setChamberSize(size: number): void {
    this.chamberSize = size;
    this.velSimMaterial.uniforms.uChamberSize.value = size;
    this.posSimMaterial.uniforms.uChamberSize.value = size;
  }

  public setModalNumbers(n: number, m: number, l: number): void {
    this.modalNumbers.set(n, m, l);
    this.velSimMaterial.uniforms.uModalNumbers.value.copy(this.modalNumbers);
  }

  public setGorkovStrength(strength: number): void {
    this.gorkovStrength = strength;
    this.velSimMaterial.uniforms.uGorkovStrength.value = strength;
  }

  public setStokesDrag(drag: number): void {
    this.stokesDrag = drag;
    this.velSimMaterial.uniforms.uStokesDrag.value = drag;
  }

  public setAcousticExcitation(excitation: number): void {
    this.acousticExcitation = excitation;
    this.velSimMaterial.uniforms.uAcousticExcitation.value = excitation;
  }

  public setParticleScale(scale: number): void {
    this.particleScale = scale;
    this.renderMaterial.uniforms.uParticleScale.value = scale;
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
    this.posSimMaterial.uniforms.uReset.value = 1.0;
  }

  public update(
    time: number,
    dt: number,
    bands: THREE.Vector4,
    highs: THREE.Vector2,
    shockwaves: THREE.Vector4[],
    fundamentalHz = 432
  ): void {
    if (!this.isInitialized) return;

    const clampedDt = Math.min(dt, 0.033);

    // Step 1: Update Velocity (GPGPU Pass 1)
    const velU = this.velSimMaterial.uniforms;
    velU.uPosTexture.value = this.currentPosTarget.texture;
    velU.uVelTexture.value = this.currentVelTarget.texture;
    velU.uDeltaTime.value = clampedDt;
    velU.uTime.value = time;
    velU.uBandEnergies.value.copy(bands);
    velU.uHighEnergies.value.copy(highs);
    velU.uFundamentalFreq.value = fundamentalHz;

    for (let i = 0; i < 4; i++) {
      if (shockwaves[i]) {
        (velU.uShockwaves.value[i] as THREE.Vector4).copy(shockwaves[i]);
      }
    }

    this.simQuad.material = this.velSimMaterial;
    this.renderer.setRenderTarget(this.nextVelTarget);
    this.renderer.render(this.simScene, this.simCamera);

    // Step 2: Update Position (GPGPU Pass 2)
    const posU = this.posSimMaterial.uniforms;
    posU.uPosTexture.value = this.currentPosTarget.texture;
    posU.uVelTexture.value = this.nextVelTarget.texture;
    posU.uDeltaTime.value = clampedDt;
    posU.uTime.value = time;

    this.simQuad.material = this.posSimMaterial;
    this.renderer.setRenderTarget(this.nextPosTarget);
    this.renderer.render(this.simScene, this.simCamera);
    posU.uReset.value = 0.0;

    // Step 3: Swap Ping-Pong Buffers
    const tempPos = this.currentPosTarget;
    this.currentPosTarget = this.nextPosTarget;
    this.nextPosTarget = tempPos;

    const tempVel = this.currentVelTarget;
    this.currentVelTarget = this.nextVelTarget;
    this.nextVelTarget = tempVel;

    this.renderer.setRenderTarget(null);

    // Step 4: Feed updated FBO textures to Particle Render Shader
    const renderU = this.renderMaterial.uniforms;
    renderU.uPosTexture.value = this.currentPosTarget.texture;
    renderU.uVelTexture.value = this.currentVelTarget.texture;
    renderU.uTime.value = time;
    renderU.uBandEnergies.value.copy(bands);
    renderU.uHighEnergies.value.copy(highs);

    // Subtle group orbital rotation
    this.pointsMesh.rotation.y = time * 0.05;
  }

  public setVisible(visible: boolean): void {
    this.group.visible = visible;
  }

  public isVisible(): boolean {
    return this.group.visible;
  }

  public dispose(): void {
    this.posTargetA.dispose();
    this.posTargetB.dispose();
    this.velTargetA.dispose();
    this.velTargetB.dispose();
    this.velSimMaterial.dispose();
    this.posSimMaterial.dispose();
    this.renderMaterial.dispose();
    this.pointsMesh.geometry.dispose();
  }
}
