/**
 * CymaticsMesh.ts
 * SoundForm 3D - Tangible 3D Levitating Acoustic Fluid Resonator / Droplet
 *
 * Features:
 * - High-tessellation deformable fluid droplet geometry (Icosahedron detail 5 = 10,242 verts / 20,480 tris).
 * - Real-time physical modal deformation based on (n, m, l), frequency, and acoustic pressure.
 * - Spherical Harmonics (L0 breathing, L1 dipole, L2 quadrupole, L3 octupole, L4 star lobes) & radial Bessel waves.
 * - Calibrated 3-point studio lighting, subsurface scattering (SSS), chromatic lipid/fluid Fresnel rim,
 *   internal acoustic pressure core glow, and glowing standing wave nodal lines.
 * - Sonic Memory layer: the current spectrum begins at the core while older sound remains farther away.
 * - Responds to ModalSweeperControls (n, m, l sliders, geometry, frequency) smoothly at 120 FPS.
 */

import * as THREE from 'three';
import { CYMATICS_VERTEX_SHADER, CYMATICS_FRAGMENT_SHADER } from './shaders/cymaticsShader';
import { PalettePreset } from './ColorPalettes';

export type ChamberGeometryType = 'cube' | 'cylinder' | 'sphere' | 0 | 1 | 2;

export class CymaticsMesh {
  public group: THREE.Group;
  public mesh: THREE.Mesh;
  public innerCore: THREE.Mesh;

  private material: THREE.ShaderMaterial;
  private innerCoreMaterial: THREE.ShaderMaterial;
  private modes = new THREE.Vector3(1, 1, 1);
  private chamberTypeInt = 0; // 0=Cube, 1=Cylinder, 2=Sphere
  private fundamentalHz = 297.0;
  private acousticPressure = 1.0;
  private visualStyleListener?: EventListener;

  constructor(initialPalette: PalettePreset) {
    this.group = new THREE.Group();

    // 1. High-resolution deformable fluid droplet geometry (calibrated radius 1.15)
    const radius = 1.15;
    const geo = new THREE.IcosahedronGeometry(radius, 5);
    geo.computeVertexNormals();

    // 2. Physical 3D Fluid Droplet Shader Material
    this.material = new THREE.ShaderMaterial({
      vertexShader: CYMATICS_VERTEX_SHADER,
      fragmentShader: CYMATICS_FRAGMENT_SHADER,
      uniforms: {
        uTime: { value: 0 },
        uDrivePhases: { value: new THREE.Vector4() },
        uModes: { value: this.modes.clone() },
        uChamberType: { value: this.chamberTypeInt },
        uFundamentalFreq: { value: this.fundamentalHz },
        uAcousticPressure: { value: this.acousticPressure },
        uHarmonicMultiplier: { value: 1.0 },
        uBandEnergies: { value: new THREE.Vector4() },
        uHighEnergies: { value: new THREE.Vector2() },
        uCameraPos: { value: new THREE.Vector3() },

        // Cosine Color Palette in OKLab Space
        uPaletteA: { value: initialPalette.a.clone() },
        uPaletteB: { value: initialPalette.b.clone() },
        uPaletteC: { value: initialPalette.c.clone() },
        uPaletteD: { value: initialPalette.d.clone() },
        uCoreGlow: { value: initialPalette.coreGlow.clone() },
        uAccent: { value: initialPalette.accent.clone() },

        // Subsurface Scattering Parameters
        uSubsurfaceColor: { value: new THREE.Vector3(0.08, 0.55, 0.75) },
        uSubsurfacePower: { value: 3.4 },
        uSubsurfaceScale: { value: 1.35 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      side: THREE.DoubleSide,
    });

    this.mesh = new THREE.Mesh(geo, this.material);
    this.group.add(this.mesh);

    // 3. Internal Acoustic Resonator Core Sphere
    const innerGeo = new THREE.IcosahedronGeometry(radius * 0.42, 3);
    this.innerCoreMaterial = new THREE.ShaderMaterial({
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
        uniform vec3 uAccent;
        uniform float uTime;
        uniform float uAudioBass;
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        void main() {
          vec3 N = length(vNormal) > 1e-5 ? normalize(vNormal) : vec3(0.0, 1.0, 0.0);
          vec3 V = length(vViewPosition) > 1e-5 ? normalize(vViewPosition) : vec3(0.0, 0.0, 1.0);
          float NdotV = clamp(dot(N, V), 0.0, 1.0);
          float fresnel = pow(clamp(1.0 - NdotV, 0.0, 1.0), 2.5);
          float pulse = sin(uTime * 3.0) * 0.10 + 0.90 + uAudioBass * 0.3;
          vec3 finalRgb = mix(uColor * 0.65, uAccent * 0.85, fresnel * 0.5) * pulse;
          gl_FragColor = vec4(clamp(finalRgb, 0.0, 10.0), 0.40);
        }
      `,
      uniforms: {
        uColor: { value: initialPalette.coreGlow.clone() },
        uAccent: { value: initialPalette.accent.clone() },
        uTime: { value: 0 },
        uAudioBass: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });

    this.innerCore = new THREE.Mesh(innerGeo, this.innerCoreMaterial);
    this.group.add(this.innerCore);

    this.group.position.y = 0.45;
  }

  private isAutoModal = true;

  /**
   * Set modal numbers (n, m, l) for 3-axis standing wave deformation (manual mode lock)
   */
  public setModes(n: number, m: number, l: number): void {
    this.isAutoModal = false;
    this.modes.set(n, m, l);
    this.material.uniforms.uModes.value.copy(this.modes);
  }

  public setModalNumbers(n: number, m: number, l: number): void {
    this.setModes(n, m, l);
  }

  public setAutoModal(auto: boolean): void {
    this.isAutoModal = auto;
  }

  public getAutoModal(): boolean {
    return this.isAutoModal;
  }

  public getModes(): THREE.Vector3 {
    return this.modes;
  }

  /**
   * Rayleigh Capillary Droplet Eigenfrequency (Lamb 1932):
   * omega_l^2 = l * (l - 1) * (l + 2) * sigma / (rho * R^3)
   * f_l = (1 / 2pi) * sqrt( l * (l - 1) * (l + 2) * sigma / (rho * R^3) )
   */
  public static rayleighDropletEigenfrequency(
    l: number,
    radius = 0.002,
    surfaceTension = 0.0728,
    density = 1000.0
  ): number {
    const safeL = Math.max(2, Math.round(l));
    const term = safeL * (safeL - 1) * (safeL + 2) * surfaceTension;
    const denom = density * Math.pow(radius, 3);
    const omega = Math.sqrt(term / denom);
    return omega / (2.0 * Math.PI);
  }

  public setChamberGeometry(type: ChamberGeometryType): void {
    this.setChamberType(type);
  }

  /**
   * Set active chamber geometry type (cube / cylinder / sphere)
   */
  public setChamberType(type: ChamberGeometryType): void {
    if (typeof type === 'number') {
      this.chamberTypeInt = Math.max(0, Math.min(2, Math.round(type)));
    } else {
      const lower = type.toLowerCase();
      if (lower === 'cylinder' || lower === 'cylindrical') {
        this.chamberTypeInt = 1;
      } else if (lower === 'sphere' || lower === 'spherical') {
        this.chamberTypeInt = 2;
      } else {
        this.chamberTypeInt = 0;
      }
    }
    this.material.uniforms.uChamberType.value = this.chamberTypeInt;
  }

  public setGeometry(type: ChamberGeometryType): void {
    this.setChamberType(type);
  }

  /**
   * Set driving eigenfrequency in Hz
   */
  public setFrequency(freqHz: number): void {
    this.fundamentalHz = freqHz;
    this.material.uniforms.uFundamentalFreq.value = freqHz;
  }

  /**
   * Set acoustic sound pressure / intensity
   */
  public setAcousticPressure(pressure: number): void {
    this.acousticPressure = pressure;
    this.material.uniforms.uAcousticPressure.value = pressure;
  }

  public setHarmonicMultiplier(mult: number): void {
    this.material.uniforms.uHarmonicMultiplier.value = mult;
  }

  public setWavenumber(_k: number): void {
    // Kept for backward compatibility
  }

  /**
   * Main per-frame update loop (continuous dynamic modal morphing)
   */
  public update(
    time: number,
    bands: THREE.Vector4,
    highs: THREE.Vector2,
    fundamentalHz: number,
    dt = 0.016,
    camera?: THREE.Camera
  ): void {
    const u = this.material.uniforms;
    // Integrate the existing illustrative angular rates. Frequency changes
    // affect future phase only; they must not rewrite the entire time history.
    const phases = u.uDrivePhases.value as THREE.Vector4;
    const step = Math.max(0, dt);
    const tau = Math.PI * 2;
    phases.x = (phases.x + (fundamentalHz * 0.02 + bands.x * 6) * 2 * step) % tau;
    phases.y = (phases.y + (fundamentalHz * 0.04 + bands.y * 8) * 1.5 * step) % tau;
    phases.z = (phases.z + (fundamentalHz * 0.04 + bands.y * 8) * 1.8 * step) % tau;
    phases.w = (phases.w + fundamentalHz * 0.06 * step) % tau;
    u.uTime.value = time;
    u.uBandEnergies.value.copy(bands);
    u.uHighEnergies.value.copy(highs);
    u.uFundamentalFreq.value = fundamentalHz;

    // Real-time audio spectral modal synthesis
    if (this.isAutoModal) {
      const logFreq = Math.max(0, Math.log2(Math.max(20, fundamentalHz) / 35.0));
      const baseHarmonic = 1.0 + logFreq * 0.85;

      const dynamicN = Math.max(1.0, Math.min(8.0, baseHarmonic + bands.x * 2.8 + bands.y * 1.8));
      const dynamicM = Math.max(1.0, Math.min(8.0, baseHarmonic * 1.15 + bands.z * 3.2 + highs.x * 2.5));
      const dynamicL = Math.max(1.0, Math.min(6.0, baseHarmonic * 0.75 + bands.w * 2.2 + highs.y * 2.0));

      this.modes.set(dynamicN, dynamicM, dynamicL);
      u.uModes.value.copy(this.modes);
    }

    if (camera) {
      u.uCameraPos.value.copy(camera.position);
    }

    const icu = this.innerCoreMaterial.uniforms;
    icu.uTime.value = time;
    icu.uAudioBass.value = bands.x;

    this.mesh.scale.setScalar(1.0);
    this.innerCore.scale.setScalar(1.0);

    // Organic levitating droplet axial precession and wobble
    this.mesh.rotation.y = time * 0.18 + bands.y * 0.3;
    this.mesh.rotation.x = Math.sin(time * 0.12) * 0.22 + bands.x * 0.15;
    this.innerCore.rotation.y = -time * 0.12;
    this.innerCore.rotation.z = Math.cos(time * 0.15) * 0.16;
  }

  public setPalette(palette: PalettePreset): void {
    const u = this.material.uniforms;
    u.uPaletteA.value.copy(palette.a);
    u.uPaletteB.value.copy(palette.b);
    u.uPaletteC.value.copy(palette.c);
    u.uPaletteD.value.copy(palette.d);
    u.uCoreGlow.value.copy(palette.coreGlow);
    u.uAccent.value.copy(palette.accent);

    // Update Subsurface color based on palette
    u.uSubsurfaceColor.value.set(
      palette.accent.r * 0.5 + palette.coreGlow.r * 0.5,
      palette.accent.g * 0.5 + palette.coreGlow.g * 0.5,
      palette.accent.b * 0.5 + palette.coreGlow.b * 0.5
    );

    const icu = this.innerCoreMaterial.uniforms;
    icu.uColor.value.copy(palette.coreGlow);
    icu.uAccent.value.copy(palette.accent);
  }

  public setVisible(visible: boolean): void {
    this.mesh.visible = visible;
    this.innerCore.visible = visible;
    this.group.visible = visible;
  }

  public isVisible(): boolean {
    return this.mesh.visible;
  }

  public setDropletVisible(visible: boolean): void {
    this.mesh.visible = visible;
    this.innerCore.visible = visible;
    this.group.visible = visible;
  }

  public isDropletVisible(): boolean {
    return this.mesh.visible;
  }

  public dispose(): void {
    if (this.visualStyleListener && typeof window !== 'undefined') {
      window.removeEventListener('visual-style-changed', this.visualStyleListener);
    }
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.innerCore.geometry.dispose();
    this.innerCoreMaterial.dispose();
  }
}
