/**
 * CymaticsPlateMesh.ts
 * SoundForm 3D - Physical 2D Resonant Cymatics / Chladni Sand Plate Resonator
 *
 * Features:
 * - High-tessellation vibrating 2D Chladni plate with real-time modal standing wave displacement.
 * - 3D Acoustic Dust & Sand Particle Swarm actively trapping onto Chladni nodal mandalas (up to 256k particles).
 * - Full reactivity to Physics & Optics controls: Wave Speed, Sound Absorption, Glow Brightness, Particle Density, and Particle Size.
 * - High-contrast dark satin carbon-steel plate substrate with vivid, razor-sharp sand mandalas.
 * - Apple OKLab perceptual color harmony matching all dynamic theme palettes.
 * - Zero-allocation 120 FPS performance in the animation loop.
 */

import * as THREE from 'three';
import {
  CYMATICS_PLATE_VERTEX_SHADER,
  CYMATICS_PLATE_FRAGMENT_SHADER,
  PLATE_DUST_VERTEX_SHADER,
  PLATE_DUST_FRAGMENT_SHADER,
} from './shaders/cymaticsPlateShader';
import { PalettePreset } from './ColorPalettes';

export class CymaticsPlateMesh {
  public group: THREE.Group;
  public plateMesh: THREE.Mesh;
  public dustParticles: THREE.Points;
  public bezelRim: THREE.Mesh;
  public transducerStand: THREE.Group;

  private plateMaterial: THREE.ShaderMaterial;
  private dustMaterial: THREE.ShaderMaterial;
  private dustGeometry: THREE.BufferGeometry;
  private standMaterial: THREE.MeshStandardMaterial;
  private rimMaterial: THREE.MeshStandardMaterial;

  private modes: THREE.Vector3 = new THREE.Vector3(2.0, 3.0, 1.0);
  private chamberType: number = 0.0; // 0.0 = Cartesian plate, 1.0 = Circular Bessel plate
  private plateDiameter: number = 3.5;
  private maxDustCount: number = 262144; // 256k maximum capacity
  private currentDustCount: number = 65536;
  private particleScale: number = 1.0;
  private waveSpeed: number = 5.0;
  private waveDamping: number = 0.05;

  constructor(initialPalette: PalettePreset) {
    this.group = new THREE.Group();

    // 1. High-Resolution Deformable Chladni Resonator Plate Surface (180x180 vertices)
    const plateGeo = new THREE.PlaneGeometry(this.plateDiameter, this.plateDiameter, 180, 180);

    this.plateMaterial = new THREE.ShaderMaterial({
      vertexShader: CYMATICS_PLATE_VERTEX_SHADER,
      fragmentShader: CYMATICS_PLATE_FRAGMENT_SHADER,
      uniforms: {
        uTime: { value: 0 },
        uModes: { value: this.modes.clone() },
        uChamberType: { value: this.chamberType },
        uFundamentalFreq: { value: 432.0 },
        uWaveSpeed: { value: this.waveSpeed },
        uWaveDamping: { value: this.waveDamping },
        uBandEnergies: { value: new THREE.Vector4(0, 0, 0, 0) },
        uHighEnergies: { value: new THREE.Vector2(0, 0) },
        uPlateSize: { value: this.plateDiameter },

        // Cosine Color Palette in OKLab Space
        uPaletteA: { value: initialPalette.a.clone() },
        uPaletteB: { value: initialPalette.b.clone() },
        uPaletteC: { value: initialPalette.c.clone() },
        uPaletteD: { value: initialPalette.d.clone() },
        uCoreGlow: { value: initialPalette.coreGlow.clone() },
        uAccent: { value: initialPalette.accent.clone() },
      },
      transparent: true,
      depthWrite: true,
      side: THREE.DoubleSide,
    });

    this.plateMesh = new THREE.Mesh(plateGeo, this.plateMaterial);
    this.plateMesh.rotation.x = -Math.PI / 2;
    this.group.add(this.plateMesh);

    // 2. 3D Acoustic Dust / Sand Particle Swarm on Plate Surface (up to 256k particles)
    this.dustGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.maxDustCount * 3);
    const seeds = new Float32Array(this.maxDustCount);
    const phases = new Float32Array(this.maxDustCount);

    const halfSize = (this.plateDiameter * 0.5) * 0.90;
    for (let i = 0; i < this.maxDustCount; i++) {
      const idx = i * 3;
      positions[idx] = (Math.random() * 2 - 1) * halfSize;
      positions[idx + 1] = 0.004; // Resting directly on plate surface
      positions[idx + 2] = (Math.random() * 2 - 1) * halfSize;

      seeds[i] = Math.random();
      phases[i] = Math.random() * Math.PI * 2;
    }

    this.dustGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.dustGeometry.setAttribute('aParticleSeed', new THREE.BufferAttribute(seeds, 1));
    this.dustGeometry.setAttribute('aParticlePhase', new THREE.BufferAttribute(phases, 1));
    this.dustGeometry.setDrawRange(0, this.currentDustCount);

    this.dustMaterial = new THREE.ShaderMaterial({
      vertexShader: PLATE_DUST_VERTEX_SHADER,
      fragmentShader: PLATE_DUST_FRAGMENT_SHADER,
      uniforms: {
        uTime: { value: 0 },
        uModes: { value: this.modes.clone() },
        uChamberType: { value: this.chamberType },
        uFundamentalFreq: { value: 432.0 },
        uWaveSpeed: { value: this.waveSpeed },
        uWaveDamping: { value: this.waveDamping },
        uBandEnergies: { value: new THREE.Vector4(0, 0, 0, 0) },
        uHighEnergies: { value: new THREE.Vector2(0, 0) },
        uParticleScale: { value: this.particleScale },
        uPlateSize: { value: this.plateDiameter },

        uPaletteA: { value: initialPalette.a.clone() },
        uPaletteB: { value: initialPalette.b.clone() },
        uPaletteC: { value: initialPalette.c.clone() },
        uPaletteD: { value: initialPalette.d.clone() },
        uCoreGlow: { value: initialPalette.coreGlow.clone() },
        uAccent: { value: initialPalette.accent.clone() },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.dustParticles = new THREE.Points(this.dustGeometry, this.dustMaterial);
    this.dustParticles.frustumCulled = false;
    this.group.add(this.dustParticles);

    // 3. Anodized Machined Bezel Perimeter Frame
    const rimGeo = new THREE.BoxGeometry(this.plateDiameter + 0.12, 0.06, this.plateDiameter + 0.12);
    this.rimMaterial = new THREE.MeshStandardMaterial({
      color: 0x0e1218,
      metalness: 0.92,
      roughness: 0.28,
    });
    this.bezelRim = new THREE.Mesh(rimGeo, this.rimMaterial);
    this.bezelRim.position.y = -0.035;
    this.group.add(this.bezelRim);

    // 4. Central Acoustic Transducer Exciter & Isolation Stand
    this.transducerStand = new THREE.Group();

    this.standMaterial = new THREE.MeshStandardMaterial({
      color: 0x080c12,
      metalness: 0.94,
      roughness: 0.35,
    });

    // Central Driver Horn / Standoff Post
    const hornGeo = new THREE.CylinderGeometry(0.22, 0.38, 0.42, 32);
    const driverHorn = new THREE.Mesh(hornGeo, this.standMaterial);
    driverHorn.position.y = -0.22;
    this.transducerStand.add(driverHorn);

    // Base Acoustic Isolation Ring Footing
    const baseGeo = new THREE.CylinderGeometry(0.75, 0.90, 0.12, 32);
    const baseFooting = new THREE.Mesh(baseGeo, this.standMaterial);
    baseFooting.position.y = -0.44;
    this.transducerStand.add(baseFooting);

    // Accent Acoustic Illuminator Ring
    const ringGeo = new THREE.TorusGeometry(0.55, 0.02, 16, 48);
    ringGeo.rotateX(Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: initialPalette.accent.clone(),
      transparent: true,
      opacity: 0.7,
    });
    const accentRing = new THREE.Mesh(ringGeo, ringMat);
    accentRing.name = 'accentRing';
    accentRing.position.y = -0.38;
    this.transducerStand.add(accentRing);

    this.group.add(this.transducerStand);
  }

  private isAutoModal = true;
  private smoothedModes: THREE.Vector3 = new THREE.Vector3(2.0, 3.0, 1.0);

  public setAutoModal(auto: boolean): void {
    this.isAutoModal = auto;
    if (auto) {
      this.smoothedModes.copy(this.modes);
    }
  }

  public getAutoModal(): boolean {
    return this.isAutoModal;
  }

  public update(
    time: number,
    bands: THREE.Vector4,
    highs: THREE.Vector2,
    fundamentalHz: number,
    dt: number = 0.016,
    _camera?: THREE.Camera
  ): void {
    if (!this.group.visible) return;

    const u = this.plateMaterial.uniforms;
    u.uTime.value = time;
    u.uBandEnergies.value.copy(bands);
    u.uHighEnergies.value.copy(highs);
    u.uFundamentalFreq.value = fundamentalHz > 20 ? fundamentalHz : (bands.x + bands.y + bands.z > 0.05 ? 220.0 : 432.0);

    if (this.isAutoModal) {
      // Continuous pitch log-scale harmonic modal synthesis (Smooth, zero integer jumping)
      const effectiveHz = fundamentalHz > 20 ? fundamentalHz : 110.0;
      const logFreq = Math.max(0, Math.log2(effectiveHz / 35.0));
      const baseHarmonic = 1.0 + logFreq * 0.75;

      const dynamicN = Math.max(1.0, Math.min(8.0, baseHarmonic + bands.x * 2.2 + bands.y * 1.5));
      const dynamicM = Math.max(1.0, Math.min(8.0, baseHarmonic * 1.15 + bands.z * 2.5 + highs.x * 1.8));

      // Framerate-independent continuous modal ballistics (120Hz/60Hz consistency)
      const clampedDt = Math.max(0.001, Math.min(dt || 0.016, 0.1));
      const factor = 1.0 - Math.exp(-8.0 * clampedDt);

      this.smoothedModes.x += (dynamicN - this.smoothedModes.x) * factor;
      this.smoothedModes.y += (dynamicM - this.smoothedModes.y) * factor;
      this.smoothedModes.z = 1.0;

      u.uModes.value.copy(this.smoothedModes);
      this.modes.copy(this.smoothedModes);
    } else {
      this.smoothedModes.copy(this.modes);
      u.uModes.value.copy(this.modes);
    }

    // Update Dust Particles uniforms
    const du = this.dustMaterial.uniforms;
    du.uTime.value = time;
    du.uBandEnergies.value.copy(bands);
    du.uHighEnergies.value.copy(highs);
    du.uFundamentalFreq.value = u.uFundamentalFreq.value;
    du.uModes.value.copy(u.uModes.value);
  }

  public getModes(): THREE.Vector3 {
    return this.modes.clone();
  }

  public setModes(n: number, m: number, l: number = 1.0): void {
    this.isAutoModal = false;
    this.modes.set(n, m, l);
    this.smoothedModes.set(n, m, l);
    this.plateMaterial.uniforms.uModes.value.copy(this.modes);
    this.dustMaterial.uniforms.uModes.value.copy(this.modes);
  }

  public setModalNumbers(n: number, m: number, l: number = 1.0): void {
    this.setModes(n, m, l);
  }

  public setFrequency(freq: number): void {
    if (this.plateMaterial.uniforms.uFundamentalFreq) {
      this.plateMaterial.uniforms.uFundamentalFreq.value = freq;
    }
  }

  public setChamberType(type: 'square' | 'circle' | 'sphere' | 'cylinder' | number): void {
    this.chamberType = type === 'circle' || type === 'sphere' || type === 'cylinder' || type === 1 || type === 2 ? 1.0 : 0.0;
    this.plateMaterial.uniforms.uChamberType.value = this.chamberType;
    this.dustMaterial.uniforms.uChamberType.value = this.chamberType;

    if (this.bezelRim) {
      this.bezelRim.geometry.dispose();
      if (this.chamberType === 1.0) {
        const radius = (this.plateDiameter + 0.08) * 0.5;
        this.bezelRim.geometry = new THREE.CylinderGeometry(radius, radius, 0.06, 64);
      } else {
        this.bezelRim.geometry = new THREE.BoxGeometry(this.plateDiameter + 0.12, 0.06, this.plateDiameter + 0.12);
      }
    }
  }

  public setChamberGeometry(type: any): void {
    const isCircle = type === 'circle' || type === 'cylinder' || type === 'sphere' || type === 1 || type === 2;
    this.setChamberType(isCircle ? 'circle' : 'square');
  }

  public setWaveSpeed(speed: number): void {
    this.waveSpeed = speed;
    this.plateMaterial.uniforms.uWaveSpeed.value = speed;
    this.dustMaterial.uniforms.uWaveSpeed.value = speed;
  }

  public setWaveDamping(damping: number): void {
    this.waveDamping = damping;
    this.plateMaterial.uniforms.uWaveDamping.value = damping;
    this.dustMaterial.uniforms.uWaveDamping.value = damping;
  }

  public setParticleDensity(count: number): void {
    this.currentDustCount = Math.min(Math.max(1024, count), this.maxDustCount);
    this.dustGeometry.setDrawRange(0, this.currentDustCount);
  }

  public setParticleCount(count: number): void {
    this.setParticleDensity(count);
  }

  public setParticleScale(scale: number): void {
    this.particleScale = scale;
    this.dustMaterial.uniforms.uParticleScale.value = scale;
  }

  public setPalette(palette: PalettePreset): void {
    const u = this.plateMaterial.uniforms;
    u.uPaletteA.value.copy(palette.a);
    u.uPaletteB.value.copy(palette.b);
    u.uPaletteC.value.copy(palette.c);
    u.uPaletteD.value.copy(palette.d);
    u.uCoreGlow.value.copy(palette.coreGlow);
    u.uAccent.value.copy(palette.accent);

    const du = this.dustMaterial.uniforms;
    du.uPaletteA.value.copy(palette.a);
    du.uPaletteB.value.copy(palette.b);
    du.uPaletteC.value.copy(palette.c);
    du.uPaletteD.value.copy(palette.d);
    du.uCoreGlow.value.copy(palette.coreGlow);
    du.uAccent.value.copy(palette.accent);

    const accentRing = this.transducerStand.getObjectByName('accentRing') as THREE.Mesh;
    if (accentRing && accentRing.material instanceof THREE.MeshBasicMaterial) {
      accentRing.material.color.copy(palette.accent);
    }
  }

  public setVisible(visible: boolean): void {
    this.group.visible = visible;
  }

  public isVisible(): boolean {
    return this.group.visible;
  }

  public dispose(): void {
    this.plateMesh.geometry.dispose();
    this.plateMaterial.dispose();
    this.dustGeometry.dispose();
    this.dustMaterial.dispose();
    this.bezelRim.geometry.dispose();
    this.rimMaterial.dispose();

    this.transducerStand.traverse(child => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else if (child.material) {
          child.material.dispose();
        }
      }
    });
  }
}
