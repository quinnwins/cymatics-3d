import { describe, it, expect } from 'vitest';
import type { CameraMode, VisualizerEngine, VisualStyle } from '../visualizer/VisualizerEngine';
import { PhysicsDrawer } from './PhysicsDrawer';

function createMockVisualizer(): VisualizerEngine {
  return {
    getStyle: () => 'hybrid' as VisualStyle,
    setStyle: (_s: VisualStyle) => {},
    getCameraMode: () => 'orbit' as CameraMode,
    setCameraMode: (_m: CameraMode) => {},
    setPalette: (_p: string) => {},
    getCurrentPaletteId: () => 'solfeggio-gold',
    waveSpeed: 5.0,
    waveDamping: 0.12,
    bloomStrength: 0.8,
    particleScale: 1.0,
    particleDensity: 131072,
    cymaticsVisibilityMode: 'both',
    groundGridVisible: false,
    getGroundGridVisible: () => false,
    setGroundGridVisible: (_v: boolean) => {},
    setBloomStrength: (_b: number) => {},
    setParticleDensity: (_d: number) => {},
    setParticleScale: (_s: number) => {},
    setCymaticsVisibilityMode: (_m: 'both' | 'particles' | 'droplet') => {},
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
}

describe('Camera & Physics Interaction Architecture', () => {
  it('supports all 4 standard 3D camera modes', () => {
    const validModes: CameraMode[] = ['orbit', 'autocam', 'emitter-lock', 'top-down'];
    expect(validModes).toContain('orbit');
    expect(validModes).toContain('autocam');
    expect(validModes).toContain('emitter-lock');
    expect(validModes).toContain('top-down');
  });

  it('correctly handles camera mode events across event targets', () => {
    const target = new EventTarget();
    let receivedMode: string | null = null;
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent<{ mode: CameraMode }>;
      receivedMode = customEvent.detail?.mode || null;
    };

    target.addEventListener('camera-mode-changed', handler);
    target.dispatchEvent(new CustomEvent('camera-mode-changed', { detail: { mode: 'orbit' } }));

    expect(receivedMode).toBe('orbit');
    target.removeEventListener('camera-mode-changed', handler);
  });

  it('renders 6 render style buttons in music mode including Cymatics 2D', () => {
    let selectedStyle: VisualStyle | null = null;
    const visualizer = createMockVisualizer();
    visualizer.setStyle = (s: VisualStyle) => {
      selectedStyle = s;
    };
    const drawer = new PhysicsDrawer(visualizer);
    drawer.setMode('music');

    const el = drawer.getElement();
    const styleButtons = el.querySelectorAll('.btn-style');
    expect(styleButtons.length).toBe(6);
    expect(el.querySelector('#slider-wave-speed')).not.toBeNull();
    expect(el.querySelector('#slider-wave-damping')).not.toBeNull();
    expect(el.querySelector('#slider-particle-density')).not.toBeNull();

    const cymatics2dBtn = el.querySelector('[data-style="cymatics-2d"]') as HTMLElement;
    expect(cymatics2dBtn).not.toBeNull();
    expect(cymatics2dBtn.textContent?.trim()).toBe('Cymatics 2D');

    cymatics2dBtn.click();
    expect(selectedStyle).toBe('cymatics-2d');
  });

  it('hides render style buttons in specialized lab modes (voice, therapy, nobel, bio)', () => {
    const visualizer = createMockVisualizer();
    const drawer = new PhysicsDrawer(visualizer);

    const specializedModes = ['voice', 'therapy', 'nobel', 'bio'] as const;
    for (const mode of specializedModes) {
      drawer.setMode(mode);
      const el = drawer.getElement();
      const styleButtons = el.querySelectorAll('.btn-style');
      expect(styleButtons.length).toBe(0);
      expect(el.querySelector('#btn-toggle-nested-visuals')).toBeNull();
      expect(el.querySelector('#slider-wave-speed')).toBeNull();
      // Camera modes and glow remain accessible
      expect(el.querySelectorAll('.btn-cam-mode').length).toBe(4);
      expect(el.querySelector('#slider-bloom')).not.toBeNull();
    }
  });

  it('hides render style buttons but preserves theme, particle density, and apparatus toggle in modal (Cymatics) mode', () => {
    const visualizer = createMockVisualizer();
    const drawer = new PhysicsDrawer(visualizer);
    drawer.setMode('modal');

    const el = drawer.getElement();
    expect(el.querySelectorAll('.btn-style').length).toBe(0);
    expect(el.querySelector('#theme-selector')).not.toBeNull();
    expect(el.querySelector('#slider-particle-density')).not.toBeNull();
    expect(el.querySelector('#slider-particle-scale')).not.toBeNull();
    expect(el.querySelectorAll('.btn-cymatics-app').length).toBe(3);
    expect(el.querySelector('#slider-wave-speed')).toBeNull();
    expect(el.querySelectorAll('.btn-cam-mode').length).toBe(4);
  });

  it('provides full option parity in frequency (Tone Lab) mode matching Cymatics', () => {
    const visualizer = createMockVisualizer();
    const drawer = new PhysicsDrawer(visualizer);
    drawer.setMode('frequency');

    const el = drawer.getElement();
    expect(el.querySelectorAll('.btn-style').length).toBe(0);
    expect(el.querySelector('#theme-selector')).not.toBeNull();
    expect(el.querySelector('#slider-particle-density')).not.toBeNull();
    expect(el.querySelector('#slider-particle-scale')).not.toBeNull();
    expect(el.querySelectorAll('.btn-cymatics-app').length).toBe(3);
    expect(el.querySelector('#slider-wave-speed')).toBeNull();
    expect(el.querySelectorAll('.btn-cam-mode').length).toBe(4);
    expect(el.querySelector('#slider-bloom')).not.toBeNull();
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
});
