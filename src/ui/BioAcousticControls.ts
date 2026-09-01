/**
 * BioAcousticControls.ts
 * SoundForm 3D - Interactive Bio-Acoustic Resonator & Cellular Spectroscopy Control Panel
 */

import { AudioEngine } from '../audio/AudioEngine';
import { VisualizerEngine } from '../visualizer/VisualizerEngine';
import { BioAcousticPhysics, BioSpecimenProfile } from '../math/BioAcousticPhysics';
import { BioViewMode } from '../visualizer/BioAcousticResonator';

export class BioAcousticControls {
  public container: HTMLElement;
  private audioEngine: AudioEngine;
  private visualizer: VisualizerEngine;

  private activeSpecimenId = 'healthy-somatic';
  private currentFrequency = 220.0;
  private currentPower = 1.0;
  private currentViewMode: BioViewMode = 'cell-inspector';
  private isSpecsOpen = false;

  private freqValueDisplay!: HTMLElement;
  private freqSlider!: HTMLInputElement;
  private powerValueDisplay!: HTMLElement;
  private powerSlider!: HTMLInputElement;
  private specsDrawer!: HTMLElement;

  constructor(audioEngine: AudioEngine, visualizer: VisualizerEngine) {
    this.audioEngine = audioEngine;
    this.visualizer = visualizer;

    this.container = document.createElement('div');
    this.container.id = 'bio-acoustic-controls';
    this.container.className =
      'glass-panel p-3.5 sm:p-4 rounded-3xl flex flex-col gap-3 shadow-2xl border-white/10 backdrop-blur-2xl text-white select-none w-full transition-all duration-300';

    this.preventEventBleeding();
    this.render();
  }

  private preventEventBleeding(): void {
    this.container.addEventListener('wheel', e => e.stopPropagation(), { passive: false });
    this.container.addEventListener('pointerdown', e => e.stopPropagation());
  }

  private render(): void {
    const profile = BioAcousticPhysics.SPECIMENS[this.activeSpecimenId];

    this.container.innerHTML = `
      <!-- Top Title & Quick Actions -->
      <div class="flex flex-col gap-2 border-b border-white/10 pb-2.5">
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500 to-cyan-500 flex items-center justify-center text-base shadow-lg shadow-emerald-500/20 shrink-0">
              🧬
            </div>
            <div>
              <div class="flex items-center gap-1.5">
                <h3 class="text-xs sm:text-sm font-bold text-white">
                  Bio-Acoustics Lab
                </h3>
                <span class="px-1.5 py-0.5 rounded-full text-[9px] font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  ${profile.badge}
                </span>
              </div>
              <p class="text-[10px] text-gray-400 font-medium">
                Cellular Spectroscopy & Gor'kov Trapping
              </p>
            </div>
          </div>

          <!-- Lysis Action Button -->
          <button id="bio-blast-lysis-btn" class="px-2.5 py-1.5 rounded-xl font-bold text-xs bg-gradient-to-r from-rose-500 to-amber-500 text-white shadow-lg shadow-rose-500/25 hover:brightness-110 active:scale-95 transition-all flex items-center gap-1 cursor-pointer shrink-0">
            <span>💥</span>
            <span>Blast Lysis</span>
          </button>
        </div>

        <!-- View Switcher -->
        <div class="glass-panel p-1 rounded-2xl flex items-center gap-1 bg-black/30 border-white/5 text-xs">
          <button id="bio-view-cell" class="flex-1 py-1 px-2 rounded-xl font-semibold transition-all cursor-pointer ${
            this.currentViewMode === 'cell-inspector'
              ? 'glass-btn-active font-bold text-accent-cyan shadow-md'
              : 'text-gray-400 hover:text-white'
          }">
            🔬 Single Cell
          </button>
          <button id="bio-view-sorter" class="flex-1 py-1 px-2 rounded-xl font-semibold transition-all cursor-pointer ${
            this.currentViewMode === 'microfluidic-sorter'
              ? 'glass-btn-active font-bold text-accent-cyan shadow-md'
              : 'text-gray-400 hover:text-white'
          }">
            🧪 Cell Sorter
          </button>
        </div>
      </div>

      <!-- Specimen Selector List/Grid -->
      <div class="flex flex-col gap-1.5">
        <span class="text-[10px] font-semibold text-gray-300">Specimen Models:</span>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          ${Object.values(BioAcousticPhysics.SPECIMENS)
            .map(
              spec => `
            <button 
              data-specimen-id="${spec.id}" 
              class="bio-specimen-btn text-left p-2 rounded-xl border transition-all flex flex-col gap-0.5 cursor-pointer ${
                this.activeSpecimenId === spec.id
                  ? 'glass-panel-accent border-cyan-500/80 shadow-md shadow-cyan-500/20 ring-1 ring-cyan-500/60'
                  : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/20'
              }"
            >
              <div class="flex items-center justify-between text-xs">
                <span class="font-bold text-gray-100 truncate">${spec.name}</span>
              </div>
              <div class="flex items-center justify-between text-[10px] text-gray-400 font-mono">
                <span>E: ${spec.youngsModulusKPa >= 1000 ? (spec.youngsModulusKPa / 1000).toFixed(1) + 'M' : spec.youngsModulusKPa.toFixed(0) + 'k'}</span>
                <span class="${spec.acousticContrastPhi >= 0 ? 'text-cyan-400 font-semibold' : 'text-rose-400 font-semibold'}">
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
      <div class="flex flex-col gap-2.5 bg-black/30 rounded-2xl p-2.5 border border-white/5">
        <!-- Frequency Sweeper -->
        <div class="flex flex-col gap-1">
          <div class="flex items-center justify-between text-xs">
            <span class="font-medium text-gray-300 flex items-center gap-1">
              <span>🔊 Frequency</span>
              <button id="bio-autotune-btn" class="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 text-[9px] font-mono border border-cyan-500/30 transition-all cursor-pointer">
                🎯 Auto-Lock (${profile.audibleDownmixHz} Hz)
              </button>
            </span>
            <span id="bio-freq-val" class="font-mono text-cyan-400 font-semibold">${this.currentFrequency.toFixed(1)} Hz</span>
          </div>
          <input 
            id="bio-freq-slider" 
            type="range" 
            min="40" 
            max="1200" 
            step="1" 
            value="${this.currentFrequency}"
            class="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />
          <div class="flex justify-between text-[9px] text-gray-400 font-mono">
            <span>40 Hz (Sub)</span>
            <span>440 Hz (Concert)</span>
            <span>1200 Hz</span>
          </div>
        </div>

        <!-- Acoustic Excitation Intensity -->
        <div class="flex flex-col gap-1">
          <div class="flex items-center justify-between text-xs">
            <span class="font-medium text-gray-300">⚡ Acoustic Wave Power</span>
            <span id="bio-power-val" class="font-mono text-emerald-400 font-semibold">${this.currentPower.toFixed(2)}x</span>
          </div>
          <input 
            id="bio-power-slider" 
            type="range" 
            min="0.1" 
            max="3.0" 
            step="0.05" 
            value="${this.currentPower}"
            class="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-400"
          />
          <div class="flex justify-between text-[9px] text-gray-400 font-mono">
            <span>0.1x (Gentle)</span>
            <span>1.0x (Harmonic)</span>
            <span>3.0x (Blebbing)</span>
          </div>
        </div>
      </div>

      <!-- Collapsible Biophysics Specs HUD -->
      <div class="flex flex-col gap-1.5">
        <button id="bio-toggle-specs-btn" class="text-xs text-gray-400 hover:text-white flex items-center gap-1.5 font-medium transition-colors cursor-pointer w-fit">
          <span>${this.isSpecsOpen ? '▼' : '▶'}</span>
          <span>⚡ Biophysics Specs & Mechanobiology</span>
        </button>

        <div id="bio-specs-drawer" class="${this.isSpecsOpen ? 'grid' : 'hidden'} grid-cols-2 gap-2 p-2.5 rounded-xl bg-black/40 border border-white/5 text-xs font-mono">
          <div class="flex flex-col gap-0.5">
            <span class="text-[9px] text-gray-500">YOUNG'S MODULUS</span>
            <span class="text-gray-200 font-semibold">${profile.youngsModulusKPa} kPa</span>
          </div>
          <div class="flex flex-col gap-0.5">
            <span class="text-[9px] text-gray-500">CORTICAL TENSION</span>
            <span class="text-gray-200 font-semibold">${profile.corticalTensionMNm} mN/m</span>
          </div>
          <div class="flex flex-col gap-0.5">
            <span class="text-[9px] text-gray-500">GOR'KOV CONTRAST</span>
            <span class="${profile.acousticContrastPhi >= 0 ? 'text-cyan-400' : 'text-rose-400'} font-semibold">
              ${profile.acousticContrastPhi > 0 ? '+' : ''}${profile.acousticContrastPhi}
            </span>
          </div>
          <div class="flex flex-col gap-0.5">
            <span class="text-[9px] text-gray-500">IMPEDANCE (Z)</span>
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
      this.freqValueDisplay.textContent = `${val.toFixed(1)} Hz`;
      this.visualizer.bioAcousticResonator.setAcousticFrequency(val);
      this.audioEngine.startFrequencyTone(val);
    });

    const autotuneBtn = this.container.querySelector<HTMLButtonElement>('#bio-autotune-btn');
    autotuneBtn?.addEventListener('click', () => {
      const p = BioAcousticPhysics.SPECIMENS[this.activeSpecimenId];
      this.currentFrequency = p.audibleDownmixHz;
      this.freqSlider.value = this.currentFrequency.toString();
      this.freqValueDisplay.textContent = `${this.currentFrequency.toFixed(1)} Hz`;
      this.visualizer.bioAcousticResonator.setAcousticFrequency(this.currentFrequency);
      this.audioEngine.startFrequencyTone(this.currentFrequency);
    });

    // 5. Power Slider
    this.powerSlider = this.container.querySelector<HTMLInputElement>('#bio-power-slider')!;
    this.powerValueDisplay = this.container.querySelector<HTMLElement>('#bio-power-val')!;

    this.powerSlider?.addEventListener('input', e => {
      const val = parseFloat((e.target as HTMLInputElement).value);
      this.currentPower = val;
      this.powerValueDisplay.textContent = `${val.toFixed(2)}x`;
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
