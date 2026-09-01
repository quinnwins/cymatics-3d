import * as THREE from 'three';
import { PalettePreset } from './ColorPalettes';

export class CentralEmitter {
  public group: THREE.Group;
  private coreMesh: THREE.Mesh;
  private glowMesh: THREE.Mesh;
  private ringMesh: THREE.Mesh;
  private coreMaterial: THREE.MeshBasicMaterial;
  private glowMaterial: THREE.ShaderMaterial;
  private ringMaterial: THREE.MeshBasicMaterial;

  constructor(initialPalette: PalettePreset) {
    this.group = new THREE.Group();

    // 1. Solid glowing core at origin (0, 0, 0)
    const coreGeo = new THREE.SphereGeometry(0.35, 32, 32);
    this.coreMaterial = new THREE.MeshBasicMaterial({
      color: initialPalette.coreGlow,
      wireframe: false,
    });
    this.coreMesh = new THREE.Mesh(coreGeo, this.coreMaterial);
    this.group.add(this.coreMesh);

    // 2. Halo atmospheric glow with radiant shoulder
    const glowGeo = new THREE.SphereGeometry(0.75, 32, 32);
    this.glowMaterial = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vViewPosition = -mvPosition.xyz;
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uIntensity;
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        void main() {
          float NdotV = max(dot(vNormal, normalize(vViewPosition)), 0.0);
          float fresnel = pow(1.0 - NdotV, 3.0);
          vec3 radiant = uColor * (1.2 + uIntensity * 2.5);
          float hotCore = exp(-NdotV * 3.5) * 0.4;
          gl_FragColor = vec4(radiant + vec3(hotCore), fresnel * 0.92);
        }
      `,
      uniforms: {
        uColor: { value: initialPalette.coreGlow.clone() },
        uIntensity: { value: 1.0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
    });
    this.glowMesh = new THREE.Mesh(glowGeo, this.glowMaterial);
    this.group.add(this.glowMesh);

    // 3. Equatorial birth emitter ring
    const ringGeo = new THREE.RingGeometry(0.4, 0.48, 64);
    this.ringMaterial = new THREE.MeshBasicMaterial({
      color: initialPalette.accent,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
    });
    this.ringMesh = new THREE.Mesh(ringGeo, this.ringMaterial);
    this.ringMesh.rotation.x = Math.PI / 2;
    this.group.add(this.ringMesh);
  }

  public update(time: number, bassEnergy: number, transientShock: number): void {
    const scale = 1.0 + bassEnergy * 0.45 + transientShock * 0.35;
    this.coreMesh.scale.setScalar(scale);
    this.glowMesh.scale.setScalar(scale * 1.3);

    this.glowMaterial.uniforms.uIntensity.value = 1.0 + bassEnergy * 2.5 + transientShock * 2.0;

    // Spinning emitter ring
    this.ringMesh.rotation.z = time * 1.5;
    const ringScale = 1.0 + (time * 2.0) % 2.0;
    this.ringMesh.scale.setScalar(ringScale * (1.0 + bassEnergy * 0.3));
    this.ringMaterial.opacity = Math.max(0, 1.0 - (ringScale - 1.0) / 2.0);
  }

  public setPalette(palette: PalettePreset): void {
    this.coreMaterial.color.copy(palette.coreGlow);
    this.glowMaterial.uniforms.uColor.value.copy(palette.coreGlow);
    this.ringMaterial.color.copy(palette.accent);
  }
}
