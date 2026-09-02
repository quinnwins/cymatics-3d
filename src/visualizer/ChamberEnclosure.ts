import * as THREE from 'three';
import { PalettePreset } from './ColorPalettes';
import { CYMATICS_CORE_GLSL } from './shaders/cymaticsCore';
import type { FieldShapeType, SuperquadricParams } from './GpuAcousticParticles';

export type ChamberType = 'cube' | 'cylinder' | 'sphere';

export interface ChamberEnclosureConfig {
  chamberType?: ChamberType;
  size?: number; // Cube half-size or Sphere/Cylinder radius
  glassOpacity?: number;
  refractiveIndex?: number;
  dispersionStrength?: number;
  edgeGlowIntensity?: number;
}

// ----------------------------------------------------------------------------
// Double-Sided Physical Glass Chamber Shader with Chromatic Dispersion & Fresnel
// ----------------------------------------------------------------------------
const GLASS_CHAMBER_VERTEX_SHADER = `
varying vec3 vWorldNormal;
varying vec3 vWorldPosition;
varying vec3 vViewPosition;
varying vec3 vLocalPosition;
varying vec2 vUv;

void main() {
    vUv = uv;
    vLocalPosition = position;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;

    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = -mvPosition.xyz;

    gl_Position = projectionMatrix * mvPosition;
}
`;

const GLASS_CHAMBER_FRAGMENT_SHADER = `
${CYMATICS_CORE_GLSL}

uniform float uTime;
uniform int uChamberType; // 0 = Cube, 1 = Cylinder, 2 = Sphere
uniform float uChamberSize;
uniform float uGlassOpacity;
uniform float uRefractiveIndex; // e.g. 1.52 (crown glass)
uniform float uDispersion; // Chromatic aberration strength
uniform float uFresnelPower;
uniform vec3 uChamberColor;
uniform vec3 uAccentColor;
uniform vec4 uBandEnergies;
uniform vec2 uHighEnergies;
uniform vec3 uCameraPos;
uniform float uRecognitionFlash;

varying vec3 vWorldNormal;
varying vec3 vWorldPosition;
varying vec3 vViewPosition;
varying vec3 vLocalPosition;
varying vec2 vUv;

void main() {
    vec3 N = normalize(vWorldNormal);
    vec3 V = normalize(vViewPosition);

    // Double-sided normal correction
    if (!gl_FrontFacing) {
        N = -N;
    }

    float NdotV = clamp(dot(N, V), 0.0, 1.0);

    // 1. Dielectric Schlick Fresnel Reflectance
    float F0 = 0.042; // Borosilicate glass F0 in air
    float fresnel = F0 + (1.0 - F0) * pow(clamp(1.0 - NdotV, 0.0, 1.0), uFresnelPower);

    // 2. Chromatic Dispersion Refraction Vectors
    float etaG = 1.0 / uRefractiveIndex;
    float etaR = 1.0 / (uRefractiveIndex - uDispersion);
    float etaB = 1.0 / (uRefractiveIndex + uDispersion);

    vec3 refrR = refract(-V, N, etaR);
    vec3 refrG = refract(-V, N, etaG);
    vec3 refrB = refract(-V, N, etaB);

    // Internal Optical Transmission & Dispersion Tint
    vec3 dispersionTint = vec3(
        0.5 + 0.5 * refrR.x,
        0.5 + 0.5 * refrG.y,
        0.5 + 0.5 * refrB.z
    );

    // 3. Laser-Etched Acoustic Grid & Coordinate Scales
    float gridLine = 0.0;
    if (uChamberType == 0) {
        // 3D Cartesian Grid on Cube Faces
        vec3 pGrid = abs(fract(vLocalPosition * 2.0) - 0.5);
        vec3 dGrid = fwidth(vLocalPosition * 2.0);
        vec3 aGrid = smoothstep(dGrid * 1.5, vec3(0.0), pGrid);
        gridLine = max(max(aGrid.x * aGrid.y, aGrid.y * aGrid.z), aGrid.x * aGrid.z) * 0.45;
        
        // Edge borders
        vec3 edgeDist = abs(vLocalPosition) / (uChamberSize * 0.995);
        float edgeBox = smoothstep(0.97, 1.0, max(max(edgeDist.x, edgeDist.y), edgeDist.z));
        gridLine += edgeBox * 0.6;
    } else if (uChamberType == 1) {
        // Cylindrical Grid on Vertical Standing Cylinder
        float theta = atan(vLocalPosition.z, vLocalPosition.x);
        float thetaGrid = abs(fract(theta * 6.0 / TWO_PI) - 0.5);
        float yGrid = abs(fract(vLocalPosition.y * 2.0) - 0.5);
        gridLine = (smoothstep(0.04, 0.0, thetaGrid) + smoothstep(0.04, 0.0, yGrid)) * 0.35;
    } else {
        // Spherical Polar Coordinates Grid
        vec3 nLoc = normalize(vLocalPosition);
        float lat = asin(clamp(nLoc.y, -1.0, 1.0));
        float lon = atan(nLoc.z, nLoc.x);

        float latGrid = abs(fract(lat * 4.0 / PI) - 0.5);
        float lonGrid = abs(fract(lon * 6.0 / TWO_PI) - 0.5);
        gridLine = (smoothstep(0.04, 0.0, latGrid) + smoothstep(0.04, 0.0, lonGrid)) * 0.35;
    }

    // 3b. Crisp 2D Chladni Resonator Sand Mandalas on Base Plate
    if (vLocalPosition.y < -0.90) {
        vec2 p = vLocalPosition.xz;
        float r = length(p);
        float theta = atan(p.y, p.x);
        
        // Mode frequencies driven by acoustic telemetry
        float nMode = max(1.0, uBandEnergies.x * 3.0 + uBandEnergies.y * 2.0 + 2.0);
        float mMode = max(1.0, uBandEnergies.z * 3.0 + 3.0);

        // Multi-order Chladni plate nodal curves
        float chladni1 = cos(nMode * PI * p.x) * cos(mMode * PI * p.y) - cos(mMode * PI * p.x) * cos(nMode * PI * p.y);
        float chladniBessel = evalBesselJ(mMode, nMode * PI * r * 1.4) * cos(mMode * theta);
        float chladniMix = mix(chladni1, chladniBessel, float(uChamberType != 0));

        float dP = abs(chladniMix) / (fwidth(chladniMix) * 1.6 + 0.002);
        float sandMandalas = (1.0 - clamp(dP, 0.0, 1.0)) * smoothstep(1.05, 0.0, r);
        gridLine += sandMandalas * 2.2;
    }

    // 4. Acoustic Resonance Internal Luminescence
    float bassPulse = uBandEnergies.x * 1.6 + uBandEnergies.y * 1.0;
    vec3 glassTint = mix(uChamberColor * 0.25, uAccentColor, fresnel * 0.85);
    glassTint += dispersionTint * 0.15;

    // 5. Specular Highlights from Acoustic Emitter Light Sources
    vec3 lightDir1 = normalize(vec3(1.5, 2.5, 2.0));
    vec3 lightDir2 = normalize(vec3(-2.0, -1.0, -1.5));
    vec3 H1 = normalize(lightDir1 + V);
    vec3 H2 = normalize(lightDir2 + V);

    float spec1 = pow(max(dot(N, H1), 0.0), 64.0);
    float spec2 = pow(max(dot(N, H2), 0.0), 32.0);
    vec3 specularGlint = vec3(spec1 * 1.8 + spec2 * 0.8);

    // Composite Glass Surface Color
    vec3 finalRgb = glassTint * (1.0 + bassPulse * 0.5);
    finalRgb += specularGlint;
    finalRgb += uAccentColor * (gridLine * (1.2 + bassPulse * 0.8));
    finalRgb += (uAccentColor + vec3(0.25, 0.5, 0.9)) * (uRecognitionFlash * 1.6);

    // Dynamic Opacity with Front/Back Transmission (Ultra-transparent optical enclosure)
    float alpha = clamp(
        (gl_FrontFacing ? uGlassOpacity : uGlassOpacity * 0.4) +
        fresnel * 0.06 +
        gridLine * 0.06 +
        (spec1 + spec2) * 0.15 +
        uRecognitionFlash * 0.22,
        0.0,
        0.42
    );

    gl_FragColor = vec4(finalRgb, alpha);
}
`;

// ----------------------------------------------------------------------------
// Beveled Crystal Edge Strut Shader
// ----------------------------------------------------------------------------
const CRYSTAL_STRUT_VERTEX_SHADER = `
varying vec3 vWorldNormal;
varying vec3 vViewPosition;
varying vec3 vLocalPosition;
varying float vProgress;

void main() {
    vLocalPosition = position;
    vWorldNormal = normalize(normalMatrix * normal);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = -mvPosition.xyz;
    vProgress = uv.y;
    gl_Position = projectionMatrix * mvPosition;
}
`;

const CRYSTAL_STRUT_FRAGMENT_SHADER = `
uniform float uTime;
uniform vec3 uColor;
uniform vec3 uAccent;
uniform vec4 uBandEnergies;
uniform float uEdgeGlow;
uniform float uRecognitionFlash;

varying vec3 vWorldNormal;
varying vec3 vViewPosition;
varying vec3 vLocalPosition;
varying float vProgress;

void main() {
    vec3 N = length(vWorldNormal) > 1e-5 ? normalize(vWorldNormal) : vec3(0.0, 1.0, 0.0);
    vec3 V = length(vViewPosition) > 1e-5 ? normalize(vViewPosition) : vec3(0.0, 0.0, 1.0);

    float NdotV = clamp(dot(N, V), 0.0, 1.0);
    float fresnel = pow(clamp(1.0 - NdotV, 0.0, 1.0), 2.5);

    // Subtle Traveling Energy Wave along edge struts
    float pulse = sin(vProgress * 12.0 - uTime * 4.0) * 0.5 + 0.5;
    float audioBoost = uBandEnergies.x * 0.6 + uBandEnergies.y * 0.4;

    vec3 edgeColor = mix(uColor, uAccent, pulse * 0.5);
    edgeColor *= (0.8 + audioBoost + fresnel * 0.8) * uEdgeGlow;
    edgeColor += (uAccent + vec3(0.4, 0.7, 1.0)) * (uRecognitionFlash * 2.2);

    // Specular shine
    vec3 H = normalize(normalize(vec3(1.0, 2.0, 1.5)) + V);
    float spec = pow(clamp(dot(N, H), 0.0, 1.0), 32.0);
    edgeColor += vec3(spec * 0.8);

    // Ultra-minimal datum frame opacity (~0.08-0.18)
    float alpha = clamp(0.08 + fresnel * 0.12 + audioBoost * 0.06 + uRecognitionFlash * 0.35, 0.0, 0.65);
    gl_FragColor = vec4(clamp(edgeColor, 0.0, 10.0), alpha);
}
`;

export class ChamberEnclosure {
  public group: THREE.Group;
  private chamberGroup: THREE.Group;
  private frameGroup: THREE.Group;

  // Geometry Meshes
  private cubeGlassMesh!: THREE.Mesh;
  private cylinderGlassMesh!: THREE.Mesh;
  private sphereGlassMesh!: THREE.Mesh;
  private cubeFrameMeshGroup = new THREE.Group();
  private cylinderFrameMeshGroup = new THREE.Group();
  private sphereFrameMeshGroup = new THREE.Group();

  // Field Mode State & Manifold Groups
  private fieldMode = false;
  private fieldShapeType: FieldShapeType = 'free-field';
  private contourVisible = true;
  private fieldGroup = new THREE.Group();
  private freeFieldEmitterGroup = new THREE.Group();
  private torusFrameGroup = new THREE.Group();
  private octahedronFrameGroup = new THREE.Group();
  private tetrahedronFrameGroup = new THREE.Group();
  private dodecahedronFrameGroup = new THREE.Group();
  private helixFrameGroup = new THREE.Group();
  private heartFrameGroup = new THREE.Group();
  private superquadricFrameGroup = new THREE.Group();
  private customMeshGroup = new THREE.Group();
  private customMeshLines: THREE.LineSegments | null = null;
  private superquadricParams: SuperquadricParams = {
    eps1: 1.0,
    eps2: 1.0,
    pinch: 0.0,
    lobes: 0.0,
    lobeAmp: 0.0,
  };

  // Materials
  private glassMaterial: THREE.ShaderMaterial;
  private strutMaterial: THREE.ShaderMaterial;
  private cornerNodeMaterial: THREE.MeshStandardMaterial;

  // State
  private chamberType: ChamberType = 'cube';
  private size: number;
  private glassOpacity: number;
  private refractiveIndex: number;
  private dispersionStrength: number;
  private edgeGlowIntensity: number;
  private autoRotationSpeed = 0.08;
  private recognitionFlash = 0;

  constructor(initialPalette: PalettePreset, config?: ChamberEnclosureConfig) {
    this.group = new THREE.Group();
    this.group.position.y = 0.45;
    this.chamberGroup = new THREE.Group();
    this.frameGroup = new THREE.Group();

    this.group.add(this.chamberGroup);
    this.group.add(this.frameGroup);
    this.group.add(this.fieldGroup);
    this.fieldGroup.visible = false;

    this.fieldGroup.add(this.freeFieldEmitterGroup);
    this.fieldGroup.add(this.torusFrameGroup);
    this.fieldGroup.add(this.octahedronFrameGroup);
    this.fieldGroup.add(this.tetrahedronFrameGroup);
    this.fieldGroup.add(this.dodecahedronFrameGroup);
    this.fieldGroup.add(this.helixFrameGroup);
    this.fieldGroup.add(this.heartFrameGroup);
    this.fieldGroup.add(this.superquadricFrameGroup);
    this.fieldGroup.add(this.customMeshGroup);

    this.chamberType = config?.chamberType ?? 'cube';
    this.size = config?.size ?? 1.95;
    this.glassOpacity = config?.glassOpacity ?? 0.01;
    this.refractiveIndex = config?.refractiveIndex ?? 1.52;
    this.dispersionStrength = config?.dispersionStrength ?? 0.015;
    this.edgeGlowIntensity = config?.edgeGlowIntensity ?? 0.8;

    // 1. Initialize Glass Material
    this.glassMaterial = new THREE.ShaderMaterial({
      vertexShader: GLASS_CHAMBER_VERTEX_SHADER,
      fragmentShader: GLASS_CHAMBER_FRAGMENT_SHADER,
      uniforms: {
        uTime: { value: 0 },
        uChamberType: { value: 0 },
        uChamberSize: { value: this.size },
        uGlassOpacity: { value: this.glassOpacity },
        uRefractiveIndex: { value: this.refractiveIndex },
        uDispersion: { value: this.dispersionStrength },
        uFresnelPower: { value: 3.2 },
        uChamberColor: { value: initialPalette.coreGlow.clone() },
        uAccentColor: { value: initialPalette.accent.clone() },
        uBandEnergies: { value: new THREE.Vector4() },
        uHighEnergies: { value: new THREE.Vector2() },
        uCameraPos: { value: new THREE.Vector3() },
        uRecognitionFlash: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.NormalBlending,
    });

    // 2. Initialize Strut & Frame Material
    this.strutMaterial = new THREE.ShaderMaterial({
      vertexShader: CRYSTAL_STRUT_VERTEX_SHADER,
      fragmentShader: CRYSTAL_STRUT_FRAGMENT_SHADER,
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: initialPalette.coreGlow.clone() },
        uAccent: { value: initialPalette.accent.clone() },
        uBandEnergies: { value: new THREE.Vector4() },
        uEdgeGlow: { value: this.edgeGlowIntensity },
        uRecognitionFlash: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.cornerNodeMaterial = new THREE.MeshStandardMaterial({
      color: initialPalette.coreGlow,
      emissive: initialPalette.accent,
      emissiveIntensity: 0.8,
      roughness: 0.1,
      metalness: 0.9,
    });

    // 3. Build Geometries for Cube, Cylinder, and Sphere modes
    this.buildCubeChamber();
    this.buildCylinderChamber();
    this.buildSphereChamber();

    // 4. Build Geometries for Field Mode Manifolds
    this.buildFreeFieldEmitter();
    this.buildTorusFrame();
    this.buildOctahedronFrame();
    this.buildTetrahedronFrame();
    this.buildDodecahedronFrame();
    this.buildHelixFrame();
    this.buildHeartFrame();
    this.buildSuperquadricFrame();

    // 5. Set Initial Mode
    this.setChamberType(this.chamberType);
  }

  private buildCubeChamber(): void {
    const half = this.size;
    const full = half * 2;

    // Cube Glass Shell
    const cubeGeo = new THREE.BoxGeometry(full, full, full, 16, 16, 16);
    this.cubeGlassMesh = new THREE.Mesh(cubeGeo, this.glassMaterial);
    this.chamberGroup.add(this.cubeGlassMesh);

    // 12 Beveled Crystal Edge Struts (Ultra-sleek wireframe datum frame)
    const strutRadius = 0.010;
    const strutGeo = new THREE.CylinderGeometry(strutRadius, strutRadius, full, 8);

    const makeStrut = (pos: THREE.Vector3, rot: THREE.Euler): THREE.Mesh => {
      const strut = new THREE.Mesh(strutGeo, this.strutMaterial);
      strut.position.copy(pos);
      strut.rotation.copy(rot);
      return strut;
    };

    // 4 Parallel to Y axis
    this.cubeFrameMeshGroup.add(makeStrut(new THREE.Vector3(half, 0, half), new THREE.Euler(0, 0, 0)));
    this.cubeFrameMeshGroup.add(makeStrut(new THREE.Vector3(-half, 0, half), new THREE.Euler(0, 0, 0)));
    this.cubeFrameMeshGroup.add(makeStrut(new THREE.Vector3(half, 0, -half), new THREE.Euler(0, 0, 0)));
    this.cubeFrameMeshGroup.add(makeStrut(new THREE.Vector3(-half, 0, -half), new THREE.Euler(0, 0, 0)));

    // 4 Parallel to X axis
    this.cubeFrameMeshGroup.add(makeStrut(new THREE.Vector3(0, half, half), new THREE.Euler(0, 0, Math.PI / 2)));
    this.cubeFrameMeshGroup.add(makeStrut(new THREE.Vector3(0, -half, half), new THREE.Euler(0, 0, Math.PI / 2)));
    this.cubeFrameMeshGroup.add(makeStrut(new THREE.Vector3(0, half, -half), new THREE.Euler(0, 0, Math.PI / 2)));
    this.cubeFrameMeshGroup.add(makeStrut(new THREE.Vector3(0, -half, -half), new THREE.Euler(0, 0, Math.PI / 2)));

    // 4 Parallel to Z axis
    this.cubeFrameMeshGroup.add(makeStrut(new THREE.Vector3(half, half, 0), new THREE.Euler(Math.PI / 2, 0, 0)));
    this.cubeFrameMeshGroup.add(makeStrut(new THREE.Vector3(-half, half, 0), new THREE.Euler(Math.PI / 2, 0, 0)));
    this.cubeFrameMeshGroup.add(makeStrut(new THREE.Vector3(half, -half, 0), new THREE.Euler(Math.PI / 2, 0, 0)));
    this.cubeFrameMeshGroup.add(makeStrut(new THREE.Vector3(-half, -half, 0), new THREE.Euler(Math.PI / 2, 0, 0)));

    // 8 Corner Reinforcement Micro-Nodes
    const cornerGeo = new THREE.OctahedronGeometry(0.028, 0);
    const signs = [-1, 1];
    signs.forEach(sx => {
      signs.forEach(sy => {
        signs.forEach(sz => {
          const corner = new THREE.Mesh(cornerGeo, this.cornerNodeMaterial);
          corner.position.set(half * sx, half * sy, half * sz);
          this.cubeFrameMeshGroup.add(corner);
        });
      });
    });

    this.frameGroup.add(this.cubeFrameMeshGroup);
  }

  private buildCylinderChamber(): void {
    const radius = this.size;
    const height = this.size * 2.0;

    // Cylinder Glass Shell
    const cylGeo = new THREE.CylinderGeometry(radius, radius, height, 32, 16, false);
    this.cylinderGlassMesh = new THREE.Mesh(cylGeo, this.glassMaterial);
    this.chamberGroup.add(this.cylinderGlassMesh);

    // Top & Bottom Crystal Rings
    const ringRadius = radius;
    const ringTube = 0.010;
    const ringGeo = new THREE.TorusGeometry(ringRadius, ringTube, 8, 48);

    const topRing = new THREE.Mesh(ringGeo, this.strutMaterial);
    topRing.position.y = height / 2;
    topRing.rotation.x = Math.PI / 2;

    const btmRing = new THREE.Mesh(ringGeo, this.strutMaterial);
    btmRing.position.y = -height / 2;
    btmRing.rotation.x = Math.PI / 2;

    this.cylinderFrameMeshGroup.add(topRing);
    this.cylinderFrameMeshGroup.add(btmRing);

    // 4 Vertical Crystal Struts
    const strutGeo = new THREE.CylinderGeometry(ringTube, ringTube, height, 8);
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2;
      const strut = new THREE.Mesh(strutGeo, this.strutMaterial);
      strut.position.set(Math.cos(angle) * ringRadius, 0, Math.sin(angle) * ringRadius);
      this.cylinderFrameMeshGroup.add(strut);
    }

    this.frameGroup.add(this.cylinderFrameMeshGroup);
  }

  private buildSphereChamber(): void {
    const radius = this.size;

    // Sphere Glass Shell
    const sphereGeo = new THREE.SphereGeometry(radius, 48, 48);
    this.sphereGlassMesh = new THREE.Mesh(sphereGeo, this.glassMaterial);
    this.chamberGroup.add(this.sphereGlassMesh);

    // Ultra-subtle minimal equator ring
    const ringTube = 0.006;
    const ringGeo = new THREE.TorusGeometry(radius, ringTube, 6, 48);
    const ringZX = new THREE.Mesh(ringGeo, this.strutMaterial);
    ringZX.rotation.x = Math.PI / 2;
    this.sphereFrameMeshGroup.add(ringZX);

    this.frameGroup.add(this.sphereFrameMeshGroup);
  }

  private makeStrutBetween(p1: THREE.Vector3, p2: THREE.Vector3, radius = 0.010): THREE.Mesh {
    const dist = p1.distanceTo(p2);
    const geo = new THREE.CylinderGeometry(radius, radius, Math.max(0.01, dist), 8);
    const strut = new THREE.Mesh(geo, this.strutMaterial);
    const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
    strut.position.copy(mid);
    if (dist > 1e-5) {
      const dir = new THREE.Vector3().subVectors(p2, p1).normalize();
      strut.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    }
    return strut;
  }

  private buildFreeFieldEmitter(): void {
    // 3 Concentric Piezo Array Rings at base
    const baseRings = [
      { r: 1.70, tube: 0.014 },
      { r: 1.15, tube: 0.012 },
      { r: 0.55, tube: 0.010 },
    ];
    baseRings.forEach(br => {
      const geo = new THREE.TorusGeometry(br.r, br.tube, 8, 48);
      const ring = new THREE.Mesh(geo, this.strutMaterial);
      ring.position.y = -1.45;
      ring.rotation.x = Math.PI / 2;
      this.freeFieldEmitterGroup.add(ring);
    });

    // 12 Piezo Transducer Crystal Elements
    const nodeGeo = new THREE.OctahedronGeometry(0.035, 0);
    for (let i = 0; i < 12; i++) {
      const angle = (i * Math.PI * 2) / 12;
      const node = new THREE.Mesh(nodeGeo, this.cornerNodeMaterial);
      node.position.set(1.70 * Math.cos(angle), -1.45, 1.70 * Math.sin(angle));
      this.freeFieldEmitterGroup.add(node);
    }

    // 2 Floating Wavefront Rings
    const waveRing1 = new THREE.Mesh(new THREE.TorusGeometry(1.85, 0.007, 6, 48), this.strutMaterial);
    waveRing1.position.y = 0.0;
    waveRing1.rotation.x = Math.PI / 2;
    this.freeFieldEmitterGroup.add(waveRing1);

    const waveRing2 = new THREE.Mesh(new THREE.TorusGeometry(1.45, 0.007, 6, 48), this.strutMaterial);
    waveRing2.position.y = 1.15;
    waveRing2.rotation.x = Math.PI / 2;
    this.freeFieldEmitterGroup.add(waveRing2);
  }

  private buildTorusFrame(): void {
    // Major Equator Ring
    const majorRing = new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.012, 8, 48), this.strutMaterial);
    majorRing.rotation.x = Math.PI / 2;
    this.torusFrameGroup.add(majorRing);

    // 8 Transverse Meridian Ribs
    const ribGeo = new THREE.TorusGeometry(0.70, 0.009, 8, 36);
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI * 2) / 8;
      const rib = new THREE.Mesh(ribGeo, this.strutMaterial);
      rib.position.set(1.35 * Math.cos(angle), 0, 1.35 * Math.sin(angle));
      rib.rotation.y = -angle;
      this.torusFrameGroup.add(rib);
    }
  }

  private buildOctahedronFrame(): void {
    const s = 1.85;
    const verts = [
      new THREE.Vector3(s, 0, 0),
      new THREE.Vector3(-s, 0, 0),
      new THREE.Vector3(0, s, 0),
      new THREE.Vector3(0, -s, 0),
      new THREE.Vector3(0, 0, s),
      new THREE.Vector3(0, 0, -s),
    ];
    const nodeGeo = new THREE.OctahedronGeometry(0.032, 0);
    verts.forEach(v => {
      const node = new THREE.Mesh(nodeGeo, this.cornerNodeMaterial);
      node.position.copy(v);
      this.octahedronFrameGroup.add(node);
    });

    const edges: [number, number][] = [
      [2, 0], [2, 1], [2, 4], [2, 5],
      [3, 0], [3, 1], [3, 4], [3, 5],
      [0, 4], [4, 1], [1, 5], [5, 0],
    ];
    edges.forEach(([i, j]) => {
      this.octahedronFrameGroup.add(this.makeStrutBetween(verts[i], verts[j]));
    });
  }

  private buildTetrahedronFrame(): void {
    const r = 1.85;
    const a = r / Math.sqrt(3);
    const verts = [
      new THREE.Vector3(a, a, a),
      new THREE.Vector3(a, -a, -a),
      new THREE.Vector3(-a, a, -a),
      new THREE.Vector3(-a, -a, a),
    ];
    const nodeGeo = new THREE.OctahedronGeometry(0.032, 0);
    verts.forEach(v => {
      const node = new THREE.Mesh(nodeGeo, this.cornerNodeMaterial);
      node.position.copy(v);
      this.tetrahedronFrameGroup.add(node);
    });
    for (let i = 0; i < 4; i++) {
      for (let j = i + 1; j < 4; j++) {
        this.tetrahedronFrameGroup.add(this.makeStrutBetween(verts[i], verts[j]));
      }
    }
  }

  private buildDodecahedronFrame(): void {
    const phi = (1 + Math.sqrt(5)) / 2;
    const invPhi = 1 / phi;
    const rawVerts: [number, number, number][] = [];
    const signs = [-1, 1];

    signs.forEach(x => signs.forEach(y => signs.forEach(z => rawVerts.push([x, y, z]))));
    signs.forEach(y => signs.forEach(z => rawVerts.push([0, y * invPhi, z * phi])));
    signs.forEach(x => signs.forEach(y => rawVerts.push([x * invPhi, y * phi, 0])));
    signs.forEach(x => signs.forEach(z => rawVerts.push([x * phi, 0, z * invPhi])));

    const rTarget = 1.75;
    const verts = rawVerts.map(v => {
      const vec = new THREE.Vector3(v[0], v[1], v[2]);
      return vec.normalize().multiplyScalar(rTarget);
    });

    const nodeGeo = new THREE.OctahedronGeometry(0.025, 0);
    verts.forEach(v => {
      const node = new THREE.Mesh(nodeGeo, this.cornerNodeMaterial);
      node.position.copy(v);
      this.dodecahedronFrameGroup.add(node);
    });

    let minDiff = Infinity;
    for (let i = 0; i < verts.length; i++) {
      for (let j = i + 1; j < verts.length; j++) {
        const d = verts[i].distanceTo(verts[j]);
        if (d > 0.1 && d < minDiff) minDiff = d;
      }
    }
    const edgeLength = minDiff;
    for (let i = 0; i < verts.length; i++) {
      for (let j = i + 1; j < verts.length; j++) {
        const d = verts[i].distanceTo(verts[j]);
        if (Math.abs(d - edgeLength) < edgeLength * 0.15) {
          this.dodecahedronFrameGroup.add(this.makeStrutBetween(verts[i], verts[j], 0.008));
        }
      }
    }
  }

  private buildHelixFrame(): void {
    const points: THREE.Vector3[] = [];
    const turns = 4;
    const count = 160;
    for (let i = 0; i <= count; i++) {
      const t = (i / count) * Math.PI * 2 * turns;
      const y = (i / count) * 3.0 - 1.5;
      points.push(new THREE.Vector3(1.25 * Math.cos(t), y, 1.25 * Math.sin(t)));
    }
    const curve = new THREE.CatmullRomCurve3(points);
    const geo = new THREE.TubeGeometry(curve, 100, 0.012, 8, false);
    const helix = new THREE.Mesh(geo, this.strutMaterial);
    this.helixFrameGroup.add(helix);
  }

  private buildHeartFrame(): void {
    const pointsXY: THREE.Vector3[] = [];
    const count = 100;
    for (let i = 0; i <= count; i++) {
      const t = (i / count) * Math.PI * 2;
      const x = 16 * Math.pow(Math.sin(t), 3);
      const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
      pointsXY.push(new THREE.Vector3(x * 0.09, y * 0.09, 0));
    }
    const curve = new THREE.CatmullRomCurve3(pointsXY);
    const geo = new THREE.TubeGeometry(curve, 80, 0.010, 6, true);
    const heart = new THREE.Mesh(geo, this.strutMaterial);
    this.heartFrameGroup.add(heart);

    const heart2 = heart.clone();
    heart2.rotation.y = Math.PI / 2;
    this.heartFrameGroup.add(heart2);
  }

  private buildSuperquadricFrame(): void {
    this.superquadricFrameGroup.traverse(obj => {
      if (obj instanceof THREE.Mesh && obj.geometry) {
        obj.geometry.dispose();
      }
    });
    this.superquadricFrameGroup.clear();

    [-0.8, 0, 0.8].forEach(y => {
      const r = 1.35 * Math.sqrt(Math.max(0, 1 - (y / 1.5) ** 2));
      const ringGeo = new THREE.TorusGeometry(r, 0.009, 6, 36);
      const ring = new THREE.Mesh(ringGeo, this.strutMaterial);
      ring.position.y = y;
      ring.rotation.x = Math.PI / 2;
      this.superquadricFrameGroup.add(ring);
    });

    for (let i = 0; i < 4; i++) {
      const ringGeo = new THREE.TorusGeometry(1.35, 0.009, 6, 36);
      const ring = new THREE.Mesh(ringGeo, this.strutMaterial);
      ring.rotation.y = (i * Math.PI) / 4;
      this.superquadricFrameGroup.add(ring);
    }
  }

  public setCustomMeshWireframe(positions: Float32Array): void {
    if (this.customMeshLines) {
      this.customMeshGroup.remove(this.customMeshLines);
      this.customMeshLines.geometry.dispose();
      this.customMeshLines = null;
    }
    if (!positions || positions.length === 0) return;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.customMeshLines = new THREE.LineSegments(geo, this.strutMaterial);
    this.customMeshGroup.add(this.customMeshLines);
  }

  public setFieldMode(enabled: boolean, shape?: FieldShapeType, params?: Partial<SuperquadricParams>): void {
    this.fieldMode = enabled;
    this.chamberGroup.visible = !enabled;
    this.frameGroup.visible = !enabled;
    this.fieldGroup.visible = enabled && this.contourVisible;

    if (shape) {
      this.setFieldShape(shape, params);
    }
  }

  public getFieldMode(): boolean {
    return this.fieldMode;
  }

  public setFieldShape(shape: FieldShapeType, params?: Partial<SuperquadricParams>): void {
    this.fieldShapeType = shape;
    this.freeFieldEmitterGroup.visible = shape === 'free-field';
    this.torusFrameGroup.visible = shape === 'torus';
    this.octahedronFrameGroup.visible = shape === 'octahedron';
    this.tetrahedronFrameGroup.visible = shape === 'tetrahedron';
    this.dodecahedronFrameGroup.visible = shape === 'dodecahedron';
    this.helixFrameGroup.visible = shape === 'helix';
    this.heartFrameGroup.visible = shape === 'heart';
    this.superquadricFrameGroup.visible = shape === 'superquadric';
    this.customMeshGroup.visible = shape === 'custom';

    if (params) {
      if (params.eps1 !== undefined) this.superquadricParams.eps1 = params.eps1;
      if (params.eps2 !== undefined) this.superquadricParams.eps2 = params.eps2;
      if (params.pinch !== undefined) this.superquadricParams.pinch = params.pinch;
      if (params.lobes !== undefined) this.superquadricParams.lobes = params.lobes;
      if (params.lobeAmp !== undefined) this.superquadricParams.lobeAmp = params.lobeAmp;
      // Do not recreate static frame geometries on slider drag ticks
    }
  }

  public getFieldShape(): FieldShapeType {
    return this.fieldShapeType;
  }

  public setContourVisible(visible: boolean): void {
    this.contourVisible = visible;
    if (this.fieldMode) {
      this.fieldGroup.visible = visible;
    }
  }

  public getContourVisible(): boolean {
    return this.contourVisible;
  }

  public setChamberType(type: ChamberType): void {
    this.chamberType = type;

    const isCube = type === 'cube';
    const isCyl = type === 'cylinder';
    const isSph = type === 'sphere';

    this.cubeGlassMesh.visible = isCube;
    this.cubeFrameMeshGroup.visible = isCube;

    this.cylinderGlassMesh.visible = isCyl;
    this.cylinderFrameMeshGroup.visible = isCyl;

    this.sphereGlassMesh.visible = isSph;
    this.sphereFrameMeshGroup.visible = isSph;

    const typeInt = isCube ? 0 : isCyl ? 1 : 2;
    this.glassMaterial.uniforms.uChamberType.value = typeInt;
  }

  public getChamberType(): ChamberType {
    return this.chamberType;
  }

  public setGlassOpacity(opacity: number): void {
    this.glassOpacity = opacity;
    this.glassMaterial.uniforms.uGlassOpacity.value = opacity;
  }

  public setRefractiveIndex(ior: number): void {
    this.refractiveIndex = ior;
    this.glassMaterial.uniforms.uRefractiveIndex.value = ior;
  }

  public setEdgeGlow(intensity: number): void {
    this.edgeGlowIntensity = intensity;
    this.strutMaterial.uniforms.uEdgeGlow.value = intensity;
  }

  public setPalette(palette: PalettePreset): void {
    const gu = this.glassMaterial.uniforms;
    gu.uChamberColor.value.copy(palette.coreGlow);
    gu.uAccentColor.value.copy(palette.accent);

    const su = this.strutMaterial.uniforms;
    su.uColor.value.copy(palette.coreGlow);
    su.uAccent.value.copy(palette.accent);

    this.cornerNodeMaterial.color.copy(palette.coreGlow);
    this.cornerNodeMaterial.emissive.copy(palette.accent);
  }

  public update(time: number, dt: number, bands: THREE.Vector4, highs: THREE.Vector2, camera?: THREE.Camera): void {
    if (this.recognitionFlash > 0.001) {
      this.recognitionFlash = Math.max(0, this.recognitionFlash - dt * 1.4);
    } else {
      this.recognitionFlash = 0;
    }

    const gu = this.glassMaterial.uniforms;
    gu.uTime.value = time;
    gu.uBandEnergies.value.copy(bands);
    gu.uHighEnergies.value.copy(highs);
    gu.uRecognitionFlash.value = this.recognitionFlash;

    if (camera) {
      gu.uCameraPos.value.copy(camera.position);
    }

    const su = this.strutMaterial.uniforms;
    su.uTime.value = time;
    su.uBandEnergies.value.copy(bands);
    su.uRecognitionFlash.value = this.recognitionFlash;
  }

  public triggerRecognitionFlash(intensity = 1.0): void {
    this.recognitionFlash = Math.max(this.recognitionFlash, Math.min(2.5, intensity));
  }

  public setVisible(visible: boolean): void {
    this.group.visible = visible;
  }

  public isVisible(): boolean {
    return this.group.visible;
  }

  public setChamberGeometry(type: ChamberType): void {
    this.setChamberType(type);
  }

  public dispose(): void {
    this.glassMaterial.dispose();
    this.strutMaterial.dispose();
    this.cornerNodeMaterial.dispose();
    this.cubeGlassMesh.geometry.dispose();
    this.cylinderGlassMesh.geometry.dispose();
    this.sphereGlassMesh.geometry.dispose();

    const disposedGeos = new Set<THREE.BufferGeometry>();
    const disposeChild = (child: THREE.Object3D) => {
      if ((child instanceof THREE.Mesh || child instanceof THREE.LineSegments) && child.geometry) {
        if (!disposedGeos.has(child.geometry)) {
          disposedGeos.add(child.geometry);
          child.geometry.dispose();
        }
      }
    };

    this.frameGroup.traverse(disposeChild);
    this.fieldGroup.traverse(disposeChild);
  }
}
