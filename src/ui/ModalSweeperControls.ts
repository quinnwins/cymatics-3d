/**
 * ModalSweeperControls.ts
 * SoundForm 3D — 3D Resonator Shapes, Physical Apparatus & Geometry Inspector
 *
 * Dedicated 3D shape and acoustic boundary deck:
 * 1. Resonator Apparatus: 2D Sand Plate, 3D Droplet, 3D Particle Levitation Trap.
 * 2. Chamber Geometry: Cube / Square Plate, Cylinder / Bessel Rings, Sphere / Harmonics.
 * 3. Harmonic Modal Orders: Interactive (n, m, ℓ) 3-axis harmonic modal order sliders & steppers with geometry-adaptive labels.
 * 4. 1-Click Instant Eigenstate Presets: Crossing Planes, 3D Grid Lattice, Honeycomb Trap, Harmonic Cage, Resonant Crystal, Bessel Rings, Spherical Shells.
 * 5. Boundaries & Trapping: Glass Box Enclosure vs Free Field, Node Trapping (Normal) vs Antinodes (Inverse).
 * 6. Live Audio Resonance Coupling: Links real-time FFT spectrum to physical harmonic weights.
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
  private isVisible = true;
  private isOpen = true;
  private currentMode: EngineMode = 'frequency';

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

  constructor(
    private audioEngine: AudioEngine,
    private visualizer?: VisualizerEngine,
    private onStateChange?: (state: ModalSweeperState) => void,
    onSwitchMode?: (mode: EngineMode) => void
  ) {
    this.onSwitchMode = onSwitchMode;
    const is2D = this.visualizer?.getStyle() === 'cymatics-2d';
    const visLayers = this.visualizer?.getCymaticsLayers ? this.visualizer.getCymaticsLayers() : { plate: false, droplet: true, trap: true };

    let initialApparatus: CymaticsApparatus = '3d-both';
    if (is2D || (visLayers.plate && !visLayers.droplet && !visLayers.trap)) {
      initialApparatus = '2d-plate';
    } else if (visLayers.droplet && !visLayers.trap) {
      initialApparatus = '3d-droplet';
    } else if (visLayers.trap && !visLayers.droplet) {
      initialApparatus = '3d-particles';
    }

    this.state = {
      n: 1,
      m: 1,
      l: 1,
      geometry: 'cube',
      trappingMode: 'nodes',
      showEnclosure:
        this.visualizer?.chamberEnclosure && typeof (this.visualizer.chamberEnclosure as any).getVisible === 'function'
          ? (this.visualizer.chamberEnclosure as any).getVisible()
          : false,
      audioCoupled: true,
      couplingSensitivity: 1.0,
      chamberLengthX: 1.0,
      chamberLengthY: 1.0,
      chamberLengthZ: 1.0,
      calculatedEigenfrequency: 297.0, // (1,1,1) ground state default
      noteInfo: WavePhysics.frequencyToNote(297.0),
      apparatus: initialApparatus,
    };

    this.element = document.createElement('div');
    this.element.className = 'w-full flex flex-col gap-2.5 select-none transition-all duration-300';
    this.preventEventBleeding();
    this.recalculatePhysics();
    this.render();
  }

  private preventEventBleeding(): void {
    this.element.addEventListener('wheel', e => e.stopPropagation(), { passive: false });
  }

  public setVisualizer(visualizer: VisualizerEngine): void {
    this.visualizer = visualizer;
  }

  public getElement(): HTMLElement {
    return this.element;
  }

  public setVisible(visible: boolean): void {
    this.isVisible = visible;
    this.element.style.display = visible ? 'flex' : 'none';
  }

  public setOpen(open: boolean): void {
    this.isOpen = open;
    this.render();
  }

  public getIsOpen(): boolean {
    return this.isOpen;
  }

  public setMode(mode: EngineMode): void {
    const normalized = mode === 'cymatics' ? 'music' : mode === 'modal' ? 'frequency' : mode;
    if (this.currentMode === normalized) return;
    this.currentMode = normalized;
    if (normalized === 'music') {
      this.state.audioCoupled = true;
    }
    this.render();
  }

  public getMode(): EngineMode {
    return this.currentMode;
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
        detail: { ...this.state, source: 'modal-sweeper' },
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

  private getAxisLabelN(geometry: ChamberGeometry, is2D: boolean): string {
    if (is2D) return geometry === 'cylinder' ? 'Bessel Rings (n)' : 'Width (n)';
    if (geometry === 'cylinder') return 'Bessel Rings (n)';
    if (geometry === 'sphere') return 'Radial Shells (n)';
    return 'Width X (n)';
  }

  private getAxisLabelM(geometry: ChamberGeometry, is2D: boolean): string {
    if (is2D) return geometry === 'cylinder' ? 'Radial Petals (m)' : 'Height (m)';
    if (geometry === 'cylinder') return 'Radial Petals (m)';
    if (geometry === 'sphere') return 'Meridians (m)';
    return 'Height Y (m)';
  }

  private getAxisLabelL(geometry: ChamberGeometry): string {
    if (geometry === 'cylinder') return 'Axial Disks (ℓ)';
    if (geometry === 'sphere') return 'Cones / Polar (ℓ)';
    return 'Depth Z (ℓ)';
  }

  public render(): void {
    if (!this.isVisible) {
      this.element.style.display = 'none';
      return;
    } else {
      this.element.style.display = 'flex';
    }

    const { n, m, l, geometry, trappingMode, showEnclosure, audioCoupled, calculatedEigenfrequency, noteInfo, apparatus } = this.state;
    const is2D = apparatus === '2d-plate';
    const totalNodalCells = is2D ? n * m : n * m * l;
    const isPlayingSynth = this.audioEngine.synthesizer?.getIsPlaying() ?? false;

    const isMusicMode = this.currentMode === 'music' || this.currentMode === 'cymatics';
    const labelN = this.getAxisLabelN(geometry, is2D);
    const labelM = this.getAxisLabelM(geometry, is2D);
    const labelL = this.getAxisLabelL(geometry);

    const pctN = Math.round(((n - 1) / 7) * 100);
    const pctM = Math.round(((m - 1) / 7) * 100);
    const pctL = Math.round(((l - 1) / 7) * 100);

    this.element.innerHTML = `
      <div class="glass-panel w-full p-3.5 sm:p-4 rounded-3xl flex flex-col gap-2.5 shadow-xl border border-white/10 relative text-white select-none backdrop-blur-xl transition-all duration-300">
        
        <!-- Accordion Header -->
        <button id="btn-toggle-modal-accordion" class="w-full flex items-center justify-between cursor-pointer group text-left">
          <div class="flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-cyan-400 shadow-sm shadow-cyan-400/50"></span>
            <span class="text-xs font-bold text-slate-200 tracking-wide">Resonator Shapes & Geometry</span>
          </div>
          <div class="flex items-center gap-1.5 shrink-0">
            <span id="modal-header-summary" class="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-900 border border-white/10 text-cyan-300 font-semibold">
              ${isMusicMode ? `${geometry.toUpperCase()} • ${trappingMode === 'nodes' ? 'NODES' : 'ANTI'}` : `(${n},${m},${is2D ? '0' : l}) • ${calculatedEigenfrequency.toFixed(0)}Hz`}
            </span>
            <span class="text-xs text-slate-400 group-hover:text-white font-mono">${this.isOpen ? '▲' : '▼'}</span>
          </div>
        </button>

        <!-- Collapsible Body -->
        <div id="modal-accordion-body" class="${this.isOpen ? 'flex' : 'hidden'} flex-col gap-2.5 pt-2 border-t border-white/10 text-xs">
          
          <!-- Cymatics Resonator Apparatus Multi-Select (2D vs 3D Layers) -->
          <div class="flex flex-col gap-1">
            <div class="flex items-center justify-between">
              <span class="text-[10px] font-semibold text-slate-300">Cymatics Apparatus:</span>
              <span class="text-[9px] text-cyan-400 font-mono">Multi-Layer</span>
            </div>
            <div class="grid grid-cols-3 gap-1 bg-slate-950/70 p-1 rounded-xl border border-white/5">
              <button
                data-layer="plate"
                class="btn-layer py-1.5 px-1 rounded-lg text-[10px] font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                  (this.visualizer?.getCymaticsLayers().plate ?? apparatus === '2d-plate')
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/50 ring-1 ring-cyan-400/30 shadow-sm font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }"
              >
                <span>${(this.visualizer?.getCymaticsLayers().plate ?? apparatus === '2d-plate') ? '✓ ' : ''}2D Plate</span>
              </button>
              <button
                data-layer="droplet"
                class="btn-layer py-1.5 px-1 rounded-lg text-[10px] font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                  (this.visualizer?.getCymaticsLayers().droplet ?? (apparatus === '3d-droplet' || apparatus === '3d-both'))
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/50 ring-1 ring-cyan-400/30 shadow-sm font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }"
              >
                <span>${(this.visualizer?.getCymaticsLayers().droplet ?? (apparatus === '3d-droplet' || apparatus === '3d-both')) ? '✓ ' : ''}3D Droplet</span>
              </button>
              <button
                data-layer="trap"
                class="btn-layer py-1.5 px-1 rounded-lg text-[10px] font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                  (this.visualizer?.getCymaticsLayers().trap ?? (apparatus === '3d-particles' || apparatus === '3d-both'))
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/50 ring-1 ring-cyan-400/30 shadow-sm font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }"
              >
                <span>${(this.visualizer?.getCymaticsLayers().trap ?? (apparatus === '3d-particles' || apparatus === '3d-both')) ? '✓ ' : ''}3D Trap</span>
              </button>
            </div>
          </div>

          ${
            !isMusicMode
              ? `
          <!-- Resonant Eigenfrequency Telemetry & Audition Pitch Pill (Frequencies Lab Mode Only) -->
          <div class="glass-panel p-2 rounded-xl flex items-center justify-between gap-2 bg-slate-950/80 border-white/10 shadow-inner">
            <div class="flex flex-col">
              <span class="text-[8px] uppercase tracking-wider text-slate-400 font-semibold">Resonant Frequency</span>
              <div class="flex items-baseline gap-1.5 font-mono">
                <span id="modal-freq-val" class="text-xs sm:text-sm font-bold text-cyan-400 tabular-nums">${calculatedEigenfrequency.toFixed(1)} Hz</span>
                <span id="modal-note-name" class="text-[11px] font-semibold text-blue-400">${noteInfo.name}</span>
                <span id="modal-note-cents" class="text-[9px] text-slate-400 tabular-nums">${noteInfo.cents >= 0 ? '+' : ''}${noteInfo.cents}c</span>
              </div>
            </div>

            <!-- 1-Click Synth Audition Button -->
            <button
              id="btn-audition-eigenfrequency"
              title="Listen to resonant tone"
              class="glass-btn px-2.5 py-1 rounded-xl text-[10px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                isPlayingSynth
                  ? 'bg-cyan-400 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-200 hover:text-white'
              }"
            >
              <span>${isPlayingSynth ? 'Stop Tone' : 'Audition Tone'}</span>
            </button>
          </div>
          `
              : ''
          }

          ${
            !isMusicMode
              ? `
          <!-- (n, m, l) Modal Sliders & Steppers with Geometry-Adaptive Labels (Frequencies Lab Mode Only) -->
          <div class="flex flex-col gap-1.5 w-full min-w-0">
            
            <!-- n: Primary Axis / Bessel Rings / Radial Shells -->
            <div class="glass-panel p-2 rounded-xl flex flex-col gap-1.5 bg-slate-950/60 border-white/5 w-full min-w-0">
              <div class="flex items-center justify-between w-full min-w-0">
                <div class="flex items-center gap-1.5 min-w-0">
                  <span class="w-2 h-2 rounded-full bg-cyan-400 shadow-sm shadow-cyan-400/50 shrink-0"></span>
                  <span class="text-[11px] font-bold text-slate-200 truncate">${labelN}</span>
                </div>
                <span id="badge-mode-n" class="font-mono text-[10px] font-bold text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-500/30 shrink-0">
                  ${n}
                </span>
              </div>

              <div class="flex items-center gap-2 w-full min-w-0">
                <button data-axis="n" data-dir="-1" aria-label="Decrease n" class="btn-step flex items-center justify-center cursor-pointer select-none">
                  −
                </button>
                <input
                  type="range"
                  id="slider-mode-n"
                  min="1"
                  max="8"
                  step="1"
                  value="${n}"
                  aria-label="Modal order n slider"
                  aria-valuemin="1"
                  aria-valuemax="8"
                  aria-valuenow="${n}"
                  style="background: linear-gradient(to right, #22d3ee ${pctN}%, rgba(255, 255, 255, 0.1) ${pctN}%);"
                  class="flex-1 min-w-0 w-full cursor-pointer slider-cyan"
                />
                <button data-axis="n" data-dir="1" aria-label="Increase n" class="btn-step flex items-center justify-center cursor-pointer select-none">
                  +
                </button>
              </div>
            </div>

            <!-- m: Secondary Axis / Petals / Meridians -->
            <div class="glass-panel p-2 rounded-xl flex flex-col gap-1.5 bg-slate-950/60 border-white/5 w-full min-w-0">
              <div class="flex items-center justify-between w-full min-w-0">
                <div class="flex items-center gap-1.5 min-w-0">
                  <span class="w-2 h-2 rounded-full bg-blue-400 shadow-sm shadow-blue-400/50 shrink-0"></span>
                  <span class="text-[11px] font-bold text-slate-200 truncate">${labelM}</span>
                </div>
                <span id="badge-mode-m" class="font-mono text-[10px] font-bold text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/30 shrink-0">
                  ${m}
                </span>
              </div>

              <div class="flex items-center gap-2 w-full min-w-0">
                <button data-axis="m" data-dir="-1" aria-label="Decrease m" class="btn-step flex items-center justify-center cursor-pointer select-none">
                  −
                </button>
                <input
                  type="range"
                  id="slider-mode-m"
                  min="1"
                  max="8"
                  step="1"
                  value="${m}"
                  aria-label="Modal order m slider"
                  aria-valuemin="1"
                  aria-valuemax="8"
                  aria-valuenow="${m}"
                  style="background: linear-gradient(to right, #60a5fa ${pctM}%, rgba(255, 255, 255, 0.1) ${pctM}%);"
                  class="flex-1 min-w-0 w-full cursor-pointer slider-blue"
                />
                <button data-axis="m" data-dir="1" aria-label="Increase m" class="btn-step flex items-center justify-center cursor-pointer select-none">
                  +
                </button>
              </div>
            </div>

            <!-- l: Tertiary Axis / Axial Disks / Cones -->
            ${
              !is2D
                ? `
            <div class="glass-panel p-2 rounded-xl flex flex-col gap-1.5 bg-slate-950/60 border-white/5 w-full min-w-0">
              <div class="flex items-center justify-between w-full min-w-0">
                <div class="flex items-center gap-1.5 min-w-0">
                  <span class="w-2 h-2 rounded-full bg-purple-400 shadow-sm shadow-purple-400/50 shrink-0"></span>
                  <span class="text-[11px] font-bold text-slate-200 truncate">${labelL}</span>
                </div>
                <span id="badge-mode-l" class="font-mono text-[10px] font-bold text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/30 shrink-0">
                  ${l}
                </span>
              </div>

              <div class="flex items-center gap-2 w-full min-w-0">
                <button data-axis="l" data-dir="-1" aria-label="Decrease l" class="btn-step flex items-center justify-center cursor-pointer select-none">
                  −
                </button>
                <input
                  type="range"
                  id="slider-mode-l"
                  min="1"
                  max="8"
                  step="1"
                  value="${l}"
                  aria-label="Modal order l slider"
                  aria-valuemin="1"
                  aria-valuemax="8"
                  aria-valuenow="${l}"
                  style="background: linear-gradient(to right, #c084fc ${pctL}%, rgba(255, 255, 255, 0.1) ${pctL}%);"
                  class="flex-1 min-w-0 w-full cursor-pointer slider-purple"
                />
                <button data-axis="l" data-dir="1" aria-label="Increase l" class="btn-step flex items-center justify-center cursor-pointer select-none">
                  +
                </button>
              </div>
            </div>
            `
                : ''
            }
          </div>
          `
              : ''
          }

          <!-- Chamber Geometry & Boundaries -->
          <div class="flex flex-col gap-2 pt-1">
            <!-- Geometry Selector -->
            <div class="flex flex-col gap-1">
              <span class="text-[10px] font-semibold text-slate-300">${is2D ? 'Plate Geometry:' : 'Chamber Shape:'}</span>
              <div class="segmented-track p-1">
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
                        class="btn-geometry segmented-pill flex-1 flex items-center justify-center gap-1 ${
                          geometry === g.id || (geometry === 'sphere' && g.id === 'cylinder')
                            ? 'is-active glass-btn-active'
                            : ''
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
                        class="btn-geometry segmented-pill flex-1 flex items-center justify-center gap-1 ${
                          geometry === g.id
                            ? 'is-active glass-btn-active'
                            : ''
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

            <!-- Boundary Enclosure & Particle Trapping -->
            ${
              !is2D
                ? `
            <div class="grid grid-cols-2 gap-1.5">
              <!-- Enclosure Box -->
              <div class="flex flex-col gap-1">
                <span class="text-[9px] font-semibold text-slate-400">Boundary:</span>
                <div class="segmented-track p-0.5">
                  <button
                    id="btn-enclosure-glass"
                    class="segmented-pill flex-1 py-1 text-[9px] font-semibold ${
                      showEnclosure ? 'is-active glass-btn-active' : ''
                    }"
                  >
                    Box
                  </button>
                  <button
                    id="btn-enclosure-free"
                    class="segmented-pill flex-1 py-1 text-[9px] font-semibold ${
                      !showEnclosure ? 'is-active glass-btn-active' : ''
                    }"
                  >
                    Free
                  </button>
                </div>
              </div>

              <!-- Trapping Mode -->
              <div class="flex flex-col gap-1">
                <span class="text-[9px] font-semibold text-slate-400">Trapping:</span>
                <div class="segmented-track p-0.5">
                  <button
                    id="btn-trap-nodes"
                    title="Heavy Sand on Nodal Lines (Zero Motion)"
                    class="segmented-pill flex-1 py-1 text-[9px] font-semibold ${
                      trappingMode === 'nodes' ? 'is-active glass-btn-active' : ''
                    }"
                  >
                    Nodes
                  </button>
                  <button
                    id="btn-trap-antinodes"
                    title="Levitation Beads at Antinodes (Max Sound Pressure)"
                    class="segmented-pill flex-1 py-1 text-[9px] font-semibold ${
                      trappingMode === 'antinodes' ? 'is-active glass-btn-active' : ''
                    }"
                  >
                    Anti
                  </button>
                </div>
              </div>
            </div>
            `
                : ''
            }

            ${
              !isMusicMode
                ? `
            <!-- Sync to Audio (Tone Lab Mode) -->
            <button
              id="btn-toggle-coupling"
              class="w-full py-1.5 px-2.5 rounded-xl text-[10px] font-semibold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                audioCoupled
                  ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300 shadow-sm font-bold'
                  : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
              }"
            >
              <span>${audioCoupled ? '✓ Audio Resonance Coupling ON' : 'Audio Resonance Coupling OFF'}</span>
            </button>
            `
                : ''
            }
          </div>

          ${
            !isMusicMode
              ? `
          <!-- Wave Presets Section (Frequencies Lab Mode Only) -->
          <div class="flex flex-col gap-1.5 pt-2 border-t border-white/10">
            <div class="flex items-center justify-between">
              <span class="text-[10px] font-bold text-slate-300">1-Click Standing Wave Presets:</span>
              <span id="modal-total-cells" class="text-[9px] text-slate-400 font-mono">
                Grid: <strong class="text-cyan-400">${totalNodalCells}</strong> Cells
              </span>
            </div>

            <div class="grid grid-cols-1 gap-1">
              ${ModalSweeperControls.PRESETS.map(p => {
                const isSelected = p.n === n && p.m === m && (!is2D ? p.l === l : true) && p.geometry === geometry;
                return `
                  <button
                    data-preset="${p.id}"
                    class="btn-preset-card glass-panel p-2 rounded-xl flex items-center justify-between text-left transition-all hover:border-slate-600 active:scale-[0.99] cursor-pointer ${
                      isSelected
                        ? 'border-cyan-500/60 shadow-sm bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-400/30 font-bold'
                        : 'hover:border-white/20 bg-slate-950/60 border-white/5'
                    }"
                  >
                    <div class="flex items-center gap-1.5 min-w-0">
                      <span class="font-mono text-[10px] font-bold text-cyan-400 shrink-0">(${p.n},${p.m}${is2D ? '' : ',' + p.l})</span>
                      <span class="text-[10px] font-semibold text-slate-200 truncate">${p.name}</span>
                    </div>
                    <span class="text-[8px] px-1.5 py-0.5 rounded bg-slate-900 font-semibold text-slate-300 border border-slate-700 shrink-0">${p.badge}</span>
                  </button>
                `;
              }).join('')}
            </div>
          </div>
          `
              : ''
          }

        </div>
      </div>
    `;

    this.attachEvents();
  }

  private updateDisplay(fromSlider = false): void {
    const { n, m, l, calculatedEigenfrequency, noteInfo, apparatus } = this.state;
    const is2D = apparatus === '2d-plate';
    const isMusicMode = this.currentMode === 'music' || this.currentMode === 'cymatics';

    // Summary badge in header
    const summaryEl = this.element.querySelector('#modal-header-summary');
    if (summaryEl) {
      summaryEl.textContent = isMusicMode
        ? `${this.state.geometry.toUpperCase()} • ${this.state.trappingMode === 'nodes' ? 'NODES' : 'ANTI'}`
        : `(${n},${m},${is2D ? '0' : l}) • ${calculatedEigenfrequency.toFixed(0)}Hz`;
    }

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
      if (sliderN) {
        sliderN.value = n.toString();
        const pct = Math.round(((n - 1) / 7) * 100);
        sliderN.style.background = `linear-gradient(to right, #38bdf8 ${pct}%, rgba(255, 255, 255, 0.1) ${pct}%)`;
      }
      const sliderM = this.element.querySelector('#slider-mode-m') as HTMLInputElement;
      if (sliderM) {
        sliderM.value = m.toString();
        const pct = Math.round(((m - 1) / 7) * 100);
        sliderM.style.background = `linear-gradient(to right, #38bdf8 ${pct}%, rgba(255, 255, 255, 0.1) ${pct}%)`;
      }
      const sliderL = this.element.querySelector('#slider-mode-l') as HTMLInputElement;
      if (sliderL) {
        sliderL.value = l.toString();
        const pct = Math.round(((l - 1) / 7) * 100);
        sliderL.style.background = `linear-gradient(to right, #38bdf8 ${pct}%, rgba(255, 255, 255, 0.1) ${pct}%)`;
      }
    }
  }

  private attachEvents(): void {
    // Accordion Toggle
    this.element.querySelector('#btn-toggle-modal-accordion')?.addEventListener('click', () => {
      this.isOpen = !this.isOpen;
      this.render();
    });

    // Apparatus Multi-Select (2D Plate vs 3D Droplet vs 3D Trap)
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

    // Audition 1-Click Synth Tone Button
    this.element.querySelector('#btn-audition-eigenfrequency')?.addEventListener('click', async () => {
      await this.audioEngine.initialize();
      const synth = this.audioEngine.synthesizer;
      if (!synth) return;

      if (synth.getIsPlaying()) {
        this.audioEngine.stopFrequency();
      } else {
        await this.audioEngine.playFrequency(this.state.calculatedEigenfrequency);
        window.dispatchEvent(
          new CustomEvent('frequency-changed', {
            detail: { frequency: this.state.calculatedEigenfrequency, source: 'modal-sweeper' },
          })
        );
      }
      this.render();
    });

    // 1. Modal Order Sliders (n, m, l)
    const sliderN = this.element.querySelector('#slider-mode-n') as HTMLInputElement;
    sliderN?.addEventListener('input', () => {
      this.state.n = parseInt(sliderN.value, 10);
      const pct = Math.round(((this.state.n - 1) / 7) * 100);
      sliderN.style.background = `linear-gradient(to right, #38bdf8 ${pct}%, rgba(255, 255, 255, 0.1) ${pct}%)`;
      this.notifyStateChange();
      this.updateDisplay(true);
    });

    const sliderM = this.element.querySelector('#slider-mode-m') as HTMLInputElement;
    sliderM?.addEventListener('input', () => {
      this.state.m = parseInt(sliderM.value, 10);
      const pct = Math.round(((this.state.m - 1) / 7) * 100);
      sliderM.style.background = `linear-gradient(to right, #38bdf8 ${pct}%, rgba(255, 255, 255, 0.1) ${pct}%)`;
      this.notifyStateChange();
      this.updateDisplay(true);
    });

    const sliderL = this.element.querySelector('#slider-mode-l') as HTMLInputElement;
    sliderL?.addEventListener('input', () => {
      this.state.l = parseInt(sliderL.value, 10);
      const pct = Math.round(((this.state.l - 1) / 7) * 100);
      sliderL.style.background = `linear-gradient(to right, #38bdf8 ${pct}%, rgba(255, 255, 255, 0.1) ${pct}%)`;
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
