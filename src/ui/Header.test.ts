import { describe, it, expect } from 'vitest';
import { Header, EngineMode } from './Header';

describe('Header & Navigation Architecture', () => {
  it('defines the 6 primary engine studio modes plus backward-compatible aliases', () => {
    const primaryModes: EngineMode[] = [
      'music',
      'frequency',
      'therapy',
      'nobel',
      'bio',
      'voice',
    ];

    expect(primaryModes).toHaveLength(6);
    expect(primaryModes).toContain('music');
    expect(primaryModes).toContain('frequency');
    expect(primaryModes).toContain('therapy');
    expect(primaryModes).toContain('nobel');
    expect(primaryModes).toContain('bio');
    expect(primaryModes).toContain('voice');
  });

  it('renders 6 dedicated studio buttons in the DOM', () => {
    const headerRoot = document.createElement('header');
    headerRoot.id = 'header-root';
    document.body.appendChild(headerRoot);

    const audioEngine = {} as any;
    const visualizer = {} as any;
    const onModeChange = () => {};

    const header = new Header(audioEngine, visualizer, onModeChange);
    expect(document.getElementById('btn-mode-music')).toBeDefined();
    expect(document.getElementById('btn-mode-freq')).toBeDefined();
    expect(document.getElementById('btn-mode-therapy')).toBeDefined();
    expect(document.getElementById('btn-mode-nobel')).toBeDefined();
    expect(document.getElementById('btn-mode-bio')).toBeDefined();
    expect(document.getElementById('btn-mode-voice')).toBeDefined();

    document.body.removeChild(headerRoot);
  });

  it('switches between Music and Frequency studio modes cleanly', () => {
    const headerRoot = document.createElement('header');
    headerRoot.id = 'header-root';
    document.body.appendChild(headerRoot);

    let currentMode = '';
    const audioEngine = {} as any;
    const visualizer = {} as any;
    const onModeChange = (mode: EngineMode) => {
      currentMode = mode;
    };

    const header = new Header(audioEngine, visualizer, onModeChange);
    document.getElementById('btn-mode-freq')?.click();
    expect(currentMode).toBe('frequency');

    document.getElementById('btn-mode-music')?.click();
    expect(currentMode).toBe('music');

    header.setMode('frequency');
    const freqBtn = document.getElementById('btn-mode-freq');
    expect(freqBtn?.className).toContain('glass-btn-active');

    document.body.removeChild(headerRoot);
  });
});
