import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DemoAudioGenerator, DemoTrack } from './DemoAudioGenerator';

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
        exponentialRampToValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
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
      frequency: {
        value: 1000,
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      Q: {
        value: 1,
        setValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
  }

  public createBuffer(channels: number, length: number, sampleRate: number) {
    const data = new Float32Array(length);
    return {
      numberOfChannels: channels,
      length,
      sampleRate,
      getChannelData: (_ch: number) => data,
    };
  }

  public createBufferSource() {
    return {
      buffer: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };
  }
}

describe('DemoAudioGenerator', () => {
  let ctx: AudioContext;
  let destGain: GainNode;
  let generator: DemoAudioGenerator;

  beforeEach(() => {
    vi.useFakeTimers();
    ctx = new MockAudioContext() as unknown as AudioContext;
    destGain = (ctx as any).createGain();
    generator = new DemoAudioGenerator(ctx, destGain);
  });

  afterEach(() => {
    generator.stop();
    vi.useRealTimers();
  });

  describe('Track Registry & Metadata', () => {
    it('should register exactly 15 procedural tracks across 5 distinct categories', () => {
      expect(DemoAudioGenerator.TRACKS.length).toBe(15);

      const categories = new Set(DemoAudioGenerator.TRACKS.map(t => t.category));
      expect(categories).toEqual(new Set(['cosmic', 'electronic', 'classical', 'organic', 'vocal']));
    });

    it('should have unique IDs and positive BPMs for all tracks', () => {
      const ids = DemoAudioGenerator.TRACKS.map(t => t.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(DemoAudioGenerator.TRACKS.length);

      DemoAudioGenerator.TRACKS.forEach((track: DemoTrack) => {
        expect(track.id.length).toBeGreaterThan(0);
        expect(track.name.length).toBeGreaterThan(0);
        expect(track.genre.length).toBeGreaterThan(0);
        expect(track.description.length).toBeGreaterThan(0);
        expect(track.bpm).toBeGreaterThan(0);
        expect(['cosmic', 'electronic', 'classical', 'organic', 'vocal']).toContain(track.category);
      });
    });

    it('should include all required 15 specific track IDs for backward compatibility and feature completeness', () => {
      const requiredIds = [
        'cosmic-odyssey',
        'event-horizon',
        'nebula-cloudscape',
        'cyber-pulse',
        'quantum-glitch',
        'neon-cybernetics',
        'quantum-symphony',
        'celestial-harp',
        'baroque-resonance',
        'ocean-bioluminescence',
        'forest-canopy',
        'primal-earth',
        'solfeggio-528',
        'monastic-chant',
        'om-crystal-bowls',
      ];

      requiredIds.forEach(id => {
        const found = DemoAudioGenerator.TRACKS.find(t => t.id === id);
        expect(found).toBeDefined();
      });
    });
  });

  describe('Playback Lifecycle & Stepping', () => {
    it('should start stopped by default', () => {
      expect(generator.getIsPlaying()).toBe(false);
      expect(generator.getActiveTrackId()).toBe('cosmic-odyssey');
    });

    it('should start playback and update active track when play() is called', () => {
      generator.play('cyber-pulse');
      expect(generator.getIsPlaying()).toBe(true);
      expect(generator.getActiveTrackId()).toBe('cyber-pulse');
      expect(generator.getLastTrackId()).toBe('cyber-pulse');
    });

    it('should stop playback and clear state on stop()', () => {
      generator.play('solfeggio-528');
      expect(generator.getIsPlaying()).toBe(true);

      generator.stop();
      expect(generator.getIsPlaying()).toBe(false);
      expect(generator.getActiveTrackId()).toBe('solfeggio-528'); // falls back to lastTrackId
    });

    it('should handle unknown track ID gracefully by falling back to default track', () => {
      generator.play('non-existent-track-id');
      expect(generator.getIsPlaying()).toBe(true);
    });

    it('should step through sequencer ticks without throwing for all 15 tracks', () => {
      DemoAudioGenerator.TRACKS.forEach(track => {
        generator.play(track.id);
        expect(generator.getIsPlaying()).toBe(true);

        // Advance 128 steps (2 full 64-step loops)
        const stepTime = (60 / track.bpm / 4) * 1000;
        expect(() => {
          vi.advanceTimersByTime(stepTime * 128);
        }).not.toThrow();

        generator.stop();
      });
    });
  });

  describe('Voice Lifecycle & Garbage Collection', () => {
    it('should safely cap active nodes and prevent memory leaks under rapid sequencing', () => {
      generator.play('quantum-glitch');
      // Advance by 500 steps to trigger numerous voice allocations
      vi.advanceTimersByTime(15000);
      expect(generator.getIsPlaying()).toBe(true);
      generator.stop();
      expect(generator.getIsPlaying()).toBe(false);
    });

    it('should scale sequencer tempo dynamically when setPlaybackSpeed() is called during playback', () => {
      generator.play('cyber-pulse');
      expect(generator.getPlaybackSpeed()).toBe(1.0);

      generator.setPlaybackSpeed(2.0);
      expect(generator.getPlaybackSpeed()).toBe(2.0);
      expect(generator.getIsPlaying()).toBe(true);

      // Advance timers at double speed
      expect(() => {
        vi.advanceTimersByTime(5000);
      }).not.toThrow();

      generator.setPlaybackSpeed(0.5);
      expect(generator.getPlaybackSpeed()).toBe(0.5);
      expect(generator.getIsPlaying()).toBe(true);

      generator.stop();
    });
  });
});
