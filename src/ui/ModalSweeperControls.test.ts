import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AudioEngine } from '../audio/AudioEngine';
import { ModalSweeperControls } from './ModalSweeperControls';

describe('ModalSweeperControls UI & Resonant Frequency', () => {
  let audioEngine: AudioEngine;
  let controls: ModalSweeperControls;

  beforeEach(() => {
    audioEngine = new AudioEngine();
    controls = new ModalSweeperControls(audioEngine);
  });

  it('should initialize with ground state (1,1,1) at 297.0 Hz (D4)', () => {
    const el = controls.getElement();
    const state = controls.getState();

    expect(state.n).toBe(1);
    expect(state.m).toBe(1);
    expect(state.l).toBe(1);
    expect(state.calculatedEigenfrequency).toBeCloseTo(297.0, 1);
    expect(state.noteInfo.name).toBe('D4');

    const freqEl = el.querySelector('#modal-freq-val');
    expect(freqEl?.textContent).toBe('297.0 Hz');
    const noteNameEl = el.querySelector('#modal-note-name');
    expect(noteNameEl?.textContent).toBe('D4');
  });

  it('should update resonant frequency readout and note in the DOM when sliders are changed', () => {
    const el = controls.getElement();
    const sliderN = el.querySelector('#slider-mode-n') as HTMLInputElement;
    expect(sliderN).toBeDefined();

    // Change Mode n to 2
    sliderN.value = '2';
    sliderN.dispatchEvent(new Event('input'));

    const state = controls.getState();
    expect(state.n).toBe(2);
    // (2,1,1): c/2 * sqrt(4 + 1 + 1) = 171.5 * sqrt(6) = 420.08 Hz -> 420.1 Hz (G#4)
    expect(state.calculatedEigenfrequency).toBeCloseTo(420.1, 1);

    const freqEl = el.querySelector('#modal-freq-val');
    expect(freqEl?.textContent).toBe('420.1 Hz');

    const noteNameEl = el.querySelector('#modal-note-name');
    expect(noteNameEl?.textContent).toBe('G#4');

    const totalCellsEl = el.querySelector('#modal-total-cells');
    expect(totalCellsEl?.textContent).toContain('2 Cells');
  });

  it('should dynamically retune synthesizer if playing when mode or preset changes', () => {
    audioEngine.synthesizer = {
      getIsPlaying: vi.fn().mockReturnValue(true),
      setFrequency: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      waveform: 'sine',
      frequency: 297.0,
      harmonics: {} as any,
    } as any;

    controls.applyPreset('cubic-lattice'); // (2,2,1) -> 514.5 Hz

    expect(audioEngine.synthesizer?.setFrequency).toHaveBeenCalledWith(514.5);

    const el = controls.getElement();
    const freqEl = el.querySelector('#modal-freq-val');
    expect(freqEl?.textContent).toBe('514.5 Hz');
    const noteNameEl = el.querySelector('#modal-note-name');
    expect(noteNameEl?.textContent).toBe('C5');
  });

  it('should increment and decrement modes when stepper buttons are clicked', () => {
    const el = controls.getElement();
    
    // Find increment button for n (axis=n, dir=1)
    const btnIncN = el.querySelector('button[data-axis="n"][data-dir="1"]') as HTMLButtonElement;
    expect(btnIncN).toBeDefined();
    btnIncN.click();

    expect(controls.getState().n).toBe(2);
    const badgeN = el.querySelector('#badge-mode-n');
    expect(badgeN?.textContent?.trim()).toBe('2');

    // Find decrement button for n (axis=n, dir=-1)
    const btnDecN = el.querySelector('button[data-axis="n"][data-dir="-1"]') as HTMLButtonElement;
    expect(btnDecN).toBeDefined();
    btnDecN.click();

    expect(controls.getState().n).toBe(1);
    expect(el.querySelector('#badge-mode-n')?.textContent?.trim()).toBe('1');
  });

  it('should render distinct axis theme classes on modal sliders', () => {
    const el = controls.getElement();
    const sliderN = el.querySelector('#slider-mode-n');
    const sliderM = el.querySelector('#slider-mode-m');
    const sliderL = el.querySelector('#slider-mode-l');

    expect(sliderN?.classList.contains('slider-cyan')).toBe(true);
    expect(sliderM?.classList.contains('slider-blue')).toBe(true);
    expect(sliderL?.classList.contains('slider-purple')).toBe(true);
  });

  it('should cleanly hide audition tone button, coupling toggle, and modal sliders in music mode while preserving shape controls', () => {
    controls.setMode('music');
    const el = controls.getElement();

    expect(controls.getMode()).toBe('music');
    // Audition tone button, pitch telemetry pill, coupling toggle, and manual (n, m, l) sliders should NOT be rendered in Music mode
    expect(el.querySelector('#btn-audition-eigenfrequency')).toBeNull();
    expect(el.querySelector('#modal-freq-val')).toBeNull();
    expect(el.querySelector('#btn-toggle-coupling')).toBeNull();
    expect(el.querySelector('#slider-mode-n')).toBeNull();

    // Summary badge in header displays clean geometry and trapping mode
    const summary = el.querySelector('#modal-header-summary');
    expect(summary?.textContent?.trim()).toBe('CUBE • NODES');

    // Chamber shape buttons, boundary, and trapping remain accessible in Music mode, while bottom presets are hidden
    expect(el.querySelectorAll('.btn-geometry').length).toBe(3);
    expect(el.querySelector('#btn-enclosure-glass')).not.toBeNull();
    expect(el.querySelector('#btn-trap-nodes')).not.toBeNull();
    expect(el.querySelectorAll('.btn-preset-card').length).toBe(0);
  });

  it('should restore modal sliders, 1-click presets, audition tone button, and frequency telemetry when switched back to frequency mode', () => {
    controls.setMode('music');
    expect(controls.getElement().querySelector('#btn-audition-eigenfrequency')).toBeNull();
    expect(controls.getElement().querySelector('#slider-mode-n')).toBeNull();
    expect(controls.getElement().querySelectorAll('.btn-preset-card').length).toBe(0);

    controls.setMode('frequency');
    const el = controls.getElement();
    expect(el.querySelector('#btn-audition-eigenfrequency')).not.toBeNull();
    expect(el.querySelector('#modal-freq-val')).not.toBeNull();
    expect(el.querySelector('#btn-toggle-coupling')).not.toBeNull();
    expect(el.querySelector('#slider-mode-n')).not.toBeNull();
    expect(el.querySelectorAll('.btn-preset-card').length).toBe(7);
  });
});
