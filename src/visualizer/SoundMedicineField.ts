/**
 * SoundMedicineField.ts
 * SoundForm 3D - Restorative Bio-Acoustic Sound Medicine Hologram Field
 */

import * as THREE from 'three';
import {
  SOUND_MEDICINE_HOLOGRAM_VERTEX_SHADER,
  SOUND_MEDICINE_HOLOGRAM_FRAGMENT_SHADER,
  GOLDEN_SPIRAL_FRAGMENT_SHADER,
} from './shaders/soundMedicineShader';

export class SoundMedicineField {
  public group: THREE.Group;
  private hologramMesh: THREE.Mesh;
  private hologramMaterial: THREE.ShaderMaterial;
  private spiralMesh: THREE.Line;
  private spiralMaterial: THREE.ShaderMaterial;
  private coherenceProgress = 0.0;

  constructor() {
    this.group = new THREE.Group();
    this.group.visible = false;

    // 1. Golden Ratio Torus Mesh
    const torusGeom = new THREE.TorusGeometry(2.8, 0.95, 48, 96);
    this.hologramMaterial = new THREE.ShaderMaterial({
      vertexShader: SOUND_MEDICINE_HOLOGRAM_VERTEX_SHADER,
      fragmentShader: SOUND_MEDICINE_HOLOGRAM_FRAGMENT_SHADER,
      uniforms: {
        uTime: { value: 0 },
        uFieldExpansion: { value: 1.0 },
        uEntrainmentPhase: { value: 0.0 },
        uGoldenSpiralTorsion: { value: 1.618 },
        uTherapyCoherence: { value: 0.0 },
        uResonanceColorA: { value: new THREE.Color(0x00f2fe) },
        uResonanceColorB: { value: new THREE.Color(0xffd700) },
        uResonanceColorC: { value: new THREE.Color(0x7f00ff) },
        uCameraPosition: { value: new THREE.Vector3() },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.hologramMesh = new THREE.Mesh(torusGeom, this.hologramMaterial);
    this.group.add(this.hologramMesh);

    // 2. Logarithmic Golden Spiral Streamlines
    const spiralPoints = 1500;
    const spiralGeom = new THREE.BufferGeometry();
    const positions = new Float32Array(spiralPoints * 3);
    const progress = new Float32Array(spiralPoints);

    const phi = 1.618033988749895;
    for (let i = 0; i < spiralPoints; i++) {
      const t = (i / spiralPoints) * Math.PI * 10.0;
      const r = 0.18 * Math.pow(phi, t / (Math.PI * 2.0));
      positions[i * 3 + 0] = r * Math.cos(t);
      positions[i * 3 + 1] = (i / spiralPoints) * 4.0 - 2.0;
      positions[i * 3 + 2] = r * Math.sin(t);
      progress[i] = i / spiralPoints;
    }

    spiralGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    spiralGeom.setAttribute('vProgress', new THREE.BufferAttribute(progress, 1));

    this.spiralMaterial = new THREE.ShaderMaterial({
      vertexShader: `
        attribute float vProgress;
        varying float vProg;
        varying vec2 vUv;
        void main() {
          vProg = vProgress;
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: GOLDEN_SPIRAL_FRAGMENT_SHADER,
      uniforms: {
        uTime: { value: 0 },
        uEntrainmentSpeed: { value: 2.0 },
        uStreamColor: { value: new THREE.Color(0x00ffff) },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.spiralMesh = new THREE.Line(spiralGeom, this.spiralMaterial);
    this.group.add(this.spiralMesh);
  }

  public setCoherenceProgress(progress: number): void {
    this.coherenceProgress = Math.max(0, Math.min(1.0, progress));
    this.hologramMaterial.uniforms.uEntrainmentPhase.value = Math.min(this.coherenceProgress * 1.5, 1.0);
    this.hologramMaterial.uniforms.uTherapyCoherence.value = this.coherenceProgress;
    this.group.visible = this.coherenceProgress > 0.01;
  }

  public getCoherenceProgress(): number {
    return this.coherenceProgress;
  }

  public update(dt: number, time: number, camera: THREE.Camera): void {
    if (!this.group.visible) return;
    this.hologramMaterial.uniforms.uTime.value = time;
    this.hologramMaterial.uniforms.uCameraPosition.value.copy(camera.position);
    this.spiralMaterial.uniforms.uTime.value = time;
    this.spiralMesh.rotation.y = time * 0.35;
    this.hologramMesh.rotation.z = time * 0.15;
    this.hologramMesh.rotation.x = Math.sin(time * 0.2) * 0.1;
  }

  public dispose(): void {
    this.hologramMesh.geometry.dispose();
    this.hologramMaterial.dispose();
    this.spiralMesh.geometry.dispose();
    this.spiralMaterial.dispose();
  }
}
