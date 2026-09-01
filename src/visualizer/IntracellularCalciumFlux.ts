/**
 * IntracellularCalciumFlux.ts
 * SoundForm 3D - PIEZO1 Gating & Calcium ([Ca2+]i) Reaction-Diffusion Wave System
 */

import * as THREE from 'three';
import {
  CALCIUM_FLUX_VERTEX_SHADER,
  CALCIUM_FLUX_FRAGMENT_SHADER,
} from './shaders/calciumFluxShader';

export class IntracellularCalciumFlux {
  public group: THREE.Group;
  public material: THREE.ShaderMaterial;
  private mesh: THREE.Mesh;
  private geometry: THREE.SphereGeometry;

  private poreOrigins: THREE.Vector4[] = [
    new THREE.Vector4(0, 0, 0, -1),
    new THREE.Vector4(0, 0, 0, -1),
    new THREE.Vector4(0, 0, 0, -1),
    new THREE.Vector4(0, 0, 0, -1),
  ];
  private nextPoreIndex = 0;

  constructor(cellRadius = 0.95) {
    this.group = new THREE.Group();

    this.geometry = new THREE.SphereGeometry(cellRadius, 48, 48);
    this.material = new THREE.ShaderMaterial({
      vertexShader: CALCIUM_FLUX_VERTEX_SHADER,
      fragmentShader: CALCIUM_FLUX_FRAGMENT_SHADER,
      uniforms: {
        uTime: { value: 0 },
        uCameraPosition: { value: new THREE.Vector3() },
        uPoreOrigins: { value: this.poreOrigins },
        uWaveSpeed: { value: 0.65 },
        uDiffusionCoeff: { value: 0.4 },
        uCicrGain: { value: 2.8 },
        uSercaReuptakeRate: { value: 1.2 },
        uBasalCalcium: { value: 0.08 },
        uFluo4RestingColor: { value: new THREE.Color(0x052030) },
        uFluo4PeakColor: { value: new THREE.Color(0x39ff74) },
        uOrganelleMaskColor: { value: new THREE.Color(0x020815) },
        uAcousticDeformation: { value: 0.0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      side: THREE.DoubleSide,
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.group.add(this.mesh);
  }

  public triggerSonoporationPore(localContactPoint: THREE.Vector3, currentTime: number): void {
    const idx = this.nextPoreIndex;
    this.poreOrigins[idx].set(
      localContactPoint.x,
      localContactPoint.y,
      localContactPoint.z,
      currentTime
    );
    this.nextPoreIndex = (this.nextPoreIndex + 1) % 4;
  }

  public update(time: number, dt: number, camera: THREE.Camera): void {
    this.material.uniforms.uTime.value = time;
    this.material.uniforms.uCameraPosition.value.copy(camera.position);
  }

  public setVisible(visible: boolean): void {
    this.group.visible = visible;
  }

  public dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
