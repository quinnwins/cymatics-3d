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

export class NobelDiscoveryControls {
  public container: HTMLElement;
  public state: NobelLabState;
  private onStateChange: (state: NobelLabState) => void;
  private onExportDossier?: () => void;

  constructor(
    container: HTMLElement,
    initialState: NobelLabState,
    onStateChange: (state: NobelLabState) => void,
    onExportDossier?: () => void
  ) {
    this.container = container;
    this.state = { ...initialState };
    this.onStateChange = onStateChange;
    this.onExportDossier = onExportDossier;

    this.preventEventBleeding();
    this.render();
  }

  private preventEventBleeding(): void {
    this.container.addEventListener('wheel', e => e.stopPropagation(), { passive: false });
    this.container.addEventListener('pointerdown', e => e.stopPropagation());
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
      <div class="glass-panel p-3.5 sm:p-4 rounded-3xl flex flex-col gap-3 w-full shadow-2xl border border-white/10 backdrop-blur-xl text-white select-none">
        <!-- 1. Frontier Selector Tabs -->
        <div class="flex flex-col gap-2 border-b border-white/10 pb-2.5">
          <div class="flex items-center gap-2">
            <span class="text-lg">🏆</span>
            <span class="font-bold text-xs sm:text-sm uppercase text-amber-300">Nobel Discovery Frontiers</span>
          </div>

          <div class="grid grid-cols-2 gap-1.5 bg-black/40 p-1 rounded-2xl border border-white/10">
            <button id="btn-frontier-mech" class="px-2 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              isMech ? 'bg-gradient-to-r from-amber-500 to-yellow-400 text-black shadow-md shadow-amber-500/30 font-bold' : 'text-white/70 hover:text-white hover:bg-white/5'
            }">
              🧬 Mechanogenomics
            </button>
            <button id="btn-frontier-bbb" class="px-2 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              isBbb ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-black shadow-md shadow-cyan-500/30 font-bold' : 'text-white/70 hover:text-white hover:bg-white/5'
            }">
              🧠 BBB Opening
            </button>
            <button id="btn-frontier-viral" class="px-2 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              isViral ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-md shadow-pink-500/30 font-bold' : 'text-white/70 hover:text-white hover:bg-white/5'
            }">
              🦠 Viral Shatter
            </button>
            <button id="btn-frontier-seno" class="px-2 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              isSeno ? 'bg-gradient-to-r from-emerald-500 to-teal-400 text-black shadow-md shadow-emerald-500/30 font-bold' : 'text-white/70 hover:text-white hover:bg-white/5'
            }">
              ⏳ Senolytic Purge
            </button>
          </div>
        </div>

        <!-- 2. Frontier-Specific Interactive Control Decks -->
        <div class="flex flex-col gap-2.5">
          
          <!-- Description & Specimen Info -->
          <div class="bg-black/30 p-2.5 rounded-2xl border border-white/5 flex flex-col gap-1 text-xs">
            ${
              isMech
                ? `
              <div class="flex items-center justify-between">
                <span class="font-bold text-amber-300 text-xs">🧬 Nuclear Lamina & p53</span>
                <span class="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30">EPIGENETIC</span>
              </div>
              <p class="text-white/80 text-[10px] leading-tight">
                Acoustic waves dilate nuclear pores from 9 nm to 42 nm, decondensing heterochromatin to trigger <strong>p53 tumor suppressor</strong>.
              </p>
              <div class="flex gap-2 text-[10px] text-white/60 pt-0.5">
                <span>Pressure: <strong class="text-amber-300">${this.state.acousticPressureKPa} kPa</strong></span>
                <span>Carrier: <strong class="text-cyan-300">432 Hz</strong></span>
              </div>
            `
                : isBbb
                ? `
              <div class="flex items-center justify-between">
                <span class="font-bold text-cyan-300 text-xs">🧠 Focused Ultrasound BBB</span>
                <span class="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-cyan-400/20 text-cyan-300 border border-cyan-400/30">NEURO-DELIVERY</span>
              </div>
              <p class="text-white/80 text-[10px] leading-tight">
                Capillary cavitation unzips <strong>Claudin-5 junctions</strong> for targeted nanomedicine delivery into tumor tissue.
              </p>
              <div class="flex gap-2 text-[10px] text-white/60 pt-0.5">
                <span>FUS: <strong class="text-cyan-300">${this.state.fusPowerMPa} MPa</strong></span>
                <span>Pore: <strong class="text-emerald-300">${(1 + this.state.bbbDilationProgress * 44).toFixed(0)} nm</strong></span>
              </div>
            `
                : isViral
                ? `
              <div class="flex items-center justify-between">
                <span class="font-bold text-pink-300 text-xs">🦠 ${selectedVirus.name}</span>
                <span class="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-pink-400/20 text-pink-300 border border-pink-400/30">${selectedVirus.family.toUpperCase()}</span>
              </div>
              <p class="text-white/80 text-[10px] leading-tight">${selectedVirus.description}</p>
              <div class="flex gap-2 text-[10px] text-white/60 pt-0.5">
                <span>Lamb Freq: <strong class="text-pink-300">${selectedVirus.lambQuadrupoleHz} Hz</strong></span>
                <span>Capsid: <strong class="text-cyan-300">T=${selectedVirus.triangulationNumber} (${selectedVirus.youngsModulusGPa} GPa)</strong></span>
              </div>
            `
                : `
              <div class="flex items-center justify-between">
                <span class="font-bold text-emerald-300 text-xs">⏳ Senolytic Zombie Cell Purge</span>
                <span class="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-400/20 text-emerald-300 border border-emerald-400/30">REJUVENATION</span>
              </div>
              <p class="text-white/80 text-[10px] leading-tight">
                Stiff senescent cells (14.5 kPa) absorb 4.8× more acoustic strain than flexible young cells, halting toxic SASP secretion.
              </p>
              <div class="flex gap-2 text-[10px] text-white/60 pt-0.5">
                <span>Intensity: <strong class="text-emerald-300">${this.state.shockwaveIntensity.toFixed(1)}×</strong></span>
                <span>Selectivity: <strong class="text-cyan-300">>75k:1</strong></span>
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
                <div class="flex justify-between text-xs text-white/80 mb-1">
                  <span>Acoustic Pressure</span>
                  <span class="font-mono text-amber-300 font-semibold">${this.state.acousticPressureKPa} kPa</span>
                </div>
                <input type="range" id="slider-mech-pressure" min="10" max="250" step="5" value="${this.state.acousticPressureKPa}" class="w-full accent-amber-400 h-1.5 bg-white/10 rounded-lg cursor-pointer" />
              </div>
              <button id="btn-trigger-p53" class="w-full py-2.5 px-4 rounded-xl font-bold text-xs tracking-wide transition-all shadow-lg flex items-center justify-center gap-2 ${
                this.state.isP53TranscriptionActive
                  ? 'bg-gradient-to-r from-amber-400 to-yellow-300 text-black shadow-amber-400/30'
                  : 'bg-white/10 hover:bg-white/20 text-white'
              }">
                ${this.state.isP53TranscriptionActive ? '⏸️ Stop p53 Transcription' : '✨ Unfurl Chromatin & Activate p53 Gene'}
              </button>
            `
                : isBbb
                ? `
              <div>
                <div class="flex justify-between text-xs text-white/80 mb-1">
                  <span>FUS Acoustic Intensity</span>
                  <span class="font-mono text-cyan-300">${this.state.fusPowerMPa} MPa</span>
                </div>
                <input type="range" id="slider-bbb-fus" min="0.1" max="1.5" step="0.05" value="${this.state.fusPowerMPa}" class="w-full accent-cyan-400 h-1.5 bg-white/10 rounded-lg cursor-pointer" />
              </div>
              <button id="btn-trigger-nanomedicine" class="w-full py-2.5 px-4 rounded-xl font-bold text-xs tracking-wide transition-all shadow-lg flex items-center justify-center gap-2 ${
                this.state.isNanomedicineFlowing
                  ? 'bg-gradient-to-r from-cyan-400 to-blue-400 text-black shadow-cyan-400/30'
                  : 'bg-white/10 hover:bg-white/20 text-white'
              }">
                ${this.state.isNanomedicineFlowing ? '⏸️ Close Barrier & Halt Stream' : '💉 Open BBB & Stream Nanomedicine'}
              </button>
            `
                : isViral
                ? `
              <div class="flex items-center gap-2">
                <label class="text-xs text-white/70 whitespace-nowrap">Virus Species:</label>
                <select id="select-virus-species" class="w-full bg-black/60 border border-white/20 rounded-lg px-2 py-1.5 text-xs text-white">
                  ${viruses
                    .map(
                      (v) => `
                    <option value="${v.id}" ${v.id === this.state.selectedVirusId ? 'selected' : ''}>${v.name}</option>
                  `
                    )
                    .join('')}
                </select>
              </div>
              <button id="btn-trigger-viral-shatter" class="w-full py-2.5 px-4 rounded-xl font-bold text-xs tracking-wide transition-all shadow-lg flex items-center justify-center gap-2 ${
                this.state.isLambResonanceLocked
                  ? 'bg-gradient-to-r from-pink-500 to-rose-400 text-white shadow-pink-500/30'
                  : 'bg-white/10 hover:bg-white/20 text-white'
              }">
                ${this.state.isLambResonanceLocked ? '⏸️ Reset Viral Shell' : '💥 Lock Lamb Resonance & Shatter Capsid'}
              </button>
            `
                : `
              <div>
                <div class="flex justify-between text-xs text-white/80 mb-1">
                  <span>Shockwave Power</span>
                  <span class="font-mono text-emerald-300">${this.state.shockwaveIntensity.toFixed(1)}×</span>
                </div>
                <input type="range" id="slider-seno-intensity" min="0.5" max="2.5" step="0.1" value="${this.state.shockwaveIntensity}" class="w-full accent-emerald-400 h-1.5 bg-white/10 rounded-lg cursor-pointer" />
              </div>
              <button id="btn-trigger-senolytic" class="w-full py-2.5 px-4 rounded-xl font-bold text-xs tracking-wide transition-all shadow-lg flex items-center justify-center gap-2 ${
                this.state.isSenolyticPulseActive
                  ? 'bg-gradient-to-r from-emerald-400 to-teal-300 text-black shadow-emerald-400/30'
                  : 'bg-white/10 hover:bg-white/20 text-white'
              }">
                ${this.state.isSenolyticPulseActive ? '⏸️ Stop Senolytic Pulse' : '⚡ Fire Selective Acoustic Senolytic Shock'}
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
    sliderMech?.addEventListener('input', () => {
      this.state.acousticPressureKPa = parseFloat(sliderMech.value);
      this.onStateChange(this.state);
    });
    this.container.querySelector('#btn-trigger-p53')?.addEventListener('click', () => {
      this.state.isP53TranscriptionActive = !this.state.isP53TranscriptionActive;
      this.onStateChange(this.state);
      this.render();
    });

    // BBB
    const sliderBbb = this.container.querySelector('#slider-bbb-fus') as HTMLInputElement;
    sliderBbb?.addEventListener('input', () => {
      this.state.fusPowerMPa = parseFloat(sliderBbb.value);
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
    sliderSeno?.addEventListener('input', () => {
      this.state.shockwaveIntensity = parseFloat(sliderSeno.value);
      this.onStateChange(this.state);
    });
    this.container.querySelector('#btn-trigger-senolytic')?.addEventListener('click', () => {
      this.state.isSenolyticPulseActive = !this.state.isSenolyticPulseActive;
      this.onStateChange(this.state);
      this.render();
    });
  }
}
