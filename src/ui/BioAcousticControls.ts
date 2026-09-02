/**
 * BioAcousticControls.ts
 * SoundForm 3D — Interactive Bio-Acoustic Resonator & Microfluidic Cell Sorter Control Panel
 */

import { AudioEngine } from '../audio/AudioEngine';
import { VisualizerEngine } from '../visualizer/VisualizerEngine';
import { BioAcousticPhysics } from '../math/BioAcousticPhysics';
import { AcoustofluidicSortingPhysics, AcoustofluidicState } from '../math/AcoustofluidicSortingPhysics';
import { BioViewMode } from '../visualizer/BioAcousticResonator';
import { EngineMode } from './Header';

export interface SorterPreset {
  id: string;
  name: string;
  icon: string;
  badge: string;
  summary: string;
  nodeCount: number;
  powerW: number;
  flowSpeed: number;
  freqMHz: number;
  flowUlMin: number;
}

export class BioAcousticControls {
  public container: HTMLElement;
  private audioEngine: AudioEngine;
  private visualizer: VisualizerEngine;
  private onSwitchMode?: (mode: EngineMode) => void;

  // Single-Cell State
  private activeSpecimenId = 'healthy-somatic';
  private currentFrequency = 220.0;
  private currentPower = 1.0;
  private currentViewMode: BioViewMode = 'cell-inspector';
  private isSpecsOpen = false;

  // Cell Sorter State
  private activeSorterPresetId = 'ctc-cleansing';
  private sorterNodeCount = 4;
  private sorterPowerW = 2.0;
  private sorterFlowSpeed = 1.0;
  private sorterFreqMHz = 20.0;
  private sorterFlowUlMin = 18.0;

  public static readonly SORTER_PRESETS: Record<string, SorterPreset> = {
    'ctc-cleansing': {
      id: 'ctc-cleansing',
      name: 'Standard Blood Cleansing',
      icon: '🩸',
      badge: '99% Purity',
      summary: 'Pulls cancer cells out to side channels while healthy blood cells stay centered.',
      nodeCount: 4,
      powerW: 2.0,
      flowSpeed: 1.0,
      freqMHz: 20.0,
      flowUlMin: 18.0,
    },
    'exosome-purification': {
      id: 'exosome-purification',
      name: 'Exosome Nanopurification',
      icon: '🧬',
      badge: 'Gentle',
      summary: 'Gently separates tiny healing vesicles without damaging delicate cell membranes.',
      nodeCount: 8,
      powerW: 0.8,
      flowSpeed: 0.6,
      freqMHz: 35.0,
      flowUlMin: 10.0,
    },
    'diagnostic-throughput': {
      id: 'diagnostic-throughput',
      name: 'High-Throughput Sorter',
      icon: '⚡',
      badge: 'Fast Flow',
      summary: 'Rapidly sorts large fluid volumes for fast clinical screenings and diagnostics.',
      nodeCount: 2,
      powerW: 4.5,
      flowSpeed: 2.2,
      freqMHz: 12.0,
      flowUlMin: 40.0,
    },
  };

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

  public setViewMode(mode: BioViewMode): void {
    this.currentViewMode = mode;
    this.visualizer.bioAcousticResonator.setViewMode(mode);
    if (mode === 'microfluidic-sorter') {
      this.syncSorterToVisualizer();
    }
    this.render();
  }

  public getViewMode(): BioViewMode {
    return this.currentViewMode;
  }

  private render(): void {
    const isSorter = this.currentViewMode === 'microfluidic-sorter';
    const profile = BioAcousticPhysics.SPECIMENS[this.activeSpecimenId];

    this.container.innerHTML = `
      <!-- Top Title & Quick Mode Switcher -->
      <div class="flex flex-col gap-2.5 border-b border-white/10 pb-2.5">
        <div class="flex items-center justify-between gap-2 min-w-0">
          <div class="flex items-center gap-2 min-w-0 flex-1">
            <div class="w-8 h-8 rounded-xl bg-slate-900 border border-white/15 flex items-center justify-center text-emerald-400 text-xs font-mono font-bold shrink-0 shadow-sm">
              ${isSorter ? 'SORT' : 'BIO'}
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1.5 min-w-0">
                <h3 class="text-xs sm:text-sm font-bold text-white truncate">
                  ${isSorter ? 'Acoustic Cell Sorter' : 'Bio-Acoustics Lab'}
                </h3>
                <span class="px-1.5 py-0.5 rounded-full text-[9px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shrink-0">
                  ${isSorter ? 'Acoustofluidics' : profile.badge}
                </span>
              </div>
              <p class="text-[10px] text-slate-400 font-medium truncate">
                ${isSorter ? 'Sound wave microfluidic separation' : 'Cellular mechanics & spectroscopy'}
              </p>
            </div>
          </div>

          ${
            !isSorter
              ? `<!-- Lysis Action Button -->
                 <button id="bio-blast-lysis-btn" class="px-2.5 py-1.5 rounded-xl font-bold text-xs bg-rose-500 text-slate-950 hover:bg-rose-400 shadow-md shadow-rose-500/30 active:scale-95 transition-all flex items-center gap-1 cursor-pointer shrink-0" title="Trigger ultrasound cavitation explosion">
                   <span>Rupture Cell</span>
                 </button>`
              : `<!-- Live Telemetry Status Badge -->
                 <div class="px-2.5 py-1 rounded-xl font-mono text-[10px] bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 flex items-center gap-1 shrink-0">
                   <span class="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
                   <span>STREAMING</span>
                 </div>`
          }
        </div>

        <!-- View Switcher -->
        <div class="segmented-track p-1 text-xs">
          <button id="bio-view-cell" class="segmented-pill flex-1 flex items-center justify-center ${
            !isSorter ? 'is-active glass-btn-active font-bold' : ''
          }">
            Single Cell
          </button>
          <button id="bio-view-sorter" class="segmented-pill flex-1 flex items-center justify-center ${
            isSorter ? 'is-active glass-btn-active font-bold' : ''
          }">
            Cell Sorter
          </button>
        </div>
      </div>

      ${isSorter ? this.renderSorterControls() : this.renderSingleCellControls()}
    `;

    this.bindEvents();
  }

  private renderSingleCellControls(): string {
    const profile = BioAcousticPhysics.SPECIMENS[this.activeSpecimenId];
    const freqPct = Math.min(100, Math.max(0, Math.round(((this.currentFrequency - 40) / 1160) * 100)));
    const powerPct = Math.min(100, Math.max(0, Math.round(((this.currentPower - 0.1) / 2.9) * 100)));

    return `
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
  }

  private renderSorterControls(): string {
    const presets = Object.values(BioAcousticControls.SORTER_PRESETS);

    const state: AcoustofluidicState = {
      acousticPowerW: this.sorterPowerW,
      surfaceWaveFreqMHz: this.sorterFreqMHz,
      tiltAngleDeg: 15.0,
      sampleFlowRateUlMin: this.sorterFlowUlMin,
      channelWidthUm: 250.0,
      channelLengthMm: 15.0,
    };
    const telemetry = AcoustofluidicSortingPhysics.evaluateSortingTelemetry(state);

    const nodePct = Math.round(((this.sorterNodeCount - 1) / 7) * 100);
    const powerPct = Math.round(((this.sorterPowerW - 0.1) / 4.9) * 100);
    const flowPct = Math.round(((this.sorterFlowSpeed - 0.5) / 2.5) * 100);

    return `
      <!-- 1. Preset Demo Scenarios -->
      <div class="flex flex-col gap-1.5">
        <div class="flex items-center justify-between">
          <span class="text-[10px] font-semibold text-slate-300">Sorting Presets:</span>
          <span class="text-[9px] text-slate-400 font-mono">1-Touch Tuning</span>
        </div>
        <div class="flex flex-col gap-1.5">
          ${presets
            .map(
              preset => `
            <button 
              data-sorter-preset="${preset.id}"
              class="sorter-preset-btn text-left p-2.5 rounded-2xl border transition-all flex flex-col gap-1 cursor-pointer ${
                this.activeSorterPresetId === preset.id
                  ? 'glass-panel-accent border-cyan-500/80 shadow-md ring-1 ring-cyan-500/50 bg-cyan-950/40'
                  : 'bg-slate-950/60 border-white/5 hover:bg-slate-900/80'
              }"
            >
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-1.5">
                  <span class="text-sm">${preset.icon}</span>
                  <span class="font-bold text-xs text-white">${preset.name}</span>
                </div>
                <span class="px-1.5 py-0.5 rounded-full text-[9px] font-mono bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                  ${preset.badge}
                </span>
              </div>
              <p class="text-[10px] text-slate-400 leading-snug">
                ${preset.summary}
              </p>
            </button>
          `
            )
            .join('')}
        </div>
      </div>

      <!-- 2. Interactive Live Tuning Sliders -->
      <div class="flex flex-col gap-3 bg-slate-950/70 rounded-2xl p-3 border border-white/5 shadow-inner">
        <!-- Frequency / Node Count Slider -->
        <div class="flex flex-col gap-1">
          <div class="flex items-center justify-between text-xs font-mono">
            <span class="font-medium text-slate-300 flex items-center gap-1">
              <span>Sound Frequency / Lanes</span>
            </span>
            <span id="sorter-node-val" class="text-cyan-400 font-bold tabular-nums">
              ${this.sorterNodeCount} Nodes (${this.sorterFreqMHz.toFixed(0)} MHz)
            </span>
          </div>
          <input 
            id="sorter-node-slider" 
            type="range" 
            min="1" 
            max="8" 
            step="1" 
            value="${this.sorterNodeCount}"
            aria-label="Standing wave node count and acoustic frequency slider"
            style="background: linear-gradient(to right, #38bdf8 ${nodePct}%, rgba(255, 255, 255, 0.1) ${nodePct}%);"
            class="w-full h-1.5 rounded cursor-pointer"
          />
          <div class="flex justify-between text-[9px] text-slate-400 font-mono">
            <span>1 Node (Wide)</span>
            <span>4 Nodes</span>
            <span>8 Nodes (Fine)</span>
          </div>
        </div>

        <!-- Acoustic Power Slider -->
        <div class="flex flex-col gap-1">
          <div class="flex items-center justify-between text-xs font-mono">
            <span class="font-medium text-slate-300 flex items-center gap-1">
              <span>Acoustic Power</span>
            </span>
            <span id="sorter-power-val" class="text-emerald-400 font-bold tabular-nums">
              ${this.sorterPowerW.toFixed(1)} W (${(this.sorterPowerW * 0.7).toFixed(1)}x force)
            </span>
          </div>
          <input 
            id="sorter-power-slider" 
            type="range" 
            min="0.1" 
            max="5.0" 
            step="0.1" 
            value="${this.sorterPowerW}"
            aria-label="Acoustic deflection power slider"
            style="background: linear-gradient(to right, #10b981 ${powerPct}%, rgba(255, 255, 255, 0.1) ${powerPct}%);"
            class="w-full h-1.5 rounded cursor-pointer"
          />
          <div class="flex justify-between text-[9px] text-slate-400 font-mono">
            <span>0.1 W (Gentle)</span>
            <span>2.5 W</span>
            <span>5.0 W (Max Force)</span>
          </div>
        </div>

        <!-- Flow Speed Slider -->
        <div class="flex flex-col gap-1">
          <div class="flex items-center justify-between text-xs font-mono">
            <span class="font-medium text-slate-300 flex items-center gap-1">
              <span>Fluid Flow Speed</span>
            </span>
            <span id="sorter-flow-val" class="text-amber-400 font-bold tabular-nums">
              ${this.sorterFlowSpeed.toFixed(1)}x (${this.sorterFlowUlMin.toFixed(0)} µL/min)
            </span>
          </div>
          <input 
            id="sorter-flow-slider" 
            type="range" 
            min="0.5" 
            max="3.0" 
            step="0.1" 
            value="${this.sorterFlowSpeed}"
            aria-label="Microfluidic sample flow speed slider"
            style="background: linear-gradient(to right, #f59e0b ${flowPct}%, rgba(255, 255, 255, 0.1) ${flowPct}%);"
            class="w-full h-1.5 rounded cursor-pointer"
          />
          <div class="flex justify-between text-[9px] text-slate-400 font-mono">
            <span>0.5x (Precision)</span>
            <span>1.0x (Standard)</span>
            <span>3.0x (High Yield)</span>
          </div>
        </div>
      </div>

      <!-- 3. Live Sorting Telemetry Summary -->
      <div class="flex flex-col gap-1.5">
        <span class="text-[10px] font-semibold text-slate-300">Live Sorting Performance:</span>
        <div class="grid grid-cols-2 gap-2 p-2.5 rounded-2xl bg-slate-950/80 border border-white/10 text-xs font-mono shadow-inner">
          <div class="flex flex-col gap-0.5">
            <span class="text-[9px] text-slate-400 font-semibold">PURITY ESTIMATE</span>
            <span class="text-emerald-400 font-bold tabular-nums">${telemetry.exosomePurityPercent.toFixed(1)}%</span>
          </div>
          <div class="flex flex-col gap-0.5">
            <span class="text-[9px] text-slate-400 font-semibold">CAPTURE EFFICIENCY</span>
            <span class="text-cyan-400 font-bold tabular-nums">${telemetry.ctcDeflectionEfficiencyPercent.toFixed(1)}%</span>
          </div>
          <div class="flex flex-col gap-0.5">
            <span class="text-[9px] text-slate-400 font-semibold">FILTER CUTOFF</span>
            <span class="text-slate-200 font-bold tabular-nums">${telemetry.criticalCutoffDiameterNm.toFixed(0)} nm</span>
          </div>
          <div class="flex flex-col gap-0.5">
            <span class="text-[9px] text-slate-400 font-semibold">FLOW REGIME</span>
            <span class="${telemetry.isSeparationOptimal ? 'text-emerald-400' : 'text-amber-400'} font-bold">
              ${telemetry.isSeparationOptimal ? 'Optimal Focus' : 'Suboptimal Flow'}
            </span>
          </div>
        </div>
      </div>
    `;
  }

  private bindEvents(): void {
    // 1. View Switcher
    const viewCellBtn = this.container.querySelector<HTMLButtonElement>('#bio-view-cell');
    const viewSorterBtn = this.container.querySelector<HTMLButtonElement>('#bio-view-sorter');

    viewCellBtn?.addEventListener('click', () => {
      this.setViewMode('cell-inspector');
    });

    viewSorterBtn?.addEventListener('click', () => {
      this.setViewMode('microfluidic-sorter');
    });

    if (this.currentViewMode === 'cell-inspector') {
      this.bindSingleCellEvents();
    } else {
      this.bindSorterEvents();
    }
  }

  private bindSingleCellEvents(): void {
    // Specimen Buttons
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

    // Blast Lysis Trigger
    const blastBtn = this.container.querySelector<HTMLButtonElement>('#bio-blast-lysis-btn');
    blastBtn?.addEventListener('click', () => {
      this.visualizer.bioAcousticResonator.triggerHistotripsyLysis();
      this.audioEngine.startFrequencyTone(55.0);
      setTimeout(() => {
        this.audioEngine.startFrequencyTone(this.currentFrequency);
      }, 800);
    });

    // Frequency Slider
    const freqSlider = this.container.querySelector<HTMLInputElement>('#bio-freq-slider');
    const freqVal = this.container.querySelector<HTMLElement>('#bio-freq-val');
    freqSlider?.addEventListener('input', e => {
      const val = parseFloat((e.target as HTMLInputElement).value);
      this.currentFrequency = val;
      if (freqVal) freqVal.textContent = `${val.toFixed(1)} Hz`;
      const pct = Math.min(100, Math.max(0, Math.round(((val - 40) / 1160) * 100)));
      freqSlider.style.background = `linear-gradient(to right, #38bdf8 ${pct}%, rgba(255, 255, 255, 0.1) ${pct}%)`;
      this.visualizer.bioAcousticResonator.setAcousticFrequency(val);
      this.audioEngine.startFrequencyTone(val);
    });

    // Auto-tune Button
    const autotuneBtn = this.container.querySelector<HTMLButtonElement>('#bio-autotune-btn');
    autotuneBtn?.addEventListener('click', () => {
      const p = BioAcousticPhysics.SPECIMENS[this.activeSpecimenId];
      this.currentFrequency = p.audibleDownmixHz;
      this.visualizer.bioAcousticResonator.setAcousticFrequency(this.currentFrequency);
      this.audioEngine.startFrequencyTone(this.currentFrequency);
      this.render();
    });

    // Power Slider
    const powerSlider = this.container.querySelector<HTMLInputElement>('#bio-power-slider');
    const powerVal = this.container.querySelector<HTMLElement>('#bio-power-val');
    powerSlider?.addEventListener('input', e => {
      const val = parseFloat((e.target as HTMLInputElement).value);
      this.currentPower = val;
      if (powerVal) powerVal.textContent = `${val.toFixed(2)}x`;
      const pct = Math.min(100, Math.max(0, Math.round(((val - 0.1) / 2.9) * 100)));
      powerSlider.style.background = `linear-gradient(to right, #38bdf8 ${pct}%, rgba(255, 255, 255, 0.1) ${pct}%)`;
      this.visualizer.bioAcousticResonator.setAcousticIntensity(val);
    });

    // Specs Drawer Toggle
    const toggleSpecsBtn = this.container.querySelector<HTMLButtonElement>('#bio-toggle-specs-btn');
    toggleSpecsBtn?.addEventListener('click', () => {
      this.isSpecsOpen = !this.isSpecsOpen;
      this.render();
    });
  }

  private bindSorterEvents(): void {
    // 1. Preset Buttons
    const presetBtns = this.container.querySelectorAll<HTMLButtonElement>('.sorter-preset-btn');
    presetBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const presetId = btn.getAttribute('data-sorter-preset');
        if (presetId && BioAcousticControls.SORTER_PRESETS[presetId]) {
          this.applySorterPreset(presetId);
        }
      });
    });

    // 2. Node Count / Frequency Slider
    const nodeSlider = this.container.querySelector<HTMLInputElement>('#sorter-node-slider');
    nodeSlider?.addEventListener('input', e => {
      const nodes = parseInt((e.target as HTMLInputElement).value, 10);
      this.sorterNodeCount = nodes;
      this.sorterFreqMHz = 5.0 + nodes * 3.75;
      this.syncSorterToVisualizer();
      this.render();
    });

    // 3. Power Slider
    const powerSlider = this.container.querySelector<HTMLInputElement>('#sorter-power-slider');
    powerSlider?.addEventListener('input', e => {
      const power = parseFloat((e.target as HTMLInputElement).value);
      this.sorterPowerW = power;
      this.syncSorterToVisualizer();
      this.render();
    });

    // 4. Flow Speed Slider
    const flowSlider = this.container.querySelector<HTMLInputElement>('#sorter-flow-slider');
    flowSlider?.addEventListener('input', e => {
      const flow = parseFloat((e.target as HTMLInputElement).value);
      this.sorterFlowSpeed = flow;
      this.sorterFlowUlMin = flow * 18.0;
      this.syncSorterToVisualizer();
      this.render();
    });
  }

  private applySorterPreset(presetId: string): void {
    const preset = BioAcousticControls.SORTER_PRESETS[presetId];
    if (!preset) return;

    this.activeSorterPresetId = presetId;
    this.sorterNodeCount = preset.nodeCount;
    this.sorterPowerW = preset.powerW;
    this.sorterFlowSpeed = preset.flowSpeed;
    this.sorterFreqMHz = preset.freqMHz;
    this.sorterFlowUlMin = preset.flowUlMin;

    this.syncSorterToVisualizer();
    this.render();
  }

  private syncSorterToVisualizer(): void {
    this.visualizer.bioAcousticResonator.setSorterParameters({
      nodeCount: this.sorterNodeCount,
      powerMultiplier: this.sorterPowerW * 0.7,
      flowSpeedMultiplier: this.sorterFlowSpeed,
    });
  }

  public getActiveSpecimenId(): string {
    return this.activeSpecimenId;
  }
}
