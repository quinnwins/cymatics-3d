/**
 * ModalSweeperControls.ts
 * SoundForm 3D — Interactive Acoustic Modal Sweeper & 3D Cavity Resonator Suite
 *
 * Features:
 * - Interactive (n, m, ℓ) 3-axis harmonic modal order sliders & quick-steppers.
 * - Instant 1-click acoustic eigenstate preset matrix:
 *     • (1,1,1) Fundamental Crossing Planes
 *     • (2,2,1) 3D Cubic Lattice Cells
 *     • (3,2,2) Honeycomb Membrane Matrix
 *     • (4,3,2) Complex Architectural Cage
 *     • (5,4,3) Ultra High-Order Resonant Crystal
 * - Chamber Geometry Selector (Cube / Cylinder / Sphere).
 * - Trapping Mode Switcher (Normal Nodes / Inverse Antinodes) for acoustic levitation.
 * - Live Audio Resonance Coupling toggle (links real-time FFT spectrum to harmonic weights).
 * - Theoretical Eigenfrequency Calculator (f_{n,m,ℓ}) with 1-click Synth Audition.
 */

import { AudioEngine } from '../audio/AudioEngine';
import { VisualizerEngine } from '../visualizer/VisualizerEngine';
import { WavePhysics, NoteInfo } from '../math/WavePhysics';
import { EngineMode } from './Header';

export type ChamberGeometry = 'cube' | 'cylinder' | 'sphere';
export type TrappingMode = 'nodes' | 'antinodes';

export interface ModalPreset {
  id: string;
  n: number;
  m: number;
  l: number;
  name: string;
  subtitle: string;
  geometry: ChamberGeometry;
  description: string;
  badge: string;
}

export interface ModalSweeperState {
  n: number;
  m: number;
  l: number;
  geometry: ChamberGeometry;
  trappingMode: TrappingMode;
  audioCoupled: boolean;
  couplingSensitivity: number;
  chamberLengthX: number; // in meters
  chamberLengthY: number; // in meters
  chamberLengthZ: number; // in meters
  calculatedEigenfrequency: number;
  noteInfo: NoteInfo;
}

export class ModalSweeperControls {
  private element: HTMLElement;
  private state: ModalSweeperState;
  private onSwitchMode?: (mode: EngineMode) => void;

  public static readonly PRESETS: ModalPreset[] = [
    {
      id: 'fundamental-crossing',
      n: 1,
      m: 1,
      l: 1,
      name: 'Crossing Planes',
      subtitle: '(1,1,1) Mode',
      geometry: 'cube',
      description: 'Simple orthogonal boundary planes dividing the chamber into 8 sections.',
      badge: 'Base Shape',
    },
    {
      id: 'cubic-lattice',
      n: 2,
      m: 2,
      l: 1,
      name: '3D Grid Lattice',
      subtitle: '(2,2,1) Mode',
      geometry: 'cube',
      description: 'Balanced 3D matrix of standing wave traps for particle levitation.',
      badge: 'Stable Grid',
    },
    {
      id: 'honeycomb-membrane',
      n: 3,
      m: 2,
      l: 2,
      name: 'Honeycomb Trap',
      subtitle: '(3,2,2) Mode',
      geometry: 'cube',
      description: 'High-density standing nodal planes forming levitation cells.',
      badge: 'Multi-Trap',
    },
    {
      id: 'architectural-cage',
      n: 4,
      m: 3,
      l: 2,
      name: 'Harmonic Cage',
      subtitle: '(4,3,2) Mode',
      geometry: 'cube',
      description: 'Dense architectural interference patterns throughout 3D space.',
      badge: 'Complex',
    },
    {
      id: 'crystal-543',
      n: 5,
      m: 4,
      l: 3,
      name: 'Crystal Resonator',
      subtitle: '(5,4,3) Mode',
      geometry: 'cube',
      description: 'Ultra high-frequency eigenmode with fine volumetric lattices.',
      badge: 'Fine Grid',
    },
    {
      id: 'cylinder-bessel',
      n: 2,
      m: 3,
      l: 1,
      name: 'Cylindrical Rings',
      subtitle: 'Bessel Mode',
      geometry: 'cylinder',
      description: 'Concentric standing cylinders and radial nodal discs in 3D.',
      badge: 'Radial',
    },
    {
      id: 'spherical-harmonics',
      n: 3,
      m: 2,
      l: 2,
      name: 'Spherical Shells',
      subtitle: 'Harmonic Shells',
      geometry: 'sphere',
      description: 'Dense spherical harmonic standing waves with faceted crystal shapes.',
      badge: 'Detailed',
    },
  ];

  private isVisible = true;

  constructor(
    private audioEngine: AudioEngine,
    private visualizer?: VisualizerEngine,
    private onStateChange?: (state: ModalSweeperState) => void,
    onSwitchMode?: (mode: EngineMode) => void
  ) {
    this.onSwitchMode = onSwitchMode;
    this.element = document.createElement('div');
    this.element.className = 'w-full flex flex-col gap-2.5 transition-all duration-300';
    this.preventEventBleeding();

    // Initial state: (1,1,1) Ground state in a 1.0 m^3 cavity
    this.state = {
      n: 1,
      m: 1,
      l: 1,
      geometry: 'cube',
      trappingMode: 'nodes',
      audioCoupled: true,
      couplingSensitivity: 1.0,
      chamberLengthX: 1.0,
      chamberLengthY: 1.0,
      chamberLengthZ: 1.0,
      calculatedEigenfrequency: 0,
      noteInfo: { name: 'D4', octave: 4, frequency: 297, cents: 0 },
    };

    this.recalculatePhysics();

    this.audioEngine.subscribe(() => {
      if (this.isVisible) {
        this.updateDisplay();
      }
    });

    window.addEventListener('cymatics-visibility-changed', () => {
      if (this.isVisible) {
        this.render();
      }
    });
  }

  private preventEventBleeding(): void {
    this.element.addEventListener('wheel', e => e.stopPropagation(), { passive: false });
    this.element.addEventListener('pointerdown', e => e.stopPropagation());
  }

  public getElement(): HTMLElement {
    this.render();
    return this.element;
  }

  public setVisible(visible: boolean): void {
    this.isVisible = visible;
    this.element.style.display = visible ? 'flex' : 'none';
  }

  public getState(): Readonly<ModalSweeperState> {
    return this.state;
  }

  private calculateEigenfrequency(n: number, m: number, l: number): number {
    const c = WavePhysics.SPEED_OF_SOUND_AIR;
    const kx = n / this.state.chamberLengthX;
    const ky = m / this.state.chamberLengthY;
    const kz = l / this.state.chamberLengthZ;
    const freq = (c / 2) * Math.sqrt(kx * kx + ky * ky + kz * kz);
    return Math.round(freq * 10) / 10;
  }

  private recalculatePhysics(): void {
    const freq = this.calculateEigenfrequency(this.state.n, this.state.m, this.state.l);
    this.state.calculatedEigenfrequency = freq;
    this.state.noteInfo = WavePhysics.frequencyToNote(freq);
  }

  private notifyStateChange(): void {
    this.recalculatePhysics();

    if (this.audioEngine.synthesizer?.getIsPlaying()) {
      this.audioEngine.synthesizer.setFrequency(this.state.calculatedEigenfrequency);
    }

    if (this.onStateChange) {
      this.onStateChange(this.state);
    }

    window.dispatchEvent(
      new CustomEvent('modal-state-changed', {
        detail: { ...this.state },
      })
    );
  }

  public setNML(n: number, m: number, l: number): void {
    this.state.n = Math.max(1, Math.min(8, Math.round(n)));
    this.state.m = Math.max(1, Math.min(8, Math.round(m)));
    this.state.l = Math.max(1, Math.min(8, Math.round(l)));
    this.notifyStateChange();
    this.render();
  }

  public setGeometry(geom: ChamberGeometry): void {
    this.state.geometry = geom;
    this.notifyStateChange();
    this.render();
  }

  public setTrappingMode(mode: TrappingMode): void {
    this.state.trappingMode = mode;
    this.notifyStateChange();
    this.render();
  }

  public setAudioCoupled(coupled: boolean): void {
    this.state.audioCoupled = coupled;
    this.notifyStateChange();
    this.render();
  }

  public applyPreset(presetId: string): void {
    const preset = ModalSweeperControls.PRESETS.find(p => p.id === presetId);
    if (!preset) return;

    this.state.n = preset.n;
    this.state.m = preset.m;
    this.state.l = preset.l;
    this.state.geometry = preset.geometry;
    this.notifyStateChange();
    this.render();
  }

  public render(): void {
    if (!this.isVisible) {
      this.element.style.display = 'none';
    } else {
      this.element.style.display = 'flex';
    }

    const { n, m, l, geometry, trappingMode, audioCoupled, calculatedEigenfrequency, noteInfo } = this.state;
    const totalNodalCells = n * m * l;
    const isPlayingSynth = this.audioEngine.synthesizer?.getIsPlaying() ?? false;

    this.element.innerHTML = `
      <!-- Acoustic Studio Hub Switcher -->
      <div class="glass-panel p-1 rounded-2xl flex items-center gap-1 bg-slate-900/60 border border-white/10 text-xs mb-1">
        <button id="hub-btn-modal" class="flex-1 py-1 px-1.5 rounded-xl font-bold text-center transition-all cursor-pointer glass-btn-active text-cyan-300 shadow-sm ring-1 ring-cyan-500/30">
          3D Cymatics
        </button>
        <button id="hub-btn-freq" class="flex-1 py-1 px-1.5 rounded-xl font-semibold text-center transition-all cursor-pointer text-gray-400 hover:text-white hover:bg-white/5">
          Tone Lab
        </button>
      </div>

      <div class="glass-panel w-full p-3.5 sm:p-4 rounded-3xl flex flex-col gap-3 shadow-xl border border-white/10 relative text-white select-none">
        
        <!-- Top Title & Header -->
        <div class="flex items-center justify-between gap-2 border-b border-white/10 pb-2.5">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-cyan-400 text-sm font-mono font-bold shrink-0 shadow-sm">
              λ
            </div>
            <div>
              <div class="flex items-center gap-1.5">
                <h2 class="text-xs sm:text-sm font-bold text-white">
                  3D Standing Waves
                </h2>
                <span class="px-1.5 py-0.5 rounded-md text-[9px] font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shrink-0">
                  (n, m, ℓ)
                </span>
              </div>
              <p class="text-[10px] text-gray-400 font-medium">
                Resonant chambers and acoustic particle traps
              </p>
            </div>
          </div>
        </div>

        <!-- Resonant Eigenfrequency Telemetry & Audition Pitch Pill -->
        <div class="glass-panel p-2.5 rounded-2xl flex items-center justify-between gap-2 bg-slate-900/80 border-slate-700/60 shadow-inner">
          <div class="flex flex-col">
            <span class="text-[8px] uppercase tracking-wider text-gray-400 font-semibold">Resonant Frequency</span>
            <div class="flex items-baseline gap-1.5 font-mono">
              <span id="modal-freq-val" class="text-xs sm:text-sm font-bold text-cyan-400">${calculatedEigenfrequency.toFixed(1)} Hz</span>
              <span id="modal-note-name" class="text-[11px] font-semibold text-blue-400">${noteInfo.name}</span>
              <span id="modal-note-cents" class="text-[9px] text-gray-400">${noteInfo.cents >= 0 ? '+' : ''}${noteInfo.cents}c</span>
            </div>
          </div>

          <!-- 1-Click Synth Audition Button -->
          <button
            id="btn-audition-eigenfrequency"
            title="Listen to resonant tone"
            class="glass-btn px-2.5 py-1.5 rounded-xl text-[11px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              isPlayingSynth ? 'glass-btn-active' : 'text-gray-200 hover:text-white'
            }"
          >
            <span>${isPlayingSynth ? 'Stop Tone' : 'Play Tone'}</span>
          </button>
        </div>

        <!-- Middle Section: (n, m, l) Modal Sliders & Steppers (Vertical Stack) -->
        <div class="flex flex-col gap-2">
          
          <!-- n: X-Axis / Transverse Radial Mode -->
          <div class="glass-panel p-2.5 rounded-2xl flex flex-col gap-1.5 bg-white/5 border-white/5">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full bg-cyan-400"></span>
                <span class="text-xs font-bold text-gray-200">Mode n (X Axis)</span>
              </div>
              <span id="badge-mode-n" class="font-mono text-xs font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-lg border border-cyan-500/30">
                ${n}
              </span>
            </div>

            <div class="flex items-center gap-2">
              <button data-axis="n" data-dir="-1" class="btn-step glass-btn w-7 h-7 rounded-lg text-xs font-bold text-gray-300 hover:text-white flex items-center justify-center cursor-pointer">
                −
              </button>
              <input
                type="range"
                id="slider-mode-n"
                min="1"
                max="8"
                step="1"
                value="${n}"
                class="flex-1 cursor-pointer"
              />
              <button data-axis="n" data-dir="1" class="btn-step glass-btn w-7 h-7 rounded-lg text-xs font-bold text-gray-300 hover:text-white flex items-center justify-center cursor-pointer">
                +
              </button>
            </div>
            <div class="flex justify-between text-[9px] text-gray-400 font-mono">
              <span>1 (Simple)</span>
              <span>4 (Medium)</span>
              <span>8 (Dense)</span>
            </div>
          </div>

          <!-- m: Y-Axis / Azimuthal Polar Mode -->
          <div class="glass-panel p-2.5 rounded-2xl flex flex-col gap-1.5 bg-white/5 border-white/5">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full bg-blue-400"></span>
                <span class="text-xs font-bold text-gray-200">Mode m (Y Axis)</span>
              </div>
              <span id="badge-mode-m" class="font-mono text-xs font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-lg border border-blue-500/30">
                ${m}
              </span>
            </div>

            <div class="flex items-center gap-2">
              <button data-axis="m" data-dir="-1" class="btn-step glass-btn w-7 h-7 rounded-lg text-xs font-bold text-gray-300 hover:text-white flex items-center justify-center cursor-pointer">
                −
              </button>
              <input
                type="range"
                id="slider-mode-m"
                min="1"
                max="8"
                step="1"
                value="${m}"
                class="flex-1 cursor-pointer"
              />
              <button data-axis="m" data-dir="1" class="btn-step glass-btn w-7 h-7 rounded-lg text-xs font-bold text-gray-300 hover:text-white flex items-center justify-center cursor-pointer">
                +
              </button>
            </div>
            <div class="flex justify-between text-[9px] text-gray-400 font-mono">
              <span>1 (Simple)</span>
              <span>4 (Medium)</span>
              <span>8 (Dense)</span>
            </div>
          </div>

          <!-- l: Z-Axis / Longitudinal Depth Mode -->
          <div class="glass-panel p-2.5 rounded-2xl flex flex-col gap-1.5 bg-white/5 border-white/5">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full bg-purple-400"></span>
                <span class="text-xs font-bold text-gray-200">Mode ℓ (Z Axis)</span>
              </div>
              <span id="badge-mode-l" class="font-mono text-xs font-bold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-lg border border-purple-500/30">
                ${l}
              </span>
            </div>

            <div class="flex items-center gap-2">
              <button data-axis="l" data-dir="-1" class="btn-step glass-btn w-7 h-7 rounded-lg text-xs font-bold text-gray-300 hover:text-white flex items-center justify-center cursor-pointer">
                −
              </button>
              <input
                type="range"
                id="slider-mode-l"
                min="1"
                max="8"
                step="1"
                value="${l}"
                class="flex-1 cursor-pointer"
              />
              <button data-axis="l" data-dir="1" class="btn-step glass-btn w-7 h-7 rounded-lg text-xs font-bold text-gray-300 hover:text-white flex items-center justify-center cursor-pointer">
                +
              </button>
            </div>
            <div class="flex justify-between text-[9px] text-gray-400 font-mono">
              <span>1 (Simple)</span>
              <span>4 (Medium)</span>
              <span>8 (Dense)</span>
            </div>
          </div>

        </div>

        <!-- Chamber Physics & Boundary Controls -->
        <div class="flex flex-col gap-2.5 pt-1">
          
          <!-- 1. Chamber Geometry Selector -->
          <div class="flex flex-col gap-1">
            <span class="text-[10px] font-semibold text-gray-300">Chamber Shape:</span>
            <div class="glass-panel p-1 rounded-2xl flex items-center gap-1 bg-slate-900/60 border-white/5">
              ${[
                { id: 'cube', label: 'Cube' },
                { id: 'cylinder', label: 'Cylinder' },
                { id: 'sphere', label: 'Sphere' },
              ]
                .map(
                  g => `
                <button
                  data-geometry="${g.id}"
                  class="btn-geometry flex-1 py-1.5 px-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                    geometry === g.id ? 'glass-btn-active font-bold shadow-sm' : 'text-gray-400 hover:text-gray-200'
                  }"
                >
                  <span>${g.label}</span>
                </button>
              `
                )
                .join('')}
            </div>
          </div>

          <!-- 2. Specimen Display Layer Selector -->
          <div class="flex flex-col gap-1">
            <span class="text-[10px] font-semibold text-gray-300">Specimen Display:</span>
            <div class="glass-panel p-1 rounded-2xl flex items-center gap-1 bg-slate-900/60 border-white/5">
              ${[
                { id: 'both', label: 'All Layers' },
                { id: 'particles', label: 'Dust Only' },
                { id: 'droplet', label: 'Droplet Only' },
              ]
                .map(
                  v => `
                <button
                  data-cymatics-vis="${v.id}"
                  class="btn-sweeper-vis flex-1 py-1.5 px-1.5 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                    (this.visualizer?.cymaticsVisibilityMode || 'both') === v.id
                      ? 'glass-btn-active font-bold text-cyan-300 shadow-sm'
                      : 'text-gray-400 hover:text-gray-200'
                  }"
                >
                  <span>${v.label}</span>
                </button>
              `
                )
                .join('')}
            </div>
          </div>

          <!-- 3. Trapping Mode Switcher (Radiation Force Levitation) -->
          <div class="flex flex-col gap-1">
            <span class="text-[10px] font-semibold text-gray-300">Particle Trapping:</span>
            <div class="glass-panel p-1 rounded-2xl flex items-center gap-1 bg-slate-900/60 border-white/5">
              <button
                id="btn-trap-nodes"
                class="flex-1 py-1.5 px-2 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                  trappingMode === 'nodes' ? 'glass-btn-active font-bold' : 'text-gray-400 hover:text-gray-200'
                }"
              >
                <span>Nodes (Quiet Zones)</span>
              </button>
              <button
                id="btn-trap-antinodes"
                class="flex-1 py-1.5 px-2 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                  trappingMode === 'antinodes' ? 'glass-btn-active font-bold' : 'text-gray-400 hover:text-gray-200'
                }"
              >
                <span>Antinodes (Active)</span>
              </button>
            </div>
          </div>

          <!-- 3. Audio Resonance Coupling Switch -->
          <div class="flex flex-col gap-1">
            <div class="flex items-center justify-between">
              <span class="text-[10px] font-semibold text-gray-300">Sync to Music:</span>
              <span class="text-[9px] font-mono text-gray-400 font-semibold">${audioCoupled ? 'Active' : 'Off'}</span>
            </div>
            <button
              id="btn-toggle-coupling"
              class="w-full py-1.5 px-3 rounded-2xl text-xs font-semibold flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                audioCoupled
                  ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300 shadow-sm'
                  : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
              }"
            >
              <span>${audioCoupled ? 'Audio Sync Active' : 'Audio Sync Off'}</span>
            </button>
          </div>

        </div>

        <!-- Wave Presets Section -->
        <div class="flex flex-col gap-1.5 pt-2 border-t border-white/10">
          <div class="flex items-center justify-between">
            <span class="text-[10px] font-bold text-gray-300 flex items-center gap-1.5">
              <span>Wave Shape Presets:</span>
            </span>
            <span id="modal-total-cells" class="text-[9px] text-gray-400 font-mono">
              Grid: <strong class="text-cyan-400">${totalNodalCells}</strong> Cells
            </span>
          </div>

          <div class="flex flex-col gap-1.5">
            ${ModalSweeperControls.PRESETS.map(p => {
              const isSelected = p.n === n && p.m === m && p.l === l && p.geometry === geometry;
              return `
                <button
                  data-preset="${p.id}"
                  class="btn-preset-card glass-panel p-2 rounded-2xl flex flex-col gap-0.5 text-left transition-all hover:border-slate-600 active:scale-[0.99] cursor-pointer ${
                    isSelected
                      ? 'glass-panel-accent border-cyan-500/60 shadow-sm'
                      : 'hover:border-white/20 bg-white/5 border-white/5'
                  }"
                >
                  <div class="flex items-center justify-between w-full">
                    <span class="font-mono text-xs font-bold text-cyan-400">(${p.n},${p.m},${p.l})</span>
                    <span class="text-[9px] px-1.5 py-0.5 rounded-md bg-slate-800 font-semibold text-gray-300 border border-slate-700">${p.badge}</span>
                  </div>
                  <span class="text-[11px] font-semibold text-gray-100 leading-tight">${p.name}</span>
                  <span class="text-[9px] text-gray-400 line-clamp-1 leading-tight">${p.description}</span>
                </button>
              `;
            }).join('')}
          </div>
        </div>

      </div>
    `;

    this.attachEvents();
  }

  private updateDisplay(fromSlider = false): void {
    const { n, m, l, calculatedEigenfrequency, noteInfo } = this.state;
    const isPlayingSynth = this.audioEngine.synthesizer?.getIsPlaying() ?? false;

    // Resonant Frequency & Note Readout
    const freqEl = this.element.querySelector('#modal-freq-val');
    if (freqEl) freqEl.textContent = `${calculatedEigenfrequency.toFixed(1)} Hz`;
    const noteNameEl = this.element.querySelector('#modal-note-name');
    if (noteNameEl) noteNameEl.textContent = noteInfo.name;
    const noteCentsEl = this.element.querySelector('#modal-note-cents');
    if (noteCentsEl) noteCentsEl.textContent = `${noteInfo.cents >= 0 ? '+' : ''}${noteInfo.cents}c`;

    // Total cells badge
    const totalCellsEl = this.element.querySelector('#modal-total-cells');
    if (totalCellsEl) {
      totalCellsEl.innerHTML = `Grid: <strong class="text-cyan-400">${n * m * l}</strong> Cells`;
    }

    // Badges
    const badgeN = this.element.querySelector('#badge-mode-n');
    if (badgeN) badgeN.textContent = n.toString();
    const badgeM = this.element.querySelector('#badge-mode-m');
    if (badgeM) badgeM.textContent = m.toString();
    const badgeL = this.element.querySelector('#badge-mode-l');
    if (badgeL) badgeL.textContent = l.toString();

    // Sliders
    if (!fromSlider) {
      const sliderN = this.element.querySelector('#slider-mode-n') as HTMLInputElement;
      if (sliderN) sliderN.value = n.toString();
      const sliderM = this.element.querySelector('#slider-mode-m') as HTMLInputElement;
      if (sliderM) sliderM.value = m.toString();
      const sliderL = this.element.querySelector('#slider-mode-l') as HTMLInputElement;
      if (sliderL) sliderL.value = l.toString();
    }

    // Audition button
    const btnAudition = this.element.querySelector('#btn-audition-eigenfrequency');
    if (btnAudition) {
      btnAudition.className = `glass-btn px-2.5 py-1.5 rounded-xl text-[11px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
        isPlayingSynth ? 'glass-btn-active' : 'text-gray-200 hover:text-white'
      }`;
      btnAudition.innerHTML = `<span>${isPlayingSynth ? 'Stop Tone' : 'Play Tone'}</span>`;
    }

    // Preset cards
    this.element.querySelectorAll('.btn-preset-card').forEach(btn => {
      const presetId = btn.getAttribute('data-preset');
      const p = ModalSweeperControls.PRESETS.find(pr => pr.id === presetId);
      if (p) {
        const isSelected = p.n === n && p.m === m && p.l === l && p.geometry === this.state.geometry;
        btn.className = `btn-preset-card glass-panel p-2 rounded-2xl flex flex-col gap-0.5 text-left transition-all hover:border-slate-600 active:scale-[0.99] cursor-pointer ${
          isSelected
            ? 'glass-panel-accent border-cyan-500/60 shadow-sm'
            : 'hover:border-white/20 bg-white/5 border-white/5'
        }`;
      }
    });
  }

  private attachEvents(): void {
    // 1. Sliders (n, m, l)
    const sliderN = this.element.querySelector('#slider-mode-n') as HTMLInputElement;
    const sliderM = this.element.querySelector('#slider-mode-m') as HTMLInputElement;
    const sliderL = this.element.querySelector('#slider-mode-l') as HTMLInputElement;

    sliderN?.addEventListener('input', () => {
      this.state.n = parseInt(sliderN.value, 10);
      this.notifyStateChange();
      this.updateDisplay(true);
    });

    sliderM?.addEventListener('input', () => {
      this.state.m = parseInt(sliderM.value, 10);
      this.notifyStateChange();
      this.updateDisplay(true);
    });

    sliderL?.addEventListener('input', () => {
      this.state.l = parseInt(sliderL.value, 10);
      this.notifyStateChange();
      this.updateDisplay(true);
    });

    // 2. Stepper Buttons (+ / -)
    this.element.querySelectorAll('.btn-step').forEach(btn => {
      btn.addEventListener('click', e => {
        const target = e.currentTarget as HTMLElement;
        const axis = target.getAttribute('data-axis') as 'n' | 'm' | 'l';
        const dir = parseInt(target.getAttribute('data-dir') || '1', 10);

        if (axis === 'n') this.state.n = Math.max(1, Math.min(8, this.state.n + dir));
        if (axis === 'm') this.state.m = Math.max(1, Math.min(8, this.state.m + dir));
        if (axis === 'l') this.state.l = Math.max(1, Math.min(8, this.state.l + dir));

        this.notifyStateChange();
        this.render();
      });
    });

    // 3. Geometry Buttons (Cube / Cylinder / Sphere)
    this.element.querySelectorAll('.btn-geometry').forEach(btn => {
      btn.addEventListener('click', e => {
        const target = e.currentTarget as HTMLElement;
        const geom = target.getAttribute('data-geometry') as ChamberGeometry;
        if (geom) {
          this.setGeometry(geom);
        }
      });
    });

    // 3b. Specimen Layer Visibility Buttons (Both / Dust / Droplet)
    this.element.querySelectorAll('.btn-sweeper-vis').forEach(btn => {
      btn.addEventListener('click', e => {
        const target = e.currentTarget as HTMLElement;
        const visMode = target.getAttribute('data-cymatics-vis') as 'both' | 'particles' | 'droplet';
        if (visMode && this.visualizer) {
          this.visualizer.setCymaticsVisibilityMode(visMode);
          this.render();
          window.dispatchEvent(new CustomEvent('cymatics-visibility-changed', { detail: { mode: visMode } }));
        }
      });
    });

    // 4. Trapping Mode Buttons (Nodes / Antinodes)
    this.element.querySelector('#btn-trap-nodes')?.addEventListener('click', () => {
      this.setTrappingMode('nodes');
    });

    this.element.querySelector('#btn-trap-antinodes')?.addEventListener('click', () => {
      this.setTrappingMode('antinodes');
    });

    // 5. Audio Coupling Toggle
    this.element.querySelector('#btn-toggle-coupling')?.addEventListener('click', () => {
      this.setAudioCoupled(!this.state.audioCoupled);
    });

    // 6. Preset Cards
    this.element.querySelectorAll('.btn-preset-card').forEach(btn => {
      btn.addEventListener('click', e => {
        const target = e.currentTarget as HTMLElement;
        const presetId = target.getAttribute('data-preset');
        if (presetId) {
          this.applyPreset(presetId);
        }
      });
    });

    // 7. Audition Eigenfrequency Synth Button
    this.element.querySelector('#btn-audition-eigenfrequency')?.addEventListener('click', async () => {
      await this.audioEngine.initialize();
      if (this.audioEngine.synthesizer?.getIsPlaying()) {
        this.audioEngine.stopFrequency();
      } else {
        this.audioEngine.playFrequency(this.state.calculatedEigenfrequency);
      }
      this.updateDisplay();
    });

    // 8. Acoustic Studio Hub Switcher
    this.element.querySelector('#hub-btn-freq')?.addEventListener('click', () => {
      if (this.onSwitchMode) this.onSwitchMode('frequency');
    });
  }
}
