import { beforeEach, describe, expect, it } from 'vitest';
import {
  AnamnesisModel,
  MemoryRelicStore,
  compareChromaCircular,
} from './AnamnesisModel';
import type { MemoryBands } from './AnamnesisModel';

const SAMPLE_RATE = 48_000;
const FFT_BINS = 2048;

function spectrumFor(notes: number[], levelDb = -34): Float32Array {
  const spectrum = new Float32Array(FFT_BINS);
  spectrum.fill(-110);
  const binWidth = SAMPLE_RATE / (FFT_BINS * 2);
  for (const fundamental of notes) {
    for (let harmonic = 1; harmonic <= 7; harmonic += 1) {
      const frequency = fundamental * harmonic;
      if (frequency > 18_000) continue;
      const bin = Math.round(frequency / binWidth);
      for (let spread = -1; spread <= 1; spread += 1) {
        const index = bin + spread;
        if (index <= 0 || index >= spectrum.length) continue;
        spectrum[index] = Math.max(
          spectrum[index],
          levelDb - 9 * Math.log2(harmonic) - Math.abs(spread) * 4
        );
      }
    }
  }
  return spectrum;
}

function bands(kind: 'warm' | 'bright' = 'warm'): MemoryBands {
  return kind === 'warm'
    ? { subBass: 0.18, bass: 0.48, lowMid: 0.83, mid: 0.62, highMid: 0.25, high: 0.12, rms: 0.52 }
    : { subBass: 0.08, bass: 0.22, lowMid: 0.46, mid: 0.72, highMid: 0.68, high: 0.42, rms: 0.56 };
}

function ingestPhrase(
  model: AnamnesisModel,
  startSeconds: number,
  phrase: Array<{ notes: number[]; timbre?: 'warm' | 'bright' }>,
  transposeRatio = 1
): void {
  for (let index = 0; index < phrase.length; index += 1) {
    const entry = phrase[index];
    const notes = entry.notes.map(note => note * transposeRatio);
    model.ingest({
      timeSeconds: startSeconds + index * 0.4,
      durationSeconds: 36,
      sampleRate: SAMPLE_RATE,
      spectrum: spectrumFor(notes),
      bands: bands(entry.timbre),
      fundamentalHz: notes[0],
      transient: index === 0 ? 1.2 : 0,
    });
  }
}

const PHRASE = [
  { notes: [220, 277.18, 329.63] },
  { notes: [220, 277.18, 329.63] },
  { notes: [246.94, 311.13, 369.99] },
  { notes: [246.94, 311.13, 369.99] },
  { notes: [261.63, 329.63, 392] },
  { notes: [261.63, 329.63, 392] },
  { notes: [196, 246.94, 293.66] },
  { notes: [196, 246.94, 293.66] },
];

const CONTRAST = [
  { notes: [146.83, 220, 293.66], timbre: 'bright' as const },
  { notes: [146.83, 220, 293.66], timbre: 'bright' as const },
  { notes: [164.81, 246.94, 329.63], timbre: 'bright' as const },
  { notes: [164.81, 246.94, 329.63], timbre: 'bright' as const },
  { notes: [174.61, 261.63, 349.23], timbre: 'bright' as const },
  { notes: [174.61, 261.63, 349.23], timbre: 'bright' as const },
  { notes: [130.81, 196, 261.63], timbre: 'bright' as const },
  { notes: [130.81, 196, 261.63], timbre: 'bright' as const },
];

describe('AnamnesisModel', () => {
  beforeEach(() => localStorage.clear());

  it('finds the strongest circular chroma alignment and reports transposition', () => {
    const c = [1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0];
    const d = [0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0];
    const comparison = compareChromaCircular(c, d);
    expect(comparison.similarity).toBeCloseTo(1, 6);
    expect(Math.abs(comparison.transposition)).toBe(2);
  });

  it('keeps silence empty and samples audible observations on a stable cadence', () => {
    const model = new AnamnesisModel({ sampleIntervalSeconds: 0.4 });
    model.reset({ identity: 'silence', title: 'Silence', source: 'test' });

    const silent = new Float32Array(FFT_BINS);
    expect(model.ingest({ timeSeconds: 0, spectrum: silent, bands: bands() })).toBeNull();
    expect(model.getStats().moments).toBe(0);

    const audible = spectrumFor([220, 330]);
    expect(model.ingest({ timeSeconds: 0.01, spectrum: audible, bands: bands() })).not.toBeNull();
    expect(model.ingest({ timeSeconds: 0.2, spectrum: audible, bands: bands() })).toBeNull();
    expect(model.ingest({ timeSeconds: 0.41, spectrum: audible, bands: bands() })).not.toBeNull();
    expect(model.getStats().moments).toBe(2);
  });

  it('recognizes a returning phrase only after its multi-frame trajectory repeats', () => {
    const model = new AnamnesisModel({
      sampleIntervalSeconds: 0.4,
      minEchoGapSeconds: 4,
      echoThreshold: 0.86,
      sequenceFrames: 8,
    });
    model.reset({ identity: 'return', title: 'Return', source: 'test', durationSeconds: 36 });

    ingestPhrase(model, 0, PHRASE);
    ingestPhrase(model, 4, CONTRAST);
    expect(model.getStats().echoes).toBe(0);

    ingestPhrase(model, 8, PHRASE);
    const stats = model.getStats();
    expect(stats.echoes).toBeGreaterThan(0);
    expect(stats.strongestEcho).toBeGreaterThan(0.9);
    expect((stats.lastReturn?.toSeconds || 0) - (stats.lastReturn?.fromSeconds || 0)).toBeGreaterThan(4);
  });

  it('does not treat one matching chord inside a different phrase as a return', () => {
    const model = new AnamnesisModel({
      sampleIntervalSeconds: 0.4,
      minEchoGapSeconds: 3,
      echoThreshold: 0.91,
      sequenceFrames: 8,
    });
    model.reset({ identity: 'false-positive', title: 'False positive', source: 'test' });

    ingestPhrase(model, 0, PHRASE);
    ingestPhrase(model, 4, CONTRAST);
    const unlike = [
      { notes: [110, 138.59, 164.81], timbre: 'bright' as const },
      { notes: [123.47, 155.56, 185], timbre: 'warm' as const },
      { notes: [138.59, 174.61, 207.65], timbre: 'bright' as const },
      { notes: [155.56, 196, 233.08], timbre: 'warm' as const },
      { notes: [174.61, 220, 261.63], timbre: 'bright' as const },
      { notes: [185, 233.08, 277.18], timbre: 'warm' as const },
      { notes: [207.65, 261.63, 311.13], timbre: 'bright' as const },
      PHRASE[PHRASE.length - 1],
    ];
    ingestPhrase(model, 8, unlike);

    expect(model.getStats().echoes).toBe(0);
  });

  it('connects a phrase that returns in another key and preserves the interval', () => {
    const model = new AnamnesisModel({
      sampleIntervalSeconds: 0.4,
      minEchoGapSeconds: 4,
      echoThreshold: 0.84,
      sequenceFrames: 8,
    });
    model.reset({ identity: 'transpose', title: 'Transposed return', source: 'test' });

    ingestPhrase(model, 0, PHRASE);
    ingestPhrase(model, 4, CONTRAST);
    ingestPhrase(model, 8, PHRASE, Math.pow(2, 2 / 12));

    const threads = model.getThreads();
    expect(threads.length).toBeGreaterThan(0);
    expect(threads.some(thread => Math.abs(thread.transposition) === 2)).toBe(true);
  });

  it('marks abrupt structural change as more novel than stable continuation', () => {
    const model = new AnamnesisModel({ sampleIntervalSeconds: 0.4, sequenceFrames: 6 });
    model.reset({ identity: 'novelty', title: 'Novelty', source: 'test' });
    const steady = spectrumFor([220, 277.18, 329.63]);
    let stableNovelty = 0;
    for (let index = 0; index < 8; index += 1) {
      const result = model.ingest({
        timeSeconds: index * 0.4,
        spectrum: steady,
        bands: bands('warm'),
        fundamentalHz: 220,
      });
      if (result) stableNovelty = result.point.novelty;
    }
    const changed = model.ingest({
      timeSeconds: 3.2,
      spectrum: spectrumFor([932.33, 1174.66, 1396.91], -26),
      bands: bands('bright'),
      fundamentalHz: 932.33,
      transient: 2,
    });
    expect(changed).not.toBeNull();
    expect(changed!.point.novelty).toBeGreaterThan(stableNovelty + 0.25);
  });

  it('stores derived relics without retaining FFT or hidden feature arrays', () => {
    const model = new AnamnesisModel({ sampleIntervalSeconds: 0.4 });
    model.reset({ identity: 'relic', title: 'Kept memory', source: 'test' });
    ingestPhrase(model, 0, PHRASE);

    const relic = model.toRelic(new Date('2026-09-02T08:00:00.000Z'));
    expect(relic.points.length).toBe(PHRASE.length);
    expect(relic.id).toMatch(/^relic-/);
    expect('chroma' in (relic.points[0] as unknown as Record<string, unknown>)).toBe(false);
    expect('timbre' in (relic.points[0] as unknown as Record<string, unknown>)).toBe(false);

    const store = new MemoryRelicStore('test.relics', 2);
    store.save(relic);
    expect(store.list()).toHaveLength(1);
    expect(store.list()[0].meta.title).toBe('Kept memory');
    store.remove(relic.id);
    expect(store.list()).toHaveLength(0);
  });

  it('preserves the full arc of long performances by compacting instead of dropping the beginning', () => {
    const model = new AnamnesisModel({ sampleIntervalSeconds: 0.12, maxPoints: 64, sequenceFrames: 4 });
    model.reset({ identity: 'long', title: 'Long performance', source: 'test', durationSeconds: 120 });
    const audible = spectrumFor([220, 330]);
    for (let index = 0; index < 160; index += 1) {
      model.ingest({
        timeSeconds: index * 0.12,
        durationSeconds: 120,
        spectrum: audible,
        bands: bands(),
        fundamentalHz: 220,
      });
    }
    const points = model.getPoints();
    expect(points.length).toBeLessThanOrEqual(64);
    expect(points[0].timeSeconds).toBe(0);
    expect(points[points.length - 1].timeSeconds).toBeGreaterThan(18);
  });
});
