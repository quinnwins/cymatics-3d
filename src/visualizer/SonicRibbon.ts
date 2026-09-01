import * as THREE from 'three';
import { SONIC_RIBBON_VERTEX_SHADER, SONIC_RIBBON_FRAGMENT_SHADER } from './shaders/sonicRibbonShader';
import { PalettePreset } from './ColorPalettes';

export class SonicRibbon {
  public group: THREE.Group;
  private mesh: THREE.Mesh;
  private material: THREE.ShaderMaterial;

  constructor(historyTexture: THREE.Texture, initialPalette: PalettePreset) {
    this.group = new THREE.Group();

    // Dense grid for ribbon surface: segments U (longitudinal) = 180, segments V (transverse) = 24
    const geo = new THREE.PlaneGeometry(1, 1, 180, 24);

    this.material = new THREE.ShaderMaterial({
      vertexShader: SONIC_RIBBON_VERTEX_SHADER,
      fragmentShader: SONIC_RIBBON_FRAGMENT_SHADER,
      uniforms: {
        uTime: { value: 0 },
        uPropagationSpeed: { value: 6.0 },
        uHistoryHead: { value: 0 },
        uAudioHistory: { value: historyTexture },
        uBandEnergies: { value: new THREE.Vector4() },
        uHighEnergies: { value: new THREE.Vector2() },
        uPaletteA: { value: initialPalette.a.clone() },
        uPaletteB: { value: initialPalette.b.clone() },
        uPaletteC: { value: initialPalette.c.clone() },
        uPaletteD: { value: initialPalette.d.clone() },
        uCoreGlow: { value: initialPalette.coreGlow.clone() },
        uAccent: { value: initialPalette.accent.clone() },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      side: THREE.DoubleSide,
    });

    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.frustumCulled = false;
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 20.0);
    this.group.add(this.mesh);
  }

  public update(time: number, historyHead: number, bands: THREE.Vector4, highs: THREE.Vector2): void {
    const u = this.material.uniforms;
    u.uTime.value = time;
    u.uHistoryHead.value = historyHead;
    u.uBandEnergies.value.copy(bands);
    u.uHighEnergies.value.copy(highs);
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

  public setVisible(visible: boolean): void {
    this.group.visible = visible;
  }
}
