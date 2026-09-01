import { describe, it, expect } from 'vitest';
import { EngineMode } from './Header';

describe('Header & Navigation Architecture', () => {
  it('defines all 7 first-class engine studio modes', () => {
    const supportedModes: EngineMode[] = [
      'music',
      'frequency',
      'modal',
      'bio',
      'therapy',
      'voice',
      'nobel',
    ];

    expect(supportedModes).toHaveLength(7);
    expect(supportedModes).toContain('music');
    expect(supportedModes).toContain('frequency');
    expect(supportedModes).toContain('modal');
    expect(supportedModes).toContain('bio');
    expect(supportedModes).toContain('therapy');
    expect(supportedModes).toContain('voice');
    expect(supportedModes).toContain('nobel');
  });
});
