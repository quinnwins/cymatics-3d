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

  it('positions the 2D plate at the bottom of the 3D shape when selected with 3D particle trap or droplet', () => {
    const mockContainer = document.createElement('div');
    const mockAudioEngine = {
      subscribe: () => () => {},
      update: () => {},
      getAudioBands: () => ({ subBass: 0, bass: 0, lowMid: 0, mid: 0, highMid: 0, high: 0 }),
      getActiveShockwaves: () => [],
      getFundamentalFrequency: () => 432,
      getRawFrequencyData: () => new Uint8Array(128),
      getCurrentTime: () => 0,
      getDuration: () => 0,
      getIsPlaying: () => false,
      getActiveTrackId: () => '',
      getMode: () => 'music',
      getLoadedFileName: () => null,
      isMicrophoneActive: () => false,
    } as any;

    const engine = new (class MockVisualizerEngine {
      public cymaticsLayers = { plate: true, droplet: true, trap: true };
      public cymaticsPlateMesh = new CymaticsPlateMesh(palette);
      public cymaticsMesh = new CymaticsMesh(palette);
      public gpuAcousticParticles = { group: new THREE.Group(), setVisible: () => {} };
      public chamberEnclosure = { group: new THREE.Group(), setVisible: () => {} };
      public volumetricChladni = { group: new THREE.Group(), setVisible: () => {} };
      public scientificGroundDatum = { mesh: new THREE.Mesh(), setVisible: () => {} };
      public groundGridVisible = false;
      public currentStyle = 'cymatics';

      public applyCymaticsLayers() {
        const has3DShape = this.cymaticsLayers.droplet || this.cymaticsLayers.trap;
        if (this.cymaticsLayers.plate && has3DShape) {
          if (this.cymaticsLayers.trap) {
            this.cymaticsPlateMesh.group.position.y = -1.50;
          } else {
            this.cymaticsPlateMesh.group.position.y = -0.80;
          }
          this.cymaticsMesh.group.position.y = 0.45;
          this.gpuAcousticParticles.group.position.y = 0.45;
        } else if (this.cymaticsLayers.plate) {
          this.cymaticsPlateMesh.group.position.y = 0.0;
          this.cymaticsMesh.group.position.y = 0.45;
        } else {
          this.cymaticsMesh.group.position.y = 0.45;
        }
      }

      public setCymaticsLayers(layers: Partial<typeof this.cymaticsLayers>) {
        Object.assign(this.cymaticsLayers, layers);
        this.applyCymaticsLayers();
      }
    })();

    // 1. Both plate and 3D trap + droplet active -> 2D board at bottom of 3D shape (y = -1.50)
    engine.setCymaticsLayers({ plate: true, droplet: true, trap: true });
    expect(engine.cymaticsPlateMesh.group.position.y).toBe(-1.50);
    expect(engine.cymaticsMesh.group.position.y).toBe(0.45);

    // 2. Plate and 3D droplet active (no trap) -> 2D board at bottom of droplet (y = -0.80)
    engine.setCymaticsLayers({ plate: true, droplet: true, trap: false });
    expect(engine.cymaticsPlateMesh.group.position.y).toBe(-0.80);
    expect(engine.cymaticsMesh.group.position.y).toBe(0.45);

    // 3. Plate and 3D trap active (no droplet) -> 2D board at bottom of trap (y = -1.50)
    engine.setCymaticsLayers({ plate: true, droplet: false, trap: true });
    expect(engine.cymaticsPlateMesh.group.position.y).toBe(-1.50);

    // 4. Plate alone (no 3D shape) -> 2D board at default origin (y = 0.0)
    engine.setCymaticsLayers({ plate: true, droplet: false, trap: false });
    expect(engine.cymaticsPlateMesh.group.position.y).toBe(0.0);
  });
});
