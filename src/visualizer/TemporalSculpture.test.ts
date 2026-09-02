import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ColorPalettes } from './ColorPalettes';
import { HistoryTexture } from './HistoryTexture';
import { TemporalSculpture } from './TemporalSculpture';

describe('TemporalSculpture', () => {
  it('builds a deterministic volumetric sound-memory point field', () => {
    const history = new HistoryTexture();
    const sculpture = new TemporalSculpture(ColorPalettes.getPalette('cosmic-nebula'), 4096);

    expect(sculpture.group).toBeDefined();
    expect(sculpture.getPointCount()).toBe(4096);
    expect(sculpture.points.geometry.getAttribute('aRadius').count).toBe(4096);

    sculpture.dispose();
    history.dispose();
  });

  it('accepts live band, pitch, and camera updates without reallocating geometry', () => {
    const history = new HistoryTexture();
    const sculpture = new TemporalSculpture(ColorPalettes.getPalette('cosmic-nebula'), 4096);
    const originalPosition = sculpture.points.geometry.getAttribute('position');

    sculpture.update(
      1.5,
      new THREE.Vector4(0.8, 0.5, 0.3, 0.2),
      new THREE.Vector2(0.1, 0.05),
      432,
      new THREE.PerspectiveCamera()
    );

    expect(sculpture.points.geometry.getAttribute('position')).toBe(originalPosition);

    sculpture.dispose();
    history.dispose();
  });
});
