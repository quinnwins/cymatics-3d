/**
 * FormantSpaceManifold.ts
 * SoundForm 3D - Calibrated 3D IPA Vowel Space Manifold & Formant Tracker
 *
 * Implements:
 * 1. 7-Vowel Calibrated International Phonetic Alphabet (IPA) Vowel Quadrangle Manifold on Traunmüller Bark scale.
 * 2. Sleek, circular glowing Vowel Target Badges (/EE/, /OO/, /AH/, /AE/, etc.) with depth-tested perspective rendering.
 * 3. Responsive glowing Live Voice Cursor Sphere tracking the speaker's active formant coordinates.
 * 4. Dual-Hull Manifold: Outer normative healthy cage + Inner dynamic patient VSA hull morphing with FCR.
 * 5. 2D Floor Projection Contour Grid with procedural Bark divisions.
 * 6. Extruded 3D Glowing Triangle Strip Velocity Ribbon.
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
  const y = -((z1 - 2.03) / 5.84 - 0.5) * 3.0;
  // X-axis: F2 (Back = -X, Front = +X)
  const x = ((z2 - 6.47) / 8.06 - 0.5) * 3.2;
  // Z-axis: F3 (Retroflex/Back = -Z, Front/Ring = +Z)
  const z = ((z3 - 13.16) / 3.12 - 0.5) * 2.4;

  return new THREE.Vector3(x, y, z);
}

export interface VowelTargetDef {
  symbol: string;
  name: string;
  wordHint: string;
  f: [number, number, number];
  color: number;
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

  // Vowel Target Badges & Sprites
  private vowelDiscsGroup: THREE.Group;
  private liveCursorMesh: THREE.Mesh;
  private liveCursorGlow: THREE.Sprite;
  private currentCursorPos = new THREE.Vector3(0.3, 0.03, -0.17);
  private targetCursorPos = new THREE.Vector3(0.3, 0.03, -0.17);

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
    this.vowelDiscsGroup = new THREE.Group();

    // 1. 7 Calibrated IPA Vowel Targets
    const vowelDefs: VowelTargetDef[] = [
      { symbol: '/i/',  name: 'EE', wordHint: 'See',    f: [1.45,  1.15,  0.65], color: 0x00e5ff }, // Close Front
      { symbol: '/u/',  name: 'OO', wordHint: 'Moon',   f: [-1.25, 0.95, -0.65], color: 0xa855f7 }, // Close Back
      { symbol: '/ɑ/',  name: 'AH', wordHint: 'Father', f: [-0.55, -1.10, -0.15], color: 0xf59e0b }, // Open Back
      { symbol: '/æ/',  name: 'AE', wordHint: 'Cat',    f: [0.80, -0.80, -0.05], color: 0x10b981 }, // Near-Open Front
      { symbol: '/ɔ/',  name: 'AW', wordHint: 'Law',    f: [-1.00, -0.25, -0.30], color: 0xf97316 }, // Open-Mid Back
      { symbol: '/ɛ/',  name: 'EH', wordHint: 'Bed',    f: [0.85, -0.20,  0.03], color: 0x38bdf8 }, // Open-Mid Front
      { symbol: '/ə/',  name: 'UH', wordHint: 'Schwa',  f: [0.25,  0.02, -0.15], color: 0xf43f5e }, // Center Neutral
    ];

    // Build Minimal Circular Vowel Target Badges
    vowelDefs.forEach((vd) => {
      this.createVowelTargetBadge(vd);
    });
    this.group.add(this.vowelDiscsGroup);

    // 2. Formant Point Cloud
    const formantAttr = new Float32Array(this.particleCount * 3);
    const cppAttr = new Float32Array(this.particleCount);
    const jitterAttr = new Float32Array(this.particleCount);
    const clusterAttr = new Float32Array(this.particleCount);
    const dummyPos = new Float32Array(this.particleCount * 3);

    for (let i = 0; i < this.particleCount; i++) {
      const c = vowelDefs[i % vowelDefs.length];
      const variance = c.name === 'UH' ? 0.04 : 0.08;
      formantAttr[i * 3 + 0] = c.f[0] + (Math.random() - 0.5) * variance;
      formantAttr[i * 3 + 1] = c.f[1] + (Math.random() - 0.5) * variance;
      formantAttr[i * 3 + 2] = c.f[2] + (Math.random() - 0.5) * variance;

      cppAttr[i] = c.name === 'UH' ? 9.5 : 16.0 + (Math.random() - 0.5) * 2.5;
      jitterAttr[i] = (c.name === 'UH' ? 0.045 : 0.02) * (1.0 + Math.random() * 1.5);
      clusterAttr[i] = i % vowelDefs.length;
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

    // 3. Live Voice Target Cursor (Golden/Cyan Glowing Orb tracking your voice)
    const cursorGeom = new THREE.SphereGeometry(0.14, 24, 24);
    const cursorMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x38bdf8,
      emissiveIntensity: 1.4,
      roughness: 0.1,
    });
    this.liveCursorMesh = new THREE.Mesh(cursorGeom, cursorMat);
    this.group.add(this.liveCursorMesh);

    // Glow halo on cursor
    const haloCanvas = document.createElement('canvas');
    haloCanvas.width = 64;
    haloCanvas.height = 64;
    const hCtx = haloCanvas.getContext('2d');
    if (hCtx) {
      const grad = hCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, 'rgba(56, 189, 248, 1.0)');
      grad.addColorStop(0.35, 'rgba(56, 189, 248, 0.5)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');
      hCtx.fillStyle = grad;
      hCtx.fillRect(0, 0, 64, 64);
    }
    const haloTexture = new THREE.CanvasTexture(haloCanvas);
    const haloMat = new THREE.SpriteMaterial({
      map: haloTexture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthTest: true,
      depthWrite: false,
    });
    this.liveCursorGlow = new THREE.Sprite(haloMat);
    this.liveCursorGlow.scale.set(0.65, 0.65, 1.0);
    this.liveCursorMesh.add(this.liveCursorGlow);

    // 4. Dual-Hull Manifold (Normative Reference Outer Cage & Morphed Inner Hull)
    const outerMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.22,
    });
    this.outerReferenceHull = new THREE.LineSegments(
      new THREE.WireframeGeometry(new THREE.DodecahedronGeometry(1.8, 0)),
      outerMat
    );
    this.group.add(this.outerReferenceHull);

    // Inner Active Dynamic Hull
    const innerGeom = new THREE.DodecahedronGeometry(1.4, 0);
    const innerMat = new THREE.MeshBasicMaterial({
      color: 0xf43f5e,
      wireframe: true,
      transparent: true,
      opacity: 0.30,
    });
    this.innerActiveHull = new THREE.Mesh(innerGeom, innerMat);
    this.group.add(this.innerActiveHull);

    // 5. 2D Floor Projection Grid
    const floorGeom = new THREE.PlaneGeometry(4.2, 4.2, 48, 48);
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
    this.floorProjectionMesh.position.y = -2.1;
    this.group.add(this.floorProjectionMesh);

    // 6. Extruded Velocity Ribbon
    this.trajectoryGeom = new THREE.BufferGeometry();
    this.trajectoryGeom.setAttribute('position', new THREE.BufferAttribute(this.ribbonPositions, 3));
    this.trajectoryGeom.setAttribute('color', new THREE.BufferAttribute(this.ribbonColors, 3));

    const ribbonMat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.80,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
    });

    this.trajectoryMesh = new THREE.Mesh(this.trajectoryGeom, ribbonMat);
    this.group.add(this.trajectoryMesh);

    for (let i = 0; i < this.maxControlPoints; i++) {
      this.ringPoints.push(new THREE.Vector3(0.25, 0.02, -0.15));
    }
  }

  private createVowelTargetBadge(vd: VowelTargetDef): void {
    const pos = new THREE.Vector3(vd.f[0], vd.f[1], vd.f[2]);

    // 1. Sleek Glowing Circular Target Badge Texture (Circle with Vowel Name inside)
    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 160;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Circular glowing pill background
      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.strokeStyle = `rgba(${((vd.color >> 16) & 255)}, ${((vd.color >> 8) & 255)}, ${(vd.color & 255)}, 0.9)`;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(80, 80, 72, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Inner subtle glow ring
      ctx.strokeStyle = `rgba(${((vd.color >> 16) & 255)}, ${((vd.color >> 8) & 255)}, ${(vd.color & 255)}, 0.3)`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(80, 80, 60, 0, Math.PI * 2);
      ctx.stroke();

      // Main Vowel Letter Name
      ctx.font = 'bold 54px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(vd.name, 80, 68);

      // Subtitle Word Hint
      ctx.font = 'bold 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillStyle = `rgb(${((vd.color >> 16) & 255)}, ${((vd.color >> 8) & 255)}, ${(vd.color & 255)})`;
      ctx.fillText(vd.wordHint, 80, 114);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const spriteMat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: true,  // Must respect 3D depth to prevent overlapping!
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.position.copy(pos);
    sprite.scale.set(0.48, 0.48, 1.0);
    this.vowelDiscsGroup.add(sprite);
  }

  public pushSpeakerFormants(f1: number, f2: number, f3: number, voiceEnergy = 1.0): void {
    const pos = mapFormantsToVisualSpace(f1, f2, f3);
    this.targetCursorPos.copy(pos);

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

      const width = 0.06 * (1.0 - (i / N) * 0.75);
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
    // Smooth cursor spring movement
    this.currentCursorPos.lerp(this.targetCursorPos, 0.15);
    this.liveCursorMesh.position.copy(this.currentCursorPos);

    // Pulse live cursor glow
    const pulse = Math.sin(time * 6.0) * 0.12 + 0.55;
    this.liveCursorGlow.scale.set(pulse, pulse, 1.0);

    const cloudMat = this.pointsCloud.material as THREE.ShaderMaterial;
    cloudMat.uniforms.uTime.value = time;

    // FCR centralization morphing factor
    const centralizationFactor = Math.max(0.0, Math.min(1.0, (fcr - 0.95) / 0.35));
    cloudMat.uniforms.uCentralization.value += (centralizationFactor - cloudMat.uniforms.uCentralization.value) * 0.1;
    cloudMat.uniforms.uTherapyStabilize.value = isTherapyActive ? 1.0 : 0.0;

    // Morph inner active VSA hull
    const scale = Math.max(0.35, 1.0 - centralizationFactor * 0.55);
    this.innerActiveHull.scale.set(scale, scale, scale);
    this.innerActiveHull.rotation.y = time * 0.12;

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
    this.liveCursorMesh.geometry.dispose();
    (this.liveCursorMesh.material as THREE.Material).dispose();
  }
}
