import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SoundMedicineSynthesizer } from './SoundMedicineSynthesizer';
import { VoiceBiometricsPhysics } from '../math/VoiceBiometricsPhysics';

class MockAudioContext {
  public state = 'running';
  public sampleRate = 44100;
  public currentTime = 0;
  public destination = {};

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

  public createOscillator() {
    return {
      type: 'sine',
      frequency: {
        value: 440,
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
        cancelScheduledValues: vi.fn(),
      },
      connect: vi.fn(),
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };
  }

  public createBiquadFilter() {
    return {
      type: 'lowpass',
      frequency: { setValueAtTime: vi.fn() },
      Q: { setValueAtTime: vi.fn() },
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
  }

  public createStereoPanner() {
    return {
      pan: {
        value: 0,
        setValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
  }

  public createDynamicsCompressor() {
    return {
      threshold: { setValueAtTime: vi.fn() },
      knee: { setValueAtTime: vi.fn() },
      ratio: { setValueAtTime: vi.fn() },
      attack: { setValueAtTime: vi.fn() },
      release: { setValueAtTime: vi.fn() },
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
  }
}

describe('SoundMedicineSynthesizer - Personalized 5-Tier Bio-Resonance Synthesis', () => {
  let mockCtx: MockAudioContext;
  let destinationNode: { connect: ReturnType<typeof vi.fn> };
  let synth: SoundMedicineSynthesizer;

  beforeEach(() => {
    mockCtx = new MockAudioContext();
    destinationNode = { connect: vi.fn() };
    synth = new SoundMedicineSynthesizer(
      mockCtx as unknown as AudioContext,
      destinationNode as unknown as AudioNode
    );
  });

  describe('Prescription Formulation & Node Instantiation', () => {
    it('initiates 5-tier polyphonic synthesis for pristine harmonic calibration (432 Hz)', () => {
      const rx = VoiceBiometricsPhysics.generatePrescription({
        f0Hz: 220.0,
        healthStatus: 'pristine',
        formants: [280, 2250, 3100, 3600],
      });

      synth.playPrescription(rx, 0.70);
      expect(synth.getIsPlaying()).toBe(true);
      expect(synth.getActivePrescription()?.baseToneHz).toBe(432.0);
    });

    it('initiates theta neuromodulatory synthesis for tremor stabilization (6 Hz binaural)', () => {
      const rx = VoiceBiometricsPhysics.generatePrescription({
        f0Hz: 145.0,
        healthStatus: 'neurological-tremor',
        formants: [500, 1500, 2500, 3500],
      });

      synth.playPrescription(rx, 0.65);
      expect(synth.getIsPlaying()).toBe(true);
      expect(synth.getActivePrescription()?.binauralBeatHz).toBe(6.0);
    });

    it('initiates low-stress inertance carrier for pathological dysphonia (110 Hz)', () => {
      const rx = VoiceBiometricsPhysics.generatePrescription({
        f0Hz: 190.0,
        healthStatus: 'pathological-dysphonia',
        formants: [720, 1380, 2450, 3350],
      });

      synth.playPrescription(rx, 0.60);
      expect(synth.getIsPlaying()).toBe(true);
      expect(synth.getActivePrescription()?.baseToneHz).toBe(110.0);
    });
  });

  describe('Volume & Teardown Lifecycles', () => {
    it('adjusts volume with linear ramp safety', () => {
      synth.setVolume(0.85);
      synth.setVolume(1.50); // Clamps to 1.0
      synth.setVolume(-0.2); // Clamps to 0.0001
    });

    it('stops synthesis smoothly with exponential ramp and voice disconnection', () => {
      const rx = VoiceBiometricsPhysics.generatePrescription({
        f0Hz: 220.0,
        healthStatus: 'pristine',
        formants: [280, 2250, 3100, 3600],
      });

      synth.playPrescription(rx);
      expect(synth.getIsPlaying()).toBe(true);

      synth.stop(0.05);
      expect(synth.getIsPlaying()).toBe(false);
    });
  });
});
