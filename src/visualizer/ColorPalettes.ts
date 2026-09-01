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
  coreIntensity?: number;
  accentIntensity?: number;
  dispersion?: number;
  causticTint?: THREE.Color;
}

export class ColorPalettes {
  public static readonly PALETTES: Record<string, PalettePreset> = {
    'cosmic-nebula': {
      id: 'cosmic-nebula',
      name: '🌌 Celestial Indigo',
      a: new THREE.Vector3(0.50, 0.50, 0.50),
      b: new THREE.Vector3(0.50, 0.50, 0.50),
      c: new THREE.Vector3(1.00, 1.00, 1.00),
      d: new THREE.Vector3(0.00, 0.33, 0.67),
      coreGlow: new THREE.Color('#5E5CE6'), // Apple Indigo
      accent: new THREE.Color('#00F0FF'),   // Electric Cyan Specular
      coreIntensity: 4.8,
      accentIntensity: 3.4,
      dispersion: 0.038,
      causticTint: new THREE.Color('#64D2FF'),
    },
    'siri-luminescence': {
      id: 'siri-luminescence',
      name: '✨ Siri Luminescence',
      a: new THREE.Vector3(0.80, 0.50, 0.60),
      b: new THREE.Vector3(0.30, 0.40, 0.30),
      c: new THREE.Vector3(1.50, 1.00, 1.00),
      d: new THREE.Vector3(0.00, 0.25, 0.50),
      coreGlow: new THREE.Color('#FF375F'), // Apple Rose Magenta
      accent: new THREE.Color('#00F5D4'),   // Siri Mint Cyan
      coreIntensity: 5.4,
      accentIntensity: 3.8,
      dispersion: 0.048,
      causticTint: new THREE.Color('#BF5AF2'),
    },
    'solar-flare': {
      id: 'solar-flare',
      name: '🔥 Solar Amber',
      a: new THREE.Vector3(0.50, 0.50, 0.50),
      b: new THREE.Vector3(0.50, 0.50, 0.50),
      c: new THREE.Vector3(2.00, 1.00, 0.00),
      d: new THREE.Vector3(0.50, 0.20, 0.25),
      coreGlow: new THREE.Color('#FF9F0A'), // Apple Amber
      accent: new THREE.Color('#FF453A'),   // Apple Coral
      coreIntensity: 6.2,
      accentIntensity: 4.2,
      dispersion: 0.045,
      causticTint: new THREE.Color('#FFD60A'),
    },
    'bioluminescent': {
      id: 'bioluminescent',
      name: '🌿 Boreal Emerald',
      a: new THREE.Vector3(0.50, 0.50, 0.50),
      b: new THREE.Vector3(0.50, 0.50, 0.50),
      c: new THREE.Vector3(1.00, 1.00, 0.50),
      d: new THREE.Vector3(0.80, 0.90, 0.30),
      coreGlow: new THREE.Color('#30D158'), // Apple Mint
      accent: new THREE.Color('#64D2FF'),   // Sky Blue
      coreIntensity: 4.6,
      accentIntensity: 3.2,
      dispersion: 0.035,
      causticTint: new THREE.Color('#30D158'),
    },
    'prismatic-crystal': {
      id: 'prismatic-crystal',
      name: '💎 Pearlescent Quartz',
      a: new THREE.Vector3(0.60, 0.60, 0.65),
      b: new THREE.Vector3(0.40, 0.40, 0.35),
      c: new THREE.Vector3(1.00, 1.00, 1.00),
      d: new THREE.Vector3(0.20, 0.30, 0.70),
      coreGlow: new THREE.Color('#FFFFFF'), // Pure Specular
      accent: new THREE.Color('#C084FC'),   // Opal Lavender
      coreIntensity: 7.0,
      accentIntensity: 3.6,
      dispersion: 0.065,
      causticTint: new THREE.Color('#70D7FF'),
    },
    'quantum-void': {
      id: 'quantum-void',
      name: '🌌 Abyssal Void',
      a: new THREE.Vector3(0.25, 0.30, 0.50),
      b: new THREE.Vector3(0.60, 0.40, 0.60),
      c: new THREE.Vector3(1.00, 1.50, 2.00),
      d: new THREE.Vector3(0.10, 0.40, 0.70),
      coreGlow: new THREE.Color('#AF52DE'), // Deep Violet
      accent: new THREE.Color('#5AC8FA'),   // Electric Aqua
      coreIntensity: 5.6,
      accentIntensity: 3.8,
      dispersion: 0.055,
      causticTint: new THREE.Color('#BF5AF2'),
    },
  };

  public static getPalette(id: string): PalettePreset {
    return this.PALETTES[id] || this.PALETTES['cosmic-nebula'];
  }
}

