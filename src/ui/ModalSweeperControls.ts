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
 * - Chamber Geometry Selector (📦 Cube / 🧪 Cylinder / 🔮 Sphere).
 * - Trapping Mode Switcher (⚪ Normal Nodes / ⚫ Inverse Antinodes) for acoustic levitation.
 * - Live Audio Resonance Coupling toggle (links real-time FFT spectrum to harmonic weights).
 * - Theoretical Eigenfrequency Calculator (f_{n,m,ℓ}) with 1-click Synth Audition.
 */

import { AudioEngine } from '../audio/AudioEngine';
import { VisualizerEngine } from '../visualizer/VisualizerEngine';
import { WavePhysics, NoteInfo } from '../math/WavePhysics';

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

  public static readonly PRESETS: ModalPreset[] = [
    {
      id: 'fundamental-crossing',
      n: 1,
      m: 1,
      l: 1,
      name: 'Fundamental Crossing Planes',
      subtitle: '(1,1,1) Mode',
      geometry: 'cube',
      description: 'Orthogonal nodal boundary planes partitioning the chamber into 8 primary acoustic octants.',
      badge: '✨ Ground State',
    },
    {
      id: 'cubic-lattice',
      n: 2,
      m: 2,
      l: 1,
      name: '3D Cubic Lattice Cells',
      subtitle: '(2,2,1) Mode',
      geometry: 'cube',
      description: 'Symmetric matrix of acoustic standing wave traps forming 3D levitation grid cages.',
      badge: '📦 Stable Trap',
    },
    {
      id: 'honeycomb-membrane',
      n: 3,
      m: 2,
      l: 2,
      name: 'Honeycomb Membrane Matrix',
      subtitle: '(3,2,2) Mode',
      geometry: 'cylinder',
      description: 'Interlocking cylindrical radial Bessel rings creating hex-like standing wave interference.',
      badge: '🧪 Fluid Mesh',
    },
    {
      id: 'architectural-cage',
      n: 4,
      m: 3,
      l: 2,
      name: 'Complex Architectural Cage',
      subtitle: '(4,3,2) Mode',
      geometry: 'cube',
      description: 'High-order modal interference yielding multi-layered volumetric acoustic containment shells.',
      badge: '🏛️ Harmonic Cage',
    },
    {
      id: 'resonant-crystal',
      n: 5,
      m: 4,
      l: 3,
      name: 'Ultra High-Order Resonant Crystal',
      subtitle: '(5,4,3) Mode',
      geometry: 'sphere',
      description: 'Tessellated spherical harmonic eigenmode exhibiting dense crystalline nodal facets.',
      badge: '🔮 Polyhedral Gem',
    },
  ];

  constructor(
    private audioEngine: AudioEngine,
    private visualizer?: VisualizerEngine,
    private onStateChange?: (state: ModalSweeperState) => void
  ) {
    this.element = document.createElement('div');
    this.element.className = 'w-full flex flex-col items-center gap-2.5 transition-all duration-300';

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
  }

  public getElement(): HTMLElement {
    this.render();
    return this.element;
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
    const { n, m, l, geometry, trappingMode, audioCoupled, calculatedEigenfrequency, noteInfo } = this.state;
    const totalNodalCells = n * m * l;
    const isPlayingSynth = this.audioEngine.synthesizer?.getIsPlaying() ?? false;

    this.element.innerHTML = `
      <div class="glass-panel w-full max-w-4xl p-4 md:p-5 rounded-3xl flex flex-col gap-3.5 shadow-2xl border-white/10 relative overflow-hidden backdrop-blur-2xl">
        
        <!-- Top Title & Telemetry Header Bar -->
        <div class="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
          
          <!-- Left: Suite Icon & Title Badge -->
          <div class="flex items-center gap-2.5">
            <div class="w-10 h-10 rounded-2xl bg-gradient-to-tr from-accent-cyan via-accent-blue to-accent-magenta flex items-center justify-center shadow-lg shadow-accent-cyan/25 emitter-glow">
              <svg class="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                <path d="M2 17l10 5 10-5"/>
                <path d="M2 12l10 5 10-5"/>
              </svg>
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h2 class="text-sm md:text-base font-bold bg-gradient-to-r from-white via-cyan-100 to-cyan-300 bg-clip-text text-transparent">
                  3D Modal Sweeper & Cavity Resonator
                </h2>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/40">
                  (n, m, ℓ) Eigenstate
                </span>
              </div>
              <p class="text-[11px] text-gray-400 font-medium">
                Real-time 3D standing wave nodal surfaces & acoustic radiation trapping
              </p>
            </div>
          </div>

          <!-- Right: Theoretical Resonant Frequency Telemetry & Audition Button -->
          <div class="flex items-center gap-2.5">
            <div class="glass-panel px-3 py-1.5 rounded-xl flex items-center gap-2 border-accent-blue/30 bg-black/40">
              <div class="flex flex-col items-end">
                <span class="text-[9px] uppercase tracking-wider text-gray-400 font-semibold">Resonant Eigenfrequency</span>
                <div class="flex items-baseline gap-1.5 font-mono">
                  <span class="text-sm font-bold text-accent-cyan">${calculatedEigenfrequency.toFixed(1)} Hz</span>
                  <span class="text-xs font-semibold text-accent-blue">${noteInfo.name}</span>
                  <span class="text-[10px] text-gray-400">${noteInfo.cents >= 0 ? '+' : ''}${noteInfo.cents}c</span>
                </div>
              </div>
            </div>

            <!-- 1-Click Synth Audition Button -->
            <button
              id="btn-audition-eigenfrequency"
              title="Audition this exact resonant eigenfrequency through the synthesizer"
              class="glass-btn px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                isPlayingSynth ? 'glass-btn-active text-accent-cyan' : 'text-gray-200 hover:text-white'
              }"
            >
              <span>${isPlayingSynth ? '🔊' : '🎵'}</span>
              <span class="hidden sm:inline">${isPlayingSynth ? 'Playing Mode' : 'Audition Pitch'}</span>
            </button>
          </div>

        </div>

        <!-- Middle Section: (n, m, l) Modal Sliders & Steppers -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          
          <!-- n: X-Axis / Transverse Radial Mode -->
          <div class="glass-panel p-3 rounded-2xl flex flex-col gap-2 bg-white/5 border-white/5">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full bg-accent-cyan"></span>
                <span class="text-xs font-bold text-gray-200">Mode n (X / Radial)</span>
              </div>
              <span id="badge-mode-n" class="font-mono text-sm font-bold text-accent-cyan bg-accent-cyan/10 px-2 py-0.5 rounded-lg border border-accent-cyan/30">
                ${n}
              </span>
            </div>

            <div class="flex items-center gap-2">
              <button data-axis="n" data-dir="-1" class="btn-step glass-btn w-7 h-7 rounded-lg text-xs font-bold text-gray-300 hover:text-white flex items-center justify-center">
                −
              </button>
              <input
                type="range"
                id="slider-mode-n"
                min="1"
                max="8"
                step="1"
                value="${n}"
                class="w-full cursor-pointer h-2 accent-accent-cyan"
              />
              <button data-axis="n" data-dir="1" class="btn-step glass-btn w-7 h-7 rounded-lg text-xs font-bold text-gray-300 hover:text-white flex items-center justify-center">
                +
              </button>
            </div>
            <div class="flex justify-between text-[10px] text-gray-400 font-mono">
              <span>1 (Plane)</span>
              <span>4 (Octave)</span>
              <span>8 (Micro-grid)</span>
            </div>
          </div>

          <!-- m: Y-Axis / Azimuthal Polar Mode -->
          <div class="glass-panel p-3 rounded-2xl flex flex-col gap-2 bg-white/5 border-white/5">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full bg-accent-blue"></span>
                <span class="text-xs font-bold text-gray-200">Mode m (Y / Azimuthal)</span>
              </div>
              <span id="badge-mode-m" class="font-mono text-sm font-bold text-accent-blue bg-accent-blue/10 px-2 py-0.5 rounded-lg border border-accent-blue/30">
                ${m}
              </span>
            </div>

            <div class="flex items-center gap-2">
              <button data-axis="m" data-dir="-1" class="btn-step glass-btn w-7 h-7 rounded-lg text-xs font-bold text-gray-300 hover:text-white flex items-center justify-center">
                −
              </button>
              <input
                type="range"
                id="slider-mode-m"
                min="1"
                max="8"
                step="1"
                value="${m}"
                class="w-full cursor-pointer h-2 accent-accent-blue"
              />
              <button data-axis="m" data-dir="1" class="btn-step glass-btn w-7 h-7 rounded-lg text-xs font-bold text-gray-300 hover:text-white flex items-center justify-center">
                +
              </button>
            </div>
            <div class="flex justify-between text-[10px] text-gray-400 font-mono">
              <span>1 (Plane)</span>
              <span>4 (Octave)</span>
              <span>8 (Micro-grid)</span>
            </div>
          </div>

          <!-- l: Z-Axis / Longitudinal Depth Mode -->
          <div class="glass-panel p-3 rounded-2xl flex flex-col gap-2 bg-white/5 border-white/5">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full bg-accent-magenta"></span>
                <span class="text-xs font-bold text-gray-200">Mode ℓ (Z / Depth)</span>
              </div>
              <span id="badge-mode-l" class="font-mono text-sm font-bold text-accent-magenta bg-accent-magenta/10 px-2 py-0.5 rounded-lg border border-accent-magenta/30">
                ${l}
              </span>
            </div>

            <div class="flex items-center gap-2">
              <button data-axis="l" data-dir="-1" class="btn-step glass-btn w-7 h-7 rounded-lg text-xs font-bold text-gray-300 hover:text-white flex items-center justify-center">
                −
              </button>
              <input
                type="range"
                id="slider-mode-l"
                min="1"
                max="8"
                step="1"
                value="${l}"
                class="w-full cursor-pointer h-2 accent-accent-magenta"
              />
              <button data-axis="l" data-dir="1" class="btn-step glass-btn w-7 h-7 rounded-lg text-xs font-bold text-gray-300 hover:text-white flex items-center justify-center">
                +
              </button>
            </div>
            <div class="flex justify-between text-[10px] text-gray-400 font-mono">
              <span>1 (Plane)</span>
              <span>4 (Octave)</span>
              <span>8 (Micro-grid)</span>
            </div>
          </div>

        </div>

        <!-- Geometry, Trapping Mode & Audio Resonance Coupling Strip -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
          
          <!-- 1. Chamber Geometry Selector -->
          <div class="flex flex-col gap-1.5">
            <span class="text-[11px] font-semibold text-gray-300">Chamber Geometry:</span>
            <div class="glass-panel p-1 rounded-2xl flex items-center gap-1 bg-black/30 border-white/5">
              ${[
                { id: 'cube', icon: '📦', label: 'Cube' },
                { id: 'cylinder', icon: '🧪', label: 'Cylinder' },
                { id: 'sphere', icon: '🔮', label: 'Sphere' },
              ]
                .map(
                  g => `
                <button
                  data-geometry="${g.id}"
                  class="btn-geometry flex-1 py-1.5 px-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                    geometry === g.id ? 'glass-btn-active font-bold text-accent-cyan shadow-md' : 'text-gray-400 hover:text-gray-200'
                  }"
                >
                  <span>${g.icon}</span>
                  <span>${g.label}</span>
                </button>
              `
                )
                .join('')}
            </div>
          </div>

          <!-- 2. Trapping Mode Switcher (Radiation Force Levitation) -->
          <div class="flex flex-col gap-1.5">
            <span class="text-[11px] font-semibold text-gray-300">Radiation Force Trapping:</span>
            <div class="glass-panel p-1 rounded-2xl flex items-center gap-1 bg-black/30 border-white/5">
              <button
                id="btn-trap-nodes"
                class="flex-1 py-1.5 px-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  trappingMode === 'nodes' ? 'glass-btn-active font-bold text-accent-emerald shadow-md' : 'text-gray-400 hover:text-gray-200'
                }"
              >
                <span>⚪</span>
                <span>Nodes (p = 0)</span>
              </button>
              <button
                id="btn-trap-antinodes"
                class="flex-1 py-1.5 px-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  trappingMode === 'antinodes' ? 'glass-btn-active font-bold text-accent-magenta shadow-md' : 'text-gray-400 hover:text-gray-200'
                }"
              >
                <span>⚫</span>
                <span>Antinodes</span>
              </button>
            </div>
          </div>

          <!-- 3. Audio Resonance Coupling Switch -->
          <div class="flex flex-col gap-1.5">
            <div class="flex items-center justify-between">
              <span class="text-[11px] font-semibold text-gray-300">Live FFT Coupling:</span>
              <span class="text-[10px] font-mono text-accent-cyan">${audioCoupled ? 'Active' : 'Locked'}</span>
            </div>
            <div class="glass-panel p-1.5 px-3 rounded-2xl flex items-center justify-between gap-2.5 bg-black/30 border-white/5">
              <button
                id="btn-toggle-coupling"
                class="px-2.5 py-1 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  audioCoupled ? 'bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/40' : 'glass-btn text-gray-400'
                }"
              >
                <span class="${audioCoupled ? 'animate-pulse' : ''}">⚡</span>
                <span>${audioCoupled ? 'Spectral Coupling Active' : 'Coupling Disabled'}</span>
              </button>
            </div>
          </div>

        </div>

        <!-- Bottom Row: 5 Instant Precision Presets -->
        <div class="flex flex-col gap-2 pt-2 border-t border-white/10">
          <div class="flex items-center justify-between">
            <span class="text-[11px] font-bold text-gray-300 flex items-center gap-1.5">
              <span>🎯</span>
              <span>Acoustic Eigenstate Presets:</span>
            </span>
            <span class="text-[10px] text-gray-400 font-mono">
              Total Lattice Volume: <strong class="text-accent-cyan">${totalNodalCells}</strong> Cells
            </span>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
            ${ModalSweeperControls.PRESETS.map(p => {
              const isSelected = p.n === n && p.m === m && p.l === l && p.geometry === geometry;
              return `
                <button
                  data-preset="${p.id}"
                  class="btn-preset-card glass-panel p-2.5 rounded-2xl flex flex-col gap-1 text-left transition-all hover:scale-[1.02] active:scale-[0.98] ${
                    isSelected
                      ? 'glass-panel-accent border-accent-cyan/60 shadow-lg shadow-accent-cyan/20 ring-1 ring-accent-cyan'
                      : 'hover:border-white/20 bg-white/5 border-white/5'
                  }"
                >
                  <div class="flex items-center justify-between w-full">
                    <span class="font-mono text-xs font-bold text-accent-cyan">(${p.n},${p.m},${p.l})</span>
                    <span class="text-[9px] px-1.5 py-0.5 rounded-md bg-white/10 font-semibold text-gray-300">${p.badge}</span>
                  </div>
                  <span class="text-xs font-semibold text-gray-100 truncate">${p.name}</span>
                  <span class="text-[10px] text-gray-400 line-clamp-1 leading-tight">${p.description}</span>
                </button>
              `;
            }).join('')}
          </div>
        </div>

      </div>
    `;

    this.attachEvents();
  }

  private attachEvents(): void {
    // 1. Sliders (n, m, l)
    const sliderN = this.element.querySelector('#slider-mode-n') as HTMLInputElement;
    const sliderM = this.element.querySelector('#slider-mode-m') as HTMLInputElement;
    const sliderL = this.element.querySelector('#slider-mode-l') as HTMLInputElement;

    sliderN?.addEventListener('input', () => {
      this.state.n = parseInt(sliderN.value, 10);
      this.notifyStateChange();
      this.render();
    });

    sliderM?.addEventListener('input', () => {
      this.state.m = parseInt(sliderM.value, 10);
      this.notifyStateChange();
      this.render();
    });

    sliderL?.addEventListener('input', () => {
      this.state.l = parseInt(sliderL.value, 10);
      this.notifyStateChange();
      this.render();
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
      this.render();
    });
  }
}
