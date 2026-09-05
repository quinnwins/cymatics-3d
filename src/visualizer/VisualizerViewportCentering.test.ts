import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as THREE from 'three';
import { VisualizerEngine } from './VisualizerEngine';
import { AudioEngine } from '../audio/AudioEngine';

describe('VisualizerEngine Viewport Centering & Optical Alignment', () => {
  let container: HTMLDivElement;
  let overlay: HTMLDivElement;
  let audioEngine: AudioEngine;
  let engine: VisualizerEngine;
  let origInnerWidth: number;
  let origInnerHeight: number;

  beforeEach(() => {
    origInnerWidth = window.innerWidth;
    origInnerHeight = window.innerHeight;
    Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: 610, writable: true });

    container = document.createElement('div');
    container.id = 'canvas-container';
    document.body.appendChild(container);

    overlay = document.createElement('div');
    overlay.id = 'center-viewport-overlay';
    // Mock getBoundingClientRect for overlay:
    // Left sidebar ends at 210, right sidebar starts at 813 -> width = 603, left = 210
    // Header ends at 56, transport bar starts at 532 -> height = 476, top = 56
    vi.spyOn(overlay, 'getBoundingClientRect').mockReturnValue({
      left: 210,
      right: 813,
      top: 56,
      bottom: 532,
      width: 603,
      height: 476,
      x: 210,
      y: 56,
      toJSON: () => {},
    });
    document.body.appendChild(overlay);

    audioEngine = new AudioEngine();
    engine = new VisualizerEngine(container, audioEngine);
  });

  afterEach(() => {
    engine?.dispose();
    container?.remove();
    overlay?.remove();
    Object.defineProperty(window, 'innerWidth', { value: origInnerWidth, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: origInnerHeight, writable: true });
    vi.restoreAllMocks();
  });

  it('keeps display and audio-analysis clocks aligned in the default energy view', () => {
    const runtime = engine as any;
    vi.spyOn(runtime.clock, 'getElapsedTime').mockReturnValue(100.02);
    vi.spyOn(audioEngine, 'getPlaybackSpeed').mockReturnValue(0.5);
    const audioUpdate = vi.spyOn(audioEngine, 'update');
    runtime.lastAnimTime = 100;
    runtime.audioTime = 5;
    engine.simTime = 5;
    runtime.animate();
    expect(engine.simTime).toBeCloseTo(5.02, 8);
    expect(audioUpdate.mock.calls.at(-1)?.[0]).toBeCloseTo(5.02, 8);
    expect(audioEngine.getPlaybackSpeed()).toBe(0.5);
  });

  it('calibrates initial camera position for balanced 3D isometric pitch', () => {
    expect(engine.camera.position.x).toBeCloseTo(0, 1);
    expect(engine.camera.position.y).toBeCloseTo(2.4, 0.5);
    expect(engine.camera.position.z).toBeGreaterThan(8.0);
    expect(engine.camera.position.z).toBeLessThan(10.0);
  });

  it('applies optical lens shift via setViewOffset to center shape in available aperture', () => {
    engine.updateViewportOffset();
    const view = engine.camera.view;
    expect(view).not.toBeNull();
    expect(view?.enabled).toBe(true);
    expect(view?.fullWidth).toBe(1024);
    expect(view?.fullHeight).toBe(610);
    // offX should balance the sidebars: (1024/2) - (210 + 603/2) = 512 - 511.5 = 0.5
    expect(view?.offsetX).toBeCloseTo(0.5, 1);
    // offY should compensate for top/bottom UI asymmetry and perspective pitch: (610/2) - (56 + 476/2) + 48 = 305 - 294 + 48 = 59
    expect(view?.offsetY).toBeCloseTo(59, 1);
  });

  it('clears view offset when switching to immersive mode and restores on exit', () => {
    engine.setImmersive(true);
    expect(engine.camera.view?.enabled).toBe(false);

    engine.setImmersive(false);
    expect(engine.camera.view?.enabled).toBe(true);
    expect(engine.camera.view?.offsetY).toBeGreaterThan(45);
  });

  it('handles window resize and updates view offset accordingly', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1440, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: 900, writable: true });

    vi.spyOn(overlay, 'getBoundingClientRect').mockReturnValue({
      left: 336,
      right: 1104,
      top: 68,
      bottom: 820,
      width: 768,
      height: 752,
      x: 336,
      y: 68,
      toJSON: () => {},
    });

    window.dispatchEvent(new Event('resize'));
    expect(engine.camera.view?.fullWidth).toBe(1440);
    expect(engine.camera.view?.fullHeight).toBe(900);
    expect(engine.camera.view?.enabled).toBe(true);
  });
});
