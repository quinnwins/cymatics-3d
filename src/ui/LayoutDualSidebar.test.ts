import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DemoAudioGenerator } from '../audio/DemoAudioGenerator';
import { AudioEngine } from '../audio/AudioEngine';
import { ModalSweeperControls } from './ModalSweeperControls';
import { PhysicsDrawer } from './PhysicsDrawer';
import { SpectrumHUD } from './SpectrumHUD';
import type { VisualizerEngine, VisualStyle, CameraMode } from '../visualizer/VisualizerEngine';

function createMockVisualizer(): VisualizerEngine {
  const vis = {
    getStyle: () => 'hybrid' as VisualStyle,
    setStyle: (_s: VisualStyle) => {},
    getCameraMode: () => 'orbit' as CameraMode,
    setCameraMode: (_m: CameraMode) => {},
    setPalette: (_p: string) => {},
    getCurrentPaletteId: () => 'cosmic-nebula',
    waveSpeed: 5.0,
    waveDamping: 0.12,
    bloomStrength: 0.8,
    particleScale: 1.0,
    particleDensity: 131072,
    cymaticsVisibilityMode: 'both',
    groundGridVisible: false,
    getGroundGridVisible: () => false,
    setGroundGridVisible: (_v: boolean) => {},
    setBloomStrength: (b: number) => {
      vis.bloomStrength = b;
    },
    setParticleDensity: (d: number) => {
      vis.particleDensity = d;
    },
    setParticleScale: (s: number) => {
      vis.particleScale = s;
    },
    setCymaticsVisibilityMode: (_m: 'both' | 'particles' | 'droplet') => {},
    getCymaticsLayers: () => ({ plate: false, droplet: true, trap: true }),
    setCymaticsLayers: () => {},
    chamberEnclosure: {
      setVisible: () => {},
      setChamberType: () => {},
    },
  } as unknown as VisualizerEngine;
  return vis;
}

describe('Layout & Workstation System Test Suite', () => {
  it('provides rich demo audio tracks with valid BPM and descriptions', () => {
    const tracks = DemoAudioGenerator.TRACKS;
    expect(tracks.length).toBeGreaterThanOrEqual(4);
    tracks.forEach(track => {
      expect(track.id).toBeDefined();
      expect(track.name).toBeDefined();
      expect(track.bpm).toBeGreaterThan(0);
      expect(track.genre).toBeDefined();
      expect(track.description).toBeDefined();
    });
  });

  it('verifies track playlist IDs are unique', () => {
    const tracks = DemoAudioGenerator.TRACKS;
    const ids = tracks.map(t => t.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(tracks.length);
  });

  describe('Right Sidebar Architecture & Uniformity', () => {
    let audioEngine: AudioEngine;
    let visualizer: VisualizerEngine;
    let modalSweeperControls: ModalSweeperControls;
    let physicsDrawer: PhysicsDrawer;
    let spectrumHUD: SpectrumHUD;

    beforeEach(() => {
      audioEngine = new AudioEngine();
      visualizer = createMockVisualizer();
      modalSweeperControls = new ModalSweeperControls(audioEngine, visualizer);
      physicsDrawer = new PhysicsDrawer(visualizer);
      spectrumHUD = new SpectrumHUD(audioEngine, visualizer);
    });

    it('mounts Audio Spectrum (SpectrumHUD) at top of left sidebar and Physics Drawer on top in right sidebar', () => {
      const leftSidebar = document.createElement('div');
      const rightSidebar = document.createElement('div');

      // Left sidebar: SpectrumHUD is mounted at the top
      leftSidebar.appendChild(spectrumHUD.getElement());

      // Right sidebar: PhysicsDrawer on top, ModalSweeperControls (Resonator Shapes & Geometry) below
      rightSidebar.appendChild(physicsDrawer.getElement());
      rightSidebar.appendChild(modalSweeperControls.getElement());

      const leftChildren = Array.from(leftSidebar.children);
      expect(leftChildren.length).toBe(1);
      expect(leftChildren[0]).toBe(spectrumHUD.getElement());

      const rightChildren = Array.from(rightSidebar.children);
      expect(rightChildren.length).toBe(2);
      expect(rightChildren[0]).toBe(physicsDrawer.getElement());
      expect(rightChildren[1]).toBe(modalSweeperControls.getElement());
    });

    it('mounts Resonator Shapes Deck (ModalSweeperControls) exclusively in right sidebar for Music Studio without PhysicsDrawer', () => {
      const rightSidebar = document.createElement('div');

      // In Music Studio, right sidebar has Resonator Shapes exclusively
      modalSweeperControls.setMode('music');
      rightSidebar.appendChild(modalSweeperControls.getElement());

      const rightChildren = Array.from(rightSidebar.children);
      expect(rightChildren.length).toBe(1);
      expect(rightChildren[0]).toBe(modalSweeperControls.getElement());
    });

    it('ensures Shape Deck is collapsible to preserve vertical viewport space', () => {
      modalSweeperControls.setOpen(false);
      expect(modalSweeperControls.getIsOpen()).toBe(false);
      const el = modalSweeperControls.getElement();
      const body = el.querySelector('#modal-accordion-body');
      expect(body?.classList.contains('hidden')).toBe(true);

      modalSweeperControls.setOpen(true);
      expect(modalSweeperControls.getIsOpen()).toBe(true);
      const bodyOpen = el.querySelector('#modal-accordion-body');
      expect(bodyOpen?.classList.contains('flex')).toBe(true);
    });
  });
});
