/**
 * SonodynamicCavitationSystem.ts
 * SoundForm 3D - Sonoluminescence Flash & Singlet Oxygen (1O2) Reactive GPU System
 */

import * as THREE from 'three';
import {
  CAVITATION_FLASH_VERTEX_SHADER,
  CAVITATION_FLASH_FRAGMENT_SHADER,
  SINGLET_OXYGEN_PARTICLE_VERTEX_SHADER,
  SINGLET_OXYGEN_PARTICLE_FRAGMENT_SHADER,
} from './shaders/sonodynamicCavitationShader';

export class SonodynamicCavitationSystem {
  public group: THREE.Group;

  private flashMesh: THREE.Mesh;
  private flashMaterial: THREE.ShaderMaterial;
  private flashGeometry: THREE.SphereGeometry;

  private particlePoints: THREE.Points;
  private particleGeometry: THREE.BufferGeometry;
  private particleMaterial: THREE.ShaderMaterial;
  private readonly particleCount = 6000;

  private isBurstActive = false;
  private burstTime = 0.0;
  private burstDuration = 1.6;
  private origin = new THREE.Vector3(-1.8, 0.4, 0);

  constructor() {
    this.group = new THREE.Group();

    // 1. Cavitation Flash Shockwave Setup
    this.flashGeometry = new THREE.SphereGeometry(1.0, 36, 28);
    this.flashMaterial = new THREE.ShaderMaterial({
      vertexShader: CAVITATION_FLASH_VERTEX_SHADER,
      fragmentShader: CAVITATION_FLASH_FRAGMENT_SHADER,
      uniforms: {
        uTime: { value: 0 },
        uFlashProgress: { value: 1.0 },
        uShockwaveRadius: { value: 3.5 },
        uCameraPosition: { value: new THREE.Vector3() },
        uSonoluminescenceColor: { value: new THREE.Color(0x5588ff) },
        uHotCoreColor: { value: new THREE.Color(0xf0f5ff) },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
    });
    this.flashMesh = new THREE.Mesh(this.flashGeometry, this.flashMaterial);
    this.flashMesh.visible = false;
    this.group.add(this.flashMesh);

    // 2. Singlet Oxygen Particle Buffer Setup
    this.particleGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.particleCount * 3);
    const velocities = new Float32Array(this.particleCount * 3);
    const birthTimes = new Float32Array(this.particleCount);
    const seeds = new Float32Array(this.particleCount);

    this.particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.particleGeometry.setAttribute('aInitialVelocity', new THREE.BufferAttribute(velocities, 3));
    this.particleGeometry.setAttribute('aBirthTime', new THREE.BufferAttribute(birthTimes, 1));
    this.particleGeometry.setAttribute('aRandomSeed', new THREE.BufferAttribute(seeds, 1));

    this.particleMaterial = new THREE.ShaderMaterial({
      vertexShader: SINGLET_OXYGEN_PARTICLE_VERTEX_SHADER,
      fragmentShader: SINGLET_OXYGEN_PARTICLE_FRAGMENT_SHADER,
      uniforms: {
        uTime: { value: 0 },
        uSystemAge: { value: 0 },
        uSingletLifetime: { value: 1.4 },
        uParticleBaseSize: { value: 2.2 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.particlePoints = new THREE.Points(this.particleGeometry, this.particleMaterial);
    this.particlePoints.visible = false;
    this.group.add(this.particlePoints);
  }

  public triggerCavitationBurst(worldOrigin: THREE.Vector3, intensity = 1.0): void {
    this.origin.copy(worldOrigin);
    this.flashMesh.position.copy(worldOrigin);
    this.particlePoints.position.copy(worldOrigin);

    this.isBurstActive = true;
    this.burstTime = 0.0;
    this.flashMesh.visible = true;
    this.particlePoints.visible = true;

    const posAttr = this.particleGeometry.getAttribute('position') as THREE.BufferAttribute;
    const velAttr = this.particleGeometry.getAttribute('aInitialVelocity') as THREE.BufferAttribute;
    const birthAttr = this.particleGeometry.getAttribute('aBirthTime') as THREE.BufferAttribute;
    const seedAttr = this.particleGeometry.getAttribute('aRandomSeed') as THREE.BufferAttribute;

    const pos = posAttr.array as Float32Array;
    const vel = velAttr.array as Float32Array;
    const birth = birthAttr.array as Float32Array;
    const seed = seedAttr.array as Float32Array;

    for (let i = 0; i < this.particleCount; i++) {
      pos[i * 3 + 0] = (Math.random() - 0.5) * 0.1;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 0.1;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 0.1;

      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const speed = (2.2 + Math.random() * 5.8) * intensity;

      vel[i * 3 + 0] = Math.sin(phi) * Math.cos(theta) * speed;
      vel[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * speed;
      vel[i * 3 + 2] = Math.cos(phi) * speed;

      birth[i] = Math.random() * 0.15;
      seed[i] = Math.random() * 100.0;
    }

    posAttr.needsUpdate = true;
    velAttr.needsUpdate = true;
    birthAttr.needsUpdate = true;
    seedAttr.needsUpdate = true;
  }

  public update(time: number, dt: number, camera: THREE.Camera): void {
    if (!this.isBurstActive) return;

    this.burstTime += dt;
    const progress = this.burstTime / this.burstDuration;

    this.flashMaterial.uniforms.uTime.value = time;
    this.flashMaterial.uniforms.uFlashProgress.value = progress;
    this.flashMaterial.uniforms.uCameraPosition.value.copy(camera.position);

    this.particleMaterial.uniforms.uTime.value = time;
    this.particleMaterial.uniforms.uSystemAge.value = this.burstTime;

    if (progress >= 1.0) {
      this.isBurstActive = false;
      this.flashMesh.visible = false;
      this.particlePoints.visible = false;
    }
  }

  public setVisible(visible: boolean): void {
    this.group.visible = visible;
  }

  public dispose(): void {
    this.flashGeometry.dispose();
    this.flashMaterial.dispose();
    this.particleGeometry.dispose();
    this.particleMaterial.dispose();
  }
}
