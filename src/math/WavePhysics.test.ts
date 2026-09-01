import { describe, it, expect } from 'vitest';
import { WavePhysics } from './WavePhysics';

describe('WavePhysics', () => {
  it('converts 440 Hz accurately to A4 note', () => {
    const note = WavePhysics.frequencyToNote(440);
    expect(note.name).toBe('A4');
    expect(note.octave).toBe(4);
    expect(note.cents).toBe(0);
  });

  it('converts 528 Hz to C5 (+16 cents approx)', () => {
    const note = WavePhysics.frequencyToNote(528);
    expect(note.name).toBe('C5');
  });

  it('converts MIDI note 69 to 440 Hz', () => {
    expect(WavePhysics.midiToFrequency(69)).toBeCloseTo(440, 2);
    expect(WavePhysics.midiToFrequency(60)).toBeCloseTo(261.63, 2); // Middle C
  });

  it('calculates acoustic wavenumber k = 2*PI*f / c', () => {
    const k440 = WavePhysics.wavenumber(440, 343);
    // k = 2 * PI * 440 / 343 = 8.060
    expect(k440).toBeCloseTo(8.060, 2);
  });

  it('evaluates 3D Chladni function values deterministically', () => {
    const chladni = WavePhysics.chladni3D(0, 0, 0, 1, 2, 3);
    // cos(0) * cos(0) * cos(0) - ... = 1 - 1 + 1 = 1
    expect(chladni).toBeCloseTo(1.0, 5);
  });
});
