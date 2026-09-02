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

  it('normalizes ordinary browser playback levels into a visible dynamic range', () => {
    const history = new HistoryTexture();
    const spectrum = new Float32Array(2048).fill(-88);
    for (let index = 16; index < 340; index += 17) {
      spectrum[index] = -50 - (index % 5);
    }

    history.pushSpectralFrame(spectrum, 0.1, 330);

    const bytes = (history as unknown as { data: Uint8Array }).data;
    let peak = 0;
    for (let index = 0; index < history.width; index += 1) {
      peak = Math.max(peak, bytes[index * 4]);
    }

    expect(peak).toBeGreaterThan(140);
    // TemporalMemory deliberately eases its public signal to avoid flashing on
    // the first frame; even that eased first sample must enter a useful range.
    expect(temporalMemory.getUniformState().signal).toBeGreaterThan(0.2);

    history.dispose();
  });

  it('treats AudioEngine’s uninitialized zero-filled FFT buffer as silence', () => {
    const history = new HistoryTexture();
    const uninitializedSpectrum = new Float32Array(2048);

    history.pushSpectralFrame(uninitializedSpectrum, 0, 0);

    const bytes = (history as unknown as { data: Uint8Array }).data;
    for (let i = 0; i < history.width; i += 1) {
      expect(bytes[i * 4]).toBe(0);
      expect(bytes[i * 4 + 2]).toBe(0);
    }
    expect(temporalMemory.getUniformState().signal).toBe(0);

    history.dispose();
  });
});
