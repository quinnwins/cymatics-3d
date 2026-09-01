import { AudioEngine } from '../audio/AudioEngine';
import { VisualizerEngine } from '../visualizer/VisualizerEngine';
import { WavePhysics } from '../math/WavePhysics';

export class SpectrumHUD {
  private element: HTMLElement;
  private animFrameId: number | null = null;

  constructor(private audioEngine: AudioEngine, private visualizer: VisualizerEngine) {
    this.element = document.createElement('div');
    this.element.className = 'glass-panel p-3.5 rounded-2xl flex flex-col gap-2.5 shadow-xl w-64 md:w-72 border-white/10';
    this.render();
    this.startUpdateLoop();
  }

  public getElement(): HTMLElement {
    return this.element;
  }

  private render(): void {
    this.element.innerHTML = `
      <!-- Top: Live Pitch & Note Header -->
      <div class="flex items-center justify-between border-b border-white/10 pb-2">
        <div class="flex items-center gap-2">
          <div class="w-2.5 h-2.5 rounded-full bg-accent-cyan animate-pulse"></div>
          <span class="text-xs font-semibold text-gray-300 uppercase tracking-wider">Acoustic Spectrum</span>
        </div>
        <div class="flex items-center gap-1.5 font-mono text-xs">
          <span id="hud-note" class="font-bold text-accent-cyan">---</span>
          <span id="hud-hz" class="text-gray-400">0 Hz</span>
        </div>
      </div>

      <!-- 6-Band Perceptual Equalizer Meters -->
      <div class="flex flex-col gap-1.5 py-1">
        <div class="grid grid-cols-6 gap-1.5 items-end h-16 px-1 bg-black/20 rounded-xl p-1.5 border border-white/5">
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
            <div class="flex flex-col items-center gap-1 h-full justify-end">
              <div class="w-full bg-white/10 rounded-full h-full relative overflow-hidden flex flex-col justify-end">
                <div id="${m.id}" class="w-full bg-gradient-to-t from-accent-cyan to-accent-magenta rounded-full transition-all duration-75" style="height: 0%"></div>
              </div>
              <span class="text-[9px] text-gray-400 font-mono">${m.label}</span>
            </div>
          `
            )
            .join('')}
        </div>
      </div>

      <!-- Footer: Telemetry & Wavelength -->
      <div class="flex items-center justify-between text-[11px] text-gray-400 border-t border-white/10 pt-2 font-mono">
        <div class="flex items-center gap-1.5">
          <span class="text-accent-emerald">●</span>
          <span id="hud-fps">60 FPS</span>
        </div>
        <div id="hud-wavelength" class="text-right truncate max-w-[130px]">
          λ: 0.79 m
        </div>
      </div>
    `;
  }

  private startUpdateLoop(): void {
    const update = () => {
      const bands = this.audioEngine.getCurrentBands();
      const fundamentalHz = this.audioEngine.getFundamentalFrequency();
      const noteInfo = WavePhysics.frequencyToNote(fundamentalHz);

      // Update Note & Hz
      const noteEl = this.element.querySelector('#hud-note');
      const hzEl = this.element.querySelector('#hud-hz');
      const fpsEl = this.element.querySelector('#hud-fps');
      const waveEl = this.element.querySelector('#hud-wavelength');

      if (noteEl && hzEl) {
        if (fundamentalHz > 15) {
          noteEl.textContent = noteInfo.name;
          hzEl.textContent = `${Math.round(fundamentalHz)} Hz`;
        } else {
          noteEl.textContent = '---';
          hzEl.textContent = '0 Hz';
        }
      }

      if (fpsEl) {
        fpsEl.textContent = `${this.visualizer.fps} FPS`;
      }

      if (waveEl) {
        if (fundamentalHz > 15) {
          const lambdaM = 343 / fundamentalHz;
          waveEl.textContent = lambdaM > 1 ? `λ: ${lambdaM.toFixed(2)}m` : `λ: ${(lambdaM * 100).toFixed(1)}cm`;
        } else {
          waveEl.textContent = 'λ: ---';
        }
      }

      // Update 6 Band Meters
      const bandMapping: [string, number][] = [
        ['#meter-sub', bands.subBass],
        ['#meter-bass', bands.bass],
        ['#meter-lmid', bands.lowMid],
        ['#meter-mid', bands.mid],
        ['#meter-hmid', bands.highMid],
        ['#meter-high', bands.high],
      ];

      bandMapping.forEach(([sel, val]) => {
        const el = this.element.querySelector(sel) as HTMLElement;
        if (el) {
          const heightPct = Math.min(100, Math.round(val * 90));
          el.style.height = `${heightPct}%`;
        }
      });

      this.animFrameId = requestAnimationFrame(update);
    };

    update();
  }

  public destroy(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
    }
  }
}
