import * as THREE from 'three';
import { PalettePreset } from './ColorPalettes';
import { CYMATICS_CORE_GLSL } from './shaders/cymaticsCore';

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
    float fresnel = F0 + (1.0 - F0) * pow(1.0 - NdotV, uFresnelPower);

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
        // Cylindrical Grid
        float theta = atan(vLocalPosition.y, vLocalPosition.x);
        float thetaGrid = abs(fract(theta * 6.0 / TWO_PI) - 0.5);
        float zGrid = abs(fract(vLocalPosition.z * 2.0) - 0.5);
        gridLine = (smoothstep(0.04, 0.0, thetaGrid) + smoothstep(0.04, 0.0, zGrid)) * 0.35;
    } else {
        // Spherical Polar Coordinates Grid
        vec3 nLoc = normalize(vLocalPosition);
        float lat = asin(clamp(nLoc.y, -1.0, 1.0));
        float lon = atan(nLoc.z, nLoc.x);

        float latGrid = abs(fract(lat * 4.0 / PI) - 0.5);
        float lonGrid = abs(fract(lon * 6.0 / TWO_PI) - 0.5);
        gridLine = (smoothstep(0.04, 0.0, latGrid) + smoothstep(0.04, 0.0, lonGrid)) * 0.35;
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

    // Dynamic Opacity with Front/Back Transmission
    float alpha = clamp(
        (gl_FrontFacing ? uGlassOpacity : uGlassOpacity * 0.6) +
        fresnel * 0.75 +
        gridLine * 0.5 +
        (spec1 + spec2) * 0.8,
        0.0,
        0.92
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

varying vec3 vWorldNormal;
varying vec3 vViewPosition;
varying vec3 vLocalPosition;
varying float vProgress;

void main() {
    vec3 N = normalize(vWorldNormal);
    vec3 V = normalize(vViewPosition);

    float NdotV = max(dot(N, V), 0.0);
    float fresnel = pow(1.0 - NdotV, 2.5);

    // Pulsing Traveling Energy Wave along edge struts
    float pulse = sin(vProgress * 24.0 - uTime * 6.0) * 0.5 + 0.5;
    float audioBoost = uBandEnergies.x * 2.0 + uBandEnergies.y * 1.2;

    vec3 edgeColor = mix(uColor, uAccent, pulse * 0.7);
    edgeColor *= (1.0 + audioBoost + fresnel * 2.0) * uEdgeGlow;

    // Specular shine
    vec3 H = normalize(normalize(vec3(1.0, 2.0, 1.5)) + V);
    float spec = pow(max(dot(N, H), 0.0), 32.0);
    edgeColor += vec3(spec * 1.5);

    float alpha = clamp(0.65 + fresnel * 0.35 + audioBoost * 0.2, 0.0, 1.0);
    gl_FragColor = vec4(edgeColor, alpha);
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

  constructor(initialPalette: PalettePreset, config?: ChamberEnclosureConfig) {
    this.group = new THREE.Group();
    this.chamberGroup = new THREE.Group();
    this.frameGroup = new THREE.Group();

    this.group.add(this.chamberGroup);
    this.group.add(this.frameGroup);

    this.chamberType = config?.chamberType ?? 'cube';
    this.size = config?.size ?? 3.2;
    this.glassOpacity = config?.glassOpacity ?? 0.22;
    this.refractiveIndex = config?.refractiveIndex ?? 1.52;
    this.dispersionStrength = config?.dispersionStrength ?? 0.025;
    this.edgeGlowIntensity = config?.edgeGlowIntensity ?? 1.4;

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

    // 4. Set Initial Mode
    this.setChamberType(this.chamberType);
  }

  private buildCubeChamber(): void {
    const half = this.size;
    const full = half * 2;

    // Cube Glass Shell
    const cubeGeo = new THREE.BoxGeometry(full, full, full, 16, 16, 16);
    this.cubeGlassMesh = new THREE.Mesh(cubeGeo, this.glassMaterial);
    this.chamberGroup.add(this.cubeGlassMesh);

    // 12 Beveled Crystal Edge Struts
    const strutRadius = 0.035;
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

    // 8 Corner Reinforcement Nodes
    const cornerGeo = new THREE.OctahedronGeometry(0.08, 0);
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
    const radius = this.size * 1.02;
    const height = this.size * 2.0;

    // Cylinder Glass Shell
    const cylGeo = new THREE.CylinderGeometry(radius, radius, height, 32, 16, false);
    this.cylinderGlassMesh = new THREE.Mesh(cylGeo, this.glassMaterial);
    this.chamberGroup.add(this.cylinderGlassMesh);

    // Top & Bottom Crystal Rings
    const ringRadius = radius;
    const ringTube = 0.035;
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
    const radius = this.size * 1.08;

    // Sphere Glass Shell
    const sphereGeo = new THREE.SphereGeometry(radius, 48, 48);
    this.sphereGlassMesh = new THREE.Mesh(sphereGeo, this.glassMaterial);
    this.chamberGroup.add(this.sphereGlassMesh);

    // 3 Orthogonal Gimbal Rings (XY, YZ, ZX)
    const ringTube = 0.035;
    const ringGeo = new THREE.TorusGeometry(radius, ringTube, 8, 64);

    const ringXY = new THREE.Mesh(ringGeo, this.strutMaterial);
    const ringYZ = new THREE.Mesh(ringGeo, this.strutMaterial);
    ringYZ.rotation.y = Math.PI / 2;
    const ringZX = new THREE.Mesh(ringGeo, this.strutMaterial);
    ringZX.rotation.x = Math.PI / 2;

    this.sphereFrameMeshGroup.add(ringXY);
    this.sphereFrameMeshGroup.add(ringYZ);
    this.sphereFrameMeshGroup.add(ringZX);

    // Polar Acoustic Transducer Caps
    const capGeo = new THREE.TorusGeometry(radius * 0.35, ringTube * 1.2, 8, 32);
    const topCap = new THREE.Mesh(capGeo, this.strutMaterial);
    topCap.position.y = radius * 0.92;
    topCap.rotation.x = Math.PI / 2;

    const btmCap = new THREE.Mesh(capGeo, this.strutMaterial);
    btmCap.position.y = -radius * 0.92;
    btmCap.rotation.x = Math.PI / 2;

    this.sphereFrameMeshGroup.add(topCap);
    this.sphereFrameMeshGroup.add(btmCap);

    this.frameGroup.add(this.sphereFrameMeshGroup);
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
    const gu = this.glassMaterial.uniforms;
    gu.uTime.value = time;
    gu.uBandEnergies.value.copy(bands);
    gu.uHighEnergies.value.copy(highs);

    if (camera) {
      gu.uCameraPos.value.copy(camera.position);
    }

    const su = this.strutMaterial.uniforms;
    su.uTime.value = time;
    su.uBandEnergies.value.copy(bands);

    // Audio-reactive micro-wobble & rotation
    const rotSpeed = this.autoRotationSpeed + bands.x * 0.05;
    this.group.rotation.y = time * rotSpeed;
    this.group.rotation.x = Math.sin(time * 0.15) * 0.04;
  }

  public setVisible(visible: boolean): void {
    this.group.visible = visible;
  }

  public isVisible(): boolean {
    return this.group.visible;
  }

  public dispose(): void {
    this.glassMaterial.dispose();
    this.strutMaterial.dispose();
    this.cornerNodeMaterial.dispose();
    this.cubeGlassMesh.geometry.dispose();
    this.cylinderGlassMesh.geometry.dispose();
    this.sphereGlassMesh.geometry.dispose();
  }
}
