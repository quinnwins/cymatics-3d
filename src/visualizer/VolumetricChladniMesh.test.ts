import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { VolumetricChladniMesh } from './VolumetricChladniMesh';
import { ColorPalettes } from './ColorPalettes';

describe('VolumetricChladniMesh', () => {
  const palette = ColorPalettes.getPalette('cosmic-nebula');

  it('instantiates properly and defaults to rectangular chamber', () => {
    const mesh = new VolumetricChladniMesh(palette);
    expect(mesh.group).toBeDefined();
    expect(mesh.getChamberType()).toBe(0);
  });

  it('switches chamber types between rectangular (0), cylindrical (1), and spherical (2)', () => {
    const mesh = new VolumetricChladniMesh(palette);
    mesh.setChamberType('cylindrical');
    expect(mesh.getChamberType()).toBe(1);
    expect(mesh.material.uniforms.uChamberType.value).toBe(1);

    mesh.setChamberType('spherical');
    expect(mesh.getChamberType()).toBe(2);
    expect(mesh.material.uniforms.uChamberType.value).toBe(2);

    mesh.setChamberType('rectangular');
    expect(mesh.getChamberType()).toBe(0);
    expect(mesh.material.uniforms.uChamberType.value).toBe(0);
  });

  it('updates uniforms during animation loop', () => {
    const mesh = new VolumetricChladniMesh(palette);
    const bands = new THREE.Vector4(0.8, 0.6, 0.4, 0.2);
    const highs = new THREE.Vector2(0.1, 0.05);

    mesh.update(2.5, bands, highs, 432);
    expect(mesh.material.uniforms.uTime.value).toBe(2.5);
    expect(mesh.material.uniforms.uBandEnergies.value.x).toBe(0.8);
    expect(mesh.material.uniforms.uFundamentalFreq.value).toBe(432);
  });
});
