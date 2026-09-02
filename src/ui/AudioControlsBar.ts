/**
 * AudioControlsBar.ts
 * SoundForm 3D — Universal Master Transport & Telemetry Dock
 *
 * Dedicated to essential global playback, real-time timeline scrubbing, and audio telemetry.
 * Avoids duplicating granular sound/frequency controls that reside in dedicated sidebar decks.
 *
 * Core Dock Architecture:
 * 1. Global Master Transport: 1-Click Play/Stop audio engine state with energetic cyan phosphor bloom.
 * 2. Interactive Audio Timeline Scrubber: Real-time seekable progress bar with elapsed/duration time codes and lag-free dragging.
 * 3. Live Audio Telemetry: Real-time active status, pitch (Note/Hz), acoustic wavelength λ, and clean non-wrapping metadata badges.
 * 4. Master Utilities: 1-Click Snapshot capture and Dossier Export.
 * 5. Master Output: Master volume slider with filled active gradient and mute toggle.
 */

import { AudioEngine } from '../audio/AudioEngine';
import { DemoAudioGenerator } from '../audio/DemoAudioGenerator';
import { WavePhysics, NoteInfo } from '../math/WavePhysics';
import { WaveformType } from '../audio/FrequencySynthesizer';
import { EngineMode } from './Header';

export class AudioControlsBar {
  public static readonly SPEED_PRESETS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

  private element: HTMLElement;
  private currentEngineMode: EngineMode = 'music';
  private hasInitGlobalListeners = false;
  private unsubscribe?: () => void;
  private animFrameId: number | null = null;
  private isScrubbing = false;
  private isSpeedMenuOpen = false;
  private resizeObserver: ResizeObserver | null = null;

  // Real-time telemetry state
  private currentFreq = 432;
  private currentWaveform: WaveformType = 'sine';

  // State cache for intelligent in-place DOM updates
  private lastRenderState: {
    mode: string;
    isPlaying: boolean;
    isMuted: boolean;
    playbackSpeed: number;
    activeTrackId: string;
    loadedFileName: string | null;
    streamingTrackId?: string;
    isMicActive: boolean;
  } | null = null;

  constructor(
    private audioEngine: AudioEngine,
    private onScreenshot?: () => void,
    private onExport?: () => void
  ) {
    this.element = typeof document !== 'undefined' ? document.createElement('div') : ({} as HTMLElement);
    this.element.className = 'w-full flex justify-center items-center select-none';
    this.preventEventBleeding();

    if (typeof window !== 'undefined') {
      this.initGlobalListeners();
    }

    this.unsubscribe = this.audioEngine.subscribe(() => {
      this.onAudioEngineUpdate();
    });
  }

  private preventEventBleeding(): void {
    this.element.addEventListener('wheel', e => e.stopPropagation(), { passive: false });
  }

  public destroy(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = undefined;
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    this.dispose();
  }

  private onPointerDownGlobal = (e: PointerEvent): void => {
    if (this.isSpeedMenuOpen) {
      const speedWrapper = this.element.querySelector('#dock-speed-wrapper');
      if (speedWrapper && !speedWrapper.contains(e.target as Node)) {
        this.isSpeedMenuOpen = false;
        this.render();
      }
    }
  };

  private onKeyDownGlobal = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && this.isSpeedMenuOpen) {
      this.isSpeedMenuOpen = false;
      this.render();
    }
  };

  private initGlobalListeners(): void {
    if (this.hasInitGlobalListeners) return;
    this.hasInitGlobalListeners = true;

    window.addEventListener('pointerdown', this.onPointerDownGlobal);
    window.addEventListener('keydown', this.onKeyDownGlobal);

    window.addEventListener('frequency-changed', ((e: CustomEvent<{ frequency: number }>) => {
      if (e.detail?.frequency && e.detail.frequency !== this.currentFreq) {
        this.currentFreq = e.detail.frequency;
        this.updateFrequencyTelemetry();
      }
    }) as EventListener);

    window.addEventListener('waveform-changed', ((e: CustomEvent<{ waveform: WaveformType }>) => {
      if (e.detail?.waveform && e.detail.waveform !== this.currentWaveform) {
        this.currentWaveform = e.detail.waveform;
      }
    }) as EventListener);
  }

  public dispose(): void {
    if (this.hasInitGlobalListeners) {
      this.hasInitGlobalListeners = false;
      if (typeof window !== 'undefined') {
        window.removeEventListener('pointerdown', this.onPointerDownGlobal);
        window.removeEventListener('keydown', this.onKeyDownGlobal);
      }
    }
  }

  public getElement(): HTMLElement {
    this.render();
    return this.element;
  }

  public setMode(mode: EngineMode): void {
    const normalized = mode === 'cymatics' ? 'music' : mode === 'modal' ? 'frequency' : mode;
    if (this.currentEngineMode === normalized) return;
    this.currentEngineMode = normalized;
    this.render();
  }

  public getEngineMode(): EngineMode {
    return this.currentEngineMode;
  }

  public setFrequency(freq: number): void {
    this.currentFreq = Math.max(20, Math.min(20000, Math.round(freq)));
    if (this.audioEngine.synthesizer?.getIsPlaying()) {
      this.audioEngine.synthesizer.setFrequency(this.currentFreq);
    }
    this.updateFrequencyTelemetry();
  }

  public getFrequency(): number {
    return this.currentFreq;
  }

  public setWaveform(wf: WaveformType): void {
    this.currentWaveform = wf;
    this.audioEngine.synthesizer?.setWaveform(wf);
  }

  public getWaveform(): WaveformType {
    return this.currentWaveform;
  }

  private formatTime(secs: number): string {
    if (isNaN(secs) || !isFinite(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  /**
   * Smart subscription listener:
   * Rebuilds DOM only when discrete application state changes.
   * Updates timeline & volume in-place during audio playback to avoid layout thrashing and preserve user drag.
   */
  private onAudioEngineUpdate(): void {
    const isPlaying = this.audioEngine.getIsPlaying();
    const isMuted = this.audioEngine.getIsMuted();
    const speed = this.audioEngine.getPlaybackSpeed();
    const activeTrackId = this.audioEngine.getActiveTrackId();
    const loadedFileName = this.audioEngine.getLoadedFileName();
    const streamingTrack = this.audioEngine.getActiveStreamingTrack();
    const isMicActive = this.audioEngine.isMicrophoneActive();
    const mode = this.currentEngineMode;

    const needsFullRender =
      !this.lastRenderState ||
      this.lastRenderState.mode !== mode ||
      this.lastRenderState.isPlaying !== isPlaying ||
      this.lastRenderState.isMuted !== isMuted ||
      this.lastRenderState.playbackSpeed !== speed ||
      this.lastRenderState.activeTrackId !== activeTrackId ||
      this.lastRenderState.loadedFileName !== loadedFileName ||
      this.lastRenderState.streamingTrackId !== streamingTrack?.id ||
      this.lastRenderState.isMicActive !== isMicActive;

    if (needsFullRender) {
      this.render();
    } else {
      this.updateTimelineOnly();
    }
  }

  /**
   * High-performance in-place update for timeline scrubber & duration labels.
   */
  private updateTimelineOnly(): void {
    if (this.isScrubbing || this.currentEngineMode !== 'music') return;

    const scrubber = this.element.querySelector('#dock-timeline-scrubber') as HTMLInputElement;
    const curTimeEl = this.element.querySelector('#dock-label-current-time');
    const durEl = this.element.querySelector('#dock-label-duration');

    const currentTime = this.audioEngine.getCurrentTime();
    const duration = this.audioEngine.getDuration();
    const progressPct = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

    if (scrubber) {
      scrubber.max = duration > 0 ? duration.toString() : '100';
      scrubber.value = currentTime.toString();
      scrubber.style.background = `linear-gradient(to right, #22d3ee ${progressPct}%, rgba(255, 255, 255, 0.12) ${progressPct}%)`;
    }

    if (curTimeEl) {
      curTimeEl.textContent = this.formatTime(currentTime);
    }

    if (durEl) {
      durEl.textContent = duration > 0 ? this.formatTime(duration) : (this.audioEngine.getIsPlaying() && !this.audioEngine.getLoadedFileName() ? '∞' : '--:--');
    }
  }

  public render(): void {
    if (!this.element || typeof this.element.querySelector !== 'function') return;

    const isPlaying = this.audioEngine.getIsPlaying();
    const isMuted = this.audioEngine.getIsMuted();
    const speed = this.audioEngine.getPlaybackSpeed();
    const volume = this.audioEngine.getMasterVolume();
    const loadedFileName = this.audioEngine.getLoadedFileName();
    const streamingTrack = this.audioEngine.getActiveStreamingTrack();
    const isMicActive = this.audioEngine.isMicrophoneActive();
    const currentTrackId = this.audioEngine.getActiveTrackId();
    const currentTrack = DemoAudioGenerator.TRACKS.find(t => t.id === currentTrackId);
    const currentTime = this.audioEngine.getCurrentTime();
    const duration = this.audioEngine.getDuration();
    const progressPct = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

    // Cache state to avoid unnecessary innerHTML rewrites
    this.lastRenderState = {
      mode: this.currentEngineMode,
      isPlaying,
      isMuted,
      playbackSpeed: speed,
      activeTrackId: currentTrackId,
      loadedFileName,
      streamingTrackId: streamingTrack?.id,
      isMicActive,
    };

    let statusPillHtml = '';
    let centerContentHtml = '';

    if (this.currentEngineMode === 'music') {
      let trackTitle = 'Cosmic Odyssey';
      let trackBadge = '• Cosmic';
      let badgeColor = 'text-cyan-300';
      let dotColor = isMicActive ? 'bg-rose-400 animate-ping' : isPlaying ? 'bg-cyan-400 animate-pulse' : 'bg-slate-600';

      if (streamingTrack) {
        trackTitle = `${streamingTrack.title} — ${streamingTrack.artist}`;
        if (streamingTrack.source === 'apple-music') {
          trackBadge = '• Apple Music';
          badgeColor = 'text-rose-300';
          dotColor = isPlaying ? 'bg-rose-400 animate-pulse' : 'bg-slate-600';
        } else {
          trackBadge = '• Spotify';
          badgeColor = 'text-emerald-300';
          dotColor = isPlaying ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600';
        }
      } else if (loadedFileName) {
        trackTitle = loadedFileName;
        const ext = loadedFileName.includes('.') ? loadedFileName.split('.').pop()?.toUpperCase() : '';
        trackBadge = ext ? `• ${ext} File` : '• Audio File';
      } else if (isMicActive) {
        trackTitle = 'Live Microphone';
        trackBadge = '• Live Input';
      } else if (currentTrack) {
        trackTitle = currentTrack.name;
        trackBadge = `• ${currentTrack.genre}`;
      }

      statusPillHtml = `
        <div class="flex items-center gap-2 px-2.5 sm:px-3 py-1 bg-slate-900/90 rounded-xl border border-white/10 min-w-0 shadow-inner max-w-[170px] xs:max-w-[200px] sm:max-w-[240px] md:max-w-[270px] lg:max-w-[300px] shrink-1" data-tooltip="${trackTitle} ${trackBadge}">
          <span class="w-2 h-2 rounded-full ${dotColor} shrink-0"></span>
          <div class="flex flex-col min-w-0 justify-center">
            <div class="marquee-container min-w-0 font-medium overflow-hidden" data-marquee>
              <div class="marquee-content whitespace-nowrap">
                <span class="text-xs font-bold ${badgeColor} shrink-0">
                  ${trackTitle}
                </span>
              </div>
            </div>
            <span class="text-[9px] font-mono text-slate-400 whitespace-nowrap truncate shrink-0">
              ${trackBadge}
            </span>
          </div>
        </div>
      `;

      // Master Audio Timeline Scrubber
      centerContentHtml = `
        <div id="dock-timeline-container" class="flex-1 min-w-[140px] sm:min-w-[200px] md:min-w-[280px] max-w-2xl flex items-center gap-2 sm:gap-3 px-1 sm:px-3">
          <span id="dock-label-current-time" class="text-[11px] sm:text-xs font-mono text-cyan-300 tabular-nums shrink-0 select-none font-semibold min-w-[28px] sm:min-w-[32px] text-right">${this.formatTime(currentTime)}</span>
          <div class="flex-1 relative flex items-center min-w-0 group py-1">
            <input
              type="range"
              id="dock-timeline-scrubber"
              min="0"
              max="${duration > 0 ? duration : 100}"
              step="0.1"
              value="${currentTime}"
              ${duration <= 0 && !loadedFileName ? 'disabled' : ''}
              aria-label="Master audio timeline scrubber"
              data-tooltip="${duration > 0 ? `Seek: ${this.formatTime(currentTime)} / ${this.formatTime(duration)}` : 'Audio Timeline'}"
              class="w-full h-1.5 sm:h-2 rounded-full cursor-pointer appearance-none bg-white/10 slider-cyan transition-all group-hover:h-2.5"
              style="background: linear-gradient(to right, #22d3ee ${progressPct}%, rgba(255, 255, 255, 0.12) ${progressPct}%);"
            />
          </div>
          <span id="dock-label-duration" class="text-[11px] sm:text-xs font-mono text-slate-400 tabular-nums shrink-0 select-none min-w-[28px] sm:min-w-[32px]">${duration > 0 ? this.formatTime(duration) : isPlaying && !loadedFileName ? '∞' : '--:--'}</span>
        </div>
      `;
    } else if (this.currentEngineMode === 'frequency') {
      const noteInfo: NoteInfo = WavePhysics.frequencyToNote(this.currentFreq);
      const lambdaM = 343 / Math.max(1, this.currentFreq);
      const lambdaStr = lambdaM >= 1 ? `${lambdaM.toFixed(2)}m` : `${(lambdaM * 100).toFixed(1)}cm`;

      statusPillHtml = `
        <div class="flex items-center gap-2 px-2.5 sm:px-3 py-1 bg-slate-900/90 rounded-xl border border-white/10 min-w-0 font-mono shadow-inner max-w-[170px] xs:max-w-[200px] sm:max-w-[240px] md:max-w-[270px] lg:max-w-[300px] shrink-1" data-tooltip="Resonance Tone: ${this.currentFreq} Hz (${noteInfo.name})">
          <span class="w-2 h-2 rounded-full ${isPlaying ? 'bg-cyan-400 animate-pulse' : 'bg-slate-600'} shrink-0"></span>
          <div class="flex flex-col min-w-0 justify-center">
            <div class="marquee-container min-w-0 overflow-hidden" data-marquee>
              <div class="marquee-content flex items-center gap-1.5 whitespace-nowrap">
                <span id="dock-freq-val" class="text-xs sm:text-sm font-bold text-cyan-400 tabular-nums shrink-0">${this.currentFreq} Hz</span>
                <span id="dock-freq-note" class="text-[10px] font-bold text-blue-300 bg-blue-500/20 px-1.5 py-0.5 rounded border border-blue-500/30 shrink-0">${noteInfo.name}</span>
              </div>
            </div>
            <span id="dock-freq-lambda" class="text-[9px] text-slate-400 tabular-nums whitespace-nowrap truncate shrink-0">λ: ${lambdaStr}</span>
          </div>
        </div>
      `;

      centerContentHtml = `
        <div class="flex-1 flex items-center justify-center min-w-0 px-2">
          <span class="text-[11px] font-mono text-cyan-400/80 bg-cyan-950/40 border border-cyan-500/20 px-3 py-1 rounded-full whitespace-nowrap truncate">
            Resonance Pure Tone Generator • ${this.currentFreq} Hz
          </span>
        </div>
      `;
    } else if (this.currentEngineMode === 'therapy') {
      statusPillHtml = `
        <div class="flex items-center gap-2 px-2.5 sm:px-3 py-1 bg-slate-900/90 rounded-xl border border-white/10 min-w-0 text-xs shadow-inner max-w-[170px] xs:max-w-[200px] sm:max-w-[240px] md:max-w-[270px] lg:max-w-[300px] shrink-1" data-tooltip="Ablation Beam: 500 kHz • 1.0 MPa • Anti-Phase">
          <span class="w-2 h-2 rounded-full ${isPlaying ? 'bg-rose-400 animate-pulse' : 'bg-slate-600'} shrink-0"></span>
          <div class="flex flex-col min-w-0 justify-center">
            <div class="marquee-container min-w-0 overflow-hidden" data-marquee>
              <div class="marquee-content whitespace-nowrap">
                <span class="font-bold text-rose-300 shrink-0">Ablation Beam: 500 kHz</span>
              </div>
            </div>
            <span class="text-[9px] font-mono text-slate-400 whitespace-nowrap truncate shrink-0">1.0 MPa • Anti-Phase</span>
          </div>
        </div>
      `;
      centerContentHtml = `
        <div class="flex-1 flex items-center justify-center min-w-0 px-2">
          <span class="text-[11px] font-mono text-rose-400/80 bg-rose-950/40 border border-rose-500/20 px-3 py-1 rounded-full whitespace-nowrap truncate">
            Targeted Oncotripsy Acoustic Field
          </span>
        </div>
      `;
    } else if (this.currentEngineMode === 'nobel') {
      statusPillHtml = `
        <div class="flex items-center gap-2 px-2.5 sm:px-3 py-1 bg-slate-900/90 rounded-xl border border-white/10 min-w-0 text-xs shadow-inner max-w-[170px] xs:max-w-[200px] sm:max-w-[240px] md:max-w-[270px] lg:max-w-[300px] shrink-1" data-tooltip="Disruption Pulse: 432 Hz • Mechanogenomics">
          <span class="w-2 h-2 rounded-full ${isPlaying ? 'bg-purple-400 animate-pulse' : 'bg-slate-600'} shrink-0"></span>
          <div class="flex flex-col min-w-0 justify-center">
            <div class="marquee-container min-w-0 overflow-hidden" data-marquee>
              <div class="marquee-content whitespace-nowrap">
                <span class="font-bold text-purple-300 shrink-0">Disruption Pulse: 432 Hz</span>
              </div>
            </div>
            <span class="text-[9px] font-mono text-slate-400 whitespace-nowrap truncate shrink-0">Mechanogenomics</span>
          </div>
        </div>
      `;
      centerContentHtml = `
        <div class="flex-1 flex items-center justify-center min-w-0 px-2">
          <span class="text-[11px] font-mono text-purple-400/80 bg-purple-950/40 border border-purple-500/20 px-3 py-1 rounded-full whitespace-nowrap truncate">
            Nobel Frontier Acoustic Stimulation
          </span>
        </div>
      `;
    } else if (this.currentEngineMode === 'bio') {
      statusPillHtml = `
        <div class="flex items-center gap-2 px-2.5 sm:px-3 py-1 bg-slate-900/90 rounded-xl border border-white/10 min-w-0 text-xs shadow-inner max-w-[170px] xs:max-w-[200px] sm:max-w-[240px] md:max-w-[270px] lg:max-w-[300px] shrink-1" data-tooltip="Acoustic Drive: 220 Hz • 42.8 µm/s">
          <span class="w-2 h-2 rounded-full ${isPlaying ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'} shrink-0"></span>
          <div class="flex flex-col min-w-0 justify-center">
            <div class="marquee-container min-w-0 overflow-hidden" data-marquee>
              <div class="marquee-content whitespace-nowrap">
                <span class="font-bold text-emerald-300 shrink-0">Acoustic Drive: 220 Hz</span>
              </div>
            </div>
            <span class="text-[9px] font-mono text-slate-400 whitespace-nowrap truncate shrink-0">42.8 µm/s</span>
          </div>
        </div>
      `;
      centerContentHtml = `
        <div class="flex-1 flex items-center justify-center min-w-0 px-2">
          <span class="text-[11px] font-mono text-emerald-400/80 bg-emerald-950/40 border border-emerald-500/20 px-3 py-1 rounded-full whitespace-nowrap truncate">
            Microfluidic Standing Wave Sorter
          </span>
        </div>
      `;
    } else if (this.currentEngineMode === 'voice') {
      statusPillHtml = `
        <div class="flex items-center gap-2 px-2.5 sm:px-3 py-1 bg-slate-900/90 rounded-xl border border-white/10 min-w-0 text-xs font-mono shadow-inner max-w-[170px] xs:max-w-[200px] sm:max-w-[240px] md:max-w-[270px] lg:max-w-[300px] shrink-1" data-tooltip="Vocal Pitch f₀: 220 Hz • Stability 98.4%">
          <span class="w-2 h-2 rounded-full ${isPlaying ? 'bg-teal-400 animate-pulse' : 'bg-slate-600'} shrink-0"></span>
          <div class="flex flex-col min-w-0 justify-center">
            <div class="marquee-container min-w-0 overflow-hidden" data-marquee>
              <div class="marquee-content whitespace-nowrap">
                <span class="font-bold text-teal-300 whitespace-nowrap shrink-0">Vocal Pitch f₀: 220 Hz</span>
              </div>
            </div>
            <span class="text-[9px] text-slate-400 whitespace-nowrap truncate shrink-0">Stability 98.4%</span>
          </div>
        </div>
      `;
      centerContentHtml = `
        <div class="flex-1 flex items-center justify-center min-w-0 px-2">
          <span class="text-[11px] font-mono text-teal-400/80 bg-teal-950/40 border border-teal-500/20 px-3 py-1 rounded-full whitespace-nowrap truncate">
            Voice Biometric Clinical Telemetry
          </span>
        </div>
      `;
    }

    this.element.innerHTML = `
      <div class="glass-panel px-3 sm:px-4 py-2 rounded-2xl flex items-center justify-between gap-2 sm:gap-3.5 shadow-2xl border border-white/10 max-w-5xl w-full mx-auto backdrop-blur-2xl transition-all duration-300">
        
        <!-- Left: Master Play/Pause Hero Button & Live Status Telemetry Pill -->
        <div class="flex items-center gap-2 sm:gap-2.5 min-w-0 shrink-1">
          <button
            id="btn-play-pause"
            aria-label="${isPlaying ? 'Pause Master Audio' : 'Play Master Audio'}"
            data-tooltip="${isPlaying ? 'Pause Master Audio' : 'Play Master Audio'}"
            class="w-9 h-9 rounded-xl ${
              isPlaying
                ? 'bg-cyan-400 text-slate-950 font-bold hover:bg-cyan-300 shadow-lg shadow-cyan-400/40 ring-2 ring-cyan-300/60'
                : 'bg-slate-900 text-white border border-slate-700 hover:bg-slate-800'
            } flex items-center justify-center transition-all active:scale-95 shrink-0 cursor-pointer shadow-sm"
          >
            ${
              isPlaying
                ? `<svg class="w-4 h-4 fill-current" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>`
                : `<svg class="w-4 h-4 fill-current ml-0.5" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>`
            }
          </button>

          ${statusPillHtml}
        </div>

        <!-- Center: Interactive Audio Timeline Scrubber or Mode Telemetry -->
        ${centerContentHtml}

        <!-- Right: Global Utilities (Speed, Snapshot, Export) & Master Volume -->
        <div class="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <!-- Sound Playback Speed Selector -->
          <div class="relative shrink-0" id="dock-speed-wrapper">
            <button
              id="btn-speed"
              type="button"
              aria-haspopup="true"
              aria-expanded="${this.isSpeedMenuOpen}"
              aria-label="Sound Playback Speed: ${speed}x"
              data-tooltip="Sound Speed: ${speed}×"
              class="p-1.5 sm:p-2 rounded-xl ${
                speed !== 1.0
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/50 shadow-sm shadow-cyan-500/20 ring-1 ring-cyan-400/30'
                  : 'bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border-white/5 hover:border-white/15'
              } border cursor-pointer transition-all active:scale-95 flex items-center gap-1 text-xs font-semibold shrink-0"
            >
              <svg class="w-3.5 h-3.5 ${speed !== 1.0 ? 'text-cyan-300' : 'text-gray-400'}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="m12 14 4-4"/>
                <path d="M3.34 19a10 10 0 1 1 17.32 0"/>
              </svg>
              <span id="dock-speed-label" class="font-mono text-[11px] sm:text-xs font-bold tabular-nums">${speed}×</span>
            </button>

            ${
              this.isSpeedMenuOpen
                ? `
              <div
                id="dock-speed-menu"
                class="absolute bottom-full mb-2 right-0 glass-panel border border-white/15 rounded-xl p-1.5 shadow-2xl backdrop-blur-2xl flex flex-col gap-1 z-50 min-w-[125px] bg-slate-900/95 text-xs animate-in fade-in zoom-in-95 duration-150"
                role="menu"
                aria-label="Select Sound Speed"
              >
                <div class="px-2 py-1 text-[10px] font-mono text-slate-400 border-b border-white/10 uppercase tracking-wider">
                  Sound Speed
                </div>
                ${AudioControlsBar.SPEED_PRESETS.map(
                  preset => `
                  <button
                    type="button"
                    data-speed="${preset}"
                    class="speed-option-btn flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-mono transition-colors cursor-pointer ${
                      Math.abs(speed - preset) < 0.001
                        ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30'
                        : 'text-gray-300 hover:text-white hover:bg-white/10 border border-transparent'
                    }"
                    role="menuitem"
                  >
                    <span>${preset}×${preset === 1.0 ? ' <span class="text-[10px] text-slate-400 font-sans font-normal">(Normal)</span>' : ''}</span>
                    ${Math.abs(speed - preset) < 0.001 ? '<svg class="w-3.5 h-3.5 text-cyan-400 ml-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
                  </button>
                `
                ).join('')}
              </div>
            `
                : ''
            }
          </div>

          <!-- Screenshot Snapshot Button -->
          <button
            id="btn-screenshot"
            class="btn-screenshot p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/5 hover:border-white/15 cursor-pointer transition-all active:scale-95 flex items-center gap-1.5 text-xs font-medium shrink-0"
            aria-label="Capture Screenshot (PNG)"
            data-tooltip="Capture Screenshot (PNG)"
          >
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
            <span class="hidden 2xl:inline text-[11px]">Snapshot</span>
          </button>

          <!-- Export Dossier Button -->
          <button
            id="btn-export-dossier"
            class="p-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 hover:text-cyan-200 border border-cyan-500/30 hover:border-cyan-400/50 cursor-pointer transition-all active:scale-95 flex items-center gap-1.5 text-xs font-medium shrink-0"
            aria-label="Export Simulation Report & Data"
            data-tooltip="Export Simulation Report & Data"
          >
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            <span class="hidden 2xl:inline text-[11px]">Export</span>
          </button>

          <div class="w-px h-5 bg-white/10 mx-0.5 hidden sm:block shrink-0"></div>

          <!-- Master Volume Section -->
          ${this.renderVolumeSection(isPlaying, isMuted, volume)}
        </div>

      </div>
    `;

    this.attachEvents();
    this.setupMarquee();
  }

  private renderVolumeSection(isPlaying: boolean, isMuted: boolean, volume: number): string {
    const volPct = isMuted ? 0 : Math.round(volume * 100);

    return `
      <div class="flex items-center gap-1 sm:gap-1.5 pl-0.5 sm:pl-1 shrink-0">
        <button
          id="btn-volume-mute"
          class="text-gray-400 hover:text-cyan-400 transition-colors p-1 cursor-pointer rounded-lg hover:bg-white/5 shrink-0"
          aria-label="${isMuted ? 'Unmute master audio' : 'Mute master audio'}"
          data-tooltip="${isMuted ? 'Unmute' : 'Mute'}"
        >
          ${
            isMuted || volume === 0
              ? `<svg class="w-4 h-4 text-rose-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>`
              : volume < 0.5
              ? `<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`
              : `<svg class="w-4 h-4 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`
          }
        </button>
        <div class="relative flex items-center w-14 sm:w-18 md:w-22 px-1">
          <input
            type="range"
            id="volume-slider"
            min="0"
            max="1"
            step="0.01"
            value="${isMuted ? 0 : volume}"
            aria-label="Master volume level slider"
            data-tooltip="Volume: ${isMuted ? 'Muted' : `${volPct}%`}"
            style="background: linear-gradient(to right, #38bdf8 ${volPct}%, rgba(255, 255, 255, 0.1) ${volPct}%);"
            class="w-full min-w-0 cursor-pointer slider-cyan"
          />
        </div>
      </div>
    `;
  }

  private attachEvents(): void {
    // Master Play/Pause Button
    this.element.querySelector('#btn-play-pause')?.addEventListener('click', async () => {
      await this.audioEngine.initialize();
      if (this.currentEngineMode === 'frequency') {
        const synth = this.audioEngine.synthesizer;
        if (synth && synth.getIsPlaying()) {
          this.audioEngine.stopFrequency();
        } else {
          this.audioEngine.playFrequency(this.currentFreq);
        }
      } else {
        this.audioEngine.togglePlayPause();
      }
      this.render();
    });

    // Sound Speed Button & Popover Selection Handlers
    const speedBtn = this.element.querySelector('#btn-speed');
    speedBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.isSpeedMenuOpen = !this.isSpeedMenuOpen;
      this.render();
    });

    const speedOptionBtns = this.element.querySelectorAll<HTMLButtonElement>('.speed-option-btn');
    speedOptionBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const speedVal = parseFloat(btn.getAttribute('data-speed') || '1.0');
        this.audioEngine.setPlaybackSpeed(speedVal);
        this.isSpeedMenuOpen = false;
        this.render();
      });
    });

    // Timeline Scrubber Handlers (Zero-Lag Real-Time Seeking)
    const scrubber = this.element.querySelector('#dock-timeline-scrubber') as HTMLInputElement;
    if (scrubber) {
      scrubber.addEventListener('input', () => {
        this.isScrubbing = true;
        const val = parseFloat(scrubber.value);
        const max = parseFloat(scrubber.max) || 100;
        const curLabel = this.element.querySelector('#dock-label-current-time');
        if (curLabel) {
          curLabel.textContent = this.formatTime(val);
        }
        const dur = parseFloat(scrubber.max) || 0;
        scrubber.setAttribute('data-tooltip', dur > 0 ? `Seek: ${this.formatTime(val)} / ${this.formatTime(dur)}` : 'Audio Timeline');
        const pct = max > 0 ? Math.min(100, Math.max(0, (val / max) * 100)) : 0;
        scrubber.style.background = `linear-gradient(to right, #22d3ee ${pct}%, rgba(255, 255, 255, 0.12) ${pct}%)`;
        this.audioEngine.seek(val);
      });

      const finishScrub = () => {
        if (!this.isScrubbing) return;
        const val = parseFloat(scrubber.value);
        this.audioEngine.seek(val);
        this.isScrubbing = false;
      };

      scrubber.addEventListener('change', finishScrub);
      scrubber.addEventListener('pointerup', finishScrub);
      scrubber.addEventListener('touchend', finishScrub);
    }

    // Screenshot Button
    this.element.querySelector('#btn-screenshot')?.addEventListener('click', () => {
      if (this.onScreenshot) this.onScreenshot();
    });

    // Export Button
    this.element.querySelector('#btn-export-dossier')?.addEventListener('click', () => {
      if (this.onExport) this.onExport();
    });

    // Volume Slider & Mute
    const volSlider = this.element.querySelector('#volume-slider') as HTMLInputElement;
    volSlider?.addEventListener('input', () => {
      const val = parseFloat(volSlider.value);
      this.audioEngine.setMasterVolume(val);
      if (this.audioEngine.getIsMuted() && val > 0) {
        this.audioEngine.toggleMute();
      }
      const volPct = Math.round(val * 100);
      volSlider.setAttribute('data-tooltip', `Volume: ${volPct}%`);
      volSlider.style.background = `linear-gradient(to right, #38bdf8 ${volPct}%, rgba(255, 255, 255, 0.1) ${volPct}%)`;
    });

    this.element.querySelector('#btn-volume-mute')?.addEventListener('click', () => {
      this.audioEngine.toggleMute();
      this.render();
    });
  }

  private updateFrequencyTelemetry(): void {
    if (this.currentEngineMode !== 'frequency') return;
    const freqEl = this.element.querySelector('#dock-freq-val');
    if (freqEl) freqEl.textContent = `${this.currentFreq} Hz`;

    const noteInfo = WavePhysics.frequencyToNote(this.currentFreq);
    const noteEl = this.element.querySelector('#dock-freq-note');
    if (noteEl) noteEl.textContent = noteInfo.name;

    const lambdaM = 343 / Math.max(1, this.currentFreq);
    const lambdaStr = lambdaM >= 1 ? `${lambdaM.toFixed(2)}m` : `${(lambdaM * 100).toFixed(1)}cm`;
    const lambdaEl = this.element.querySelector('#dock-freq-lambda');
    if (lambdaEl) lambdaEl.textContent = `λ: ${lambdaStr}`;
  }

  /**
   * Initializes dynamic resize observation and measurement for text overflow marquees.
   */
  private setupMarquee(): void {
    if (typeof window === 'undefined') return;

    const marqueeContainers = this.element.querySelectorAll<HTMLElement>('[data-marquee]');
    if (marqueeContainers.length === 0) return;

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    } else if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        this.updateMarquees();
      });
    }

    marqueeContainers.forEach(container => {
      this.resizeObserver?.observe(container);
    });

    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(() => {
        this.updateMarquees();
      });
    } else {
      this.updateMarquees();
    }
  }

  /**
   * Calculates exact pixel overflow and dynamically equips hardware-accelerated ping-pong marquee.
   */
  public updateMarquees(): void {
    if (!this.element || typeof this.element.querySelectorAll !== 'function') return;
    const marqueeContainers = this.element.querySelectorAll<HTMLElement>('[data-marquee]');
    marqueeContainers.forEach(container => {
      const content = container.querySelector<HTMLElement>('.marquee-content');
      if (!content) return;

      const containerWidth = container.clientWidth;
      const contentWidth = content.scrollWidth;
      const overflow = contentWidth - containerWidth;

      if (overflow > 4) {
        const distance = Math.ceil(overflow);
        const duration = Math.max(5, Math.round(4 + distance / 25));
        content.style.setProperty('--marquee-distance', `${distance}px`);
        content.style.setProperty('--marquee-duration', `${duration}s`);
        content.classList.add('is-scrolling');
        container.classList.add('has-overflow');
      } else {
        content.style.removeProperty('--marquee-distance');
        content.style.removeProperty('--marquee-duration');
        content.classList.remove('is-scrolling');
        container.classList.remove('has-overflow');
      }
    });
  }
}

