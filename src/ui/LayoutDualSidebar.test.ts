import { describe, it, expect, vi } from 'vitest';
import { DemoAudioGenerator } from '../audio/DemoAudioGenerator';

describe('Layout & Workstation System Test Suite', () => {
  it('provides rich demo audio tracks with valid BPM and descriptions', () => {
    const tracks = DemoAudioGenerator.TRACKS;
    expect(tracks.length).toBeGreaterThanOrEqual(4);
    tracks.forEach(track => {
      expect(track.id).toBeDefined();
      expect(track.name).toBeDefined();
      expect(track.bpm).toBeGreaterThan(0);
      expect(track.genre).toBeDefined();
      expect(track.description).toBeDefined();
    });
  });

  it('verifies track playlist IDs are unique', () => {
    const tracks = DemoAudioGenerator.TRACKS;
    const ids = tracks.map(t => t.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(tracks.length);
  });
});
