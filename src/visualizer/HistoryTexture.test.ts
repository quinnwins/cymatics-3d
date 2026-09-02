import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { HistoryTexture } from './HistoryTexture';
import { temporalMemory } from './TemporalMemory';

describe('HistoryTexture', () => {
  let now = 1000;

  beforeEach(() => {
    localStorage.clear();
    temporalMemory.setEnabled(true);
    temporalMemory.setFrozen(false);
    now = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('captures at a stable rate instead of rewriting the full texture every display frame', () => {
    const history = new HistoryTexture();
    const spectrum = new Float32Array(2048).fill(-40);

    history.pushSpectralFrame(spectrum, 0, 220);
    expect(history.getWriteHead()).toBe(1);

    now += 5;
    history.pushSpectralFrame(spectrum, 0, 220);
    expect(history.getWriteHead()).toBe(1);

    now += 20;
    history.pushSpectralFrame(spectrum, 0, 220);
    expect(history.getWriteHead()).toBe(2);

    history.dispose();
  });

  it('uses a compact byte texture and samples through the top of the available FFT', () => {
    const history = new HistoryTexture();
    const spectrum = new Float32Array(2048).fill(-100);
    spectrum[spectrum.length - 1] = -10;

    history.pushSpectralFrame(spectrum, 0.2, 440);

    expect(history.texture.type).toBe(THREE.UnsignedByteType);
    const bytes = (history as unknown as { data: Uint8Array }).data;
    const finalBinMagnitude = bytes[(history.width - 1) * 4];
    expect(finalBinMagnitude).toBeGreaterThan(0);

    history.dispose();
  });

  it('expands ordinary musical levels into a visible temporal field', () => {
    const history = new HistoryTexture();
    const ordinaryMusic = new Float32Array(2048).fill(-45);

    history.pushSpectralFrame(ordinaryMusic, 0, 220);

    const bytes = (history as unknown as { data: Uint8Array }).data;
    expect(bytes[0]).toBeGreaterThan(85);
    expect(bytes[0]).toBeLessThan(130);
    expect(temporalMemory.getUniformState().signal).toBeGreaterThan(0.1);

    history.dispose();
  });

  it('does not let AudioEngine’s pre-playback zero buffer consume temporal history', () => {
    const history = new HistoryTexture();
    const uninitializedSpectrum = new Float32Array(2048);

    for (let frame = 0; frame < 100; frame += 1) {
      now += 25;
      history.pushSpectralFrame(uninitializedSpectrum, 0, 0);
    }

    const bytes = (history as unknown as { data: Uint8Array }).data;
    for (let i = 0; i < history.width; i += 1) {
      expect(bytes[i * 4]).toBe(0);
      expect(bytes[i * 4 + 2]).toBe(0);
    }
    const state = temporalMemory.getUniformState();
    expect(history.getWriteHead()).toBe(0);
    expect(state.availableFrames).toBe(0);
    expect(state.signal).toBe(0);

    history.dispose();
  });
});
