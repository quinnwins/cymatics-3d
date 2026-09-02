import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { GpuAcousticParticles } from './GpuAcousticParticles';
import { ColorPalettes } from './ColorPalettes';

describe('GpuAcousticParticles', () => {
  const palette = ColorPalettes.getPalette('cosmic-nebula');

  it('instantiates properly and sets up geometry attributes', () => {
    const mockRenderer = {} as THREE.WebGLRenderer;
    const particles = new GpuAcousticParticles(mockRenderer, palette, { particleCount: 1024 });

    expect(particles.group).toBeDefined();
    expect(particles.isVisible()).toBe(true);
  });

  it('switches between cube, cylinder, and sphere chamber geometries', () => {
    const mockRenderer = {} as THREE.WebGLRenderer;
    const particles = new GpuAcousticParticles(mockRenderer, palette, { particleCount: 1024 });

    particles.setChamberGeometry('cylinder');
    particles.setChamberGeometry('sphere');
    particles.setChamberGeometry('cube');
  });

  it('supports toggling normal and inverse Chladni trapping modes', () => {
    const mockRenderer = {} as THREE.WebGLRenderer;
    const particles = new GpuAcousticParticles(mockRenderer, palette, { particleCount: 1024 });

    particles.setChladniMode('inverse');
    expect(particles.getChladniMode()).toBe('inverse');

    particles.setChladniMode('normal');
    expect(particles.getChladniMode()).toBe('normal');
  });

  it('updates animation and audio uniforms properly', () => {
    const mockRenderer = {} as THREE.WebGLRenderer;
    const particles = new GpuAcousticParticles(mockRenderer, palette, { particleCount: 1024 });

    const bands = new THREE.Vector4(0.5, 0.4, 0.3, 0.2);
    const highs = new THREE.Vector2(0.1, 0.05);
    const shockwaves = [
      new THREE.Vector4(0, 0, 0, 0),
      new THREE.Vector4(0, 0, 0, 0),
      new THREE.Vector4(0, 0, 0, 0),
      new THREE.Vector4(0, 0, 0, 0),
    ];

    particles.update(1.5, 0.016, bands, highs, shockwaves, 432);
  });

  it('aligns concentrically at y = 0.45', () => {
    const mockRenderer = {} as THREE.WebGLRenderer;
    const particles = new GpuAcousticParticles(mockRenderer, palette, { particleCount: 1024 });
    expect(particles.group.position.y).toBeCloseTo(0.45, 2);
  });

  it('supports toggling equilibrium and dynamic simulation modes', () => {
    const mockRenderer = {} as THREE.WebGLRenderer;
    const particles = new GpuAcousticParticles(mockRenderer, palette, { particleCount: 1024 });

    expect(particles.getSimulationMode()).toBe('equilibrium');
    particles.setSimulationMode('dynamic');
    expect(particles.getSimulationMode()).toBe('dynamic');
  });

  it('updates acoustic contrast when medium or particle material changes', () => {
    const mockRenderer = {} as THREE.WebGLRenderer;
    const particles = new GpuAcousticParticles(mockRenderer, palette, { particleCount: 1024 });

    particles.setMedium('water');
    particles.setParticleMaterial('polystyrene');
    // Polystyrene in water has positive acoustic contrast
    expect((particles as any).acousticContrast).toBeGreaterThan(0);

    particles.setParticleMaterial('airBubble');
    // Air bubble in water has negative acoustic contrast
    expect((particles as any).acousticContrast).toBeLessThan(0);
  });

  it('updates exact NIST Bessel derivative roots when modal numbers change', () => {
    const mockRenderer = {} as THREE.WebGLRenderer;
    const particles = new GpuAcousticParticles(mockRenderer, palette, { particleCount: 1024 });

    particles.setModalNumbers(1, 1, 1);
    const u = (particles as any).renderMaterial.uniforms;
    // alpha'_{1,1} = 1.841184
    expect(u.uRadialRoot.value).toBeCloseTo(1.841184, 4);
    // xi'_{1,1} = 2.081576
    expect(u.uSphericalRoot.value).toBeCloseTo(2.081576, 4);
  });
});
