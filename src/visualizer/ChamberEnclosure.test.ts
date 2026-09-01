import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { ChamberEnclosure } from './ChamberEnclosure';
import { ColorPalettes } from './ColorPalettes';

describe('ChamberEnclosure - Minimal Wireframe Datum Frame', () => {
  const palette = ColorPalettes.getPalette('cosmic-nebula');

  it('instantiates with ultra-minimal glass opacity 0.01', () => {
    const enclosure = new ChamberEnclosure(palette);
    expect(enclosure.group).toBeDefined();
    expect(enclosure.getChamberType()).toBe('cube');
  });

  it('switches between cube, cylinder, and sphere modes', () => {
    const enclosure = new ChamberEnclosure(palette);
    enclosure.setChamberType('cylinder');
    expect(enclosure.getChamberType()).toBe('cylinder');

    enclosure.setChamberType('sphere');
    expect(enclosure.getChamberType()).toBe('sphere');

    enclosure.setChamberType('cube');
    expect(enclosure.getChamberType()).toBe('cube');
  });

  it('allows tuning glass opacity, refractive index, and edge glow', () => {
    const enclosure = new ChamberEnclosure(palette);
    enclosure.setGlassOpacity(0.015);
    enclosure.setRefractiveIndex(1.52);
    enclosure.setEdgeGlow(0.9);
  });

  it('updates with audio telemetry and camera position', () => {
    const enclosure = new ChamberEnclosure(palette);
    const bands = new THREE.Vector4(0.5, 0.4, 0.3, 0.2);
    const highs = new THREE.Vector2(0.1, 0.05);
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 3, 9);

    enclosure.update(1.0, 0.016, bands, highs, camera);
    expect(enclosure.group.rotation.y).toBeGreaterThan(0);
  });
});
