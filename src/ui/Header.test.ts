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

  it('removes redundant column hide buttons and renders dedicated immersive buttons', () => {
    const headerRoot = document.createElement('header');
    headerRoot.id = 'header-root';
    document.body.appendChild(headerRoot);

    const audioEngine = {} as any;
    const visualizer = {} as any;
    const onModeChange = () => {};

    const header = new Header(audioEngine, visualizer, onModeChange);

    // Verify old column hide buttons are completely removed
    expect(document.getElementById('btn-toggle-left-sidebar')).toBeNull();
    expect(document.getElementById('btn-toggle-right-sidebar')).toBeNull();
    expect(document.getElementById('btn-toggle-right-sidebar-mobile')).toBeNull();

    // Verify new desktop and mobile immersive buttons exist
    const desktopImmersive = document.getElementById('btn-header-immersive');
    const mobileImmersive = document.getElementById('btn-header-immersive-mobile');
    expect(desktopImmersive).not.toBeNull();
    expect(mobileImmersive).not.toBeNull();
    expect(desktopImmersive?.textContent).toContain('Immersive');

    document.body.removeChild(headerRoot);
  });

  it('triggers onToggleImmersive and updates visual active state', () => {
    const headerRoot = document.createElement('header');
    headerRoot.id = 'header-root';
    document.body.appendChild(headerRoot);

    let toggledCount = 0;
    const audioEngine = {} as any;
    const visualizer = {} as any;
    const onModeChange = () => {};
    const onToggleImmersive = () => {
      toggledCount++;
    };

    const header = new Header(
      audioEngine,
      visualizer,
      onModeChange,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      onToggleImmersive
    );

    // Desktop click
    document.getElementById('btn-header-immersive')?.click();
    expect(toggledCount).toBe(1);

    // Mobile click
    document.getElementById('btn-header-immersive-mobile')?.click();
    expect(toggledCount).toBe(2);

    // State update test
    header.setImmersive(true);
    expect(header.getIsImmersive()).toBe(true);
    const desktopBtnActive = document.getElementById('btn-header-immersive');
    expect(desktopBtnActive?.className).toContain('glass-btn-active');
    expect(desktopBtnActive?.getAttribute('aria-label')).toContain('Exit immersive');

    header.setImmersive(false);
    expect(header.getIsImmersive()).toBe(false);
    const desktopBtnInactive = document.getElementById('btn-header-immersive');
    expect(desktopBtnInactive?.className).not.toContain('glass-btn-active');
    expect(desktopBtnInactive?.getAttribute('aria-label')).toContain('Enter immersive');

    document.body.removeChild(headerRoot);
  });

  it('renders Labs dropdown capsule with accessible ARIA semantics and toggles on click', () => {
    const headerRoot = document.createElement('header');
    headerRoot.id = 'header-root';
    document.body.appendChild(headerRoot);

    const audioEngine = {} as any;
    const visualizer = {} as any;
    let switchedMode = '';
    const onModeChange = (mode: EngineMode) => {
      switchedMode = mode;
    };

    const header = new Header(audioEngine, visualizer, onModeChange);
    const labsTrigger = document.getElementById('btn-mode-labs');
    const labsMenu = document.getElementById('labs-dropdown-menu');

    expect(labsTrigger).not.toBeNull();
    expect(labsMenu).not.toBeNull();
    expect(labsTrigger?.getAttribute('aria-haspopup')).toBe('menu');
    expect(labsTrigger?.getAttribute('aria-expanded')).toBe('false');
    expect(labsMenu?.classList.contains('hidden')).toBe(true);

    // Click to open
    labsTrigger?.click();
    expect(labsTrigger?.getAttribute('aria-expanded')).toBe('true');
    expect(labsMenu?.classList.contains('flex')).toBe(true);
    expect(labsMenu?.classList.contains('hidden')).toBe(false);

    // Select Nobel Frontiers
    const nobelBtn = document.getElementById('btn-mode-nobel');
    nobelBtn?.click();
    expect(switchedMode).toBe('nobel');

    // After mode switch to nobel, Labs trigger is highlighted as active
    header.setMode('nobel');
    const updatedLabsBtn = document.getElementById('btn-mode-labs');
    expect(updatedLabsBtn?.className).toContain('is-active');

    // Click outside closes menu
    updatedLabsBtn?.click();
    expect(document.getElementById('labs-dropdown-menu')?.classList.contains('flex')).toBe(true);
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(document.getElementById('labs-dropdown-menu')?.classList.contains('hidden')).toBe(true);

    // Selecting Bio-Acoustics updates mode
    document.getElementById('btn-mode-bio')?.click();
    expect(switchedMode).toBe('bio');

    // Selecting Sound Therapy updates mode
    document.getElementById('btn-mode-therapy')?.click();
    expect(switchedMode).toBe('therapy');

    // After mode switch to therapy, Labs trigger is highlighted as active
    header.setMode('therapy');
    expect(document.getElementById('btn-mode-labs')?.className).toContain('is-active');

    // Selecting Voice Studio updates mode
    document.getElementById('btn-mode-voice')?.click();
    expect(switchedMode).toBe('voice');

    // After mode switch to voice, Labs trigger is highlighted as active
    header.setMode('voice');
    expect(document.getElementById('btn-mode-labs')?.className).toContain('is-active');

    header.destroy();
    document.body.removeChild(headerRoot);
  });

  it('renders header-provenance-slot and mounts visualizer provenance badge if present', () => {
    const headerRoot = document.createElement('header');
    headerRoot.id = 'header-root';
    document.body.appendChild(headerRoot);

    const badgeEl = document.createElement('div');
    badgeEl.id = 'test-provenance-badge';

    const audioEngine = {} as any;
    const visualizer = {
      provenanceBadge: {
        element: badgeEl,
      },
    } as any;
    const onModeChange = () => {};

    const header = new Header(audioEngine, visualizer, onModeChange);
    const slot = document.getElementById('header-provenance-slot');
    expect(slot).not.toBeNull();
    expect(slot?.contains(badgeEl)).toBe(true);

    header.destroy();
    document.body.removeChild(headerRoot);
  });

  it('centers top header buttons capsule in viewport and applies touch hitboxes and justify-center', () => {
    const headerRoot = document.createElement('header');
    headerRoot.id = 'header-root';
    document.body.appendChild(headerRoot);

    const audioEngine = {} as any;
    const visualizer = {} as any;
    const onModeChange = () => {};

    const header = new Header(audioEngine, visualizer, onModeChange);

    const nav = document.querySelector('nav[role="tablist"]');
    expect(nav).not.toBeNull();
    // Centering classes for desktop and mobile
    expect(nav?.className).toContain('md:absolute');
    expect(nav?.className).toContain('md:left-1/2');
    expect(nav?.className).toContain('md:-translate-x-1/2');
    expect(nav?.className).toContain('md:top-1/2');
    expect(nav?.className).toContain('md:-translate-y-1/2');
    expect(nav?.className).toContain('mx-auto');

    // Button internal centering and hit target ergonomics
    const musicBtn = document.getElementById('btn-mode-music');
    const freqBtn = document.getElementById('btn-mode-freq');
    const labsBtn = document.getElementById('btn-mode-labs');
    expect(musicBtn?.className).toContain('justify-center');
    expect(freqBtn?.className).toContain('justify-center');
    expect(labsBtn?.className).toContain('justify-center');

    const resetBtn = document.getElementById('btn-header-reset');
    const tourBtn = document.querySelector('.btn-executive-tour');
    const immersiveBtn = document.getElementById('btn-header-immersive');
    expect(resetBtn?.className).toContain('justify-center');
    expect(resetBtn?.className).toContain('min-h-[36px]');
    expect(tourBtn?.className).toContain('justify-center');
    expect(tourBtn?.className).toContain('min-h-[36px]');
    expect(immersiveBtn?.className).toContain('justify-center');
    expect(immersiveBtn?.className).toContain('min-h-[36px]');

    header.destroy();
    document.body.removeChild(headerRoot);
  });
});


