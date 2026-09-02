/**
 * SoundForm 3D - Volumetric Chladni Raymarching Mesh Controller
 * 
 * Manages the Three.js bounding proxy mesh, custom volumetric raymarching shader material,
 * continuous modal slider uniforms, chamber switching, and audio reactivity.
 */

import * as THREE from 'three';
import {
  VOLUMETRIC_CHLADNI_VERTEX_SHADER,
  VOLUMETRIC_CHLADNI_FRAGMENT_SHADER,
} from './shaders/volumetricChladniShader';
import { ColorPalettes, PalettePreset } from './ColorPalettes';

export type ChamberGeometryType = 'rectangular' | 'cylindrical' | 'spherical' | 0 | 1 | 2;

export interface VolumetricChladniOptions {
  chamberType?: ChamberGeometryType;
  modes?: { n: number; m: number; l: number };
  superposition?: { alpha: number; beta: number; gamma: number };
  thickness?: number;
  absorption?: number;
  stepCount?: number;
  fresnelPower?: number;
  chromaticDispersion?: number;
  palette?: PalettePreset;
}

export class VolumetricChladniMesh {
  public group: THREE.Group;
  public mesh: THREE.Mesh;
  public material: THREE.ShaderMaterial;

  // State
  private currentChamberType: number = 0; // 0=Rectangular, 1=Cylindrical, 2=Spherical
  private modes: THREE.Vector3;
  private superposition: THREE.Vector3;
  private inverseModelMatrix: THREE.Matrix4;
  private resolution: THREE.Vector2;

  constructor(initialPalette?: PalettePreset, options?: VolumetricChladniOptions) {
    this.group = new THREE.Group();
    this.group.position.y = 0.45;
    this.inverseModelMatrix = new THREE.Matrix4();
    this.resolution = new THREE.Vector2(window.innerWidth, window.innerHeight);

    const palette = initialPalette || ColorPalettes.getPalette('cosmic-nebula');

    // Parse options with high-quality defaults
    this.currentChamberType = this.parseChamberType(options?.chamberType ?? 'rectangular');
    this.modes = new THREE.Vector3(
      options?.modes?.n ?? 2.0,
      options?.modes?.m ?? 3.0,
      options?.modes?.l ?? 2.0
    );
    this.superposition = new THREE.Vector3(
      options?.superposition?.alpha ?? 1.0,
      options?.superposition?.beta ?? -1.0,
      options?.superposition?.gamma ?? 0.5
    );

    const thickness = options?.thickness ?? 0.024;
    const absorption = options?.absorption ?? 1.6;
    const stepCount = options?.stepCount ?? 80;
    const fresnelPower = options?.fresnelPower ?? 2.8;
    const chromaticDispersion = options?.chromaticDispersion ?? 1.2;

    // 1. Proxy Bounding Cube Geometry
    // Size 2.45 encapsulates normalized chamber domain [-1, 1]^3 with bounding margin
    const geometry = new THREE.BoxGeometry(2.45, 2.45, 2.45);

    // 2. Custom Raymarching Shader Material
    this.material = new THREE.ShaderMaterial({
      vertexShader: VOLUMETRIC_CHLADNI_VERTEX_SHADER,
      fragmentShader: VOLUMETRIC_CHLADNI_FRAGMENT_SHADER,
      uniforms: {
        uTime: { value: 0 },
        uInverseModelMatrix: { value: new THREE.Matrix4() },
        uChamberType: { value: this.currentChamberType },
        uModes: { value: this.modes.clone() },
        uSuperposition: { value: this.superposition.clone() },
        uChamberSize: { value: new THREE.Vector3(2.0, 2.0, 2.0) },
        uThickness: { value: thickness },
        uAbsorption: { value: absorption },
        uStepCount: { value: stepCount },
        uFresnelPower: { value: fresnelPower },
        uChromaticDispersion: { value: chromaticDispersion },

        // Audio reactivity
        uBandEnergies: { value: new THREE.Vector4(0, 0, 0, 0) },
        uHighEnergies: { value: new THREE.Vector2(0, 0) },
        uFundamentalFreq: { value: 432.0 },

        // Inigo Quilez Cosine Palette
        uPaletteA: { value: palette.a.clone() },
        uPaletteB: { value: palette.b.clone() },
        uPaletteC: { value: palette.c.clone() },
        uPaletteD: { value: palette.d.clone() },
        uCoreGlow: { value: palette.coreGlow.clone() },
        uAccent: { value: palette.accent.clone() },
      },
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.NormalBlending,
      side: THREE.BackSide, // BackSide guarantees ray entry even when camera is inside bounding box
    });

    this.mesh = new THREE.Mesh(geometry, this.material);
    this.group.add(this.mesh);

    // Subtle Glass Chamber Edge Wireframe
    const wireGeo = new THREE.BoxGeometry(2.0, 2.0, 2.0);
    const wireMat = new THREE.MeshBasicMaterial({
      color: palette.accent,
      wireframe: true,
      transparent: true,
      opacity: 0.12,
    });
    const wireMesh = new THREE.Mesh(wireGeo, wireMat);
    wireMesh.name = 'chamber-wireframe';
    this.group.add(wireMesh);
  }

  /**
   * Main per-frame update
   */
  public update(
    time: number,
    bandEnergies: THREE.Vector4,
    highEnergies: THREE.Vector2,
    fundamentalHz: number,
    _camera?: THREE.Camera
  ): void {
    const u = this.material.uniforms;

    // Update time & audio telemetry
    u.uTime.value = time;
    u.uBandEnergies.value.copy(bandEnergies);
    u.uHighEnergies.value.copy(highEnergies);
    u.uFundamentalFreq.value = fundamentalHz;

    // Compute inverse model matrix for canonical local-space raymarching
    this.mesh.updateMatrixWorld();
    this.inverseModelMatrix.copy(this.mesh.matrixWorld).invert();
    u.uInverseModelMatrix.value.copy(this.inverseModelMatrix);

    // Subtle gentle cosmic chamber rotation
    this.group.rotation.y = time * 0.08;
    this.group.rotation.x = Math.sin(time * 0.04) * 0.15;
  }

  /**
   * Set active chamber geometry:
   * 0 = Rectangular Cavity
   * 1 = Cylindrical Chamber
   * 2 = Spherical Chamber
   */
  public setChamberType(type: ChamberGeometryType): void {
    this.currentChamberType = this.parseChamberType(type);
    this.material.uniforms.uChamberType.value = this.currentChamberType;

    // Update visual wireframe cage geometry to reflect active chamber shape
    const wire = this.group.getObjectByName('chamber-wireframe') as THREE.Mesh;
    if (wire) {
      wire.geometry.dispose();
      if (this.currentChamberType === 0) {
        wire.geometry = new THREE.BoxGeometry(2.0, 2.0, 2.0);
      } else if (this.currentChamberType === 1) {
        wire.geometry = new THREE.CylinderGeometry(1.0, 1.0, 2.0, 24, 4, true);
      } else {
        wire.geometry = new THREE.SphereGeometry(1.0, 24, 16);
      }
    }
  }

  public getChamberType(): number {
    return this.currentChamberType;
  }

  /**
   * Set modal wave numbers (n, m, l) with continuous slider interpolation
   */
  public setModes(n: number, m: number, l: number): void {
    this.modes.set(n, m, l);
    this.material.uniforms.uModes.value.copy(this.modes);
  }

  public getModes(): THREE.Vector3 {
    return this.modes.clone();
  }

  /**
   * Set degenerate modal superposition mix weights (alpha, beta, gamma)
   */
  public setSuperposition(alpha: number, beta: number, gamma: number): void {
    this.superposition.set(alpha, beta, gamma);
    this.material.uniforms.uSuperposition.value.copy(this.superposition);
  }

  /**
   * Set membrane thickness sigma
   */
  public setThickness(thickness: number): void {
    this.material.uniforms.uThickness.value = Math.max(0.002, Math.min(0.12, thickness));
  }

  /**
   * Set optical absorption coefficient
   */
  public setAbsorption(absorption: number): void {
    this.material.uniforms.uAbsorption.value = Math.max(0.1, Math.min(10.0, absorption));
  }

  /**
   * Set raymarching step count (performance vs quality)
   */
  public setStepCount(steps: number): void {
    this.material.uniforms.uStepCount.value = Math.max(24, Math.min(128, Math.round(steps)));
  }

  /**
   * Set Fresnel edge power
   */
  public setFresnelPower(power: number): void {
    this.material.uniforms.uFresnelPower.value = Math.max(0.5, Math.min(8.0, power));
  }

  /**
   * Set chromatic thin-film dispersion strength
   */
  public setChromaticDispersion(dispersion: number): void {
    this.material.uniforms.uChromaticDispersion.value = dispersion;
  }

  /**
   * Switch color palette preset
   */
  public setPalette(palette: PalettePreset): void {
    const u = this.material.uniforms;
    u.uPaletteA.value.copy(palette.a);
    u.uPaletteB.value.copy(palette.b);
    u.uPaletteC.value.copy(palette.c);
    u.uPaletteD.value.copy(palette.d);
    u.uCoreGlow.value.copy(palette.coreGlow);
    u.uAccent.value.copy(palette.accent);

    const wire = this.group.getObjectByName('chamber-wireframe') as THREE.Mesh;
    if (wire && wire.material instanceof THREE.MeshBasicMaterial) {
      wire.material.color.copy(palette.accent);
    }
  }

  public setVisible(visible: boolean): void {
    this.group.visible = visible;
  }

  public resize(width: number, height: number): void {
    this.resolution.set(width, height);
  }

  private parseChamberType(type: ChamberGeometryType): number {
    if (typeof type === 'number') {
      return Math.max(0, Math.min(2, Math.round(type)));
    }
    switch (type.toLowerCase()) {
      case 'cylindrical':
        return 1;
      case 'spherical':
        return 2;
      case 'rectangular':
      default:
        return 0;
    }
  }

  public dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
    const wire = this.group.getObjectByName('chamber-wireframe') as THREE.Mesh;
    if (wire) {
      wire.geometry.dispose();
      (wire.material as THREE.Material).dispose();
    }
  }
}
