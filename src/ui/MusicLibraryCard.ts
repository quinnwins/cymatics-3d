/**
 * MusicLibraryCard.ts
 * SoundForm 3D - Left Sidebar Music Space & Acoustic Library Control Deck
 */

import { AudioEngine } from '../audio/AudioEngine';
import { DemoAudioGenerator } from '../audio/DemoAudioGenerator';

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

  constructor(
    private audioEngine: AudioEngine,
    onTrackChange?: (trackId: string) => void
  ) {
    this.element = document.createElement('div');
    this.element.className = 'w-full flex flex-col gap-2.5 select-none transition-all duration-300';
    this.onTrackChange = onTrackChange;
    this.preventEventBleeding();
    this.render();
    this.unsubscribe = this.audioEngine.subscribe(() => {
      this.update();
    });
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
      const playPauseBtn = this.element.querySelector('#lib-btn-play-pause');
      if (playPauseBtn) {
        playPauseBtn.innerHTML = curPlaying
          ? `<svg class="w-4 h-4 fill-current text-slate-950" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>`
          : `<svg class="w-4 h-4 fill-current text-slate-950 ml-0.5" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
      }
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

    this.lastTrackId = currentTrackId;
    this.lastMode = this.audioEngine.getMode();
    this.lastFileName = loadedFileName;
    this.lastMicActive = isMicActive;
    this.lastIsPlaying = isPlaying;

    this.element.innerHTML = `
      <div class="glass-panel p-3.5 sm:p-4 rounded-3xl flex flex-col gap-3 shadow-xl border border-white/10 text-white select-none">
        
        <!-- Header -->
        <div class="flex items-center justify-between border-b border-white/10 pb-2.5">
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-cyan-400 font-mono text-xs font-bold shrink-0 shadow-sm">
              AUDIO
            </div>
            <div>
              <h3 class="text-xs sm:text-sm font-bold text-white">Music Space</h3>
              <p class="text-[10px] text-gray-400">Select demo tracks or upload audio</p>
            </div>
          </div>
          <span class="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
            ${isMicActive ? 'MIC' : loadedFileName ? 'CUSTOM' : 'DEMO'}
          </span>
        </div>

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

      </div>
    `;

    this.attachEvents();
  }

  private attachEvents(): void {
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

    // Custom track play/pause toggle
    this.element.querySelector('#lib-btn-play-pause')?.addEventListener('click', async () => {
      await this.audioEngine.initialize();
      this.audioEngine.togglePlayPause();
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
  }
}
