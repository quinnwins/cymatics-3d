import { AudioEngine } from '../audio/AudioEngine';
import { VisualizerEngine } from '../visualizer/VisualizerEngine';
import { WavePhysics } from '../math/WavePhysics';

export class SpectrumHUD {
  private element: HTMLElement;
  private animFrameId: number | null = null;
  private isCollapsed = false;

  // Cached DOM elements
  private noteEl: HTMLElement | null = null;
  private hzEl: HTMLElement | null = null;
  private fpsEl: HTMLElement | null = null;
  private waveEl: HTMLElement | null = null;
  private meterEls: HTMLElement[] = [];

  constructor(private audioEngine: AudioEngine, private visualizer: VisualizerEngine) {
    this.element = document.createElement('div');
    this.element.className = 'glass-panel p-3 sm:p-3.5 rounded-2xl flex flex-col gap-2.5 shadow-xl w-full select-none border border-white/10 backdrop-blur-xl transition-all duration-300';
    this.render();
    this.cacheElements();
    this.startUpdateLoop();
    this.preventEventBleeding();
  }

  public getElement(): HTMLElement {
    return this.element;
  }

  public setCollapsed(collapsed: boolean): void {
    if (this.isCollapsed === collapsed) return;
    this.isCollapsed = collapsed;
    this.render();
    this.cacheElements();
  }

  public getIsCollapsed(): boolean {
    return this.isCollapsed;
  }

  private preventEventBleeding(): void {
    this.element.addEventListener('wheel', e => e.stopPropagation(), { passive: false });
  }

  private render(): void {
    if (this.isCollapsed) {
      this.element.innerHTML = `
        <!-- Compact Streamlined Header -->
        <button id="btn-toggle-spectrum-hud" class="w-full flex items-center justify-between cursor-pointer group text-left py-0.5">
          <div class="flex items-center gap-2">
            <div class="w-2 h-2 rounded-full bg-cyan-400"></div>
            <span class="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">Spectrum Telemetry</span>
          </div>
          <div class="flex items-center gap-2">
            <div class="flex items-baseline gap-1 font-mono text-xs">
              <span id="hud-note" class="font-bold text-cyan-400 tabular-nums">---</span>
              <span id="hud-hz" class="text-slate-400 text-[10px] tabular-nums">0 Hz</span>
            </div>
            <span class="text-xs text-slate-400 group-hover:text-white font-mono">▼</span>
          </div>
        </button>
      `;
    } else {
      this.element.innerHTML = `
        <!-- Top: Live Pitch & Note Header with Accordion Toggle -->
        <button id="btn-toggle-spectrum-hud" class="w-full flex items-center justify-between border-b border-white/10 pb-2 cursor-pointer group text-left">
          <div class="flex items-center gap-2">
            <div class="w-2 h-2 rounded-full bg-cyan-400 shadow-sm shadow-cyan-400/50"></div>
            <span class="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">Audio Spectrum</span>
          </div>
          <div class="flex items-center gap-2">
            <div class="flex items-baseline gap-1.5 font-mono text-xs">
              <span id="hud-note" class="font-bold text-cyan-400 tabular-nums min-w-[24px] text-right">---</span>
              <span id="hud-hz" class="text-slate-400 text-[11px] tabular-nums min-w-[45px] text-right">0 Hz</span>
            </div>
            <span class="text-xs text-slate-400 group-hover:text-white font-mono">▲</span>
          </div>
        </button>

        <!-- 6-Band Perceptual Equalizer Wells -->
        <div class="grid grid-cols-6 gap-2 items-end h-16 px-2 py-1.5 bg-slate-900/60 rounded-2xl border border-white/5 shadow-inner">
          ${[
            { id: 'meter-sub', label: 'Sub' },
            { id: 'meter-bass', label: 'Bass' },
            { id: 'meter-lmid', label: 'L-Mid' },
            { id: 'meter-mid', label: 'Mid' },
            { id: 'meter-hmid', label: 'H-Mid' },
            { id: 'meter-high', label: 'High' },
          ]
            .map(
              m => `
            <div class="flex flex-col items-center gap-1 h-full justify-end min-h-0">
              <div class="w-full bg-slate-800 rounded-full flex-1 min-h-0 relative overflow-hidden flex flex-col justify-end p-0.5">
                <div id="${m.id}" class="eq-meter-bar w-full h-full bg-cyan-400 rounded-full"></div>
              </div>
              <span class="text-[9px] text-slate-400 font-mono tracking-tight shrink-0">${m.label}</span>
            </div>
          `
            )
            .join('')}
        </div>

        <!-- Footer: Telemetry & Wavelength -->
        <div class="flex items-center justify-between text-[10px] text-slate-400 border-t border-white/10 pt-2 font-mono">
          <div class="flex items-center gap-1.5">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"></span>
            <span id="hud-fps" class="tabular-nums">60 FPS</span>
          </div>
          <div id="hud-wavelength" class="text-right truncate max-w-[130px] tabular-nums text-slate-300">
            λ: ---
          </div>
        </div>
      `;
    }

    this.attachEvents();
  }

  private attachEvents(): void {
    this.element.querySelector('#btn-toggle-spectrum-hud')?.addEventListener('click', () => {
      this.isCollapsed = !this.isCollapsed;
      this.render();
      this.cacheElements();
    });
  }

  private cacheElements(): void {
    this.noteEl = this.element.querySelector('#hud-note');
    this.hzEl = this.element.querySelector('#hud-hz');
    this.fpsEl = this.element.querySelector('#hud-fps');
    this.waveEl = this.element.querySelector('#hud-wavelength');

    const meterIds = [
      '#meter-sub',
      '#meter-bass',
      '#meter-lmid',
      '#meter-mid',
      '#meter-hmid',
      '#meter-high',
    ];

    this.meterEls = meterIds
      .map(id => this.element.querySelector(id) as HTMLElement)
      .filter(Boolean);
  }

  private startUpdateLoop(): void {
    const update = () => {
      const bands = this.audioEngine.getCurrentBands();
      const fundamentalHz = this.audioEngine.getFundamentalFrequency();
      const noteInfo = WavePhysics.frequencyToNote(fundamentalHz);

      // Update Note & Hz
      if (this.noteEl && this.hzEl) {
        if (fundamentalHz > 15) {
          this.noteEl.textContent = noteInfo.name;
          this.hzEl.textContent = `${Math.round(fundamentalHz)} Hz`;
        } else {
          this.noteEl.textContent = '---';
          this.hzEl.textContent = '0 Hz';
        }
      }

      if (this.fpsEl) {
        this.fpsEl.textContent = `${this.visualizer.fps} FPS`;
      }

      if (this.waveEl) {
        if (fundamentalHz > 15) {
          const lambdaM = 343 / fundamentalHz;
          this.waveEl.textContent = lambdaM >= 1 ? `λ: ${lambdaM.toFixed(2)} m` : `λ: ${(lambdaM * 100).toFixed(1)} cm`;
        } else {
          this.waveEl.textContent = 'λ: ---';
        }
      }

      // Update 6 Band Meters via GPU Composited scaleY (when expanded)
      if (!this.isCollapsed && this.meterEls.length > 0) {
        const bandValues = [
          bands.subBass,
          bands.bass,
          bands.lowMid,
          bands.mid,
          bands.highMid,
          bands.high,
        ];

        for (let i = 0; i < this.meterEls.length; i++) {
          const el = this.meterEls[i];
          if (el) {
            const raw = bandValues[i];
            const scale = Number.isFinite(raw) ? Math.min(1, Math.max(0.04, raw)) : 0.04;
            el.style.transform = `scaleY(${scale})`;
            el.style.transformOrigin = 'bottom';
          }
        }
      }

      this.animFrameId = requestAnimationFrame(update);
    };

    update();
  }

  public destroy(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }
}
