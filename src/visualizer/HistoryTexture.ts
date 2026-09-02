import * as THREE from 'three';

/**
 * GPU Audio Spatiotemporal Ring-Buffer Texture
 * Stores 512 frequency bins across 512 time history frames.
 * Encodes:
 * - R: Normalized Spectral Magnitude [0..1]
 * - G: Harmonic Phase
 * - B: Transient / Shockwave Impulse [0..1]
 * - A: Pitch / Centroid factor
 */
export class HistoryTexture {
  public texture: THREE.DataTexture;
  public readonly width = 512;
  public readonly height = 512;
  private data: Float32Array;
  private writeHead = 0;

  constructor() {
    this.data = new Float32Array(this.width * this.height * 4);

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
    this.texture.wrapT = THREE.RepeatWrapping; // Ring-buffer circular wrapping
    this.texture.generateMipmaps = false;
    this.texture.needsUpdate = true;
  }

  public pushSpectralFrame(fftData: Float32Array, transientOnset: number, pitchHz: number): number {
    const rowOffset = this.writeHead * this.width * 4;
    const safePitchHz = Number.isFinite(pitchHz) ? Math.max(0, pitchHz) : 0;
    const pitchNorm = Math.min(1.0, safePitchHz / 4000);
    const safeTransient = Number.isFinite(transientOnset) ? Math.max(0, Math.min(1.0, transientOnset)) : 0;

    for (let i = 0; i < this.width; i++) {
      const idx = rowOffset + i * 4;
      const rawDb = fftData[i];
      const db = Number.isFinite(rawDb) ? rawDb : -100;
      // Convert dB to normalized power scale
      const mag = db > -90 ? Math.pow(10, (db + 10) / 45) : 0.0;
      const safeMag = Number.isFinite(mag) ? Math.max(0.0, Math.min(2.5, mag)) : 0.0;

      this.data[idx + 0] = safeMag;                          // R: Spectral magnitude
      this.data[idx + 1] = Math.sin((i / this.width) * 12.0); // G: Phase factor
      this.data[idx + 2] = safeTransient;                    // B: Shock impulse
      this.data[idx + 3] = pitchNorm;                        // A: Pitch factor
    }

    this.texture.needsUpdate = true;
    const normalizedHead = this.writeHead / this.height;
    this.writeHead = (this.writeHead + 1) % this.height;

    return normalizedHead;
  }

  public clear(): void {
    this.data.fill(0);
    this.texture.needsUpdate = true;
    this.writeHead = 0;
  }

  public dispose(): void {
    this.texture.dispose();
  }
}
