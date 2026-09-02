/**
 * AnamnesisModel
 *
 * Long-horizon musical memory for SoundForm. The existing Sonic Memory layer
 * maps the most recent seconds onto radius. Anamnesis listens at a slower
 * cadence, keeps the whole performance, and links moments that return to a
 * similar harmonic/timbral state.
 *
 * It is deliberately unsupervised and local. It does not label a chorus or
 * claim to know musical intent; it exposes recurrence, novelty, and kinship.
 */

export interface MemoryBands {
  subBass: number;
  bass: number;
  lowMid: number;
  mid: number;
  highMid: number;
  high: number;
  rms: number;
}

export interface MemorySessionMeta {
  identity: string;
  title: string;
  artist?: string;
  source: string;
  durationSeconds?: number;
  artworkUrl?: string;
}

export interface MemoryObservation {
  timeSeconds: number;
  durationSeconds?: number;
  sampleRate?: number;
  spectrum: Float32Array | readonly number[];
  bands: MemoryBands;
  fundamentalHz?: number;
  transient?: number;
}

export interface MemoryPoint {
  id: number;
  timeSeconds: number;
  progress: number;
  position: [number, number, number];
  energy: number;
  novelty: number;
  centroid: number;
  pitchClass: number;
  familyId: number;
  echoStrength: number;
}

export interface EchoThread {
  id: number;
  from: number;
  to: number;
  similarity: number;
  harmonicSimilarity: number;
  timbralSimilarity: number;
  transposition: number;
  familyId: number;
  timeGapSeconds: number;
}

export interface AnamnesisStats {
  moments: number;
  echoes: number;
  families: number;
  capturedSeconds: number;
  strongestEcho: number;
  lastReturn: {
    fromSeconds: number;
    toSeconds: number;
    similarity: number;
    transposition: number;
  } | null;
}

export interface MemoryRelic {
  version: 1;
  id: string;
  createdAt: string;
  meta: MemorySessionMeta;
  points: MemoryPoint[];
  threads: EchoThread[];
  stats: AnamnesisStats;
}

export interface MemoryIngestResult {
  point: MemoryPoint;
  thread: EchoThread | null;
  stats: AnamnesisStats;
}

export interface AnamnesisOptions {
  sampleIntervalSeconds?: number;
  minEchoGapSeconds?: number;
  echoThreshold?: number;
  maxPoints?: number;
  maxThreads?: number;
  threadSpacing?: number;
  sequenceFrames?: number;
}

interface FeatureFrame extends MemoryPoint {
  chroma: number[];
  timbre: number[];
}

interface ExtractedFeature {
  silent: boolean;
  energy: number;
  centroid: number;
  pitchClass: number;
  chroma: number[];
  timbre: number[];
}

interface SimilarityResult {
  score: number;
  harmonic: number;
  timbral: number;
  transposition: number;
}

const TAU = Math.PI * 2;
const DEFAULT_SAMPLE_INTERVAL = 0.4;
const DEFAULT_MIN_ECHO_GAP = 10;
const DEFAULT_ECHO_THRESHOLD = 0.9;
const DEFAULT_MAX_POINTS = 1152;
const DEFAULT_MAX_THREADS = 1400;
const DEFAULT_THREAD_SPACING = 4;
const DEFAULT_SEQUENCE_FRAMES = 8;
const MIN_AUDIBLE_ENERGY = 0.008;

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

function wrapPitchClass(value: number): number {
  const wrapped = Math.round(value) % 12;
  return wrapped < 0 ? wrapped + 12 : wrapped;
}

function l2Normalize(values: number[]): number[] {
  let sumSquares = 0;
  for (const value of values) sumSquares += value * value;
  const length = Math.sqrt(sumSquares);
  if (length < 1e-9) return values.map(() => 0);
  return values.map(value => value / length);
}

function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
  const count = Math.min(a.length, b.length);
  if (count === 0) return 0;
  let dot = 0;
  let aa = 0;
  let bb = 0;
  for (let i = 0; i < count; i += 1) {
    dot += a[i] * b[i];
    aa += a[i] * a[i];
    bb += b[i] * b[i];
  }
  const denominator = Math.sqrt(aa * bb);
  return denominator > 1e-9 ? clamp(dot / denominator) : 0;
}

/**
 * Circular chroma correlation. Returning the strongest rotation makes the
 * recurrence test tolerant of a section returning in a different key while
 * preserving the transposition as visual information.
 */
export function compareChromaCircular(
  current: readonly number[],
  previous: readonly number[]
): { similarity: number; transposition: number } {
  if (current.length < 12 || previous.length < 12) {
    return { similarity: cosineSimilarity(current, previous), transposition: 0 };
  }

  let best = -Infinity;
  let bestShift = 0;
  for (let shift = 0; shift < 12; shift += 1) {
    let dot = 0;
    let aa = 0;
    let bb = 0;
    for (let pitchClass = 0; pitchClass < 12; pitchClass += 1) {
      const a = current[pitchClass];
      const b = previous[(pitchClass + shift) % 12];
      dot += a * b;
      aa += a * a;
      bb += b * b;
    }
    const score = aa > 1e-9 && bb > 1e-9 ? dot / Math.sqrt(aa * bb) : 0;
    if (score > best) {
      best = score;
      bestShift = shift;
    }
  }

  // bestShift rotates the previous chroma toward the current chroma. Report
  // the inverse rotation so the interval reads from the earlier phrase to its
  // return: C returning in D is +2, not -2.
  const returnShift = (12 - bestShift) % 12;
  const signedShift = returnShift > 6 ? returnShift - 12 : returnShift;
  return { similarity: clamp(best), transposition: signedShift };
}

function formatRelicId(identity: string, createdAt: string): string {
  const source = `${identity}|${createdAt}`;
  let hash = 2166136261;
  for (let i = 0; i < source.length; i += 1) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `relic-${(hash >>> 0).toString(36)}`;
}

export class AnamnesisModel {
  private readonly sampleIntervalSeconds: number;
  private readonly minEchoGapSeconds: number;
  private readonly echoThreshold: number;
  private readonly maxPoints: number;
  private readonly maxThreads: number;
  private readonly threadSpacing: number;
  private readonly sequenceFrames: number;

  private meta: MemorySessionMeta = {
    identity: 'unbound',
    title: 'Untitled performance',
    source: 'unknown',
    durationSeconds: 0,
  };
  private frames: FeatureFrame[] = [];
  private threads: EchoThread[] = [];
  private lastSampleTime = -Infinity;
  private familyCounter = 0;
  private strongestEcho = 0;
  private lastReturn: AnamnesisStats['lastReturn'] = null;

  constructor(options: AnamnesisOptions = {}) {
    this.sampleIntervalSeconds = clamp(
      options.sampleIntervalSeconds ?? DEFAULT_SAMPLE_INTERVAL,
      0.12,
      2
    );
    this.minEchoGapSeconds = clamp(
      options.minEchoGapSeconds ?? DEFAULT_MIN_ECHO_GAP,
      2,
      120
    );
    this.echoThreshold = clamp(
      options.echoThreshold ?? DEFAULT_ECHO_THRESHOLD,
      0.5,
      0.995
    );
    this.maxPoints = Math.round(clamp(options.maxPoints ?? DEFAULT_MAX_POINTS, 64, 4096));
    this.maxThreads = Math.round(clamp(options.maxThreads ?? DEFAULT_MAX_THREADS, 16, 8192));
    this.threadSpacing = Math.round(clamp(options.threadSpacing ?? DEFAULT_THREAD_SPACING, 1, 24));
    this.sequenceFrames = Math.round(clamp(options.sequenceFrames ?? DEFAULT_SEQUENCE_FRAMES, 4, 24));
  }

  public reset(meta?: Partial<MemorySessionMeta>): void {
    this.meta = {
      identity: meta?.identity || 'unbound',
      title: meta?.title || 'Untitled performance',
      artist: meta?.artist,
      source: meta?.source || 'unknown',
      durationSeconds: Math.max(0, Number(meta?.durationSeconds) || 0),
      artworkUrl: meta?.artworkUrl,
    };
    this.frames = [];
    this.threads = [];
    this.lastSampleTime = -Infinity;
    this.familyCounter = 0;
    this.strongestEcho = 0;
    this.lastReturn = null;
  }

  public getMeta(): Readonly<MemorySessionMeta> {
    return { ...this.meta };
  }

  public getPoints(): readonly MemoryPoint[] {
    return this.frames;
  }

  public getThreads(): readonly EchoThread[] {
    return this.threads;
  }

  public getStats(): AnamnesisStats {
    const capturedSeconds = this.frames.length > 1
      ? Math.max(0, this.frames[this.frames.length - 1].timeSeconds - this.frames[0].timeSeconds)
      : 0;
    const families = new Set(this.frames.filter(frame => frame.familyId >= 0).map(frame => frame.familyId)).size;
    return {
      moments: this.frames.length,
      echoes: this.threads.length,
      families,
      capturedSeconds,
      strongestEcho: this.strongestEcho,
      lastReturn: this.lastReturn ? { ...this.lastReturn } : null,
    };
  }

  public ingest(observation: MemoryObservation): MemoryIngestResult | null {
    const timeSeconds = Math.max(0, Number(observation.timeSeconds) || 0);
    if (timeSeconds + 1e-6 < this.lastSampleTime) {
      // Seeking backward explores the existing relic rather than duplicating it.
      return null;
    }
    if (timeSeconds - this.lastSampleTime + 1e-6 < this.sampleIntervalSeconds) return null;

    const duration = Math.max(
      0,
      Number(observation.durationSeconds) || Number(this.meta.durationSeconds) || 0
    );
    if (duration > 0 && Math.abs(duration - (this.meta.durationSeconds || 0)) > 0.5) {
      this.meta.durationSeconds = duration;
      this.reflow(duration);
    }

    const feature = this.extractFeature(observation);
    if (feature.silent || feature.energy < MIN_AUDIBLE_ENERGY) return null;

    this.lastSampleTime = timeSeconds;
    if (this.frames.length >= this.maxPoints) {
      // Preserve the whole path by thinning adjacent samples instead of simply
      // deleting the beginning of the song. Threads are rebuilt against the
      // retained indices after compaction.
      this.compact();
    }

    const novelty = this.calculateNovelty(feature, observation.transient || 0);
    const id = this.frames.length;
    const position = this.positionFor(feature, timeSeconds, duration, novelty);
    const progress = duration > 0
      ? clamp(timeSeconds / duration)
      : clamp(1 - Math.exp(-timeSeconds / 180));

    const frame: FeatureFrame = {
      id,
      timeSeconds,
      progress,
      position,
      energy: feature.energy,
      novelty,
      centroid: feature.centroid,
      pitchClass: feature.pitchClass,
      familyId: -1,
      echoStrength: 0,
      chroma: feature.chroma,
      timbre: feature.timbre,
    };

    const match = this.findEcho(frame);
    let thread: EchoThread | null = null;
    if (match) {
      const target = this.frames[match.index];
      const previousThread = this.threads[this.threads.length - 1];
      const tooCloseToPrevious = Boolean(previousThread
        && id - previousThread.from < this.threadSpacing
        && Math.abs(match.index - previousThread.to) < this.threadSpacing);

      let familyId = target.familyId;
      if (tooCloseToPrevious && previousThread) {
        familyId = previousThread.familyId;
      } else if (familyId < 0) {
        // A returning phrase spans neighboring moments. Reuse the family of a
        // nearby matched frame before inventing a new one, so a chorus becomes
        // one constellation rather than a row of unrelated pairings.
        const familyStart = Math.max(0, match.index - this.sequenceFrames);
        const familyEnd = Math.min(this.frames.length - 1, match.index + this.sequenceFrames);
        for (let index = familyStart; index <= familyEnd; index += 1) {
          if (this.frames[index].familyId >= 0) {
            familyId = this.frames[index].familyId;
            break;
          }
        }
      }
      if (familyId < 0) {
        familyId = this.familyCounter;
        this.familyCounter += 1;
      }
      target.familyId = familyId;
      frame.familyId = familyId;
      frame.echoStrength = match.similarity.score;

      if (!tooCloseToPrevious) {
        thread = {
          id: this.threads.length,
          from: id,
          to: match.index,
          similarity: match.similarity.score,
          harmonicSimilarity: match.similarity.harmonic,
          timbralSimilarity: match.similarity.timbral,
          transposition: match.similarity.transposition,
          familyId,
          timeGapSeconds: Math.max(0, timeSeconds - target.timeSeconds),
        };
        this.threads.push(thread);
        if (this.threads.length > this.maxThreads) {
          this.threads.splice(0, this.threads.length - this.maxThreads);
          this.threads.forEach((entry, index) => { entry.id = index; });
        }

        this.strongestEcho = Math.max(this.strongestEcho, thread.similarity);
        this.lastReturn = {
          fromSeconds: target.timeSeconds,
          toSeconds: timeSeconds,
          similarity: thread.similarity,
          transposition: thread.transposition,
        };
      }
    }

    this.frames.push(frame);
    return { point: frame, thread, stats: this.getStats() };
  }

  public findNearestTime(timeSeconds: number): MemoryPoint | null {
    if (this.frames.length === 0) return null;
    let nearest = this.frames[0];
    let bestDistance = Math.abs(nearest.timeSeconds - timeSeconds);
    for (let i = 1; i < this.frames.length; i += 1) {
      const distance = Math.abs(this.frames[i].timeSeconds - timeSeconds);
      if (distance < bestDistance) {
        bestDistance = distance;
        nearest = this.frames[i];
      }
    }
    return nearest;
  }

  public toRelic(now = new Date()): MemoryRelic {
    const createdAt = now.toISOString();
    const points = this.frames.map(({ chroma: _chroma, timbre: _timbre, ...point }) => ({
      ...point,
      position: [...point.position] as [number, number, number],
    }));
    return {
      version: 1,
      id: formatRelicId(this.meta.identity, createdAt),
      createdAt,
      meta: { ...this.meta },
      points,
      threads: this.threads.map(thread => ({ ...thread })),
      stats: this.getStats(),
    };
  }

  public static isRelic(value: unknown): value is MemoryRelic {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as Partial<MemoryRelic>;
    return candidate.version === 1
      && typeof candidate.id === 'string'
      && Boolean(candidate.meta)
      && Array.isArray(candidate.points)
      && Array.isArray(candidate.threads);
  }

  private extractFeature(observation: MemoryObservation): ExtractedFeature {
    const spectrum = observation.spectrum;
    const sampleRate = clamp(Number(observation.sampleRate) || 48_000, 8_000, 192_000);
    const fftSize = Math.max(2, spectrum.length * 2);
    const binWidth = sampleRate / fftSize;
    const chroma = new Array<number>(12).fill(0);

    let zeroFilled = true;
    let peakDb = -Infinity;
    let weightedLogFrequency = 0;
    let spectralWeight = 0;

    for (let index = 1; index < spectrum.length; index += 1) {
      const raw = Number(spectrum[index]);
      if (raw !== 0) zeroFilled = false;
      const frequency = index * binWidth;
      if (frequency < 35 || frequency > Math.min(18_000, sampleRate * 0.49)) continue;
      if (Number.isFinite(raw)) peakDb = Math.max(peakDb, raw);
    }

    const bandValues = [
      observation.bands.subBass,
      observation.bands.bass,
      observation.bands.lowMid,
      observation.bands.mid,
      observation.bands.highMid,
      observation.bands.high,
    ].map(value => Math.sqrt(Math.max(0, Number(value) || 0)));
    const timbre = l2Normalize(bandValues);
    const rmsPresence = clamp(Math.sqrt(Math.max(0, observation.bands.rms || 0) / 1.6));

    if (zeroFilled || !Number.isFinite(peakDb)) {
      return {
        silent: true,
        energy: 0,
        centroid: 0,
        pitchClass: 0,
        chroma,
        timbre,
      };
    }

    const absolutePresence = clamp((peakDb + 82) / 52);
    for (let index = 1; index < spectrum.length; index += 1) {
      const frequency = index * binWidth;
      if (frequency < 35 || frequency > Math.min(18_000, sampleRate * 0.49)) continue;
      const rawDb = Number(spectrum[index]);
      const db = Number.isFinite(rawDb) ? rawDb : -120;
      if (db < -96) continue;

      const relativeAmplitude = Math.pow(10, (db - peakDb) / 20);
      const absoluteAmplitude = Math.pow(absolutePresence, 0.72);
      const weight = Math.pow(relativeAmplitude, 1.2) * absoluteAmplitude;
      if (weight < 1e-6) continue;

      weightedLogFrequency += Math.log2(Math.max(35, frequency)) * weight;
      spectralWeight += weight;

      if (frequency >= 55 && frequency <= 5_500) {
        const midi = 69 + 12 * Math.log2(frequency / 440);
        const pitchClass = wrapPitchClass(midi);
        // Prevent dense upper harmonics from drowning the fundamental region.
        const harmonicWeight = weight / Math.sqrt(Math.max(1, frequency / 110));
        chroma[pitchClass] += harmonicWeight;
      }
    }

    const normalizedChroma = l2Normalize(chroma);
    let dominantPitchClass = 0;
    let dominantValue = -Infinity;
    for (let pitchClass = 0; pitchClass < 12; pitchClass += 1) {
      if (normalizedChroma[pitchClass] > dominantValue) {
        dominantValue = normalizedChroma[pitchClass];
        dominantPitchClass = pitchClass;
      }
    }

    const fundamentalHz = Math.max(0, Number(observation.fundamentalHz) || 0);
    const pitchClass = fundamentalHz > 20
      ? wrapPitchClass(69 + 12 * Math.log2(fundamentalHz / 440))
      : dominantPitchClass;
    const logCentroid = spectralWeight > 1e-9 ? weightedLogFrequency / spectralWeight : Math.log2(55);
    const centroid = clamp((logCentroid - Math.log2(40)) / (Math.log2(16_000) - Math.log2(40)));
    const energy = clamp(rmsPresence * 0.58 + absolutePresence * 0.42);

    return {
      silent: peakDb < -91 && rmsPresence < 0.02,
      energy,
      centroid,
      pitchClass,
      chroma: normalizedChroma,
      timbre,
    };
  }

  private calculateNovelty(feature: ExtractedFeature, transient: number): number {
    if (this.frames.length === 0) return clamp(0.45 + transient * 0.25);
    const window = this.frames.slice(Math.max(0, this.frames.length - 5));
    const averageChroma = new Array<number>(12).fill(0);
    const averageTimbre = new Array<number>(6).fill(0);
    let averageCentroid = 0;
    for (const frame of window) {
      for (let i = 0; i < 12; i += 1) averageChroma[i] += frame.chroma[i];
      for (let i = 0; i < 6; i += 1) averageTimbre[i] += frame.timbre[i];
      averageCentroid += frame.centroid;
    }
    const divisor = Math.max(1, window.length);
    for (let i = 0; i < 12; i += 1) averageChroma[i] /= divisor;
    for (let i = 0; i < 6; i += 1) averageTimbre[i] /= divisor;
    averageCentroid /= divisor;

    const harmonic = compareChromaCircular(feature.chroma, averageChroma).similarity;
    const timbral = cosineSimilarity(feature.timbre, averageTimbre);
    const centroidChange = clamp(Math.abs(feature.centroid - averageCentroid) * 2.4);
    const change = 1 - (harmonic * 0.52 + timbral * 0.38 + (1 - centroidChange) * 0.1);
    return clamp(change * 1.25 + clamp(transient, 0, 3) * 0.13);
  }

  private findEcho(frame: FeatureFrame): { index: number; similarity: SimilarityResult } | null {
    const sequenceLength = this.sequenceFrames;
    if (this.frames.length < sequenceLength * 2) return null;

    const currentSequence = [
      ...this.frames.slice(Math.max(0, this.frames.length - sequenceLength + 1)),
      frame,
    ];
    if (currentSequence.length < sequenceLength) return null;

    const currentStartTime = currentSequence[0].timeSeconds;
    let bestIndex = -1;
    let bestSimilarity: SimilarityResult = {
      score: 0,
      harmonic: 0,
      timbral: 0,
      transposition: 0,
    };

    for (let candidateEnd = sequenceLength - 1; candidateEnd < this.frames.length; candidateEnd += 1) {
      const candidateStart = candidateEnd - sequenceLength + 1;
      const candidateSequence = this.frames.slice(candidateStart, candidateEnd + 1);
      if (currentStartTime - candidateSequence[candidateSequence.length - 1].timeSeconds < this.minEchoGapSeconds) {
        continue;
      }

      const similarity = this.compareSequences(currentSequence, candidateSequence);
      if (similarity.score > bestSimilarity.score) {
        bestIndex = candidateEnd;
        bestSimilarity = similarity;
      }
    }

    // A musical return is a trajectory, not a chord. Require several seconds
    // of agreement in both harmonic movement and timbral envelope before the
    // sculpture reconnects non-adjacent moments.
    const accepted = bestIndex >= 0
      && bestSimilarity.score >= this.echoThreshold
      && bestSimilarity.harmonic >= 0.79
      && bestSimilarity.timbral >= 0.7;
    return accepted ? { index: bestIndex, similarity: bestSimilarity } : null;
  }

  private compareSequences(
    current: readonly FeatureFrame[],
    previous: readonly FeatureFrame[]
  ): SimilarityResult {
    const count = Math.min(current.length, previous.length);
    if (count === 0) {
      return { score: 0, harmonic: 0, timbral: 0, transposition: 0 };
    }

    const currentChroma = new Array<number>(12).fill(0);
    const previousChroma = new Array<number>(12).fill(0);
    for (let frameIndex = 0; frameIndex < count; frameIndex += 1) {
      for (let pitchClass = 0; pitchClass < 12; pitchClass += 1) {
        currentChroma[pitchClass] += current[frameIndex].chroma[pitchClass];
        previousChroma[pitchClass] += previous[frameIndex].chroma[pitchClass];
      }
    }
    const chromaAlignment = compareChromaCircular(currentChroma, previousChroma);
    // The public interval reads from the earlier phrase to its return. Texture
    // alignment needs the inverse rotation because each current pitch class
    // looks up the source bin in the previous phrase.
    const shift = ((12 - chromaAlignment.transposition) % 12 + 12) % 12;

    let harmonic = 0;
    let timbral = 0;
    let centroidTrajectory = 0;
    let energyTrajectory = 0;
    let noveltyTrajectory = 0;
    let motionAgreement = 0;

    for (let frameIndex = 0; frameIndex < count; frameIndex += 1) {
      const currentFrame = current[frameIndex];
      const previousFrame = previous[frameIndex];
      const rotatedPrevious = new Array<number>(12);
      for (let pitchClass = 0; pitchClass < 12; pitchClass += 1) {
        rotatedPrevious[pitchClass] = previousFrame.chroma[(pitchClass + shift) % 12];
      }

      harmonic += cosineSimilarity(currentFrame.chroma, rotatedPrevious);
      timbral += cosineSimilarity(currentFrame.timbre, previousFrame.timbre);
      centroidTrajectory += 1 - clamp(Math.abs(currentFrame.centroid - previousFrame.centroid) * 2.4);
      energyTrajectory += 1 - clamp(
        Math.abs(Math.log(currentFrame.energy + 0.03) - Math.log(previousFrame.energy + 0.03)) / 2.1
      );
      noveltyTrajectory += 1 - clamp(Math.abs(currentFrame.novelty - previousFrame.novelty) * 1.45);

      if (frameIndex > 0) {
        const currentPrevious = current[frameIndex - 1];
        const previousPrevious = previous[frameIndex - 1];
        const currentMotion = Math.abs(currentFrame.centroid - currentPrevious.centroid)
          + Math.abs(currentFrame.energy - currentPrevious.energy)
          + currentFrame.novelty * 0.35;
        const previousMotion = Math.abs(previousFrame.centroid - previousPrevious.centroid)
          + Math.abs(previousFrame.energy - previousPrevious.energy)
          + previousFrame.novelty * 0.35;
        motionAgreement += 1 - clamp(Math.abs(currentMotion - previousMotion) * 2.1);
      }
    }

    harmonic /= count;
    timbral /= count;
    centroidTrajectory /= count;
    energyTrajectory /= count;
    noveltyTrajectory /= count;
    motionAgreement /= Math.max(1, count - 1);

    const score = clamp(
      harmonic * 0.43
      + timbral * 0.23
      + centroidTrajectory * 0.11
      + energyTrajectory * 0.1
      + noveltyTrajectory * 0.06
      + motionAgreement * 0.07
    );

    return {
      score,
      harmonic,
      timbral,
      transposition: chromaAlignment.transposition,
    };
  }

  private positionFor(
    feature: ExtractedFeature,
    timeSeconds: number,
    durationSeconds: number,
    novelty: number
  ): [number, number, number] {
    const knownDuration = durationSeconds > 0;
    const progress = knownDuration
      ? clamp(timeSeconds / durationSeconds)
      : clamp(1 - Math.exp(-timeSeconds / 180));
    const turns = knownDuration
      ? clamp(4.5 + durationSeconds / 70, 4.5, 10.5)
      : 0;
    const angle = knownDuration
      ? progress * turns * TAU + feature.pitchClass / 12 * 0.72
      : timeSeconds * 0.155 + feature.pitchClass / 12 * 0.72;

    const radius = 3.72 + progress * 2.72 + novelty * 0.48;
    const bassWeight = feature.timbre[0] * 0.7 + feature.timbre[1] * 0.3;
    const airWeight = feature.timbre[4] * 0.35 + feature.timbre[5] * 0.65;
    const harmonicRipple = Math.sin(angle * 3 + feature.pitchClass * 0.47) * (0.1 + novelty * 0.15);
    const x = Math.cos(angle) * (radius + harmonicRipple)
      + Math.cos(angle * 2.3) * (airWeight - bassWeight) * 0.28;
    const z = Math.sin(angle) * (radius + harmonicRipple)
      + Math.sin(angle * 1.7) * (feature.timbre[2] - feature.timbre[3]) * 0.32;
    const y = (feature.centroid - 0.48) * 3.55
      + (airWeight - bassWeight) * 0.55
      + Math.sin(angle * 0.48) * 0.34
      + novelty * 0.36;

    return [x, y, z];
  }

  private reflow(durationSeconds: number): void {
    if (this.frames.length === 0 || durationSeconds <= 0) return;
    for (const frame of this.frames) {
      const feature: ExtractedFeature = {
        silent: false,
        energy: frame.energy,
        centroid: frame.centroid,
        pitchClass: frame.pitchClass,
        chroma: frame.chroma,
        timbre: frame.timbre,
      };
      frame.progress = clamp(frame.timeSeconds / durationSeconds);
      frame.position = this.positionFor(feature, frame.timeSeconds, durationSeconds, frame.novelty);
    }
  }

  private compact(): void {
    const retained: FeatureFrame[] = [];
    for (let index = 0; index < this.frames.length; index += 2) {
      retained.push({ ...this.frames[index], id: retained.length });
    }
    const indexMap = new Map<number, number>();
    for (let oldIndex = 0; oldIndex < this.frames.length; oldIndex += 2) {
      indexMap.set(oldIndex, Math.floor(oldIndex / 2));
    }
    this.threads = this.threads
      .filter(thread => indexMap.has(thread.from) && indexMap.has(thread.to))
      .map((thread, index) => ({
        ...thread,
        id: index,
        from: indexMap.get(thread.from)!,
        to: indexMap.get(thread.to)!,
      }));
    this.frames = retained;
  }
}

export class MemoryRelicStore {
  private readonly key: string;
  private readonly limit: number;

  constructor(key = 'soundform.anamnesis.relics.v1', limit = 12) {
    this.key = key;
    this.limit = Math.round(clamp(limit, 1, 40));
  }

  public list(): MemoryRelic[] {
    if (typeof localStorage === 'undefined') return [];
    try {
      const parsed = JSON.parse(localStorage.getItem(this.key) || '[]') as unknown[];
      return parsed.filter(AnamnesisModel.isRelic).slice(0, this.limit);
    } catch {
      return [];
    }
  }

  public save(relic: MemoryRelic): MemoryRelic[] {
    if (typeof localStorage === 'undefined') return [];
    const retained = this.list().filter(item => item.id !== relic.id);
    const next = [relic, ...retained].slice(0, this.limit);
    try {
      localStorage.setItem(this.key, JSON.stringify(next));
    } catch {
      // Storage is a convenience; the live sculpture remains available.
    }
    return next;
  }

  public remove(id: string): MemoryRelic[] {
    if (typeof localStorage === 'undefined') return [];
    const next = this.list().filter(item => item.id !== id);
    try {
      localStorage.setItem(this.key, JSON.stringify(next));
    } catch {
      // Optional persistence.
    }
    return next;
  }

  public clear(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.removeItem(this.key);
    } catch {
      // Optional persistence.
    }
  }
}
