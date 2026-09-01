/**
 * TherapyLabControls.ts
 * SoundForm 3D - Frontier Control Deck for "Can We Cure Cancer with Frequency?"
 *
 * Capabilities:
 * - 7 Specialized Experiment Tabs (Phase Cancel, Oncotripsy, Time-Reversal, Vortex OAM, Sonodynamic SDT, PIEZO1 Ca2+, Immune Swarm).
 * - Real-Time Web Audio Destructive Phase Cancellation.
 * - Holland/Caltech 11th-Harmonic Heterodyne Fatigue Modulation.
 * - Clinical AFM Human Cancer Selector (Glioblastoma, Pancreatic, Breast, Osteosarcoma).
 * - Dual View: Single Co-Culture Pair vs 3D Multicellular Spheroid Cluster.
 */

import * as THREE from 'three';
import { AudioEngine } from '../audio/AudioEngine';
import { VisualizerEngine } from '../visualizer/VisualizerEngine';
import { TherapyExperiment } from '../visualizer/AcousticTherapyLab';
import { OncotripsyPhysics } from '../math/OncotripsyPhysics';
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

  private preventEventBleeding(): void {
    this.container.addEventListener('wheel', e => e.stopPropagation(), { passive: false });
    this.container.addEventListener('pointerdown', e => e.stopPropagation());
  }

  private render(): void {
    const telemetry = this.visualizer.acousticTherapyLab.getTelemetry();
    const profiles = Object.values(OncotripsyPhysics.CLINICAL_PROFILES);

    this.container.innerHTML = `
      <!-- Biophysics Studio Hub Switcher -->
      <div class="glass-panel p-1 rounded-2xl flex items-center gap-1 bg-slate-900/60 border border-white/10 text-xs">
        <button id="hub-btn-bio" class="flex-1 py-1 px-1.5 rounded-xl font-semibold text-center transition-all cursor-pointer text-gray-400 hover:text-white hover:bg-white/5">
          Cell Mechanics
        </button>
        <button id="hub-btn-therapy" class="flex-1 py-1 px-1.5 rounded-xl font-bold text-center transition-all cursor-pointer glass-btn-active text-rose-300 shadow-sm ring-1 ring-rose-500/30">
          Cancer Lab
        </button>
        <button id="hub-btn-nobel" class="flex-1 py-1 px-1.5 rounded-xl font-semibold text-center transition-all cursor-pointer text-gray-400 hover:text-white hover:bg-white/5">
          Nobel Lab
        </button>
      </div>

      <!-- Top Title & Controls Header -->
      <div class="flex flex-col gap-2 border-b border-white/10 pb-2.5">
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-2 min-w-0">
            <div class="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-rose-400 font-mono text-xs font-bold shrink-0 shadow-sm">
              LAB
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-1.5 flex-wrap">
                <h3 class="text-xs sm:text-sm font-bold text-white whitespace-nowrap">
                  Targeted Ultrasound
                </h3>
                <span class="px-1.5 py-0.5 rounded-full text-[9px] font-mono bg-rose-500/10 text-rose-300 border border-rose-500/30 whitespace-nowrap">
                  Therapy
                </span>
              </div>
              <p class="text-[10px] text-gray-400 font-medium truncate">
                Resonance frequencies & wave cancel
              </p>
            </div>
          </div>

          <!-- Dynamic Hero Action Button Container -->
          <div id="hero-action-container" class="shrink-0">
            ${this.getHeroButtonHtml()}
          </div>
        </div>

        <!-- View Toggle -->
        <div class="glass-panel p-1 rounded-2xl flex items-center gap-1 bg-slate-900/60 border-white/5 text-xs">
          <button id="view-single-pair" class="flex-1 py-1 px-2 rounded-xl font-semibold transition-all cursor-pointer ${
            this.viewMode === 'co-culture-pair'
              ? 'glass-btn-active font-bold shadow-sm text-cyan-300'
              : 'text-gray-400 hover:text-white'
          }">
            Single Cell Pair
          </button>
          <button id="view-spheroid" class="flex-1 py-1 px-2 rounded-xl font-semibold transition-all cursor-pointer ${
            this.viewMode === 'spheroid-cluster'
              ? 'glass-btn-active font-bold shadow-sm text-cyan-300'
              : 'text-gray-400 hover:text-white'
          }">
            Cell Cluster
          </button>
        </div>
      </div>

      <!-- 7 Experiment Modalities Grid (Clean, fully visible, zero scrollbar) -->
      <div class="flex flex-col gap-1.5">
        <div class="flex items-center justify-between">
          <span class="text-[10px] font-semibold text-slate-300">Therapy Modalities:</span>
          <span class="text-[9px] font-mono text-cyan-400">7 Active Methods</span>
        </div>
        <div class="grid grid-cols-2 gap-1.5" id="experiment-tabs-grid">
          <button data-experiment="phase-cancel" class="tab-exp-btn text-left p-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
            this.currentExperiment === 'phase-cancel'
              ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm ring-1 ring-cyan-400/50 border-cyan-400'
              : 'bg-slate-800/60 text-slate-300 hover:text-white hover:bg-slate-800 border-slate-700/50'
          }">
            <div class="truncate">Wave Cancellation</div>
            <div class="text-[9px] font-mono opacity-70">Anti-Phase 180°</div>
          </button>
          <button data-experiment="oncotripsy" class="tab-exp-btn text-left p-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
            this.currentExperiment === 'oncotripsy'
              ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm ring-1 ring-cyan-400/50 border-cyan-400'
              : 'bg-slate-800/60 text-slate-300 hover:text-white hover:bg-slate-800 border-slate-700/50'
          }">
            <div class="truncate">Resonance Burst</div>
            <div class="text-[9px] font-mono opacity-70">Targeted Lysis</div>
          </button>
          <button data-experiment="time-reversal" class="tab-exp-btn text-left p-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
            this.currentExperiment === 'time-reversal'
              ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm ring-1 ring-cyan-400/50 border-cyan-400'
              : 'bg-slate-800/60 text-slate-300 hover:text-white hover:bg-slate-800 border-slate-700/50'
          }">
            <div class="truncate">Targeted Focus</div>
            <div class="text-[9px] font-mono opacity-70">Phase Conjugate</div>
          </button>
          <button data-experiment="vortex-torsion" class="tab-exp-btn text-left p-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
            this.currentExperiment === 'vortex-torsion'
              ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm ring-1 ring-cyan-400/50 border-cyan-400'
              : 'bg-slate-800/60 text-slate-300 hover:text-white hover:bg-slate-800 border-slate-700/50'
          }">
            <div class="truncate">Acoustic Vortex</div>
            <div class="text-[9px] font-mono opacity-70">Helical OAM</div>
          </button>
          <button data-experiment="sonodynamic-sdt" class="tab-exp-btn text-left p-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
            this.currentExperiment === 'sonodynamic-sdt'
              ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm ring-1 ring-cyan-400/50 border-cyan-400'
              : 'bg-slate-800/60 text-slate-300 hover:text-white hover:bg-slate-800 border-slate-700/50'
          }">
            <div class="truncate">Micro-Bubbles</div>
            <div class="text-[9px] font-mono opacity-70">Cavitation Flash</div>
          </button>
          <button data-experiment="calcium-piezo1" class="tab-exp-btn text-left p-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
            this.currentExperiment === 'calcium-piezo1'
              ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm ring-1 ring-cyan-400/50 border-cyan-400'
              : 'bg-slate-800/60 text-slate-300 hover:text-white hover:bg-slate-800 border-slate-700/50'
          }">
            <div class="truncate">Cell Ion Channels</div>
            <div class="text-[9px] font-mono opacity-70">PIEZO1 Ca²⁺ Flux</div>
          </button>
          <button data-experiment="immune-swarm" class="tab-exp-btn col-span-2 text-left p-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer flex items-center justify-between ${
            this.currentExperiment === 'immune-swarm'
              ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm ring-1 ring-cyan-400/50 border-cyan-400'
              : 'bg-slate-800/60 text-slate-300 hover:text-white hover:bg-slate-800 border-slate-700/50'
          }">
            <div>
              <div class="truncate">Immune Response</div>
              <div class="text-[9px] font-mono opacity-70">Acousto-Immunotherapy</div>
            </div>
            <span class="px-2 py-0.5 rounded-full text-[9px] font-mono ${
              this.currentExperiment === 'immune-swarm' ? 'bg-slate-900/40 text-slate-950 font-bold' : 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30'
            }">T-Cell Swarm</span>
          </button>
        </div>
      </div>

      <!-- Clinical AFM Tumor Profile Selector -->
      <div class="flex flex-col gap-1.5">
        <div class="flex items-center justify-between">
          <span class="text-[10px] font-semibold text-slate-300">Tumor Target Models:</span>
          <span class="text-[9px] font-mono text-slate-400">Clinical AFM Stiffness</span>
        </div>
        <div class="grid grid-cols-2 gap-1.5">
          ${profiles
            .map(
              p => `
            <button data-tumor-id="${p.id}" class="btn-tumor-profile text-left p-2 rounded-xl border transition-all flex flex-col gap-0.5 cursor-pointer ${
                this.currentTumorId === p.id
                  ? 'bg-rose-500/20 border-rose-500/80 text-rose-200 font-bold shadow-sm ring-1 ring-rose-500/40'
                  : 'bg-slate-800/60 border-slate-700/50 text-slate-300 hover:text-white hover:bg-slate-800 hover:border-slate-600'
              }">
              <div class="flex items-center gap-1.5 min-w-0">
                <span class="w-2 h-2 rounded-full shrink-0" style="background-color: #${p.colorHex.toString(16).padStart(6, '0')}"></span>
                <span class="font-medium text-xs truncate">${p.name.split('(')[0].trim()}</span>
              </div>
              <div class="flex items-center justify-between text-[10px] font-mono text-slate-400 pl-3.5">
                <span>${p.resonantFreqHz} Hz</span>
                <span>${p.youngsModulusKPa} kPa</span>
              </div>
            </button>
          `
            )
            .join('')}
        </div>
      </div>

      <!-- Live Biophysics & Telemetry HUD -->
      <div class="grid grid-cols-2 gap-2 p-2.5 rounded-2xl bg-slate-950/70 border border-slate-800 text-[11px] font-mono">
        <div class="flex flex-col gap-0.5 min-w-0">
          <span class="text-[9px] text-slate-400 uppercase tracking-wider">Tumor Disruption</span>
          <span id="tel-lysis-val" class="text-rose-400 font-bold truncate">${telemetry.cancerLysisPercent.toFixed(1)}% <span class="text-[9px] text-rose-400/80 font-normal">(${(telemetry.cancerStrain * 100).toFixed(1)}%)</span></span>
        </div>
        <div class="flex flex-col gap-0.5 min-w-0">
          <span class="text-[9px] text-slate-400 uppercase tracking-wider">Healthy Tissue Safe</span>
          <span id="tel-healthy-val" class="text-emerald-400 font-bold truncate">${telemetry.healthyPreservedPercent.toFixed(1)}%</span>
        </div>
        <div class="flex flex-col gap-0.5 min-w-0">
          <span class="text-[9px] text-slate-400 uppercase tracking-wider">Sound Pressure</span>
          <span id="tel-pressure-val" class="text-cyan-400 font-bold truncate">${telemetry.netPressurePa.toFixed(2)} Pa</span>
        </div>
        <div class="flex flex-col gap-0.5 min-w-0">
          <span class="text-[9px] text-slate-400 uppercase tracking-wider">Noise Cancellation</span>
          <span id="tel-cancel-val" class="text-amber-400 font-bold truncate">${telemetry.cancellationEfficiencyPercent.toFixed(1)}% Silenced</span>
        </div>
      </div>

      <!-- Interactive Controls Section -->
      <div class="flex flex-col gap-2.5 bg-slate-800/40 rounded-2xl p-2.5 sm:p-3 border border-slate-700/40">
        <!-- Frequency Sweeper & Auto-Lock -->
        <div class="flex flex-col gap-1.5 bg-slate-900/50 p-2.5 rounded-xl border border-white/5">
          <div class="flex items-center justify-between text-xs">
            <div class="flex items-center gap-1.5">
              <span class="font-semibold text-slate-200">Frequency</span>
              <button id="btn-lock-cancer-freq" class="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 text-[10px] font-mono border border-rose-500/30 transition-all cursor-pointer">
                Match Tumor Pitch
              </button>
            </div>
            <span id="ctrl-freq-val" class="font-mono text-cyan-400 font-bold">${this.frequencyHz.toFixed(1)} Hz</span>
          </div>
          <input 
            id="ctrl-freq-slider" 
            type="range" 
            min="40" 
            max="400" 
            step="1" 
            value="${this.frequencyHz}"
            class="w-full cursor-pointer"
          />
          <div class="flex justify-between text-[10px] text-slate-400 font-mono">
            <span>40 Hz (Low)</span>
            <span id="ctrl-freq-resonant-label">Resonant: ${this.frequencyHz.toFixed(0)} Hz</span>
            <span>400 Hz</span>
          </div>
        </div>

        <!-- Dynamic Vortex vs Phase Offset Controls Panel -->
        <div id="dynamic-wave-controls" class="flex flex-col gap-1.5 bg-slate-900/50 p-2.5 rounded-xl border border-white/5">
          <div id="vortex-controls-block" class="${this.currentExperiment === 'vortex-torsion' ? 'flex flex-col gap-1.5' : 'hidden'}">
            <div class="flex items-center justify-between text-xs">
              <span class="font-semibold text-slate-200">Vortex Spiral Intensity</span>
              <span id="ctrl-vortex-val" class="font-mono text-cyan-400 font-bold">Level ${this.vortexCharge}</span>
            </div>
            <div class="grid grid-cols-3 gap-1.5 mt-0.5">
              <button data-charge="1" class="btn-charge py-1.5 rounded-lg border text-xs font-mono transition-all text-center cursor-pointer ${
                this.vortexCharge === 1
                  ? 'bg-cyan-500 text-slate-950 font-bold border-cyan-400 shadow-sm'
                  : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700'
              }">Single</button>
              <button data-charge="2" class="btn-charge py-1.5 rounded-lg border text-xs font-mono transition-all text-center cursor-pointer ${
                this.vortexCharge === 2
                  ? 'bg-cyan-500 text-slate-950 font-bold border-cyan-400 shadow-sm'
                  : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700'
              }">Double</button>
              <button data-charge="3" class="btn-charge py-1.5 rounded-lg border text-xs font-mono transition-all text-center cursor-pointer ${
                this.vortexCharge === 3
                  ? 'bg-cyan-500 text-slate-950 font-bold border-cyan-400 shadow-sm'
                  : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700'
              }">Triple</button>
            </div>
            <div class="text-[10px] text-slate-400 font-mono">Twists sound wave into a rotational beam</div>
          </div>

          <div id="phase-controls-block" class="${this.currentExperiment !== 'vortex-torsion' ? 'flex flex-col gap-1.5' : 'hidden'}">
            <div class="flex items-center justify-between text-xs">
              <div class="flex items-center gap-1.5">
                <span class="font-semibold text-slate-200">Phase Offset</span>
                <button id="btn-set-180" class="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 text-[10px] font-mono border border-emerald-500/30 transition-all cursor-pointer">
                  Set to 180° (Silent)
                </button>
              </div>
              <span id="ctrl-phase-val" class="font-mono text-emerald-400 font-bold">${this.phaseDeg.toFixed(0)}°</span>
            </div>
            <input 
              id="ctrl-phase-slider" 
              type="range" 
              min="0" 
              max="360" 
              step="1" 
              value="${this.phaseDeg}"
              class="w-full cursor-pointer"
            />
            <div class="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>0° (Combine)</span>
              <span>180° (Cancel Wave)</span>
              <span>360°</span>
            </div>
          </div>
        </div>

        <!-- Acoustic Power & Heterodyne Toggle -->
        <div class="flex flex-col gap-1.5 bg-slate-900/50 p-2.5 rounded-xl border border-white/5">
          <div class="flex items-center justify-between text-xs">
            <div class="flex items-center gap-1.5">
              <span class="font-semibold text-slate-200">Power Level</span>
              <button id="btn-toggle-heterodyne" class="px-2 py-0.5 rounded cursor-pointer ${
                this.isHeterodyneActive
                  ? 'bg-amber-500 text-slate-950 font-semibold shadow-sm'
                  : 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/30'
              } text-[10px] font-mono transition-all">
                Harmonic Pulse: ${this.isHeterodyneActive ? 'ON' : 'OFF'}
              </button>
            </div>
            <span id="ctrl-power-val" class="font-mono text-amber-400 font-bold">${this.acousticPower.toFixed(2)}x</span>
          </div>
          <input 
            id="ctrl-power-slider" 
            type="range" 
            min="0.1" 
            max="3.0" 
            step="0.05" 
            value="${this.acousticPower}"
            class="w-full cursor-pointer"
          />
          <div class="flex justify-between text-[10px] text-slate-400 font-mono">
            <span>0.1x (Gentle)</span>
            <span>1.0x (Resonant)</span>
            <span>3.0x (High Power)</span>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
    this.syncAudioEngine();
  }

  private getHeroButtonHtml(): string {
    if (this.currentExperiment === 'oncotripsy') {
      return `<button id="btn-hero-action" data-action="oncotripsy" class="px-2.5 py-1.5 rounded-xl font-semibold text-xs bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30 active:scale-95 transition-all flex items-center gap-1 cursor-pointer">
                <span>Resonance Burst</span>
              </button>`;
    }
    if (this.currentExperiment === 'sonodynamic-sdt') {
      return `<button id="btn-hero-action" data-action="sonodynamic-sdt" class="px-2.5 py-1.5 rounded-xl font-semibold text-xs bg-blue-500/20 text-blue-300 border border-blue-500/40 hover:bg-blue-500/30 active:scale-95 transition-all flex items-center gap-1 cursor-pointer">
                <span>Micro-Bubbles</span>
              </button>`;
    }
    if (this.currentExperiment === 'calcium-piezo1') {
      return `<button id="btn-hero-action" data-action="calcium-piezo1" class="px-2.5 py-1.5 rounded-xl font-semibold text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 active:scale-95 transition-all flex items-center gap-1 cursor-pointer">
                <span>Calcium Flow</span>
              </button>`;
    }
    if (this.currentExperiment === 'immune-swarm') {
      return `<button id="btn-hero-action" data-action="immune-swarm" class="px-2.5 py-1.5 rounded-xl font-semibold text-xs bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/30 active:scale-95 transition-all flex items-center gap-1 cursor-pointer">
                <span>Deploy T-Cells</span>
              </button>`;
    }
    return `<button id="btn-hero-action" data-action="antiphase" class="px-2.5 py-1.5 rounded-xl font-semibold text-xs ${
      this.isAntiPhaseActive
        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
        : 'bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700'
    } transition-all flex items-center gap-1 cursor-pointer">
      <span>${this.isAntiPhaseActive ? 'Cancel Active' : 'Cancel (180°)'}</span>
    </button>`;
  }

  private updateHeroButton(): void {
    const heroContainer = this.container.querySelector<HTMLElement>('#hero-action-container');
    if (heroContainer) {
      heroContainer.innerHTML = this.getHeroButtonHtml();
      this.bindHeroEvent();
    }
  }

  private bindHeroEvent(): void {
    const heroBtn = this.container.querySelector<HTMLButtonElement>('#btn-hero-action');
    if (!heroBtn) return;

    heroBtn.addEventListener('click', () => {
      const action = heroBtn.getAttribute('data-action');
      if (action === 'oncotripsy') {
        this.visualizer.acousticTherapyLab.triggerOncotripsyBurst();
        this.syncAudioEngine();
      } else if (action === 'sonodynamic-sdt') {
        this.visualizer.acousticTherapyLab.triggerSonodynamicFlash();
      } else if (action === 'calcium-piezo1') {
        this.visualizer.acousticTherapyLab.triggerPiezo1CalciumWave();
      } else if (action === 'immune-swarm') {
        this.visualizer.acousticTherapyLab.tCellSwarm.setDampSources([
          this.viewMode === 'spheroid-cluster' ? new THREE.Vector3(0, 0.4, 0) : new THREE.Vector3(-1.8, 0.4, 0),
        ]);
      } else if (action === 'antiphase') {
        this.isAntiPhaseActive = !this.isAntiPhaseActive;
        this.visualizer.acousticTherapyLab.setAntiPhase(this.isAntiPhaseActive);
        this.updateHeroButton();
        this.syncAudioEngine();
        this.updateTelemetry();
      }
    });
  }

  private updateActiveExperimentUI(): void {
    const expButtons = this.container.querySelectorAll<HTMLButtonElement>('.tab-exp-btn');
    expButtons.forEach(btn => {
      const exp = btn.getAttribute('data-experiment');
      const isSelected = exp === this.currentExperiment;
      if (isSelected) {
        btn.className = `tab-exp-btn text-left p-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer bg-cyan-500 text-slate-950 font-bold shadow-sm ring-1 ring-cyan-400/50 border-cyan-400 ${
          exp === 'immune-swarm' ? 'col-span-2 flex items-center justify-between' : ''
        }`;
      } else {
        btn.className = `tab-exp-btn text-left p-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer bg-slate-800/60 text-slate-300 hover:text-white hover:bg-slate-800 border-slate-700/50 ${
          exp === 'immune-swarm' ? 'col-span-2 flex items-center justify-between' : ''
        }`;
      }
    });

    // Update dynamic sub-sections
    const vortexBlock = this.container.querySelector<HTMLElement>('#vortex-controls-block');
    const phaseBlock = this.container.querySelector<HTMLElement>('#phase-controls-block');
    if (vortexBlock && phaseBlock) {
      if (this.currentExperiment === 'vortex-torsion') {
        vortexBlock.className = 'flex flex-col gap-1.5';
        phaseBlock.className = 'hidden';
      } else {
        vortexBlock.className = 'hidden';
        phaseBlock.className = 'flex flex-col gap-1.5';
      }
    }

    this.updateHeroButton();
  }

  private updateActiveTumorUI(): void {
    const tumorButtons = this.container.querySelectorAll<HTMLButtonElement>('.btn-tumor-profile');
    tumorButtons.forEach(btn => {
      const tumorId = btn.getAttribute('data-tumor-id');
      const isSelected = tumorId === this.currentTumorId;
      if (isSelected) {
        btn.className =
          'btn-tumor-profile text-left p-2 rounded-xl border transition-all flex flex-col gap-0.5 cursor-pointer bg-rose-500/20 border-rose-500/80 text-rose-200 font-bold shadow-sm ring-1 ring-rose-500/40';
      } else {
        btn.className =
          'btn-tumor-profile text-left p-2 rounded-xl border transition-all flex flex-col gap-0.5 cursor-pointer bg-slate-800/60 border-slate-700/50 text-slate-300 hover:text-white hover:bg-slate-800 hover:border-slate-600';
      }
    });

    const freqSlider = this.container.querySelector<HTMLInputElement>('#ctrl-freq-slider');
    const freqVal = this.container.querySelector<HTMLElement>('#ctrl-freq-val');
    const resonantLabel = this.container.querySelector<HTMLElement>('#ctrl-freq-resonant-label');

    if (freqSlider) freqSlider.value = String(this.frequencyHz);
    if (freqVal) freqVal.textContent = `${this.frequencyHz.toFixed(1)} Hz`;
    if (resonantLabel) resonantLabel.textContent = `Resonant: ${this.frequencyHz.toFixed(0)} Hz`;
  }

  private updateViewModeUI(): void {
    const singleBtn = this.container.querySelector<HTMLButtonElement>('#view-single-pair');
    const spheroidBtn = this.container.querySelector<HTMLButtonElement>('#view-spheroid');

    if (singleBtn) {
      singleBtn.className = `flex-1 py-1 px-2 rounded-xl font-semibold transition-all cursor-pointer ${
        this.viewMode === 'co-culture-pair'
          ? 'glass-btn-active font-bold shadow-sm text-cyan-300'
          : 'text-gray-400 hover:text-white'
      }`;
    }
    if (spheroidBtn) {
      spheroidBtn.className = `flex-1 py-1 px-2 rounded-xl font-semibold transition-all cursor-pointer ${
        this.viewMode === 'spheroid-cluster'
          ? 'glass-btn-active font-bold shadow-sm text-cyan-300'
          : 'text-gray-400 hover:text-white'
      }`;
    }
  }

  private updateVortexChargeUI(): void {
    const chargeButtons = this.container.querySelectorAll<HTMLButtonElement>('.btn-charge');
    chargeButtons.forEach(btn => {
      const ch = parseInt(btn.getAttribute('data-charge') || '1', 10);
      if (ch === this.vortexCharge) {
        btn.className =
          'btn-charge py-1.5 rounded-lg border text-xs font-mono transition-all text-center cursor-pointer bg-cyan-500 text-slate-950 font-bold border-cyan-400 shadow-sm';
      } else {
        btn.className =
          'btn-charge py-1.5 rounded-lg border text-xs font-mono transition-all text-center cursor-pointer bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700';
      }
    });
    const vortexVal = this.container.querySelector<HTMLElement>('#ctrl-vortex-val');
    if (vortexVal) vortexVal.textContent = `Level ${this.vortexCharge}`;
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
          this.updateActiveTumorUI();
          this.syncAudioEngine();
          this.updateTelemetry();
        }
      });
    });

    // 2. View Switcher
    this.container.querySelector('#view-single-pair')?.addEventListener('click', () => {
      this.viewMode = 'co-culture-pair';
      this.visualizer.acousticTherapyLab.setViewMode('co-culture-pair');
      this.updateViewModeUI();
    });

    this.container.querySelector('#view-spheroid')?.addEventListener('click', () => {
      this.viewMode = 'spheroid-cluster';
      this.visualizer.acousticTherapyLab.setViewMode('spheroid-cluster');
      this.updateViewModeUI();
    });

    // 3. Experiment Modalities
    this.container.querySelectorAll('.tab-exp-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        const exp = (e.currentTarget as HTMLElement).getAttribute('data-experiment') as TherapyExperiment;
        if (exp) {
          this.currentExperiment = exp;
          this.visualizer.acousticTherapyLab.setExperiment(exp);
          this.updateActiveExperimentUI();
          this.syncAudioEngine();
          this.updateTelemetry();
        }
      });
    });

    // 4. Hero Action Button
    this.bindHeroEvent();

    // 5. Vortex Charge Buttons
    this.container.querySelectorAll('.btn-charge').forEach(btn => {
      btn.addEventListener('click', e => {
        const ch = parseInt((e.currentTarget as HTMLElement).getAttribute('data-charge') || '1', 10) as 1 | 2 | 3;
        this.vortexCharge = ch;
        this.visualizer.acousticTherapyLab.setVortexTopologicalCharge(ch);
        this.updateVortexChargeUI();
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

    // 8. Power Slider & Heterodyne Toggle
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

    const heterodyneBtn = this.container.querySelector<HTMLButtonElement>('#btn-toggle-heterodyne');
    heterodyneBtn?.addEventListener('click', () => {
      this.isHeterodyneActive = !this.isHeterodyneActive;
      this.visualizer.acousticTherapyLab.setHeterodyne(this.isHeterodyneActive);
      if (heterodyneBtn) {
        heterodyneBtn.className = `px-2 py-0.5 rounded cursor-pointer ${
          this.isHeterodyneActive
            ? 'bg-amber-500 text-slate-950 font-semibold shadow-sm'
            : 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/30'
        } text-[10px] font-mono transition-all`;
        heterodyneBtn.textContent = `Harmonic Pulse: ${this.isHeterodyneActive ? 'ON' : 'OFF'}`;
      }
      this.syncAudioEngine();
      this.updateTelemetry();
    });

    // 9. Biophysics Studio Hub Switcher
    this.container.querySelector('#hub-btn-bio')?.addEventListener('click', () => {
      if (this.onSwitchMode) this.onSwitchMode('bio');
    });
    this.container.querySelector('#hub-btn-nobel')?.addEventListener('click', () => {
      if (this.onSwitchMode) this.onSwitchMode('nobel');
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
      telLysis.textContent = `${tel.cancerLysisPercent.toFixed(1)}% (${(tel.cancerStrain * 100).toFixed(1)}%)`;
    if (telHealthy)
      telHealthy.textContent = `${tel.healthyPreservedPercent.toFixed(1)}%`;
    if (telPressure) telPressure.textContent = `${tel.netPressurePa.toFixed(2)} Pa`;
    if (telCancel) telCancel.textContent = `${tel.cancellationEfficiencyPercent.toFixed(1)}% Silenced`;
  }
}
