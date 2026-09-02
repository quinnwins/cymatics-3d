import { describe, expect, it } from 'vitest';
import { canControlAnamnesisPlayback } from './AnamnesisExperience';

describe('Anamnesis playback semantics', () => {
  it('allows pausable sources and refuses to pretend live microphone input can pause', () => {
    expect(canControlAnamnesisPlayback('demo-track')).toBe(true);
    expect(canControlAnamnesisPlayback('file-upload')).toBe(true);
    expect(canControlAnamnesisPlayback('apple-music')).toBe(true);
    expect(canControlAnamnesisPlayback('spotify')).toBe(true);
    expect(canControlAnamnesisPlayback('microphone')).toBe(false);
  });

  it('disables transport while inspecting a stored relic', () => {
    expect(canControlAnamnesisPlayback('demo-track', true)).toBe(false);
    expect(canControlAnamnesisPlayback('file-upload', true)).toBe(false);
  });
});
