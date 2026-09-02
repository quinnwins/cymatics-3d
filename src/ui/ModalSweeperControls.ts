/**
 * ModalSweeperControls.ts
 * SoundForm 3D — Interactive Acoustic Cymatics & Modal Resonator Suite
 *
 * Features:
 * - 2D Chladni Sand Plate and 3D Acoustofluidic Droplet / Acoustic Levitation Trap selection.
 * - Interactive (n, m, ℓ) 3-axis harmonic modal order sliders & quick-steppers.
 * - Instant 1-click acoustic eigenstate preset matrix:
 *     • (1,1,1) Fundamental Crossing Planes
 *     • (2,2,1) 3D Cubic Lattice Cells
 *     • (3,2,2) Honeycomb Membrane Matrix
 *     • (4,3,2) Complex Architectural Cage
 *     • (5,4,3) Ultra High-Order Resonant Crystal
 *     • (2,3,1) Cylindrical Bessel / Circular Plate Modes
 * - Chamber Geometry Selector (Cube / Cylinder / Sphere or Square / Circle Plate).
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
export type CymaticsApparatus = '2d-plate' | '3d-droplet' | '3d-particles' | '3d-both';

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
  showEnclosure: boolean;
  audioCoupled: boolean;
  couplingSensitivity: number;
  chamberLengthX: number; // in meters
  chamberLengthY: number; // in meters
  chamberLengthZ: number; // in meters
  calculatedEigenfrequency: number;
  noteInfo: NoteInfo;
  apparatus: CymaticsApparatus;
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
      description: 'Dense architectural interference patterns throughout space.',
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

    // Initial state: (1,1,1) Ground state in 3D Acoustic Cavity
    this.state = {
      n: 1,
      m: 1,
      l: 1,
      geometry: 'cube',
      trappingMode: 'nodes',
      showEnclosure: false,
      audioCoupled: true,
      couplingSensitivity: 1.0,
      chamberLengthX: 1.0,
      chamberLengthY: 1.0,
      chamberLengthZ: 1.0,
      calculatedEigenfrequency: 0,
      noteInfo: { name: 'D4', octave: 4, frequency: 297, cents: 0 },
      apparatus: '3d-both',
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

    window.addEventListener('cymatics-layers-changed', () => {
      if (this.isVisible) {
        this.render();
      }
    });

    window.addEventListener('cymatics-apparatus-changed', ((e: CustomEvent<{ apparatus: CymaticsApparatus }>) => {
      if (e.detail?.apparatus && e.detail.apparatus !== this.state.apparatus) {
        this.state.apparatus = e.detail.apparatus;
        this.notifyStateChange();
        this.render();
      }
    }) as EventListener);
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
    const kz = this.state.apparatus === '2d-plate' ? 0.0 : l / this.state.chamberLengthZ;
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

  public setApparatus(apparatus: CymaticsApparatus): void {
    this.state.apparatus = apparatus;
    if (this.visualizer) {
      if (apparatus === '2d-plate') {
        this.visualizer.setStyle('cymatics-2d');
      } else {
        this.visualizer.setStyle('cymatics');
        const visMode = apparatus === '3d-droplet' ? 'droplet' : apparatus === '3d-particles' ? 'particles' : 'both';
        this.visualizer.setCymaticsVisibilityMode(visMode);
      }
    }
    this.notifyStateChange();
    this.render();
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

    const { n, m, l, geometry, trappingMode, showEnclosure, audioCoupled, calculatedEigenfrequency, noteInfo, apparatus } = this.state;
    const is2D = apparatus === '2d-plate';
    const totalNodalCells = is2D ? n * m : n * m * l;
    const isPlayingSynth = this.audioEngine.synthesizer?.getIsPlaying() ?? false;

    this.element.innerHTML = `
      <!-- Acoustic Studio Hub Switcher -->
      <div class="glass-panel p-1 rounded-2xl flex items-center gap-1 bg-slate-900/60 border border-white/10 text-xs mb-1">
        <button id="hub-btn-modal" class="flex-1 py-1 px-1.5 rounded-xl font-bold text-center transition-all cursor-pointer glass-btn-active text-cyan-300 shadow-sm ring-1 ring-cyan-500/30">
          Cymatics
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
                  ${is2D ? '2D Chladni Cymatics' : '3D Standing Waves'}
                </h2>
                <span class="px-1.5 py-0.5 rounded-md text-[9px] font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shrink-0">
                  ${is2D ? '(n, m)' : '(n, m, ℓ)'}
                </span>
              </div>
              <p class="text-[10px] text-gray-400 font-medium">
                ${is2D ? 'Resonant 2D sand plate mandalas' : '3D droplets and volumetric levitation traps'}
              </p>
            </div>
          </div>
        </div>

        <!-- Cymatics Resonator Apparatus Multi-Select (2D vs 3D Layers) -->
        <div class="flex flex-col gap-1">
          <div class="flex items-center justify-between">
            <span class="text-[10px] font-semibold text-gray-300">Cymatics Apparatus:</span>
            <span class="text-[9px] text-cyan-400 font-mono">Multi-Layer</span>
          </div>
          <div class="grid grid-cols-3 gap-1 bg-slate-900/60 p-1 rounded-2xl border border-white/5">
            <button
              data-layer="plate"
              class="btn-layer btn-apparatus py-1.5 px-1 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                (this.visualizer?.getCymaticsLayers().plate ?? apparatus === '2d-plate')
                  ? 'glass-btn-active font-bold text-cyan-300 shadow-sm ring-1 ring-cyan-500/30'
                  : 'text-gray-400 hover:text-gray-200'
              }"
            >
              <span>${(this.visualizer?.getCymaticsLayers().plate ?? apparatus === '2d-plate') ? '✓ ' : ''}2D Sand Plate</span>
            </button>
            <button
              data-layer="droplet"
              class="btn-layer btn-apparatus py-1.5 px-1 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                (this.visualizer?.getCymaticsLayers().droplet ?? (apparatus === '3d-droplet' || apparatus === '3d-both'))
                  ? 'glass-btn-active font-bold text-cyan-300 shadow-sm ring-1 ring-cyan-500/30'
                  : 'text-gray-400 hover:text-gray-200'
              }"
            >
              <span>${(this.visualizer?.getCymaticsLayers().droplet ?? (apparatus === '3d-droplet' || apparatus === '3d-both')) ? '✓ ' : ''}3D Droplet</span>
            </button>
            <button
              data-layer="trap"
              class="btn-layer btn-apparatus py-1.5 px-1 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                (this.visualizer?.getCymaticsLayers().trap ?? (apparatus === '3d-particles' || apparatus === '3d-both'))
                  ? 'glass-btn-active font-bold text-cyan-300 shadow-sm ring-1 ring-cyan-500/30'
                  : 'text-gray-400 hover:text-gray-200'
              }"
            >
              <span>${(this.visualizer?.getCymaticsLayers().trap ?? (apparatus === '3d-particles' || apparatus === '3d-both')) ? '✓ ' : ''}3D Trap</span>
            </button>
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

        <!-- Middle Section: (n, m, l) Modal Sliders & Steppers -->
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
              <span>1 (Fundamental)</span>
              <span>4 (Harmonic)</span>
              <span>8 (High)</span>
            </div>
          </div>

          <!-- m: Y-Axis / Transverse Azimuthal Mode -->
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
              <span>1 (Fundamental)</span>
              <span>4 (Harmonic)</span>
              <span>8 (High)</span>
            </div>
          </div>

          <!-- l: Z-Axis (Axial / Height Mode) -->
          ${
            !is2D
              ? `
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
          `
              : ''
          }

        </div>

        <!-- Chamber Physics & Boundary Controls -->
        <div class="flex flex-col gap-2.5 pt-1">
          
          <!-- 1. Chamber Geometry Selector -->
          <div class="flex flex-col gap-1">
            <span class="text-[10px] font-semibold text-gray-300">${is2D ? 'Plate Geometry:' : 'Chamber Shape:'}</span>
            <div class="glass-panel p-1 rounded-2xl flex items-center gap-1 bg-slate-900/60 border-white/5">
              ${
                is2D
                  ? [
                      { id: 'cube', label: 'Square Plate' },
                      { id: 'cylinder', label: 'Circular Bessel Plate' },
                    ]
                      .map(
                        g => `
                    <button
                      data-geometry="${g.id}"
                      class="btn-geometry flex-1 py-1.5 px-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                        geometry === g.id || (geometry === 'sphere' && g.id === 'cylinder')
                          ? 'glass-btn-active font-bold shadow-sm'
                          : 'text-gray-400 hover:text-gray-200'
                      }"
                    >
                      <span>${g.label}</span>
                    </button>
                  `
                      )
                      .join('')
                  : [
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
                      .join('')
              }
            </div>
          </div>

          <!-- 2. Chamber Boundary Enclosure Selector (for 3D modes) -->
          ${
            !is2D
              ? `
          <div class="flex flex-col gap-1">
            <span class="text-[10px] font-semibold text-gray-300">Chamber Boundary:</span>
            <div class="glass-panel p-1 rounded-2xl flex items-center gap-1 bg-slate-900/60 border-white/5">
              <button
                id="btn-enclosure-glass"
                class="flex-1 py-1.5 px-2 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                  showEnclosure ? 'glass-btn-active font-bold text-cyan-300 shadow-sm' : 'text-gray-400 hover:text-gray-200'
                }"
              >
                <span>Glass Box</span>
              </button>
              <button
                id="btn-enclosure-free"
                class="flex-1 py-1.5 px-2 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                  !showEnclosure ? 'glass-btn-active font-bold text-cyan-300 shadow-sm' : 'text-gray-400 hover:text-gray-200'
                }"
              >
                <span>Free Field (No Box)</span>
              </button>
            </div>
          </div>
          `
              : ''
          }

          <!-- 3. Trapping Mode Switcher (Radiation Force Levitation) -->
          ${
            !is2D
              ? `
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
          `
              : ''
          }

          <!-- 4. Audio Resonance Coupling Switch -->
          <div class="flex flex-col gap-1">
            <div class="flex items-center justify-between">
              <span class="text-[10px] font-semibold text-gray-300">Sync to Audio Harmonics:</span>
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
              const isSelected = p.n === n && p.m === m && (!is2D ? p.l === l : true) && p.geometry === geometry;
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
                    <span class="font-mono text-xs font-bold text-cyan-400">(${p.n},${p.m}${is2D ? '' : ',' + p.l})</span>
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
    const { n, m, l, calculatedEigenfrequency, noteInfo, apparatus } = this.state;
    const is2D = apparatus === '2d-plate';

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
      totalCellsEl.innerHTML = `Grid: <strong class="text-cyan-400">${is2D ? n * m : n * m * l}</strong> Cells`;
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
  }

  private attachEvents(): void {
    // Hub Navigation Buttons
    this.element.querySelector('#hub-btn-modal')?.addEventListener('click', () => {
      this.onSwitchMode?.('modal');
    });
    this.element.querySelector('#hub-btn-freq')?.addEventListener('click', () => {
      this.onSwitchMode?.('frequency');
    });

    // Apparatus Multi-Select & Switcher (2D Plate vs 3D Droplet vs 3D Trap)
    this.element.querySelectorAll('.btn-layer').forEach(btn => {
      btn.addEventListener('click', e => {
        const target = e.currentTarget as HTMLElement;
        const layer = target.getAttribute('data-layer') as 'plate' | 'droplet' | 'trap';
        if (layer && this.visualizer) {
          const curLayers = this.visualizer.getCymaticsLayers();
          const targetState = !curLayers[layer];
          const otherActive = Object.entries(curLayers).some(([k, v]) => k !== layer && v);
          if (!targetState && !otherActive) {
            return; // Don't allow deselecting the only active layer
          }
          this.visualizer.setCymaticsLayers({ [layer]: targetState });
          if (this.visualizer.getStyle() !== 'cymatics' && this.visualizer.getStyle() !== 'cymatics-2d') {
            this.visualizer.setStyle('cymatics');
          }
          this.notifyStateChange();
          this.render();
        }
      });
    });

    this.element.querySelectorAll('.btn-apparatus:not(.btn-layer)').forEach(btn => {
      btn.addEventListener('click', e => {
        const target = e.currentTarget as HTMLElement;
        const app = target.getAttribute('data-apparatus') as CymaticsApparatus;
        if (app) {
          this.setApparatus(app);
          window.dispatchEvent(new CustomEvent('cymatics-apparatus-changed', { detail: { apparatus: app } }));
        }
      });
    });

    // Audition 1-Click Synth Tone Button
    this.element.querySelector('#btn-audition-eigenfrequency')?.addEventListener('click', () => {
      const synth = this.audioEngine.synthesizer;
      if (!synth) return;

      if (synth.getIsPlaying()) {
        this.audioEngine.stopFrequency();
      } else {
        this.audioEngine.playFrequency(this.state.calculatedEigenfrequency);
      }
      this.render();
    });

    // 1. Modal Order Sliders (n, m, l)
    const sliderN = this.element.querySelector('#slider-mode-n') as HTMLInputElement;
    sliderN?.addEventListener('input', () => {
      this.state.n = parseInt(sliderN.value, 10);
      this.notifyStateChange();
      this.updateDisplay(true);
    });

    const sliderM = this.element.querySelector('#slider-mode-m') as HTMLInputElement;
    sliderM?.addEventListener('input', () => {
      this.state.m = parseInt(sliderM.value, 10);
      this.notifyStateChange();
      this.updateDisplay(true);
    });

    const sliderL = this.element.querySelector('#slider-mode-l') as HTMLInputElement;
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

    // 3. Geometry Buttons (Cube/Square / Cylinder/Circle / Sphere)
    this.element.querySelectorAll('.btn-geometry').forEach(btn => {
      btn.addEventListener('click', e => {
        const target = e.currentTarget as HTMLElement;
        const geom = target.getAttribute('data-geometry') as ChamberGeometry;
        if (geom) {
          this.setGeometry(geom);
        }
      });
    });

    // 3b. Chamber Boundary Enclosure Buttons (Glass Box / Free Field)
    this.element.querySelector('#btn-enclosure-glass')?.addEventListener('click', () => {
      this.state.showEnclosure = true;
      if (this.visualizer) {
        this.visualizer.chamberEnclosure.setVisible(true);
      }
      this.notifyStateChange();
      this.render();
    });

    this.element.querySelector('#btn-enclosure-free')?.addEventListener('click', () => {
      this.state.showEnclosure = false;
      if (this.visualizer) {
        this.visualizer.chamberEnclosure.setVisible(false);
      }
      this.notifyStateChange();
      this.render();
    });

    // 3c. Trapping Mode Buttons (Nodes / Antinodes)
    this.element.querySelector('#btn-trap-nodes')?.addEventListener('click', () => {
      this.setTrappingMode('nodes');
    });

    this.element.querySelector('#btn-trap-antinodes')?.addEventListener('click', () => {
      this.setTrappingMode('antinodes');
    });

    // 4. Audio Resonance Coupling Toggle
    this.element.querySelector('#btn-toggle-coupling')?.addEventListener('click', () => {
      this.setAudioCoupled(!this.state.audioCoupled);
    });

    // 5. Preset Buttons
    this.element.querySelectorAll('.btn-preset-card').forEach(btn => {
      btn.addEventListener('click', e => {
        const target = e.currentTarget as HTMLElement;
        const presetId = target.getAttribute('data-preset');
        if (presetId) {
          this.applyPreset(presetId);
        }
      });
    });
  }
}
