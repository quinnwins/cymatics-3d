/**
 * AcousticTherapyLab.ts
 * SoundForm 3D - Frontier Bio-Acoustic Oncology, Active Wave Cancellation, Vortex OAM & Acousto-Immunotherapy
 *
 * Integrated Frontier Systems:
 * 1. Dual Co-Culture Cell Meshes (Malignant Target + Healthy Somatic Control).
 * 2. 3D Multicellular Tumor Spheroid Cluster Mode (Malignant Core + Healthy Stromal Margin).
 * 3. Clinical AFM Elastography Profiles (Glioblastoma, Pancreatic, Breast, Osteosarcoma).
 * 4. Real-Time Wave Interference Surface (p1 + p2 = 0).
 * 5. Time-Reversal Acoustic Phase-Conjugate Converging Beam Array.
 * 6. Acoustic Orbital Angular Momentum (OAM) Helical Vortex Beam (l = 1, 2, 3).
 * 7. Sonodynamic Cavitation Sonoluminescence & Singlet Oxygen (1O2) Flash.
 * 8. PIEZO1 Gating & Intracellular Calcium ([Ca2+]i) Reaction-Diffusion Wave.
 * 9. Autonomous CD8+ Cytotoxic T-Cell Swarm Chemotaxis & Immunological Synapse Degranulation.
 */

import * as THREE from 'three';
import { BioCellMesh } from './BioCellMesh';
import {
  THERAPY_WAVE_INTERFERENCE_VERTEX_SHADER,
  THERAPY_WAVE_INTERFERENCE_FRAGMENT_SHADER,
  TIME_REVERSAL_BEAM_VERTEX_SHADER,
  TIME_REVERSAL_BEAM_FRAGMENT_SHADER,
} from './shaders/therapyInterferenceShader';
import { OncotripsyPhysics, OncotripsyState, TherapyTelemetry } from '../math/OncotripsyPhysics';
import { AcousticVortexBeam } from './AcousticVortexBeam';
import { SonodynamicCavitationSystem } from './SonodynamicCavitationSystem';
import { IntracellularCalciumFlux } from './IntracellularCalciumFlux';
import { CytotoxicTCellSwarm } from './CytotoxicTCellSwarm';

export type TherapyExperiment =
  | 'phase-cancel'
  | 'oncotripsy'
  | 'histotripsy'
  | 'time-reversal'
  | 'vortex-torsion'
  | 'sonodynamic-sdt'
  | 'calcium-piezo1'
  | 'immune-swarm';

export class AcousticTherapyLab {
  public group: THREE.Group;

  // 1. Dual Co-Culture Setup
  public singlePairGroup: THREE.Group;
  public cancerCell: BioCellMesh;
  public healthyCell: BioCellMesh;

  // 2. 3D Spheroid Cluster Mode
  public spheroidGroup: THREE.Group;
  private tumorCoreInstanced: THREE.InstancedMesh;
  private stromalMarginInstanced: THREE.InstancedMesh;
  private tumorCoreCount = 45;
  private stromalMarginCount = 45;
  private tumorCorePositions: THREE.Vector3[] = [];
  private stromalMarginPositions: THREE.Vector3[] = [];
  private dummyTransform = new THREE.Object3D();

  // 3. Wave Interference Surface
  private waveSurfaceMesh: THREE.Mesh;
  private waveMaterial: THREE.ShaderMaterial;

  // 4. Time-Reversal Beam Array
  private beamGroup: THREE.Group;
  private beamCones: THREE.Mesh[] = [];
  private beamMaterial: THREE.ShaderMaterial;

  // 5. Frontier Subsystems
  public vortexBeam: AcousticVortexBeam;
  public sonodynamicSystem: SonodynamicCavitationSystem;
  public calciumFlux: IntracellularCalciumFlux;
  public tCellSwarm: CytotoxicTCellSwarm;

  // 6. Selective Lysis & Cavitation Debris FX
  private lysisGroup: THREE.Group;
  private shockwaveMesh: THREE.Mesh;
  private debrisPoints: THREE.Points;
  private debrisGeom: THREE.BufferGeometry;
  private debrisCount = 6000;
  private debrisVelocities: Float32Array;
  private isLysisActive = false;
  private isLysisResetting = false;
  private lysisProgress = 0.0;
  private lysisDuration = 1.8;
  private lysisResetTimeoutId: ReturnType<typeof setTimeout> | null = null;

  // Lab State
  private state: OncotripsyState = {
    tumorProfileId: 'mda-mb-231',
    frequencyHz: 118.0,
    phaseDegrees: 180.0,
    acousticPower: 1.0,
    isAntiPhaseActive: false,
    isOncotripsyActive: false,
    isHeterodyneActive: false,
    isTimeReversalActive: false,
    viewMode: 'co-culture-pair',
  };
  private currentExperiment: TherapyExperiment = 'phase-cancel';

  constructor() {
    this.group = new THREE.Group();

    // 1. Single Pair Co-Culture Setup
    this.singlePairGroup = new THREE.Group();
    this.cancerCell = new BioCellMesh('malignant-cancer');
    this.cancerCell.group.position.set(-1.8, 0.4, 0);
    this.cancerCell.group.scale.setScalar(0.85);
    this.singlePairGroup.add(this.cancerCell.group);

    this.healthyCell = new BioCellMesh('healthy-somatic');
    this.healthyCell.group.position.set(1.8, 0.4, 0);
    this.healthyCell.group.scale.setScalar(0.85);
    this.singlePairGroup.add(this.healthyCell.group);
    this.group.add(this.singlePairGroup);

    // 2. 3D Multicellular Spheroid Setup
    this.spheroidGroup = new THREE.Group();
    this.spheroidGroup.visible = false;
    this.spheroidGroup.position.set(0, 0.4, 0);

    const sphereGeom = new THREE.SphereGeometry(0.24, 16, 16);
    const tumorMat = new THREE.MeshBasicMaterial({
      color: 0xff0066,
      transparent: true,
      opacity: 0.92,
    });
    const stromalMat = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      transparent: true,
      opacity: 0.85,
    });

    this.tumorCoreInstanced = new THREE.InstancedMesh(sphereGeom, tumorMat, this.tumorCoreCount);
    this.stromalMarginInstanced = new THREE.InstancedMesh(sphereGeom, stromalMat, this.stromalMarginCount);

    for (let i = 0; i < this.tumorCoreCount; i++) {
      const phi = Math.acos(2 * Math.random() - 1);
      const theta = Math.random() * Math.PI * 2;
      const r = Math.cbrt(Math.random()) * 1.1;

      const pos = new THREE.Vector3(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta),
        r * Math.cos(phi)
      );
      this.tumorCorePositions.push(pos);
      this.dummyTransform.position.copy(pos);
      this.dummyTransform.scale.setScalar(0.9 + Math.random() * 0.25);
      this.dummyTransform.updateMatrix();
      this.tumorCoreInstanced.setMatrixAt(i, this.dummyTransform.matrix);
    }
    this.tumorCoreInstanced.instanceMatrix.needsUpdate = true;

    for (let i = 0; i < this.stromalMarginCount; i++) {
      const phi = Math.acos(2 * Math.random() - 1);
      const theta = Math.random() * Math.PI * 2;
      const r = 1.25 + Math.random() * 0.95;

      const pos = new THREE.Vector3(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta),
        r * Math.cos(phi)
      );
      this.stromalMarginPositions.push(pos);
      this.dummyTransform.position.copy(pos);
      this.dummyTransform.scale.setScalar(0.85 + Math.random() * 0.2);
      this.dummyTransform.updateMatrix();
      this.stromalMarginInstanced.setMatrixAt(i, this.dummyTransform.matrix);
    }
    this.stromalMarginInstanced.instanceMatrix.needsUpdate = true;

    this.spheroidGroup.add(this.tumorCoreInstanced);
    this.spheroidGroup.add(this.stromalMarginInstanced);
    this.group.add(this.spheroidGroup);

    // 3. Wave Interference Plane
    const planeGeom = new THREE.PlaneGeometry(12, 10, 80, 80);
    planeGeom.rotateX(-Math.PI / 2);

    this.waveMaterial = new THREE.ShaderMaterial({
      vertexShader: THERAPY_WAVE_INTERFERENCE_VERTEX_SHADER,
      fragmentShader: THERAPY_WAVE_INTERFERENCE_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uFrequency: { value: this.state.frequencyHz },
        uPhaseOffsetRad: { value: (this.state.phaseDegrees * Math.PI) / 180.0 },
        uAmplitudePrimary: { value: 1.0 },
        uAmplitudeTherapy: { value: 1.0 },
        uIsAntiPhaseActive: { value: 0 },
        uCameraPosition: { value: new THREE.Vector3() },
      },
    });

    this.waveSurfaceMesh = new THREE.Mesh(planeGeom, this.waveMaterial);
    this.waveSurfaceMesh.position.y = -1.6;
    this.group.add(this.waveSurfaceMesh);

    // 4. Time-Reversal Beam Cones
    this.beamGroup = new THREE.Group();
    this.beamGroup.visible = false;

    this.beamMaterial = new THREE.ShaderMaterial({
      vertexShader: TIME_REVERSAL_BEAM_VERTEX_SHADER,
      fragmentShader: TIME_REVERSAL_BEAM_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uBeamIntensity: { value: 1.0 },
        uCameraPosition: { value: new THREE.Vector3() },
      },
    });

    const beamGeom = new THREE.CylinderGeometry(0.15, 1.2, 5.0, 32, 1, true);
    beamGeom.translate(0, 2.5, 0);
    beamGeom.rotateX(-Math.PI / 2);

    const beamAngles = [-0.6, 0.0, 0.6];
    for (const angle of beamAngles) {
      const beam = new THREE.Mesh(beamGeom, this.beamMaterial);
      beam.position.set(-1.8, 0.4, 0);
      const transducerPos = new THREE.Vector3(
        -1.8 + Math.sin(angle) * 4.2,
        0.4 + Math.cos(angle) * 2.0,
        3.8
      );
      beam.lookAt(transducerPos);
      this.beamCones.push(beam);
      this.beamGroup.add(beam);
    }
    this.group.add(this.beamGroup);

    // 5. Frontier Subsystems
    this.vortexBeam = new AcousticVortexBeam();
    this.vortexBeam.group.position.set(-1.8, 0.4, 0);
    this.vortexBeam.group.visible = false;
    this.group.add(this.vortexBeam.group);

    this.sonodynamicSystem = new SonodynamicCavitationSystem();
    this.group.add(this.sonodynamicSystem.group);

    this.calciumFlux = new IntracellularCalciumFlux();
    this.calciumFlux.group.position.set(-1.8, 0.4, 0);
    this.calciumFlux.group.visible = false;
    this.group.add(this.calciumFlux.group);

    this.tCellSwarm = new CytotoxicTCellSwarm();
    this.tCellSwarm.group.visible = false;
    this.group.add(this.tCellSwarm.group);

    // 6. Selective Lysis & Cavitation Debris FX
    this.lysisGroup = new THREE.Group();
    const shockGeom = new THREE.SphereGeometry(1.0, 32, 24);
    const shockMat = new THREE.MeshBasicMaterial({
      color: 0xffaa00,
      transparent: true,
      opacity: 0.0,
      wireframe: true,
      blending: THREE.AdditiveBlending,
    });
    this.shockwaveMesh = new THREE.Mesh(shockGeom, shockMat);
    this.shockwaveMesh.position.set(-1.8, 0.4, 0);
    this.lysisGroup.add(this.shockwaveMesh);

    this.debrisGeom = new THREE.BufferGeometry();
    const debrisPos = new Float32Array(this.debrisCount * 3);
    this.debrisVelocities = new Float32Array(this.debrisCount * 3);

    for (let i = 0; i < this.debrisCount; i++) {
      debrisPos[i * 3 + 0] = -1.8;
      debrisPos[i * 3 + 1] = 0.4;
      debrisPos[i * 3 + 2] = 0;
    }

    this.debrisGeom.setAttribute('position', new THREE.BufferAttribute(debrisPos, 3));
    const debrisMat = new THREE.PointsMaterial({
      size: 0.07,
      color: 0xff0055,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
    });
    this.debrisPoints = new THREE.Points(this.debrisGeom, debrisMat);
    this.lysisGroup.add(this.debrisPoints);

    this.group.add(this.lysisGroup);
  }

  public resetSimulation(): void {
    if (this.lysisResetTimeoutId !== null) {
      clearTimeout(this.lysisResetTimeoutId);
      this.lysisResetTimeoutId = null;
    }
    this.isLysisActive = false;
    this.isLysisResetting = false;
    this.lysisProgress = 0.0;
    this.cancerCell.setRuptureProgress(0.0);
    if (this.shockwaveMesh && this.shockwaveMesh.material) {
      (this.shockwaveMesh.material as THREE.MeshBasicMaterial).opacity = 0.0;
      this.shockwaveMesh.scale.setScalar(0.1);
    }
    if (this.debrisPoints && this.debrisPoints.material) {
      (this.debrisPoints.material as THREE.PointsMaterial).opacity = 0.0;
    }
  }

  public setTumorProfile(profileId: string): void {
    this.resetSimulation();
    this.state.tumorProfileId = profileId;
    const tumor = OncotripsyPhysics.CLINICAL_PROFILES[profileId] || OncotripsyPhysics.CLINICAL_PROFILES['mda-mb-231'];

    this.cancerCell.setAcousticFrequency(tumor.resonantFreqHz);
    this.setFrequency(tumor.resonantFreqHz);

    (this.tumorCoreInstanced.material as THREE.MeshBasicMaterial).color.setHex(tumor.colorHex);
    (this.debrisPoints.material as THREE.PointsMaterial).color.setHex(tumor.colorHex);
  }

  public setViewMode(mode: 'co-culture-pair' | 'spheroid-cluster'): void {
    this.state.viewMode = mode;
    const originX = mode === 'co-culture-pair' ? -1.8 : 0.0;
    if (mode === 'co-culture-pair') {
      this.singlePairGroup.visible = true;
      this.spheroidGroup.visible = false;
      this.shockwaveMesh.position.set(-1.8, 0.4, 0);
      this.tCellSwarm.setDampSources([new THREE.Vector3(-1.8, 0.4, 0)]);
    } else {
      this.singlePairGroup.visible = false;
      this.spheroidGroup.visible = true;
      this.shockwaveMesh.position.set(0, 0.4, 0);
      this.tCellSwarm.setDampSources([new THREE.Vector3(0, 0.4, 0)]);
    }
    this.vortexBeam.group.position.set(originX, 0.4, 0);
    this.calciumFlux.group.position.set(originX, 0.4, 0);
    this.debrisPoints.position.set(originX, 0.4, 0);
  }

  public setExperiment(exp: TherapyExperiment): void {
    this.resetSimulation();
    this.currentExperiment = exp;

    // Reset visibility of special layers
    this.waveSurfaceMesh.visible = false;
    this.beamGroup.visible = false;
    this.vortexBeam.group.visible = false;
    this.calciumFlux.group.visible = false;
    this.tCellSwarm.group.visible = false;
    this.state.isTimeReversalActive = false;

    if (exp === 'phase-cancel') {
      this.waveSurfaceMesh.visible = true;
    } else if (exp === 'oncotripsy') {
      this.waveSurfaceMesh.visible = true;
      this.triggerOncotripsyBurst();
    } else if (exp === 'histotripsy') {
      this.waveSurfaceMesh.visible = true;
      this.triggerHistotripsyBurst();
    } else if (exp === 'time-reversal') {
      this.beamGroup.visible = true;
      this.state.isTimeReversalActive = true;
    } else if (exp === 'vortex-torsion') {
      this.vortexBeam.group.visible = true;
    } else if (exp === 'sonodynamic-sdt') {
      this.waveSurfaceMesh.visible = true;
      this.triggerSonodynamicFlash();
    } else if (exp === 'calcium-piezo1') {
      this.calciumFlux.group.visible = true;
      this.triggerPiezo1CalciumWave();
    } else if (exp === 'immune-swarm') {
      this.tCellSwarm.group.visible = true;
      this.tCellSwarm.setDampSources([
        this.state.viewMode === 'spheroid-cluster' ? new THREE.Vector3(0, 0.4, 0) : new THREE.Vector3(-1.8, 0.4, 0),
      ]);
    }
  }

  public triggerHistotripsyBurst(): void {
    if (this.lysisResetTimeoutId !== null) {
      clearTimeout(this.lysisResetTimeoutId);
      this.lysisResetTimeoutId = null;
    }
    this.isLysisActive = true;
    this.isLysisResetting = false;
    this.lysisProgress = 0.0;

    const isSpheroid = this.state.viewMode === 'spheroid-cluster';
    const originX = isSpheroid ? 0.0 : -1.8;

    const posAttr = this.debrisGeom.getAttribute('position') as THREE.BufferAttribute;
    const posArray = posAttr.array as Float32Array;

    for (let i = 0; i < this.debrisCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const speed = 4.5 + Math.random() * 12.0; // High-velocity microjet cavitation debris

      this.debrisVelocities[i * 3 + 0] = Math.sin(phi) * Math.cos(theta) * speed;
      this.debrisVelocities[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * speed;
      this.debrisVelocities[i * 3 + 2] = Math.cos(phi) * speed;

      posArray[i * 3 + 0] = originX + (Math.random() - 0.5) * (isSpheroid ? 1.6 : 0.8);
      posArray[i * 3 + 1] = 0.4 + (Math.random() - 0.5) * (isSpheroid ? 1.6 : 0.8);
      posArray[i * 3 + 2] = (Math.random() - 0.5) * (isSpheroid ? 1.6 : 0.8);
    }
    posAttr.needsUpdate = true;

    // Trigger secondary immune chemotaxis
    this.tCellSwarm.setDampSources([new THREE.Vector3(originX, 0.4, 0)]);
  }

  public triggerSonodynamicFlash(): void {
    const origin = this.state.viewMode === 'spheroid-cluster' ? new THREE.Vector3(0, 0.4, 0) : new THREE.Vector3(-1.8, 0.4, 0);
    this.sonodynamicSystem.triggerCavitationBurst(origin, this.state.acousticPower);
  }

  public triggerPiezo1CalciumWave(): void {
    this.calciumFlux.triggerSonoporationPore(
      new THREE.Vector3((Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.8, 0.6),
      performance.now() * 0.001
    );
  }

  public setVortexTopologicalCharge(charge: 1 | 2 | 3): void {
    this.vortexBeam.setTopologicalCharge(charge);
  }

  public setFrequency(freqHz: number): void {
    this.state.frequencyHz = freqHz;
    this.waveMaterial.uniforms.uFrequency.value = freqHz;
    this.vortexBeam.setFrequency(freqHz);
    this.cancerCell.setAcousticFrequency(freqHz);
    this.healthyCell.setAcousticFrequency(freqHz);
  }

  public setPhaseDegrees(phaseDeg: number): void {
    this.state.phaseDegrees = phaseDeg;
    this.waveMaterial.uniforms.uPhaseOffsetRad.value = (phaseDeg * Math.PI) / 180.0;
  }

  public setAcousticPower(power: number): void {
    this.state.acousticPower = power;
    this.waveMaterial.uniforms.uAmplitudePrimary.value = power;
    this.waveMaterial.uniforms.uAmplitudeTherapy.value = power;
    this.beamMaterial.uniforms.uBeamIntensity.value = power;
  }

  public setAntiPhase(active: boolean): void {
    this.state.isAntiPhaseActive = active;
    this.waveMaterial.uniforms.uIsAntiPhaseActive.value = active ? 1 : 0;
  }

  public setHeterodyne(active: boolean): void {
    this.state.isHeterodyneActive = active;
  }

  public triggerOncotripsyBurst(): void {
    if (this.lysisResetTimeoutId !== null) {
      clearTimeout(this.lysisResetTimeoutId);
      this.lysisResetTimeoutId = null;
    }
    this.isLysisActive = true;
    this.isLysisResetting = false;
    this.lysisProgress = 0.0;

    const isSpheroid = this.state.viewMode === 'spheroid-cluster';
    const originX = isSpheroid ? 0.0 : -1.8;

    const posAttr = this.debrisGeom.getAttribute('position') as THREE.BufferAttribute;
    const posArray = posAttr.array as Float32Array;

    for (let i = 0; i < this.debrisCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const speed = 2.5 + Math.random() * 6.5;

      this.debrisVelocities[i * 3 + 0] = Math.sin(phi) * Math.cos(theta) * speed;
      this.debrisVelocities[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * speed;
      this.debrisVelocities[i * 3 + 2] = Math.cos(phi) * speed;

      posArray[i * 3 + 0] = originX + (Math.random() - 0.5) * (isSpheroid ? 1.6 : 0.8);
      posArray[i * 3 + 1] = 0.4 + (Math.random() - 0.5) * (isSpheroid ? 1.6 : 0.8);
      posArray[i * 3 + 2] = (Math.random() - 0.5) * (isSpheroid ? 1.6 : 0.8);
    }
    posAttr.needsUpdate = true;

    // Trigger secondary immune chemotaxis
    this.tCellSwarm.setDampSources([new THREE.Vector3(originX, 0.4, 0)]);
  }

  public getTelemetry(): TherapyTelemetry {
    return OncotripsyPhysics.evaluateTherapyTelemetry(this.state);
  }

  public getState(): OncotripsyState {
    return this.state;
  }

  public setState(partial: Partial<OncotripsyState>): void {
    if (partial.tumorProfileId !== undefined) this.setTumorProfile(partial.tumorProfileId);
    if (partial.frequencyHz !== undefined) this.setFrequency(partial.frequencyHz);
    if (partial.phaseDegrees !== undefined) this.setPhaseDegrees(partial.phaseDegrees);
    if (partial.acousticPower !== undefined) this.setAcousticPower(partial.acousticPower);
    if (partial.isAntiPhaseActive !== undefined) this.setAntiPhase(partial.isAntiPhaseActive);
    if (partial.isHeterodyneActive !== undefined) this.setHeterodyne(partial.isHeterodyneActive);
    if (partial.viewMode !== undefined) this.setViewMode(partial.viewMode);
    if (partial.isOncotripsyActive !== undefined) this.state.isOncotripsyActive = partial.isOncotripsyActive;
  }

  public update(time: number, dt: number, camera: THREE.Camera, audioBands: THREE.Vector4): void {
    if (!this.group.visible) return;

    // 1. Update Wave Shaders
    this.waveMaterial.uniforms.uTime.value = time;
    this.waveMaterial.uniforms.uCameraPosition.value.copy(camera.position);
    this.beamMaterial.uniforms.uTime.value = time;
    this.beamMaterial.uniforms.uCameraPosition.value.copy(camera.position);

    // 2. Update Frontier Subsystems
    if (this.vortexBeam.group.visible) {
      this.vortexBeam.update(time, dt, camera, audioBands.x);
    }
    this.sonodynamicSystem.update(time, dt, camera);
    if (this.calciumFlux.group.visible) {
      this.calciumFlux.update(time, dt, camera);
    }
    if (this.tCellSwarm.group.visible) {
      this.tCellSwarm.update(time, dt, camera);
    }

    // 3. Update Cell Dynamic Strains
    const telemetry = this.getTelemetry();

    this.cancerCell.setAcousticIntensity(Math.min(3.0, 0.4 + telemetry.cancerStrain * 8.0));
    this.cancerCell.update(time, dt, camera, audioBands);

    this.healthyCell.setAcousticIntensity(Math.min(0.6, 0.15 + telemetry.healthyStrain * 4.0));
    this.healthyCell.update(time, dt, camera, audioBands);

    // 4. Spheroid Breathing & Resonant Agitation
    if (this.spheroidGroup.visible) {
      const cancerBeatScale = 1.0 + (Math.sin(time * 8.0) * 0.15 + 0.1) * (telemetry.cancerStrain * 4.0);
      for (let i = 0; i < this.tumorCoreCount; i++) {
        const basePos = this.tumorCorePositions[i];
        this.dummyTransform.position.set(
          basePos.x * cancerBeatScale,
          basePos.y * cancerBeatScale,
          basePos.z * cancerBeatScale
        );
        this.dummyTransform.scale.setScalar(
          (0.9 + Math.sin(time * 6.0 + i) * 0.1) *
            (this.isLysisActive ? Math.max(0.1, 1.0 - this.lysisProgress) : 1.0)
        );
        this.dummyTransform.updateMatrix();
        this.tumorCoreInstanced.setMatrixAt(i, this.dummyTransform.matrix);
      }
      this.tumorCoreInstanced.instanceMatrix.needsUpdate = true;
      this.spheroidGroup.rotation.y = time * 0.1;
    }

    // 5. Oncotripsy Lysis Animation
    if (this.isLysisActive) {
      this.lysisProgress += dt / this.lysisDuration;

      const shockRadius = this.lysisProgress * 5.0;
      const shockEnergy = Math.max(0, 1.0 - this.lysisProgress);
      this.cancerCell.setRuptureProgress(Math.min(1.0, this.lysisProgress * 1.5), shockRadius);

      this.shockwaveMesh.scale.setScalar(Math.max(0.1, shockRadius));
      (this.shockwaveMesh.material as THREE.MeshBasicMaterial).opacity = shockEnergy * 0.8;

      const posAttr = this.debrisGeom.getAttribute('position') as THREE.BufferAttribute;
      const posArray = posAttr.array as Float32Array;

      for (let i = 0; i < this.debrisCount; i++) {
        posArray[i * 3 + 0] += this.debrisVelocities[i * 3 + 0] * dt;
        posArray[i * 3 + 1] += this.debrisVelocities[i * 3 + 1] * dt;
        posArray[i * 3 + 2] += this.debrisVelocities[i * 3 + 2] * dt;
        this.debrisVelocities[i * 3 + 0] *= 0.95;
        this.debrisVelocities[i * 3 + 1] *= 0.95;
        this.debrisVelocities[i * 3 + 2] *= 0.95;
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
          this.cancerCell.setRuptureProgress(0.0);
          if (this.shockwaveMesh && this.shockwaveMesh.material) {
            (this.shockwaveMesh.material as THREE.MeshBasicMaterial).opacity = 0.0;
          }
          if (this.debrisPoints && this.debrisPoints.material) {
            (this.debrisPoints.material as THREE.PointsMaterial).opacity = 0.0;
          }
        }, 1600);
      }
    }

    this.group.rotation.y = Math.sin(time * 0.05) * 0.08;
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
    this.cancerCell.dispose();
    this.healthyCell.dispose();
    this.tumorCoreInstanced.geometry.dispose();
    (this.tumorCoreInstanced.material as THREE.Material).dispose();
    this.stromalMarginInstanced.geometry.dispose();
    (this.stromalMarginInstanced.material as THREE.Material).dispose();
    this.waveSurfaceMesh.geometry.dispose();
    this.waveMaterial.dispose();
    this.beamMaterial.dispose();
    this.vortexBeam.dispose();
    this.sonodynamicSystem.dispose();
    this.calciumFlux.dispose();
    this.tCellSwarm.dispose();
    this.shockwaveMesh.geometry.dispose();
    (this.shockwaveMesh.material as THREE.Material).dispose();
    this.debrisGeom.dispose();
    (this.debrisPoints.material as THREE.Material).dispose();
  }
}
