import * as THREE from 'three';
import { temporalMemory } from './TemporalMemory';

/**
 * GPU audio spatiotemporal ring-buffer texture.
 *
 * Stores 512 spectral bins across 512 fixed-rate history frames.
 * Encodes:
 * - R: normalized spectral magnitude [0..2.5]
 * - G: signed spectral motion, remapped to [0..1]
 * - B: transient / bass impulse [0..1]
 * - A: normalized pitch [0..1]
 */
export class HistoryTexture {
  public texture: THREE.DataTexture;
  public readonly width = 512;
  public readonly height = 512;
  public readonly captureRateHz = 48;

  private data: Float32Array;
  private previousMagnitudes: Float32Array;
  private writeHead = 0;
  private lastWriteAt = -Infinity;

  constructor() {
    this.data = new Float32Array(this.width * this.height * 4);
    this.previousMagnitudes = new Float32Array(this.width);

    this.texture = new THREE.DataTexture(
      this.data,
      this.width,
      this.height,
      THREE.RGBAFormat,
      THREE.FloatType
    );
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.wrapS = THREE.ClampToEdgeWrapping;
    this.texture.wrapT = THREE.RepeatWrapping;
    this.texture.generateMipmaps = false;
    this.texture.needsUpdate = true;

    temporalMemory.registerTexture(this.texture, this.height);
  }

  public pushSpectralFrame(
    fftData: Float32Array,
    transientOnset: number,
    pitchHz: number
  ): number {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const normalizedCurrentHead = (this.writeHead + 0.5) / this.height;

    if (!temporalMemory.shouldCapture()) {
      temporalMemory.recordIdle();
      return normalizedCurrentHead;
    }

    const minimumInterval = 1000 / this.captureRateHz;
    if (now - this.lastWriteAt < minimumInterval) {
      return normalizedCurrentHead;
    }
    this.lastWriteAt = now;

    const row = this.writeHead;
    const rowOffset = row * this.width * 4;
    const safePitchHz = Number.isFinite(pitchHz) ? Math.max(0, pitchHz) : 0;
    const pitchNorm = Math.min(1, safePitchHz / 4000);
    const safeBassImpulse = Number.isFinite(transientOnset)
      ? Math.max(0, Math.min(1, transientOnset))
      : 0;

    let peakSignal = 0;
    let positiveFlux = 0;

    for (let i = 0; i < this.width; i += 1) {
      const idx = rowOffset + i * 4;
      const rawDb = fftData[i];
      const db = Number.isFinite(rawDb) ? rawDb : -100;
      const magnitude = db > -90 ? Math.pow(10, (db + 10) / 45) : 0;
      const safeMagnitude = Number.isFinite(magnitude)
        ? Math.max(0, Math.min(2.5, magnitude))
        : 0;

      const previous = this.previousMagnitudes[i];
      const delta = safeMagnitude - previous;
      const signedMotion = 0.5 + Math.max(-0.5, Math.min(0.5, delta * 0.65));
      positiveFlux += Math.max(0, delta);
      peakSignal = Math.max(peakSignal, safeMagnitude);

      this.data[idx + 0] = safeMagnitude;
      this.data[idx + 1] = signedMotion;
      this.data[idx + 2] = 0;
      this.data[idx + 3] = pitchNorm;
      this.previousMagnitudes[i] = safeMagnitude;
    }

    const normalizedFlux = Math.min(1, (positiveFlux / this.width) * 10);
    const impulse = Math.min(1, safeBassImpulse * 0.55 + normalizedFlux * 0.9);
    for (let i = 0; i < this.width; i += 1) {
      this.data[rowOffset + i * 4 + 2] = impulse;
    }

    this.texture.needsUpdate = true;
    temporalMemory.recordFrame(row, Math.min(1, peakSignal * 0.85 + impulse * 0.35), now);
    this.writeHead = (this.writeHead + 1) % this.height;

    return (row + 0.5) / this.height;
  }

  public getWriteHead(): number {
    return this.writeHead;
  }

  public clear(): void {
    this.data.fill(0);
    this.previousMagnitudes.fill(0);
    this.texture.needsUpdate = true;
    this.writeHead = 0;
    this.lastWriteAt = -Infinity;
    temporalMemory.recordFrame(0, 0);
  }

  public dispose(): void {
    this.texture.dispose();
  }
}
