import * as THREE from 'three';
import { WAVEFRONT_VERTEX_SHADER, WAVEFRONT_FRAGMENT_SHADER } from './shaders/wavefrontShader';
import { PalettePreset } from './ColorPalettes';

export class WavefrontShells {
  public group: THREE.Group;
  private material: THREE.ShaderMaterial;
  private shells: THREE.Mesh[] = [];
  private shellCount = 8;

  constructor(historyTexture: THREE.Texture, initialPalette: PalettePreset) {
    this.group = new THREE.Group();

    this.material = new THREE.ShaderMaterial({
      vertexShader: WAVEFRONT_VERTEX_SHADER,
      fragmentShader: WAVEFRONT_FRAGMENT_SHADER,
      uniforms: {
        uTime: { value: 0 },
        uPropagationSpeed: { value: 6.0 },
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
        uWaveDamping: { value: 0.15 },
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
      side: THREE.FrontSide,
    });

    this.buildConcentricShells();
  }

  private buildConcentricShells(): void {
    const baseGeo = new THREE.IcosahedronGeometry(1.0, 4);
    const baseRadius = 1.2;
    const radiusStep = 0.9;

    for (let i = 0; i < this.shellCount; i++) {
      const radius = baseRadius + i * radiusStep;
      const geo = baseGeo.clone();
      geo.scale(radius, radius, radius);

      const count = geo.attributes.position.count;
      const shellIndices = new Float32Array(count).fill(i);
      const shellRadii = new Float32Array(count).fill(radius);

      geo.setAttribute('aShellIndex', new THREE.BufferAttribute(shellIndices, 1));
      geo.setAttribute('aShellRadius', new THREE.BufferAttribute(shellRadii, 1));

      const mesh = new THREE.Mesh(geo, this.material);
      this.shells.push(mesh);
      this.group.add(mesh);
    }
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

  public setPropagationSpeed(speed: number): void {
    this.material.uniforms.uPropagationSpeed.value = speed;
  }

  public setWaveDamping(damping: number): void {
    this.material.uniforms.uWaveDamping.value = damping;
  }

  public setVisible(visible: boolean): void {
    this.group.visible = visible;
  }

  public dispose(): void {
    for (const mesh of this.shells) {
      mesh.geometry.dispose();
    }
    this.material.dispose();
  }
}
