import * as THREE from 'three';
import { CYMATICS_VERTEX_SHADER, CYMATICS_FRAGMENT_SHADER } from './shaders/cymaticsShader';
import { PalettePreset } from './ColorPalettes';

export class CymaticsMesh {
  public group: THREE.Group;
  private mesh: THREE.Mesh;
  private material: THREE.ShaderMaterial;

  constructor(initialPalette: PalettePreset) {
    this.group = new THREE.Group();

    // High tessellation geosphere for crisp standing wave nodal deformations
    const geo = new THREE.IcosahedronGeometry(2.5, 6);

    this.material = new THREE.ShaderMaterial({
      vertexShader: CYMATICS_VERTEX_SHADER,
      fragmentShader: CYMATICS_FRAGMENT_SHADER,
      uniforms: {
        uTime: { value: 0 },
        uBandEnergies: { value: new THREE.Vector4() },
        uHighEnergies: { value: new THREE.Vector2() },
        uFundamentalFreq: { value: 432 },
        uHarmonicMultiplier: { value: 1.2 },
        uWavenumber: { value: 2.2 },
        uPaletteA: { value: initialPalette.a.clone() },
        uPaletteB: { value: initialPalette.b.clone() },
        uPaletteC: { value: initialPalette.c.clone() },
        uPaletteD: { value: initialPalette.d.clone() },
        uCoreGlow: { value: initialPalette.coreGlow.clone() },
        uAccent: { value: initialPalette.accent.clone() },
      },
      transparent: true,
      depthWrite: true,
      blending: THREE.NormalBlending,
      side: THREE.DoubleSide,
    });

    this.mesh = new THREE.Mesh(geo, this.material);
    this.group.add(this.mesh);

    // Inner glowing core sphere
    const innerGeo = new THREE.SphereGeometry(0.8, 32, 32);
    const innerMat = new THREE.MeshBasicMaterial({
      color: initialPalette.coreGlow,
      transparent: true,
      opacity: 0.85,
    });
    const innerCore = new THREE.Mesh(innerGeo, innerMat);
    this.group.add(innerCore);
  }

  public update(time: number, bands: THREE.Vector4, highs: THREE.Vector2, fundamentalHz: number): void {
    const u = this.material.uniforms;
    u.uTime.value = time;
    u.uBandEnergies.value.copy(bands);
    u.uHighEnergies.value.copy(highs);
    u.uFundamentalFreq.value = fundamentalHz;

    // Slow rotation
    this.mesh.rotation.y = time * 0.1;
    this.mesh.rotation.x = Math.sin(time * 0.05) * 0.2;
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

  public setHarmonicMultiplier(mult: number): void {
    this.material.uniforms.uHarmonicMultiplier.value = mult;
  }

  public setWavenumber(k: number): void {
    this.material.uniforms.uWavenumber.value = k;
  }

  public setVisible(visible: boolean): void {
    this.group.visible = visible;
  }
}
