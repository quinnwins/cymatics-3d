/**
 * TherapyLabControls.ts
 * SoundForm 3D — Targeted Ultrasound Oncology & Acoustic Resonance Therapy Deck
 *
 * Capabilities:
 * - 8 Specialized Experiment Modalities (Phase Cancel, Oncotripsy, Histotripsy, Time-Reversal, Vortex Torsion, Sonodynamic SDT, PIEZO1 Ca2+, Immune Swarm).
 * - Real-Time Web Audio Destructive Phase Cancellation.
 * - Holland/Caltech 11th-Harmonic Heterodyne Fatigue Modulation.
 * - Clinical AFM Human Cancer Selector (Glioblastoma, Pancreatic, Breast, Osteosarcoma).
 * - Dual View: Single Co-Culture Pair vs 3D Multicellular Spheroid Cluster.
 * - 1-Click IEC 61102 Clinical Protocol & SOP Exporter.
 */

import * as THREE from 'three';
import { AudioEngine } from '../audio/AudioEngine';
import { VisualizerEngine } from '../visualizer/VisualizerEngine';
import { TherapyExperiment } from '../visualizer/AcousticTherapyLab';
import { OncotripsyPhysics } from '../math/OncotripsyPhysics';
import { ClinicalProtocolExporter } from './ClinicalProtocolExporter';
import { EngineMode } from './Header';

export class TherapyLabControls {
  public container: HTMLElement;
  private audioEngine: AudioEngine;
  private visualizer: VisualizerEngine;
  private onSwitchMode?: (mode: EngineMode) => void;

  private currentExperiment: TherapyExperiment = 'phase-cancel';
  private currentTumorId = 'mda-mb-231';
  private frequencyHz = 118.0;
  private phaseDeg = 180.0;
  private acousticPower = 1.0;
  private isAntiPhaseActive = false;
  private isHeterodyneActive = false;
  private viewMode: 'co-culture-pair' | 'spheroid-cluster' = 'co-culture-pair';
  private vortexCharge: 1 | 2 | 3 = 1;

  constructor(
    audioEngine: AudioEngine,
    visualizer: VisualizerEngine,
    onSwitchMode?: (mode: EngineMode) => void
  ) {
    this.audioEngine = audioEngine;
    this.visualizer = visualizer;
    this.onSwitchMode = onSwitchMode;

    this.container = document.createElement('div');
    this.container.id = 'therapy-lab-controls';
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
    const telemetry = this.visualizer.acousticTherapyLab.getTelemetry();
    const profiles = Object.values(OncotripsyPhysics.CLINICAL_PROFILES);

    const freqPct = Math.min(100, Math.max(0, Math.round(((this.frequencyHz - 20) / 480) * 100)));
    const phasePct = Math.min(100, Math.max(0, Math.round((this.phaseDeg / 360) * 100)));
    const powerPct = Math.min(100, Math.max(0, Math.round(((this.acousticPower - 0.1) / 2.9) * 100)));

    this.container.innerHTML = `
      <!-- Top Title & Controls Header -->
      <div class="flex flex-col gap-2.5 border-b border-white/10 pb-2.5">
        <div class="flex items-center justify-between gap-2 min-w-0">
          <div class="flex items-center gap-2 min-w-0 flex-1">
            <div class="w-8 h-8 rounded-xl bg-slate-900 border border-white/15 flex items-center justify-center text-rose-400 font-mono text-xs font-bold shrink-0 shadow-sm">
              Rx
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1.5 min-w-0">
                <h3 class="text-xs sm:text-sm font-bold text-white truncate">
                  Sound Therapy
                </h3>
                <span class="px-1.5 py-0.5 rounded-full text-[9px] font-mono bg-rose-500/10 text-rose-300 border border-rose-500/30 shrink-0">
                  Ultrasound
                </span>
              </div>
              <p class="text-[10px] text-slate-400 font-medium truncate">
                Resonance ablation & wave cancel
              </p>
            </div>
          </div>

          <!-- Top Export SOP Action Button -->
          <button
            id="btn-export-clinical-sop"
            title="Export IEC 61102 Clinical Protocol & SOP"
            class="glass-btn px-2.5 py-1.5 rounded-xl text-xs font-semibold text-cyan-300 hover:text-white border border-cyan-500/30 hover:bg-cyan-500/20 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <svg class="w-3.5 h-3.5 text-cyan-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            <span class="text-[11px] font-medium">Protocol</span>
          </button>
        </div>

        <!-- View Toggle -->
        <div class="segmented-track p-1 text-xs">
          <button id="view-single-pair" class="segmented-pill flex-1 flex items-center justify-center ${
            this.viewMode === 'co-culture-pair' ? 'is-active glass-btn-active font-bold' : ''
          }">
            Single Cell Pair
          </button>
          <button id="view-spheroid" class="segmented-pill flex-1 flex items-center justify-center ${
            this.viewMode === 'spheroid-cluster' ? 'is-active glass-btn-active font-bold' : ''
          }">
            Spheroid Cluster
          </button>
        </div>
      </div>

      <!-- 8 Experiment Modalities Grid -->
      <div class="flex flex-col gap-1.5">
        <div class="flex items-center justify-between">
          <span class="text-[10px] font-semibold text-slate-300">Therapy Modalities:</span>
          <span class="text-[9px] font-mono text-cyan-400">8 Active Protocols</span>
        </div>
        <div class="grid grid-cols-2 gap-1.5" id="experiment-tabs-grid">
          <button data-experiment="phase-cancel" class="tab-exp-btn text-left p-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
            this.currentExperiment === 'phase-cancel'
              ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm ring-1 ring-cyan-400/50 border-cyan-400'
              : 'bg-slate-950/60 text-slate-300 hover:text-white hover:bg-slate-900 border-white/5'
          }">
            <div class="truncate">Wave Cancellation</div>
            <div class="text-[9px] font-mono opacity-70">Anti-Phase 180°</div>
          </button>
          <button data-experiment="oncotripsy" class="tab-exp-btn text-left p-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
            this.currentExperiment === 'oncotripsy'
              ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm ring-1 ring-cyan-400/50 border-cyan-400'
              : 'bg-slate-950/60 text-slate-300 hover:text-white hover:bg-slate-900 border-white/5'
          }">
            <div class="truncate">Oncotripsy (Ablation)</div>
            <div class="text-[9px] font-mono opacity-70">Holland Resonance</div>
          </button>
          <button data-experiment="histotripsy" class="tab-exp-btn text-left p-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
            this.currentExperiment === 'histotripsy'
              ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm ring-1 ring-cyan-400/50 border-cyan-400'
              : 'bg-slate-950/60 text-slate-300 hover:text-white hover:bg-slate-900 border-white/5'
          }">
            <div class="truncate">Histotripsy (Cavitation)</div>
            <div class="text-[9px] font-mono opacity-70">Microbubble Rupture</div>
          </button>
          <button data-experiment="time-reversal" class="tab-exp-btn text-left p-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
            this.currentExperiment === 'time-reversal'
              ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm ring-1 ring-cyan-400/50 border-cyan-400'
              : 'bg-slate-950/60 text-slate-300 hover:text-white hover:bg-slate-900 border-white/5'
          }">
            <div class="truncate">Time-Reversal Focus</div>
            <div class="text-[9px] font-mono opacity-70">Skull Phase Conjugate</div>
          </button>
          <button data-experiment="vortex-torsion" class="tab-exp-btn text-left p-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
            this.currentExperiment === 'vortex-torsion'
              ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm ring-1 ring-cyan-400/50 border-cyan-400'
              : 'bg-slate-950/60 text-slate-300 hover:text-white hover:bg-slate-900 border-white/5'
          }">
            <div class="truncate">Vortex Torsion (OAM)</div>
            <div class="text-[9px] font-mono opacity-70">Helical Trapping Beam</div>
          </button>
          <button data-experiment="sonodynamic-sdt" class="tab-exp-btn text-left p-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
            this.currentExperiment === 'sonodynamic-sdt'
              ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm ring-1 ring-cyan-400/50 border-cyan-400'
              : 'bg-slate-950/60 text-slate-300 hover:text-white hover:bg-slate-900 border-white/5'
          }">
            <div class="truncate">Sonodynamic SDT</div>
            <div class="text-[9px] font-mono opacity-70">ROS Free Radical Storm</div>
          </button>
          <button data-experiment="calcium-piezo1" class="tab-exp-btn text-left p-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
            this.currentExperiment === 'calcium-piezo1'
              ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm ring-1 ring-cyan-400/50 border-cyan-400'
              : 'bg-slate-950/60 text-slate-300 hover:text-white hover:bg-slate-900 border-white/5'
          }">
            <div class="truncate">PIEZO1 Ion Flux</div>
            <div class="text-[9px] font-mono opacity-70">Ca²⁺ Apoptotic Influx</div>
          </button>
          <button data-experiment="immune-swarm" class="tab-exp-btn text-left p-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
            this.currentExperiment === 'immune-swarm'
              ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm ring-1 ring-cyan-400/50 border-cyan-400'
              : 'bg-slate-950/60 text-slate-300 hover:text-white hover:bg-slate-900 border-white/5'
          }">
            <div class="truncate">Immune Swarm (DAMPs)</div>
            <div class="text-[9px] font-mono opacity-70">T-Cell Cytotoxic Homing</div>
          </button>
        </div>
      </div>

      <!-- Human Cancer Model Selector -->
      <div class="flex flex-col gap-1.5">
        <div class="flex items-center justify-between">
          <span class="text-[10px] font-semibold text-slate-300">Target Cancer Cell Line:</span>
          <span class="text-[9px] font-mono text-rose-400 font-bold">AFM Elasticity Calibrated</span>
        </div>
        <div class="grid grid-cols-2 gap-1.5">
          ${profiles
            .map(
              p => `
            <button
              data-tumor-id="${p.id}"
              class="btn-tumor-profile text-left p-2 rounded-xl border transition-all flex flex-col gap-0.5 cursor-pointer ${
                this.currentTumorId === p.id
                  ? 'glass-panel-accent border-rose-500/80 shadow-sm ring-1 ring-rose-500/50'
                  : 'bg-slate-950/60 border-white/5 hover:bg-slate-900'
              }"
            >
              <span class="text-xs font-bold text-slate-200 truncate">${p.name}</span>
              <div class="flex justify-between text-[10px] text-slate-400 font-mono">
                <span>E: ${p.youngsModulusKPa.toFixed(1)} kPa</span>
                <span class="text-rose-400 font-semibold">${p.resonantFreqHz} Hz</span>
              </div>
            </button>
          `
            )
            .join('')}
        </div>
      </div>

      <!-- Interactive Frequency & Phase Sliders Section -->
      <div class="flex flex-col gap-2.5 bg-slate-950/70 rounded-2xl p-3 border border-white/5 shadow-inner">
        <!-- Frequency Slider -->
        <div class="flex flex-col gap-1">
          <div class="flex items-center justify-between text-xs font-mono">
            <span class="font-medium text-slate-300 flex items-center gap-1.5">
              <span>Frequency</span>
              <button id="btn-lock-cancer-freq" class="px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-300 hover:bg-rose-500/25 text-[9px] font-mono border border-rose-500/30 transition-all cursor-pointer font-bold">
                Lock Resonance
              </button>
            </span>
            <span id="ctrl-freq-val" class="text-cyan-400 font-bold tabular-nums">${this.frequencyHz.toFixed(1)} Hz</span>
          </div>
          <input
            id="ctrl-freq-slider"
            type="range"
            min="20"
            max="500"
            step="1"
            value="${this.frequencyHz}"
            aria-label="Therapeutic excitation frequency"
            style="background: linear-gradient(to right, #38bdf8 ${freqPct}%, rgba(255, 255, 255, 0.1) ${freqPct}%);"
            class="w-full min-w-0 cursor-pointer slider-cyan"
          />
        </div>

        <!-- Phase Angle Slider -->
        <div class="flex flex-col gap-1">
          <div class="flex items-center justify-between text-xs font-mono">
            <span class="font-medium text-slate-300 flex items-center gap-1.5">
              <span>Phase Angle (ΔΦ)</span>
              <button id="btn-set-180" class="px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300 hover:bg-cyan-500/25 text-[9px] font-mono border border-cyan-500/30 transition-all cursor-pointer font-bold">
                Anti-Phase (180°)
              </button>
            </span>
            <span id="ctrl-phase-val" class="text-emerald-400 font-bold tabular-nums">${this.phaseDeg.toFixed(0)}°</span>
          </div>
          <input
            id="ctrl-phase-slider"
            type="range"
            min="0"
            max="360"
            step="1"
            value="${this.phaseDeg}"
            aria-label="Acoustic phase offset angle"
            style="background: linear-gradient(to right, #34d399 ${phasePct}%, rgba(255, 255, 255, 0.1) ${phasePct}%);"
            class="w-full min-w-0 cursor-pointer slider-emerald"
          />
        </div>

        <!-- Acoustic Power Slider & Heterodyne Toggle -->
        <div class="flex flex-col gap-1">
          <div class="flex items-center justify-between text-xs font-mono">
            <span class="font-medium text-slate-300 flex items-center gap-1.5">
              <span>Acoustic Power</span>
              <button id="btn-toggle-heterodyne" class="px-1.5 py-0.5 rounded ${
                this.isHeterodyneActive ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              } text-[9px] font-mono transition-all cursor-pointer">
                11th Harmonic: ${this.isHeterodyneActive ? 'ON' : 'OFF'}
              </button>
            </span>
            <span id="ctrl-power-val" class="text-amber-400 font-bold tabular-nums">${this.acousticPower.toFixed(2)}x</span>
          </div>
          <input
            id="ctrl-power-slider"
            type="range"
            min="0.1"
            max="3.0"
            step="0.05"
            value="${this.acousticPower}"
            aria-label="Acoustic excitation power multiplier"
            style="background: linear-gradient(to right, #fbbf24 ${powerPct}%, rgba(255, 255, 255, 0.1) ${powerPct}%);"
            class="w-full min-w-0 cursor-pointer slider-amber"
          />
        </div>
      </div>

      <!-- Hero Trigger Action Button -->
      <div id="hero-action-container" class="w-full">
        ${this.getHeroButtonHtml()}
      </div>

      <!-- Real-Time Clinical Safety & Lysis Telemetry HUD -->
      <div class="grid grid-cols-2 gap-2 p-2.5 rounded-2xl bg-slate-950/80 border border-white/10 text-xs font-mono shadow-inner">
        <div class="flex flex-col gap-0.5">
          <span class="text-[9px] text-slate-400 font-semibold">CANCER ABLATION</span>
          <span id="tel-lysis-val" class="text-rose-400 font-bold tabular-nums">
            ${telemetry.cancerLysisPercent.toFixed(1)}% <span class="text-[9px] text-rose-400/80 font-normal">(${(telemetry.cancerStrain * 100).toFixed(1)}%)</span>
          </span>
        </div>
        <div class="flex flex-col gap-0.5">
          <span class="text-[9px] text-slate-400 font-semibold">HEALTHY TISSUE</span>
          <span id="tel-healthy-val" class="text-emerald-400 font-bold tabular-nums">${telemetry.healthyPreservedPercent.toFixed(1)}%</span>
        </div>
        <div class="flex flex-col gap-0.5">
          <span class="text-[9px] text-slate-400 font-semibold">NET PRESSURE</span>
          <span id="tel-pressure-val" class="text-slate-200 font-bold tabular-nums">${telemetry.netPressurePa.toFixed(2)} Pa</span>
        </div>
        <div class="flex flex-col gap-0.5">
          <span class="text-[9px] text-slate-400 font-semibold">WAVE CANCELLATION</span>
          <span id="tel-cancel-val" class="text-cyan-400 font-bold tabular-nums">${telemetry.cancellationEfficiencyPercent.toFixed(1)}% Silenced</span>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  private getHeroButtonHtml(): string {
    switch (this.currentExperiment) {
      case 'phase-cancel':
        return `
          <button id="btn-hero-phase-cancel" class="w-full py-2 px-3 rounded-xl text-xs font-bold ${
            this.isAntiPhaseActive
              ? 'bg-rose-500 text-slate-950 shadow-lg shadow-rose-500/40 ring-1 ring-rose-400/50'
              : 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/30 hover:bg-cyan-400'
          } transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2">
            <span class="w-2 h-2 rounded-full ${this.isAntiPhaseActive ? 'bg-slate-950 animate-ping' : 'bg-slate-950'}"></span>
            <span>${this.isAntiPhaseActive ? 'Cancel Wave Active (180°)' : 'Silence Sound (Anti-Phase)'}</span>
          </button>
        `;
      case 'oncotripsy':
        return `
          <button id="btn-hero-oncotripsy" class="w-full py-2 px-3 rounded-xl text-xs font-bold bg-rose-500 text-slate-950 shadow-lg shadow-rose-500/30 hover:bg-rose-400 transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2">
            <svg class="w-3.5 h-3.5 fill-current shrink-0" viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
            <span>Trigger Oncotripsy Burst</span>
          </button>
        `;
      case 'histotripsy':
        return `
          <button id="btn-hero-histotripsy" class="w-full py-2 px-3 rounded-xl text-xs font-bold bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/30 hover:bg-amber-400 transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2">
            <svg class="w-3.5 h-3.5 fill-current shrink-0" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>
            <span>Trigger Shockwave Cavitation</span>
          </button>
        `;
      case 'time-reversal':
        return `
          <button id="btn-hero-time-reversal" class="w-full py-2 px-3 rounded-xl text-xs font-bold bg-purple-500 text-slate-950 shadow-lg shadow-purple-500/30 hover:bg-purple-400 transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2">
            <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
            <span>Focus Wave Conjugation</span>
          </button>
        `;
      default:
        return `
          <button id="btn-hero-pulse" class="w-full py-2 px-3 rounded-xl text-xs font-bold bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/30 hover:bg-cyan-400 transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2">
            <span>Execute Acoustic Pulse</span>
          </button>
        `;
    }
  }

  private bindHeroEvent(): void {
    const heroBtn = this.container.querySelector('#btn-hero-phase-cancel, #btn-hero-oncotripsy, #btn-hero-histotripsy, #btn-hero-time-reversal, #btn-hero-pulse');
    heroBtn?.addEventListener('click', () => {
      if (this.currentExperiment === 'phase-cancel') {
        this.isAntiPhaseActive = !this.isAntiPhaseActive;
        this.phaseDeg = this.isAntiPhaseActive ? 180.0 : 0.0;
        this.visualizer.acousticTherapyLab.setAntiPhase(this.isAntiPhaseActive);
        this.visualizer.acousticTherapyLab.setPhaseDegrees(this.phaseDeg);
        this.syncAudioEngine();
        this.render();
      } else if (this.currentExperiment === 'oncotripsy') {
        this.visualizer.acousticTherapyLab.triggerOncotripsyBurst();
      } else if (this.currentExperiment === 'histotripsy') {
        this.visualizer.acousticTherapyLab.triggerHistotripsyBurst();
      } else if (this.currentExperiment === 'time-reversal') {
        this.visualizer.acousticTherapyLab.setExperiment('time-reversal');
      }
    });
  }

  private bindEvents(): void {
    // 0. Export Clinical SOP Protocol
    this.container.querySelector('#btn-export-clinical-sop')?.addEventListener('click', () => {
      ClinicalProtocolExporter.downloadClinicalProtocol(
        this.currentTumorId,
        this.currentExperiment,
        this.frequencyHz,
        this.phaseDeg,
        this.acousticPower,
        this.isHeterodyneActive,
        this.isAntiPhaseActive
      );
    });

    // 1. View Mode Buttons
    this.container.querySelector('#view-single-pair')?.addEventListener('click', () => {
      this.viewMode = 'co-culture-pair';
      this.visualizer.acousticTherapyLab.setViewMode('co-culture-pair');
      this.render();
    });

    this.container.querySelector('#view-spheroid')?.addEventListener('click', () => {
      this.viewMode = 'spheroid-cluster';
      this.visualizer.acousticTherapyLab.setViewMode('spheroid-cluster');
      this.render();
    });

    // 2. Tumor Selection Buttons
    this.container.querySelectorAll<HTMLButtonElement>('.btn-tumor-profile').forEach(btn => {
      btn.addEventListener('click', () => {
        const tumorId = btn.getAttribute('data-tumor-id');
        if (tumorId) {
          this.currentTumorId = tumorId;
          const tumor = OncotripsyPhysics.CLINICAL_PROFILES[tumorId];
          this.frequencyHz = tumor.resonantFreqHz;
          this.visualizer.acousticTherapyLab.setTumorProfile(tumorId);
          this.visualizer.acousticTherapyLab.setFrequency(this.frequencyHz);
          this.syncAudioEngine();
          this.render();
        }
      });
    });

    // 3. Modality Experiment Tabs
    this.container.querySelectorAll<HTMLButtonElement>('.tab-exp-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        const exp = (e.currentTarget as HTMLElement).getAttribute('data-experiment') as TherapyExperiment;
        if (exp) {
          this.currentExperiment = exp;
          this.visualizer.acousticTherapyLab.setExperiment(exp);
          this.syncAudioEngine();
          this.render();
        }
      });
    });

    // 4. Hero Action Button
    this.bindHeroEvent();

    // 5. Frequency Slider & Lock Button
    const freqSlider = this.container.querySelector<HTMLInputElement>('#ctrl-freq-slider');
    const freqVal = this.container.querySelector<HTMLElement>('#ctrl-freq-val');

    freqSlider?.addEventListener('input', e => {
      const val = parseFloat((e.target as HTMLInputElement).value);
      this.frequencyHz = val;
      if (freqVal) freqVal.textContent = `${val.toFixed(1)} Hz`;
      const pct = Math.min(100, Math.max(0, Math.round(((val - 20) / 480) * 100)));
      freqSlider.style.background = `linear-gradient(to right, #38bdf8 ${pct}%, rgba(255, 255, 255, 0.1) ${pct}%)`;
      this.visualizer.acousticTherapyLab.setFrequency(val);
      this.syncAudioEngine();
      this.updateTelemetry();
    });

    this.container.querySelector('#btn-lock-cancer-freq')?.addEventListener('click', () => {
      const tumor =
        OncotripsyPhysics.CLINICAL_PROFILES[this.currentTumorId] || OncotripsyPhysics.CLINICAL_PROFILES['mda-mb-231'];
      this.frequencyHz = tumor.resonantFreqHz;
      if (freqSlider) freqSlider.value = String(tumor.resonantFreqHz);
      if (freqVal) freqVal.textContent = `${tumor.resonantFreqHz.toFixed(1)} Hz`;
      this.visualizer.acousticTherapyLab.setFrequency(tumor.resonantFreqHz);
      this.syncAudioEngine();
      this.updateTelemetry();
    });

    // 6. Phase Slider & 180° Button
    const phaseSlider = this.container.querySelector<HTMLInputElement>('#ctrl-phase-slider');
    const phaseVal = this.container.querySelector<HTMLElement>('#ctrl-phase-val');

    phaseSlider?.addEventListener('input', e => {
      const val = parseFloat((e.target as HTMLInputElement).value);
      this.phaseDeg = val;
      if (phaseVal) phaseVal.textContent = `${val.toFixed(0)}°`;
      const pct = Math.min(100, Math.max(0, Math.round((val / 360) * 100)));
      phaseSlider.style.background = `linear-gradient(to right, #38bdf8 ${pct}%, rgba(255, 255, 255, 0.1) ${pct}%)`;
      this.visualizer.acousticTherapyLab.setPhaseDegrees(val);
      this.syncAudioEngine();
      this.updateTelemetry();
    });

    this.container.querySelector('#btn-set-180')?.addEventListener('click', () => {
      this.phaseDeg = 180.0;
      if (phaseSlider) phaseSlider.value = '180';
      if (phaseVal) phaseVal.textContent = '180°';
      this.visualizer.acousticTherapyLab.setPhaseDegrees(180.0);
      this.syncAudioEngine();
      this.updateTelemetry();
    });

    // 7. Power Slider & Heterodyne Toggle
    const powerSlider = this.container.querySelector<HTMLInputElement>('#ctrl-power-slider');
    const powerVal = this.container.querySelector<HTMLElement>('#ctrl-power-val');

    powerSlider?.addEventListener('input', e => {
      const val = parseFloat((e.target as HTMLInputElement).value);
      this.acousticPower = val;
      if (powerVal) powerVal.textContent = `${val.toFixed(2)}x`;
      const pct = Math.min(100, Math.max(0, Math.round(((val - 0.1) / 2.9) * 100)));
      powerSlider.style.background = `linear-gradient(to right, #38bdf8 ${pct}%, rgba(255, 255, 255, 0.1) ${pct}%)`;
      this.visualizer.acousticTherapyLab.setAcousticPower(val);
      this.syncAudioEngine();
      this.updateTelemetry();
    });

    const heterodyneBtn = this.container.querySelector<HTMLButtonElement>('#btn-toggle-heterodyne');
    heterodyneBtn?.addEventListener('click', () => {
      this.isHeterodyneActive = !this.isHeterodyneActive;
      this.visualizer.acousticTherapyLab.setHeterodyne(this.isHeterodyneActive);
      this.syncAudioEngine();
      this.render();
    });
  }

  private syncAudioEngine(): void {
    this.audioEngine.setTherapyAudioState(
      this.frequencyHz,
      this.phaseDeg,
      this.acousticPower,
      this.isAntiPhaseActive,
      this.isHeterodyneActive
    );
  }

  private updateTelemetry(): void {
    const tel = this.visualizer.acousticTherapyLab.getTelemetry();
    const telLysis = this.container.querySelector<HTMLElement>('#tel-lysis-val');
    const telHealthy = this.container.querySelector<HTMLElement>('#tel-healthy-val');
    const telPressure = this.container.querySelector<HTMLElement>('#tel-pressure-val');
    const telCancel = this.container.querySelector<HTMLElement>('#tel-cancel-val');

    if (telLysis)
      telLysis.innerHTML = `${tel.cancerLysisPercent.toFixed(1)}% <span class="text-[9px] text-rose-400/80 font-normal">(${(tel.cancerStrain * 100).toFixed(1)}%)</span>`;
    if (telHealthy)
      telHealthy.textContent = `${tel.healthyPreservedPercent.toFixed(1)}%`;
    if (telPressure) telPressure.textContent = `${tel.netPressurePa.toFixed(2)} Pa`;
    if (telCancel) telCancel.textContent = `${tel.cancellationEfficiencyPercent.toFixed(1)}% Silenced`;
  }

  public destroy(): void {
    // Teardown any pending timeouts or animation cycles
  }
}
