import { beforeEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ColorPalettes } from './ColorPalettes';
import { HistoryTexture } from './HistoryTexture';
import { temporalMemory } from './TemporalMemory';
import { TemporalSculpture } from './TemporalSculpture';

describe('TemporalSculpture', () => {
  beforeEach(() => {
    localStorage.clear();
    temporalMemory.reset();
  });

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

  it('freezes the complete visual state while the live input keeps changing', () => {
    const history = new HistoryTexture();
    const sculpture = new TemporalSculpture(ColorPalettes.getPalette('cosmic-nebula'), 4096);
    const internals = sculpture as unknown as {
      material: THREE.ShaderMaterial;
    };

    sculpture.update(
      2,
      new THREE.Vector4(0.85, 0.55, 0.35, 0.15),
      new THREE.Vector2(0.12, 0.04),
      432
    );

    temporalMemory.setFrozen(true);
    sculpture.update(
      8,
      new THREE.Vector4(0.05, 0.02, 0.01, 0),
      new THREE.Vector2(0, 0),
      110
    );

    expect(internals.material.uniforms.uTime.value).toBe(2);
    expect(internals.material.uniforms.uBandEnergies.value.x).toBeCloseTo(0.85);
    expect(internals.material.uniforms.uHighEnergies.value.x).toBeCloseTo(0.12);
    expect(internals.material.uniforms.uFundamentalHz.value).toBe(432);

    sculpture.dispose();
    history.dispose();
  });
});
