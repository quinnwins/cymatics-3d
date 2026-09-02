import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AudioEngine } from '../audio/AudioEngine';
import { FrequencyLabControls } from './FrequencyLabControls';

describe('FrequencyLabControls UI - Precision Harmonic Synthesizer Deck', () => {
  let audioEngine: AudioEngine;
  let controls: FrequencyLabControls;

  beforeEach(() => {
    audioEngine = new AudioEngine();
    controls = new FrequencyLabControls(audioEngine);
  });

  it('initializes with default 432 Hz (A4 Note) and pure tone generator controls', () => {
    const el = controls.getElement();
    expect(controls.getFrequency()).toBe(432);

    const numInput = el.querySelector('#freq-number-input') as HTMLInputElement;
    expect(numInput.value).toBe('432');

    const noteName = el.querySelector('#label-note-name');
    expect(noteName?.textContent).toBe('A4');

    const waveformSelect = el.querySelector('#waveform-select') as HTMLSelectElement;
    expect(waveformSelect.value).toBe('sine');
  });

  it('updates frequency when stepping via multiplier (x2, div2) and delta buttons (+1Hz, -1Hz, +10Hz, -10Hz)', () => {
    const el = controls.getElement();
    controls.setFrequency(432);

    const mult2 = el.querySelector('[data-multiplier="2"]') as HTMLButtonElement;
    mult2.click();
    expect(controls.getFrequency()).toBe(864);

    const div2 = el.querySelector('[data-multiplier="0.5"]') as HTMLButtonElement;
    div2.click();
    expect(controls.getFrequency()).toBe(432);

    const inc1 = el.querySelector('[data-delta-hz="1"]') as HTMLButtonElement;
    inc1.click();
    expect(controls.getFrequency()).toBe(433);

    const dec1 = el.querySelector('[data-delta-hz="-1"]') as HTMLButtonElement;
    dec1.click();
    expect(controls.getFrequency()).toBe(432);
  });

  it('sets Solfeggio frequency on preset chip click', () => {
    const el = controls.getElement();
    const chip528 = el.querySelector('[data-hz="528"]') as HTMLButtonElement;
    expect(chip528).not.toBeNull();

    chip528.click();
    expect(controls.getFrequency()).toBe(528);

    const noteName = el.querySelector('#label-note-name');
    expect(noteName?.textContent).toBe('C5');
  });

  it('toggles sound generation on Play/Pause button click', async () => {
    const el = controls.getElement();
    const playBtn = el.querySelector('#btn-freq-sound-toggle') as HTMLButtonElement;

    const initSpy = vi.spyOn(audioEngine, 'initialize').mockResolvedValue(undefined);
    const playFreqSpy = vi.spyOn(audioEngine, 'playFrequency').mockResolvedValue(undefined);

    playBtn.click();
    await Promise.resolve();

    expect(initSpy).toHaveBeenCalled();
    expect(playFreqSpy).toHaveBeenCalledWith(432);
  });
});
