import * as THREE from 'three';
import { temporalMemory } from './TemporalMemory';

/**
 * GPU audio spatiotemporal ring-buffer texture.
 *
 * Stores 512 log-distributed spectral samples across 512 fixed-rate history frames.
 * Encodes normalized unsigned-byte channels:
 * - R: perceptually expanded spectral magnitude
 * - G: signed spectral motion, remapped to [0..1]
 * - B: transient / bass impulse
 * - A: detected pitch
 */
export class HistoryTexture {
  public texture: THREE.DataTexture;
  public readonly width = 512;
  public readonly height = 512;
  public readonly captureRateHz = 48;

  private data: Uint8Array;
  private previousMagnitudes: Float32Array;
  private writeHead = 0;
  private lastWriteAt = -Infinity;

  constructor() {
    this.data = new Uint8Array(this.width * this.height * 4);
    this.previousMagnitudes = new Float32Array(this.width);

    this.texture = new THREE.DataTexture(
      this.data,
      this.width,
      this.height,
      THREE.RGBAFormat,
      THREE.UnsignedByteType
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

    // A frozen sculpture keeps both its pixels and its visible signal strength.
    if (!temporalMemory.shouldCapture()) {
      return normalizedCurrentHead;
    }

    if (fftData.length === 0) {
      temporalMemory.recordIdle();
      return normalizedCurrentHead;
    }

    // AudioEngine deliberately returns a zero-filled buffer before its analyser
    // exists. Web Audio uses negative dB values (or -Infinity) once initialized,
    // so an all-zero array is a transport sentinel—not a full-scale spectrum.
    // Do not write this sentinel into history: otherwise waiting before pressing
    // Play consumes the startup memory with artificial silent frames.
    let hasAnalyzerData = false;
    for (let i = 0; i < fftData.length; i += 1) {
      if (fftData[i] !== 0) {
        hasAnalyzerData = true;
        break;
      }
    }
    if (!hasAnalyzerData) {
      temporalMemory.recordIdle();
      return normalizedCurrentHead;
    }

    const minimumInterval = 1000 / this.captureRateHz;
    if (Number.isFinite(this.lastWriteAt)) {
      const elapsed = now - this.lastWriteAt;
      if (elapsed < minimumInterval) {
        return normalizedCurrentHead;
      }
      // Keep the capture clock on a fixed cadence. This alternates frame gaps
      // naturally on 60/120 Hz displays instead of collapsing to 30/40 Hz.
      const elapsedIntervals = Math.max(1, Math.floor(elapsed / minimumInterval));
      this.lastWriteAt += elapsedIntervals * minimumInterval;
    } else {
      this.lastWriteAt = now;
    }

    const row = this.writeHead;
    const rowOffset = row * this.width * 4;
    const safePitchHz = Number.isFinite(pitchHz) ? Math.max(0, pitchHz) : 0;
    const pitchNorm = Math.min(1, safePitchHz / 4000);
    const safeBassImpulse = Number.isFinite(transientOnset)
      ? Math.max(0, Math.min(1, transientOnset))
      : 0;

    let peakSignal = 0;
    let positiveFlux = 0;
    const sourceMax = fftData.length - 1;

    for (let i = 0; i < this.width; i += 1) {
      const idx = rowOffset + i * 4;

      // Analyzer bins are linear. Resample them logarithmically so the history
      // keeps bass resolution while still reaching the complete spectrum.
      const textureBin = i / Math.max(1, this.width - 1);
      const sourceIndex = Math.min(
        sourceMax,
        Math.round(Math.pow(textureBin, 2.15) * sourceMax)
      );
      const rawDb = fftData[sourceIndex];
      const db = Number.isFinite(rawDb) ? rawDb : -100;

      // A physically linear amplitude encoding made ordinary music nearly
      // invisible: useful musical detail commonly lives around -65 to -35 dB.
      // Expand that range perceptually while retaining a quiet floor and hard
      // ceiling. This is display calibration, not a change to the audio signal.
      const dbWindow = Math.max(0, Math.min(1, (db + 90) / 80));
      const normalizedMagnitude = Math.pow(dbWindow, 1.65);

      const previous = this.previousMagnitudes[i];
      const delta = normalizedMagnitude - previous;
      const signedMotion = 0.5 + Math.max(-0.5, Math.min(0.5, delta * 1.35));
      positiveFlux += Math.max(0, delta);
      peakSignal = Math.max(peakSignal, normalizedMagnitude);

      this.data[idx + 0] = Math.round(normalizedMagnitude * 255);
      this.data[idx + 1] = Math.round(signedMotion * 255);
      this.data[idx + 2] = 0;
      this.data[idx + 3] = Math.round(pitchNorm * 255);
      this.previousMagnitudes[i] = normalizedMagnitude;
    }

    const normalizedFlux = Math.min(1, (positiveFlux / this.width) * 11);
    const impulse = Math.min(1, safeBassImpulse * 0.55 + normalizedFlux * 0.9);
    const encodedImpulse = Math.round(impulse * 255);
    for (let i = 0; i < this.width; i += 1) {
      this.data[rowOffset + i * 4 + 2] = encodedImpulse;
    }

    // One 1 MB upload at 48 Hz is considerably lighter than uploading a
    // 4 MB float texture on every display refresh, while retaining 512×512 history.
    this.texture.needsUpdate = true;
    temporalMemory.recordFrame(row, Math.min(1, peakSignal * 0.9 + impulse * 0.25), now);
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
    temporalMemory.resetHistoryState();
  }

  public dispose(): void {
    this.texture.dispose();
  }
}
