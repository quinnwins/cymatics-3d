/**
 * BioAcousticResonator.ts
 * SoundForm 3D - High-Level Bio-Acoustic Resonator & Cellular Spectroscopy Subsystem
 *
 * Orchestrates:
 * 1. BioCellMesh (Single-Cell Viscoelastic & Blebbing Close-up Inspector)
 * 2. MicrofluidicChannelMesh (3D Channel with IDT Transducers, SSAW Standing Wave & 3D Annotations)
 * 3. AcoustophoreticSorter (Gor'kov Cell Separation Particle Field with 4-Phase Laminar Flow)
 * 4. HistotripsyCavitationSystem (Shockwave Explosion & Lysed Membrane Debris Burst)
 */

import * as THREE from 'three';
import { BioCellMesh } from './BioCellMesh';
import { BioAcousticPhysics, BioSpecimenProfile } from '../math/BioAcousticPhysics';
import { MicrofluidicChannelMesh } from './MicrofluidicChannelMesh';
import { MicrofluidicPhysics, MicrofluidicTelemetryData } from '../math/MicrofluidicPhysics';

export type BioViewMode = 'cell-inspector' | 'microfluidic-sorter';

interface ParticleRecord {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  type: number; // 0 = Healthy Somatic (Node), 1 = Metastatic Cancer (Antinode)
  baseRadius: number;
  phase: number;
  isRecirculating: boolean;
  returnProgress: number;
  exitX: number;
  exitY: number;
}

export class BioAcousticResonator {
  public group: THREE.Group;
  public bioCellMesh: BioCellMesh;

  // Microfluidic Acoustophoresis Stream & Channel
  public sorterGroup: THREE.Group;
  public channelMesh: MicrofluidicChannelMesh;
  private sortingParticlesMesh!: THREE.InstancedMesh;
  private particleCount = 8000;
  private particleData: ParticleRecord[] = [];
  private dummyTransform = new THREE.Object3D();
  private healthyColor = new THREE.Color(0x00e5ff);
  private cancerColor = new THREE.Color(0xff0055);

  // Sorter Live Parameters
  private sorterNodeCount = 4;
  private sorterPowerMultiplier = 1.4;
  private sorterFlowSpeedMultiplier = 1.0;

  // Histotripsy Cavitation Shockwave & Debris
  public cavitationGroup: THREE.Group;
  private shockwaveSphere: THREE.Mesh;
  private debrisPoints: THREE.Points;
  private debrisGeom: THREE.BufferGeometry;
  private debrisCount = 6000;
  private debrisVelocities: Float32Array;
  private debrisLifetimes: Float32Array;
  private isLysisActive = false;
  private isLysisResetting = false;
  private lysisProgress = 0.0;
  private lysisDuration = 1.6;
  private lysisResetTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private zeroOrigin = new THREE.Vector3(0, 0, 0);

  // State
  private viewMode: BioViewMode = 'cell-inspector';
  private currentSpecimen: BioSpecimenProfile;
  private acousticIntensity = 1.0;
  private acousticFreqHz = 220.0;

  constructor(initialSpecimenId = 'healthy-somatic') {
    this.group = new THREE.Group();
    this.currentSpecimen = BioAcousticPhysics.SPECIMENS[initialSpecimenId] || BioAcousticPhysics.SPECIMENS['healthy-somatic'];
    this.acousticFreqHz = this.currentSpecimen.audibleDownmixHz;

    // 1. Bio Cell Mesh (Single Cell Inspector)
    this.bioCellMesh = new BioCellMesh(initialSpecimenId);
    this.group.add(this.bioCellMesh.group);

    // 2. Microfluidic Acoustophoresis Sorter Group
    this.sorterGroup = new THREE.Group();
    this.sorterGroup.visible = false;

    // 2a. 3D Channel Enclosure, IDTs & Annotations
    this.channelMesh = new MicrofluidicChannelMesh();
    this.sorterGroup.add(this.channelMesh.group);

    // 2b. Instanced Particles
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
    const sphereGeom = new THREE.SphereGeometry(0.065, 8, 8);
    const instMat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.90,
    });

    this.sortingParticlesMesh = new THREE.InstancedMesh(sphereGeom, instMat, this.particleCount);

    const channelLength = 16.0;

    for (let i = 0; i < this.particleCount; i++) {
      const isCancer = i % 2 === 0;
      // Stagger initial longitudinal z positions evenly along the channel
      const z = -8.0 + (i / this.particleCount) * channelLength;
      
      // Initial lateral positions: focused near center if near inlet, or slightly dispersed
      const progress = (z + 8.0) / channelLength;
      const spreadX = 0.4 + progress * 2.2;
      const x = (Math.random() - 0.5) * (isCancer ? spreadX * 1.5 : spreadX * 0.8);
      const y = (Math.random() - 0.5) * 0.5;

      this.particleData.push({
        x,
        y,
        z,
        vx: 0,
        vy: 0,
        vz: 1.8 + Math.random() * 0.6,
        type: isCancer ? 1 : 0,
        baseRadius: isCancer ? 0.085 : 0.055,
        phase: Math.random() * Math.PI * 2,
        isRecirculating: false,
        returnProgress: 0,
        exitX: 0,
        exitY: 0,
      });

      this.dummyTransform.position.set(x, y, z);
      this.dummyTransform.scale.setScalar(isCancer ? 1.35 : 0.95);
      this.dummyTransform.updateMatrix();
      this.sortingParticlesMesh.setMatrixAt(i, this.dummyTransform.matrix);
      this.sortingParticlesMesh.setColorAt(i, isCancer ? this.cancerColor : this.healthyColor);
    }

    if (this.sortingParticlesMesh.instanceColor) {
      this.sortingParticlesMesh.instanceColor.needsUpdate = true;
    }
    this.sortingParticlesMesh.instanceMatrix.needsUpdate = true;

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

  public setSorterParameters(params: {
    nodeCount?: number;
    powerMultiplier?: number;
    flowSpeedMultiplier?: number;
  }): void {
    if (params.nodeCount !== undefined) this.sorterNodeCount = Math.max(1, Math.min(8, params.nodeCount));
    if (params.powerMultiplier !== undefined) this.sorterPowerMultiplier = Math.max(0.1, params.powerMultiplier);
    if (params.flowSpeedMultiplier !== undefined) this.sorterFlowSpeedMultiplier = Math.max(0.2, params.flowSpeedMultiplier);
  }

  public getMicrofluidicTelemetry(dt = 0.016): MicrofluidicTelemetryData {
    return MicrofluidicPhysics.computeTelemetry(
      this.sorterPowerMultiplier * 1.5,
      this.sorterFlowSpeedMultiplier,
      this.sorterNodeCount,
      dt
    );
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

  public triggerHistotripsyLysis(): void {
    if (this.lysisResetTimeoutId !== null) {
      clearTimeout(this.lysisResetTimeoutId);
      this.lysisResetTimeoutId = null;
    }
    this.isLysisActive = true;
    this.isLysisResetting = false;
    this.lysisProgress = 0.0;

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
    if (!this.group.visible) return;

    // 1. Single Cell Inspector Update
    if (this.viewMode === 'cell-inspector') {
      this.bioCellMesh.update(time, dt, camera, audioBands);

      // Histotripsy Lysis Animation
      if (this.isLysisActive) {
        this.lysisProgress += dt / this.lysisDuration;

        const shockRadius = this.lysisProgress * 7.5;
        const shockEnergy = Math.max(0, 1.0 - this.lysisProgress);
        this.bioCellMesh.setRuptureProgress(Math.min(1.0, this.lysisProgress * 1.5), shockRadius, this.zeroOrigin);

        this.shockwaveSphere.scale.setScalar(Math.max(0.1, shockRadius));
        (this.shockwaveSphere.material as THREE.MeshBasicMaterial).opacity = shockEnergy * 0.75;

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

        if (this.lysisProgress >= 1.0 && !this.isLysisResetting) {
          this.isLysisResetting = true;
          this.lysisResetTimeoutId = setTimeout(() => {
            this.isLysisActive = false;
            this.isLysisResetting = false;
            this.lysisResetTimeoutId = null;
            this.lysisProgress = 0.0;
            this.bioCellMesh.setRuptureProgress(0.0);
            if (this.shockwaveSphere && this.shockwaveSphere.material) {
              (this.shockwaveSphere.material as THREE.MeshBasicMaterial).opacity = 0.0;
            }
            if (this.debrisPoints && this.debrisPoints.material) {
              (this.debrisPoints.material as THREE.PointsMaterial).opacity = 0.0;
            }
          }, 1800);
        }
      }
    } else {
      // 2. Microfluidic Acoustophoresis 4-Zone Sorting Simulation
      this.channelMesh.update(time, this.acousticFreqHz, this.sorterPowerMultiplier, this.sorterNodeCount);

      const k = (this.sorterNodeCount * Math.PI) / 8.0;
      const audioBoost = 1.0 + audioBands.y * 1.2;
      const baseFlowSpeed = 2.2 * this.sorterFlowSpeedMultiplier;
      const damping = Math.pow(0.88, dt * 60.0);

      for (let i = 0; i < this.particleCount; i++) {
        const p = this.particleData[i];

        if (!p.isRecirculating) {
          // ---- ACTIVE CHANNEL FLOW ----
          
          // Phase 0: Hydrodynamic Inlet Focusing (z in [-8.0, -4.0])
          if (p.z < -4.0) {
            const focusStrength = (-4.0 - p.z) / 4.0;
            p.vx += -p.x * 2.0 * focusStrength * dt;
          }

          // Phase 1: Acoustic Standing Wave Excitation (z in [-4.0, +4.0])
          if (p.z >= -4.0 && p.z <= 4.0) {
            const contrastSign = p.type === 0 ? 1.0 : -1.1; // Healthy (+) vs Cancer (-)
            const sAc = Math.pow(Math.cos((Math.PI * p.z) / 16.0), 2);
            const forceMag = 3.6 * this.sorterPowerMultiplier * audioBoost * sAc;
            
            const fRadX = -Math.sin(2.0 * k * p.x) * forceMag * contrastSign;
            p.vx += fRadX * dt;
          }

          // Phase 2: Trident Outlet Separation (z in [+4.0, +8.0])
          if (p.z > 4.0) {
            const splitProgress = (p.z - 4.0) / 4.0;
            if (p.type === 1) {
              // Cancer: Divert into upper/lower side collection channels
              const sideDir = p.x >= 0 ? 1.0 : -1.0;
              p.vx += sideDir * 2.6 * splitProgress * dt;
            } else {
              // Healthy: Collimated central stream
              p.vx += -p.x * 3.0 * splitProgress * dt;
            }
          }

          // Viscous drag & velocity damping
          p.vx *= damping;
          p.vy *= damping;

          // Parabolic Poiseuille longitudinal flow
          p.z += baseFlowSpeed * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;

          // Slight gentle hydrodynamic levitation jitter
          const yPos = p.y + Math.sin(time * 3.0 + p.phase) * 0.03;

          // Check for outlet exit
          if (p.z >= 8.0) {
            p.isRecirculating = true;
            p.returnProgress = 0.0;
            p.exitX = p.x;
            p.exitY = p.y;
          }

          this.dummyTransform.position.set(p.x, yPos, p.z);
          this.dummyTransform.scale.setScalar(p.type === 1 ? 1.35 : 0.95);
          this.dummyTransform.updateMatrix();
          this.sortingParticlesMesh.setMatrixAt(i, this.dummyTransform.matrix);

        } else {
          // ---- PHASE 3: SMOOTH CLOSED-LOOP RECIRCULATION ----
          p.returnProgress += (dt * baseFlowSpeed) / 16.0;

          if (p.returnProgress >= 1.0) {
            // Re-enter inlet in focused mixed stream
            p.isRecirculating = false;
            p.z = -8.0;
            p.x = (Math.random() - 0.5) * 0.6;
            p.y = (Math.random() - 0.5) * 0.4;
            p.vx = 0.0;
            p.vy = 0.0;
          } else {
            const s = p.returnProgress;
            p.z = 8.0 - 16.0 * s;

            if (p.type === 1) {
              // Cancer: Outer bypass racetrack arc
              const side = p.exitX >= 0 ? 1.0 : -1.0;
              const outerFlare = Math.sin(Math.PI * s) * 1.2;
              p.x = side * (3.6 + outerFlare) * (1.0 - s) + ((Math.random() - 0.5) * 0.4) * s;
              p.y = p.exitY * (1.0 - s) + Math.sin(Math.PI * s) * 0.5 * side;
            } else {
              // Healthy: Sub-floor return conduit
              p.x = p.exitX * (1.0 - s);
              p.y = -1.6 * Math.sin(Math.PI * s);
            }
          }

          this.dummyTransform.position.set(p.x, p.y, p.z);
          this.dummyTransform.scale.setScalar(p.type === 1 ? 1.35 : 0.95);
          this.dummyTransform.updateMatrix();
          this.sortingParticlesMesh.setMatrixAt(i, this.dummyTransform.matrix);
        }
      }

      this.sortingParticlesMesh.instanceMatrix.needsUpdate = true;
    }
  }

  public setVisible(visible: boolean): void {
    this.group.visible = visible;
  }

  public isVisible(): boolean {
    return this.group.visible;
  }

  public dispose(): void {
    if (this.lysisResetTimeoutId !== null) {
      clearTimeout(this.lysisResetTimeoutId);
      this.lysisResetTimeoutId = null;
    }
    this.bioCellMesh.dispose();
    this.channelMesh.dispose();
    this.sortingParticlesMesh.geometry.dispose();
    (this.sortingParticlesMesh.material as THREE.Material).dispose();
    this.shockwaveSphere.geometry.dispose();
    (this.shockwaveSphere.material as THREE.Material).dispose();
    this.debrisGeom.dispose();
    (this.debrisPoints.material as THREE.Material).dispose();
  }
}
