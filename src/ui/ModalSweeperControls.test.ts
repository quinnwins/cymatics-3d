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
});
