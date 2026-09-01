/**
 * BioCellMesh.ts
 * SoundForm 3D - Three.js Deformable Bio-Cell Membrane & Organelle Mesh Controller
 */

import * as THREE from 'three';
import {
  BIO_CELL_MEMBRANE_VERTEX_SHADER,
  BIO_CELL_MEMBRANE_FRAGMENT_SHADER,
} from './shaders/bioCellShader';
import { BioAcousticPhysics, BioSpecimenProfile } from '../math/BioAcousticPhysics';

export class BioCellMesh {
  public group: THREE.Group;
  public membraneMesh: THREE.Mesh;
  public nucleusMesh: THREE.Mesh;
  public actinFilamentMesh: THREE.LineSegments;

  private membraneMaterial: THREE.ShaderMaterial;
  private nucleusMaterial: THREE.ShaderMaterial;
  private currentSpecimenId: string = 'healthy-somatic';

  constructor(initialSpecimenId = 'healthy-somatic') {
    this.group = new THREE.Group();
    this.currentSpecimenId = initialSpecimenId;
    const profile = BioAcousticPhysics.SPECIMENS[initialSpecimenId] || BioAcousticPhysics.SPECIMENS['healthy-somatic'];

    // 1. High-Resolution Deformable Membrane Geometry (Icosahedron Detail 5 = 10,242 verts / 20,480 tris)
    const radius = 2.0;
    const membraneGeom = new THREE.IcosahedronGeometry(radius, 5);
    membraneGeom.computeVertexNormals();

    this.membraneMaterial = new THREE.ShaderMaterial({
      vertexShader: BIO_CELL_MEMBRANE_VERTEX_SHADER,
      fragmentShader: BIO_CELL_MEMBRANE_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: true,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uCameraPosition: { value: new THREE.Vector3() },
        uDiseaseState: { value: profile.blebTendency > 0.5 ? 1.0 : profile.category === 'pathogen' ? 2.0 : 0.0 },
        uCorticalTension: { value: Math.min(1.0, profile.corticalTensionMNm / 0.35) },
        uAcousticFrequency: { value: profile.audibleDownmixHz },
        uAcousticIntensity: { value: 1.0 },
        uModalAmplitudesL0L3: { value: new THREE.Vector4(0.08, 0.02, 0.15, 0.04) },
        uL4IcosahedralAmp: { value: profile.id === 'viral-capsid' ? 0.35 : 0.0 },
        uBlebFrequency: { value: profile.blebTendency > 0.5 ? 1.8 : 0.2 },
        uBlebScale: { value: profile.blebTendency > 0.5 ? 4.5 : 1.0 },
        uAudioBands: { value: new THREE.Vector4(0, 0, 0, 0) },
        uRefractiveIndex: { value: 1.46 },
        uSubsurfaceDistortion: { value: 0.45 },
        uSubsurfacePower: { value: 3.5 },
        uSubsurfaceScale: { value: 1.2 },
        uSubsurfaceColor: { value: new THREE.Vector3(0.05, 0.45, 0.65) },
        uBilayerLipidHeadColor: { value: new THREE.Vector3(0.1, 0.9, 0.8) },
        uCoreNucleusColor: { value: new THREE.Vector3(0.1, 0.5, 0.95) },
        uCoreRadius: { value: 0.45 },
        uActinGridDensity: { value: 12.0 },
        uPaletteA: { value: new THREE.Vector3(0.2, 0.7, 0.8) },
        uPaletteB: { value: new THREE.Vector3(0.2, 0.4, 0.3) },
        uPaletteC: { value: new THREE.Vector3(1.0, 1.0, 1.0) },
        uPaletteD: { value: new THREE.Vector3(0.0, 0.33, 0.67) },
        uRuptureProgress: { value: 0.0 },
        uLysisEdgeGlow: { value: 1.0 },
        uLysisGlowColor: { value: new THREE.Vector3(1.0, 0.7, 0.2) },
        uShockwaveOrigin: { value: new THREE.Vector3(0, 0, 0) },
        uShockwaveRadius: { value: 0.0 },
      },
    });

    this.membraneMesh = new THREE.Mesh(membraneGeom, this.membraneMaterial);
    this.group.add(this.membraneMesh);

    // 2. Internal Chromatin / Dense Organelle Nucleus Core
    const nucleusGeom = new THREE.IcosahedronGeometry(radius * 0.42, 3);
    this.nucleusMaterial = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          vViewPosition = -mvPos.xyz;
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uTime;
        uniform float uAudioBass;
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        void main() {
          vec3 N = normalize(vNormal);
          vec3 V = normalize(vViewPosition);
          float fresnel = pow(1.0 - max(dot(N, V), 0.0), 2.5);
          float pulse = sin(uTime * 4.0) * 0.15 + 0.85 + uAudioBass * 0.5;
          vec3 finalRgb = uColor * pulse + vec3(fresnel * 0.8);
          gl_FragColor = vec4(finalRgb, 0.95);
        }
      `,
      uniforms: {
        uColor: { value: new THREE.Vector3(0.1, 0.5, 0.95) },
        uTime: { value: 0 },
        uAudioBass: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
    });

    this.nucleusMesh = new THREE.Mesh(nucleusGeom, this.nucleusMaterial);
    this.group.add(this.nucleusMesh);

    // 3. Intracellular Cytoskeletal Actin Filaments (Wireframe cage connecting cortex to nucleus)
    const wireGeom = new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(radius * 0.88, 2));
    const wireMat = new THREE.LineBasicMaterial({
      color: 0x00e5ff,
      transparent: true,
      opacity: 0.25,
      blending: THREE.AdditiveBlending,
    });
    this.actinFilamentMesh = new THREE.LineSegments(wireGeom, wireMat);
    this.group.add(this.actinFilamentMesh);

    // Set initial specimen configuration
    this.setSpecimen(initialSpecimenId);
  }

  public setSpecimen(specimenId: string): void {
    this.currentSpecimenId = specimenId;
    const p = BioAcousticPhysics.SPECIMENS[specimenId] || BioAcousticPhysics.SPECIMENS['healthy-somatic'];
    const u = this.membraneMaterial.uniforms;

    if (p.id === 'healthy-somatic') {
      u.uDiseaseState.value = 0.0;
      u.uCorticalTension.value = 0.95;
      u.uBlebScale.value = 1.0;
      u.uBlebFrequency.value = 0.2;
      u.uModalAmplitudesL0L3.value.set(0.08, 0.02, 0.15, 0.04);
      u.uL4IcosahedralAmp.value = 0.0;
      u.uSubsurfaceColor.value.set(0.05, 0.45, 0.65);
      u.uBilayerLipidHeadColor.value.set(0.1, 0.9, 0.8);
      u.uCoreNucleusColor.value.set(0.1, 0.5, 0.95);
      this.nucleusMaterial.uniforms.uColor.value.set(0.1, 0.5, 0.95);
      this.actinFilamentMesh.visible = true;
      (this.actinFilamentMesh.material as THREE.LineBasicMaterial).color.setHex(0x00e5ff);
      (this.actinFilamentMesh.material as THREE.LineBasicMaterial).opacity = 0.35;
    } else if (p.id === 'malignant-cancer') {
      u.uDiseaseState.value = 1.0;
      u.uCorticalTension.value = 0.12;
      u.uBlebScale.value = 4.5;
      u.uBlebFrequency.value = 1.8;
      u.uModalAmplitudesL0L3.value.set(0.25, 0.12, 0.45, 0.28);
      u.uL4IcosahedralAmp.value = 0.0;
      u.uSubsurfaceColor.value.set(0.85, 0.15, 0.25);
      u.uBilayerLipidHeadColor.value.set(1.0, 0.3, 0.2);
      u.uCoreNucleusColor.value.set(1.0, 0.1, 0.45);
      this.nucleusMaterial.uniforms.uColor.value.set(1.0, 0.1, 0.45);
      this.actinFilamentMesh.visible = true;
      (this.actinFilamentMesh.material as THREE.LineBasicMaterial).color.setHex(0xff0055);
      (this.actinFilamentMesh.material as THREE.LineBasicMaterial).opacity = 0.15; // Degraded actin
    } else if (p.id === 'viral-capsid') {
      u.uDiseaseState.value = 2.0;
      u.uCorticalTension.value = 1.0;
      u.uBlebScale.value = 1.0;
      u.uBlebFrequency.value = 0.0;
      u.uModalAmplitudesL0L3.value.set(0.02, 0.0, 0.04, 0.0);
      u.uL4IcosahedralAmp.value = 0.35;
      u.uSubsurfaceColor.value.set(0.3, 0.7, 0.1);
      u.uBilayerLipidHeadColor.value.set(0.7, 1.0, 0.2);
      u.uCoreNucleusColor.value.set(0.8, 1.0, 0.15);
      this.nucleusMaterial.uniforms.uColor.value.set(0.8, 1.0, 0.15);
      this.actinFilamentMesh.visible = false;
    } else if (p.id === 'bacterial-wall') {
      u.uDiseaseState.value = 2.0;
      u.uCorticalTension.value = 0.85;
      u.uBlebScale.value = 2.0;
      u.uBlebFrequency.value = 0.4;
      u.uModalAmplitudesL0L3.value.set(0.05, 0.03, 0.22, 0.12);
      u.uL4IcosahedralAmp.value = 0.1;
      u.uSubsurfaceColor.value.set(0.6, 0.4, 0.1);
      u.uBilayerLipidHeadColor.value.set(1.0, 0.7, 0.1);
      u.uCoreNucleusColor.value.set(1.0, 0.8, 0.2);
      this.nucleusMaterial.uniforms.uColor.value.set(1.0, 0.8, 0.2);
      this.actinFilamentMesh.visible = true;
      (this.actinFilamentMesh.material as THREE.LineBasicMaterial).color.setHex(0xffaa00);
      (this.actinFilamentMesh.material as THREE.LineBasicMaterial).opacity = 0.25;
    } else {
      // Histotripsy
      u.uDiseaseState.value = 1.0;
      u.uCorticalTension.value = 0.05;
      u.uBlebScale.value = 6.0;
      u.uBlebFrequency.value = 3.5;
      u.uModalAmplitudesL0L3.value.set(0.4, 0.2, 0.5, 0.45);
      u.uL4IcosahedralAmp.value = 0.0;
      u.uSubsurfaceColor.value.set(0.9, 0.3, 0.05);
      u.uBilayerLipidHeadColor.value.set(1.0, 0.5, 0.1);
      u.uCoreNucleusColor.value.set(1.0, 0.4, 0.0);
      this.nucleusMaterial.uniforms.uColor.value.set(1.0, 0.4, 0.0);
      this.actinFilamentMesh.visible = false;
    }

    u.uAcousticFrequency.value = p.audibleDownmixHz;
  }

  public getSpecimenId(): string {
    return this.currentSpecimenId;
  }

  public setAcousticFrequency(freqHz: number): void {
    this.membraneMaterial.uniforms.uAcousticFrequency.value = freqHz;
  }

  public setAcousticIntensity(intensity: number): void {
    this.membraneMaterial.uniforms.uAcousticIntensity.value = intensity;
  }

  public setRuptureProgress(progress: number, shockRadius = 0.0, shockOrigin = new THREE.Vector3()): void {
    const u = this.membraneMaterial.uniforms;
    u.uRuptureProgress.value = progress;
    u.uShockwaveRadius.value = shockRadius;
    u.uShockwaveOrigin.value.copy(shockOrigin);
  }

  public update(time: number, dt: number, camera: THREE.Camera, bands: THREE.Vector4): void {
    const mu = this.membraneMaterial.uniforms;
    mu.uTime.value = time;
    mu.uCameraPosition.value.copy(camera.position);
    mu.uAudioBands.value.copy(bands);

    const nu = this.nucleusMaterial.uniforms;
    nu.uTime.value = time;
    nu.uAudioBass.value = bands.x;

    // Organic slow cell tumbling
    this.group.rotation.y = time * 0.12;
    this.group.rotation.x = Math.sin(time * 0.08) * 0.18;
  }

  public setVisible(visible: boolean): void {
    this.group.visible = visible;
  }

  public dispose(): void {
    this.membraneMesh.geometry.dispose();
    this.membraneMaterial.dispose();
    this.nucleusMesh.geometry.dispose();
    this.nucleusMaterial.dispose();
    this.actinFilamentMesh.geometry.dispose();
    (this.actinFilamentMesh.material as THREE.Material).dispose();
  }
}
