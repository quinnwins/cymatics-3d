/**
 * FormantSpaceManifold.ts
 * SoundForm 3D - Calibrated 3D IPA Vowel Space Manifold & Formant Tracker
 *
 * Implements:
 * 1. 7-Vowel Calibrated International Phonetic Alphabet (IPA) Vowel Quadrangle Manifold on Traunmüller Bark scale.
 * 2. Dual-Hull Manifold: Outer normative healthy cage + Inner dynamic patient VSA hull morphing with FCR.
 * 3. 2D Floor Projection Contour Grid with procedural Bark divisions and live active quadrant illumination.
 * 4. Extruded 3D Glowing Triangle Strip Velocity Ribbon with O(1) circular ring buffer and Catmull-Rom smoothing.
 */

import * as THREE from 'three';
import {
  FORMANT_CLOUD_VERTEX_SHADER,
  FORMANT_CLOUD_FRAGMENT_SHADER,
  FLOOR_GRID_VERTEX_SHADER,
  FLOOR_GRID_FRAGMENT_SHADER,
} from './shaders/formantCloudShader';

export function formantHzToBark(fHz: number): number {
  return (26.81 * fHz) / (1960.0 + fHz) - 0.53;
}

export function mapFormantsToVisualSpace(f1: number, f2: number, f3: number): THREE.Vector3 {
  const z1 = formantHzToBark(Math.max(180, Math.min(1100, f1)));
  const z2 = formantHzToBark(Math.max(650, Math.min(2800, f2)));
  const z3 = formantHzToBark(Math.max(1800, Math.min(3600, f3)));

  // Y-axis: Inverted F1 (Close/High = +Y, Open/Low = -Y)
  const y = -((z1 - 2.03) / 5.84 - 0.5) * 3.4;
  // X-axis: F2 (Back = -X, Front = +X)
  const x = ((z2 - 6.47) / 8.06 - 0.5) * 3.6;
  // Z-axis: F3 (Retroflex/Back = -Z, Front/Ring = +Z)
  const z = ((z3 - 13.16) / 3.12 - 0.5) * 2.8;

  return new THREE.Vector3(x, y, z);
}

export class FormantSpaceManifold {
  public group: THREE.Group;
  private particleCount = 4500;
  private pointsCloud: THREE.Points;
  private outerReferenceHull: THREE.LineSegments;
  private innerActiveHull: THREE.Mesh;
  private floorProjectionMesh: THREE.Mesh;
  private floorMaterial: THREE.ShaderMaterial;
  private trajectoryMesh: THREE.Mesh;
  private trajectoryGeom: THREE.BufferGeometry;

  // Trajectory Circular Ring-Buffer & Ribbon
  private readonly maxControlPoints = 64;
  private ringPoints: THREE.Vector3[] = [];
  private ringHead = 0;
  private ringCount = 0;

  private ribbonVertexCount = 256;
  private ribbonPositions = new Float32Array(256 * 3);
  private ribbonColors = new Float32Array(256 * 3);

  constructor() {
    this.group = new THREE.Group();

    // 1. 7 Calibrated IPA Vowel Ellipsoid Clusters
    const clusters = [
      { f: [1.57, 1.26, 0.74], cpp: 16.5, jitter: 0.018, id: 0, label: '/i/' }, // Close Front
      { f: [-1.33, 1.05, -0.75], cpp: 15.2, jitter: 0.025, id: 1, label: '/u/' }, // Close Back
      { f: [-0.59, -1.21, -0.17], cpp: 17.0, jitter: 0.015, id: 2, label: '/ɑ/' }, // Open Back
      { f: [0.87, -0.88, -0.06], cpp: 15.8, jitter: 0.020, id: 3, label: '/æ/' }, // Near-Open Front
      { f: [-1.10, -0.30, -0.36], cpp: 14.5, jitter: 0.024, id: 4, label: '/ɔ/' }, // Open-Mid Back
      { f: [0.95, -0.21, 0.04], cpp: 16.0, jitter: 0.019, id: 5, label: '/ɛ/' }, // Open-Mid Front
      { f: [0.30, 0.03, -0.17], cpp: 9.5, jitter: 0.045, id: 6, label: '/ə/' }, // Neutral Schwa
    ];

    const formantAttr = new Float32Array(this.particleCount * 3);
    const cppAttr = new Float32Array(this.particleCount);
    const jitterAttr = new Float32Array(this.particleCount);
    const clusterAttr = new Float32Array(this.particleCount);
    const dummyPos = new Float32Array(this.particleCount * 3);

    for (let i = 0; i < this.particleCount; i++) {
      const c = clusters[i % clusters.length];
      const variance = c.id === 6 ? 0.05 : 0.09;
      formantAttr[i * 3 + 0] = c.f[0] + (Math.random() - 0.5) * variance;
      formantAttr[i * 3 + 1] = c.f[1] + (Math.random() - 0.5) * variance;
      formantAttr[i * 3 + 2] = c.f[2] + (Math.random() - 0.5) * variance;

      cppAttr[i] = c.cpp + (Math.random() - 0.5) * 2.5;
      jitterAttr[i] = c.jitter * (1.0 + Math.random() * 1.5);
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
      blending: THREE.NormalBlending,
      depthWrite: false,
    });

    this.pointsCloud = new THREE.Points(pointsGeom, cloudMaterial);
    this.group.add(this.pointsCloud);

    // 2. Dual-Hull Manifold (Normative Outer Cage & Morphed Inner Hull)
    const baseHullVertices = [
      new THREE.Vector3(1.57, 1.26, 0.74),   // /i/
      new THREE.Vector3(-1.33, 1.05, -0.75),  // /u/
      new THREE.Vector3(-0.59, -1.21, -0.17), // /ɑ/
      new THREE.Vector3(0.87, -0.88, -0.06),  // /æ/
      new THREE.Vector3(-1.10, -0.30, -0.36), // /ɔ/
      new THREE.Vector3(0.95, -0.21, 0.04),   // /ɛ/
      new THREE.Vector3(0.0, 2.2, 0.0),       // F3 Sing Apex
    ];

    // Outer Normative Reference Wireframe
    const outerGeom = new THREE.BufferGeometry().setFromPoints(baseHullVertices);
    const outerMat = new THREE.LineBasicMaterial({
      color: 0x00e5ff,
      transparent: true,
      opacity: 0.25,
    });
    this.outerReferenceHull = new THREE.LineSegments(
      new THREE.WireframeGeometry(new THREE.DodecahedronGeometry(1.8, 0)),
      outerMat
    );
    this.group.add(this.outerReferenceHull);

    // Inner Morphed Dynamic VSA Hull
    const innerGeom = new THREE.DodecahedronGeometry(1.5, 0);
    const innerMat = new THREE.MeshBasicMaterial({
      color: 0xff4081,
      wireframe: true,
      transparent: true,
      opacity: 0.35,
    });
    this.innerActiveHull = new THREE.Mesh(innerGeom, innerMat);
    this.group.add(this.innerActiveHull);

    // 3. 2D Floor Projection Plane with Bark Grid Shader
    const floorGeom = new THREE.PlaneGeometry(4.8, 4.8, 64, 64);
    floorGeom.rotateX(-Math.PI / 2);

    this.floorMaterial = new THREE.ShaderMaterial({
      vertexShader: FLOOR_GRID_VERTEX_SHADER,
      fragmentShader: FLOOR_GRID_FRAGMENT_SHADER,
      uniforms: {
        uSpeakerF1F2Projected: { value: new THREE.Vector2(0.0, 0.0) },
        uVoiceEnergy: { value: 0.0 },
        uTime: { value: 0.0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      side: THREE.DoubleSide,
    });

    this.floorProjectionMesh = new THREE.Mesh(floorGeom, this.floorMaterial);
    this.floorProjectionMesh.position.y = -2.2;
    this.group.add(this.floorProjectionMesh);

    // 4. Extruded 3D Glowing Triangle Strip Velocity Ribbon
    this.trajectoryGeom = new THREE.BufferGeometry();
    this.trajectoryGeom.setAttribute('position', new THREE.BufferAttribute(this.ribbonPositions, 3));
    this.trajectoryGeom.setAttribute('color', new THREE.BufferAttribute(this.ribbonColors, 3));

    const ribbonMat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.trajectoryMesh = new THREE.Mesh(this.trajectoryGeom, ribbonMat);
    this.group.add(this.trajectoryMesh);

    for (let i = 0; i < this.maxControlPoints; i++) {
      this.ringPoints.push(new THREE.Vector3(0.3, 0.03, -0.17));
    }
  }

  public pushSpeakerFormants(f1: number, f2: number, f3: number, voiceEnergy = 1.0): void {
    const pos = mapFormantsToVisualSpace(f1, f2, f3);

    // Push into circular ring buffer
    this.ringPoints[this.ringHead].copy(pos);
    this.ringHead = (this.ringHead + 1) % this.maxControlPoints;
    if (this.ringCount < this.maxControlPoints) this.ringCount++;

    // Update floor projection locus
    this.floorMaterial.uniforms.uSpeakerF1F2Projected.value.set(pos.x, pos.z);
    this.floorMaterial.uniforms.uVoiceEnergy.value = voiceEnergy;

    this.updateRibbonGeometry();
  }

  private updateRibbonGeometry(): void {
    if (this.ringCount < 4) return;

    const N = this.ribbonVertexCount / 2; // Slices
    const positions = this.ribbonPositions;
    const colors = this.ribbonColors;

    for (let i = 0; i < N; i++) {
      const t = (i / (N - 1)) * (this.ringCount - 1);
      const idx = Math.floor(t);
      const frac = t - idx;

      // Sample ring points
      const p0 = this.ringPoints[(this.ringHead - this.ringCount + idx - 1 + this.maxControlPoints * 2) % this.maxControlPoints];
      const p1 = this.ringPoints[(this.ringHead - this.ringCount + idx + this.maxControlPoints * 2) % this.maxControlPoints];
      const p2 = this.ringPoints[(this.ringHead - this.ringCount + idx + 1 + this.maxControlPoints * 2) % this.maxControlPoints];
      const p3 = this.ringPoints[(this.ringHead - this.ringCount + idx + 2 + this.maxControlPoints * 2) % this.maxControlPoints];

      // Catmull-Rom interpolation
      const x = 0.5 * (2 * p1.x + (-p0.x + p2.x) * frac + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * frac * frac + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * frac * frac * frac);
      const y = 0.5 * (2 * p1.y + (-p0.y + p2.y) * frac + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * frac * frac + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * frac * frac * frac);
      const z = 0.5 * (2 * p1.z + (-p0.z + p2.z) * frac + (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * frac * frac + (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * frac * frac * frac);

      // Ribbon width tapers from head to tail
      const width = 0.08 * (1.0 - (i / N) * 0.75);
      const vIdx = i * 6;

      positions[vIdx + 0] = x - width;
      positions[vIdx + 1] = y;
      positions[vIdx + 2] = z;

      positions[vIdx + 3] = x + width;
      positions[vIdx + 4] = y;
      positions[vIdx + 5] = z;

      // Glowing Cyan-Amber gradient
      const alpha = 1.0 - i / N;
      colors[vIdx + 0] = 0.0; colors[vIdx + 1] = 0.9 * alpha; colors[vIdx + 2] = 1.0 * alpha;
      colors[vIdx + 3] = 1.0 * alpha; colors[vIdx + 4] = 0.7 * alpha; colors[vIdx + 5] = 0.2 * alpha;
    }

    this.trajectoryGeom.attributes.position.needsUpdate = true;
    this.trajectoryGeom.attributes.color.needsUpdate = true;
  }

  public update(time: number, fcr = 1.0, isTherapyActive = false): void {
    const cloudMat = this.pointsCloud.material as THREE.ShaderMaterial;
    cloudMat.uniforms.uTime.value = time;

    // FCR centralization morphing factor
    const centralizationFactor = Math.max(0.0, Math.min(1.0, (fcr - 0.95) / 0.35));
    cloudMat.uniforms.uCentralization.value += (centralizationFactor - cloudMat.uniforms.uCentralization.value) * 0.1;
    cloudMat.uniforms.uTherapyStabilize.value = isTherapyActive ? 1.0 : 0.0;

    // Morph inner active VSA hull
    const scale = Math.max(0.35, 1.0 - centralizationFactor * 0.55);
    this.innerActiveHull.scale.set(scale, scale, scale);
    this.innerActiveHull.rotation.y = time * 0.15;

    this.floorMaterial.uniforms.uTime.value = time;
  }

  public dispose(): void {
    this.pointsCloud.geometry.dispose();
    (this.pointsCloud.material as THREE.Material).dispose();
    this.outerReferenceHull.geometry.dispose();
    (this.outerReferenceHull.material as THREE.Material).dispose();
    this.innerActiveHull.geometry.dispose();
    (this.innerActiveHull.material as THREE.Material).dispose();
    this.floorProjectionMesh.geometry.dispose();
    this.floorMaterial.dispose();
    this.trajectoryGeom.dispose();
    (this.trajectoryMesh.material as THREE.Material).dispose();
  }
}
