import * as THREE from 'three';

export interface PalettePreset {
  id: string;
  name: string;
  a: THREE.Vector3;
  b: THREE.Vector3;
  c: THREE.Vector3;
  d: THREE.Vector3;
  coreGlow: THREE.Color;
  accent: THREE.Color;
}

export class ColorPalettes {
  public static readonly PALETTES: Record<string, PalettePreset> = {
    'cosmic-nebula': {
      id: 'cosmic-nebula',
      name: '🌌 Cosmic Nebula',
      a: new THREE.Vector3(0.5, 0.5, 0.5),
      b: new THREE.Vector3(0.5, 0.5, 0.5),
      c: new THREE.Vector3(1.0, 1.0, 1.0),
      d: new THREE.Vector3(0.00, 0.33, 0.67),
      coreGlow: new THREE.Color('#00f2fe'),
      accent: new THREE.Color('#7928ca'),
    },
    'cyber-violet': {
      id: 'cyber-violet',
      name: '⚡ Cyber Violet',
      a: new THREE.Vector3(0.8, 0.5, 0.4),
      b: new THREE.Vector3(0.2, 0.4, 0.2),
      c: new THREE.Vector3(2.0, 1.0, 1.0),
      d: new THREE.Vector3(0.00, 0.25, 0.25),
      coreGlow: new THREE.Color('#f355da'),
      accent: new THREE.Color('#00f2fe'),
    },
    'solar-flare': {
      id: 'solar-flare',
      name: '🔥 Solar Flare',
      a: new THREE.Vector3(0.5, 0.5, 0.5),
      b: new THREE.Vector3(0.5, 0.5, 0.5),
      c: new THREE.Vector3(2.0, 1.0, 0.0),
      d: new THREE.Vector3(0.50, 0.20, 0.25),
      coreGlow: new THREE.Color('#ffb300'),
      accent: new THREE.Color('#ff3d00'),
    },
    'bioluminescent': {
      id: 'bioluminescent',
      name: '🌿 Bioluminescent Deep',
      a: new THREE.Vector3(0.5, 0.5, 0.5),
      b: new THREE.Vector3(0.5, 0.5, 0.5),
      c: new THREE.Vector3(1.0, 1.0, 0.5),
      d: new THREE.Vector3(0.80, 0.90, 0.30),
      coreGlow: new THREE.Color('#00f5a0'),
      accent: new THREE.Color('#00d2ff'),
    },
    'prismatic-crystal': {
      id: 'prismatic-crystal',
      name: '💎 Prismatic Crystal',
      a: new THREE.Vector3(0.5, 0.5, 0.5),
      b: new THREE.Vector3(0.5, 0.5, 0.5),
      c: new THREE.Vector3(1.0, 1.0, 1.0),
      d: new THREE.Vector3(0.30, 0.20, 0.80),
      coreGlow: new THREE.Color('#ffffff'),
      accent: new THREE.Color('#f355da'),
    },
  };

  public static getPalette(id: string): PalettePreset {
    return this.PALETTES[id] || this.PALETTES['cosmic-nebula'];
  }
}
