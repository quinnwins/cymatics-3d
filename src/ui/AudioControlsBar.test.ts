import { describe, it, expect, beforeEach } from 'vitest';
import { AudioEngine } from '../audio/AudioEngine';
import { AudioControlsBar } from './AudioControlsBar';

describe('AudioControlsBar UI', () => {
  let audioEngine: AudioEngine;
  let controlsBar: AudioControlsBar;

  beforeEach(() => {
    audioEngine = new AudioEngine();
    controlsBar = new AudioControlsBar(audioEngine);
  });

  it('should instantiate and provide element', () => {
    const el = controlsBar.getElement();
    expect(el).toBeDefined();
  });

  it('should properly cleanup on destroy', () => {
    expect(() => controlsBar.destroy()).not.toThrow();
  });
});
