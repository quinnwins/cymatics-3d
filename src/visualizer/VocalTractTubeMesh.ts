/**
 * VocalTractTubeMesh.ts
 * SoundForm 3D - 3D Deformable Vocal Tract Tube Mesh Controller
 *
 * Implements:
 * 1. 32-Segment dynamic waveguide mesh controller with cubic Hermite upsampling from 16 LPC inputs.
 * 2. Asymmetric physiological ballistic smoothing (fast attack 15ms, smooth release 55ms).
 * 3. High-resolution geometry (80 radial segments x 220 axial segments) for C2 surface smoothness.
 * 4. Interactive sagittal cutaway support.
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
  private currentRadii = new Float32Array(32);
  private targetRadii = new Float32Array(32);
  private cutawayProgress = 0.0;

  constructor() {
    this.group = new THREE.Group();

    // Default initial radii (~0.8 cm)
    for (let i = 0; i < 32; i++) {
      this.currentRadii[i] = 0.8;
      this.targetRadii[i] = 0.8;
    }

    const geometry = new THREE.CylinderGeometry(1.0, 1.0, 1.0, 80, 220, true);
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
        uCutawayProgress: { value: 0.0 },
        uCameraPos: { value: new THREE.Vector3() },
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
    if (!radii || radii.length === 0) return;

    if (radii.length >= 32) {
      for (let i = 0; i < 32; i++) {
        this.targetRadii[i] = Math.max(0.18, Math.min(2.8, radii[i]));
      }
    } else {
      // Smoothly upsample 16 LPC inputs to 32 waveguide segments
      const srcLen = radii.length;
      for (let i = 0; i < 32; i++) {
        const t = (i / 31) * (srcLen - 1);
        const idx = Math.floor(t);
        const frac = t - idx;
        const v0 = radii[Math.max(0, idx - 1)];
        const v1 = radii[idx];
        const v2 = radii[Math.min(srcLen - 1, idx + 1)];
        const v3 = radii[Math.min(srcLen - 1, idx + 2)];

        // Hermite cubic spline interpolation
        const c0 = v1;
        const c1 = 0.5 * (v2 - v0);
        const c2 = v0 - 2.5 * v1 + 2.0 * v2 - 0.5 * v3;
        const c3 = 0.5 * (v3 - v0) + 1.5 * (v1 - v2);
        const val = c0 + c1 * frac + c2 * frac * frac + c3 * frac * frac * frac;

        this.targetRadii[i] = Math.max(0.18, Math.min(2.8, val));
      }
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

  public setCutaway(cutaway: boolean | number): void {
    this.cutawayProgress = typeof cutaway === 'number' ? cutaway : cutaway ? 1.0 : 0.0;
  }

  public update(dt: number, time: number, camera: THREE.Camera, intensity: number, entrainment: number): void {
    // Asymmetric physiological ballistic smoothing:
    // Fast attack (15 ms) for rapid consonant bursts, smooth release (55 ms) for natural mucosal decay
    const dtSafe = Math.max(0.001, Math.min(0.1, dt));
    for (let i = 0; i < 32; i++) {
      const target = this.targetRadii[i];
      const current = this.currentRadii[i];
      const isExpanding = target > current;
      const tau = isExpanding ? 0.015 : 0.055;
      const alpha = 1.0 - Math.exp(-dtSafe / tau);
      this.currentRadii[i] += alpha * (target - current);
    }

    this.tubeMaterial.uniforms.uTime.value = time;
    this.tubeMaterial.uniforms.uGlottalDrive.value = 0.5 + entrainment * 0.5;
    this.tubeMaterial.uniforms.uVocalIntensity.value = intensity;
    this.tubeMaterial.uniforms.uAreaProfile.value = this.currentRadii;
    this.tubeMaterial.uniforms.uCutawayProgress.value +=
      (this.cutawayProgress - this.tubeMaterial.uniforms.uCutawayProgress.value) * 0.15;
    this.tubeMaterial.uniforms.uCameraPos.value.copy(camera.position);

    this.group.rotation.y = Math.sin(time * 0.1) * 0.12;
  }

  public dispose(): void {
    this.tubeMesh.geometry.dispose();
    this.tubeMaterial.dispose();
  }
}
