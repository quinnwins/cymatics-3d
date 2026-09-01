/**
 * BioAcousticResonator.ts
 * SoundForm 3D - High-Level Bio-Acoustic Resonator & Cellular Spectroscopy Subsystem
 *
 * Orchestrates:
 * 1. BioCellMesh (Single-Cell Viscoelastic & Blebbing Close-up Inspector)
 * 2. AcoustophoreticSorter (Microfluidic Gor'kov Cell Separation Particle Field)
 * 3. HistotripsyCavitationSystem (Shockwave Explosion & Lysed Membrane Debris Burst)
 */

import * as THREE from 'three';
import { BioCellMesh } from './BioCellMesh';
import { BioAcousticPhysics, BioSpecimenProfile } from '../math/BioAcousticPhysics';

export type BioViewMode = 'cell-inspector' | 'microfluidic-sorter';

export class BioAcousticResonator {
  public group: THREE.Group;
  public bioCellMesh: BioCellMesh;

  // Microfluidic Acoustophoresis Stream
  public sorterGroup: THREE.Group;
  private sortingParticlesMesh!: THREE.InstancedMesh;
  private particleCount = 12000;
  private particleData: {
    x: number;
    y: number;
    z: number;
    vx: number;
    vy: number;
    vz: number;
    type: number; // 0 = Healthy (Node), 1 = Cancer (Antinode)
    baseRadius: number;
    phase: number;
  }[] = [];
  private dummyTransform = new THREE.Object3D();
  private healthyColor = new THREE.Color(0x00e5ff);
  private cancerColor = new THREE.Color(0xff0055);

  // Histotripsy Cavitation Shockwave & Debris
  public cavitationGroup: THREE.Group;
  private shockwaveSphere: THREE.Mesh;
  private debrisPoints: THREE.Points;
  private debrisGeom: THREE.BufferGeometry;
  private debrisCount = 6000;
  private debrisVelocities: Float32Array;
  private debrisLifetimes: Float32Array;
  private isLysisActive = false;
  private lysisProgress = 0.0;
  private lysisDuration = 1.6;

  // State
  private viewMode: BioViewMode = 'cell-inspector';
  private currentSpecimen: BioSpecimenProfile;
  private acousticIntensity = 1.0;
  private acousticFreqHz = 220.0;

  constructor(initialSpecimenId = 'healthy-somatic') {
    this.group = new THREE.Group();
    this.currentSpecimen = BioAcousticPhysics.SPECIMENS[initialSpecimenId] || BioAcousticPhysics.SPECIMENS['healthy-somatic'];
    this.acousticFreqHz = this.currentSpecimen.audibleDownmixHz;

    // 1. Bio Cell Mesh
    this.bioCellMesh = new BioCellMesh(initialSpecimenId);
    this.group.add(this.bioCellMesh.group);

    // 2. Microfluidic Acoustophoresis Sorter
    this.sorterGroup = new THREE.Group();
    this.sorterGroup.visible = false;
    this.initAcoustophoreticSorter();
    this.group.add(this.sorterGroup);

    // 3. Histotripsy Cavitation & Debris
    this.cavitationGroup = new THREE.Group();
    const shockGeom = new THREE.SphereGeometry(1.0, 32, 24);
    const shockMat = new THREE.MeshBasicMaterial({
      color: 0xffaa00,
      transparent: true,
      opacity: 0.0,
      wireframe: true,
      blending: THREE.AdditiveBlending,
    });
    this.shockwaveSphere = new THREE.Mesh(shockGeom, shockMat);
    this.cavitationGroup.add(this.shockwaveSphere);

    // Debris Particles
    this.debrisGeom = new THREE.BufferGeometry();
    const debrisPos = new Float32Array(this.debrisCount * 3);
    this.debrisVelocities = new Float32Array(this.debrisCount * 3);
    this.debrisLifetimes = new Float32Array(this.debrisCount);

    for (let i = 0; i < this.debrisCount; i++) {
      debrisPos[i * 3 + 0] = 0;
      debrisPos[i * 3 + 1] = 0;
      debrisPos[i * 3 + 2] = 0;
      this.debrisLifetimes[i] = 0;
    }

    this.debrisGeom.setAttribute('position', new THREE.BufferAttribute(debrisPos, 3));
    const debrisMat = new THREE.PointsMaterial({
      size: 0.08,
      color: 0xff3366,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
    });
    this.debrisPoints = new THREE.Points(this.debrisGeom, debrisMat);
    this.cavitationGroup.add(this.debrisPoints);

    this.group.add(this.cavitationGroup);
  }

  private initAcoustophoreticSorter(): void {
    const sphereGeom = new THREE.SphereGeometry(0.06, 8, 8);
    const instMat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.85,
    });

    this.sortingParticlesMesh = new THREE.InstancedMesh(sphereGeom, instMat, this.particleCount);

    const channelWidth = 8.0;
    const channelLength = 16.0;
    const channelHeight = 4.0;

    for (let i = 0; i < this.particleCount; i++) {
      const isCancer = i % 2 === 0;
      const x = (Math.random() - 0.5) * channelWidth;
      const y = (Math.random() - 0.5) * channelHeight;
      const z = (Math.random() - 0.5) * channelLength;

      this.particleData.push({
        x,
        y,
        z,
        vx: 0,
        vy: 0,
        vz: 1.5 + Math.random() * 1.5,
        type: isCancer ? 1 : 0,
        baseRadius: isCancer ? 0.08 : 0.05,
        phase: Math.random() * Math.PI * 2,
      });

      this.dummyTransform.position.set(x, y, z);
      this.dummyTransform.scale.setScalar(isCancer ? 1.4 : 1.0);
      this.dummyTransform.updateMatrix();
      this.sortingParticlesMesh.setMatrixAt(i, this.dummyTransform.matrix);
      this.sortingParticlesMesh.setColorAt(i, isCancer ? this.cancerColor : this.healthyColor);
    }

    if (this.sortingParticlesMesh.instanceColor) {
      this.sortingParticlesMesh.instanceColor.needsUpdate = true;
    }
    this.sortingParticlesMesh.instanceMatrix.needsUpdate = true;

    // Channel Glass Wireframe Guide
    const channelBox = new THREE.BoxGeometry(channelWidth, channelHeight, channelLength);
    const channelEdges = new THREE.EdgesGeometry(channelBox);
    const channelLine = new THREE.LineSegments(
      channelEdges,
      new THREE.LineBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.3 })
    );
    this.sorterGroup.add(channelLine);
    this.sorterGroup.add(this.sortingParticlesMesh);
  }

  public setSpecimen(specimenId: string): void {
    this.currentSpecimen = BioAcousticPhysics.SPECIMENS[specimenId] || BioAcousticPhysics.SPECIMENS['healthy-somatic'];
    this.bioCellMesh.setSpecimen(specimenId);
    this.acousticFreqHz = this.currentSpecimen.audibleDownmixHz;
    this.bioCellMesh.setAcousticFrequency(this.acousticFreqHz);
  }

  public getSpecimen(): BioSpecimenProfile {
    return this.currentSpecimen;
  }

  public setAcousticFrequency(freqHz: number): void {
    this.acousticFreqHz = freqHz;
    this.bioCellMesh.setAcousticFrequency(freqHz);
  }

  public getAcousticFrequency(): number {
    return this.acousticFreqHz;
  }

  public setAcousticIntensity(intensity: number): void {
    this.acousticIntensity = intensity;
    this.bioCellMesh.setAcousticIntensity(intensity);
  }

  public setViewMode(mode: BioViewMode): void {
    this.viewMode = mode;
    if (mode === 'cell-inspector') {
      this.bioCellMesh.setVisible(true);
      this.sorterGroup.visible = false;
    } else {
      this.bioCellMesh.setVisible(false);
      this.sorterGroup.visible = true;
    }
  }

  public getViewMode(): BioViewMode {
    return this.viewMode;
  }

  /**
   * Trigger violent histotripsy cavitation shockwave & membrane lysis
   */
  public triggerHistotripsyLysis(): void {
    this.isLysisActive = true;
    this.lysisProgress = 0.0;

    // Spawn radial burst velocities for debris
    const posAttr = this.debrisGeom.getAttribute('position') as THREE.BufferAttribute;
    const posArray = posAttr.array as Float32Array;

    for (let i = 0; i < this.debrisCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const speed = 3.5 + Math.random() * 8.0;

      const vx = Math.sin(phi) * Math.cos(theta) * speed;
      const vy = Math.sin(phi) * Math.sin(theta) * speed;
      const vz = Math.cos(phi) * speed;

      this.debrisVelocities[i * 3 + 0] = vx;
      this.debrisVelocities[i * 3 + 1] = vy;
      this.debrisVelocities[i * 3 + 2] = vz;

      posArray[i * 3 + 0] = (Math.random() - 0.5) * 1.8;
      posArray[i * 3 + 1] = (Math.random() - 0.5) * 1.8;
      posArray[i * 3 + 2] = (Math.random() - 0.5) * 1.8;

      this.debrisLifetimes[i] = 1.0;
    }

    posAttr.needsUpdate = true;
  }

  public update(time: number, dt: number, camera: THREE.Camera, audioBands: THREE.Vector4): void {
    // 1. Single Cell Inspector Update
    if (this.viewMode === 'cell-inspector') {
      this.bioCellMesh.update(time, dt, camera, audioBands);

      // Histotripsy Lysis Animation
      if (this.isLysisActive) {
        this.lysisProgress += dt / this.lysisDuration;

        const shockRadius = this.lysisProgress * 7.5;
        const shockEnergy = Math.max(0, 1.0 - this.lysisProgress);
        this.bioCellMesh.setRuptureProgress(Math.min(1.0, this.lysisProgress * 1.5), shockRadius);

        // Update shockwave sphere
        this.shockwaveSphere.scale.setScalar(Math.max(0.1, shockRadius));
        (this.shockwaveSphere.material as THREE.MeshBasicMaterial).opacity = shockEnergy * 0.75;

        // Update debris particles
        const posAttr = this.debrisGeom.getAttribute('position') as THREE.BufferAttribute;
        const posArray = posAttr.array as Float32Array;

        for (let i = 0; i < this.debrisCount; i++) {
          posArray[i * 3 + 0] += this.debrisVelocities[i * 3 + 0] * dt;
          posArray[i * 3 + 1] += this.debrisVelocities[i * 3 + 1] * dt;
          posArray[i * 3 + 2] += this.debrisVelocities[i * 3 + 2] * dt;
          this.debrisVelocities[i * 3 + 0] *= 0.96;
          this.debrisVelocities[i * 3 + 1] *= 0.96;
          this.debrisVelocities[i * 3 + 2] *= 0.96;
        }
        posAttr.needsUpdate = true;
        (this.debrisPoints.material as THREE.PointsMaterial).opacity = shockEnergy * 0.9;

        if (this.lysisProgress >= 1.0) {
          // Re-heal after 2 seconds
          setTimeout(() => {
            this.isLysisActive = false;
            this.lysisProgress = 0.0;
            this.bioCellMesh.setRuptureProgress(0.0);
            (this.shockwaveSphere.material as THREE.MeshBasicMaterial).opacity = 0.0;
            (this.debrisPoints.material as THREE.PointsMaterial).opacity = 0.0;
          }, 1800);
        }
      }
    } else {
      // 2. Microfluidic Acoustophoresis Sorting Simulation
      const k = (Math.PI * 2) / 4.0; // 4 standing wave nodes across channel
      const halfZ = 8.0;

      for (let i = 0; i < this.particleCount; i++) {
        const p = this.particleData[i];

        // Gor'kov Acoustic Radiation Force
        // Healthy (type 0, Phi > 0) -> Trapped at pressure nodes (x = 0, +/- 2.0)
        // Cancer (type 1, Phi < 0) -> Deflected outward to antinodes (x = +/- 1.0, +/- 3.0)
        const contrastSign = p.type === 0 ? 1.0 : -0.8;
        const fRadX = -Math.sin(2.0 * k * p.x) * 1.8 * contrastSign * (1.0 + audioBands.y * 1.2);

        // Fluid drag & velocity integration
        p.vx += fRadX * dt;
        p.vx *= 0.88; // Viscous drag

        p.x += p.vx * dt;
        p.z += p.vz * dt;

        // Flow recycling
        if (p.z > halfZ) {
          p.z = -halfZ;
          p.x = (Math.random() - 0.5) * 7.5;
          p.vx = 0;
        }

        this.dummyTransform.position.set(p.x, p.y + Math.sin(time * 3.0 + p.phase) * 0.05, p.z);
        this.dummyTransform.scale.setScalar(p.type === 1 ? 1.4 : 1.0);
        this.dummyTransform.updateMatrix();
        this.sortingParticlesMesh.setMatrixAt(i, this.dummyTransform.matrix);
      }

      this.sortingParticlesMesh.instanceMatrix.needsUpdate = true;
      this.sorterGroup.rotation.y = time * 0.04;
    }
  }

  public setVisible(visible: boolean): void {
    this.group.visible = visible;
  }

  public isVisible(): boolean {
    return this.group.visible;
  }

  public dispose(): void {
    this.bioCellMesh.dispose();
    this.sortingParticlesMesh.geometry.dispose();
    (this.sortingParticlesMesh.material as THREE.Material).dispose();
    this.shockwaveSphere.geometry.dispose();
    (this.shockwaveSphere.material as THREE.Material).dispose();
    this.debrisGeom.dispose();
    (this.debrisPoints.material as THREE.Material).dispose();
  }
}
