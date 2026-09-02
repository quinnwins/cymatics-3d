import { describe, expect, it } from 'vitest';
import { compareChromaCircular } from './AnamnesisModel';

const C_MAJOR = [1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0];
const D_MAJOR = [0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0];

describe('Anamnesis transposition direction', () => {
  it('reports an upward return from C to D as +2 semitones', () => {
    const result = compareChromaCircular(D_MAJOR, C_MAJOR);
    expect(result.similarity).toBeCloseTo(1, 6);
    expect(result.transposition).toBe(2);
  });

  it('reports a downward return from D to C as -2 semitones', () => {
    const result = compareChromaCircular(C_MAJOR, D_MAJOR);
    expect(result.similarity).toBeCloseTo(1, 6);
    expect(result.transposition).toBe(-2);
  });
});
