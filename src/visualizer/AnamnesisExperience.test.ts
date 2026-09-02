import { describe, expect, it } from 'vitest';
import { canControlAnamnesisPlayback } from './AnamnesisExperience';

describe('Anamnesis playback semantics', () => {
  it('allows pausable sources and refuses to pretend live microphone input can pause', () => {
    for (const source of ['demo-track', 'file-upload', 'apple-music', 'spotify'] as const) {
      expect(canControlAnamnesisPlayback(source)).toBe(true);
    }
    expect(canControlAnamnesisPlayback('microphone')).toBe(false);
  });

  it('disables transport while inspecting a stored relic regardless of source', () => {
    for (const source of ['demo-track', 'file-upload', 'apple-music', 'spotify', 'microphone'] as const) {
      expect(canControlAnamnesisPlayback(source, true)).toBe(false);
    }
  });
});
