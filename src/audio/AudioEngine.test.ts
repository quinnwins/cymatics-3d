import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AudioEngine } from './AudioEngine';

describe('AudioEngine Transport & Scrubber', () => {
  let audioEngine: AudioEngine;

  beforeEach(() => {
    audioEngine = new AudioEngine();
  });

  it('should initialize with 0 currentTime and 0 duration when no file is loaded', () => {
    expect(audioEngine.getCurrentTime()).toBe(0);
    expect(audioEngine.getDuration()).toBe(0);
    expect(audioEngine.getProgress()).toBe(0);
    expect(audioEngine.isSeekable()).toBe(false);
  });

  it('should notify subscribers on audio change', () => {
    const listener = vi.fn();
    const unsubscribe = audioEngine.subscribe(listener);

    audioEngine.notifyChange();
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    audioEngine.notifyChange();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('should support volume change and mute toggling', () => {
    audioEngine.setMasterVolume(0.5);
    expect(audioEngine.getMasterVolume()).toBe(0.5);

    const isMuted = audioEngine.toggleMute();
    expect(isMuted).toBe(true);
    expect(audioEngine.getIsMuted()).toBe(true);

    const isUnmuted = audioEngine.toggleMute();
    expect(isUnmuted).toBe(false);
  });

  it('should clamp seek position correctly', () => {
    expect(() => audioEngine.seek(10)).not.toThrow();
  });
});
