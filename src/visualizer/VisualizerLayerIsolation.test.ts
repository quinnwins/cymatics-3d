import { describe, it, expect } from 'vitest';
import { ColorPalettes } from './ColorPalettes';
import { CymaticsMesh } from './CymaticsMesh';
import { CymaticsPlateMesh } from './CymaticsPlateMesh';
import { GpuAcousticParticles } from './GpuAcousticParticles';
import * as THREE from 'three';

describe('Cymatics Layer Isolation', () => {
  const palette = ColorPalettes.getPalette('cosmic-nebula');

  it('correctly toggles cymaticsMesh visibility', () => {
    const cymaticsMesh = new CymaticsMesh(palette);
    expect(cymaticsMesh.isVisible()).toBe(true);

    cymaticsMesh.setVisible(false);
    expect(cymaticsMesh.isVisible()).toBe(false);

    cymaticsMesh.setVisible(true);
    expect(cymaticsMesh.isVisible()).toBe(true);
  });

  it('keeps droplet and innerCore synced on setDropletVisible', () => {
    const cymaticsMesh = new CymaticsMesh(palette);
    cymaticsMesh.setDropletVisible(false);
    expect(cymaticsMesh.mesh.visible).toBe(false);
    expect(cymaticsMesh.innerCore.visible).toBe(false);

    cymaticsMesh.setDropletVisible(true);
    expect(cymaticsMesh.mesh.visible).toBe(true);
    expect(cymaticsMesh.innerCore.visible).toBe(true);
  });

  it('ensures all cymatics meshes can be hidden simultaneously for specialized labs', () => {
    const cymaticsMesh = new CymaticsMesh(palette);
    const plateMesh = new CymaticsPlateMesh(palette);
    const mockRenderer = {} as THREE.WebGLRenderer;
    const particles = new GpuAcousticParticles(mockRenderer, palette, { particleCount: 1024 });

    cymaticsMesh.setVisible(false);
    plateMesh.setVisible(false);
    particles.setVisible(false);

    expect(cymaticsMesh.isVisible()).toBe(false);
    expect(plateMesh.isVisible()).toBe(false);
    expect(particles.isVisible()).toBe(false);
  });
});
