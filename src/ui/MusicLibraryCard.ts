/**
 * MusicLibraryCard.ts
 * SoundForm 3D - Left Sidebar Music Space & Cymatic Shapes Control Deck
 */

import { AudioEngine } from '../audio/AudioEngine';
import { DemoAudioGenerator } from '../audio/DemoAudioGenerator';
import { VisualizerEngine, VisualStyle } from '../visualizer/VisualizerEngine';

export type ChamberType = 'cube' | 'cylinder' | 'sphere';

export interface ModalPreset {
  id: string;
  n: number;
  m: number;
  l: number;
  name: string;
  subtitle: string;
  geometry: ChamberType;
  description: string;
  badge: string;
}

export class MusicLibraryCard {
  private element: HTMLElement;
  private onTrackChange?: (trackId: string) => void;
  private unsubscribe?: () => void;
  private lastTrackId = '';
  private lastMode = '';
  private lastFileName: string | null = null;
  private lastMicActive = false;
  private lastIsPlaying = false;
  private isScrubbing = false;

  // Active Tab: 'library' (Audio Tracks & Mic) vs 'cymatics' (Cymatic Shapes & Modal Controls)
  private activeTab: 'library' | 'cymatics' = 'library';

  // Cymatics Shape State in Music Space
  private modalN = 2;
  private modalM = 2;
  private modalL = 1;
  private chamberGeometry: ChamberType = 'cube';
  private syncToMusic = true;
  private trappingMode: 'normal' | 'inverse' = 'normal';
  private showEnclosure = false;

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
    onTrackChange?: (trackId: string) => void
  ) {
    this.element = document.createElement('div');
    this.element.className = 'w-full flex flex-col gap-2.5 select-none transition-all duration-300';
    this.onTrackChange = onTrackChange;
    this.preventEventBleeding();
    this.render();
    this.setupListeners();
    this.unsubscribe = this.audioEngine.subscribe(() => {
      this.update();
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
    this.render();
    return this.element;
  }

  private preventEventBleeding(): void {
    this.element.addEventListener('wheel', e => e.stopPropagation(), { passive: false });
    this.element.addEventListener('pointerdown', e => e.stopPropagation());
  }

  private setupListeners(): void {
    window.addEventListener('visual-style-changed', ((e: CustomEvent<{ style: VisualStyle }>) => {
      const style = e.detail?.style;
      if (style === 'cymatics' || style === 'cymatics-2d') {
        this.activeTab = 'cymatics';
      }
      this.render();
    }) as EventListener);

    window.addEventListener('cymatics-layers-changed', (() => {
      this.render();
    }) as EventListener);

    window.addEventListener('modal-state-changed', ((e: CustomEvent<{ n?: number; m?: number; l?: number; geometry?: ChamberType }>) => {
      if (e.detail) {
        if (e.detail.n !== undefined) this.modalN = e.detail.n;
        if (e.detail.m !== undefined) this.modalM = e.detail.m;
        if (e.detail.l !== undefined) this.modalL = e.detail.l;
        if (e.detail.geometry !== undefined) this.chamberGeometry = e.detail.geometry;
        this.render();
      }
    }) as EventListener);
  }

  public update(): void {
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
      const playPauseBtns = this.element.querySelectorAll('#lib-btn-play-pause, #lib-mini-play-pause');
      playPauseBtns.forEach(btn => {
        btn.innerHTML = curPlaying
          ? `<svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>`
          : `<svg class="w-3.5 h-3.5 fill-current ml-0.5" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
      });
    }

    if (curMode === 'file-upload') {
      const curTime = this.audioEngine.getCurrentTime();
      const dur = this.audioEngine.getDuration();
      const curLabel = this.element.querySelector('#lib-label-current-time');
      const durLabel = this.element.querySelector('#lib-label-duration');
      const scrubber = this.element.querySelector('#lib-timeline-scrubber') as HTMLInputElement;

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
  }

  private formatTime(sec: number): string {
    if (!sec || isNaN(sec) || !isFinite(sec) || sec < 0) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  public render(): void {
    const tracks = DemoAudioGenerator.TRACKS;
    const currentTrackId = this.audioEngine.getActiveTrackId();
    const isMicActive = this.audioEngine.isMicrophoneActive();
    const loadedFileName = this.audioEngine.getLoadedFileName();
    const isPlaying = this.audioEngine.getIsPlaying();
    const currentTime = this.audioEngine.getCurrentTime();
    const duration = this.audioEngine.getDuration();
    const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

    const currentTrack = tracks.find(t => t.id === currentTrackId);
    const activeStyle = this.visualizer?.getStyle() || 'hybrid';
    const cymaticsLayers = this.visualizer?.getCymaticsLayers() || { plate: false, droplet: true, trap: true };

    this.lastTrackId = currentTrackId;
    this.lastMode = this.audioEngine.getMode();
    this.lastFileName = loadedFileName;
    this.lastMicActive = isMicActive;
    this.lastIsPlaying = isPlaying;

    const isCymaticsActive = activeStyle === 'cymatics' || activeStyle === 'cymatics-2d';

    this.element.innerHTML = `
      <div class="glass-panel p-3.5 sm:p-4 rounded-3xl flex flex-col gap-3 shadow-xl border border-white/10 text-white select-none">
        
        <!-- Header with Segmented Deck Switcher -->
        <div class="flex flex-col gap-2 border-b border-white/10 pb-2.5">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div class="w-7 h-7 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-cyan-400 font-mono text-xs font-bold shrink-0 shadow-sm">
                ${this.activeTab === 'library' ? '🎵' : '🌀'}
              </div>
              <div>
                <h3 class="text-xs sm:text-sm font-bold text-white">Music Space</h3>
                <p class="text-[10px] text-gray-400">${this.activeTab === 'library' ? 'Audio tracks, uploads & mic' : 'Live cymatic shapes & physics'}</p>
              </div>
            </div>
            <span class="text-[9px] font-bold font-mono px-2 py-0.5 rounded-full ${isCymaticsActive ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'bg-slate-800 text-slate-400 border border-slate-700'}">
              ${isCymaticsActive ? 'CYMATICS' : 'COSMOS'}
            </span>
          </div>

          <!-- Dual Tab Switcher -->
          <div class="grid grid-cols-2 gap-1 bg-slate-950/80 p-1 rounded-2xl border border-white/10">
            <button
              id="tab-btn-library"
              class="py-1.5 px-2 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                this.activeTab === 'library'
                  ? 'glass-btn-active font-bold text-cyan-300 shadow-sm ring-1 ring-cyan-500/30 bg-slate-800'
                  : 'text-gray-400 hover:text-gray-200'
              }"
            >
              <span>🎵 Audio Library</span>
            </button>
            <button
              id="tab-btn-cymatics"
              class="py-1.5 px-2 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                this.activeTab === 'cymatics'
                  ? 'glass-btn-active font-bold text-cyan-300 shadow-sm ring-1 ring-cyan-500/30 bg-slate-800'
                  : 'text-gray-400 hover:text-gray-200'
              }"
            >
              <span>🌀 Cymatic Shapes</span>
            </button>
          </div>
        </div>

        ${
          this.activeTab === 'library'
            ? `
        <!-- TAB 1: AUDIO LIBRARY & TRACKS -->
        ${
          loadedFileName
            ? `
          <!-- Active Custom Audio File Player & Scrubber Card -->
          <div class="p-3 rounded-2xl bg-slate-900/90 border border-cyan-500/40 shadow-sm ring-1 ring-cyan-500/20 flex flex-col gap-2">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2 min-w-0">
                <span class="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse shrink-0"></span>
                <div class="flex flex-col min-w-0">
                  <span class="text-xs font-bold text-cyan-300 truncate" title="${loadedFileName}">${loadedFileName}</span>
                  <span class="text-[9px] text-slate-400">Custom Audio Track</span>
                </div>
              </div>
              <button
                id="lib-btn-play-pause"
                class="w-7 h-7 rounded-lg ${
                  isPlaying ? 'bg-cyan-400 text-slate-950' : 'bg-slate-800 text-white border border-slate-700'
                } flex items-center justify-center cursor-pointer active:scale-95 transition-all shadow-sm shrink-0"
                title="${isPlaying ? 'Pause' : 'Play'}"
              >
                ${
                  isPlaying
                    ? `<svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>`
                    : `<svg class="w-3.5 h-3.5 fill-current ml-0.5" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>`
                }
              </button>
            </div>

            <!-- Custom Track Timeline Scrubber -->
            <div class="flex flex-col gap-1 pt-1 border-t border-white/5">
              <div class="flex items-center justify-between text-[10px] font-mono">
                <span id="lib-label-current-time" class="text-cyan-400 font-bold">${this.formatTime(currentTime)}</span>
                <span id="lib-label-duration" class="text-slate-400">${this.formatTime(duration)}</span>
              </div>
              <input
                type="range"
                id="lib-timeline-scrubber"
                min="0"
                max="${duration > 0 ? duration : 100}"
                step="0.05"
                value="${currentTime}"
                class="w-full cursor-pointer h-1.5 rounded-full bg-slate-800 accent-cyan-400 focus:outline-none"
                style="background: linear-gradient(to right, #22d3ee ${progressPct}%, rgba(255, 255, 255, 0.12) ${progressPct}%);"
                title="Drag to seek"
              />
            </div>
          </div>
        `
            : ''
        }

        <!-- Track Playlist Selection Cards -->
        <div class="flex flex-col gap-1.5">
          <span class="text-[10px] font-semibold text-slate-300">Demo Tracks:</span>
          <div class="flex flex-col gap-1.5">
            ${tracks
              .map(t => {
                const isSelected = !isMicActive && !loadedFileName && t.id === currentTrackId;
                return `
                <button
                  data-track="${t.id}"
                  class="btn-track-card p-2.5 rounded-2xl flex flex-col gap-0.5 text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-slate-800/90 border border-cyan-400/50 shadow-sm ring-1 ring-cyan-400/30'
                      : 'bg-slate-900/60 border border-white/5 hover:bg-slate-800/60 hover:border-white/15'
                  }"
                >
                  <div class="flex items-center justify-between w-full">
                    <span class="font-bold text-xs ${isSelected ? 'text-cyan-300' : 'text-slate-100'}">${t.name}</span>
                    <span class="text-[9px] font-mono px-1.5 py-0.5 rounded-md bg-slate-800 text-slate-300 font-semibold">${t.bpm} BPM</span>
                  </div>
                  <span class="text-[10px] text-slate-400 line-clamp-1">${t.description}</span>
                </button>
              `;
              })
              .join('')}
          </div>
        </div>

        <!-- Custom File Dropzone & Microphone Input -->
        <div class="flex flex-col gap-2 pt-2 border-t border-white/10">
          <span class="text-[10px] font-semibold text-slate-300">Audio Input:</span>
          
          <!-- Dropzone / Upload -->
          <label class="p-2.5 rounded-2xl border-dashed border border-white/20 hover:border-cyan-400/60 bg-slate-900/60 flex flex-col items-center justify-center gap-1 cursor-pointer transition-all hover:bg-slate-800/60 group">
            <svg class="w-4 h-4 text-cyan-400 group-hover:scale-105 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            <div class="text-[10px] text-slate-300 text-center">
              <span class="font-semibold text-white group-hover:text-cyan-300">Upload or drop audio file</span>
              <span class="text-[9px] text-slate-400 block">MP3, WAV, FLAC</span>
            </div>
            <input type="file" id="lib-file-input" accept="audio/*" class="hidden" />
          </label>

          <!-- Live Mic Toggle -->
          <button
            id="lib-btn-mic"
            class="w-full py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 border transition-all cursor-pointer ${
              isMicActive
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-sm'
                : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
            }"
          >
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/>
              <line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
            <span>${isMicActive ? 'Live Microphone Streaming' : 'Enable Microphone Input'}</span>
          </button>
        </div>
        `
            : `
        <!-- TAB 2: CYMATIC SHAPES & MODAL CONTROLS -->
        <div class="flex flex-col gap-3">
          
          <!-- Compact Audio Transport Bar -->
          <div class="p-2.5 rounded-2xl bg-slate-950/80 border border-cyan-500/30 flex items-center justify-between gap-2 shadow-inner">
            <div class="flex items-center gap-2 min-w-0">
              <button
                id="lib-mini-play-pause"
                class="w-7 h-7 rounded-lg ${
                  isPlaying ? 'bg-cyan-400 text-slate-950 font-bold' : 'bg-slate-800 text-white border border-slate-700'
                } flex items-center justify-center cursor-pointer active:scale-95 transition-all shrink-0"
                title="${isPlaying ? 'Pause' : 'Play'}"
              >
                ${
                  isPlaying
                    ? `<svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>`
                    : `<svg class="w-3.5 h-3.5 fill-current ml-0.5" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>`
                }
              </button>
              <div class="flex flex-col min-w-0">
                <span class="text-[11px] font-bold text-cyan-300 truncate">${loadedFileName || currentTrack?.name || 'Live Track'}</span>
                <span class="text-[9px] text-slate-400 font-mono">${isMicActive ? 'Microphone' : `${currentTrack?.bpm || 120} BPM`}</span>
              </div>
            </div>

            <!-- Quick Track Selector -->
            <select id="lib-quick-track-select" class="h-7 px-2 py-0.5 rounded-lg text-[10px] font-semibold text-gray-200 bg-slate-900 border border-white/10 hover:border-cyan-400/50 shadow-sm outline-none cursor-pointer max-w-[110px]">
              ${tracks
                .map(
                  t => `
                <option value="${t.id}" class="bg-slate-900 text-gray-100" ${t.id === currentTrackId ? 'selected' : ''}>${t.name}</option>
              `
                )
                .join('')}
            </select>
          </div>

          <!-- Quick Render Style Selector -->
          <div class="flex flex-col gap-1">
            <span class="text-[10px] text-slate-400 font-medium">Visual Render Style:</span>
            <div class="grid grid-cols-3 gap-1">
              ${[
                { id: 'cymatics', label: 'Cymatics 3D' },
                { id: 'hybrid', label: 'Cosmos' },
                { id: 'wavefront', label: 'Wavefront' },
                { id: 'particles', label: 'Tracer Dust' },
                { id: 'ribbon', label: 'Sonic Ribbon' },
                { id: 'cymatics-2d', label: 'Cymatics 2D' },
              ]
                .map(
                  s => `
                <button data-quick-style="${s.id}" class="btn-quick-style glass-btn py-1.5 px-1 rounded-lg text-[10px] font-medium transition-all text-center cursor-pointer ${
                    activeStyle === s.id ? 'glass-btn-active font-bold shadow-sm ring-1 ring-cyan-400/40 text-cyan-300' : 'text-gray-300 hover:text-white'
                  }">
                  ${s.label}
                </button>
              `
                )
                .join('')}
            </div>
          </div>

          <!-- Multi-Select Cymatics Apparatus Toggles -->
          <div class="flex flex-col gap-1 pt-1 border-t border-white/5">
            <div class="flex items-center justify-between">
              <span class="text-[10px] text-slate-300 font-semibold">Cymatics Apparatus:</span>
              <span class="text-[9px] text-cyan-400 font-mono">Multi-Layer</span>
            </div>
            <div class="grid grid-cols-3 gap-1 bg-slate-900/60 p-1 rounded-2xl border border-white/5">
              <button
                data-cym-layer="plate"
                class="btn-cym-layer py-1.5 px-1 rounded-xl text-[10px] font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                  cymaticsLayers.plate
                    ? 'glass-btn-active font-bold text-cyan-300 shadow-sm ring-1 ring-cyan-500/30'
                    : 'text-gray-400 hover:text-gray-200'
                }"
              >
                <span>${cymaticsLayers.plate ? '✓ ' : ''}2D Sand Plate</span>
              </button>
              <button
                data-cym-layer="droplet"
                class="btn-cym-layer py-1.5 px-1 rounded-xl text-[10px] font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                  cymaticsLayers.droplet
                    ? 'glass-btn-active font-bold text-cyan-300 shadow-sm ring-1 ring-cyan-500/30'
                    : 'text-gray-400 hover:text-gray-200'
                }"
              >
                <span>${cymaticsLayers.droplet ? '✓ ' : ''}3D Droplet</span>
              </button>
              <button
                data-cym-layer="trap"
                class="btn-cym-layer py-1.5 px-1 rounded-xl text-[10px] font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                  cymaticsLayers.trap
                    ? 'glass-btn-active font-bold text-cyan-300 shadow-sm ring-1 ring-cyan-500/30'
                    : 'text-gray-400 hover:text-gray-200'
                }"
              >
                <span>${cymaticsLayers.trap ? '✓ ' : ''}3D Trap</span>
              </button>
            </div>
          </div>

          <!-- Chamber / Resonator Geometry -->
          <div class="flex flex-col gap-1">
            <span class="text-[10px] text-slate-400 font-medium">Chamber Geometry:</span>
            <div class="grid grid-cols-3 gap-1 bg-slate-900/60 p-1 rounded-2xl border border-white/5">
              <button
                data-geom="cube"
                class="btn-cym-geom py-1.5 px-1 rounded-xl text-[10px] font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                  this.chamberGeometry === 'cube' ? 'glass-btn-active font-bold text-cyan-300 shadow-sm ring-1 ring-cyan-500/30' : 'text-gray-400 hover:text-gray-200'
                }"
              >
                <span>Cube / Square</span>
              </button>
              <button
                data-geom="cylinder"
                class="btn-cym-geom py-1.5 px-1 rounded-xl text-[10px] font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                  this.chamberGeometry === 'cylinder' ? 'glass-btn-active font-bold text-cyan-300 shadow-sm ring-1 ring-cyan-500/30' : 'text-gray-400 hover:text-gray-200'
                }"
              >
                <span>Cyl / Bessel</span>
              </button>
              <button
                data-geom="sphere"
                class="btn-cym-geom py-1.5 px-1 rounded-xl text-[10px] font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                  this.chamberGeometry === 'sphere' ? 'glass-btn-active font-bold text-cyan-300 shadow-sm ring-1 ring-cyan-500/30' : 'text-gray-400 hover:text-gray-200'
                }"
              >
                <span>Sphere</span>
              </button>
            </div>
          </div>

          <!-- 1-Click Wave Shape Presets Matrix -->
          <div class="flex flex-col gap-1 pt-1 border-t border-white/5">
            <span class="text-[10px] text-slate-300 font-semibold">Wave Shape Presets:</span>
            <div class="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-0.5 custom-scrollbar">
              ${MusicLibraryCard.PRESETS.map(preset => {
                const isSelected =
                  this.modalN === preset.n &&
                  this.modalM === preset.m &&
                  this.modalL === preset.l &&
                  this.chamberGeometry === preset.geometry;
                return `
                <button
                  data-preset-id="${preset.id}"
                  class="btn-cym-preset p-2 rounded-xl flex flex-col gap-0.5 text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-slate-800/90 border border-cyan-400/50 shadow-sm ring-1 ring-cyan-400/30'
                      : 'bg-slate-900/60 border border-white/5 hover:bg-slate-800/60 hover:border-white/15'
                  }"
                >
                  <div class="flex items-center justify-between w-full">
                    <span class="font-bold text-[11px] ${isSelected ? 'text-cyan-300' : 'text-slate-200'}">${preset.name}</span>
                    <span class="text-[8px] font-mono px-1 rounded bg-slate-800 text-cyan-400 font-semibold">${preset.badge}</span>
                  </div>
                  <span class="text-[9px] text-slate-400 font-mono">${preset.subtitle}</span>
                </button>
              `;
              }).join('')}
            </div>
          </div>

          <!-- Modal Orders (n, m, l) Sliders & Steppers -->
          <div class="flex flex-col gap-2 pt-1 border-t border-white/5">
            <div class="flex items-center justify-between">
              <span class="text-[10px] text-slate-300 font-semibold">Harmonic Orders:</span>
              <span class="text-[10px] text-cyan-400 font-mono font-bold">(${this.modalN}, ${this.modalM}, ${this.modalL})</span>
            </div>

            <!-- n Slider & Stepper -->
            <div class="flex items-center justify-between gap-2">
              <span class="text-[10px] font-mono text-gray-400 w-8">n (X):</span>
              <button data-step-n="-1" class="btn-step w-6 h-6 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-gray-200 flex items-center justify-center cursor-pointer">−</button>
              <input type="range" id="cym-slider-n" min="1" max="8" step="1" value="${this.modalN}" class="flex-1 h-1.5 rounded-full bg-slate-800 accent-cyan-400 cursor-pointer" />
              <button data-step-n="1" class="btn-step w-6 h-6 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-gray-200 flex items-center justify-center cursor-pointer">+</button>
              <span class="text-xs font-mono font-bold text-cyan-400 w-4 text-right">${this.modalN}</span>
            </div>

            <!-- m Slider & Stepper -->
            <div class="flex items-center justify-between gap-2">
              <span class="text-[10px] font-mono text-gray-400 w-8">m (Y):</span>
              <button data-step-m="-1" class="btn-step w-6 h-6 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-gray-200 flex items-center justify-center cursor-pointer">−</button>
              <input type="range" id="cym-slider-m" min="1" max="8" step="1" value="${this.modalM}" class="flex-1 h-1.5 rounded-full bg-slate-800 accent-cyan-400 cursor-pointer" />
              <button data-step-m="1" class="btn-step w-6 h-6 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-gray-200 flex items-center justify-center cursor-pointer">+</button>
              <span class="text-xs font-mono font-bold text-cyan-400 w-4 text-right">${this.modalM}</span>
            </div>

            <!-- l Slider & Stepper -->
            <div class="flex items-center justify-between gap-2">
              <span class="text-[10px] font-mono text-gray-400 w-8">ℓ (Z):</span>
              <button data-step-l="-1" class="btn-step w-6 h-6 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-gray-200 flex items-center justify-center cursor-pointer">−</button>
              <input type="range" id="cym-slider-l" min="1" max="6" step="1" value="${this.modalL}" class="flex-1 h-1.5 rounded-full bg-slate-800 accent-cyan-400 cursor-pointer" />
              <button data-step-l="1" class="btn-step w-6 h-6 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-gray-200 flex items-center justify-center cursor-pointer">+</button>
              <span class="text-xs font-mono font-bold text-cyan-400 w-4 text-right">${this.modalL}</span>
            </div>
          </div>

          <!-- Sync to Music Harmonics Toggle & Trapping Mode -->
          <div class="flex flex-col gap-1.5 pt-1 border-t border-white/5">
            <div class="flex items-center justify-between">
              <span class="text-[10px] text-slate-300 font-medium">Sync to Music Harmonics:</span>
              <button
                id="btn-cym-sync-music"
                class="px-2.5 py-1 rounded-xl text-[10px] font-semibold transition-all cursor-pointer ${
                  this.syncToMusic
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }"
              >
                ${this.syncToMusic ? '✓ Active Sync' : 'Static Shape'}
              </button>
            </div>

            <div class="flex items-center justify-between">
              <span class="text-[10px] text-slate-300 font-medium">Particle Trapping:</span>
              <button
                id="btn-cym-trapping"
                class="px-2.5 py-1 rounded-xl text-[10px] font-semibold transition-all cursor-pointer ${
                  this.trappingMode === 'normal'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                    : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                }"
              >
                ${this.trappingMode === 'normal' ? 'Nodes (Quiet)' : 'Antinodes (Max)'}
              </button>
            </div>

            <div class="flex items-center justify-between">
              <span class="text-[10px] text-slate-300 font-medium">Boundary Box:</span>
              <button
                id="btn-cym-enclosure"
                class="px-2.5 py-1 rounded-xl text-[10px] font-semibold transition-all cursor-pointer ${
                  this.showEnclosure
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }"
              >
                ${this.showEnclosure ? '✓ Glass Chamber' : 'Free Field'}
              </button>
            </div>
          </div>

        </div>
        `
        }

      </div>
    `;

    this.attachEvents();
  }

  private attachEvents(): void {
    // Tab switching buttons
    this.element.querySelector('#tab-btn-library')?.addEventListener('click', () => {
      this.activeTab = 'library';
      this.render();
    });

    this.element.querySelector('#tab-btn-cymatics')?.addEventListener('click', () => {
      this.activeTab = 'cymatics';
      if (this.visualizer) {
        const curStyle = this.visualizer.getStyle();
        if (curStyle !== 'cymatics' && curStyle !== 'cymatics-2d') {
          this.visualizer.setStyle('cymatics');
        }
      }
      this.render();
    });

    // Track selection cards
    this.element.querySelectorAll('.btn-track-card').forEach(btn => {
      btn.addEventListener('click', async e => {
        const target = e.currentTarget as HTMLElement;
        const trackId = target.getAttribute('data-track');
        if (trackId) {
          await this.audioEngine.initialize();
          this.audioEngine.playDemoTrack(trackId);
          if (this.onTrackChange) this.onTrackChange(trackId);
        }
      });
    });

    // Custom track play/pause toggle & Mini player
    const playPauseBtns = this.element.querySelectorAll('#lib-btn-play-pause, #lib-mini-play-pause');
    playPauseBtns.forEach(btn => {
      btn.addEventListener('click', async () => {
        await this.audioEngine.initialize();
        this.audioEngine.togglePlayPause();
      });
    });

    // Quick track select dropdown in Cymatics tab
    const quickTrackSelect = this.element.querySelector('#lib-quick-track-select') as HTMLSelectElement;
    quickTrackSelect?.addEventListener('change', async () => {
      const trackId = quickTrackSelect.value;
      if (trackId) {
        await this.audioEngine.initialize();
        this.audioEngine.playDemoTrack(trackId);
        if (this.onTrackChange) this.onTrackChange(trackId);
      }
    });

    // Custom track timeline scrubber
    const scrubber = this.element.querySelector('#lib-timeline-scrubber') as HTMLInputElement;
    if (scrubber) {
      scrubber.addEventListener('pointerdown', () => {
        this.isScrubbing = true;
      });
      scrubber.addEventListener('input', () => {
        this.isScrubbing = true;
        const val = parseFloat(scrubber.value);
        const dur = this.audioEngine.getDuration();
        const curLabel = this.element.querySelector('#lib-label-current-time');
        if (curLabel) curLabel.textContent = this.formatTime(val);
        const pct = dur > 0 ? (val / dur) * 100 : 0;
        scrubber.style.background = `linear-gradient(to right, #22d3ee ${pct}%, rgba(255, 255, 255, 0.12) ${pct}%)`;
      });
      scrubber.addEventListener('change', () => {
        const val = parseFloat(scrubber.value);
        this.audioEngine.seek(val);
        this.isScrubbing = false;
      });
      scrubber.addEventListener('pointerup', () => {
        this.isScrubbing = false;
      });
    }

    // File input
    const fileInput = this.element.querySelector('#lib-file-input') as HTMLInputElement;
    fileInput?.addEventListener('change', async e => {
      const target = e.target as HTMLInputElement;
      if (target.files && target.files[0]) {
        const file = target.files[0];
        await this.audioEngine.loadAudioFile(file);
      }
    });

    // Mic button
    this.element.querySelector('#lib-btn-mic')?.addEventListener('click', async () => {
      if (this.audioEngine.isMicrophoneActive()) {
        this.audioEngine.stopMicrophone();
        this.audioEngine.playDemoTrack();
      } else {
        await this.audioEngine.startMicrophone();
      }
    });

    // Quick Render Style Buttons
    this.element.querySelectorAll('.btn-quick-style').forEach(btn => {
      btn.addEventListener('click', e => {
        const target = e.currentTarget as HTMLElement;
        const style = target.getAttribute('data-quick-style') as VisualStyle;
        if (style && this.visualizer) {
          this.visualizer.setStyle(style);
          this.render();
        }
      });
    });

    // Multi-Select Cymatics Layer Toggles
    this.element.querySelectorAll('.btn-cym-layer').forEach(btn => {
      btn.addEventListener('click', e => {
        const target = e.currentTarget as HTMLElement;
        const layer = target.getAttribute('data-cym-layer') as 'plate' | 'droplet' | 'trap';
        if (layer && this.visualizer) {
          const curLayers = this.visualizer.getCymaticsLayers();
          const targetState = !curLayers[layer];
          const otherActive = Object.entries(curLayers).some(([k, v]) => k !== layer && v);
          if (!targetState && !otherActive) {
            return; // Maintain at least one active layer
          }
          this.visualizer.setCymaticsLayers({ [layer]: targetState });
          if (this.visualizer.getStyle() !== 'cymatics' && this.visualizer.getStyle() !== 'cymatics-2d') {
            this.visualizer.setStyle('cymatics');
          }
          this.render();
        }
      });
    });

    // Chamber Geometry Buttons
    this.element.querySelectorAll('.btn-cym-geom').forEach(btn => {
      btn.addEventListener('click', e => {
        const target = e.currentTarget as HTMLElement;
        const geom = target.getAttribute('data-geom') as ChamberType;
        if (geom) {
          this.chamberGeometry = geom;
          this.applyCymaticsToVisualizer();
          this.render();
        }
      });
    });

    // 1-Click Wave Shape Presets
    this.element.querySelectorAll('.btn-cym-preset').forEach(btn => {
      btn.addEventListener('click', e => {
        const target = e.currentTarget as HTMLElement;
        const presetId = target.getAttribute('data-preset-id');
        const preset = MusicLibraryCard.PRESETS.find(p => p.id === presetId);
        if (preset) {
          this.modalN = preset.n;
          this.modalM = preset.m;
          this.modalL = preset.l;
          this.chamberGeometry = preset.geometry;
          this.syncToMusic = false; // Locking preset shape
          this.applyCymaticsToVisualizer();
          if (this.visualizer && this.visualizer.getStyle() !== 'cymatics' && this.visualizer.getStyle() !== 'cymatics-2d') {
            this.visualizer.setStyle('cymatics');
          }
          this.render();
        }
      });
    });

    // Modal Sliders (n, m, l)
    const sliderN = this.element.querySelector('#cym-slider-n') as HTMLInputElement;
    sliderN?.addEventListener('input', () => {
      this.modalN = parseInt(sliderN.value, 10);
      this.syncToMusic = false;
      this.applyCymaticsToVisualizer();
      this.render();
    });

    const sliderM = this.element.querySelector('#cym-slider-m') as HTMLInputElement;
    sliderM?.addEventListener('input', () => {
      this.modalM = parseInt(sliderM.value, 10);
      this.syncToMusic = false;
      this.applyCymaticsToVisualizer();
      this.render();
    });

    const sliderL = this.element.querySelector('#cym-slider-l') as HTMLInputElement;
    sliderL?.addEventListener('input', () => {
      this.modalL = parseInt(sliderL.value, 10);
      this.syncToMusic = false;
      this.applyCymaticsToVisualizer();
      this.render();
    });

    // Step buttons (+ / -)
    this.element.querySelectorAll('.btn-step').forEach(btn => {
      btn.addEventListener('click', e => {
        const target = e.currentTarget as HTMLElement;
        const stepN = target.getAttribute('data-step-n');
        const stepM = target.getAttribute('data-step-m');
        const stepL = target.getAttribute('data-step-l');

        if (stepN) {
          this.modalN = Math.max(1, Math.min(8, this.modalN + parseInt(stepN, 10)));
        }
        if (stepM) {
          this.modalM = Math.max(1, Math.min(8, this.modalM + parseInt(stepM, 10)));
        }
        if (stepL) {
          this.modalL = Math.max(1, Math.min(6, this.modalL + parseInt(stepL, 10)));
        }
        this.syncToMusic = false;
        this.applyCymaticsToVisualizer();
        this.render();
      });
    });

    // Sync to Music harmonics toggle
    this.element.querySelector('#btn-cym-sync-music')?.addEventListener('click', () => {
      this.syncToMusic = !this.syncToMusic;
      this.applyCymaticsToVisualizer();
      this.render();
    });

    // Trapping mode (nodes vs antinodes)
    this.element.querySelector('#btn-cym-trapping')?.addEventListener('click', () => {
      this.trappingMode = this.trappingMode === 'normal' ? 'inverse' : 'normal';
      if (this.visualizer) {
        this.visualizer.gpuAcousticParticles.setChladniMode(this.trappingMode);
      }
      this.render();
    });

    // Boundary Enclosure toggle
    this.element.querySelector('#btn-cym-enclosure')?.addEventListener('click', () => {
      this.showEnclosure = !this.showEnclosure;
      if (this.visualizer) {
        this.visualizer.chamberEnclosure.setVisible(this.showEnclosure);
      }
      this.render();
    });
  }

  private applyCymaticsToVisualizer(): void {
    if (!this.visualizer) return;

    // Apply to 2D Plate Mesh
    this.visualizer.cymaticsPlateMesh.setModes(this.modalN, this.modalM, this.modalL);
    this.visualizer.cymaticsPlateMesh.setChamberType(this.chamberGeometry === 'cube' ? 'square' : 'circle');
    this.visualizer.cymaticsPlateMesh.setAutoModal(this.syncToMusic);

    // Apply to 3D Droplet Mesh
    this.visualizer.cymaticsMesh.setModes(this.modalN, this.modalM, this.modalL);
    this.visualizer.cymaticsMesh.setChamberType(this.chamberGeometry);
    this.visualizer.cymaticsMesh.setAutoModal(this.syncToMusic);

    // Apply to 3D Volumetric Field & Particle Trap
    this.visualizer.volumetricChladni.setModes(this.modalN, this.modalM, this.modalL);
    this.visualizer.volumetricChladni.setChamberType(this.chamberGeometry === 'cube' ? 0 : this.chamberGeometry === 'cylinder' ? 1 : 2);
    this.visualizer.gpuAcousticParticles.setModalNumbers(this.modalN, this.modalM, this.modalL);
    this.visualizer.gpuAcousticParticles.setChamberGeometry(this.chamberGeometry);
    this.visualizer.gpuAcousticParticles.setChladniMode(this.trappingMode);

    this.visualizer.chamberEnclosure.setChamberType(this.chamberGeometry);

    window.dispatchEvent(
      new CustomEvent('modal-state-changed', {
        detail: {
          n: this.modalN,
          m: this.modalM,
          l: this.modalL,
          geometry: this.chamberGeometry,
          audioCoupled: this.syncToMusic,
        },
      })
    );
  }
}
