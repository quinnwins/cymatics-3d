/**
 * CymaticsControls.ts
 * SoundForm 3D - Unified Cymatics & Music Studio Control Deck
 *
 * Integrates:
 * 1. Audio Drive Source:
 *    - Music Library (Demo tracks, genre filters, search, timeline scrubber, play/pause)
 *    - Custom Audio File Upload & Live Microphone Input
 *    - Theoretical Eigenfrequency Tone Synthesizer & Note Info (f_{n,m,ℓ})
 * 2. Physical Resonator Apparatus:
 *    - 2D Chladni Sand Plate vs 3D Fluid Droplet vs 3D Particle Levitation Trap vs Both
 *    - Chamber Geometry: Cube (Square), Cylinder (Bessel), Sphere (Spherical Harmonics)
 *    - Trapping Mode: Nodal Lines (Sand) vs Antinodal (Inverse)
 *    - Chamber Enclosure Wireframe Toggle
 * 3. Harmonic Eigenstates & Presets:
 *    - (n, m, ℓ) 3-axis harmonic modal order sliders & steppers
 *    - 1-Click Instant Eigenstate Preset Matrix:
 *        • Crossing Planes (1,1,1)
 *        • 3D Grid Lattice (2,2,1)
 *        • Honeycomb Trap (3,2,2)
 *        • Harmonic Cage (4,3,2)
 *        • Resonant Crystal (5,4,3)
 *        • Cylindrical Bessel (2,3,1)
 *        • Spherical Shells (3,2,2)
 */

import { AudioEngine } from '../audio/AudioEngine';
import { DemoAudioGenerator } from '../audio/DemoAudioGenerator';
import { VisualizerEngine, VisualStyle } from '../visualizer/VisualizerEngine';
import { WavePhysics, NoteInfo } from '../math/WavePhysics';
import { WaveformType } from '../audio/FrequencySynthesizer';
import { EngineMode } from './Header';

export type ChamberGeometry = 'cube' | 'cylinder' | 'sphere';
export type ChamberType = ChamberGeometry;
export type TrappingMode = 'nodes' | 'antinodes';
export type CymaticsApparatus = '2d-plate' | '3d-droplet' | '3d-particles' | '3d-both';
export type AudioDriveTab = 'tracks' | 'mic-file' | 'synth';

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
  audioDriveTab: AudioDriveTab;
}

export class CymaticsControls {
  private element: HTMLElement;
  private state: ModalSweeperState;
  private onStateChange?: (state: ModalSweeperState) => void;
  private onSwitchMode?: (mode: EngineMode) => void;
  private unsubscribe?: () => void;
  private isVisible = true;
  private isScrubbing = false;
  private searchQuery = '';
  private selectedCategory = 'all';

  // Tone Synth Sub-Mode: 'eigenmode' (theoretical f0) vs 'sweeper' (custom 20Hz-20kHz)
  private synthSubMode: 'eigenmode' | 'sweeper' = 'eigenmode';
  private customFreq = 432;
  private customNoteInfo: NoteInfo = WavePhysics.frequencyToNote(432);
  private customWaveform: WaveformType = 'sine';
  private showHarmonicsDrawer = false;
  private isResonatorOpen = true;

  // Primary Deck Tab: 'audio' vs 'resonator'
  private activeDeckTab: 'audio' | 'resonator' = 'audio';

  // State caching to prevent excessive re-renders
  private lastTrackId = '';
  private lastMode = '';
  private lastFileName: string | null = null;
  private lastMicActive = false;
  private lastIsPlaying = false;

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
    onStateChange?: (state: ModalSweeperState) => void,
    onSwitchMode?: (mode: EngineMode) => void
  ) {
    this.onStateChange = onStateChange;
    this.onSwitchMode = onSwitchMode;
    this.element = document.createElement('div');
    this.element.className = 'w-full flex flex-col gap-2.5 transition-all duration-300 select-none';
    this.preventEventBleeding();

    // Default Initial State: (1,1,1) Ground state in 3D Acoustic Cavity
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
      audioDriveTab: 'tracks',
    };

    this.recalculatePhysics();
    this.render();
    this.setupListeners();

    this.unsubscribe = this.audioEngine.subscribe(() => {
      if (this.isVisible) {
        this.updateAudioPlaybackUI();
      }
    });
  }

  public setVisualizer(visualizer: VisualizerEngine): void {
    this.visualizer = visualizer;
  }

  public destroy(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = undefined;
    }
  }

  public getElement(): HTMLElement {
    return this.element;
  }

  public setVisible(visible: boolean): void {
    this.isVisible = visible;
    this.element.style.display = visible ? 'flex' : 'none';
  }

  public getState(): Readonly<ModalSweeperState> {
    return this.state;
  }

  private preventEventBleeding(): void {
    this.element.addEventListener('wheel', e => e.stopPropagation(), { passive: false });
  }

  private setupListeners(): void {
    window.addEventListener('visual-style-changed', ((e: CustomEvent<{ style: VisualStyle }>) => {
      const style = e.detail?.style;
      if (style === 'cymatics-2d' && this.state.apparatus !== '2d-plate') {
        this.state.apparatus = '2d-plate';
        this.notifyStateChange();
        this.render();
      } else if (style === 'cymatics' && this.state.apparatus === '2d-plate') {
        this.state.apparatus = '3d-both';
        this.notifyStateChange();
        this.render();
      }
    }) as EventListener);

    window.addEventListener('cymatics-layers-changed', (() => {
      if (this.isVisible) this.render();
    }) as EventListener);

    window.addEventListener('cymatics-apparatus-changed', ((e: CustomEvent<{ apparatus: CymaticsApparatus }>) => {
      if (e.detail?.apparatus && e.detail.apparatus !== this.state.apparatus) {
        this.state.apparatus = e.detail.apparatus;
        this.notifyStateChange();
        this.render();
      }
    }) as EventListener);

    window.addEventListener('modal-state-changed', ((e: CustomEvent<{ n?: number; m?: number; l?: number; geometry?: ChamberGeometry }>) => {
      if (e.detail) {
        let changed = false;
        if (e.detail.n !== undefined && e.detail.n !== this.state.n) {
          this.state.n = e.detail.n;
          changed = true;
        }
        if (e.detail.m !== undefined && e.detail.m !== this.state.m) {
          this.state.m = e.detail.m;
          changed = true;
        }
        if (e.detail.l !== undefined && e.detail.l !== this.state.l) {
          this.state.l = e.detail.l;
          changed = true;
        }
        if (e.detail.geometry !== undefined && e.detail.geometry !== this.state.geometry) {
          this.state.geometry = e.detail.geometry;
          changed = true;
        }
        if (changed) {
          this.recalculatePhysics();
          this.render();
        }
      }
    }) as EventListener);
  }

  private calculateEigenfrequency(n: number, m: number, l: number): number {
    const c = WavePhysics.SPEED_OF_SOUND_AIR;
    const kx = n / this.state.chamberLengthX;
    const ky = m / this.state.chamberLengthY;
    const kz = this.state.apparatus === '2d-plate' ? 0.0 : l / this.state.chamberLengthZ;
    const freq = (c / 2) * Math.sqrt(kx * kx + ky * ky + kz * kz);
    return Math.round(freq * 10) / 10;
  }

  // Convert linear slider [0..1000] to logarithmic Hz [20..20000]
  private sliderToFreq(val: number): number {
    const minHz = 20;
    const maxHz = 20000;
    return Math.round(minHz * Math.pow(maxHz / minHz, val / 1000));
  }

  // Convert Hz [20..20000] to linear slider [0..1000]
  private freqToSlider(hz: number): number {
    const minHz = 20;
    const maxHz = 20000;
    const clamped = Math.max(minHz, Math.min(maxHz, hz));
    return Math.round((1000 * Math.log(clamped / minHz)) / Math.log(maxHz / minHz));
  }

  private updateFrequencyDisplay(fromSlider = false): void {
    this.customNoteInfo = WavePhysics.frequencyToNote(this.customFreq);

    const numInput = this.element.querySelector('#cym-freq-number-input') as HTMLInputElement;
    if (numInput && document.activeElement !== numInput) {
      numInput.value = this.customFreq.toString();
    }

    const noteBadge = this.element.querySelector('#cym-freq-note-badge');
    if (noteBadge) {
      noteBadge.textContent = `(${this.customNoteInfo.name})`;
    }

    const slider = this.element.querySelector('#cym-freq-master-slider') as HTMLInputElement;
    if (slider && !fromSlider) {
      slider.value = this.freqToSlider(this.customFreq).toString();
    }

    const sweeperSubBtn = this.element.querySelector('#cym-synth-sub-sweeper span');
    if (sweeperSubBtn) {
      sweeperSubBtn.textContent = `Sweeper (${this.customFreq}Hz)`;
    }

    // Update real-time audio synthesizer without restarting audio graph
    if (this.audioEngine.synthesizer?.getIsPlaying() && this.synthSubMode === 'sweeper') {
      this.audioEngine.synthesizer.setFrequency(this.customFreq);
    }

    // Update visualizer frequency
    if (this.visualizer?.cymaticsMesh) {
      this.visualizer.cymaticsMesh.setFrequency(this.customFreq);
    }

    // Update Solfeggio button highlights
    this.element.querySelectorAll('.btn-cym-freq-preset').forEach(btn => {
      const hz = parseFloat((btn as HTMLElement).dataset.hz || '0');
      if (Math.abs(hz - this.customFreq) < 0.5) {
        btn.className = 'btn-cym-freq-preset py-1 px-1 rounded-lg text-[9px] font-mono font-medium truncate transition-all cursor-pointer bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold shadow-sm';
      } else {
        btn.className = 'btn-cym-freq-preset py-1 px-1 rounded-lg text-[9px] font-mono font-medium truncate transition-all cursor-pointer bg-slate-900/60 border border-white/5 text-gray-400 hover:text-gray-200';
      }
    });
  }

  public setCustomFrequency(freq: number, fromSlider = false): void {
    this.customFreq = Math.max(20, Math.min(20000, Math.round(freq)));
    this.updateFrequencyDisplay(fromSlider);
  }

  public setCustomWaveform(wf: WaveformType): void {
    this.customWaveform = wf;
    this.audioEngine.synthesizer?.setWaveform(wf);
    this.render();
  }

  public setHarmonicWeight(index: number, weight: number): void {
    this.audioEngine.synthesizer?.setHarmonicWeight(index, weight);
  }

  private recalculatePhysics(): void {
    const freq = this.calculateEigenfrequency(this.state.n, this.state.m, this.state.l);
    this.state.calculatedEigenfrequency = freq;
    this.state.noteInfo = WavePhysics.frequencyToNote(freq);
  }

  private notifyStateChange(): void {
    this.recalculatePhysics();

    // Update synthesizer frequency if synth tone mode is actively playing
    if (this.state.audioDriveTab === 'synth' && this.audioEngine.synthesizer?.getIsPlaying()) {
      if (this.synthSubMode === 'eigenmode') {
        this.audioEngine.synthesizer.setFrequency(this.state.calculatedEigenfrequency);
      } else {
        this.audioEngine.synthesizer.setFrequency(this.customFreq);
      }
    }

    if (this.onStateChange) {
      this.onStateChange(this.state);
    }

    window.dispatchEvent(
      new CustomEvent('modal-state-changed', {
        detail: {
          n: this.state.n,
          m: this.state.m,
          l: this.state.l,
          geometry: this.state.geometry,
          frequency: this.state.calculatedEigenfrequency,
          apparatus: this.state.apparatus,
        },
      })
    );
  }

  public applyPreset(presetId: string): void {
    const preset = CymaticsControls.PRESETS.find(p => p.id === presetId);
    if (!preset) return;

    this.state.n = preset.n;
    this.state.m = preset.m;
    this.state.l = preset.l;
    this.state.geometry = preset.geometry;
    this.notifyStateChange();
    this.render();
  }

  public setResonatorOpen(open: boolean): void {
    this.isResonatorOpen = open;
    this.render();
  }

  public getIsResonatorOpen(): boolean {
    return this.isResonatorOpen;
  }

  public setApparatus(apparatus: CymaticsApparatus): void {
    this.state.apparatus = apparatus;
    if (this.visualizer) {
      if (typeof this.visualizer.setCymaticsLayers === 'function') {
        if (apparatus === '2d-plate') {
          this.visualizer.setCymaticsLayers({ plate: true, droplet: false, trap: false });
        } else if (apparatus === '3d-droplet') {
          this.visualizer.setCymaticsLayers({ plate: false, droplet: true, trap: false });
        } else if (apparatus === '3d-particles') {
          this.visualizer.setCymaticsLayers({ plate: false, droplet: false, trap: true });
        } else {
          this.visualizer.setCymaticsLayers({ plate: true, droplet: true, trap: true });
        }
      }
      if (apparatus === '2d-plate') {
        this.visualizer.setStyle?.('cymatics-2d');
      } else {
        this.visualizer.setStyle?.('cymatics');
        const visMode = apparatus === '3d-droplet' ? 'droplet' : apparatus === '3d-particles' ? 'particles' : 'both';
        this.visualizer.setCymaticsVisibilityMode?.(visMode);
      }
    }
    this.notifyStateChange();
    this.render();
  }

  private formatTime(sec: number): string {
    if (!sec || isNaN(sec) || !isFinite(sec) || sec < 0) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  public updateAudioPlaybackUI(): void {
    const curTrackId = this.audioEngine.getActiveTrackId();
    const curMode = this.audioEngine.getMode();
    const curFileName = this.audioEngine.getLoadedFileName();
    const curMic = this.audioEngine.isMicrophoneActive();
    const curPlaying = this.audioEngine.getIsPlaying();

    if (
      curTrackId !== this.lastTrackId ||
      curMode !== this.lastMode ||
      curFileName !== this.lastFileName ||
      curMic !== this.lastMicActive
    ) {
      this.render();
      return;
    }

    if (curPlaying !== this.lastIsPlaying) {
      this.lastIsPlaying = curPlaying;
      const playPauseBtn = this.element.querySelector('#cym-btn-play-pause');
      if (playPauseBtn) {
        playPauseBtn.innerHTML = curPlaying
          ? `<svg class="w-4 h-4 fill-current" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>`
          : `<svg class="w-4 h-4 fill-current ml-0.5" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
      }
    }

    const curTime = this.audioEngine.getCurrentTime();
    const dur = this.audioEngine.getDuration();
    const curLabel = this.element.querySelector('#cym-label-current-time');
    const durLabel = this.element.querySelector('#cym-label-duration');
    const scrubber = this.element.querySelector('#cym-timeline-scrubber') as HTMLInputElement;

    if (durLabel) durLabel.textContent = this.formatTime(dur);

    if (!this.isScrubbing) {
      if (curLabel) curLabel.textContent = this.formatTime(curTime);
      if (scrubber) {
        scrubber.max = (dur > 0 ? dur : 100).toString();
        scrubber.value = curTime.toString();
        const pct = dur > 0 ? (curTime / dur) * 100 : 0;
        scrubber.style.background = `linear-gradient(to right, #22d3ee ${pct}%, rgba(255, 255, 255, 0.12) ${pct}%)`;
      }
    }
  }

  public render(): void {
    const tracks = DemoAudioGenerator.TRACKS;
    const currentTrackId = this.audioEngine.getActiveTrackId();
    const currentTrack = tracks.find(t => t.id === currentTrackId) || tracks[0];
    const isMicActive = this.audioEngine.isMicrophoneActive();
    const loadedFileName = this.audioEngine.getLoadedFileName();
    const isPlaying = this.audioEngine.getIsPlaying();
    const isPlayingSynth = this.audioEngine.synthesizer?.getIsPlaying() ?? false;
    const currentTime = this.audioEngine.getCurrentTime();
    const duration = this.audioEngine.getDuration();
    const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;
    const activeStyle = this.visualizer?.getStyle() || 'cymatics';
    const cymaticsLayers = this.visualizer?.getCymaticsLayers
      ? this.visualizer.getCymaticsLayers()
      : {
          plate: this.state.apparatus === '2d-plate' || this.state.apparatus === '3d-both',
          droplet: this.state.apparatus === '3d-droplet' || this.state.apparatus === '3d-both',
          trap: this.state.apparatus === '3d-particles' || this.state.apparatus === '3d-both',
        };
    const isOnly2DPlate = cymaticsLayers.plate && !cymaticsLayers.droplet && !cymaticsLayers.trap;
    const is2DCymatics = isOnly2DPlate || activeStyle === 'cymatics-2d';

    this.lastTrackId = currentTrackId;
    this.lastMode = this.audioEngine.getMode();
    this.lastFileName = loadedFileName;
    this.lastMicActive = isMicActive;
    this.lastIsPlaying = isPlaying;

    const filteredTracks = tracks.filter(t => {
      const matchCat = this.selectedCategory === 'all' || t.category === this.selectedCategory || t.genre.toLowerCase().includes(this.selectedCategory.toLowerCase());
      const matchQuery = !this.searchQuery || t.name.toLowerCase().includes(this.searchQuery.toLowerCase()) || t.genre.toLowerCase().includes(this.searchQuery.toLowerCase()) || t.description.toLowerCase().includes(this.searchQuery.toLowerCase()) || t.category.toLowerCase().includes(this.searchQuery.toLowerCase());
      return matchCat && matchQuery;
    });

    this.element.innerHTML = `
      <div class="glass-panel p-3.5 sm:p-4 rounded-2xl flex flex-col gap-3 shadow-xl border border-white/10 text-white select-none">
        
        <!-- Header -->
        <div class="flex items-center justify-between border-b border-white/10 pb-2.5">
          <div class="flex items-center gap-2">
            <div class="w-7 h-7 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-cyan-400 font-mono text-xs font-bold shrink-0 shadow-sm">
              <svg class="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"/></svg>
            </div>
            <div>
              <h3 class="text-xs sm:text-sm font-bold text-white">Cymatics & Music Studio</h3>
              <p class="text-[10px] text-gray-400">Physical resonator, shape & audio drive</p>
            </div>
          </div>
          <span class="text-[9px] font-bold font-mono px-2 py-0.5 rounded-full ${
            is2DCymatics
              ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
              : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
          }">
            ${is2DCymatics ? '2D CHLADNI' : '3D VOLUMETRIC'}
          </span>
        </div>

        <!-- SECTION 1: PHYSICAL RESONATOR & SHAPES (PRIMARY HERO DECK) -->
        <div class="flex flex-col bg-slate-950/60 rounded-2xl border border-white/5 overflow-hidden transition-all">
          <button id="btn-toggle-cym-shapes" class="w-full p-2.5 sm:p-3 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors text-left">
            <div class="flex items-center gap-2 min-w-0">
              <span class="w-2 h-2 rounded-full bg-cyan-400 shadow-sm shadow-cyan-400/50 shrink-0"></span>
              <span class="text-xs font-bold text-slate-200 truncate">Resonator Shapes & Apparatus</span>
            </div>
            <div class="flex items-center gap-1.5 shrink-0">
              <span class="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-900 border border-white/10 text-cyan-300 font-semibold">
                (${this.state.n},${this.state.m},${is2DCymatics ? '0' : this.state.l}) • ${this.state.calculatedEigenfrequency.toFixed(0)}Hz
              </span>
              <span class="text-[10px] text-slate-400 font-mono">${this.isResonatorOpen ? '▲' : '▼'}</span>
            </div>
          </button>

          <div id="cym-shapes-body" class="${this.isResonatorOpen ? 'flex' : 'hidden'} flex-col gap-2.5 p-3 pt-0 border-t border-white/5">
            <!-- Multi-Stage Physical Apparatus Layer Selector -->
            <div class="flex flex-col gap-1 pt-2">
              <div class="flex items-center justify-between">
                <span class="text-[10px] text-slate-400 font-medium">Physical Apparatus:</span>
                <span class="text-[9px] text-cyan-400 font-mono">Multi-Stage Active</span>
              </div>
              <div class="grid grid-cols-3 gap-1 bg-slate-900/80 p-1 rounded-xl border border-white/5 text-[10px]">
                <button
                  data-layer="plate"
                  class="btn-cym-layer py-1.5 px-1 rounded-lg font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                    cymaticsLayers.plate
                      ? 'glass-btn-active font-bold text-cyan-300 shadow-sm ring-1 ring-cyan-500/40 bg-slate-800'
                      : 'text-gray-400 hover:text-gray-200'
                  }"
                >
                  <span>${cymaticsLayers.plate ? '✓ ' : ''}2D Sand Plate</span>
                </button>
                <button
                  data-layer="droplet"
                  class="btn-cym-layer py-1.5 px-1 rounded-lg font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                    cymaticsLayers.droplet
                      ? 'glass-btn-active font-bold text-cyan-300 shadow-sm ring-1 ring-cyan-500/40 bg-slate-800'
                      : 'text-gray-400 hover:text-gray-200'
                  }"
                >
                  <span>${cymaticsLayers.droplet ? '✓ ' : ''}3D Droplet</span>
                </button>
                <button
                  data-layer="trap"
                  class="btn-cym-layer py-1.5 px-1 rounded-lg font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                    cymaticsLayers.trap
                      ? 'glass-btn-active font-bold text-cyan-300 shadow-sm ring-1 ring-cyan-500/40 bg-slate-800'
                      : 'text-gray-400 hover:text-gray-200'
                  }"
                >
                  <span>${cymaticsLayers.trap ? '✓ ' : ''}3D Trap</span>
                </button>
              </div>
            </div>

            <!-- Chamber / Resonator Geometry -->
            <div class="flex flex-col gap-1">
              <span class="text-[10px] text-slate-400 font-medium">${isOnly2DPlate ? 'Plate Geometry:' : 'Chamber Geometry:'}</span>
              <div class="grid grid-cols-3 gap-1 bg-slate-900/60 p-1 rounded-xl border border-white/5 text-[10px]">
                <button
                  data-geom="cube"
                  class="btn-cym-geom py-1.5 px-1 rounded-lg font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                    this.state.geometry === 'cube'
                      ? 'glass-btn-active font-bold text-cyan-300 shadow-sm ring-1 ring-cyan-500/30 bg-slate-800'
                      : 'text-gray-400 hover:text-gray-200'
                  }"
                >
                  <span>${isOnly2DPlate ? 'Square Plate' : 'Cube / Rect'}</span>
                </button>
                <button
                  data-geom="cylinder"
                  class="btn-cym-geom py-1.5 px-1 rounded-lg font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                    this.state.geometry === 'cylinder'
                      ? 'glass-btn-active font-bold text-cyan-300 shadow-sm ring-1 ring-cyan-500/30 bg-slate-800'
                      : 'text-gray-400 hover:text-gray-200'
                  }"
                >
                  <span>${isOnly2DPlate ? 'Circular Bessel' : 'Cyl / Bessel'}</span>
                </button>
                <button
                  data-geom="sphere"
                  ${isOnly2DPlate ? 'disabled' : ''}
                  class="btn-cym-geom py-1.5 px-1 rounded-lg font-semibold flex items-center justify-center gap-1 transition-all ${
                    isOnly2DPlate
                      ? 'cursor-not-allowed pointer-events-none text-gray-600'
                      : this.state.geometry === 'sphere'
                      ? 'glass-btn-active font-bold text-cyan-300 shadow-sm ring-1 ring-cyan-500/30 bg-slate-800 cursor-pointer'
                      : 'text-gray-400 hover:text-gray-200 cursor-pointer'
                  }"
                >
                  <span>${isOnly2DPlate ? '— (2D Flat)' : 'Sphere'}</span>
                </button>
              </div>
            </div>

            <!-- 1-Click Wave Shape Presets Matrix -->
            <div class="flex flex-col gap-1">
              <span class="text-[10px] text-slate-400 font-medium">1-Click Shape Presets:</span>
              <div class="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto pr-0.5 custom-scrollbar">
                ${CymaticsControls.PRESETS.map(preset => {
                  const isSelected =
                    this.state.n === preset.n &&
                    this.state.m === preset.m &&
                    this.state.l === preset.l &&
                    this.state.geometry === preset.geometry;
                  const isPresetDisabled = is2DCymatics && preset.geometry === 'sphere';
                  return `
                  <button
                    data-preset-id="${preset.id}"
                    ${isPresetDisabled ? 'disabled' : ''}
                    class="btn-cym-preset p-1.5 rounded-xl flex flex-col gap-0.5 text-left transition-all ${
                      isPresetDisabled
                        ? 'bg-slate-900/30 border border-white/5 cursor-not-allowed pointer-events-none text-gray-500'
                        : isSelected
                        ? 'bg-slate-800/90 border border-cyan-400/50 shadow-sm ring-1 ring-cyan-400/30 cursor-pointer'
                        : 'bg-slate-900/60 border border-white/5 hover:bg-slate-800/60 hover:border-white/15 cursor-pointer'
                    }"
                  >
                    <div class="flex items-center justify-between w-full">
                      <span class="font-bold text-[10px] ${isPresetDisabled ? 'text-gray-500' : isSelected ? 'text-cyan-300' : 'text-slate-200'}">${preset.name}</span>
                      <span class="text-[8px] font-mono px-1 rounded ${isPresetDisabled ? 'bg-slate-900 text-gray-600' : 'bg-slate-800 text-cyan-400 font-semibold'}">${preset.badge}</span>
                    </div>
                    <span class="text-[9px] ${isPresetDisabled ? 'text-gray-600' : 'text-slate-400'} font-mono">${preset.subtitle}</span>
                  </button>
                `;
                }).join('')}
              </div>
            </div>

            <!-- Modal Orders (n, m, l) Sliders & Steppers -->
            <div class="flex flex-col gap-2 bg-slate-900/80 p-2.5 rounded-xl border border-white/5">
              <div class="flex items-center justify-between pb-1 border-b border-white/5">
                <span class="text-[10px] text-slate-300 font-semibold">Harmonic Orders:</span>
                <div class="flex items-center gap-1">
                  <span class="text-[9px] text-gray-400">Natural Pitch:</span>
                  <span class="text-[10px] text-cyan-400 font-mono font-bold">${this.state.calculatedEigenfrequency.toFixed(1)} Hz (${this.state.noteInfo.name})</span>
                </div>
              </div>

              <!-- n Slider & Stepper (Width / X) -->
              <div class="flex items-center justify-between gap-2 w-full min-w-0">
                <span class="text-[10px] font-mono text-cyan-400 w-16 truncate shrink-0" title="Width wave mode (X)">Width (n):</span>
                <button data-step-n="-1" aria-label="Decrease width wave order n" class="btn-step flex items-center justify-center cursor-pointer select-none">−</button>
                <input type="range" id="cym-slider-n" min="1" max="8" step="1" value="${this.state.n}" aria-label="Width wave order n" class="flex-1 min-w-0 w-full cursor-pointer slider-cyan" />
                <button data-step-n="1" aria-label="Increase width wave order n" class="btn-step flex items-center justify-center cursor-pointer select-none">+</button>
                <span id="cym-val-n" class="text-xs font-mono font-bold text-cyan-400 w-4 text-right shrink-0">${this.state.n}</span>
              </div>

              <!-- m Slider & Stepper (Height / Y) -->
              <div class="flex items-center justify-between gap-2 w-full min-w-0">
                <span class="text-[10px] font-mono text-blue-400 w-16 truncate shrink-0" title="Height wave mode (Y)">Height (m):</span>
                <button data-step-m="-1" aria-label="Decrease height wave order m" class="btn-step flex items-center justify-center cursor-pointer select-none">−</button>
                <input type="range" id="cym-slider-m" min="1" max="8" step="1" value="${this.state.m}" aria-label="Height wave order m" class="flex-1 min-w-0 w-full cursor-pointer slider-blue" />
                <button data-step-m="1" aria-label="Increase height wave order m" class="btn-step flex items-center justify-center cursor-pointer select-none">+</button>
                <span id="cym-val-m" class="text-xs font-mono font-bold text-blue-400 w-4 text-right shrink-0">${this.state.m}</span>
              </div>

              <!-- l Slider & Stepper (Depth / Z) -->
              <div class="flex items-center justify-between gap-2 w-full min-w-0 ${is2DCymatics ? 'opacity-40' : ''}">
                <span class="text-[10px] font-mono ${is2DCymatics ? 'text-gray-500' : 'text-purple-400'} w-16 truncate shrink-0" title="Depth wave mode (Z)">Depth (ℓ):</span>
                <button data-step-l="-1" ${is2DCymatics ? 'disabled' : ''} aria-label="Decrease depth wave order l" class="btn-step flex items-center justify-center ${is2DCymatics ? 'cursor-not-allowed pointer-events-none text-gray-600' : 'cursor-pointer select-none'}">−</button>
                <input type="range" id="cym-slider-l" min="1" max="6" step="1" value="${this.state.l}" ${is2DCymatics ? 'disabled' : ''} aria-label="Depth wave order l" class="flex-1 min-w-0 w-full slider-purple ${is2DCymatics ? 'cursor-not-allowed pointer-events-none' : 'cursor-pointer'}" />
                <button data-step-l="1" ${is2DCymatics ? 'disabled' : ''} aria-label="Increase depth wave order l" class="btn-step flex items-center justify-center ${is2DCymatics ? 'cursor-not-allowed pointer-events-none text-gray-600' : 'cursor-pointer select-none'}>+</button>
                <span id="cym-val-l" class="text-xs font-mono font-bold ${is2DCymatics ? 'text-gray-500' : 'text-purple-400'} w-4 text-right shrink-0">${is2DCymatics ? '—' : this.state.l}</span>
              </div>
            </div>

            <!-- Trapping Mode -->
            <div class="pt-0.5">
              <button
                id="cym-btn-trapping-mode"
                class="w-full py-1.5 px-2 rounded-xl text-[10px] font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                  this.state.trappingMode === 'nodes'
                    ? 'bg-slate-800 text-cyan-300 border border-cyan-500/30'
                    : 'bg-purple-900/40 text-purple-300 border border-purple-500/40'
                }"
              >
                <span>${this.state.trappingMode === 'nodes' ? '🎯 Trapping: Nodal Lines (Sand Focus)' : '⚡ Trapping: Antinodes (Inverse Focus)'}</span>
              </button>
            </div>
          </div>
        </div>

        <!-- SECTION 2: AUDIO DRIVE & SOUND SOURCE -->
        <div class="flex flex-col gap-2.5 bg-slate-950/60 p-3 rounded-2xl border border-white/5">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-1.5">
              <span class="w-2 h-2 rounded-full bg-cyan-400 shadow-sm shadow-cyan-400/50"></span>
              <span class="text-xs font-bold text-slate-200">Audio Drive & Sound Source</span>
            </div>
          </div>

          <!-- Audio Source Sub-Pills -->
          <div role="tablist" class="grid grid-cols-3 gap-1 bg-slate-900/80 p-1 rounded-xl border border-white/5 text-[10px]">
            <button
              id="src-tab-tracks"
              role="tab"
              aria-selected="${this.state.audioDriveTab === 'tracks'}"
              class="py-1 px-1.5 rounded-lg font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                this.state.audioDriveTab === 'tracks'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold shadow-sm'
                  : 'text-gray-400 hover:text-gray-200'
              }"
            >
              <span>Tracks</span>
            </button>
            <button
              id="src-tab-mic-file"
              role="tab"
              aria-selected="${this.state.audioDriveTab === 'mic-file'}"
              class="py-1 px-1.5 rounded-lg font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                this.state.audioDriveTab === 'mic-file'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold shadow-sm'
                  : 'text-gray-400 hover:text-gray-200'
              }"
            >
              <span>Mic / File</span>
            </button>
            <button
              id="src-tab-synth"
              role="tab"
              aria-selected="${this.state.audioDriveTab === 'synth'}"
              class="py-1 px-1.5 rounded-lg font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                this.state.audioDriveTab === 'synth'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold shadow-sm'
                  : 'text-gray-400 hover:text-gray-200'
              }"
            >
              <span>Tone Synth</span>
            </button>
          </div>

          ${
            this.state.audioDriveTab === 'tracks'
              ? `
          <!-- TRACK LIBRARY SUB-VIEW -->
          <div class="flex flex-col gap-2">
            <!-- Track Search & Category Filters -->
            <div class="flex flex-col gap-1.5">
              <div class="relative">
                <input
                  type="text"
                  id="cym-search-input"
                  aria-label="Search demo audio tracks"
                  placeholder="Search tracks, BPM, genre..."
                  value="${this.searchQuery}"
                  class="w-full h-7 pl-7 pr-3 rounded-xl text-xs bg-slate-900/90 border border-white/10 placeholder-slate-500 text-white outline-none focus:border-cyan-400 transition-all shadow-inner"
                />
                <svg class="w-3.5 h-3.5 text-slate-500 absolute left-2 top-2 pointer-events-none" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
              </div>

              <!-- Category Filter Pills -->
              <div class="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar text-[10px]">
                ${[
                  { id: 'all', label: 'All' },
                  { id: 'ambient', label: 'Ambient' },
                  { id: 'electronic', label: 'Electronic' },
                  { id: 'organic', label: 'Organic' },
                  { id: 'classical', label: 'Classical' },
                  { id: 'experimental', label: 'Lab' },
                ]
                  .map(
                    c => `
                  <button
                    data-category="${c.id}"
                    class="btn-category-pill px-2 py-0.5 rounded-lg font-semibold whitespace-nowrap transition-all cursor-pointer ${
                      this.selectedCategory === c.id
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                        : 'bg-slate-900/60 text-gray-400 hover:text-white border border-white/5'
                    }"
                  >
                    ${c.label}
                  </button>
                `
                  )
                  .join('')}
              </div>
            </div>

            <!-- Active Track Player Bar & Mini Scrubber -->
            <div class="p-2 rounded-xl bg-slate-900/90 border border-white/10 flex flex-col gap-1.5">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2 min-w-0">
                  <button
                    id="cym-btn-play-pause"
                    class="w-7 h-7 rounded-xl bg-cyan-400 text-slate-950 font-bold flex items-center justify-center hover:bg-cyan-300 transition-all cursor-pointer shrink-0 shadow-sm active:scale-95"
                  >
                    ${
                      isPlaying
                        ? `<svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>`
                        : `<svg class="w-3.5 h-3.5 fill-current ml-0.5" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>`
                    }
                  </button>
                  <div class="min-w-0">
                    <h4 class="text-xs font-bold text-white truncate">${currentTrack ? currentTrack.name : 'No Track Selected'}</h4>
                    <p class="text-[9px] text-gray-400 truncate">${currentTrack ? `${currentTrack.genre} • ${currentTrack.bpm} BPM` : 'Select a demo track below'}</p>
                  </div>
                </div>
                ${
                  isPlaying
                    ? `<span class="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 animate-pulse shrink-0">PLAYING</span>`
                    : ''
                }
              </div>

              <!-- Interactive Wave Scrubber -->
              <div class="flex flex-col gap-0.5">
                <input
                  type="range"
                  id="cym-timeline-scrubber"
                  min="0"
                  max="${duration > 0 ? duration : 100}"
                  step="0.1"
                  value="${currentTime}"
                  class="w-full h-1 rounded-full cursor-pointer appearance-none bg-white/10"
                  style="background: linear-gradient(to right, #22d3ee ${progressPct}%, rgba(255, 255, 255, 0.12) ${progressPct}%);"
                />
                <div class="flex justify-between text-[9px] font-mono text-gray-400">
                  <span id="cym-label-current-time">${this.formatTime(currentTime)}</span>
                  <span id="cym-label-duration">${this.formatTime(duration)}</span>
                </div>
              </div>
            </div>

            <!-- Track List Cards -->
            <div class="flex flex-col gap-1 max-h-36 overflow-y-auto pr-0.5 custom-scrollbar">
              ${filteredTracks
                .map(t => {
                  const isCurrent = t.id === currentTrackId;
                  return `
                <button
                  data-track="${t.id}"
                  class="btn-track-card p-2 rounded-xl flex items-center justify-between text-left transition-all cursor-pointer ${
                    isCurrent
                      ? 'bg-cyan-950/40 border border-cyan-400/50 shadow-sm ring-1 ring-cyan-400/20'
                      : 'bg-slate-900/60 border border-white/5 hover:bg-slate-800/60 hover:border-white/15'
                  }"
                >
                  <div class="flex items-center gap-2 min-w-0">
                    <span class="text-xs ${isCurrent ? 'text-cyan-400' : 'text-gray-500'} font-mono">${isCurrent && isPlaying ? '▶' : '♪'}</span>
                    <div class="min-w-0">
                      <div class="text-[11px] font-bold ${isCurrent ? 'text-cyan-300' : 'text-slate-200'} truncate">${t.name}</div>
                      <div class="text-[9px] text-gray-400 truncate">${t.genre} • ${t.bpm} BPM</div>
                    </div>
                  </div>
                  <span class="text-[9px] font-mono ${isCurrent ? 'text-cyan-400 font-bold' : 'text-gray-500'} shrink-0">${t.bpm} BPM</span>
                </button>
              `;
                })
                .join('')}
            </div>
          </div>
          `
              : this.state.audioDriveTab === 'mic-file'
              ? `
          <!-- MIC / CUSTOM FILE SUB-VIEW -->
          <div class="flex flex-col gap-2">
            <!-- Microphone Card -->
            <div class="p-2.5 rounded-xl bg-slate-900/80 border border-white/5 flex items-center justify-between">
              <div class="flex items-center gap-2">
                <div class="w-7 h-7 rounded-xl ${isMicActive ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-800 text-cyan-400'} flex items-center justify-center text-xs">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/></svg>
                </div>
                <div>
                  <h4 class="text-[11px] font-bold text-white">Live Microphone</h4>
                  <p class="text-[9px] text-gray-400">${isMicActive ? 'Streaming live acoustic input' : 'Stream your voice or room sound'}</p>
                </div>
              </div>
              <button
                id="cym-btn-mic"
                class="px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                  isMicActive
                    ? 'bg-red-500 text-white shadow-lg ring-1 ring-red-400'
                    : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/30'
                }"
              >
                ${isMicActive ? 'Stop Mic' : 'Start Mic'}
              </button>
            </div>

            <!-- File Upload Dropzone Card -->
            <div class="p-2.5 rounded-xl bg-slate-900/80 border border-dashed border-white/10 hover:border-cyan-400/40 transition-all flex flex-col gap-1.5 text-center">
              <svg class="w-5 h-5 mx-auto text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>
              <div>
                <h4 class="text-[11px] font-bold text-white">Upload Audio File</h4>
                <p class="text-[9px] text-gray-400">Supports MP3, WAV, AAC, FLAC, OGG</p>
              </div>
              <label class="cursor-pointer">
                <input type="file" id="cym-file-input" accept="audio/*" class="hidden" />
                <span class="inline-block px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 text-[10px] font-bold border border-white/10 shadow-sm transition-all">
                  ${loadedFileName ? `Loaded: ${loadedFileName}` : 'Choose Audio File'}
                </span>
              </label>
            </div>
          </div>
          `
              : `
          <!-- TONE SYNTHESIZER SUB-VIEW -->
          <div class="flex flex-col gap-2">
            
            <!-- Tone Mode Selector: Eigenmode vs Frequency Sweeper -->
            <div class="grid grid-cols-2 gap-1 bg-slate-900/90 p-1 rounded-xl border border-white/10 text-[10px]">
              <button
                id="cym-synth-sub-eigen"
                class="py-1 px-1.5 rounded-lg font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                  this.synthSubMode === 'eigenmode'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold shadow-sm'
                    : 'text-gray-400 hover:text-gray-200'
                }"
              >
                <span>Modal f₀ (${this.state.calculatedEigenfrequency.toFixed(0)}Hz)</span>
              </button>
              <button
                id="cym-synth-sub-sweeper"
                class="py-1 px-1.5 rounded-lg font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                  this.synthSubMode === 'sweeper'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold shadow-sm'
                    : 'text-gray-400 hover:text-gray-200'
                }"
              >
                <span>Sweeper (${this.customFreq}Hz)</span>
              </button>
            </div>

            ${
              this.synthSubMode === 'eigenmode'
                ? `
            <!-- 1. Theoretical Cavity Eigenmode Audition View -->
            <div class="p-2.5 rounded-xl bg-slate-950/80 border border-white/5 flex flex-col gap-2">
              <div class="flex items-center justify-between">
                <div>
                  <span class="text-[9px] text-gray-400 font-medium">Resonant Natural Pitch:</span>
                  <div class="text-base font-bold font-mono text-cyan-400">${this.state.calculatedEigenfrequency.toFixed(1)} Hz</div>
                  <div class="text-[10px] text-gray-300 font-mono">${this.state.noteInfo.name} (${this.state.noteInfo.cents >= 0 ? '+' : ''}${this.state.noteInfo.cents}¢)</div>
                </div>

                <button
                  id="cym-btn-audition-synth"
                  class="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    isPlayingSynth
                      ? 'bg-cyan-400 text-slate-950 shadow-md ring-1 ring-cyan-300'
                      : 'bg-slate-800 hover:bg-slate-700 text-white border border-white/10'
                  }"
                >
                  <span>${isPlayingSynth ? 'Stop' : 'Audition f₀'}</span>
                </button>
              </div>

              <!-- Realtime Audio Coupling Toggle -->
              <div class="flex items-center justify-between pt-1 border-t border-white/5">
                <span class="text-[10px] text-slate-300 font-medium">Coupled Standing Wave:</span>
                <button
                  id="cym-btn-audio-coupled"
                  class="px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                    this.state.audioCoupled
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-sm'
                      : 'bg-slate-900 border border-white/10 text-gray-400 hover:text-white'
                  }"
                >
                  <span>${this.state.audioCoupled ? '✓ Audio Coupled' : 'Manual Static'}</span>
                </button>
              </div>
            </div>
            `
                : `
            <!-- 2. Full Freeform Frequency Sweeper & Solfeggio View -->
            <div class="p-2.5 rounded-xl bg-slate-950/80 border border-white/5 flex flex-col gap-2">
              
              <!-- Master Frequency Display & Play Button -->
              <div class="flex items-center justify-between">
                <div class="flex flex-col">
                  <span class="text-[9px] text-gray-400">Target Frequency:</span>
                  <div class="flex items-baseline gap-1.5">
                    <input
                      type="number"
                      id="cym-freq-number-input"
                      min="20"
                      max="20000"
                      step="1"
                      value="${this.customFreq}"
                      class="w-20 bg-slate-900 border border-white/15 rounded-lg px-2 py-0.5 text-xs font-mono font-bold text-cyan-300 outline-none"
                    />
                    <span class="text-[10px] font-mono text-gray-400">Hz</span>
                    <span id="cym-freq-note-badge" class="text-[10px] font-mono font-bold text-cyan-400 ml-1">(${this.customNoteInfo.name})</span>
                  </div>
                </div>

                <button
                  id="cym-btn-play-custom-synth"
                  class="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    isPlayingSynth
                      ? 'bg-cyan-400 text-slate-950 shadow-md ring-1 ring-cyan-300'
                      : 'bg-slate-800 hover:bg-slate-700 text-white border border-white/10'
                  }"
                >
                  <span>${isPlayingSynth ? 'Stop' : 'Play Tone'}</span>
                </button>
              </div>

              <!-- Logarithmic Frequency Slider (20Hz - 20kHz) -->
              <div class="flex flex-col gap-0.5">
                <input
                  type="range"
                  id="cym-freq-master-slider"
                  min="0"
                  max="1000"
                  value="${this.freqToSlider(this.customFreq)}"
                  class="w-full min-w-0 cursor-pointer slider-cyan"
                />
                <div class="flex justify-between text-[8px] font-mono text-gray-500">
                  <span>20 Hz</span>
                  <span>100 Hz</span>
                  <span>1 kHz</span>
                  <span>10 kHz</span>
                  <span>20 kHz</span>
                </div>
              </div>

              <!-- Fine-Tuning Steppers -->
              <div class="grid grid-cols-4 gap-1">
                <button data-delta-hz="-10" class="btn-cym-freq-step py-1 rounded-lg text-[10px] font-mono font-bold bg-slate-900 hover:bg-slate-800 text-gray-300 border border-white/5 cursor-pointer">-10Hz</button>
                <button data-delta-hz="-1" class="btn-cym-freq-step py-1 rounded-lg text-[10px] font-mono font-bold bg-slate-900 hover:bg-slate-800 text-gray-300 border border-white/5 cursor-pointer">-1Hz</button>
                <button data-delta-hz="1" class="btn-cym-freq-step py-1 rounded-lg text-[10px] font-mono font-bold bg-slate-900 hover:bg-slate-800 text-gray-300 border border-white/5 cursor-pointer">+1Hz</button>
                <button data-delta-hz="10" class="btn-cym-freq-step py-1 rounded-lg text-[10px] font-mono font-bold bg-slate-900 hover:bg-slate-800 text-gray-300 border border-white/5 cursor-pointer">+10Hz</button>
              </div>

              <!-- Waveform & Overtones Toggle -->
              <div class="flex items-center justify-between pt-1 border-t border-white/5">
                <div class="flex items-center gap-1.5">
                  <span class="text-[10px] text-slate-300 font-medium">Wave:</span>
                  <select id="cym-synth-waveform-select" class="bg-slate-900 border border-white/10 text-[10px] font-semibold text-cyan-300 px-2 py-0.5 rounded-lg outline-none cursor-pointer">
                    <option value="sine" ${this.customWaveform === 'sine' ? 'selected' : ''}>Sine ∿</option>
                    <option value="triangle" ${this.customWaveform === 'triangle' ? 'selected' : ''}>Triangle ◬</option>
                    <option value="sawtooth" ${this.customWaveform === 'sawtooth' ? 'selected' : ''}>Sawtooth ⧘</option>
                    <option value="square" ${this.customWaveform === 'square' ? 'selected' : ''}>Square ⊓</option>
                    <option value="organ" ${this.customWaveform === 'organ' ? 'selected' : ''}>Organ</option>
                  </select>
                </div>

                <button
                  id="cym-btn-toggle-overtones"
                  class="px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                    this.showHarmonicsDrawer
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                      : 'bg-slate-900 border border-white/10 text-gray-400 hover:text-white'
                  }"
                >
                  <span>Overtones ${this.showHarmonicsDrawer ? '▲' : '▼'}</span>
                </button>
              </div>

              <!-- Collapsible Overtones Drawer -->
              ${
                this.showHarmonicsDrawer
                  ? `
              <div class="p-2 rounded-xl bg-slate-900/90 border border-slate-700/60 grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto custom-scrollbar">
                ${[1, 2, 3, 4, 5, 6, 7, 8]
                  .map(h => {
                    const synth = this.audioEngine.synthesizer;
                    const weight = synth ? (synth.harmonics as unknown as Record<string, number>)[`h${h}`] || 0 : (h === 1 ? 1 : 0);
                    return `
                    <div class="flex flex-col gap-0.5 bg-white/5 p-1.5 rounded-lg border border-white/5 min-w-0">
                      <div class="flex justify-between text-[9px] font-mono">
                        <span class="font-bold text-gray-300">${h}× (${Math.round(this.customFreq * h)} Hz)</span>
                        <span class="text-cyan-400">${Math.round(weight * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value="${weight}"
                        data-harmonic="${h}"
                        class="cym-harmonic-slider w-full min-w-0 cursor-pointer slider-cyan"
                      />
                    </div>
                  `;
                  })
                  .join('')}
              </div>
              `
                  : ''
              }

              <!-- Solfeggio & Harmonic Presets Grid -->
              <div class="flex flex-col gap-1 pt-1 border-t border-white/5">
                <span class="text-[10px] text-slate-400 font-medium">Solfeggio & Harmonic Presets:</span>
                <div class="grid grid-cols-3 gap-1">
                  ${[
                    { name: '432 Hz Cosmic', hz: 432 },
                    { name: '528 Hz Solfeggio', hz: 528 },
                    { name: '639 Hz Harmony', hz: 639 },
                    { name: '396 Hz Root', hz: 396 },
                    { name: '741 Hz Intuition', hz: 741 },
                    { name: '852 Hz Pure', hz: 852 },
                    { name: '963 Hz Crown', hz: 963 },
                    { name: '108 Hz Sub', hz: 108 },
                    { name: '256 Hz Sci-C', hz: 256 },
                  ]
                    .map(
                      p => `
                    <button data-hz="${p.hz}" class="btn-cym-freq-preset py-1 px-1 rounded-lg text-[9px] font-mono font-medium truncate transition-all cursor-pointer ${
                      this.customFreq === p.hz
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold shadow-sm'
                        : 'bg-slate-900/60 border border-white/5 text-gray-400 hover:text-gray-200'
                    }">
                      ${p.name}
                    </button>
                  `
                    )
                    .join('')}
                </div>
              </div>

            </div>
            `
            }

          </div>
          `
          }
        </div>

      </div>
    `;

    this.attachEvents();
  }

  private attachEvents(): void {
    // 1. Audio Drive Source Sub-Tabs (Tracks / Mic-File / Synth)
    this.element.querySelector('#src-tab-tracks')?.addEventListener('click', () => {
      this.state.audioDriveTab = 'tracks';
      this.render();
    });

    this.element.querySelector('#src-tab-mic-file')?.addEventListener('click', () => {
      this.state.audioDriveTab = 'mic-file';
      this.render();
    });

    this.element.querySelector('#src-tab-synth')?.addEventListener('click', () => {
      this.state.audioDriveTab = 'synth';
      this.render();
    });

    // 3. Track Search & Filters
    const searchInput = this.element.querySelector('#cym-search-input') as HTMLInputElement;
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        this.searchQuery = searchInput.value.toLowerCase().trim();
        const cards = this.element.querySelectorAll('.btn-track-card');
        cards.forEach(card => {
          const text = (card as HTMLElement).textContent?.toLowerCase() || '';
          const matches = !this.searchQuery || text.includes(this.searchQuery);
          (card as HTMLElement).style.display = matches ? 'flex' : 'none';
        });
      });
    }

    this.element.querySelectorAll('.btn-category-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        this.selectedCategory = (btn as HTMLElement).dataset.category || 'all';
        this.render();
      });
    });

    // 4. Play / Pause & Scrubber
    this.element.querySelector('#cym-btn-play-pause')?.addEventListener('click', () => {
      this.audioEngine.togglePlayPause();
    });

    const scrubber = this.element.querySelector('#cym-timeline-scrubber') as HTMLInputElement;
    if (scrubber) {
      scrubber.addEventListener('input', () => {
        this.isScrubbing = true;
        const val = parseFloat(scrubber.value);
        const curLabel = this.element.querySelector('#cym-label-current-time');
        if (curLabel) curLabel.textContent = this.formatTime(val);
      });

      scrubber.addEventListener('change', () => {
        const val = parseFloat(scrubber.value);
        this.audioEngine.seek(val);
        this.isScrubbing = false;
      });
    }

    // 5. Track Selection
    this.element.querySelectorAll('.btn-track-card').forEach(btn => {
      btn.addEventListener('click', () => {
        const trackId = (btn as HTMLElement).dataset.track;
        if (!trackId) return;
        this.audioEngine.playDemoTrack(trackId);
      });
    });

    // 6. Mic & Upload Handlers
    this.element.querySelector('#cym-btn-mic')?.addEventListener('click', async () => {
      await this.audioEngine.initialize();
      if (this.audioEngine.isMicrophoneActive()) {
        this.audioEngine.stopMicrophone();
      } else {
        await this.audioEngine.startMicrophone();
      }
      this.render();
    });

    const fileInput = this.element.querySelector('#cym-file-input') as HTMLInputElement;
    if (fileInput) {
      fileInput.addEventListener('change', async () => {
        const file = fileInput.files?.[0];
        if (!file) return;
        await this.audioEngine.initialize();
        await this.audioEngine.loadAudioFile(file);
        this.render();
      });
    }

    // 7. Resonant Tone Synth Audition & Controls
    this.element.querySelector('#cym-synth-sub-eigen')?.addEventListener('click', () => {
      this.synthSubMode = 'eigenmode';
      if (this.audioEngine.synthesizer?.getIsPlaying()) {
        this.audioEngine.synthesizer.setFrequency(this.state.calculatedEigenfrequency);
      }
      this.render();
    });

    this.element.querySelector('#cym-synth-sub-sweeper')?.addEventListener('click', () => {
      this.synthSubMode = 'sweeper';
      if (this.audioEngine.synthesizer?.getIsPlaying()) {
        this.audioEngine.synthesizer.setFrequency(this.customFreq);
      }
      this.render();
    });

    this.element.querySelector('#cym-btn-audition-synth')?.addEventListener('click', async () => {
      await this.audioEngine.initialize();
      if (this.audioEngine.synthesizer?.getIsPlaying()) {
        this.audioEngine.synthesizer.stop();
      } else {
        this.audioEngine.playFrequency(this.state.calculatedEigenfrequency);
      }
      this.render();
    });

    this.element.querySelector('#cym-btn-play-custom-synth')?.addEventListener('click', async () => {
      await this.audioEngine.initialize();
      if (this.audioEngine.synthesizer?.getIsPlaying()) {
        this.audioEngine.synthesizer.stop();
      } else {
        this.audioEngine.playFrequency(this.customFreq);
      }
      this.render();
    });

    const freqInput = this.element.querySelector('#cym-freq-number-input') as HTMLInputElement;
    if (freqInput) {
      freqInput.addEventListener('input', () => {
        const val = parseFloat(freqInput.value);
        if (!isNaN(val)) this.setCustomFrequency(val, false);
      });
      freqInput.addEventListener('change', () => {
        const val = parseFloat(freqInput.value);
        if (!isNaN(val)) this.setCustomFrequency(val, false);
      });
    }

    const freqSlider = this.element.querySelector('#cym-freq-master-slider') as HTMLInputElement;
    if (freqSlider) {
      freqSlider.addEventListener('input', () => {
        const f = this.sliderToFreq(parseFloat(freqSlider.value));
        this.setCustomFrequency(f, true);
      });
    }

    this.element.querySelectorAll('.btn-cym-freq-step').forEach(btn => {
      btn.addEventListener('click', () => {
        const delta = parseFloat((btn as HTMLElement).dataset.deltaHz || '0');
        this.setCustomFrequency(this.customFreq + delta, false);
      });
    });

    const wfSelect = this.element.querySelector('#cym-synth-waveform-select') as HTMLSelectElement;
    if (wfSelect) {
      wfSelect.addEventListener('change', () => {
        this.setCustomWaveform(wfSelect.value as WaveformType);
      });
    }

    this.element.querySelector('#cym-btn-toggle-overtones')?.addEventListener('click', () => {
      this.showHarmonicsDrawer = !this.showHarmonicsDrawer;
      this.render();
    });

    this.element.querySelectorAll('.cym-harmonic-slider').forEach(slider => {
      slider.addEventListener('input', () => {
        const input = slider as HTMLInputElement;
        const hIndex = parseInt(input.dataset.harmonic || '1', 10);
        const weight = parseFloat(input.value);
        this.setHarmonicWeight(hIndex, weight);
        const label = input.parentElement?.querySelector('.text-cyan-400');
        if (label) label.textContent = `${Math.round(weight * 100)}%`;
      });
    });

    this.element.querySelectorAll('.btn-cym-freq-preset').forEach(btn => {
      btn.addEventListener('click', () => {
        const hz = parseFloat((btn as HTMLElement).dataset.hz || '432');
        this.setCustomFrequency(hz, false);
      });
    });

    this.element.querySelector('#cym-btn-audio-coupled')?.addEventListener('click', () => {
      this.state.audioCoupled = !this.state.audioCoupled;
      this.notifyStateChange();
      this.render();
    });

    // Toggle Resonator Shapes Collapsible Accordion
    this.element.querySelector('#btn-toggle-cym-shapes')?.addEventListener('click', () => {
      this.isResonatorOpen = !this.isResonatorOpen;
      this.render();
    });

    // 8. Apparatus Multi-Stage Layer Toggles (2D Sand Plate vs 3D Droplet vs 3D Trap)
    this.element.querySelectorAll('.btn-cym-layer').forEach(btn => {
      btn.addEventListener('click', e => {
        const target = e.currentTarget as HTMLElement;
        const layer = target.getAttribute('data-layer') as 'plate' | 'droplet' | 'trap';
        if (layer && this.visualizer?.getCymaticsLayers) {
          const curLayers = this.visualizer.getCymaticsLayers();
          const targetState = !curLayers[layer];
          // Ensure at least one layer is active
          const otherActive = Object.entries(curLayers).some(([k, v]) => k !== layer && v);
          if (!targetState && !otherActive) {
            return;
          }
          this.visualizer.setCymaticsLayers({ [layer]: targetState });

          const newLayers = this.visualizer.getCymaticsLayers();
          if (newLayers.plate && !newLayers.droplet && !newLayers.trap) {
            this.state.apparatus = '2d-plate';
            this.visualizer.setStyle('cymatics-2d');
          } else if (!newLayers.plate && newLayers.droplet && !newLayers.trap) {
            this.state.apparatus = '3d-droplet';
            this.visualizer.setStyle('cymatics');
          } else if (!newLayers.plate && !newLayers.droplet && newLayers.trap) {
            this.state.apparatus = '3d-particles';
            this.visualizer.setStyle('cymatics');
          } else {
            this.state.apparatus = '3d-both';
            this.visualizer.setStyle('cymatics');
          }

          this.notifyStateChange();
          this.render();
        }
      });
    });

    // 9. Chamber Geometry
    this.element.querySelectorAll('.btn-cym-geom').forEach(btn => {
      btn.addEventListener('click', () => {
        const geom = (btn as HTMLElement).dataset.geom as ChamberGeometry;
        if (geom) {
          this.state.geometry = geom;
          this.notifyStateChange();
          this.render();
        }
      });
    });

    // 10. Presets
    this.element.querySelectorAll('.btn-cym-preset').forEach(btn => {
      btn.addEventListener('click', () => {
        const presetId = (btn as HTMLElement).dataset.presetId;
        if (presetId) this.applyPreset(presetId);
      });
    });

    // 11. Steppers and Sliders for n, m, l
    this.element.querySelectorAll('.btn-step').forEach(btn => {
      btn.addEventListener('click', () => {
        const el = btn as HTMLElement;
        if (el.dataset.stepN) {
          const delta = parseInt(el.dataset.stepN, 10);
          this.state.n = Math.max(1, Math.min(8, this.state.n + delta));
        } else if (el.dataset.stepM) {
          const delta = parseInt(el.dataset.stepM, 10);
          this.state.m = Math.max(1, Math.min(8, this.state.m + delta));
        } else if (el.dataset.stepL) {
          const delta = parseInt(el.dataset.stepL, 10);
          this.state.l = Math.max(1, Math.min(6, this.state.l + delta));
        }
        this.notifyStateChange();
        this.render();
      });
    });

    const sliderN = this.element.querySelector('#cym-slider-n') as HTMLInputElement;
    if (sliderN) {
      sliderN.addEventListener('input', () => {
        this.state.n = parseInt(sliderN.value, 10);
        this.notifyStateChange();
        this.render();
      });
    }

    const sliderM = this.element.querySelector('#cym-slider-m') as HTMLInputElement;
    if (sliderM) {
      sliderM.addEventListener('input', () => {
        this.state.m = parseInt(sliderM.value, 10);
        this.notifyStateChange();
        this.render();
      });
    }

    const sliderL = this.element.querySelector('#cym-slider-l') as HTMLInputElement;
    if (sliderL) {
      sliderL.addEventListener('input', () => {
        this.state.l = parseInt(sliderL.value, 10);
        this.notifyStateChange();
        this.render();
      });
    }

    // 12. Trapping Mode
    this.element.querySelector('#cym-btn-trapping-mode')?.addEventListener('click', () => {
      this.state.trappingMode = this.state.trappingMode === 'nodes' ? 'antinodes' : 'nodes';
      this.notifyStateChange();
      this.render();
    });
  }
}
