import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { CymaticsMesh } from './CymaticsMesh';
import { ColorPalettes } from './ColorPalettes';

describe('CymaticsMesh - 3D Levitating Acoustic Fluid Droplet', () => {
  const palette = ColorPalettes.getPalette('cosmic-nebula');

  it('instantiates properly with 3D droplet geometry and inner core', () => {
    const mesh = new CymaticsMesh(palette);
    expect(mesh.group).toBeDefined();
    expect(mesh.mesh).toBeDefined();
    expect(mesh.innerCore).toBeDefined();
    expect(mesh.group.children.length).toBeGreaterThanOrEqual(2);
  });

  it('correctly sets modal wave numbers (n, m, l)', () => {
    const mesh = new CymaticsMesh(palette);
    mesh.setModes(3, 4, 2);
    const modes = mesh.getModes();
    expect(modes.x).toBe(3);
    expect(modes.y).toBe(4);
    expect(modes.z).toBe(2);
  });

  it('supports chamber geometry types (cube, cylinder, sphere)', () => {
    const mesh = new CymaticsMesh(palette);
    mesh.setChamberType('cube');
    mesh.setChamberType('cylinder');
    mesh.setChamberType('sphere');
    mesh.setGeometry('cube');
  });

  it('updates smoothly with audio and camera parameters', () => {
    const mesh = new CymaticsMesh(palette);
    mesh.setFrequency(432);
    mesh.setAcousticPressure(1.2);
    mesh.setHarmonicMultiplier(1.5);
    const bands = new THREE.Vector4(0.5, 0.4, 0.3, 0.2);
    const highs = new THREE.Vector2(0.1, 0.05);
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 3, 9);

    mesh.update(1.0, bands, highs, 432, 0.016, camera);
    expect(mesh.group.position.y).toBeGreaterThan(0.4);
  });

  it('supports toggling droplet mesh visibility independently', () => {
    const mesh = new CymaticsMesh(palette);
    expect(mesh.isDropletVisible()).toBe(true);

    mesh.setDropletVisible(false);
    expect(mesh.isDropletVisible()).toBe(false);
    expect(mesh.mesh.visible).toBe(false);
    expect(mesh.innerCore.visible).toBe(false);

    mesh.setDropletVisible(true);
    expect(mesh.isDropletVisible()).toBe(true);
    expect(mesh.mesh.visible).toBe(true);
    expect(mesh.innerCore.visible).toBe(true);
  });
});

// Read the phase that the vertex shader actually consumes; the fallback is the
// original time-times-frequency implementation, retained here to prove the bug.
function breathingPhase(mesh: CymaticsMesh): number {
  const u = (mesh.mesh.material as THREE.ShaderMaterial).uniforms;
  return u.uDrivePhases ? u.uDrivePhases.value.x :
    (u.uFundamentalFreq.value * 0.02 + u.uBandEnergies.value.x * 6) * u.uTime.value * 2;
}

describe('driven phase continuity', () => {
  it('does not rewrite elapsed phase when detected pitch changes', () => {
    const mesh = new CymaticsMesh(ColorPalettes.getPalette('cosmic-nebula'));
    const bands = new THREE.Vector4(0.2, 0.1, 0, 0);
    mesh.update(80, bands, new THREE.Vector2(), 220, 0.01);
    const before = breathingPhase(mesh);
    mesh.update(80, bands, new THREE.Vector2(), 440, 0);
    expect(breathingPhase(mesh)).toBeCloseTo(before, 10);
    mesh.update(80.01, bands, new THREE.Vector2(), 440, 0.01);
    expect(breathingPhase(mesh) - before).toBeCloseTo((440 * 0.02 + 0.2 * 6) * 2 * 0.01, 8);
    mesh.dispose();
  });
});
