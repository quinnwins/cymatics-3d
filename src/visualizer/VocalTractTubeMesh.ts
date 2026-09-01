/**
 * VocalTractTubeMesh.ts
 * SoundForm 3D - 3D Deformable Vocal Tract Tube Mesh Controller
 */

import * as THREE from 'three';
import {
  VOCAL_TRACT_VERTEX_SHADER,
  VOCAL_TRACT_FRAGMENT_SHADER,
} from './shaders/vocalTractShader';

export class VocalTractTubeMesh {
  public group: THREE.Group;
  private tubeMesh: THREE.Mesh;
  private tubeMaterial: THREE.ShaderMaterial;
  private currentRadii = new Float32Array(16);
  private targetRadii = new Float32Array(16);

  constructor() {
    this.group = new THREE.Group();

    // Default initial radii (~0.8 cm)
    for (let i = 0; i < 16; i++) {
      this.currentRadii[i] = 0.8;
      this.targetRadii[i] = 0.8;
    }

    const geometry = new THREE.CylinderGeometry(1.0, 1.0, 1.0, 48, 96, true);
    geometry.rotateX(Math.PI / 2);

    this.tubeMaterial = new THREE.ShaderMaterial({
      vertexShader: VOCAL_TRACT_VERTEX_SHADER,
      fragmentShader: VOCAL_TRACT_FRAGMENT_SHADER,
      uniforms: {
        uTime: { value: 0 },
        uGlottalDrive: { value: 0.8 },
        uVocalIntensity: { value: 1.0 },
        uAreaProfile: { value: this.currentRadii },
        uFormantFreqs: { value: new THREE.Vector4(280, 2250, 3100, 3600) },
        uFormantAmps: { value: new THREE.Vector4(1.0, 0.85, 0.6, 0.35) },
        uTissueCompliance: { value: 1.0 },
        uTherapyEntrainment: { value: 0.0 },
        uColorNode: { value: new THREE.Color(0x00e5ff) },
        uColorAntinode: { value: new THREE.Color(0xffaa00) },
        uColorMucosa: { value: new THREE.Color(0x7a1828) },
        uCameraPosition: { value: new THREE.Vector3() },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      side: THREE.DoubleSide,
    });

    this.tubeMesh = new THREE.Mesh(geometry, this.tubeMaterial);
    this.tubeMesh.renderOrder = 2;
    this.group.add(this.tubeMesh);
  }

  public setAreaRadii(radii: number[]): void {
    if (!radii || radii.length < 16) return;
    for (let i = 0; i < 16; i++) {
      this.targetRadii[i] = Math.max(0.2, Math.min(2.8, radii[i]));
    }
  }

  public setFormants(formants: [number, number, number, number]): void {
    this.tubeMaterial.uniforms.uFormantFreqs.value.set(
      formants[0],
      formants[1],
      formants[2],
      formants[3]
    );
  }

  public update(dt: number, time: number, camera: THREE.Camera, intensity: number, entrainment: number): void {
    // Smoothly interpolate radii toward targets
    for (let i = 0; i < 16; i++) {
      this.currentRadii[i] += (this.targetRadii[i] - this.currentRadii[i]) * 0.15;
    }

    this.tubeMaterial.uniforms.uTime.value = time;
    this.tubeMaterial.uniforms.uVocalIntensity.value = intensity;
    this.tubeMaterial.uniforms.uTherapyEntrainment.value = entrainment;
    this.tubeMaterial.uniforms.uCameraPosition.value.copy(camera.position);

    this.group.rotation.y = Math.sin(time * 0.1) * 0.12;
  }

  public dispose(): void {
    this.tubeMesh.geometry.dispose();
    this.tubeMaterial.dispose();
  }
}
