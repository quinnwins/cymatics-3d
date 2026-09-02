import type * as THREE from 'three';

export type TemporalMediumId = 'air' | 'water' | 'tissue' | 'acrylic' | 'glass' | 'steel';

export interface TemporalMedium {
  id: TemporalMediumId;
  name: string;
  speedMs: number;
}

export interface TemporalMemorySettings {
  enabled: boolean;
  frozen: boolean;
  memorySeconds: number;
  lookbackSeconds: number;
  propagation: number;
  gain: number;
  warp: number;
  colorByAge: boolean;
  medium: TemporalMediumId;
}

export interface TemporalMemoryUniformState {
  texture: THREE.DataTexture | null;
  historyHead: number;
  historyRows: number;
  historyRate: number;
  memoryFrames: number;
  availableFrames: number;
  enabled: number;
  gain: number;
  warp: number;
  colorByAge: number;
  signal: number;
  mediumSpeed: number;
}

export const TEMPORAL_MEDIA: Record<TemporalMediumId, TemporalMedium> = {
  air: { id: 'air', name: 'Air', speedMs: 343 },
  water: { id: 'water', name: 'Water', speedMs: 1480 },
  tissue: { id: 'tissue', name: 'Soft tissue', speedMs: 1540 },
  acrylic: { id: 'acrylic', name: 'Acrylic', speedMs: 2730 },
  glass: { id: 'glass', name: 'Glass', speedMs: 5000 },
  steel: { id: 'steel', name: 'Steel', speedMs: 5960 },
};

const DEFAULTS: TemporalMemorySettings = {
  enabled: false,
  frozen: false,
  memorySeconds: 6,
  lookbackSeconds: 0,
  propagation: 1,
  gain: 1.05,
  warp: 1,
  colorByAge: true,
  medium: 'air',
};

export const TEMPORAL_MEMORY_EVENT = 'soundform-temporal-memory-changed';
const STORAGE_KEY = 'soundform.temporal-memory.v3';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function finite(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function wrap01(value: number): number {
  return ((value % 1) + 1) % 1;
}

/** Shared model for SoundForm's center-now / edge-past audio sculpture. */
export class TemporalMemoryController {
  private settings: TemporalMemorySettings = { ...DEFAULTS };
  private texture: THREE.DataTexture | null = null;
  private historyRows = 512;
  private historyHead = 0;
  private availableFrames = 0;
  private framesPerSecond = 48;
  private lastFrameAt = 0;
  private signal = 0;
  private controlsRequested = false;

  constructor() {
    this.restore();
  }

  public registerTexture(texture: THREE.DataTexture, rows: number): void {
    this.texture = texture;
    this.historyRows = Math.max(2, Math.round(rows));
    // A newly registered texture is empty. Reset the temporal envelope so
    // stale state from a replaced renderer cannot illuminate silent history.
    this.resetHistoryState();
    this.requestControls();
    this.emit();
  }

  public recordFrame(row: number, peakSignal: number, nowMs = performance.now()): void {
    this.historyHead = (Math.max(0, row) + 0.5) / this.historyRows;
    this.availableFrames = Math.min(this.historyRows - 2, this.availableFrames + 1);
    this.signal += (clamp(peakSignal, 0, 1.5) - this.signal) * 0.32;

    if (this.lastFrameAt > 0) {
      const measured = clamp(1000 / Math.max(1, nowMs - this.lastFrameAt), 8, 120);
      this.framesPerSecond += (measured - this.framesPerSecond) * 0.08;
    }
    this.lastFrameAt = nowMs;
  }

  public recordIdle(): void {
    this.signal *= 0.96;
  }

  public resetHistoryState(): void {
    this.historyHead = 0;
    this.availableFrames = 0;
    this.framesPerSecond = 48;
    this.lastFrameAt = 0;
    this.signal = 0;
  }

  public shouldCapture(): boolean {
    return !this.settings.frozen;
  }

  public getSettings(): Readonly<TemporalMemorySettings> {
    return { ...this.settings };
  }

  public getTexture(): THREE.DataTexture | null {
    return this.texture;
  }

  public getUniformState(): TemporalMemoryUniformState {
    const medium = TEMPORAL_MEDIA[this.settings.medium];
    // Preserve real medium ordering while compressing extreme speed ratios for a normalized viewport.
    const mediumInfluence = Math.pow(TEMPORAL_MEDIA.air.speedMs / medium.speedMs, 0.42);
    const requestedFrames =
      this.settings.memorySeconds * this.framesPerSecond * mediumInfluence / this.settings.propagation;
    const lookbackFrames = this.settings.lookbackSeconds * this.framesPerSecond;
    // While a song is starting, stretch the history collected so far across
    // the sculpture instead of leaving most of the volume blank for six seconds.
    const populatedFrames = Math.max(2, this.availableFrames);

    return {
      texture: this.texture,
      historyHead: wrap01(this.historyHead - lookbackFrames / this.historyRows),
      historyRows: this.historyRows,
      historyRate: this.framesPerSecond,
      memoryFrames: clamp(Math.min(requestedFrames, populatedFrames), 2, this.historyRows - 2),
      availableFrames: this.availableFrames,
      enabled: this.settings.enabled ? 1 : 0,
      gain: this.settings.gain,
      warp: this.settings.warp,
      colorByAge: this.settings.colorByAge ? 1 : 0,
      signal: clamp(this.signal * 1.35, 0, 1),
      mediumSpeed: medium.speedMs,
    };
  }

  public setEnabled(value: boolean): void { this.patch({ enabled: value }); }
  public setFrozen(value: boolean): void {
    const patch: Partial<TemporalMemorySettings> = { frozen: value };
    if (value) {
      patch.enabled = true;
    } else {
      patch.lookbackSeconds = 0;
    }
    this.patch(patch);
  }
  public setColorByAge(value: boolean): void { this.patch({ colorByAge: value }); }
  public toggleEnabled(): void { this.setEnabled(!this.settings.enabled); }
  public toggleFrozen(): void { this.setFrozen(!this.settings.frozen); }

  public setMemorySeconds(value: number): void {
    this.patch({ memorySeconds: clamp(finite(Number(value), DEFAULTS.memorySeconds), 1, 10) });
  }

  public setLookbackSeconds(value: number): void {
    const lookback = clamp(finite(Number(value), DEFAULTS.lookbackSeconds), 0, 10);
    const patch: Partial<TemporalMemorySettings> = { lookbackSeconds: lookback };
    if (lookback > 0.05) {
      patch.enabled = true;
      patch.frozen = true;
    }
    this.patch(patch);
  }

  public setPropagation(value: number): void {
    this.patch({ propagation: clamp(finite(Number(value), DEFAULTS.propagation), 0.35, 2.5) });
  }

  public setGain(value: number): void {
    this.patch({ gain: clamp(finite(Number(value), DEFAULTS.gain), 0.35, 2.2) });
  }

  public setWarp(value: number): void {
    this.patch({ warp: clamp(finite(Number(value), DEFAULTS.warp), 0, 2.5) });
  }

  public setMedium(value: TemporalMediumId): void {
    this.patch({ medium: TEMPORAL_MEDIA[value] ? value : 'air' });
  }

  public reset(): void {
    this.settings = { ...DEFAULTS };
    this.persist();
    this.emit();
  }

  private patch(patch: Partial<TemporalMemorySettings>): void {
    this.settings = { ...this.settings, ...patch };
    this.persist();
    this.emit();
  }

  private requestControls(): void {
    if (this.controlsRequested || typeof window === 'undefined') return;
    this.controlsRequested = true;
    // SonicMemoryControls bottom pill retired in favor of unified "The Song Remembers" (Anamnesis)
  }

  private emit(): void {
    if (typeof window === 'undefined') return;
    this.syncRuntimeUniforms();
    window.dispatchEvent(new CustomEvent(TEMPORAL_MEMORY_EVENT, { detail: this.getSettings() }));
  }

  /**
   * Apply user controls immediately as well as through the render loop.
   * Dynamic control chunks can otherwise update between animation frames in
   * headless, backgrounded, or reduced-refresh contexts.
   */
  private syncRuntimeUniforms(): void {
    if (typeof window === 'undefined') return;
    const runtime = (window as unknown as {
      __soundformApp?: {
        visualizer?: {
          cymaticsMesh?: {
            temporalSculpture?: {
              material?: { uniforms?: Record<string, { value: unknown }> };
            };
          };
        };
      };
    }).__soundformApp;
    const uniforms = runtime?.visualizer?.cymaticsMesh?.temporalSculpture?.material?.uniforms;
    if (!uniforms) return;

    const state = this.getUniformState();
    const assign = (name: string, value: number): void => {
      const uniform = uniforms[name];
      if (uniform) uniform.value = value;
    };
    assign('uHistoryHead', state.historyHead);
    assign('uHistoryRows', state.historyRows);
    assign('uMemoryFrames', state.memoryFrames);
    assign('uEnabled', state.enabled);
    assign('uGain', state.gain);
    assign('uWarp', state.warp);
    assign('uColorByAge', state.colorByAge);
  }

  private restore(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const saved = JSON.parse(
        localStorage.getItem(STORAGE_KEY)
          || localStorage.getItem('soundform.temporal-memory.v1')
          || '{}'
      ) as Partial<TemporalMemorySettings>;
      this.settings = {
        enabled: typeof saved.enabled === 'boolean' ? saved.enabled : DEFAULTS.enabled,
        frozen: false,
        memorySeconds: clamp(finite(Number(saved.memorySeconds), DEFAULTS.memorySeconds), 1, 10),
        lookbackSeconds: clamp(finite(Number(saved.lookbackSeconds), DEFAULTS.lookbackSeconds), 0, 10),
        propagation: clamp(finite(Number(saved.propagation), DEFAULTS.propagation), 0.35, 2.5),
        gain: clamp(finite(Number(saved.gain), DEFAULTS.gain), 0.35, 2.2),
        warp: clamp(finite(Number(saved.warp), DEFAULTS.warp), 0, 2.5),
        colorByAge: typeof saved.colorByAge === 'boolean' ? saved.colorByAge : DEFAULTS.colorByAge,
        medium: saved.medium && TEMPORAL_MEDIA[saved.medium] ? saved.medium : DEFAULTS.medium,
      };
    } catch {
      this.settings = { ...DEFAULTS };
    }
  }

  private persist(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...this.settings, frozen: false }));
    } catch {
      // Persistence is optional.
    }
  }
}

export const temporalMemory = new TemporalMemoryController();
