/**
 * AcousticVortexBeam.ts
 * SoundForm 3D - Helical Acoustic Vortex Beam with Orbital Angular Momentum (OAM)
 */

import * as THREE from 'three';
import {
  ACOUSTIC_VORTEX_VERTEX_SHADER,
  ACOUSTIC_VORTEX_FRAGMENT_SHADER,
} from './shaders/acousticVortexShader';

export interface AcousticVortexConfig {
  topologicalCharge?: 1 | 2 | 3;
  frequencyHz?: number;
  wavenumberZ?: number;
  beamWaist?: number;
  helicalAmplitude?: number;
  colorCore?: THREE.Color;
  colorWavefront?: THREE.Color;
  beamLength?: number;
  radius?: number;
}

export class AcousticVortexBeam {
  public group: THREE.Group;
  private mesh: THREE.Mesh;
  private material: THREE.ShaderMaterial;
  private geometry: THREE.CylinderGeometry;

  private topologicalCharge = 1;
  private frequencyHz = 118;
  private beamWaist = 0.85;

  constructor(config?: AcousticVortexConfig) {
    this.group = new THREE.Group();

    this.topologicalCharge = config?.topologicalCharge ?? 1;
    this.frequencyHz = config?.frequencyHz ?? 118;
    this.beamWaist = config?.beamWaist ?? 0.85;

    const radius = config?.radius ?? 1.8;
    const length = config?.beamLength ?? 8.0;

    this.geometry = new THREE.CylinderGeometry(radius, radius, length, 96, 96, true);
    this.geometry.rotateX(Math.PI / 2);

    this.material = new THREE.ShaderMaterial({
      vertexShader: ACOUSTIC_VORTEX_VERTEX_SHADER,
      fragmentShader: ACOUSTIC_VORTEX_FRAGMENT_SHADER,
      uniforms: {
        uTime: { value: 0 },
        uCameraPosition: { value: new THREE.Vector3() },
        uTopologicalCharge: { value: this.topologicalCharge },
        uAcousticFrequency: { value: this.frequencyHz },
        uWavenumberZ: { value: config?.wavenumberZ ?? 2.4 },
        uBeamWaist: { value: this.beamWaist },
        uHelicalAmplitude: { value: config?.helicalAmplitude ?? 0.22 },
        uAudioEnergy: { value: 0.0 },
        uColorCore: { value: config?.colorCore ?? new THREE.Color(0x00e5ff) },
        uColorWavefront: { value: config?.colorWavefront ?? new THREE.Color(0xff00aa) },
        uPhaseContrast: { value: 4.0 },
        uBeamOpacity: { value: 0.85 },
        uFresnelPower: { value: 2.2 },
      },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.group.add(this.mesh);
  }

  public setTopologicalCharge(charge: 1 | 2 | 3): void {
    this.topologicalCharge = charge;
    this.material.uniforms.uTopologicalCharge.value = charge;
  }

  public getTopologicalCharge(): number {
    return this.topologicalCharge;
  }

  public setFrequency(freqHz: number): void {
    this.frequencyHz = freqHz;
    this.material.uniforms.uAcousticFrequency.value = freqHz;
  }

  public setBeamWaist(waist: number): void {
    this.beamWaist = waist;
    this.material.uniforms.uBeamWaist.value = waist;
  }

  public update(time: number, dt: number, camera: THREE.Camera, audioEnergy = 0.0): void {
    this.material.uniforms.uTime.value = time;
    this.material.uniforms.uCameraPosition.value.copy(camera.position);
    this.material.uniforms.uAudioEnergy.value = audioEnergy;
  }

  public setVisible(visible: boolean): void {
    this.group.visible = visible;
  }

  public dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
