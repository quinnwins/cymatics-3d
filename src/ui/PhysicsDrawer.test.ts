import { describe, it, expect } from 'vitest';
import type { CameraMode, VisualizerEngine, VisualStyle } from '../visualizer/VisualizerEngine';
import { PhysicsDrawer } from './PhysicsDrawer';

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
    setCymaticsLayers: (_l: any) => {},
    wavefrontShells: {
      setPropagationSpeed: (_v: number) => {},
      setWaveDamping: (_v: number) => {},
    },
    particleNebula: {
      setPropagationSpeed: (_v: number) => {},
      setParticleScale: (_v: number) => {},
      setParticleDensity: (_v: number) => {},
    },
    sonicRibbon: {
      setPropagationSpeed: (_v: number) => {},
    },
    gpuAcousticParticles: {
      setParticleScale: (_v: number) => {},
      setParticleDensity: (_v: number) => {},
      getParticleCount: () => 131072,
    },
  } as unknown as VisualizerEngine;
  return vis;
}

describe('Scene Optics & Physics Drawer Inspector', () => {
  it('renders streamlined direct optics and simulation controls in cymatics/music mode', () => {
    const visualizer = createMockVisualizer();
    const drawer = new PhysicsDrawer(visualizer);
    drawer.setMode('music');

    const el = drawer.getElement();
    expect(el.querySelector('#slider-wave-speed')).not.toBeNull();
    expect(el.querySelector('#slider-wave-damping')).not.toBeNull();
    expect(el.querySelector('#slider-bloom')).not.toBeNull();
    expect(el.querySelector('#slider-particle-density')).not.toBeNull();
    expect(el.querySelector('#slider-particle-scale')).not.toBeNull();
    expect(el.querySelector('#btn-toggle-ground-grid')).not.toBeNull();
    expect(el.querySelector('#btn-reset-physics-drawer')).not.toBeNull();
  });

  it('hides wave simulation controls in specialized lab modes (voice, therapy, nobel, bio) while keeping glow active', () => {
    const visualizer = createMockVisualizer();
    const drawer = new PhysicsDrawer(visualizer);

    const specializedModes = ['voice', 'therapy', 'nobel', 'bio'] as const;
    for (const mode of specializedModes) {
      drawer.setMode(mode);
      const el = drawer.getElement();
      expect(el.querySelector('#slider-wave-speed')).toBeNull();
      expect(el.querySelector('#slider-wave-damping')).toBeNull();
      // Glow and floor grid remain universally accessible
      expect(el.querySelector('#slider-bloom')).not.toBeNull();
      expect(el.querySelector('#btn-toggle-ground-grid')).not.toBeNull();
    }
  });

  it('preserves particle density and scale controls in tone/frequency mode', () => {
    const visualizer = createMockVisualizer();
    const drawer = new PhysicsDrawer(visualizer);
    drawer.setMode('frequency');

    const el = drawer.getElement();
    expect(el.querySelector('#slider-particle-density')).not.toBeNull();
    expect(el.querySelector('#slider-particle-scale')).not.toBeNull();
    expect(el.querySelector('#slider-bloom')).not.toBeNull();
    expect(el.querySelector('#slider-wave-speed')).toBeNull();
  });

  it('allows toggling the floor reference grid seamlessly', () => {
    let gridVisible = false;
    const visualizer = createMockVisualizer();
    visualizer.getGroundGridVisible = () => gridVisible;
    visualizer.setGroundGridVisible = (v: boolean) => {
      gridVisible = v;
    };
    const drawer = new PhysicsDrawer(visualizer);
    const el = drawer.getElement();

    const gridBtn = el.querySelector('#btn-toggle-ground-grid') as HTMLElement;
    expect(gridBtn).not.toBeNull();
    expect(gridBtn.textContent?.trim()).toBe('Off');

    gridBtn.click();
    expect(gridVisible).toBe(true);

    const updatedEl = drawer.getElement();
    const updatedGridBtn = updatedEl.querySelector('#btn-toggle-ground-grid') as HTMLElement;
    expect(updatedGridBtn.textContent?.trim()).toBe('✓ On');
  });

  it('resets visualizer parameters and UI state to factory defaults on resetDefaults()', () => {
    const visualizer = createMockVisualizer();
    visualizer.waveSpeed = 11.5;
    visualizer.waveDamping = 0.32;
    visualizer.bloomStrength = 0.95;
    visualizer.particleDensity = 262144;
    visualizer.particleScale = 1.8;

    let emittedCamMode: string | null = null;
    let emittedPaletteId: string | null = null;

    const camHandler = (e: Event) => {
      emittedCamMode = (e as CustomEvent<{ mode: string }>).detail?.mode || null;
    };
    const palHandler = (e: Event) => {
      emittedPaletteId = (e as CustomEvent<{ paletteId: string }>).detail?.paletteId || null;
    };

    window.addEventListener('camera-mode-changed', camHandler);
    window.addEventListener('palette-changed', palHandler);

    const drawer = new PhysicsDrawer(visualizer);
    drawer.resetDefaults();

    expect(visualizer.waveSpeed).toBe(6.0);
    expect(visualizer.waveDamping).toBe(0.12);
    expect(visualizer.bloomStrength).toBe(0.22);
    expect(visualizer.particleDensity).toBe(131072);
    expect(visualizer.particleScale).toBe(1.0);
    expect(emittedCamMode).toBe('autocam');
    expect(emittedPaletteId).toBe('cosmic-nebula');

    window.removeEventListener('camera-mode-changed', camHandler);
    window.removeEventListener('palette-changed', palHandler);
  });

  it('allows collapsing and expanding the accordion', () => {
    const visualizer = createMockVisualizer();
    const drawer = new PhysicsDrawer(visualizer);

    expect(drawer.getIsOpen()).toBe(true);
    const toggleBtn = drawer.getElement().querySelector('#btn-toggle-accordion-physics') as HTMLElement;
    expect(toggleBtn).not.toBeNull();

    toggleBtn.click();
    expect(drawer.getIsOpen()).toBe(false);
    expect(drawer.getElement().querySelector('#physics-body')?.classList.contains('hidden')).toBe(true);

    toggleBtn.click();
    expect(drawer.getIsOpen()).toBe(true);
    expect(drawer.getElement().querySelector('#physics-body')?.classList.contains('flex')).toBe(true);
  });
});
