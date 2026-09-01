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

    // 1. Sleek glowing acoustic transducer core at origin (0, 0, 0)
    const coreGeo = new THREE.SphereGeometry(0.18, 32, 32);
    this.coreMaterial = new THREE.MeshBasicMaterial({
      color: initialPalette.coreGlow,
      wireframe: false,
    });
    this.coreMesh = new THREE.Mesh(coreGeo, this.coreMaterial);
    this.group.add(this.coreMesh);

    // 2. Halo atmospheric glow with smooth Fresnel falloff
    const glowGeo = new THREE.SphereGeometry(0.36, 32, 32);
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
          vec3 N = length(vNormal) > 1e-5 ? normalize(vNormal) : vec3(0.0, 1.0, 0.0);
          vec3 V = length(vViewPosition) > 1e-5 ? normalize(vViewPosition) : vec3(0.0, 0.0, 1.0);
          float NdotV = clamp(dot(N, V), 0.0, 1.0);
          float fresnel = pow(clamp(1.0 - NdotV, 0.0, 1.0), 2.5);
          vec3 radiant = uColor * (0.8 + uIntensity * 0.3);
          gl_FragColor = vec4(radiant, clamp(fresnel * 0.4, 0.0, 1.0));
        }
      `,
      uniforms: {
        uColor: { value: initialPalette.coreGlow.clone() },
        uIntensity: { value: 1.0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.FrontSide,
    });
    this.glowMesh = new THREE.Mesh(glowGeo, this.glowMaterial);
    this.group.add(this.glowMesh);

    // 3. Equatorial birth emitter ring
    const ringGeo = new THREE.RingGeometry(0.22, 0.28, 64);
    this.ringMaterial = new THREE.MeshBasicMaterial({
      color: initialPalette.accent,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
    });
    this.ringMesh = new THREE.Mesh(ringGeo, this.ringMaterial);
    this.ringMesh.rotation.x = Math.PI / 2;
    this.group.add(this.ringMesh);
  }

  public update(time: number, bassEnergy: number, transientShock: number): void {
    const scale = 1.0 + bassEnergy * 0.35 + transientShock * 0.25;
    this.coreMesh.scale.setScalar(scale);
    this.glowMesh.scale.setScalar(scale * 1.2);

    this.glowMaterial.uniforms.uIntensity.value = 0.8 + bassEnergy * 0.9 + transientShock * 0.7;

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

  public dispose(): void {
    this.coreMesh.geometry.dispose();
    this.coreMaterial.dispose();
    this.glowMesh.geometry.dispose();
    this.glowMaterial.dispose();
    this.ringMesh.geometry.dispose();
    this.ringMaterial.dispose();
  }
}
