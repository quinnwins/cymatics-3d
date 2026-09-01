/**
 * High-Resolution Spectral & Transient Audio Analyzer
 * Computes 6-band perceptual log energy, spectral flux onsets, and fundamental pitch tracking.
 */

export interface AudioBands {
  subBass: number;   // 20 - 60 Hz
  bass: number;      // 60 - 250 Hz
  lowMid: number;    // 250 - 500 Hz
  mid: number;       // 500 - 2000 Hz
  highMid: number;   // 2000 - 4000 Hz
  high: number;      // 4000 - 20000 Hz
  rms: number;       // Overall RMS energy
}

export interface ShockwaveEvent {
  birthTime: number;
  strength: number;
  speed: number;
}

export class SpectralAnalyzer {
  private analyser: AnalyserNode;
  private fftSize = 4096;
  private sampleRate: number;

  private freqData: Float32Array;
  private prevFreqData: Float32Array;
  private timeData: Float32Array;

  private binRanges: [number, number][] = [];
  public currentBands: AudioBands = { subBass: 0, bass: 0, lowMid: 0, mid: 0, highMid: 0, high: 0, rms: 0 };
  private smoothedBands: AudioBands = { subBass: 0, bass: 0, lowMid: 0, mid: 0, highMid: 0, high: 0, rms: 0 };

  // Transient / Beat Onset Detection
  private fluxHistory: number[] = [];
  private readonly fluxHistorySize = 32;
  private lastOnsetTimestamp = 0;
  public activeShockwaves: ShockwaveEvent[] = [];

  // Pitch tracking
  public fundamentalFreq = 0;
  public pitchConfidence = 0;
  private lastFrameTime = 0;

  constructor(analyserNode: AnalyserNode, sampleRate = 44100) {
    this.analyser = analyserNode;
    this.sampleRate = sampleRate;
    this.analyser.fftSize = this.fftSize;
    this.analyser.smoothingTimeConstant = 0.2;

    this.freqData = new Float32Array(this.fftSize / 2);
    this.prevFreqData = new Float32Array(this.fftSize / 2);
    this.timeData = new Float32Array(this.fftSize);

    this.calculateBinRanges();
  }

  private calculateBinRanges(): void {
    const binWidth = this.sampleRate / this.fftSize;
    const bandFreqs: [number, number][] = [
      [20, 60],       // Sub-Bass
      [60, 250],      // Bass
      [250, 500],     // Low-Mid
      [500, 2000],    // Mid
      [2000, 4000],   // High-Mid
      [4000, 20000],  // High
    ];

    this.binRanges = bandFreqs.map(([low, high]) => [
      Math.max(1, Math.floor(low / binWidth)),
      Math.min(this.fftSize / 2 - 1, Math.floor(high / binWidth)),
    ]);
  }

  public update(currentTimeSeconds: number): void {
    this.analyser.getFloatFrequencyData(this.freqData as any);
    this.analyser.getFloatTimeDomainData(this.timeData as any);

    // 1. Calculate 6-Band Perceptual Energy
    const rawBands = [0, 0, 0, 0, 0, 0];
    let totalEnergy = 0;

    for (let b = 0; b < this.binRanges.length; b++) {
      const [start, end] = this.binRanges[b];
      let sum = 0;
      for (let k = start; k <= end; k++) {
        const db = this.freqData[k];
        // Convert dB (-100..0) to normalized linear amplitude [0..1]
        const lin = db > -90 ? Math.pow(10, (db + 10) / 40) : 0;
        sum += lin * lin;
      }
      const count = end - start + 1;
      rawBands[b] = Math.min(2.0, Math.sqrt(sum / count) * 1.8);
      totalEnergy += rawBands[b];
    }

    const rms = Math.min(2.0, totalEnergy / 6);

    // Framerate-independent continuous dual-speed ballistics (Apple ProMotion 60Hz/120Hz consistency)
    const dt = currentTimeSeconds > 0 && (currentTimeSeconds - this.lastFrameTime) > 0.001
      ? Math.min(0.1, currentTimeSeconds - this.lastFrameTime)
      : 1 / 60;
    this.lastFrameTime = currentTimeSeconds;

    const tauAttack = 0.018;  // 18ms snappy transient response
    const tauRelease = 0.220; // 220ms smooth natural organic decay
    const alphaAttack = 1.0 - Math.exp(-dt / tauAttack);
    const alphaRelease = 1.0 - Math.exp(-dt / tauRelease);

    const bandKeys: (keyof AudioBands)[] = ['subBass', 'bass', 'lowMid', 'mid', 'highMid', 'high'];
    for (let i = 0; i < bandKeys.length; i++) {
      const key = bandKeys[i];
      const target = rawBands[i];
      const current = this.smoothedBands[key];
      const alpha = target > current ? alphaAttack : alphaRelease;
      this.smoothedBands[key] = current + alpha * (target - current);
    }
    const rmsAlpha = 1.0 - Math.exp(-dt / 0.120);
    this.smoothedBands.rms = this.smoothedBands.rms + rmsAlpha * (rms - this.smoothedBands.rms);
    this.currentBands = { ...this.smoothedBands };

    // 2. Spectral Flux Transient Detection
    let spectralFlux = 0;
    for (let k = 0; k < 256; k++) { // Focus flux on rhythm frequencies < 3kHz
      const curr = Math.max(0, this.freqData[k] + 90);
      const prev = Math.max(0, this.prevFreqData[k] + 90);
      const diff = curr - prev;
      if (diff > 0) spectralFlux += diff;
    }
    this.prevFreqData.set(this.freqData);

    this.fluxHistory.push(spectralFlux);
    if (this.fluxHistory.length > this.fluxHistorySize) this.fluxHistory.shift();

    const meanFlux = this.fluxHistory.reduce((a, b) => a + b, 0) / this.fluxHistory.length;
    const variance = this.fluxHistory.reduce((a, b) => a + Math.pow(b - meanFlux, 2), 0) / this.fluxHistory.length;
    const stdDev = Math.sqrt(variance);
    const threshold = meanFlux + 1.5 * stdDev + 15.0;

    if (spectralFlux > threshold && (currentTimeSeconds - this.lastOnsetTimestamp) > 0.08) {
      this.lastOnsetTimestamp = currentTimeSeconds;
      const strength = Math.min(3.5, (spectralFlux - meanFlux) / (stdDev + 0.001) + this.currentBands.subBass * 1.5);

      this.activeShockwaves.unshift({
        birthTime: currentTimeSeconds,
        strength,
        speed: 7.5,
      });
      if (this.activeShockwaves.length > 4) this.activeShockwaves.pop();
    }

    // Clean up expired shockwaves older than 3 seconds
    this.activeShockwaves = this.activeShockwaves.filter(sw => currentTimeSeconds - sw.birthTime < 3.0);

    // 3. Autocorrelation Pitch Tracking
    this.detectPitch();
  }

  private detectPitch(): void {
    const SIZE = 1024;
    let maxCorr = 0;
    let bestLag = -1;

    // Autocorrelation loop for human vocal / instrument pitch (50Hz to 1200Hz)
    const minLag = Math.floor(this.sampleRate / 1200);
    const maxLag = Math.floor(this.sampleRate / 50);

    for (let lag = minLag; lag < maxLag && lag < SIZE / 2; lag++) {
      let corr = 0;
      for (let i = 0; i < SIZE / 2; i++) {
        corr += this.timeData[i] * this.timeData[i + lag];
      }
      if (corr > maxCorr) {
        maxCorr = corr;
        bestLag = lag;
      }
    }

    if (bestLag > 0 && maxCorr > 0.05) {
      this.fundamentalFreq = this.sampleRate / bestLag;
      this.pitchConfidence = Math.min(1.0, maxCorr * 5.0);
    } else {
      this.pitchConfidence = 0;
    }
  }

  public getRawFrequencyData(): Float32Array {
    return this.freqData;
  }

  public getTimeDomainData(): Float32Array {
    return this.timeData;
  }
}
