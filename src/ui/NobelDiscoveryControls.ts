/**
 * NobelDiscoveryControls.ts
 * SoundForm 3D - Customer-Facing Control Deck for Nobel Discovery Lab
 *
 * Simplicity & Zero Cognitive Load:
 * - 4 Clear Frontier Pills with distinctive emoji badges.
 * - 1-Click Breakthrough Action Buttons with luminous state toggles.
 * - Everyday Plain-Language Explanations of Nobel-tier biophysics.
 */

import { NobelBiophysics, NobelFrontierId, NobelLabState } from '../math/NobelBiophysics';
import { EngineMode } from './Header';

export class NobelDiscoveryControls {
  public container: HTMLElement;
  public state: NobelLabState;
  private onStateChange: (state: NobelLabState) => void;
  private onExportDossier?: () => void;
  private onSwitchMode?: (mode: EngineMode) => void;

  constructor(
    container: HTMLElement,
    initialState: NobelLabState,
    onStateChange: (state: NobelLabState) => void,
    onExportDossier?: () => void,
    onSwitchMode?: (mode: EngineMode) => void
  ) {
    this.container = container;
    this.state = { ...initialState };
    this.onStateChange = onStateChange;
    this.onExportDossier = onExportDossier;
    this.onSwitchMode = onSwitchMode;

    this.preventEventBleeding();
    this.render();
  }

  public getElement(): HTMLElement {
    return this.container;
  }

  private preventEventBleeding(): void {
    this.container.addEventListener('wheel', e => e.stopPropagation(), { passive: false });
  }

  public setState(newState: Partial<NobelLabState>) {
    this.state = { ...this.state, ...newState };
    this.render();
  }

  public render() {
    const isMech = this.state.frontierId === 'mechanogenomics';
    const isBbb = this.state.frontierId === 'bbb-dilation';
    const isViral = this.state.frontierId === 'viral-shatter';
    const isSeno = this.state.frontierId === 'senolytic-clearance';

    const viruses = Object.values(NobelBiophysics.VIRUS_PROFILES);
    const selectedVirus = NobelBiophysics.VIRUS_PROFILES[this.state.selectedVirusId] || viruses[0];

    this.container.innerHTML = `
      <div class="glass-panel p-3.5 sm:p-4 rounded-2xl flex flex-col gap-3 w-full shadow-xl border border-white/10 text-white select-none">
        <!-- 1. Frontier Selector Tabs -->
        <div class="flex flex-col gap-2 border-b border-white/10 pb-2.5">
          <div class="flex items-center gap-2">
            <span class="font-bold text-xs sm:text-sm text-white">Nobel Frontiers</span>
          </div>

          <div class="grid grid-cols-2 gap-1.5 bg-slate-900/60 p-1 rounded-2xl border border-white/5">
            <button id="btn-frontier-mech" class="px-2 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              isMech ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40 shadow-sm font-bold' : 'text-slate-400 hover:text-white hover:bg-white/5'
            }">
              Gene Activation
            </button>
            <button id="btn-frontier-bbb" class="px-2 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              isBbb ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm font-bold' : 'text-slate-400 hover:text-white hover:bg-white/5'
            }">
              Blood-Brain Barrier
            </button>
            <button id="btn-frontier-viral" class="px-2 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              isViral ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm font-bold' : 'text-slate-400 hover:text-white hover:bg-white/5'
            }">
              Virus Disruption
            </button>
            <button id="btn-frontier-seno" class="px-2 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              isSeno ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm font-bold' : 'text-slate-400 hover:text-white hover:bg-white/5'
            }">
              Cell Clearance
            </button>
          </div>
        </div>

        <!-- 2. Frontier-Specific Interactive Control Decks -->
        <div class="flex flex-col gap-2.5">
          
          <!-- Description & Specimen Info -->
          <div class="bg-slate-900/60 p-2.5 rounded-2xl border border-white/5 flex flex-col gap-1 text-xs">
            ${
              isMech
                ? `
              <div class="flex items-center justify-between">
                <span class="font-bold text-amber-300 text-xs">Cell Nucleus & Tumor Defense</span>
                <span class="px-1.5 py-0.5 rounded-full text-[9px] font-mono bg-amber-400/10 text-amber-300 border border-amber-400/30">GENE REGULATION</span>
              </div>
              <p class="text-slate-300 text-[10px] leading-tight">
                Gentle sound pressure stretches the cell nucleus, opening pores to turn on natural tumor-fighting genes (p53).
              </p>
              <div class="flex gap-2 text-[10px] text-slate-400 pt-0.5">
                <span>Pressure: <strong class="text-amber-300">${this.state.acousticPressureKPa} kPa</strong></span>
                <span>Frequency: <strong class="text-cyan-300">432 Hz</strong></span>
              </div>
            `
                : isBbb
                ? `
              <div class="flex items-center justify-between">
                <span class="font-bold text-cyan-300 text-xs">Blood-Brain Barrier Opening</span>
                <span class="px-1.5 py-0.5 rounded-full text-[9px] font-mono bg-cyan-400/10 text-cyan-300 border border-cyan-400/30">TARGETED DELIVERY</span>
              </div>
              <p class="text-slate-300 text-[10px] leading-tight">
                Micro-bubbles guided by ultrasound temporarily open blood vessel walls, allowing medicine to reach targeted brain tissue.
              </p>
              <div class="flex gap-2 text-[10px] text-slate-400 pt-0.5">
                <span>Intensity: <strong class="text-cyan-300">${this.state.fusPowerMPa} MPa</strong></span>
                <span>Pore Size: <strong class="text-emerald-300">${(1 + this.state.bbbDilationProgress * 44).toFixed(0)} nm</strong></span>
              </div>
            `
                : isViral
                ? `
              <div class="flex items-center justify-between">
                <span class="font-bold text-purple-300 text-xs">${selectedVirus.name}</span>
                <span class="px-1.5 py-0.5 rounded-full text-[9px] font-mono bg-purple-400/10 text-purple-300 border border-purple-400/30">${selectedVirus.family.toUpperCase()}</span>
              </div>
              <p class="text-slate-300 text-[10px] leading-tight">${selectedVirus.description}</p>
              <div class="flex gap-2 text-[10px] text-slate-400 pt-0.5">
                <span>Resonance: <strong class="text-purple-300">${selectedVirus.lambQuadrupoleHz} Hz</strong></span>
                <span>Shell Stiffness: <strong class="text-cyan-300">${selectedVirus.youngsModulusGPa} GPa</strong></span>
              </div>
            `
                : `
              <div class="flex items-center justify-between">
                <span class="font-bold text-emerald-300 text-xs">Aging Cell Clearance</span>
                <span class="px-1.5 py-0.5 rounded-full text-[9px] font-mono bg-emerald-400/10 text-emerald-300 border border-emerald-400/30">TISSUE HEALTH</span>
              </div>
              <p class="text-slate-300 text-[10px] leading-tight">
                Aging, stiff cells absorb far more sound energy than flexible young cells, allowing ultrasound to selectively clear them while protecting healthy tissue.
              </p>
              <div class="flex gap-2 text-[10px] text-slate-400 pt-0.5">
                <span>Strength: <strong class="text-emerald-300">${this.state.shockwaveIntensity.toFixed(1)}×</strong></span>
                <span>Selectivity: <strong class="text-cyan-300">>75,000:1</strong></span>
              </div>
            `
            }
          </div>

          <!-- RIGHT: Interactive Controls & Triggers -->
          <div class="flex flex-col gap-2.5">
            ${
              isMech
                ? `
              <div>
                <div class="flex justify-between text-xs text-slate-300 mb-1">
                  <span>Acoustic Pressure</span>
                  <span id="val-mech-pressure" class="font-mono text-amber-300 font-semibold">${this.state.acousticPressureKPa} kPa</span>
                </div>
                <input type="range" id="slider-mech-pressure" min="10" max="250" step="5" value="${this.state.acousticPressureKPa}" class="w-full min-w-0 cursor-pointer slider-amber" />
              </div>
              <button id="btn-trigger-p53" class="w-full py-2.5 px-4 rounded-xl font-semibold text-xs tracking-wide transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer ${
                this.state.isP53TranscriptionActive
                  ? 'bg-amber-400 text-slate-950 font-bold'
                  : 'bg-slate-800 text-slate-100 border border-slate-700 hover:bg-slate-700'
              }">
                ${this.state.isP53TranscriptionActive ? 'Stop Transcription' : 'Trigger Tumor Defense Gene (p53)'}
              </button>
            `
                : isBbb
                ? `
              <div>
                <div class="flex justify-between text-xs text-slate-300 mb-1">
                  <span>Ultrasound Intensity</span>
                  <span id="val-bbb-fus" class="font-mono text-cyan-300">${this.state.fusPowerMPa} MPa</span>
                </div>
                <input type="range" id="slider-bbb-fus" min="0.1" max="1.5" step="0.05" value="${this.state.fusPowerMPa}" class="w-full min-w-0 cursor-pointer slider-cyan" />
              </div>
              <button id="btn-trigger-nanomedicine" class="w-full py-2.5 px-4 rounded-xl font-semibold text-xs tracking-wide transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer ${
                this.state.isNanomedicineFlowing
                  ? 'bg-cyan-400 text-slate-950 font-bold'
                  : 'bg-slate-800 text-slate-100 border border-slate-700 hover:bg-slate-700'
              }">
                ${this.state.isNanomedicineFlowing ? 'Close Barrier & Stop Flow' : 'Open Barrier & Deliver Medicine'}
              </button>
            `
                : isViral
                ? `
              <div class="flex items-center gap-2">
                <label class="text-xs text-slate-300 whitespace-nowrap">Select Virus:</label>
                <select id="select-virus-species" class="w-full bg-slate-900 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white">
                  ${viruses
                    .map(
                      (v) => `
                    <option value="${v.id}" ${v.id === this.state.selectedVirusId ? 'selected' : ''}>${v.name}</option>
                  `
                    )
                    .join('')}
                </select>
              </div>
              <button id="btn-trigger-viral-shatter" class="w-full py-2.5 px-4 rounded-xl font-semibold text-xs tracking-wide transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer ${
                this.state.isLambResonanceLocked
                  ? 'bg-purple-500 text-white font-bold'
                  : 'bg-slate-800 text-slate-100 border border-slate-700 hover:bg-slate-700'
              }">
                ${this.state.isLambResonanceLocked ? 'Reset Shell State' : 'Apply Resonant Frequency to Shell'}
              </button>
            `
                : `
              <div>
                <div class="flex justify-between text-xs text-slate-300 mb-1">
                  <span>Pulse Strength</span>
                  <span id="val-seno-intensity" class="font-mono text-emerald-300">${this.state.shockwaveIntensity.toFixed(1)}×</span>
                </div>
                <input type="range" id="slider-seno-intensity" min="0.5" max="2.5" step="0.1" value="${this.state.shockwaveIntensity}" class="w-full min-w-0 cursor-pointer slider-emerald" />
              </div>
              <button id="btn-trigger-senolytic" class="w-full py-2.5 px-4 rounded-xl font-semibold text-xs tracking-wide transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer ${
                this.state.isSenolyticPulseActive
                  ? 'bg-emerald-400 text-slate-950 font-bold'
                  : 'bg-slate-800 text-slate-100 border border-slate-700 hover:bg-slate-700'
              }">
                ${this.state.isSenolyticPulseActive ? 'Stop Acoustic Pulse' : 'Send Selective Acoustic Pulse'}
              </button>
            `
            }
          </div>
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  private attachEventListeners() {
    // Frontier Tabs
    this.container.querySelector('#btn-frontier-mech')?.addEventListener('click', () => {
      this.state.frontierId = 'mechanogenomics';
      this.onStateChange(this.state);
      this.render();
    });
    this.container.querySelector('#btn-frontier-bbb')?.addEventListener('click', () => {
      this.state.frontierId = 'bbb-dilation';
      this.onStateChange(this.state);
      this.render();
    });
    this.container.querySelector('#btn-frontier-viral')?.addEventListener('click', () => {
      this.state.frontierId = 'viral-shatter';
      this.onStateChange(this.state);
      this.render();
    });
    this.container.querySelector('#btn-frontier-seno')?.addEventListener('click', () => {
      this.state.frontierId = 'senolytic-clearance';
      this.onStateChange(this.state);
      this.render();
    });

    // Mechanogenomics
    const sliderMech = this.container.querySelector('#slider-mech-pressure') as HTMLInputElement;
    const valMech = this.container.querySelector('#val-mech-pressure');
    sliderMech?.addEventListener('input', () => {
      this.state.acousticPressureKPa = parseFloat(sliderMech.value);
      if (valMech) valMech.textContent = `${this.state.acousticPressureKPa} kPa`;
      this.onStateChange(this.state);
    });
    this.container.querySelector('#btn-trigger-p53')?.addEventListener('click', () => {
      this.state.isP53TranscriptionActive = !this.state.isP53TranscriptionActive;
      this.onStateChange(this.state);
      this.render();
    });

    // BBB
    const sliderBbb = this.container.querySelector('#slider-bbb-fus') as HTMLInputElement;
    const valBbb = this.container.querySelector('#val-bbb-fus');
    sliderBbb?.addEventListener('input', () => {
      this.state.fusPowerMPa = parseFloat(sliderBbb.value);
      if (valBbb) valBbb.textContent = `${this.state.fusPowerMPa} MPa`;
      this.onStateChange(this.state);
    });
    this.container.querySelector('#btn-trigger-nanomedicine')?.addEventListener('click', () => {
      this.state.isNanomedicineFlowing = !this.state.isNanomedicineFlowing;
      this.onStateChange(this.state);
      this.render();
    });

    // Viral
    const selectVirus = this.container.querySelector('#select-virus-species') as HTMLSelectElement;
    selectVirus?.addEventListener('change', () => {
      this.state.selectedVirusId = selectVirus.value;
      const prof = NobelBiophysics.VIRUS_PROFILES[selectVirus.value];
      if (prof) this.state.frequencyHz = prof.lambQuadrupoleHz;
      this.onStateChange(this.state);
      this.render();
    });
    this.container.querySelector('#btn-trigger-viral-shatter')?.addEventListener('click', () => {
      this.state.isLambResonanceLocked = !this.state.isLambResonanceLocked;
      this.onStateChange(this.state);
      this.render();
    });

    // Senolytic
    const sliderSeno = this.container.querySelector('#slider-seno-intensity') as HTMLInputElement;
    const valSeno = this.container.querySelector('#val-seno-intensity');
    sliderSeno?.addEventListener('input', () => {
      this.state.shockwaveIntensity = parseFloat(sliderSeno.value);
      if (valSeno) valSeno.textContent = `${this.state.shockwaveIntensity.toFixed(1)}×`;
      this.onStateChange(this.state);
    });
    this.container.querySelector('#btn-trigger-senolytic')?.addEventListener('click', () => {
      this.state.isSenolyticPulseActive = !this.state.isSenolyticPulseActive;
      this.onStateChange(this.state);
      this.render();
    });
  }
}
