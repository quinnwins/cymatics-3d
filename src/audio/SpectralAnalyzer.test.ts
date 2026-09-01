import { describe, it, expect } from 'vitest';
import { SpectralAnalyzer } from './SpectralAnalyzer';

// Mock AnalyserNode for unit testing without Web Audio browser runtime
class MockAnalyserNode {
  public fftSize = 4096;
  public smoothingTimeConstant = 0.2;
  private mockFreqData: Float32Array;
  private mockTimeData: Float32Array;

  constructor() {
    this.mockFreqData = new Float32Array(2048).fill(-100);
    this.mockTimeData = new Float32Array(4096).fill(0);
  }

  public setTimeData(data: Float32Array) {
    this.mockTimeData.set(data);
  }

  public setFreqData(data: Float32Array) {
    this.mockFreqData.set(data);
  }

  public getFloatFrequencyData(array: Float32Array) {
    array.set(this.mockFreqData);
  }

  public getFloatTimeDomainData(array: Float32Array) {
    array.set(this.mockTimeData);
  }
}

describe('SpectralAnalyzer', () => {
  it('initializes with 6 perceptual frequency bands and zero pitch on silence', () => {
    const mockNode = new MockAnalyserNode();
    const analyzer = new SpectralAnalyzer(mockNode as unknown as AnalyserNode, 44100);

    analyzer.update(0.0);

    expect(analyzer.currentBands.subBass).toBeGreaterThanOrEqual(0);
    expect(analyzer.currentBands.bass).toBeGreaterThanOrEqual(0);
    expect(analyzer.currentBands.high).toBeGreaterThanOrEqual(0);
    expect(analyzer.fundamentalFreq).toBe(0);
    expect(analyzer.pitchConfidence).toBe(0);
    expect(analyzer.activeShockwaves.length).toBe(0);
  });

  it('accurately detects fundamental pitch of a 440 Hz test sine wave', () => {
    const mockNode = new MockAnalyserNode();
    const sampleRate = 44100;
    const timeData = new Float32Array(4096);

    // Generate 440 Hz pure sine wave with amplitude 0.8
    for (let i = 0; i < timeData.length; i++) {
      timeData[i] = 0.8 * Math.sin((2 * Math.PI * 440 * i) / sampleRate);
    }
    mockNode.setTimeData(timeData);

    const analyzer = new SpectralAnalyzer(mockNode as unknown as AnalyserNode, sampleRate);
    analyzer.update(0.1);

    expect(analyzer.fundamentalFreq).toBeGreaterThan(430);
    expect(analyzer.fundamentalFreq).toBeLessThan(450);
    expect(analyzer.pitchConfidence).toBeGreaterThan(0.5);
  });

  it('accurately detects fundamental pitch of a 118 Hz deep bass wave', () => {
    const mockNode = new MockAnalyserNode();
    const sampleRate = 44100;
    const timeData = new Float32Array(4096);

    // Generate 118 Hz pure sine wave with amplitude 0.85
    for (let i = 0; i < timeData.length; i++) {
      timeData[i] = 0.85 * Math.sin((2 * Math.PI * 118 * i) / sampleRate);
    }
    mockNode.setTimeData(timeData);

    const analyzer = new SpectralAnalyzer(mockNode as unknown as AnalyserNode, sampleRate);
    analyzer.update(0.1);

    expect(analyzer.fundamentalFreq).toBeGreaterThan(114);
    expect(analyzer.fundamentalFreq).toBeLessThan(122);
    expect(analyzer.pitchConfidence).toBeGreaterThan(0.5);
  });

  it('does not trigger false positive shockwaves on initial frame 0', () => {
    const mockNode = new MockAnalyserNode();
    const analyzer = new SpectralAnalyzer(mockNode as unknown as AnalyserNode, 44100);

    analyzer.update(0.0);
    expect(analyzer.activeShockwaves.length).toBe(0);

    analyzer.update(0.05);
    expect(analyzer.activeShockwaves.length).toBe(0);
  });
});
