/**
 * FormantSpaceManifold.ts
 * SoundForm 3D - 3D Formant Trajectory & Vowel Space Controller
 */

import * as THREE from 'three';
import {
  FORMANT_CLOUD_VERTEX_SHADER,
  FORMANT_CLOUD_FRAGMENT_SHADER,
  FORMANT_HULL_VERTEX_SHADER,
  FORMANT_HULL_FRAGMENT_SHADER,
} from './shaders/formantCloudShader';

export class FormantSpaceManifold {
  public group: THREE.Group;
  private particleCount = 15000;
  private pointsCloud: THREE.Points;
  private healthyHullMesh: THREE.Mesh;
  private pathologicalHullMesh: THREE.Mesh;
  private trajectoryLine: THREE.Line;
  private trajectoryPositions: Float32Array;
  private maxTrajectoryPoints = 256;
  private pointsInitialized = false;

  constructor() {
    this.group = new THREE.Group();

    // 1. Point Cloud Formant Sprites
    const formantAttr = new Float32Array(this.particleCount * 3);
    const cppAttr = new Float32Array(this.particleCount);
    const jitterAttr = new Float32Array(this.particleCount);
    const clusterAttr = new Float32Array(this.particleCount);
    const dummyPos = new Float32Array(this.particleCount * 3);

    const clusters = [
      { f: [0.15, 0.85, 0.75], cpp: 16.5, jitter: 0.02, id: 0 }, // /i/
      { f: [0.18, 0.22, 0.45], cpp: 14.8, jitter: 0.03, id: 1 }, // /u/
      { f: [0.82, 0.35, 0.55], cpp: 17.0, jitter: 0.015, id: 2 }, // /a/
      { f: [0.50, 0.50, 0.50], cpp: 9.2,  jitter: 0.06,  id: 3 }, // Schwa /ə/
    ];

    for (let i = 0; i < this.particleCount; i++) {
      const c = clusters[i % 4];
      const variance = 0.09;
      formantAttr[i * 3 + 0] = c.f[0] + (Math.random() - 0.5) * variance;
      formantAttr[i * 3 + 1] = c.f[1] + (Math.random() - 0.5) * variance;
      formantAttr[i * 3 + 2] = c.f[2] + (Math.random() - 0.5) * variance;

      cppAttr[i] = c.cpp + (Math.random() - 0.5) * 3.5;
      jitterAttr[i] = c.jitter * (1.0 + Math.random() * 2.0);
      clusterAttr[i] = c.id;
    }

    const pointsGeom = new THREE.BufferGeometry();
    pointsGeom.setAttribute('position', new THREE.BufferAttribute(dummyPos, 3));
    pointsGeom.setAttribute('aInstanceFormant', new THREE.BufferAttribute(formantAttr, 3));
    pointsGeom.setAttribute('aInstanceCPP', new THREE.BufferAttribute(cppAttr, 1));
    pointsGeom.setAttribute('aInstanceJitter', new THREE.BufferAttribute(jitterAttr, 1));
    pointsGeom.setAttribute('aInstanceCluster', new THREE.BufferAttribute(clusterAttr, 1));

    const cloudMaterial = new THREE.ShaderMaterial({
      vertexShader: FORMANT_CLOUD_VERTEX_SHADER,
      fragmentShader: FORMANT_CLOUD_FRAGMENT_SHADER,
      uniforms: {
        uTime: { value: 0 },
        uCentralization: { value: 0.0 },
        uTherapyStabilize: { value: 0.0 },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.pointsCloud = new THREE.Points(pointsGeom, cloudMaterial);
    this.group.add(this.pointsCloud);

    // 2. Healthy Vowel Triangle Tetrahedron Wireframe Hull
    const healthyHullGeom = new THREE.ConeGeometry(3.2, 4.2, 3, 1);
    const hullMat = new THREE.ShaderMaterial({
      vertexShader: FORMANT_HULL_VERTEX_SHADER,
      fragmentShader: FORMANT_HULL_FRAGMENT_SHADER,
      uniforms: {
        uTime: { value: 0 },
        uIsPathological: { value: 0.0 },
        uPulsingWarning: { value: 0.0 },
        uCameraPosition: { value: new THREE.Vector3() },
      },
      transparent: true,
      wireframe: true,
      side: THREE.DoubleSide,
    });
    this.healthyHullMesh = new THREE.Mesh(healthyHullGeom, hullMat);
    this.healthyHullMesh.position.set(0, 0, 0);
    this.group.add(this.healthyHullMesh);

    // 3. Pathological Centralization Sphere Hull
    const pathGeom = new THREE.SphereGeometry(1.2, 16, 12);
    const pathMat = hullMat.clone();
    pathMat.uniforms.uIsPathological.value = 1.0;
    pathMat.uniforms.uPulsingWarning.value = 1.0;
    this.pathologicalHullMesh = new THREE.Mesh(pathGeom, pathMat);
    this.pathologicalHullMesh.visible = false;
    this.group.add(this.pathologicalHullMesh);

    // 4. Live Trajectory Streamline
    this.trajectoryPositions = new Float32Array(this.maxTrajectoryPoints * 3);
    const trajGeom = new THREE.BufferGeometry();
    trajGeom.setAttribute('position', new THREE.BufferAttribute(this.trajectoryPositions, 3));
    const trajMat = new THREE.LineBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
    });
    this.trajectoryLine = new THREE.Line(trajGeom, trajMat);
    this.group.add(this.trajectoryLine);
  }

  public update(
    time: number,
    camera: THREE.Camera,
    fcr: number,
    therapyCoherence: number,
    f1: number,
    f2: number,
    f3: number
  ): void {
    const isPathological = fcr > 1.20 ? 1.0 : 0.0;
    const centralizationNorm = Math.max(0.0, Math.min(1.0, (fcr - 0.9) / 0.45));

    const cloudMat = this.pointsCloud.material as THREE.ShaderMaterial;
    cloudMat.uniforms.uTime.value = time;
    cloudMat.uniforms.uCentralization.value = centralizationNorm;
    cloudMat.uniforms.uTherapyStabilize.value = therapyCoherence;

    const healthyMat = this.healthyHullMesh.material as THREE.ShaderMaterial;
    healthyMat.uniforms.uTime.value = time;
    healthyMat.uniforms.uCameraPosition.value.copy(camera.position);

    const pathMat = this.pathologicalHullMesh.material as THREE.ShaderMaterial;
    pathMat.uniforms.uTime.value = time;
    pathMat.uniforms.uCameraPosition.value.copy(camera.position);
    pathMat.uniforms.uPulsingWarning.value = isPathological;
    this.pathologicalHullMesh.visible = isPathological > 0.5;

    // Update real-time trajectory coordinate (scaled to match cloud 5.5 multiplier)
    const normX = ((Math.min(1100, Math.max(200, f1)) - 200) / 900 - 0.5) * 5.5;
    const normY = ((Math.min(2800, Math.max(800, f2)) - 800) / 2000 - 0.5) * 5.5;
    const normZ = ((Math.min(3600, Math.max(2000, f3)) - 2000) / 1600 - 0.5) * 5.5;

    if (!this.pointsInitialized) {
      this.pointsInitialized = true;
      for (let i = 0; i < this.maxTrajectoryPoints; i++) {
        this.trajectoryPositions[i * 3 + 0] = normX;
        this.trajectoryPositions[i * 3 + 1] = normY;
        this.trajectoryPositions[i * 3 + 2] = normZ;
      }
    } else {
      // Shift FIFO buffer smoothly
      for (let i = (this.maxTrajectoryPoints - 1) * 3; i >= 3; i--) {
        this.trajectoryPositions[i] = this.trajectoryPositions[i - 3];
      }
      this.trajectoryPositions[0] = normX;
      this.trajectoryPositions[1] = normY;
      this.trajectoryPositions[2] = normZ;
    }

    this.trajectoryLine.geometry.attributes.position.needsUpdate = true;
    this.group.rotation.y = time * 0.08;
  }

  public dispose(): void {
    this.pointsCloud.geometry.dispose();
    (this.pointsCloud.material as THREE.Material).dispose();
    this.healthyHullMesh.geometry.dispose();
    (this.healthyHullMesh.material as THREE.Material).dispose();
    this.pathologicalHullMesh.geometry.dispose();
    (this.pathologicalHullMesh.material as THREE.Material).dispose();
    this.trajectoryLine.geometry.dispose();
    (this.trajectoryLine.material as THREE.Material).dispose();
  }
}
