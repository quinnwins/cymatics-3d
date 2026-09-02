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
import type { FieldShapeType, SuperquadricParams } from '../visualizer/GpuAcousticParticles';

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
  fieldMode: boolean;
  fieldShape: FieldShapeType;
  superquadricParams: SuperquadricParams;
  contourVisible: boolean;
  customMeshName?: string;
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
      fieldMode: false,
      fieldShape: 'free-field',
      superquadricParams: {
        eps1: 1.0,
        eps2: 1.0,
        pinch: 0.0,
        lobes: 0.0,
        lobeAmp: 0.0,
      },
      contourVisible: true,
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
      if (this.visualizer) {
        this.visualizer.cymaticsPlateMesh?.setAutoModal(true);
        this.visualizer.cymaticsMesh?.setAutoModal(true);
      }
      this.notifyStateChange();
    }
    this.render();
  }

  public syncInitialState(): void {
    this.notifyStateChange();
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
        const visMode = apparatus === '3d-droplet' ? 'droplet' : apparatus === '3d-particles' ? 'particles' : 'all';
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

  public setFieldMode(enabled: boolean, shape?: FieldShapeType, params?: Partial<SuperquadricParams>): void {
    this.state.fieldMode = enabled;
    if (shape) this.state.fieldShape = shape;
    if (params) {
      Object.assign(this.state.superquadricParams, params);
    }
    if (this.visualizer) {
      this.visualizer.setFieldMode(enabled, this.state.fieldShape, this.state.superquadricParams);
    }
    this.notifyStateChange();
    this.render();
  }

  public getFieldMode(): boolean {
    return this.state.fieldMode;
  }

  public setFieldShape(shape: FieldShapeType, params?: Partial<SuperquadricParams>): void {
    this.state.fieldShape = shape;
    if (params) {
      Object.assign(this.state.superquadricParams, params);
    }
    if (this.visualizer) {
      this.visualizer.setFieldShape(shape, this.state.superquadricParams);
    }
    this.notifyStateChange();
    this.render();
  }

  public getFieldShape(): FieldShapeType {
    return this.state.fieldShape;
  }

  public setContourVisible(visible: boolean): void {
    this.state.contourVisible = visible;
    if (this.visualizer) {
      this.visualizer.setFieldContourVisible(visible);
    }
    this.notifyStateChange();
    this.render();
  }

  public getContourVisible(): boolean {
    return this.state.contourVisible;
  }

  public loadCustomMeshPreset(preset: 'bunny' | 'teapot' | 'star'): void {
    if (this.visualizer) {
      const parsed = this.visualizer.loadCustomMeshPreset(preset);
      this.state.fieldMode = true;
      this.state.fieldShape = 'custom';
      this.state.customMeshName = parsed.name;
      this.notifyStateChange();
      this.render();
    }
  }

  public loadCustomMeshObj(objText: string, name?: string): void {
    if (this.visualizer) {
      const parsed = this.visualizer.loadCustomMeshObj(objText, name);
      this.state.fieldMode = true;
      this.state.fieldShape = 'custom';
      this.state.customMeshName = parsed.name;
      this.notifyStateChange();
      this.render();
    }
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

    const { n, m, l, geometry, trappingMode, showEnclosure, fieldMode, fieldShape, superquadricParams, contourVisible, customMeshName, audioCoupled, calculatedEigenfrequency, noteInfo, apparatus } = this.state;
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

    const pctEps1 = Math.round(((superquadricParams.eps1 - 0.2) / 3.3) * 100);
    const pctEps2 = Math.round(((superquadricParams.eps2 - 0.2) / 3.3) * 100);
    const pctPinch = Math.round(((superquadricParams.pinch - -0.7) / 1.4) * 100);
    const pctLobes = Math.round((superquadricParams.lobes / 8) * 100);
    const pctLobeAmp = Math.round((superquadricParams.lobeAmp / 0.4) * 100);

    this.element.innerHTML = `
      <div class="glass-panel w-full p-3 sm:p-4 rounded-3xl flex flex-col gap-3 shadow-xl border border-white/10 relative text-white select-none backdrop-blur-xl transition-all duration-300">
        
        <!-- Accordion Header -->
        <button
          id="btn-toggle-modal-accordion"
          aria-expanded="${this.isOpen}"
          aria-controls="modal-accordion-body"
          class="w-full min-h-[44px] py-1 flex items-center justify-between cursor-pointer group text-left rounded-xl transition-all duration-150 active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
        >
          <div class="flex items-center gap-2">
            <span class="w-2 h-2 rounded-full ${fieldMode ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50 animate-pulse' : 'bg-cyan-400 shadow-sm shadow-cyan-400/50'}"></span>
            <span class="text-xs font-bold text-slate-200 tracking-wide">Resonator Shapes & Geometry</span>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <span id="modal-header-summary" class="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-900/90 border border-white/10 ${fieldMode ? 'text-emerald-300' : 'text-cyan-300'} font-semibold tracking-wider">
              ${isMusicMode ? (fieldMode ? `FIELD: ${fieldShape.toUpperCase()} • ${trappingMode === 'nodes' ? 'NODES' : 'ANTI'}` : `${geometry.toUpperCase()} • ${trappingMode === 'nodes' ? 'NODES' : 'ANTI'}`) : `(${n},${m},${is2D ? '0' : l}) • ${calculatedEigenfrequency.toFixed(0)}Hz`}
            </span>
            <span class="text-xs text-slate-400 group-hover:text-white transition-transform duration-200 font-mono ${this.isOpen ? 'rotate-180 text-cyan-400' : ''}">▼</span>
          </div>
        </button>

        <!-- Collapsible Body -->
        <div id="modal-accordion-body" class="${this.isOpen ? 'flex' : 'hidden'} flex-col gap-3 pt-2.5 border-t border-white/10 text-xs">
          
          <!-- Cymatics Resonator Medium Multi-Select (2D vs 3D Layers) -->
          <div class="flex flex-col gap-1.5">
            <div class="flex items-center justify-between">
              <span class="text-[10px] font-semibold text-slate-300 uppercase tracking-wider">Cymatics Medium</span>
              <span class="text-[10px] text-cyan-400 font-mono tracking-wider">Layer View</span>
            </div>
            <div class="grid grid-cols-3 gap-1.5 bg-slate-950/70 p-1.5 rounded-xl border border-white/5">
              <button
                data-layer="plate"
                class="btn-layer min-h-[36px] py-1.5 px-2 rounded-lg text-[10px] font-semibold flex items-center justify-center gap-1 transition-all duration-150 cursor-pointer active:scale-95 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none ${
                  (this.visualizer?.getCymaticsLayers().plate ?? apparatus === '2d-plate')
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/50 ring-1 ring-cyan-400/30 shadow-sm font-bold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
                }"
              >
                <span>${(this.visualizer?.getCymaticsLayers().plate ?? apparatus === '2d-plate') ? '✓ ' : ''}2D Plate</span>
              </button>
              <button
                data-layer="droplet"
                class="btn-layer min-h-[36px] py-1.5 px-2 rounded-lg text-[10px] font-semibold flex items-center justify-center gap-1 transition-all duration-150 cursor-pointer active:scale-95 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none ${
                  (this.visualizer?.getCymaticsLayers().droplet ?? (apparatus === '3d-droplet' || apparatus === '3d-both'))
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/50 ring-1 ring-cyan-400/30 shadow-sm font-bold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
                }"
              >
                <span>${(this.visualizer?.getCymaticsLayers().droplet ?? (apparatus === '3d-droplet' || apparatus === '3d-both')) ? '✓ ' : ''}3D Droplet</span>
              </button>
              <button
                data-layer="trap"
                class="btn-layer min-h-[36px] py-1.5 px-2 rounded-lg text-[10px] font-semibold flex items-center justify-center gap-1 transition-all duration-150 cursor-pointer active:scale-95 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none ${
                  (this.visualizer?.getCymaticsLayers().trap ?? (apparatus === '3d-particles' || apparatus === '3d-both'))
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/50 ring-1 ring-cyan-400/30 shadow-sm font-bold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
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
          <div class="glass-panel p-2.5 rounded-2xl flex items-center justify-between gap-3 bg-slate-950/80 border-white/10 shadow-inner">
            <div class="flex flex-col">
              <span class="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Resonant Tone</span>
              <div class="flex items-baseline gap-2 font-mono">
                <span id="modal-freq-val" class="text-xs sm:text-sm font-bold text-cyan-400 tabular-nums">${calculatedEigenfrequency.toFixed(1)} Hz</span>
                <span id="modal-note-name" class="text-xs font-semibold text-blue-400">${noteInfo.name}</span>
                <span id="modal-note-cents" class="text-[10px] text-slate-400 tabular-nums">${noteInfo.cents >= 0 ? '+' : ''}${noteInfo.cents}c</span>
              </div>
            </div>

            <!-- 1-Click Synth Audition Button -->
            <button
              id="btn-audition-eigenfrequency"
              data-tooltip="Play live resonant audio pitch"
              class="glass-btn min-h-[36px] px-3 py-1.5 rounded-xl text-[10px] font-semibold flex items-center gap-1.5 transition-all duration-150 cursor-pointer active:scale-95 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none ${
                isPlayingSynth
                  ? 'bg-cyan-400 text-slate-950 font-bold shadow-md shadow-cyan-400/30'
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
          <div class="flex flex-col gap-2 w-full min-w-0">
            
            <!-- n: Primary Axis / Bessel Rings / Radial Shells -->
            <div class="glass-panel p-2.5 rounded-xl flex flex-col gap-2 bg-slate-950/60 border-white/5 w-full min-w-0">
              <div class="flex items-center justify-between w-full min-w-0">
                <div class="flex items-center gap-1.5 min-w-0">
                  <span class="w-2 h-2 rounded-full bg-cyan-400 shadow-sm shadow-cyan-400/50 shrink-0"></span>
                  <span class="text-xs font-bold text-slate-200 truncate">${labelN}</span>
                </div>
                <span id="badge-mode-n" class="font-mono text-[10px] font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/30 shrink-0">
                  ${n}
                </span>
              </div>

              <div class="flex items-center gap-2 w-full min-w-0">
                <button data-axis="n" data-dir="-1" aria-label="Decrease n" class="btn-step flex items-center justify-center cursor-pointer select-none active:scale-90 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none">
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
                <button data-axis="n" data-dir="1" aria-label="Increase n" class="btn-step flex items-center justify-center cursor-pointer select-none active:scale-90 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none">
                  +
                </button>
              </div>
            </div>

            <!-- m: Secondary Axis / Petals / Meridians -->
            <div class="glass-panel p-2.5 rounded-xl flex flex-col gap-2 bg-slate-950/60 border-white/5 w-full min-w-0">
              <div class="flex items-center justify-between w-full min-w-0">
                <div class="flex items-center gap-1.5 min-w-0">
                  <span class="w-2 h-2 rounded-full bg-blue-400 shadow-sm shadow-blue-400/50 shrink-0"></span>
                  <span class="text-xs font-bold text-slate-200 truncate">${labelM}</span>
                </div>
                <span id="badge-mode-m" class="font-mono text-[10px] font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/30 shrink-0">
                  ${m}
                </span>
              </div>

              <div class="flex items-center gap-2 w-full min-w-0">
                <button data-axis="m" data-dir="-1" aria-label="Decrease m" class="btn-step flex items-center justify-center cursor-pointer select-none active:scale-90 focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:outline-none">
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
                <button data-axis="m" data-dir="1" aria-label="Increase m" class="btn-step flex items-center justify-center cursor-pointer select-none active:scale-90 focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:outline-none">
                  +
                </button>
              </div>
            </div>

            <!-- l: Tertiary Axis / Axial Disks / Cones -->
            ${
              !is2D
                ? `
            <div class="glass-panel p-2.5 rounded-xl flex flex-col gap-2 bg-slate-950/60 border-white/5 w-full min-w-0">
              <div class="flex items-center justify-between w-full min-w-0">
                <div class="flex items-center gap-1.5 min-w-0">
                  <span class="w-2 h-2 rounded-full bg-purple-400 shadow-sm shadow-purple-400/50 shrink-0"></span>
                  <span class="text-xs font-bold text-slate-200 truncate">${labelL}</span>
                </div>
                <span id="badge-mode-l" class="font-mono text-[10px] font-bold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/30 shrink-0">
                  ${l}
                </span>
              </div>

              <div class="flex items-center gap-2 w-full min-w-0">
                <button data-axis="l" data-dir="-1" aria-label="Decrease l" class="btn-step flex items-center justify-center cursor-pointer select-none active:scale-90 focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:outline-none">
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
                <button data-axis="l" data-dir="1" aria-label="Increase l" class="btn-step flex items-center justify-center cursor-pointer select-none active:scale-90 focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:outline-none">
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
          <div class="flex flex-col gap-2.5 pt-1">
            ${
              !is2D
                ? `
            <!-- Acoustic Regime Selector: Cavity Chamber vs Field Mode -->
            <div class="flex flex-col gap-1.5">
              <div class="flex items-center justify-between">
                <span class="text-[10px] font-semibold text-slate-300 uppercase tracking-wider">Acoustic Boundary</span>
                ${
                  fieldMode
                    ? `<span class="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 tracking-wider">
                         <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                         OPEN FIELD
                       </span>`
                    : `<span class="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 tracking-wider">
                         CHAMBER
                       </span>`
                }
              </div>
              <div class="segmented-track p-1 flex gap-1">
                <button
                  id="btn-regime-cavity"
                  class="segmented-pill flex-1 min-h-[36px] py-1.5 text-[10px] font-semibold flex items-center justify-center gap-1.5 transition-all duration-150 active:scale-95 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none ${
                    !fieldMode ? 'is-active glass-btn-active font-bold text-cyan-300' : 'text-slate-400'
                  }"
                >
                  Enclosed Chamber
                </button>
                <button
                  id="btn-regime-field"
                  class="segmented-pill flex-1 min-h-[36px] py-1.5 text-[10px] font-semibold flex items-center justify-center gap-1.5 transition-all duration-150 active:scale-95 focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:outline-none ${
                    fieldMode ? 'is-active is-active-emerald glass-btn-active-emerald font-bold text-emerald-300' : 'text-slate-400'
                  }"
                >
                  Field Mode
                </button>
              </div>
            </div>
            `
                : ''
            }

            <!-- Geometry Selector (Cavity Mode or 2D Plate) -->
            ${
              !fieldMode || is2D
                ? `
            <div class="flex flex-col gap-1.5">
              <span class="text-[10px] font-semibold text-slate-300 uppercase tracking-wider">${is2D ? 'Plate Shape' : 'Chamber Shape'}</span>
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
                        class="btn-geometry segmented-pill flex-1 min-h-[36px] flex items-center justify-center gap-1 transition-all duration-150 active:scale-95 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none ${
                          geometry === g.id || (geometry === 'sphere' && g.id === 'cylinder')
                            ? 'is-active glass-btn-active font-bold'
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
                        class="btn-geometry segmented-pill flex-1 min-h-[36px] flex items-center justify-center gap-1 transition-all duration-150 active:scale-95 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none ${
                          geometry === g.id
                            ? 'is-active glass-btn-active font-bold'
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
            `
                : ''
            }

            <!-- Field Mode Shape Selector (When Field Mode is Active) -->
            ${
              !is2D && fieldMode
                ? `
            <div class="flex flex-col gap-1.5">
              <div class="flex items-center justify-between">
                <span class="text-[10px] font-semibold text-slate-300 uppercase tracking-wider">Field Shape</span>
                <span class="text-[10px] text-emerald-400 font-mono tracking-wider capitalize">${fieldShape.replace('-', ' ')}</span>
              </div>
              <div class="grid grid-cols-3 gap-1.5">
                ${[
                  { id: 'free-field', label: 'Free Field' },
                  { id: 'superquadric', label: 'Morph Shape' },
                  { id: 'torus', label: 'Torus' },
                  { id: 'octahedron', label: 'Diamond' },
                  { id: 'tetrahedron', label: 'Pyramid' },
                  { id: 'dodecahedron', label: 'Dodeca' },
                  { id: 'helix', label: 'Helix' },
                  { id: 'heart', label: 'Heart' },
                  { id: 'custom', label: '3D Mesh' },
                ]
                  .map(
                    s => `
                  <button
                    data-shape="${s.id}"
                    class="btn-field-shape min-h-[36px] py-2 px-1 rounded-xl text-[10px] font-semibold border transition-all duration-150 active:scale-95 focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:outline-none text-center cursor-pointer ${
                      fieldShape === s.id
                        ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-200 font-bold shadow-sm ring-1 ring-emerald-400/30'
                        : 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200 hover:bg-white/10'
                    }"
                  >
                    ${s.label}
                  </button>
                `
                  )
                  .join('')}
              </div>
            </div>

            <!-- Shape-Specific Parameter Controls for Superquadric -->
            ${
              fieldShape === 'superquadric'
                ? `
            <div class="flex flex-col gap-2.5 p-3 rounded-2xl bg-slate-900/70 border border-emerald-500/30 shadow-inner">
              <div class="flex items-center justify-between">
                <span class="text-[10px] font-bold text-emerald-300 uppercase tracking-wider">Shape Sculptor</span>
                <span class="text-[10px] text-slate-400 font-medium">Continuous Morph</span>
              </div>
              
              <div class="flex flex-col gap-1">
                <div class="flex justify-between text-[10px]">
                  <span class="text-slate-300 font-medium">Vertical Curve (ε₁)</span>
                  <span id="label-sq-eps1" class="font-mono text-emerald-300 font-semibold tabular-nums">${superquadricParams.eps1.toFixed(2)}</span>
                </div>
                <input
                  id="slider-sq-eps1"
                  type="range"
                  min="0.2"
                  max="3.5"
                  step="0.05"
                  value="${superquadricParams.eps1}"
                  aria-label="Vertical curvature slider"
                  class="slider-emerald cursor-pointer"
                  style="background: linear-gradient(to right, #34d399 ${pctEps1}%, rgba(255, 255, 255, 0.1) ${pctEps1}%);"
                />
              </div>

              <div class="flex flex-col gap-1">
                <div class="flex justify-between text-[10px]">
                  <span class="text-slate-300 font-medium">Cross Section (Squareness ε₂)</span>
                  <span id="label-sq-eps2" class="font-mono text-emerald-300 font-semibold tabular-nums">${superquadricParams.eps2.toFixed(2)}</span>
                </div>
                <input
                  id="slider-sq-eps2"
                  type="range"
                  min="0.2"
                  max="3.5"
                  step="0.05"
                  value="${superquadricParams.eps2}"
                  aria-label="Cross section squareness slider"
                  class="slider-emerald cursor-pointer"
                  style="background: linear-gradient(to right, #34d399 ${pctEps2}%, rgba(255, 255, 255, 0.1) ${pctEps2}%);"
                />
              </div>

              <div class="flex flex-col gap-1">
                <div class="flex justify-between text-[10px]">
                  <span class="text-slate-300 font-medium">Waist Taper (Pinch)</span>
                  <span id="label-sq-pinch" class="font-mono text-emerald-300 font-semibold tabular-nums">${superquadricParams.pinch.toFixed(2)}</span>
                </div>
                <input
                  id="slider-sq-pinch"
                  type="range"
                  min="-0.7"
                  max="0.7"
                  step="0.05"
                  value="${superquadricParams.pinch}"
                  aria-label="Waist pinch taper slider"
                  class="slider-emerald cursor-pointer"
                  style="background: linear-gradient(to right, #34d399 ${pctPinch}%, rgba(255, 255, 255, 0.1) ${pctPinch}%);"
                />
              </div>

              <div class="grid grid-cols-2 gap-2.5">
                <div class="flex flex-col gap-1">
                  <div class="flex justify-between text-[10px]">
                    <span class="text-slate-300 font-medium">Lobe Count</span>
                    <span id="label-sq-lobes" class="font-mono text-emerald-300 font-semibold tabular-nums">${superquadricParams.lobes.toFixed(0)}</span>
                  </div>
                  <input
                    id="slider-sq-lobes"
                    type="range"
                    min="0"
                    max="8"
                    step="1"
                    value="${superquadricParams.lobes}"
                    aria-label="Harmonic lobe count slider"
                    class="slider-emerald cursor-pointer"
                    style="background: linear-gradient(to right, #34d399 ${pctLobes}%, rgba(255, 255, 255, 0.1) ${pctLobes}%);"
                  />
                </div>
                <div class="flex flex-col gap-1">
                  <div class="flex justify-between text-[10px]">
                    <span class="text-slate-300 font-medium">Ripple Depth</span>
                    <span id="label-sq-lobeamp" class="font-mono text-emerald-300 font-semibold tabular-nums">${superquadricParams.lobeAmp.toFixed(2)}</span>
                  </div>
                  <input
                    id="slider-sq-lobeamp"
                    type="range"
                    min="0.0"
                    max="0.4"
                    step="0.02"
                    value="${superquadricParams.lobeAmp}"
                    aria-label="Lobe depth amplitude slider"
                    class="slider-emerald cursor-pointer"
                    style="background: linear-gradient(to right, #34d399 ${pctLobeAmp}%, rgba(255, 255, 255, 0.1) ${pctLobeAmp}%);"
                  />
                </div>
              </div>
            </div>
            `
                : ''
            }

            <!-- 3D Mesh Custom Presets / Upload -->
            ${
              fieldShape === 'custom'
                ? `
            <div class="flex flex-col gap-2.5 p-3 rounded-2xl bg-slate-900/70 border border-emerald-500/30 shadow-inner">
              <div class="flex items-center justify-between">
                <span class="text-[10px] font-bold text-emerald-300 uppercase tracking-wider">3D Mesh Model</span>
                ${
                  customMeshName
                    ? `<span class="text-[10px] font-mono text-emerald-400 truncate max-w-[130px] font-semibold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">${customMeshName}</span>`
                    : ''
                }
              </div>
              <div class="grid grid-cols-3 gap-1.5">
                ${[
                  { id: 'bunny', label: 'Bunny' },
                  { id: 'teapot', label: 'Teapot' },
                  { id: 'star', label: 'Star' },
                ]
                  .map(
                    m => {
                      const isSelected = customMeshName?.toLowerCase().includes(m.id);
                      return `
                  <button
                    data-preset-mesh="${m.id}"
                    class="btn-mesh-preset min-h-[36px] py-1.5 px-1 text-[10px] font-semibold rounded-xl border transition-all duration-150 active:scale-95 focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:outline-none cursor-pointer flex items-center justify-center gap-1 ${
                      isSelected
                        ? 'bg-emerald-500/25 border-emerald-500/50 text-emerald-200 font-bold shadow-sm ring-1 ring-emerald-400/30'
                        : 'bg-white/5 border-white/10 text-slate-300 hover:bg-emerald-500/15 hover:border-emerald-500/30'
                    }"
                  >
                    <span>${m.label}</span>
                  </button>
                `;
                    }
                  )
                  .join('')}
              </div>
              <div class="flex pt-0.5">
                <label
                  for="file-obj-upload"
                  tabindex="0"
                  role="button"
                  aria-label="Upload custom 3D OBJ file"
                  class="flex-1 min-h-[38px] py-2 px-3 rounded-xl text-[10px] font-semibold flex items-center justify-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 active:scale-95 focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:outline-none cursor-pointer transition-all duration-150"
                >
                  <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  <span class="truncate">${customMeshName && !['bunny', 'teapot', 'star'].some(p => customMeshName?.toLowerCase().includes(p)) ? `Loaded: ${customMeshName}` : 'Import .OBJ Mesh File'}</span>
                </label>
                <input id="file-obj-upload" type="file" accept=".obj,.txt,model/obj,application/octet-stream" class="hidden" />
              </div>
            </div>
            `
                : ''
            }
            `
                : ''
            }

            <!-- Boundary Frame & Trapping Mode -->
            ${
              !is2D
                ? `
            <div class="grid grid-cols-2 gap-2">
              ${
                !fieldMode
                  ? `
              <!-- Enclosure Box -->
              <div class="flex flex-col gap-1">
                <span class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Boundary</span>
                <div class="segmented-track p-1">
                  <button
                    id="btn-enclosure-glass"
                    class="segmented-pill flex-1 min-h-[32px] py-1 text-[10px] font-semibold flex items-center justify-center transition-all duration-150 active:scale-95 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none ${
                      showEnclosure ? 'is-active glass-btn-active font-bold text-cyan-300' : ''
                    }"
                  >
                    Box
                  </button>
                  <button
                    id="btn-enclosure-free"
                    class="segmented-pill flex-1 min-h-[32px] py-1 text-[10px] font-semibold flex items-center justify-center transition-all duration-150 active:scale-95 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none ${
                      !showEnclosure ? 'is-active glass-btn-active font-bold text-cyan-300' : ''
                    }"
                  >
                    Free
                  </button>
                </div>
              </div>
              `
                  : `
              <!-- Wireframe Guide -->
              <div class="flex flex-col gap-1">
                <span class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Wireframe Guide</span>
                <div class="segmented-track p-1">
                  <button
                    id="btn-contour-on"
                    class="segmented-pill flex-1 min-h-[32px] py-1 text-[10px] font-semibold flex items-center justify-center transition-all duration-150 active:scale-95 focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:outline-none ${
                      contourVisible ? 'is-active is-active-emerald glass-btn-active-emerald font-bold text-emerald-300' : ''
                    }"
                  >
                    Contour
                  </button>
                  <button
                    id="btn-contour-off"
                    class="segmented-pill flex-1 min-h-[32px] py-1 text-[10px] font-semibold flex items-center justify-center transition-all duration-150 active:scale-95 focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:outline-none ${
                      !contourVisible ? 'is-active is-active-emerald glass-btn-active-emerald font-bold text-emerald-300' : ''
                    }"
                  >
                    Hidden
                  </button>
                </div>
              </div>
              `
              }

              <!-- Trapping Mode -->
              <div class="flex flex-col gap-1">
                <span class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Trapping</span>
                <div class="segmented-track p-1">
                  <button
                    id="btn-trap-nodes"
                    data-tooltip="Sand rests on nodal lines (zero sound motion)"
                    class="segmented-pill flex-1 min-h-[32px] py-1 text-[10px] font-semibold flex items-center justify-center transition-all duration-150 active:scale-95 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none ${
                      trappingMode === 'nodes' ? (fieldMode ? 'is-active is-active-emerald glass-btn-active-emerald font-bold text-emerald-300' : 'is-active glass-btn-active font-bold text-cyan-300') : ''
                    }"
                  >
                    Nodes
                  </button>
                  <button
                    id="btn-trap-antinodes"
                    data-tooltip="Particles float at antinodes (maximum sound energy)"
                    class="segmented-pill flex-1 min-h-[32px] py-1 text-[10px] font-semibold flex items-center justify-center transition-all duration-150 active:scale-95 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none ${
                      trappingMode === 'antinodes' ? (fieldMode ? 'is-active is-active-emerald glass-btn-active-emerald font-bold text-emerald-300' : 'is-active glass-btn-active font-bold text-cyan-300') : ''
                    }"
                  >
                    Antinodes
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
              class="w-full min-h-[38px] py-2 px-3 rounded-xl text-[10px] font-semibold flex items-center justify-center gap-2 border transition-all duration-150 cursor-pointer active:scale-95 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none ${
                audioCoupled
                  ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300 shadow-sm font-bold ring-1 ring-cyan-400/30'
                  : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
              }"
            >
              <span>${audioCoupled ? '✓ Live Audio Resonance Active' : 'Link to Live Audio Resonance'}</span>
            </button>
            `
                : ''
            }
          </div>

          ${
            !isMusicMode
              ? `
          <!-- Wave Presets Section (Frequencies Lab Mode Only) -->
          <div class="flex flex-col gap-2 pt-2.5 border-t border-white/10">
            <div class="flex items-center justify-between">
              <span class="text-[10px] font-bold text-slate-300 uppercase tracking-wider">Standing Wave Presets</span>
              <span id="modal-total-cells" class="text-[10px] text-slate-400 font-mono">
                Grid: <strong class="text-cyan-400 font-semibold">${totalNodalCells}</strong> Cells
              </span>
            </div>

            <div class="grid grid-cols-1 gap-1.5">
              ${ModalSweeperControls.PRESETS.map(p => {
                const isSelected = p.n === n && p.m === m && (!is2D ? p.l === l : true) && p.geometry === geometry;
                return `
                  <button
                    data-preset="${p.id}"
                    class="btn-preset-card glass-panel min-h-[40px] p-2.5 rounded-xl flex items-center justify-between text-left transition-all duration-150 hover:border-slate-600 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none cursor-pointer ${
                      isSelected
                        ? 'border-cyan-500/60 shadow-sm bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-400/30 font-bold'
                        : 'hover:border-white/20 bg-slate-950/60 border-white/5'
                    }"
                  >
                    <div class="flex items-center gap-2 min-w-0">
                      <span class="font-mono text-[10px] font-bold text-cyan-400 shrink-0">(${p.n},${p.m}${is2D ? '' : ',' + p.l})</span>
                      <span class="text-[10px] font-semibold text-slate-200 truncate">${p.name}</span>
                    </div>
                    <span class="text-[10px] px-2 py-0.5 rounded-md bg-slate-900 font-semibold text-slate-300 border border-slate-700 shrink-0">${p.badge}</span>
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
        ? (this.state.fieldMode
            ? `FIELD: ${this.state.fieldShape.toUpperCase()} • ${this.state.trappingMode === 'nodes' ? 'NODES' : 'ANTI'}`
            : `${this.state.geometry.toUpperCase()} • ${this.state.trappingMode === 'nodes' ? 'NODES' : 'ANTI'}`)
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
      totalCellsEl.innerHTML = `Grid: <strong class="text-cyan-400 font-semibold">${is2D ? n * m : n * m * l}</strong> Cells`;
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
        sliderN.style.background = `linear-gradient(to right, #22d3ee ${pct}%, rgba(255, 255, 255, 0.1) ${pct}%)`;
      }
      const sliderM = this.element.querySelector('#slider-mode-m') as HTMLInputElement;
      if (sliderM) {
        sliderM.value = m.toString();
        const pct = Math.round(((m - 1) / 7) * 100);
        sliderM.style.background = `linear-gradient(to right, #60a5fa ${pct}%, rgba(255, 255, 255, 0.1) ${pct}%)`;
      }
      const sliderL = this.element.querySelector('#slider-mode-l') as HTMLInputElement;
      if (sliderL) {
        sliderL.value = l.toString();
        const pct = Math.round(((l - 1) / 7) * 100);
        sliderL.style.background = `linear-gradient(to right, #c084fc ${pct}%, rgba(255, 255, 255, 0.1) ${pct}%)`;
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
      sliderN.style.background = `linear-gradient(to right, #22d3ee ${pct}%, rgba(255, 255, 255, 0.1) ${pct}%)`;
      this.notifyStateChange();
      this.updateDisplay(true);
    });

    const sliderM = this.element.querySelector('#slider-mode-m') as HTMLInputElement;
    sliderM?.addEventListener('input', () => {
      this.state.m = parseInt(sliderM.value, 10);
      const pct = Math.round(((this.state.m - 1) / 7) * 100);
      sliderM.style.background = `linear-gradient(to right, #60a5fa ${pct}%, rgba(255, 255, 255, 0.1) ${pct}%)`;
      this.notifyStateChange();
      this.updateDisplay(true);
    });

    const sliderL = this.element.querySelector('#slider-mode-l') as HTMLInputElement;
    sliderL?.addEventListener('input', () => {
      this.state.l = parseInt(sliderL.value, 10);
      const pct = Math.round(((this.state.l - 1) / 7) * 100);
      sliderL.style.background = `linear-gradient(to right, #c084fc ${pct}%, rgba(255, 255, 255, 0.1) ${pct}%)`;
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

    // 3b. Acoustic Boundary Regime (Cavity Chamber vs Field Mode)
    this.element.querySelector('#btn-regime-cavity')?.addEventListener('click', () => {
      this.setFieldMode(false);
    });

    this.element.querySelector('#btn-regime-field')?.addEventListener('click', () => {
      this.setFieldMode(true, this.state.fieldShape);
    });

    // 3c. Field Mode Shape Buttons
    this.element.querySelectorAll('.btn-field-shape').forEach(btn => {
      btn.addEventListener('click', e => {
        const target = e.currentTarget as HTMLElement;
        const shape = target.getAttribute('data-shape') as FieldShapeType;
        if (shape) {
          if (shape === 'custom' && !this.state.customMeshName) {
            this.loadCustomMeshPreset('bunny');
          } else {
            this.setFieldShape(shape);
          }
        }
      });
    });

    // 3d. Superquadric Parametric Morph Sliders
    const sliderEps1 = this.element.querySelector('#slider-sq-eps1') as HTMLInputElement;
    sliderEps1?.addEventListener('input', () => {
      this.state.superquadricParams.eps1 = parseFloat(sliderEps1.value);
      const pct = Math.round(((this.state.superquadricParams.eps1 - 0.2) / 3.3) * 100);
      sliderEps1.style.background = `linear-gradient(to right, #34d399 ${pct}%, rgba(255, 255, 255, 0.1) ${pct}%)`;
      const lbl = this.element.querySelector('#label-sq-eps1');
      if (lbl) lbl.textContent = this.state.superquadricParams.eps1.toFixed(2);
      this.visualizer?.setFieldShape('superquadric', this.state.superquadricParams);
      this.notifyStateChange();
    });

    const sliderEps2 = this.element.querySelector('#slider-sq-eps2') as HTMLInputElement;
    sliderEps2?.addEventListener('input', () => {
      this.state.superquadricParams.eps2 = parseFloat(sliderEps2.value);
      const pct = Math.round(((this.state.superquadricParams.eps2 - 0.2) / 3.3) * 100);
      sliderEps2.style.background = `linear-gradient(to right, #34d399 ${pct}%, rgba(255, 255, 255, 0.1) ${pct}%)`;
      const lbl = this.element.querySelector('#label-sq-eps2');
      if (lbl) lbl.textContent = this.state.superquadricParams.eps2.toFixed(2);
      this.visualizer?.setFieldShape('superquadric', this.state.superquadricParams);
      this.notifyStateChange();
    });

    const sliderPinch = this.element.querySelector('#slider-sq-pinch') as HTMLInputElement;
    sliderPinch?.addEventListener('input', () => {
      this.state.superquadricParams.pinch = parseFloat(sliderPinch.value);
      const pct = Math.round(((this.state.superquadricParams.pinch - -0.7) / 1.4) * 100);
      sliderPinch.style.background = `linear-gradient(to right, #34d399 ${pct}%, rgba(255, 255, 255, 0.1) ${pct}%)`;
      const lbl = this.element.querySelector('#label-sq-pinch');
      if (lbl) lbl.textContent = this.state.superquadricParams.pinch.toFixed(2);
      this.visualizer?.setFieldShape('superquadric', this.state.superquadricParams);
      this.notifyStateChange();
    });

    const sliderLobes = this.element.querySelector('#slider-sq-lobes') as HTMLInputElement;
    sliderLobes?.addEventListener('input', () => {
      this.state.superquadricParams.lobes = parseFloat(sliderLobes.value);
      const pct = Math.round((this.state.superquadricParams.lobes / 8) * 100);
      sliderLobes.style.background = `linear-gradient(to right, #34d399 ${pct}%, rgba(255, 255, 255, 0.1) ${pct}%)`;
      const lbl = this.element.querySelector('#label-sq-lobes');
      if (lbl) lbl.textContent = this.state.superquadricParams.lobes.toFixed(0);
      this.visualizer?.setFieldShape('superquadric', this.state.superquadricParams);
      this.notifyStateChange();
    });

    const sliderLobeAmp = this.element.querySelector('#slider-sq-lobeamp') as HTMLInputElement;
    sliderLobeAmp?.addEventListener('input', () => {
      this.state.superquadricParams.lobeAmp = parseFloat(sliderLobeAmp.value);
      const pct = Math.round((this.state.superquadricParams.lobeAmp / 0.4) * 100);
      sliderLobeAmp.style.background = `linear-gradient(to right, #34d399 ${pct}%, rgba(255, 255, 255, 0.1) ${pct}%)`;
      const lbl = this.element.querySelector('#label-sq-lobeamp');
      if (lbl) lbl.textContent = this.state.superquadricParams.lobeAmp.toFixed(2);
      this.visualizer?.setFieldShape('superquadric', this.state.superquadricParams);
      this.notifyStateChange();
    });

    // 3e. 3D Mesh Presets
    this.element.querySelectorAll('.btn-mesh-preset').forEach(btn => {
      btn.addEventListener('click', e => {
        const target = e.currentTarget as HTMLElement;
        const preset = target.getAttribute('data-preset-mesh') as 'bunny' | 'teapot' | 'star';
        if (preset) {
          this.loadCustomMeshPreset(preset);
        }
      });
    });

    // 3f. Custom OBJ File Upload
    const fileUploadInput = this.element.querySelector('#file-obj-upload') as HTMLInputElement;
    fileUploadInput?.addEventListener('change', e => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = evt => {
          const text = evt.target?.result as string;
          if (text) {
            try {
              this.loadCustomMeshObj(text, file.name);
            } catch (err) {
              console.error('Failed to parse OBJ mesh:', err);
            }
          }
        };
        reader.readAsText(file);
      }
    });

    // Accessible keyboard support for file upload label
    const fileUploadLabel = this.element.querySelector('label[for="file-obj-upload"]');
    fileUploadLabel?.addEventListener('keydown', e => {
      const keyEvent = e as KeyboardEvent;
      if (keyEvent.key === 'Enter' || keyEvent.key === ' ') {
        keyEvent.preventDefault();
        fileUploadInput?.click();
      }
    });

    // 3g. Datum Frame Toggle (Contour vs No Frame)
    this.element.querySelector('#btn-contour-on')?.addEventListener('click', () => {
      this.setContourVisible(true);
    });
    this.element.querySelector('#btn-contour-off')?.addEventListener('click', () => {
      this.setContourVisible(false);
    });

    // 3h. Chamber Boundary Enclosure Buttons (Glass Box / Free Field)
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
