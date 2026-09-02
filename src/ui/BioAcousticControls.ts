/**
 * BioAcousticControls.ts
 * SoundForm 3D — Interactive Bio-Acoustic Resonator & Cellular Spectroscopy Control Panel
 */

import { AudioEngine } from '../audio/AudioEngine';
import { VisualizerEngine } from '../visualizer/VisualizerEngine';
import { BioAcousticPhysics, BioSpecimenProfile } from '../math/BioAcousticPhysics';
import { BioViewMode } from '../visualizer/BioAcousticResonator';
import { EngineMode } from './Header';

export class BioAcousticControls {
  public container: HTMLElement;
  private audioEngine: AudioEngine;
  private visualizer: VisualizerEngine;
  private onSwitchMode?: (mode: EngineMode) => void;

  private activeSpecimenId = 'healthy-somatic';
  private currentFrequency = 220.0;
  private currentPower = 1.0;
  private currentViewMode: BioViewMode = 'cell-inspector';
  private isSpecsOpen = false;

  private freqValueDisplay!: HTMLElement;
  private freqSlider!: HTMLInputElement;
  private powerValueDisplay!: HTMLElement;
  private powerSlider!: HTMLInputElement;

  constructor(
    audioEngine: AudioEngine,
    visualizer: VisualizerEngine,
    onSwitchMode?: (mode: EngineMode) => void
  ) {
    this.audioEngine = audioEngine;
    this.visualizer = visualizer;
    this.onSwitchMode = onSwitchMode;

    this.container = document.createElement('div');
    this.container.id = 'bio-acoustic-controls';
    this.container.className =
      'glass-panel p-3.5 sm:p-4 rounded-3xl flex flex-col gap-3 shadow-2xl border-white/10 backdrop-blur-2xl text-white select-none w-full transition-all duration-300';

    this.preventEventBleeding();
    this.render();
  }

  public getElement(): HTMLElement {
    return this.container;
  }

  private preventEventBleeding(): void {
    this.container.addEventListener('wheel', e => e.stopPropagation(), { passive: false });
  }

  private render(): void {
    const profile = BioAcousticPhysics.SPECIMENS[this.activeSpecimenId];
    const freqPct = Math.min(100, Math.max(0, Math.round(((this.currentFrequency - 40) / 1160) * 100)));
    const powerPct = Math.min(100, Math.max(0, Math.round(((this.currentPower - 0.1) / 2.9) * 100)));

    this.container.innerHTML = `
      <!-- Top Title & Quick Actions -->
      <div class="flex flex-col gap-2.5 border-b border-white/10 pb-2.5">
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-2 min-w-0">
            <div class="w-8 h-8 rounded-xl bg-slate-900 border border-white/15 flex items-center justify-center text-emerald-400 text-xs font-mono font-bold shrink-0 shadow-sm">
              BIO
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-1.5 flex-wrap">
                <h3 class="text-xs sm:text-sm font-bold text-white whitespace-nowrap">
                  Bio-Acoustics Lab
                </h3>
                <span class="px-1.5 py-0.5 rounded-full text-[9px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 whitespace-nowrap">
                  ${profile.badge}
                </span>
              </div>
              <p class="text-[10px] text-slate-400 font-medium truncate">
                Cellular mechanics & microfluidic sorting
              </p>
            </div>
          </div>

          <!-- Lysis Action Button -->
          <button id="bio-blast-lysis-btn" class="px-2.5 py-1.5 rounded-xl font-bold text-xs bg-rose-500 text-slate-950 hover:bg-rose-400 shadow-md shadow-rose-500/30 active:scale-95 transition-all flex items-center gap-1 cursor-pointer shrink-0">
            <span>Rupture Cell</span>
          </button>
        </div>

        <!-- View Switcher -->
        <div class="segmented-track p-1 text-xs">
          <button id="bio-view-cell" class="segmented-pill flex-1 flex items-center justify-center ${
            this.currentViewMode === 'cell-inspector' ? 'is-active glass-btn-active font-bold' : ''
          }">
            Single Cell
          </button>
          <button id="bio-view-sorter" class="segmented-pill flex-1 flex items-center justify-center ${
            this.currentViewMode === 'microfluidic-sorter' ? 'is-active glass-btn-active font-bold' : ''
          }">
            Cell Sorter
          </button>
        </div>
      </div>

      <!-- Specimen Selector List/Grid -->
      <div class="flex flex-col gap-1.5">
        <span class="text-[10px] font-semibold text-slate-300">Specimen Models:</span>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          ${Object.values(BioAcousticPhysics.SPECIMENS)
            .map(
              spec => `
            <button 
              data-specimen-id="${spec.id}" 
              class="bio-specimen-btn text-left p-2 rounded-xl border transition-all flex flex-col gap-0.5 cursor-pointer ${
                this.activeSpecimenId === spec.id
                  ? 'glass-panel-accent border-emerald-500/80 shadow-sm ring-1 ring-emerald-500/50'
                  : 'bg-slate-950/60 border-white/5 hover:bg-slate-900'
              }"
            >
              <div class="flex items-center justify-between text-xs">
                <span class="font-bold text-slate-200 truncate">${spec.name}</span>
              </div>
              <div class="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                <span>E: ${spec.youngsModulusKPa >= 1000 ? (spec.youngsModulusKPa / 1000).toFixed(1) + 'M' : spec.youngsModulusKPa.toFixed(0) + 'k'}</span>
                <span class="${spec.acousticContrastPhi >= 0 ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}">
                  Φ: ${spec.acousticContrastPhi > 0 ? '+' : ''}${spec.acousticContrastPhi.toFixed(2)}
                </span>
              </div>
            </button>
          `
            )
            .join('')}
        </div>
      </div>

      <!-- Sliders Section -->
      <div class="flex flex-col gap-2.5 bg-slate-950/70 rounded-2xl p-3 border border-white/5 shadow-inner">
        <!-- Frequency Sweeper -->
        <div class="flex flex-col gap-1">
          <div class="flex items-center justify-between text-xs font-mono">
            <span class="font-medium text-slate-300 flex items-center gap-1.5">
              <span>Acoustic Frequency</span>
              <button id="bio-autotune-btn" class="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 text-[9px] font-mono border border-emerald-500/30 transition-all cursor-pointer font-bold">
                Pitch (${profile.audibleDownmixHz} Hz)
              </button>
            </span>
            <span id="bio-freq-val" class="text-cyan-400 font-bold tabular-nums">${this.currentFrequency.toFixed(1)} Hz</span>
          </div>
          <input 
            id="bio-freq-slider" 
            type="range" 
            min="40" 
            max="1200" 
            step="1" 
            value="${this.currentFrequency}"
            aria-label="Acoustic excitation frequency slider"
            style="background: linear-gradient(to right, #38bdf8 ${freqPct}%, rgba(255, 255, 255, 0.1) ${freqPct}%);"
            class="w-full h-1.5 rounded cursor-pointer"
          />
          <div class="flex justify-between text-[9px] text-slate-400 font-mono">
            <span>40 Hz</span>
            <span>440 Hz</span>
            <span>1,200 Hz</span>
          </div>
        </div>

        <!-- Acoustic Excitation Intensity -->
        <div class="flex flex-col gap-1">
          <div class="flex items-center justify-between text-xs font-mono">
            <span class="font-medium text-slate-300">Acoustic Power</span>
            <span id="bio-power-val" class="text-emerald-400 font-bold tabular-nums">${this.currentPower.toFixed(2)}x</span>
          </div>
          <input 
            id="bio-power-slider" 
            type="range" 
            min="0.1" 
            max="3.0" 
            step="0.05" 
            value="${this.currentPower}"
            aria-label="Acoustic radiation force power slider"
            style="background: linear-gradient(to right, #38bdf8 ${powerPct}%, rgba(255, 255, 255, 0.1) ${powerPct}%);"
            class="w-full h-1.5 rounded cursor-pointer"
          />
          <div class="flex justify-between text-[9px] text-slate-400 font-mono">
            <span>0.1x (Gentle)</span>
            <span>1.0x (Normal)</span>
            <span>3.0x (High Strain)</span>
          </div>
        </div>
      </div>

      <!-- Collapsible Biophysics Specs HUD -->
      <div class="flex flex-col gap-1.5">
        <button id="bio-toggle-specs-btn" class="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 font-medium transition-colors cursor-pointer w-fit">
          <span class="text-[10px] font-mono">${this.isSpecsOpen ? '▲' : '▼'}</span>
          <span>Cell Mechanics & Acoustic Specs</span>
        </button>

        <div id="bio-specs-drawer" class="${this.isSpecsOpen ? 'grid' : 'hidden'} grid-cols-2 gap-2 p-2.5 rounded-2xl bg-slate-950/80 border border-white/10 text-xs font-mono shadow-inner">
          <div class="flex flex-col gap-0.5">
            <span class="text-[9px] text-slate-400 font-semibold">STIFFNESS (MODULUS)</span>
            <span class="text-slate-200 font-bold tabular-nums">${profile.youngsModulusKPa} kPa</span>
          </div>
          <div class="flex flex-col gap-0.5">
            <span class="text-[9px] text-slate-400 font-semibold">SURFACE TENSION</span>
            <span class="text-slate-200 font-bold tabular-nums">${profile.corticalTensionMNm} mN/m</span>
          </div>
          <div class="flex flex-col gap-0.5">
            <span class="text-[9px] text-slate-400 font-semibold">TRAPPING CONTRAST</span>
            <span class="${profile.acousticContrastPhi >= 0 ? 'text-emerald-400' : 'text-rose-400'} font-bold tabular-nums">
              ${profile.acousticContrastPhi > 0 ? '+' : ''}${profile.acousticContrastPhi}
            </span>
          </div>
          <div class="flex flex-col gap-0.5">
            <span class="text-[9px] text-slate-400 font-semibold">ACOUSTIC IMPEDANCE</span>
            <span class="text-slate-200 font-bold tabular-nums">${profile.acousticImpedanceMRayl} MRayl</span>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  private bindEvents(): void {
    // 1. Specimen Buttons
    const specimenBtns = this.container.querySelectorAll<HTMLButtonElement>('.bio-specimen-btn');
    specimenBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const specId = btn.getAttribute('data-specimen-id');
        if (specId) {
          this.activeSpecimenId = specId;
          const p = BioAcousticPhysics.SPECIMENS[specId];
          this.currentFrequency = p.audibleDownmixHz;

          this.visualizer.bioAcousticResonator.setSpecimen(specId);
          this.audioEngine.startFrequencyTone(this.currentFrequency);
          this.render();
        }
      });
    });

    // 2. View Switcher
    const viewCellBtn = this.container.querySelector<HTMLButtonElement>('#bio-view-cell');
    const viewSorterBtn = this.container.querySelector<HTMLButtonElement>('#bio-view-sorter');

    viewCellBtn?.addEventListener('click', () => {
      this.currentViewMode = 'cell-inspector';
      this.visualizer.bioAcousticResonator.setViewMode('cell-inspector');
      this.render();
    });

    viewSorterBtn?.addEventListener('click', () => {
      this.currentViewMode = 'microfluidic-sorter';
      this.visualizer.bioAcousticResonator.setViewMode('microfluidic-sorter');
      this.render();
    });

    // 3. Blast Lysis Trigger
    const blastBtn = this.container.querySelector<HTMLButtonElement>('#bio-blast-lysis-btn');
    blastBtn?.addEventListener('click', () => {
      this.visualizer.bioAcousticResonator.triggerHistotripsyLysis();
      this.audioEngine.startFrequencyTone(55.0); // Sub-bass cavitation boom
      setTimeout(() => {
        this.audioEngine.startFrequencyTone(this.currentFrequency);
      }, 800);
    });

    // 4. Frequency Slider & Auto-Tune
    this.freqSlider = this.container.querySelector<HTMLInputElement>('#bio-freq-slider')!;
    this.freqValueDisplay = this.container.querySelector<HTMLElement>('#bio-freq-val')!;

    this.freqSlider?.addEventListener('input', e => {
      const val = parseFloat((e.target as HTMLInputElement).value);
      this.currentFrequency = val;
      if (this.freqValueDisplay) this.freqValueDisplay.textContent = `${val.toFixed(1)} Hz`;
      const pct = Math.min(100, Math.max(0, Math.round(((val - 40) / 1160) * 100)));
      this.freqSlider.style.background = `linear-gradient(to right, #38bdf8 ${pct}%, rgba(255, 255, 255, 0.1) ${pct}%)`;
      this.visualizer.bioAcousticResonator.setAcousticFrequency(val);
      this.audioEngine.startFrequencyTone(val);
    });

    const autotuneBtn = this.container.querySelector<HTMLButtonElement>('#bio-autotune-btn');
    autotuneBtn?.addEventListener('click', () => {
      const p = BioAcousticPhysics.SPECIMENS[this.activeSpecimenId];
      this.currentFrequency = p.audibleDownmixHz;
      if (this.freqSlider) this.freqSlider.value = this.currentFrequency.toString();
      if (this.freqValueDisplay) this.freqValueDisplay.textContent = `${this.currentFrequency.toFixed(1)} Hz`;
      this.visualizer.bioAcousticResonator.setAcousticFrequency(this.currentFrequency);
      this.audioEngine.startFrequencyTone(this.currentFrequency);
    });

    // 5. Power Slider
    this.powerSlider = this.container.querySelector<HTMLInputElement>('#bio-power-slider')!;
    this.powerValueDisplay = this.container.querySelector<HTMLElement>('#bio-power-val')!;

    this.powerSlider?.addEventListener('input', e => {
      const val = parseFloat((e.target as HTMLInputElement).value);
      this.currentPower = val;
      if (this.powerValueDisplay) this.powerValueDisplay.textContent = `${val.toFixed(2)}x`;
      const pct = Math.min(100, Math.max(0, Math.round(((val - 0.1) / 2.9) * 100)));
      this.powerSlider.style.background = `linear-gradient(to right, #38bdf8 ${pct}%, rgba(255, 255, 255, 0.1) ${pct}%)`;
      this.visualizer.bioAcousticResonator.setAcousticIntensity(val);
    });

    // 6. Specs Drawer Toggle
    const toggleSpecsBtn = this.container.querySelector<HTMLButtonElement>('#bio-toggle-specs-btn');
    toggleSpecsBtn?.addEventListener('click', () => {
      this.isSpecsOpen = !this.isSpecsOpen;
      this.render();
    });
  }

  public getActiveSpecimenId(): string {
    return this.activeSpecimenId;
  }
}
