import { describe, it, expect } from 'vitest';
import type { CameraMode, VisualizerEngine, VisualStyle } from '../visualizer/VisualizerEngine';
import { ViewportCameraThemeHUD } from './ViewportCameraThemeHUD';

function createMockVisualizer(): VisualizerEngine {
  let camMode: CameraMode = 'autocam';
  let paletteId = 'cosmic-nebula';
  let gridVisible = false;

  const vis = {
    getStyle: () => 'hybrid' as VisualStyle,
    setStyle: (_s: VisualStyle) => {},
    getCameraMode: () => camMode,
    setCameraMode: (m: CameraMode) => {
      camMode = m;
    },
    setPalette: (p: string) => {
      paletteId = p;
    },
    getCurrentPaletteId: () => paletteId,
    waveSpeed: 6.0,
    waveDamping: 0.12,
    bloomStrength: 0.22,
    particleScale: 1.0,
    particleDensity: 131072,
    groundGridVisible: false,
    getGroundGridVisible: () => gridVisible,
    setGroundGridVisible: (v: boolean) => {
      gridVisible = v;
    },
    setBloomStrength: (b: number) => {
      vis.bloomStrength = b;
    },
    setParticleDensity: (d: number) => {
      vis.particleDensity = d;
    },
    setParticleScale: (s: number) => {
      vis.particleScale = s;
    },
  } as unknown as VisualizerEngine;
  return vis;
}

describe('ViewportCameraThemeHUD Component with Nested Dropdowns & Optics Flyout', () => {
  it('renders theme and camera dropdowns with active values', () => {
    const visualizer = createMockVisualizer();
    const hud = new ViewportCameraThemeHUD(visualizer);
    const el = hud.getElement();

    const themeSelect = el.querySelector('#viewport-theme-selector') as HTMLSelectElement;
    expect(themeSelect).not.toBeNull();
    expect(themeSelect.value).toBe('cosmic-nebula');

    const cameraSelect = el.querySelector('#viewport-camera-selector') as HTMLSelectElement;
    expect(cameraSelect).not.toBeNull();
    expect(cameraSelect.value).toBe('autocam');
    expect(cameraSelect.options.length).toBe(4);

    const opticsBtn = el.querySelector('#btn-toggle-hud-optics') as HTMLElement;
    expect(opticsBtn).not.toBeNull();
    expect(opticsBtn.textContent).toContain('Optics');
  });

  it('switches camera mode on dropdown change and dispatches global event', () => {
    const visualizer = createMockVisualizer();
    const hud = new ViewportCameraThemeHUD(visualizer);
    const el = hud.getElement();

    let emittedMode: string | null = null;
    const listener = (e: Event) => {
      const customEvent = e as CustomEvent<{ mode: CameraMode }>;
      emittedMode = customEvent.detail?.mode || null;
    };
    window.addEventListener('camera-mode-changed', listener);

    const cameraSelect = el.querySelector('#viewport-camera-selector') as HTMLSelectElement;
    cameraSelect.value = 'orbit';
    cameraSelect.dispatchEvent(new Event('change'));

    expect(visualizer.getCameraMode()).toBe('orbit');
    expect(emittedMode).toBe('orbit');

    window.removeEventListener('camera-mode-changed', listener);
  });

  it('toggles the Optics flyout popover on button click', () => {
    const visualizer = createMockVisualizer();
    const hud = new ViewportCameraThemeHUD(visualizer);

    expect(hud.getIsOpticsOpen()).toBe(false);
    expect(hud.getElement().querySelector('#hud-optics-popover')).toBeNull();

    const opticsBtn = hud.getElement().querySelector('#btn-toggle-hud-optics') as HTMLElement;
    opticsBtn.click();

    expect(hud.getIsOpticsOpen()).toBe(true);
    expect(hud.getElement().querySelector('#hud-optics-popover')).not.toBeNull();

    // Close via close button in popover
    const closeBtn = hud.getElement().querySelector('#btn-close-hud-optics') as HTMLElement;
    closeBtn.click();

    expect(hud.getIsOpticsOpen()).toBe(false);
    expect(hud.getElement().querySelector('#hud-optics-popover')).toBeNull();
  });

  it('allows adjusting visual optics sliders inside the flyout', () => {
    const visualizer = createMockVisualizer();
    const hud = new ViewportCameraThemeHUD(visualizer);
    hud.setOpticsOpen(true);

    const el = hud.getElement();
    const bloomSlider = el.querySelector('#hud-slider-bloom') as HTMLInputElement;
    expect(bloomSlider).not.toBeNull();

    bloomSlider.value = '0.85';
    bloomSlider.dispatchEvent(new Event('input'));
    expect(visualizer.bloomStrength).toBe(0.85);

    const densitySlider = el.querySelector('#hud-slider-particle-density') as HTMLInputElement;
    expect(densitySlider).not.toBeNull();

    densitySlider.value = '262144';
    densitySlider.dispatchEvent(new Event('input'));
    expect(visualizer.particleDensity).toBe(262144);
  });

  it('resets visualizer and UI state to defaults via HUD reset button', () => {
    const visualizer = createMockVisualizer();
    visualizer.bloomStrength = 0.99;
    visualizer.particleScale = 1.9;

    const hud = new ViewportCameraThemeHUD(visualizer);
    hud.resetVisuals();

    expect(visualizer.bloomStrength).toBe(0.22);
    expect(visualizer.particleScale).toBe(1.0);
    expect(visualizer.waveSpeed).toBe(6.0);
    expect(visualizer.getCameraMode()).toBe('autocam');
  });
});
