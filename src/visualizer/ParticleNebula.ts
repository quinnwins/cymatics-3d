import * as THREE from 'three';
import { PARTICLE_VERTEX_SHADER, PARTICLE_FRAGMENT_SHADER } from './shaders/particleShader';
import { PalettePreset } from './ColorPalettes';

export class ParticleNebula {
  public group: THREE.Group;
  private points: THREE.Points;
  private material: THREE.ShaderMaterial;
  private readonly particleCount = 131072; // 2^17 particles for optimal GPU warp occupancy

  constructor(historyTexture: THREE.Texture, initialPalette: PalettePreset) {
    this.group = new THREE.Group();

    const geometry = this.buildFibonacciMultiShellGeometry();

    this.material = new THREE.ShaderMaterial({
      vertexShader: PARTICLE_VERTEX_SHADER,
      fragmentShader: PARTICLE_FRAGMENT_SHADER,
      uniforms: {
        uTime: { value: 0 },
        uPropagationSpeed: { value: 6.5 },
        uHistoryHead: { value: 0 },
        uAudioHistory: { value: historyTexture },
        uBandEnergies: { value: new THREE.Vector4() },
        uHighEnergies: { value: new THREE.Vector2() },
        uShockwaves: {
          value: [
            new THREE.Vector4(0, 0, 7.5, 0),
            new THREE.Vector4(0, 0, 7.5, 0),
            new THREE.Vector4(0, 0, 7.5, 0),
            new THREE.Vector4(0, 0, 7.5, 0),
          ],
        },
        uPaletteA: { value: initialPalette.a.clone() },
        uPaletteB: { value: initialPalette.b.clone() },
        uPaletteC: { value: initialPalette.c.clone() },
        uPaletteD: { value: initialPalette.d.clone() },
        uCoreGlow: { value: initialPalette.coreGlow.clone() },
        uAccent: { value: initialPalette.accent.clone() },
        uParticleScale: { value: 1.0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.points = new THREE.Points(geometry, this.material);
    this.group.add(this.points);
  }

  private buildFibonacciMultiShellGeometry(): THREE.BufferGeometry {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(this.particleCount * 3);
    const particleFreqs = new Float32Array(this.particleCount);
    const particlePhases = new Float32Array(this.particleCount);
    const shellRadii = new Float32Array(this.particleCount);

    const goldenRatio = (1 + Math.sqrt(5)) / 2;
    const angleIncrement = Math.PI * 2 * goldenRatio;
    const numShells = 24;
    const particlesPerShell = Math.floor(this.particleCount / numShells);

    let idx = 0;
    for (let s = 0; s < numShells; s++) {
      const baseR = 1.0 + s * 0.32;
      const freqNorm = Math.pow(s / (numShells - 1), 1.2); // Logarithmic frequency assignment

      for (let p = 0; p < particlesPerShell && idx < this.particleCount; p++) {
        const inclination = Math.acos(1 - 2 * ((p + 0.5) / particlesPerShell));
        const azimuth = angleIncrement * p;

        const jitter = (Math.random() - 0.5) * 0.08;
        const r = baseR + jitter;

        const x = r * Math.sin(inclination) * Math.cos(azimuth);
        const y = r * Math.cos(inclination);
        const z = r * Math.sin(inclination) * Math.sin(azimuth);

        positions[idx * 3 + 0] = x;
        positions[idx * 3 + 1] = y;
        positions[idx * 3 + 2] = z;

        particleFreqs[idx] = freqNorm;
        particlePhases[idx] = Math.random();
        shellRadii[idx] = r;

        idx++;
      }
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aParticleFreq', new THREE.BufferAttribute(particleFreqs, 1));
    geo.setAttribute('aParticlePhase', new THREE.BufferAttribute(particlePhases, 1));
    geo.setAttribute('aShellRadius', new THREE.BufferAttribute(shellRadii, 1));

    return geo;
  }

  public update(time: number, historyHead: number, bands: THREE.Vector4, highs: THREE.Vector2, shockwaves: THREE.Vector4[]): void {
    const u = this.material.uniforms;
    u.uTime.value = time;
    u.uHistoryHead.value = historyHead;
    u.uBandEnergies.value.copy(bands);
    u.uHighEnergies.value.copy(highs);

    for (let i = 0; i < 4; i++) {
      if (shockwaves[i]) {
        (u.uShockwaves.value[i] as THREE.Vector4).copy(shockwaves[i]);
      }
    }

    // Slow orbital rotation
    this.points.rotation.y = time * 0.04;
    this.points.rotation.z = Math.sin(time * 0.03) * 0.1;
  }

  public setPalette(palette: PalettePreset): void {
    const u = this.material.uniforms;
    u.uPaletteA.value.copy(palette.a);
    u.uPaletteB.value.copy(palette.b);
    u.uPaletteC.value.copy(palette.c);
    u.uPaletteD.value.copy(palette.d);
    u.uCoreGlow.value.copy(palette.coreGlow);
    u.uAccent.value.copy(palette.accent);
  }

  public setParticleScale(scale: number): void {
    this.material.uniforms.uParticleScale.value = scale;
  }

  public setParticleDensity(count: number): void {
    const clamped = Math.max(1024, Math.min(this.particleCount, Math.round(count)));
    if (this.points && this.points.geometry) {
      this.points.geometry.setDrawRange(0, clamped);
    }
  }

  public setParticleCount(count: number): void {
    this.setParticleDensity(count);
  }

  public setPropagationSpeed(speed: number): void {
    this.material.uniforms.uPropagationSpeed.value = speed;
  }

  public setVisible(visible: boolean): void {
    this.group.visible = visible;
  }

  public dispose(): void {
    this.points.geometry.dispose();
    this.material.dispose();
  }
}
