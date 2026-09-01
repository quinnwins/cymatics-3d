/**
 * TherapyLabControls.ts
 * SoundForm 3D - Frontier Control Deck for "Can We Cure Cancer with Frequency?"
 *
 * Capabilities:
 * - 7 Specialized Experiment Tabs (Phase Cancel, Oncotripsy, Time-Reversal, Vortex OAM, Sonodynamic SDT, PIEZO1 Ca2+, Immune Swarm).
 * - Real-Time Web Audio Destructive Phase Cancellation.
 * - Holland/Caltech 11th-Harmonic Heterodyne Fatigue Modulation.
 * - Clinical AFM Human Cancer Selector (Glioblastoma, Pancreatic, Breast, Osteosarcoma).
 * - Dual View: 🔬 Single Co-Culture Pair vs 🧫 3D Multicellular Spheroid Cluster.
 */

import * as THREE from 'three';
import { AudioEngine } from '../audio/AudioEngine';
import { VisualizerEngine } from '../visualizer/VisualizerEngine';
import { TherapyExperiment } from '../visualizer/AcousticTherapyLab';
import { OncotripsyPhysics } from '../math/OncotripsyPhysics';

export class TherapyLabControls {
  public container: HTMLElement;
  private audioEngine: AudioEngine;
  private visualizer: VisualizerEngine;

  private currentExperiment: TherapyExperiment = 'phase-cancel';
  private currentTumorId = 'mda-mb-231';
  private frequencyHz = 118.0;
  private phaseDeg = 180.0;
  private acousticPower = 1.0;
  private isAntiPhaseActive = false;
  private isHeterodyneActive = false;
  private viewMode: 'co-culture-pair' | 'spheroid-cluster' = 'co-culture-pair';
  private vortexCharge: 1 | 2 | 3 = 1;

  constructor(audioEngine: AudioEngine, visualizer: VisualizerEngine) {
    this.audioEngine = audioEngine;
    this.visualizer = visualizer;

    this.container = document.createElement('div');
    this.container.id = 'therapy-lab-controls';
    this.container.className =
      'w-full max-w-5xl mx-auto bg-slate-900/90 backdrop-blur-xl border border-slate-700/60 rounded-2xl p-3.5 md:p-4 shadow-2xl transition-all duration-300 flex flex-col gap-3';

    this.render();
  }

  private render(): void {
    const telemetry = this.visualizer.acousticTherapyLab.getTelemetry();
    const profiles = Object.values(OncotripsyPhysics.CLINICAL_PROFILES);

    this.container.innerHTML = `
      <!-- Top Title & Experiment Switcher -->
      <div class="flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-800 pb-2">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-xl bg-gradient-to-tr from-rose-500 via-amber-500 to-cyan-500 flex items-center justify-center text-base shadow-lg shadow-rose-500/20">
            🎯
          </div>
          <div>
            <h3 class="text-xs md:text-sm font-semibold text-slate-100 flex items-center gap-2">
              Can We Cure Cancer with Frequency?
              <span class="px-2 py-0.5 rounded-full text-[9px] font-mono bg-rose-500/10 text-rose-400 border border-rose-500/20">
                Frontier Oncology Lab
              </span>
            </h3>
            <p class="text-[11px] text-slate-400">
              Active cancellation, selective oncotripsy, vortex OAM, and acousto-immunotherapy
            </p>
          </div>
        </div>

        <div class="flex items-center gap-1.5">
          <!-- View Toggle -->
          <div class="bg-slate-800/80 p-0.5 rounded-xl border border-slate-700/50 flex items-center gap-1 text-[11px]">
            <button id="view-single-pair" class="px-2 py-1 rounded-lg transition-all ${
              this.viewMode === 'co-culture-pair'
                ? 'bg-cyan-500 text-slate-950 font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }">
              🔬 Single Pair
            </button>
            <button id="view-spheroid" class="px-2 py-1 rounded-lg transition-all ${
              this.viewMode === 'spheroid-cluster'
                ? 'bg-cyan-500 text-slate-950 font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }">
              🧫 3D Spheroid
            </button>
          </div>

          <!-- Dynamic Hero Action Button -->
          ${this.getHeroButtonHtml()}
        </div>
      </div>

      <!-- 7 Frontier Experiment Mode Tabs Carousel -->
      <div class="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        <button id="tab-phase-cancel" class="px-2.5 py-1 rounded-lg transition-all whitespace-nowrap ${
          this.currentExperiment === 'phase-cancel'
            ? 'bg-cyan-500 text-slate-950 font-semibold shadow-sm'
            : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 border border-slate-700/40'
        }">
          🎧 Phase Cancel
        </button>
        <button id="tab-oncotripsy" class="px-2.5 py-1 rounded-lg transition-all whitespace-nowrap ${
          this.currentExperiment === 'oncotripsy'
            ? 'bg-cyan-500 text-slate-950 font-semibold shadow-sm'
            : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 border border-slate-700/40'
        }">
          💥 Oncotripsy Lysis
        </button>
        <button id="tab-time-reversal" class="px-2.5 py-1 rounded-lg transition-all whitespace-nowrap ${
          this.currentExperiment === 'time-reversal'
            ? 'bg-cyan-500 text-slate-950 font-semibold shadow-sm'
            : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 border border-slate-700/40'
        }">
          🌊 Time-Reversal
        </button>
        <button id="tab-vortex-torsion" class="px-2.5 py-1 rounded-lg transition-all whitespace-nowrap ${
          this.currentExperiment === 'vortex-torsion'
            ? 'bg-cyan-500 text-slate-950 font-semibold shadow-sm'
            : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 border border-slate-700/40'
        }">
          🌪️ Vortex OAM
        </button>
        <button id="tab-sonodynamic-sdt" class="px-2.5 py-1 rounded-lg transition-all whitespace-nowrap ${
          this.currentExperiment === 'sonodynamic-sdt'
            ? 'bg-cyan-500 text-slate-950 font-semibold shadow-sm'
            : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 border border-slate-700/40'
        }">
          💡 Sonodynamic SDT
        </button>
        <button id="tab-calcium-piezo1" class="px-2.5 py-1 rounded-lg transition-all whitespace-nowrap ${
          this.currentExperiment === 'calcium-piezo1'
            ? 'bg-cyan-500 text-slate-950 font-semibold shadow-sm'
            : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 border border-slate-700/40'
        }">
          ⚡ PIEZO1 Ca²⁺ Flux
        </button>
        <button id="tab-immune-swarm" class="px-2.5 py-1 rounded-lg transition-all whitespace-nowrap ${
          this.currentExperiment === 'immune-swarm'
            ? 'bg-cyan-500 text-slate-950 font-semibold shadow-sm'
            : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 border border-slate-700/40'
        }">
          🛡️ Immune T-Cell Swarm
        </button>
      </div>

      <!-- Clinical AFM Tumor Profile Selector Carousel -->
      <div class="flex items-center gap-2 overflow-x-auto pb-0.5 text-xs">
        <span class="text-[10px] font-medium text-slate-400 whitespace-nowrap">🧬 Clinical Tumor:</span>
        <div class="flex items-center gap-1.5">
          ${profiles
            .map(
              p => `
            <button data-tumor-id="${p.id}" class="btn-tumor-profile px-2.5 py-1 rounded-lg border transition-all flex items-center gap-1.5 whitespace-nowrap ${
                this.currentTumorId === p.id
                  ? 'bg-rose-500/20 border-rose-500/60 text-rose-200 font-semibold shadow-sm shadow-rose-500/20'
                  : 'bg-slate-800/60 border-slate-700/50 text-slate-400 hover:text-slate-200 hover:border-slate-600'
              }">
              <span class="w-2 h-2 rounded-full" style="background-color: #${p.colorHex.toString(16).padStart(6, '0')}"></span>
              <span>${p.name}</span>
              <span class="text-[10px] font-mono text-slate-400">(${p.resonantFreqHz} Hz, ${p.youngsModulusKPa} kPa)</span>
            </button>
          `
            )
            .join('')}
        </div>
      </div>

      <!-- Live Biophysics & Telemetry HUD -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 p-2 rounded-xl bg-slate-950/70 border border-slate-800 text-[11px] font-mono">
        <div class="flex flex-col gap-0.5">
          <span class="text-[9px] text-slate-500">TUMOR CELL DISRUPTION</span>
          <span id="tel-lysis-val" class="text-rose-400 font-bold">${telemetry.cancerLysisPercent.toFixed(1)}% (Strain ε: ${(telemetry.cancerStrain * 100).toFixed(1)}%)</span>
        </div>
        <div class="flex flex-col gap-0.5">
          <span class="text-[9px] text-slate-500">HEALTHY STROMA PRESERVED</span>
          <span id="tel-healthy-val" class="text-emerald-400 font-bold">${telemetry.healthyPreservedPercent.toFixed(1)}% Safe (ε: ${(telemetry.healthyStrain * 100).toFixed(2)}%)</span>
        </div>
        <div class="flex flex-col gap-0.5">
          <span class="text-[9px] text-slate-500">NET ACOUSTIC PRESSURE</span>
          <span id="tel-pressure-val" class="text-cyan-400 font-bold">${telemetry.netPressurePa.toFixed(2)} Pa</span>
        </div>
        <div class="flex flex-col gap-0.5">
          <span class="text-[9px] text-slate-500">WAVE CANCELLATION EFFICIENCY</span>
          <span class="text-amber-400 font-bold">${telemetry.cancellationEfficiencyPercent.toFixed(1)}% Nulled</span>
        </div>
      </div>

      <!-- Interactive Controls Section -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-2.5 bg-slate-800/40 rounded-xl p-2.5 border border-slate-700/40">
        <!-- Frequency Sweeper & Auto-Lock -->
        <div class="flex flex-col gap-1.5">
          <div class="flex items-center justify-between text-xs">
            <span class="font-medium text-slate-300 flex items-center gap-1.5">
              <span>🔊 Frequency</span>
              <button id="btn-lock-cancer-freq" class="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 text-[10px] font-mono border border-rose-500/30 transition-all">
                🎯 Auto-Lock Res
              </button>
            </span>
            <span id="ctrl-freq-val" class="font-mono text-cyan-400 font-semibold">${this.frequencyHz.toFixed(1)} Hz</span>
          </div>
          <input 
            id="ctrl-freq-slider" 
            type="range" 
            min="40" 
            max="400" 
            step="1" 
            value="${this.frequencyHz}"
            class="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />
          <div class="flex justify-between text-[10px] text-slate-500 font-mono">
            <span>40 Hz (Sub)</span>
            <span>Resonance: ${this.frequencyHz} Hz</span>
            <span>400 Hz</span>
          </div>
        </div>

        <!-- Phase Offset Angle / Vortex Topological Charge -->
        <div class="flex flex-col gap-1.5">
          ${
            this.currentExperiment === 'vortex-torsion'
              ? `<div class="flex items-center justify-between text-xs">
                  <span class="font-medium text-slate-300">🌪️ Vortex Topological Charge (ℓ)</span>
                  <span class="font-mono text-cyan-400 font-semibold">ℓ = ${this.vortexCharge}</span>
                 </div>
                 <div class="flex items-center gap-1.5 mt-1">
                  <button data-charge="1" class="btn-charge flex-1 py-1.5 rounded-lg border text-xs font-mono transition-all ${
                    this.vortexCharge === 1
                      ? 'bg-cyan-500 text-slate-950 font-bold border-cyan-400'
                      : 'bg-slate-700/60 text-slate-300 border-slate-600'
                  }">ℓ = 1 (Single Helix)</button>
                  <button data-charge="2" class="btn-charge flex-1 py-1.5 rounded-lg border text-xs font-mono transition-all ${
                    this.vortexCharge === 2
                      ? 'bg-cyan-500 text-slate-950 font-bold border-cyan-400'
                      : 'bg-slate-700/60 text-slate-300 border-slate-600'
                  }">ℓ = 2 (Double)</button>
                  <button data-charge="3" class="btn-charge flex-1 py-1.5 rounded-lg border text-xs font-mono transition-all ${
                    this.vortexCharge === 3
                      ? 'bg-cyan-500 text-slate-950 font-bold border-cyan-400'
                      : 'bg-slate-700/60 text-slate-300 border-slate-600'
                  }">ℓ = 3 (Triple)</button>
                 </div>
                 <div class="text-[10px] text-slate-500 font-mono">Rotational torque: τ = (ℓ/ω)·Frad</div>`
              : `<div class="flex items-center justify-between text-xs">
                  <span class="font-medium text-slate-300 flex items-center gap-1.5">
                    <span>🔄 Phase Shift (Δφ)</span>
                    <button id="btn-set-180" class="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 text-[10px] font-mono border border-emerald-500/30 transition-all">
                      🛡️ 180° Anti-Phase
                    </button>
                  </span>
                  <span id="ctrl-phase-val" class="font-mono text-emerald-400 font-semibold">${this.phaseDeg.toFixed(0)}°</span>
                </div>
                <input 
                  id="ctrl-phase-slider" 
                  type="range" 
                  min="0" 
                  max="360" 
                  step="1" 
                  value="${this.phaseDeg}"
                  class="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                />
                <div class="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>0° (Constructive)</span>
                  <span>180° (True Silence)</span>
                  <span>360°</span>
                </div>`
          }
        </div>

        <!-- Acoustic Power & Heterodyne Toggle -->
        <div class="flex flex-col gap-1.5">
          <div class="flex items-center justify-between text-xs">
            <span class="font-medium text-slate-300 flex items-center gap-1.5">
              <span>⚡ Power</span>
              <button id="btn-toggle-heterodyne" class="px-2 py-0.5 rounded ${
                this.isHeterodyneActive
                  ? 'bg-amber-500 text-slate-950 font-semibold shadow-sm'
                  : 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/30'
              } text-[10px] font-mono transition-all">
                ⚡ 11th Beat ${this.isHeterodyneActive ? 'ON' : 'OFF'}
              </button>
            </span>
            <span id="ctrl-power-val" class="font-mono text-amber-400 font-semibold">${this.acousticPower.toFixed(2)}x</span>
          </div>
          <input 
            id="ctrl-power-slider" 
            type="range" 
            min="0.1" 
            max="3.0" 
            step="0.05" 
            value="${this.acousticPower}"
            class="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-400"
          />
          <div class="flex justify-between text-[10px] text-slate-500 font-mono">
            <span>0.1x (Safe)</span>
            <span>1.0x (Resonant)</span>
            <span>3.0x (Lytic Rupture)</span>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
    this.syncAudioEngine();
  }

  private getHeroButtonHtml(): string {
    if (this.currentExperiment === 'oncotripsy') {
      return `<button id="btn-fire-oncotripsy" class="px-3 py-1.5 rounded-xl font-medium text-xs bg-gradient-to-r from-rose-500 to-amber-500 text-white shadow-lg shadow-rose-500/25 hover:brightness-110 active:scale-95 transition-all flex items-center gap-1.5">
                <span>💥</span>
                <span>Fire Oncotripsy</span>
              </button>`;
    }
    if (this.currentExperiment === 'sonodynamic-sdt') {
      return `<button id="btn-trigger-sdt" class="px-3 py-1.5 rounded-xl font-medium text-xs bg-gradient-to-r from-blue-500 to-violet-500 text-white shadow-lg shadow-blue-500/25 hover:brightness-110 active:scale-95 transition-all flex items-center gap-1.5">
                <span>💡</span>
                <span>Trigger Cavitation Flash</span>
              </button>`;
    }
    if (this.currentExperiment === 'calcium-piezo1') {
      return `<button id="btn-trigger-calcium" class="px-3 py-1.5 rounded-xl font-medium text-xs bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 font-semibold shadow-lg shadow-emerald-500/25 hover:brightness-110 active:scale-95 transition-all flex items-center gap-1.5">
                <span>⚡</span>
                <span>Inject Ca²⁺ Influx</span>
              </button>`;
    }
    if (this.currentExperiment === 'immune-swarm') {
      return `<button id="btn-deploy-tcells" class="px-3 py-1.5 rounded-xl font-medium text-xs bg-gradient-to-r from-cyan-400 to-blue-600 text-slate-950 font-semibold shadow-lg shadow-cyan-500/25 hover:brightness-110 active:scale-95 transition-all flex items-center gap-1.5">
                <span>⚔️</span>
                <span>Deploy T-Cell Swarm</span>
              </button>`;
    }
    return `<button id="btn-toggle-antiphase" class="px-3 py-1.5 rounded-xl font-medium text-xs ${
      this.isAntiPhaseActive
        ? 'bg-emerald-500 text-slate-950 font-semibold shadow-lg shadow-emerald-500/30'
        : 'bg-gradient-to-r from-cyan-500 to-emerald-500 text-slate-950 font-semibold shadow-lg shadow-cyan-500/25 hover:brightness-110 active:scale-95'
    } transition-all flex items-center gap-1.5">
      <span>🛡️</span>
      <span>${this.isAntiPhaseActive ? 'Anti-Phase Active' : '180° Anti-Phase'}</span>
    </button>`;
  }

  private bindEvents(): void {
    // 1. Clinical Tumor Profile Buttons
    this.container.querySelectorAll('.btn-tumor-profile').forEach(btn => {
      btn.addEventListener('click', e => {
        const tumorId = (e.currentTarget as HTMLElement).getAttribute('data-tumor-id');
        if (tumorId && OncotripsyPhysics.CLINICAL_PROFILES[tumorId]) {
          this.currentTumorId = tumorId;
          const tumor = OncotripsyPhysics.CLINICAL_PROFILES[tumorId];
          this.frequencyHz = tumor.resonantFreqHz;
          this.visualizer.acousticTherapyLab.setTumorProfile(tumorId);
          this.render();
        }
      });
    });

    // 2. View Switcher
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

    // 3. Experiment Tabs
    const tabs: Record<string, TherapyExperiment> = {
      '#tab-phase-cancel': 'phase-cancel',
      '#tab-oncotripsy': 'oncotripsy',
      '#tab-time-reversal': 'time-reversal',
      '#tab-vortex-torsion': 'vortex-torsion',
      '#tab-sonodynamic-sdt': 'sonodynamic-sdt',
      '#tab-calcium-piezo1': 'calcium-piezo1',
      '#tab-immune-swarm': 'immune-swarm',
    };

    for (const [selector, exp] of Object.entries(tabs)) {
      this.container.querySelector(selector)?.addEventListener('click', () => {
        this.currentExperiment = exp;
        this.visualizer.acousticTherapyLab.setExperiment(exp);
        this.render();
      });
    }

    // 4. Hero Action Buttons
    this.container.querySelector('#btn-fire-oncotripsy')?.addEventListener('click', () => {
      this.visualizer.acousticTherapyLab.triggerOncotripsyBurst();
      this.syncAudioEngine();
    });

    this.container.querySelector('#btn-trigger-sdt')?.addEventListener('click', () => {
      this.visualizer.acousticTherapyLab.triggerSonodynamicFlash();
    });

    this.container.querySelector('#btn-trigger-calcium')?.addEventListener('click', () => {
      this.visualizer.acousticTherapyLab.triggerPiezo1CalciumWave();
    });

    this.container.querySelector('#btn-deploy-tcells')?.addEventListener('click', () => {
      this.visualizer.acousticTherapyLab.tCellSwarm.setDampSources([
        this.viewMode === 'spheroid-cluster' ? new THREE.Vector3(0, 0.4, 0) : new THREE.Vector3(-1.8, 0.4, 0),
      ]);
    });

    this.container.querySelector('#btn-toggle-antiphase')?.addEventListener('click', () => {
      this.isAntiPhaseActive = !this.isAntiPhaseActive;
      this.visualizer.acousticTherapyLab.setAntiPhase(this.isAntiPhaseActive);
      this.render();
    });

    this.container.querySelector('#btn-toggle-heterodyne')?.addEventListener('click', () => {
      this.isHeterodyneActive = !this.isHeterodyneActive;
      this.visualizer.acousticTherapyLab.setHeterodyne(this.isHeterodyneActive);
      this.render();
    });

    // 5. Vortex Charge Buttons
    this.container.querySelectorAll('.btn-charge').forEach(btn => {
      btn.addEventListener('click', e => {
        const ch = parseInt((e.currentTarget as HTMLElement).getAttribute('data-charge') || '1', 10) as 1 | 2 | 3;
        this.vortexCharge = ch;
        this.visualizer.acousticTherapyLab.setVortexTopologicalCharge(ch);
        this.render();
      });
    });

    // 6. Frequency Slider & Lock Button
    const freqSlider = this.container.querySelector<HTMLInputElement>('#ctrl-freq-slider')!;
    const freqVal = this.container.querySelector<HTMLElement>('#ctrl-freq-val')!;

    freqSlider?.addEventListener('input', e => {
      const val = parseFloat((e.target as HTMLInputElement).value);
      this.frequencyHz = val;
      freqVal.textContent = `${val.toFixed(1)} Hz`;
      this.visualizer.acousticTherapyLab.setFrequency(val);
      this.syncAudioEngine();
      this.updateTelemetry();
    });

    this.container.querySelector('#btn-lock-cancer-freq')?.addEventListener('click', () => {
      const tumor =
        OncotripsyPhysics.CLINICAL_PROFILES[this.currentTumorId] || OncotripsyPhysics.CLINICAL_PROFILES['mda-mb-231'];
      this.frequencyHz = tumor.resonantFreqHz;
      freqSlider.value = String(tumor.resonantFreqHz);
      freqVal.textContent = `${tumor.resonantFreqHz.toFixed(1)} Hz`;
      this.visualizer.acousticTherapyLab.setFrequency(tumor.resonantFreqHz);
      this.syncAudioEngine();
      this.updateTelemetry();
    });

    // 7. Phase Slider & 180° Button
    const phaseSlider = this.container.querySelector<HTMLInputElement>('#ctrl-phase-slider');
    const phaseVal = this.container.querySelector<HTMLElement>('#ctrl-phase-val');

    phaseSlider?.addEventListener('input', e => {
      const val = parseFloat((e.target as HTMLInputElement).value);
      this.phaseDeg = val;
      if (phaseVal) phaseVal.textContent = `${val.toFixed(0)}°`;
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

    // 8. Power Slider
    const powerSlider = this.container.querySelector<HTMLInputElement>('#ctrl-power-slider')!;
    const powerVal = this.container.querySelector<HTMLElement>('#ctrl-power-val')!;

    powerSlider?.addEventListener('input', e => {
      const val = parseFloat((e.target as HTMLInputElement).value);
      this.acousticPower = val;
      powerVal.textContent = `${val.toFixed(2)}x`;
      this.visualizer.acousticTherapyLab.setAcousticPower(val);
      this.syncAudioEngine();
      this.updateTelemetry();
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

    if (telLysis)
      telLysis.textContent = `${tel.cancerLysisPercent.toFixed(1)}% (Strain ε: ${(tel.cancerStrain * 100).toFixed(1)}%)`;
    if (telHealthy)
      telHealthy.textContent = `${tel.healthyPreservedPercent.toFixed(1)}% Safe (ε: ${(tel.healthyStrain * 100).toFixed(2)}%)`;
    if (telPressure) telPressure.textContent = `${tel.netPressurePa.toFixed(2)} Pa`;
  }
}
