import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { VoiceBiometricAnalyzer } from './VoiceBiometricAnalyzer';

class MockAudioContext {
  public state = 'running';
  public sampleRate = 16000;
  public currentTime = 0;
  public destination = {};

  public createAnalyser() {
    let internalBuffer = new Float32Array(2048);
    return {
      fftSize: 4096,
      smoothingTimeConstant: 0.2,
      getFloatTimeDomainData: vi.fn((buf: Float32Array) => {
        buf.set(internalBuffer);
      }),
      __setBuffer: (data: Float32Array) => {
        internalBuffer.set(data);
      },
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
  }

  public createBiquadFilter() {
    return {
      type: 'highpass',
      frequency: { setValueAtTime: vi.fn() },
      Q: { setValueAtTime: vi.fn() },
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
  }

  public createGain() {
    return {
      gain: {
        value: 1,
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
        cancelScheduledValues: vi.fn(),
      },
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
  }

  public createMediaStreamSource(_stream: unknown) {
    return {
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
  }

  public resume = vi.fn().mockResolvedValue(undefined);
  public close = vi.fn().mockResolvedValue(undefined);
}

describe('VoiceBiometricAnalyzer - Web Audio DSP & Biometric Pipeline', () => {
  let mockCtx: MockAudioContext;
  let analyzer: VoiceBiometricAnalyzer;

  beforeEach(() => {
    mockCtx = new MockAudioContext();
    analyzer = new VoiceBiometricAnalyzer(mockCtx as unknown as AudioContext);
  });

  afterEach(() => {
    analyzer.stopMicrophone();
    vi.restoreAllMocks();
  });

  describe('Initialization & Synthetic Profile Engine', () => {
    it('initializes with Bel Canto default profile and generates valid report', () => {
      expect(analyzer.getActiveProfile().id).toBe('bel-canto');
      expect(analyzer.getIsLiveMic()).toBe(false);

      const report = analyzer.update();
      expect(report.f0Hz).toBeCloseTo(220.0, 0);
      expect(report.formantsHz.length).toBe(4);
      expect(report.healthStatus).toBe('pristine');
      expect(report.soundMedicinePrescription).toBeDefined();
      expect(report.soundMedicinePrescription.baseToneHz).toBe(432.0);
    });

    it('switches active profile cleanly and regenerates corresponding biomarkers', () => {
      const nodulesProfile = analyzer.setProfile('vocal-nodules');
      expect(nodulesProfile.id).toBe('vocal-nodules');
      expect(analyzer.getActiveProfile().id).toBe('vocal-nodules');

      const report = analyzer.update();
      expect(report.healthStatus).toBe('pathological-dysphonia');
      expect(report.soundMedicinePrescription.baseToneHz).toBe(110.0);
    });

    it('falls back to default profile on unknown profile ID', () => {
      const fallback = analyzer.setProfile('non-existent-profile-key');
      expect(fallback.id).toBe('bel-canto');
    });
  });

  describe('Microphone Acquisition & Hardware Lifecycle', () => {
    it('successfully activates live microphone stream and sets active state', async () => {
      const mockTrack = { stop: vi.fn() };
      const mockStream = {
        getTracks: () => [mockTrack],
      };

      vi.stubGlobal('navigator', {
        mediaDevices: {
          getUserMedia: vi.fn().mockResolvedValue(mockStream),
        },
      });

      const success = await analyzer.startMicrophone();
      expect(success).toBe(true);
      expect(analyzer.getIsLiveMic()).toBe(true);

      analyzer.stopMicrophone();
      expect(mockTrack.stop).toHaveBeenCalled();
      expect(analyzer.getIsLiveMic()).toBe(false);
    });

    it('handles microphone permission denial gracefully without crashing', async () => {
      vi.stubGlobal('navigator', {
        mediaDevices: {
          getUserMedia: vi.fn().mockRejectedValue(new Error('Permission denied')),
        },
      });

      const success = await analyzer.startMicrophone();
      expect(success).toBe(false);
      expect(analyzer.getIsLiveMic()).toBe(false);
    });

    it('ensures re-entrant startMicrophone cleanly stops previous tracks', async () => {
      const mockTrack1 = { stop: vi.fn() };
      const mockTrack2 = { stop: vi.fn() };

      const getUserMediaMock = vi.fn()
        .mockResolvedValueOnce({ getTracks: () => [mockTrack1] })
        .mockResolvedValueOnce({ getTracks: () => [mockTrack2] });

      vi.stubGlobal('navigator', {
        mediaDevices: {
          getUserMedia: getUserMediaMock,
        },
      });

      await analyzer.startMicrophone();
      await analyzer.startMicrophone(); // Second re-entrant call

      expect(mockTrack1.stop).toHaveBeenCalled();
      expect(analyzer.getIsLiveMic()).toBe(true);
    });
  });

  describe('Live Audio DSP, VAD Gating, & VU Ballistics', () => {
    it('computes calibrated VU meter levels and SNR from audio buffer', () => {
      const vu = analyzer.getVuLevels();
      expect(vu.vuRms).toBeGreaterThanOrEqual(0);
      expect(vu.vuRms).toBeLessThanOrEqual(1.0);
      expect(vu.peakLevel).toBeGreaterThanOrEqual(0);
      expect(vu.snrDb).toBeGreaterThanOrEqual(0);
    });

    it('processes live sinusoidal audio stream into pitch and perturbation metrics', async () => {
      const mockTrack = { stop: vi.fn() };
      const mockStream = { getTracks: () => [mockTrack] };

      vi.stubGlobal('navigator', {
        mediaDevices: {
          getUserMedia: vi.fn().mockResolvedValue(mockStream),
        },
      });

      await analyzer.startMicrophone();

      // Synthesize 220 Hz sine wave into time domain buffer
      const analyserNode = (analyzer as unknown as { analyserNode: { __setBuffer: (b: Float32Array) => void } }).analyserNode;
      const N = 2048;
      const sampleRate = 16000;
      const sineBuffer = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        sineBuffer[i] = 0.40 * Math.sin((2 * Math.PI * 220 * i) / sampleRate);
      }
      analyserNode.__setBuffer(sineBuffer);

      // Advance frames
      const report = analyzer.update();
      expect(report).toBeDefined();
      expect(analyzer.getIsVoicing()).toBe(true);
    });
  });
});
