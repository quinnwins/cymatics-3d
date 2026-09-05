import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AudioEngine } from '../audio/AudioEngine';
import { AudioControlsBar } from './AudioControlsBar';

describe('AudioControlsBar UI - Universal Master Transport & Telemetry Dock', () => {
  let audioEngine: AudioEngine;
  let controlsBar: AudioControlsBar;
  let screenshotSpy: any;
  let exportSpy: any;

  beforeEach(() => {
    audioEngine = new AudioEngine();
    screenshotSpy = vi.fn();
    exportSpy = vi.fn();
    controlsBar = new AudioControlsBar(audioEngine, screenshotSpy, exportSpy);
  });

  it('should instantiate and provide element', () => {
    const el = controlsBar.getElement();
    expect(el).toBeDefined();
  });

  describe('Music Studio Master Dock', () => {
    it('should render active track telemetry pill, snapshot, export, and volume', () => {
      controlsBar.setMode('music');
      const el = controlsBar.getElement();

      expect(el.querySelector('#btn-play-pause')).not.toBeNull();
      expect(el.querySelector('#btn-screenshot')).not.toBeNull();
      expect(el.querySelector('#btn-export-dossier')).not.toBeNull();
      expect(el.querySelector('#btn-sonic-memory')).toBeNull();
      expect(el.querySelector('#volume-slider')).not.toBeNull();
      expect(el.querySelector('#dock-timeline-scrubber')).not.toBeNull();
      expect(el.querySelector('#dock-label-current-time')).not.toBeNull();
      expect(el.querySelector('#dock-label-duration')).not.toBeNull();
    });

    it('should seek audio engine on timeline scrubber input and change', () => {
      controlsBar.setMode('music');
      const el = controlsBar.getElement();
      const scrubber = el.querySelector('#dock-timeline-scrubber') as HTMLInputElement;

      const seekSpy = vi.spyOn(audioEngine, 'seek');
      scrubber.value = '42.5';
      scrubber.dispatchEvent(new Event('input'));

      expect(seekSpy).toHaveBeenCalledWith(42.5);
      expect(el.querySelector('#dock-label-current-time')?.textContent).toBe('0:42');

      scrubber.dispatchEvent(new Event('change'));
      expect(seekSpy).toHaveBeenCalledWith(42.5);
    });

    it('should cleanly display uploaded custom audio file name and format badge without demo genre pollution', () => {
      vi.spyOn(audioEngine, 'getLoadedFileName').mockReturnValue('Ed Sheeran - Photograph (Official Audio).mp3');
      vi.spyOn(audioEngine, 'getDuration').mockReturnValue(258);
      vi.spyOn(audioEngine, 'getCurrentTime').mockReturnValue(74);

      controlsBar.setMode('music');
      const el = controlsBar.getElement();

      expect(el.textContent).toContain('Ed Sheeran - Photograph (Official Audio).mp3');
      expect(el.textContent).toContain('• MP3 File');
      expect(el.textContent).not.toContain('Dark Gravitational Drone');

      const curLabel = el.querySelector('#dock-label-current-time');
      const durLabel = el.querySelector('#dock-label-duration');
      expect(curLabel?.textContent).toBe('1:14');
      expect(durLabel?.textContent).toBe('4:18');
    });

    it('should toggle master audio play/pause on main transport button click', async () => {
      controlsBar.setMode('music');
      const el = controlsBar.getElement();
      const playBtn = el.querySelector('#btn-play-pause') as HTMLButtonElement;

      const initSpy = vi.spyOn(audioEngine, 'initialize').mockResolvedValue(undefined);
      const toggleSpy = vi.spyOn(audioEngine, 'togglePlayPause').mockReturnValue(true);

      playBtn.click();
      await Promise.resolve();

      expect(initSpy).toHaveBeenCalled();
      expect(toggleSpy).toHaveBeenCalled();
    });
  });

  describe('Frequency Lab Master Dock', () => {
    beforeEach(() => {
      controlsBar.setMode('frequency');
    });

    it('should render pure tone live frequency and wavelength telemetry pill', () => {
      controlsBar.setFrequency(432);
      const el = controlsBar.getElement();

      const freqVal = el.querySelector('#dock-freq-val');
      const freqNote = el.querySelector('#dock-freq-note');
      const freqLambda = el.querySelector('#dock-freq-lambda');

      expect(freqVal?.textContent).toContain('432 Hz');
      expect(freqNote?.textContent).toBe('A4');
      expect(freqLambda?.textContent).toContain('λ: 79.4cm');
    });

    it('should toggle tone generation on master play button click', async () => {
      controlsBar.setFrequency(528);
      const el = controlsBar.getElement();
      const playBtn = el.querySelector('#btn-play-pause') as HTMLButtonElement;

      const initSpy = vi.spyOn(audioEngine, 'initialize').mockResolvedValue(undefined);
      const playFreqSpy = vi.spyOn(audioEngine, 'playFrequency').mockResolvedValue(undefined);

      playBtn.click();
      await Promise.resolve();

      expect(initSpy).toHaveBeenCalled();
      expect(playFreqSpy).toHaveBeenCalledWith(528);
    });
  });

  describe('Cross-Mode Adaptations & Global Utilities', () => {
    it('should adapt status pill for therapy, nobel, bio, and voice modes', () => {
      controlsBar.setMode('therapy');
      expect(controlsBar.getElement().textContent).toContain('Ablation Beam: 500 kHz');

      controlsBar.setMode('nobel');
      expect(controlsBar.getElement().textContent).toContain('Disruption Pulse: 432 Hz');

      controlsBar.setMode('bio');
      expect(controlsBar.getElement().textContent).toContain('Acoustic Drive: 220 Hz');

      controlsBar.setMode('voice');
      expect(controlsBar.getElement().textContent).toContain('Vocal Pitch f₀: 220 Hz');
    });

    it('should trigger screenshot callback when clicking Snapshot button', () => {
      const el = controlsBar.getElement();
      const snapBtn = el.querySelector('#btn-screenshot') as HTMLButtonElement;
      snapBtn.click();
      expect(screenshotSpy).toHaveBeenCalledTimes(1);
    });

    it('should trigger export callback when clicking Export button', () => {
      const el = controlsBar.getElement();
      const exportBtn = el.querySelector('#btn-export-dossier') as HTMLButtonElement;
      exportBtn.click();
      expect(exportSpy).toHaveBeenCalledTimes(1);
    });

    it('should adjust master volume on volume slider input', () => {
      const el = controlsBar.getElement();
      const volSlider = el.querySelector('#volume-slider') as HTMLInputElement;

      const setVolSpy = vi.spyOn(audioEngine, 'setMasterVolume');
      volSlider.value = '0.5';
      volSlider.dispatchEvent(new Event('input'));

      expect(setVolSpy).toHaveBeenCalledWith(0.5);
    });

    it('should configure marquee container and trigger scrolling when text overflows', () => {
      controlsBar.setMode('music');
      const el = controlsBar.getElement();
      const marqueeContainer = el.querySelector('[data-marquee]') as HTMLElement;
      const marqueeContent = el.querySelector('.marquee-content') as HTMLElement;

      expect(marqueeContainer).not.toBeNull();
      expect(marqueeContent).not.toBeNull();

      // Mock overflow scenario
      Object.defineProperty(marqueeContainer, 'clientWidth', { value: 150, configurable: true });
      Object.defineProperty(marqueeContent, 'scrollWidth', { value: 250, configurable: true });

      controlsBar.updateMarquees();

      expect(marqueeContent.classList.contains('is-scrolling')).toBe(true);
      expect(marqueeContainer.classList.contains('has-overflow')).toBe(true);
      expect(marqueeContent.style.getPropertyValue('--marquee-distance')).toBe('100px');

      // Mock non-overflow scenario
      Object.defineProperty(marqueeContainer, 'clientWidth', { value: 300, configurable: true });
      Object.defineProperty(marqueeContent, 'scrollWidth', { value: 200, configurable: true });

      controlsBar.updateMarquees();

      expect(marqueeContent.classList.contains('is-scrolling')).toBe(false);
      expect(marqueeContainer.classList.contains('has-overflow')).toBe(false);
      expect(marqueeContent.style.getPropertyValue('--marquee-distance')).toBe('');
    });

    it('should equip buttons and sliders with data-tooltip attributes instead of relying on native browser tooltips', () => {
      controlsBar.setMode('music');
      const el = controlsBar.getElement();

      const playBtn = el.querySelector('#btn-play-pause');
      const snapBtn = el.querySelector('#btn-screenshot');
      const exportBtn = el.querySelector('#btn-export-dossier');
      const scrubber = el.querySelector('#dock-timeline-scrubber');
      const volSlider = el.querySelector('#volume-slider');

      expect(playBtn?.getAttribute('data-tooltip')).toBe('Play Master Audio');
      expect(snapBtn?.getAttribute('data-tooltip')).toBe('Capture Screenshot (PNG)');
      expect(exportBtn?.getAttribute('data-tooltip')).toBe('Export Simulation Report & Data');
      expect(scrubber?.getAttribute('data-tooltip')).toBeDefined();
      expect(volSlider?.getAttribute('data-tooltip')).toContain('Volume:');
    });

    it('should render streaming track with 2-line title and source badge without truncation overlap', () => {
      vi.spyOn(audioEngine, 'getActiveStreamingTrack').mockReturnValue({
        id: 'am-cornfield',
        title: 'Cornfield Chase (Interstellar)',
        artist: 'Hans Zimmer',
        source: 'apple-music',
        album: 'Interstellar (Original Motion Picture Soundtrack)',
        durationMs: 126000,
        artworkUrl: 'https://example.com/art.jpg',
        previewUrl: 'https://example.com/preview.m4a',
        hasDirectAudio: true,
      });

      controlsBar.setMode('music');
      const el = controlsBar.getElement();

      expect(el.textContent).toContain('Cornfield Chase (Interstellar) — Hans Zimmer');
      expect(el.textContent).toContain('• Apple Music');
    });

    it('should render sound speed button and toggle popover menu with speed presets', () => {
      controlsBar.setMode('music');
      const el = controlsBar.getElement();

      const speedBtn = el.querySelector('#btn-speed') as HTMLButtonElement;
      expect(speedBtn).not.toBeNull();
      expect(speedBtn.textContent).toContain('1×');
      expect(speedBtn.getAttribute('data-tooltip')).toBe('Audio speed: 1×');

      // Popover should initially be closed
      expect(el.querySelector('#dock-speed-menu')).toBeNull();

      // Click to open popover
      speedBtn.click();
      const menu = el.querySelector('#dock-speed-menu');
      expect(menu).not.toBeNull();
      expect(el.querySelectorAll('.speed-option-btn').length).toBe(8);

      // Select 0.25x speed option
      const setSpeedSpy = vi.spyOn(audioEngine, 'setPlaybackSpeed');
      const speed025Btn = el.querySelector('[data-speed="0.25"]') as HTMLButtonElement;
      expect(speed025Btn).not.toBeNull();
      speed025Btn.click();

      expect(setSpeedSpy).toHaveBeenCalledWith(0.25);
      expect(el.querySelector('#dock-speed-menu')).toBeNull();
    });

    it('should reactively update speed button label and highlight when speed changes', () => {
      controlsBar.setMode('music');
      audioEngine.setPlaybackSpeed(1.25);
      const el = controlsBar.getElement();

      const speedBtn = el.querySelector('#btn-speed') as HTMLButtonElement;
      expect(speedBtn.textContent).toContain('1.25×');
      expect(speedBtn.className).toContain('text-cyan-300');
    });

    it('should dismiss open speed popover on Escape keydown', () => {
      controlsBar.setMode('music');
      const el = controlsBar.getElement();
      const speedBtn = el.querySelector('#btn-speed') as HTMLButtonElement;
      speedBtn.click();

      expect(el.querySelector('#dock-speed-menu')).not.toBeNull();

      // Dispatch Escape keydown event
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(el.querySelector('#dock-speed-menu')).toBeNull();
    });
  });
});
