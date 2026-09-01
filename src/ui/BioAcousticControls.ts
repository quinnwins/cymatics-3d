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
      'w-full max-w-5xl mx-auto bg-slate-900/90 backdrop-blur-xl border border-slate-700/60 rounded-2xl p-4 md:p-5 shadow-2xl transition-all duration-300 flex flex-col gap-4';

    this.render();
  }

  private render(): void {
    const profile = BioAcousticPhysics.SPECIMENS[this.activeSpecimenId];

    this.container.innerHTML = `
      <!-- Top Title & Quick Actions -->
      <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-cyan-500 flex items-center justify-center text-lg shadow-lg shadow-emerald-500/20">
            🧬
          </div>
          <div>
            <h3 class="text-sm font-semibold text-slate-100 flex items-center gap-2">
              Bio-Acoustic Resonator & Cellular Spectroscopy
              <span class="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                ${profile.badge}
              </span>
            </h3>
            <p class="text-xs text-slate-400">
              Simulating acoustic deformation, cytoskeletal softening, and Gor'kov radiation trapping
            </p>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <!-- View Switcher -->
          <div class="bg-slate-800/80 p-1 rounded-xl border border-slate-700/50 flex items-center gap-1 text-xs">
            <button id="bio-view-cell" class="px-3 py-1.5 rounded-lg font-medium transition-all ${
              this.currentViewMode === 'cell-inspector'
                ? 'bg-cyan-500 text-slate-950 shadow-md font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }">
              🔬 Single Cell
            </button>
            <button id="bio-view-sorter" class="px-3 py-1.5 rounded-lg font-medium transition-all ${
              this.currentViewMode === 'microfluidic-sorter'
                ? 'bg-cyan-500 text-slate-950 shadow-md font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }">
              🧪 Cell Sorter
            </button>
          </div>

          <!-- Lysis Action Button -->
          <button id="bio-blast-lysis-btn" class="px-3.5 py-1.5 rounded-xl font-medium text-xs bg-gradient-to-r from-rose-500 to-amber-500 text-white shadow-lg shadow-rose-500/25 hover:brightness-110 active:scale-95 transition-all flex items-center gap-1.5">
            <span>💥</span>
            <span>Blast Lysis</span>
          </button>
        </div>
      </div>

      <!-- Specimen Selector Carousel -->
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
        ${Object.values(BioAcousticPhysics.SPECIMENS)
          .map(
            spec => `
          <button 
            data-specimen-id="${spec.id}" 
            class="bio-specimen-btn text-left p-2.5 rounded-xl border transition-all flex flex-col gap-1 ${
              this.activeSpecimenId === spec.id
                ? 'bg-slate-800/90 border-cyan-500/80 shadow-lg shadow-cyan-500/10 ring-1 ring-cyan-500/50'
                : 'bg-slate-800/40 border-slate-700/40 hover:bg-slate-800/70 hover:border-slate-600'
            }"
          >
            <div class="flex items-center justify-between text-xs">
              <span class="font-semibold text-slate-200 truncate">${spec.name}</span>
            </div>
            <div class="flex items-center justify-between text-[11px] text-slate-400 font-mono">
              <span>E: ${spec.youngsModulusKPa >= 1000 ? (spec.youngsModulusKPa / 1000).toFixed(1) + ' MPa' : spec.youngsModulusKPa.toFixed(1) + ' kPa'}</span>
              <span class="${spec.acousticContrastPhi >= 0 ? 'text-cyan-400' : 'text-rose-400'}">
                Φ: ${spec.acousticContrastPhi > 0 ? '+' : ''}${spec.acousticContrastPhi.toFixed(2)}
              </span>
            </div>
          </button>
        `
          )
          .join('')}
      </div>

      <!-- Sliders & Telemetry Section -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-800/40 rounded-xl p-3 border border-slate-700/40">
        <!-- Frequency Sweeper -->
        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between text-xs">
            <span class="font-medium text-slate-300 flex items-center gap-1.5">
              <span>🔊 Acoustic Frequency</span>
              <button id="bio-autotune-btn" class="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 text-[10px] font-mono border border-cyan-500/30 transition-all flex items-center gap-1">
                🎯 Auto-Tune Peak (${profile.audibleDownmixHz} Hz)
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
          <div class="flex justify-between text-[10px] text-slate-500 font-mono">
            <span>40 Hz (Sub-Bass)</span>
            <span>440 Hz (Concert A)</span>
            <span>1200 Hz (High Resonance)</span>
          </div>
        </div>

        <!-- Acoustic Excitation Intensity -->
        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between text-xs">
            <span class="font-medium text-slate-300">⚡ Acoustic Wave Power</span>
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
          <div class="flex justify-between text-[10px] text-slate-500 font-mono">
            <span>0.1x (Gentle)</span>
            <span>1.0x (Harmonic)</span>
            <span>3.0x (Extreme Blebbing)</span>
          </div>
        </div>
      </div>

      <!-- Collapsible Biophysics Specs HUD -->
      <div class="flex flex-col gap-2">
        <button id="bio-toggle-specs-btn" class="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1.5 font-medium transition-colors w-fit">
          <span>${this.isSpecsOpen ? '▼' : '▶'}</span>
          <span>⚡ Biophysics Specs & Mechanobiology Telemetry</span>
        </button>

        <div id="bio-specs-drawer" class="${this.isSpecsOpen ? 'grid' : 'hidden'} grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs font-mono">
          <div class="flex flex-col gap-0.5">
            <span class="text-[10px] text-slate-500">YOUNG'S MODULUS (E)</span>
            <span class="text-slate-200 font-semibold">${profile.youngsModulusKPa} kPa</span>
          </div>
          <div class="flex flex-col gap-0.5">
            <span class="text-[10px] text-slate-500">CORTICAL TENSION (σ)</span>
            <span class="text-slate-200 font-semibold">${profile.corticalTensionMNm} mN/m</span>
          </div>
          <div class="flex flex-col gap-0.5">
            <span class="text-[10px] text-slate-500">GOR'KOV CONTRAST (Φ)</span>
            <span class="${profile.acousticContrastPhi >= 0 ? 'text-cyan-400' : 'text-rose-400'} font-semibold">
              ${profile.acousticContrastPhi > 0 ? '+' : ''}${profile.acousticContrastPhi} (${profile.acousticContrastPhi >= 0 ? 'Nodes' : 'Antinodes'})
            </span>
          </div>
          <div class="flex flex-col gap-0.5">
            <span class="text-[10px] text-slate-500">ACOUSTIC IMPEDANCE (Z)</span>
            <span class="text-slate-200 font-semibold">${profile.acousticImpedanceMRayl} MRayl</span>
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
