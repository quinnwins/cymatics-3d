/**
 * NobelDiscoveryLab.ts
 * SoundForm 3D - Nobel Prize Biophysics & Computational Mechanomedicine 3D Laboratory
 *
 * Integrated Sub-Scenes:
 * 1. MechanogenomicsScene: Deformable Nucleus, LINC complex, NPC pores, Fractal Chromatin & p53 mRNA Bursts.
 * 2. BbbCavitationScene: Capillary Vessel, Claudin-5 Tight Junctions, FUS Microbubbles & Nanomedicine Stream.
 * 3. ViralCapsidScene: Icosahedral Capsid, Lamb Vibrational Modes, Explosive Shard Shatter & RNA Core.
 * 4. SenolyticScene: SASP-secreting Senescent Zombie Cell vs Compliant Healthy Cell, Micro-cracks & Apoptosis.
 */

import * as THREE from 'three';
import {
  NUCLEAR_LAMINA_VERTEX_SHADER,
  NUCLEAR_LAMINA_FRAGMENT_SHADER,
  CHROMATIN_FIBER_VERTEX_SHADER,
  CHROMATIN_FIBER_FRAGMENT_SHADER,
  TRANSCRIPTION_BURST_VERTEX_SHADER,
  TRANSCRIPTION_BURST_FRAGMENT_SHADER,
} from './shaders/chromatinShader';
import {
  BBB_CAPILLARY_VERTEX_SHADER,
  BBB_CAPILLARY_FRAGMENT_SHADER,
  NANOBOT_STREAM_VERTEX_SHADER,
  NANOBOT_STREAM_FRAGMENT_SHADER,
} from './shaders/bloodBrainBarrierShader';
import {
  VIRAL_CAPSID_VERTEX_SHADER,
  VIRAL_CAPSID_FRAGMENT_SHADER,
  VIRAL_GENOME_CORE_VERTEX_SHADER,
  VIRAL_GENOME_CORE_FRAGMENT_SHADER,
} from './shaders/viralCapsidShatterShader';
import {
  SENESCENT_CELL_VERTEX_SHADER,
  SENESCENT_CELL_FRAGMENT_SHADER,
  SASP_HAZE_VERTEX_SHADER,
  SASP_HAZE_FRAGMENT_SHADER,
} from './shaders/senolyticClearanceShader';
import { NobelBiophysics, NobelFrontierId, NobelLabState, NobelTelemetry } from '../math/NobelBiophysics';

// ============================================================================
// 1. Chromatin Mechanogenomics Sub-Scene
// ============================================================================
class ChromatinMechanogenomicsSystem {
  public group: THREE.Group;
  private laminaMesh: THREE.Mesh;
  private chromatinFiberMesh: THREE.LineSegments;
  private transcriptionParticles: THREE.Points;

  private laminaUniforms: { [key: string]: THREE.IUniform };
  private fiberUniforms: { [key: string]: THREE.IUniform };
  private particleUniforms: { [key: string]: THREE.IUniform };

  constructor() {
    this.group = new THREE.Group();

    // Nuclear Lamina Mesh
    const laminaGeom = new THREE.SphereGeometry(1.5, 64, 64);
    this.laminaUniforms = {
      uTime: { value: 0 },
      uAcousticIntensity: { value: 1.0 },
      uAcousticFrequency: { value: 120.0 },
      uAcousticVector: { value: new THREE.Vector3(1, 0.4, 0).normalize() },
      uLaminaStiffness: { value: 0.8 },
      uAudioBands: { value: new THREE.Vector4() },
      uCameraPosition: { value: new THREE.Vector3() },
      uHeterochromatinColor: { value: new THREE.Color(0x3d0d73) },
      uEuchromatinColor: { value: new THREE.Color(0xffd700) },
      uLaminaMeshColor: { value: new THREE.Color(0x00bcd4) },
      uUnfurlingRatio: { value: 0.0 },
      uTranscriptionRate: { value: 0.5 },
    };

    const laminaMat = new THREE.ShaderMaterial({
      vertexShader: NUCLEAR_LAMINA_VERTEX_SHADER,
      fragmentShader: NUCLEAR_LAMINA_FRAGMENT_SHADER,
      uniforms: this.laminaUniforms,
      transparent: true,
      depthWrite: false,
    });
    this.laminaMesh = new THREE.Mesh(laminaGeom, laminaMat);
    this.group.add(this.laminaMesh);

    // 3D Fractal Chromatin Fiber
    const fiberCount = 3500;
    const fiberPositions = new Float32Array(fiberCount * 6);
    const fractalOffsets = new Float32Array(fiberCount * 6);
    const compaction = new Float32Array(fiberCount * 2);
    const loopPhases = new Float32Array(fiberCount * 2);

    for (let i = 0; i < fiberCount; i++) {
      const phi = Math.acos(2 * Math.random() - 1);
      const theta = Math.random() * Math.PI * 2;
      const r = Math.pow(Math.random(), 0.5) * 1.15;

      const p1 = new THREE.Vector3(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta),
        r * Math.cos(phi)
      );
      const p2 = p1.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.15, (Math.random() - 0.5) * 0.15, (Math.random() - 0.5) * 0.15));

      const idx = i * 6;
      fiberPositions[idx] = p1.x; fiberPositions[idx + 1] = p1.y; fiberPositions[idx + 2] = p1.z;
      fiberPositions[idx + 3] = p2.x; fiberPositions[idx + 4] = p2.y; fiberPositions[idx + 5] = p2.z;

      fractalOffsets[idx] = p1.x * 0.5; fractalOffsets[idx + 1] = p1.y * 0.5; fractalOffsets[idx + 2] = p1.z * 0.5;
      fractalOffsets[idx + 3] = p1.x * 0.5; fractalOffsets[idx + 4] = p1.y * 0.5; fractalOffsets[idx + 5] = p1.z * 0.5;

      const comp = r < 0.6 ? 1.0 : 0.0;
      compaction[i * 2] = comp; compaction[i * 2 + 1] = comp;
      loopPhases[i * 2] = Math.random() * Math.PI * 2; loopPhases[i * 2 + 1] = loopPhases[i * 2];
    }

    const fiberGeom = new THREE.BufferGeometry();
    fiberGeom.setAttribute('position', new THREE.BufferAttribute(fiberPositions, 3));
    fiberGeom.setAttribute('aFractalOffset', new THREE.BufferAttribute(fractalOffsets, 3));
    fiberGeom.setAttribute('aCompactionDensity', new THREE.BufferAttribute(compaction, 1));
    fiberGeom.setAttribute('aLoopPhase', new THREE.BufferAttribute(loopPhases, 1));

    this.fiberUniforms = {
      uTime: { value: 0 },
      uUnfurlingRatio: { value: 0.0 },
      uAcousticFrequency: { value: 120.0 },
      uAcousticIntensity: { value: 1.0 },
      uAudioBands: { value: new THREE.Vector4() },
      uHeterochromatinColor: { value: new THREE.Color(0x4a0e4e) },
      uEuchromatinColor: { value: new THREE.Color(0xffc107) },
      uHistoneAcetylColor: { value: new THREE.Color(0x00e676) },
    };

    const fiberMat = new THREE.ShaderMaterial({
      vertexShader: CHROMATIN_FIBER_VERTEX_SHADER,
      fragmentShader: CHROMATIN_FIBER_FRAGMENT_SHADER,
      uniforms: this.fiberUniforms,
      transparent: true,
    });
    this.chromatinFiberMesh = new THREE.LineSegments(fiberGeom, fiberMat);
    this.group.add(this.chromatinFiberMesh);

    // Nascent mRNA Transcription Burst Particles
    const pCount = 1000;
    const pGeom = new THREE.BufferGeometry();
    const pPositions = new Float32Array(pCount * 3);
    const pVelocities = new Float32Array(pCount * 3);
    const pBirthTimes = new Float32Array(pCount);
    const pOriginPores = new Float32Array(pCount * 3);

    for (let i = 0; i < pCount; i++) {
      pPositions[i * 3] = (Math.random() - 0.5) * 0.7;
      pPositions[i * 3 + 1] = (Math.random() - 0.5) * 0.7;
      pPositions[i * 3 + 2] = (Math.random() - 0.5) * 0.7;

      const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
      pVelocities[i * 3] = dir.x * 0.8; pVelocities[i * 3 + 1] = dir.y * 0.8; pVelocities[i * 3 + 2] = dir.z * 0.8;
      pBirthTimes[i] = Math.random() * 3.0;

      const pore = dir.clone().multiplyScalar(1.5);
      pOriginPores[i * 3] = pore.x; pOriginPores[i * 3 + 1] = pore.y; pOriginPores[i * 3 + 2] = pore.z;
    }

    pGeom.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
    pGeom.setAttribute('aInitialVelocity', new THREE.BufferAttribute(pVelocities, 3));
    pGeom.setAttribute('aBirthTime', new THREE.BufferAttribute(pBirthTimes, 1));
    pGeom.setAttribute('aOriginPore', new THREE.BufferAttribute(pOriginPores, 3));

    this.particleUniforms = {
      uTime: { value: 0 },
      uParticleLifetime: { value: 3.0 },
      uAcousticIntensity: { value: 1.0 },
    };

    const particleMat = new THREE.ShaderMaterial({
      vertexShader: TRANSCRIPTION_BURST_VERTEX_SHADER,
      fragmentShader: TRANSCRIPTION_BURST_FRAGMENT_SHADER,
      uniforms: this.particleUniforms,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.transcriptionParticles = new THREE.Points(pGeom, particleMat);
    this.group.add(this.transcriptionParticles);
  }

  public update(time: number, acousticPower: number, unfurlRatio: number, camera: THREE.Camera, audioBands: THREE.Vector4) {
    this.laminaUniforms.uTime.value = time;
    this.laminaUniforms.uAcousticIntensity.value = acousticPower;
    this.laminaUniforms.uUnfurlingRatio.value = unfurlRatio;
    this.laminaUniforms.uCameraPosition.value.copy(camera.position);
    this.laminaUniforms.uAudioBands.value.copy(audioBands);

    this.fiberUniforms.uTime.value = time;
    this.fiberUniforms.uUnfurlingRatio.value = unfurlRatio;
    this.fiberUniforms.uAcousticIntensity.value = acousticPower;
    this.fiberUniforms.uAudioBands.value.copy(audioBands);

    this.particleUniforms.uTime.value = time;
    this.particleUniforms.uAcousticIntensity.value = acousticPower;
  }
}

// ============================================================================
// 2. Blood-Brain Barrier (BBB) Cavitation Sub-Scene
// ============================================================================
class BbbCavitationSystem {
  public group: THREE.Group;
  private capillaryMesh: THREE.Mesh;
  private nanobotPoints: THREE.Points;
  private microbubbleMesh: THREE.Mesh;

  private capillaryUniforms: { [key: string]: THREE.IUniform };
  private nanobotUniforms: { [key: string]: THREE.IUniform };

  constructor() {
    this.group = new THREE.Group();

    // Capillary Cylinder
    const capGeom = new THREE.CylinderGeometry(1.2, 1.2, 7.0, 48, 48, true);
    capGeom.rotateX(Math.PI / 2);

    this.capillaryUniforms = {
      uTime: { value: 0 },
      uAcousticPressure: { value: 0.8 },
      uCavitationFrequency: { value: 18.0 },
      uDilationProgress: { value: 0.0 },
      uFocalSpotCenter: { value: new THREE.Vector3(0, 0, 0) },
      uCameraPosition: { value: new THREE.Vector3() },
      uEndothelialColor: { value: new THREE.Color(0xbf1b44) },
      uClaudin5TightColor: { value: new THREE.Color(0x00e676) },
      uDilatedJunctionColor: { value: new THREE.Color(0xffd600) },
      uAstrocyteEndFeetColor: { value: new THREE.Color(0x1976d2) },
    };

    const capMat = new THREE.ShaderMaterial({
      vertexShader: BBB_CAPILLARY_VERTEX_SHADER,
      fragmentShader: BBB_CAPILLARY_FRAGMENT_SHADER,
      uniforms: this.capillaryUniforms,
      transparent: true,
      side: THREE.DoubleSide,
    });
    this.capillaryMesh = new THREE.Mesh(capGeom, capMat);
    this.group.add(this.capillaryMesh);

    // Microbubble Core in center of vessel
    const bubbleGeom = new THREE.SphereGeometry(0.35, 32, 32);
    const bubbleMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      wireframe: true,
      transparent: true,
      opacity: 0.85,
    });
    this.microbubbleMesh = new THREE.Mesh(bubbleGeom, bubbleMat);
    this.group.add(this.microbubbleMesh);

    // Nanobot Streaming Points
    const nanoCount = 800;
    const nanoGeom = new THREE.BufferGeometry();
    const nanoInitPos = new Float32Array(nanoCount * 3);
    const nanoTargetTumor = new Float32Array(nanoCount * 3);
    const nanoSeeds = new Float32Array(nanoCount);

    for (let i = 0; i < nanoCount; i++) {
      const r = Math.random() * 0.8;
      const th = Math.random() * Math.PI * 2;
      nanoInitPos[i * 3] = r * Math.cos(th);
      nanoInitPos[i * 3 + 1] = r * Math.sin(th);
      nanoInitPos[i * 3 + 2] = (Math.random() - 0.5) * 6.0;

      // Target outside capillary into GBM parenchyma
      const tumorDir = new THREE.Vector3(Math.cos(th), Math.sin(th), 0).multiplyScalar(2.4 + Math.random() * 0.8);
      nanoTargetTumor[i * 3] = tumorDir.x;
      nanoTargetTumor[i * 3 + 1] = tumorDir.y;
      nanoTargetTumor[i * 3 + 2] = nanoInitPos[i * 3 + 2] + (Math.random() - 0.5) * 1.5;

      nanoSeeds[i] = Math.random();
    }

    nanoGeom.setAttribute('aInitialPosition', new THREE.BufferAttribute(nanoInitPos, 3));
    nanoGeom.setAttribute('aTargetTumorPos', new THREE.BufferAttribute(nanoTargetTumor, 3));
    nanoGeom.setAttribute('aParticleSeed', new THREE.BufferAttribute(nanoSeeds, 1));

    this.nanobotUniforms = {
      uTime: { value: 0 },
      uDilationProgress: { value: 0.0 },
      uStreamSpeed: { value: 0.4 },
      uFocalSpotCenter: { value: new THREE.Vector3(0, 0, 0) },
    };

    const nanoMat = new THREE.ShaderMaterial({
      vertexShader: NANOBOT_STREAM_VERTEX_SHADER,
      fragmentShader: NANOBOT_STREAM_FRAGMENT_SHADER,
      uniforms: this.nanobotUniforms,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.nanobotPoints = new THREE.Points(nanoGeom, nanoMat);
    this.group.add(this.nanobotPoints);
  }

  public update(time: number, fusPower: number, dilationProg: number, camera: THREE.Camera) {
    this.capillaryUniforms.uTime.value = time;
    this.capillaryUniforms.uAcousticPressure.value = fusPower;
    this.capillaryUniforms.uDilationProgress.value = dilationProg;
    this.capillaryUniforms.uCameraPosition.value.copy(camera.position);

    this.nanobotUniforms.uTime.value = time;
    this.nanobotUniforms.uDilationProgress.value = dilationProg;

    // Pulsate microbubble
    const bubbleScale = 1.0 + Math.sin(time * 24.0) * 0.35 * fusPower;
    this.microbubbleMesh.scale.setScalar(bubbleScale);
  }
}

// ============================================================================
// 3. Viral Capsid Lamb Resonance Sub-Scene
// ============================================================================
class ViralCapsidShatterSystem {
  public group: THREE.Group;
  private capsidMesh: THREE.Mesh;
  private genomeMesh: THREE.Mesh;

  private capsidUniforms: { [key: string]: THREE.IUniform };
  private genomeUniforms: { [key: string]: THREE.IUniform };

  constructor(triangulationNumber: 1 | 3 | 7 | 13 = 7) {
    this.group = new THREE.Group();

    const detail = triangulationNumber === 13 ? 5 : 4;
    const capsidGeom = new THREE.IcosahedronGeometry(1.6, detail);

    const posCount = capsidGeom.attributes.position.count;
    const capsomerCenters = new Float32Array(posCount * 3);
    const isPentamer = new Float32Array(posCount);
    const shardNormals = new Float32Array(posCount * 3);

    const pos = capsidGeom.attributes.position;
    for (let i = 0; i < posCount; i++) {
      const v = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)).normalize();
      capsomerCenters[i * 3] = v.x; capsomerCenters[i * 3 + 1] = v.y; capsomerCenters[i * 3 + 2] = v.z;
      
      const isPenton = Math.abs(v.y) > 0.85 || (Math.abs(v.x) > 0.75 && Math.abs(v.z) > 0.5) ? 1.0 : 0.0;
      isPentamer[i] = isPenton;

      shardNormals[i * 3] = v.x; shardNormals[i * 3 + 1] = v.y; shardNormals[i * 3 + 2] = v.z;
    }

    capsidGeom.setAttribute('aCapsomerCenter', new THREE.BufferAttribute(capsomerCenters, 3));
    capsidGeom.setAttribute('aIsPentamer', new THREE.BufferAttribute(isPentamer, 1));
    capsidGeom.setAttribute('aShardNormal', new THREE.BufferAttribute(shardNormals, 3));

    this.capsidUniforms = {
      uTime: { value: 0 },
      uAcousticFrequency: { value: 185.0 },
      uLambResonantFreq: { value: 185.0 },
      uAcousticIntensity: { value: 1.0 },
      uShatterProgress: { value: 0.0 },
      uLambModeL: { value: 2 },
      uLambModeM: { value: 2 },
      uCameraPosition: { value: new THREE.Vector3() },
      uHexonColor: { value: new THREE.Color(0x00e5ff) },
      uPentonColor: { value: new THREE.Color(0xff007f) },
      uResonanceStressColor: { value: new THREE.Color(0xffeb3b) },
      uFractureEdgeGlow: { value: new THREE.Color(0x00ffff) },
    };

    const capsidMat = new THREE.ShaderMaterial({
      vertexShader: VIRAL_CAPSID_VERTEX_SHADER,
      fragmentShader: VIRAL_CAPSID_FRAGMENT_SHADER,
      uniforms: this.capsidUniforms,
      transparent: true,
      side: THREE.DoubleSide,
    });
    this.capsidMesh = new THREE.Mesh(capsidGeom, capsidMat);
    this.group.add(this.capsidMesh);

    // Genome Core
    const genomeGeom = new THREE.IcosahedronGeometry(0.85, 3);
    const genomeVecs = new Float32Array(genomeGeom.attributes.position.count * 3);
    for (let i = 0; i < genomeVecs.length; i++) genomeVecs[i] = (Math.random() - 0.5) * 0.4;
    genomeGeom.setAttribute('aGenomeFoldVector', new THREE.BufferAttribute(genomeVecs, 3));

    this.genomeUniforms = {
      uTime: { value: 0 },
      uShatterProgress: { value: 0.0 },
      uGenomeCoreColor: { value: new THREE.Color(0xff0055) },
    };

    const genomeMat = new THREE.ShaderMaterial({
      vertexShader: VIRAL_GENOME_CORE_VERTEX_SHADER,
      fragmentShader: VIRAL_GENOME_CORE_FRAGMENT_SHADER,
      uniforms: this.genomeUniforms,
      transparent: true,
      blending: THREE.AdditiveBlending,
    });
    this.genomeMesh = new THREE.Mesh(genomeGeom, genomeMat);
    this.group.add(this.genomeMesh);
  }

  public setVirus(profile: { lambQuadrupoleHz: number; colorHex: number }) {
    this.capsidUniforms.uLambResonantFreq.value = profile.lambQuadrupoleHz;
    this.capsidUniforms.uAcousticFrequency.value = profile.lambQuadrupoleHz;
    this.capsidUniforms.uHexonColor.value.setHex(profile.colorHex);
  }

  public update(time: number, freq: number, power: number, shatterProg: number, camera: THREE.Camera) {
    this.capsidUniforms.uTime.value = time;
    this.capsidUniforms.uAcousticFrequency.value = freq;
    this.capsidUniforms.uAcousticIntensity.value = power;
    this.capsidUniforms.uShatterProgress.value = shatterProg;
    this.capsidUniforms.uCameraPosition.value.copy(camera.position);

    this.genomeUniforms.uTime.value = time;
    this.genomeUniforms.uShatterProgress.value = shatterProg;
  }
}

// ============================================================================
// 4. Senolytic Clearance Sub-Scene
// ============================================================================
class SenolyticClearanceSystem {
  public group: THREE.Group;
  private senescentCell: THREE.Mesh;
  private healthyCell: THREE.Mesh;
  private saspCloud: THREE.Points;

  private senescentUniforms: { [key: string]: THREE.IUniform };
  private saspUniforms: { [key: string]: THREE.IUniform };

  constructor() {
    this.group = new THREE.Group();

    // Stiff, SASP-secreting Senescent Zombie Cell (Left)
    const senGeom = new THREE.SphereGeometry(1.5, 48, 48);
    this.senescentUniforms = {
      uTime: { value: 0 },
      uAcousticFatigue: { value: 0.0 },
      uApoptosisProgress: { value: 0.0 },
      uAcousticIntensity: { value: 1.0 },
      uAudioBands: { value: new THREE.Vector4() },
      uCameraPosition: { value: new THREE.Vector3() },
      uSaBetaGalColor: { value: new THREE.Color(0x1a237e) }, // Indigo
      uGammaH2AxColor: { value: new THREE.Color(0xd81b60) },  // Magenta
      uMicroCrackColor: { value: new THREE.Color(0x00e5ff) }, // Cyan
      uAnnexinVColor: { value: new THREE.Color(0x00e676) },   // Apoptotic Emerald
    };

    const senMat = new THREE.ShaderMaterial({
      vertexShader: SENESCENT_CELL_VERTEX_SHADER,
      fragmentShader: SENESCENT_CELL_FRAGMENT_SHADER,
      uniforms: this.senescentUniforms,
      transparent: true,
    });
    this.senescentCell = new THREE.Mesh(senGeom, senMat);
    this.senescentCell.position.set(-1.8, 0, 0);
    this.group.add(this.senescentCell);

    // Compliant Young Healthy Control Cell (Right)
    const healGeom = new THREE.SphereGeometry(0.9, 32, 32);
    const healMat = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      wireframe: true,
      transparent: true,
      opacity: 0.65,
    });
    this.healthyCell = new THREE.Mesh(healGeom, healMat);
    this.healthyCell.position.set(1.8, 0, 0);
    this.group.add(this.healthyCell);

    // SASP Cytokine Plume Particles
    const saspCount = 1200;
    const saspGeom = new THREE.BufferGeometry();
    const saspPos = new Float32Array(saspCount * 3);
    const saspVel = new Float32Array(saspCount * 3);
    const saspSeeds = new Float32Array(saspCount);

    for (let i = 0; i < saspCount; i++) {
      saspPos[i * 3] = -1.8 + (Math.random() - 0.5) * 0.5;
      saspPos[i * 3 + 1] = (Math.random() - 0.5) * 0.5;
      saspPos[i * 3 + 2] = (Math.random() - 0.5) * 0.5;

      const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
      saspVel[i * 3] = dir.x * 0.6;
      saspVel[i * 3 + 1] = dir.y * 0.6;
      saspVel[i * 3 + 2] = dir.z * 0.6;

      saspSeeds[i] = Math.random();
    }

    saspGeom.setAttribute('position', new THREE.BufferAttribute(saspPos, 3));
    saspGeom.setAttribute('aInitialVelocity', new THREE.BufferAttribute(saspVel, 3));
    saspGeom.setAttribute('aParticleSeed', new THREE.BufferAttribute(saspSeeds, 1));

    this.saspUniforms = {
      uTime: { value: 0 },
      uSaspSecretionRate: { value: 1.0 },
      uApoptosisProgress: { value: 0.0 },
    };

    const saspMat = new THREE.ShaderMaterial({
      vertexShader: SASP_HAZE_VERTEX_SHADER,
      fragmentShader: SASP_HAZE_FRAGMENT_SHADER,
      uniforms: this.saspUniforms,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.saspCloud = new THREE.Points(saspGeom, saspMat);
    this.group.add(this.saspCloud);
  }

  public update(time: number, intensity: number, apoptosisProg: number, camera: THREE.Camera, audioBands: THREE.Vector4) {
    this.senescentUniforms.uTime.value = time;
    this.senescentUniforms.uAcousticFatigue.value = Math.min(intensity * 0.8 + apoptosisProg * 0.5, 1.0);
    this.senescentUniforms.uApoptosisProgress.value = apoptosisProg;
    this.senescentUniforms.uAcousticIntensity.value = intensity;
    this.senescentUniforms.uCameraPosition.value.copy(camera.position);
    this.senescentUniforms.uAudioBands.value.copy(audioBands);

    this.saspUniforms.uTime.value = time;
    this.saspUniforms.uApoptosisProgress.value = apoptosisProg;

    // Healthy cell breathes mildly without damage
    const healScale = 0.9 + Math.sin(time * 3.0) * 0.04;
    this.healthyCell.scale.setScalar(healScale);
  }
}

// ============================================================================
// Master NobelDiscoveryLab Orchestrator
// ============================================================================
export class NobelDiscoveryLab {
  public group: THREE.Group;

  public mechanogenomics: ChromatinMechanogenomicsSystem;
  public bbbCavitation: BbbCavitationSystem;
  public viralCapsid: ViralCapsidShatterSystem;
  public senolytic: SenolyticClearanceSystem;

  private lightsGroup: THREE.Group;
  private currentFrontier: NobelFrontierId = 'mechanogenomics';

  // Internal State
  public state: NobelLabState = {
    frontierId: 'mechanogenomics',
    acousticPressureKPa: 120.0,
    frequencyHz: 185.0,
    isP53TranscriptionActive: false,
    unfurlingProgress: 0.0,
    fusPowerMPa: 0.6,
    microbubbleRadiusUm: 2.5,
    isNanomedicineFlowing: false,
    bbbDilationProgress: 0.0,
    selectedVirusId: 'hiv-1',
    viralAcousticPower: 1.0,
    isLambResonanceLocked: true,
    viralShatterProgress: 0.0,
    shockwaveIntensity: 1.2,
    isSenolyticPulseActive: false,
    senolyticApoptosisProgress: 0.0,
  };

  private currentP53 = 4.5; // nM

  constructor() {
    this.group = new THREE.Group();
    this.group.visible = false;

    // 1. Stage Lighting
    this.lightsGroup = new THREE.Group();
    const cyanLight = new THREE.PointLight(0x00e5ff, 0.7, 18);
    cyanLight.position.set(-4, 3, 4);
    this.lightsGroup.add(cyanLight);

    const goldLight = new THREE.PointLight(0xffd700, 0.8, 18);
    goldLight.position.set(4, 3, 4);
    this.lightsGroup.add(goldLight);
    this.group.add(this.lightsGroup);

    // 2. Sub-Scenes
    this.mechanogenomics = new ChromatinMechanogenomicsSystem();
    this.bbbCavitation = new BbbCavitationSystem();
    this.viralCapsid = new ViralCapsidShatterSystem();
    this.senolytic = new SenolyticClearanceSystem();

    this.group.add(this.mechanogenomics.group);
    this.group.add(this.bbbCavitation.group);
    this.group.add(this.viralCapsid.group);
    this.group.add(this.senolytic.group);

    this.setFrontier('mechanogenomics');
  }

  public setVisible(visible: boolean) {
    this.group.visible = visible;
  }

  public setFrontier(frontierId: NobelFrontierId) {
    this.currentFrontier = frontierId;
    this.state.frontierId = frontierId;

    this.mechanogenomics.group.visible = frontierId === 'mechanogenomics';
    this.bbbCavitation.group.visible = frontierId === 'bbb-dilation';
    this.viralCapsid.group.visible = frontierId === 'viral-shatter';
    this.senolytic.group.visible = frontierId === 'senolytic-clearance';
  }

  public setVirus(virusId: string) {
    this.state.selectedVirusId = virusId;
    const prof = NobelBiophysics.VIRUS_PROFILES[virusId] || NobelBiophysics.VIRUS_PROFILES['hiv-1'];
    this.state.frequencyHz = prof.lambQuadrupoleHz;
    this.viralCapsid.setVirus(prof);
  }

  public getTelemetry(): NobelTelemetry {
    const dt = 0.016;
    const mech = NobelBiophysics.calculateMechanogenomics(
      this.state.acousticPressureKPa,
      this.state.unfurlingProgress,
      dt,
      this.currentP53
    );
    this.currentP53 = mech.p53ProteinConcentrationNM;

    const bbb = NobelBiophysics.calculateBbbDilation(
      this.state.fusPowerMPa,
      this.state.microbubbleRadiusUm,
      this.state.bbbDilationProgress
    );

    const viral = NobelBiophysics.calculateViralShatter(
      this.state.selectedVirusId,
      this.state.frequencyHz,
      this.state.viralAcousticPower,
      this.state.viralShatterProgress
    );

    const seno = NobelBiophysics.calculateSenolyticClearance(
      this.state.shockwaveIntensity,
      this.state.senolyticApoptosisProgress
    );

    return {
      ...mech,
      ...bbb,
      ...viral,
      ...seno,
    };
  }

  public update(time: number, dt: number, camera: THREE.Camera, audioBands: THREE.Vector4) {
    if (!this.group.visible) return;

    // Smooth animation transitions for active experiments
    if (this.state.isP53TranscriptionActive) {
      this.state.unfurlingProgress = Math.min(this.state.unfurlingProgress + dt * 0.45, 1.0);
    } else {
      this.state.unfurlingProgress = Math.max(this.state.unfurlingProgress - dt * 0.3, 0.0);
    }

    if (this.state.isNanomedicineFlowing) {
      this.state.bbbDilationProgress = Math.min(this.state.bbbDilationProgress + dt * 0.5, 1.0);
    } else {
      this.state.bbbDilationProgress = Math.max(this.state.bbbDilationProgress - dt * 0.35, 0.0);
    }

    if (this.state.isLambResonanceLocked) {
      this.state.viralShatterProgress = Math.min(this.state.viralShatterProgress + dt * 0.4, 1.0);
    } else {
      this.state.viralShatterProgress = Math.max(this.state.viralShatterProgress - dt * 0.4, 0.0);
    }

    if (this.state.isSenolyticPulseActive) {
      this.state.senolyticApoptosisProgress = Math.min(this.state.senolyticApoptosisProgress + dt * 0.45, 1.0);
    } else {
      this.state.senolyticApoptosisProgress = Math.max(this.state.senolyticApoptosisProgress - dt * 0.3, 0.0);
    }

    // Update active sub-scene
    switch (this.currentFrontier) {
      case 'mechanogenomics':
        this.mechanogenomics.update(
          time,
          this.state.acousticPressureKPa / 150.0,
          this.state.unfurlingProgress,
          camera,
          audioBands
        );
        break;
      case 'bbb-dilation':
        this.bbbCavitation.update(
          time,
          this.state.fusPowerMPa,
          this.state.bbbDilationProgress,
          camera
        );
        break;
      case 'viral-shatter':
        this.viralCapsid.update(
          time,
          this.state.frequencyHz,
          this.state.viralAcousticPower,
          this.state.viralShatterProgress,
          camera
        );
        break;
      case 'senolytic-clearance':
        this.senolytic.update(
          time,
          this.state.shockwaveIntensity,
          this.state.senolyticApoptosisProgress,
          camera,
          audioBands
        );
        break;
    }
  }
}
