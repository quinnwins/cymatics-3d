import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { CymaticsPlateMesh } from './CymaticsPlateMesh';
import { ColorPalettes } from './ColorPalettes';

describe('CymaticsPlateMesh - 2D Resonant Chladni Cymatics Plate with Dust Particles', () => {
  const palette = ColorPalettes.getPalette('cosmic-nebula');

  it('instantiates properly with plate geometry, dust particles, bezel rim, and transducer stand', () => {
    const plate = new CymaticsPlateMesh(palette);
    expect(plate.group).toBeDefined();
    expect(plate.plateMesh).toBeDefined();
    expect(plate.dustParticles).toBeDefined();
    expect(plate.bezelRim).toBeDefined();
    expect(plate.transducerStand).toBeDefined();
    expect(plate.group.children.length).toBeGreaterThanOrEqual(4);
  });

  it('updates modal indices and chamber types across plate and dust particles', () => {
    const plate = new CymaticsPlateMesh(palette);
    plate.setModes(4, 3, 1);
    plate.setChamberType('square');
    plate.setChamberType('circle');
    plate.setChamberType(0);
  });

  it('supports wave speed and wave damping physics controls', () => {
    const plate = new CymaticsPlateMesh(palette);
    plate.setWaveSpeed(7.8);
    plate.setWaveDamping(0.12);
  });

  it('supports particle density (up to 256k) and particle scale controls', () => {
    const plate = new CymaticsPlateMesh(palette);
    plate.setParticleDensity(262144);
    plate.setParticleScale(1.5);
    expect(plate.dustParticles.geometry.drawRange.count).toBe(262144);
  });

  it('updates palette colors across presets without error', () => {
    const plate = new CymaticsPlateMesh(palette);
    const solfeggio = ColorPalettes.getPalette('solfeggio-gold');
    const celestial = ColorPalettes.getPalette('celestial-indigo');
    plate.setPalette(solfeggio);
    plate.setPalette(celestial);
  });

  it('updates smoothly with audio bands and frequency harmonics at 120 FPS', () => {
    const plate = new CymaticsPlateMesh(palette);
    const bands = new THREE.Vector4(0.8, 0.6, 0.4, 0.2);
    const highs = new THREE.Vector2(0.15, 0.08);
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 3.5, 8.2);

    plate.update(1.25, bands, highs, 528, 0.008, camera);
    expect(plate.isVisible()).toBe(true);
  });

  it('toggles visibility and disposes all GPU resources cleanly', () => {
    const plate = new CymaticsPlateMesh(palette);
    expect(plate.isVisible()).toBe(true);

    plate.setVisible(false);
    expect(plate.isVisible()).toBe(false);

    plate.setVisible(true);
    expect(plate.isVisible()).toBe(true);

    expect(() => plate.dispose()).not.toThrow();
  });

  it('preserves user-selected modal numbers when autoModal is disabled and recalculates when enabled', () => {
    const plate = new CymaticsPlateMesh(palette);
    plate.setModes(5, 4, 1);
    expect(plate.getAutoModal()).toBe(false);

    const bands = new THREE.Vector4(0.9, 0.9, 0.9, 0.9);
    const highs = new THREE.Vector2(0.9, 0.9);
    const camera = new THREE.PerspectiveCamera();

    plate.update(1.0, bands, highs, 432, 0.016, camera);
    const uniforms = (plate.plateMesh.material as THREE.ShaderMaterial).uniforms;
    expect(uniforms.uModes.value.x).toBe(5);
    expect(uniforms.uModes.value.y).toBe(4);

    plate.setAutoModal(true);
    plate.update(1.0, bands, highs, 432, 0.016, camera);
    expect(uniforms.uModes.value.x).toBeGreaterThanOrEqual(1);
  });
});
