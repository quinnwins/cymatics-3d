/**
 * MusicLibraryCard.ts
 * SoundForm 3D - Left Sidebar Music Space & Acoustic Library Control Deck
 */

import { AudioEngine } from '../audio/AudioEngine';
import { DemoAudioGenerator } from '../audio/DemoAudioGenerator';

export class MusicLibraryCard {
  private element: HTMLElement;
  private isMicActive = false;
  private loadedFileName: string | null = null;
  private onTrackChange?: (trackId: string) => void;

  constructor(
    private audioEngine: AudioEngine,
    onTrackChange?: (trackId: string) => void
  ) {
    this.element = document.createElement('div');
    this.element.className = 'w-full flex flex-col gap-2.5 select-none transition-all duration-300';
    this.onTrackChange = onTrackChange;
    this.preventEventBleeding();
    this.initDragDrop();
    this.render();
  }

  public getElement(): HTMLElement {
    this.render();
    return this.element;
  }

  private preventEventBleeding(): void {
    this.element.addEventListener('wheel', e => e.stopPropagation(), { passive: false });
    this.element.addEventListener('pointerdown', e => e.stopPropagation());
  }

  private initDragDrop(): void {
    window.addEventListener('dragover', e => e.preventDefault());
    window.addEventListener('drop', async e => {
      e.preventDefault();
      if (e.dataTransfer?.files && e.dataTransfer.files[0]) {
        const file = e.dataTransfer.files[0];
        if (file.type.startsWith('audio/')) {
          this.loadedFileName = file.name;
          this.isMicActive = false;
          await this.audioEngine.loadAudioFile(file);
          this.render();
        }
      }
    });
  }

  public render(): void {
    const tracks = DemoAudioGenerator.TRACKS;
    const currentTrackId = this.audioEngine.demoGenerator?.getActiveTrackId() || 'cosmic-odyssey';

    this.element.innerHTML = `
      <div class="glass-panel p-3.5 sm:p-4 rounded-3xl flex flex-col gap-3 shadow-2xl border border-white/10 backdrop-blur-2xl text-white select-none">
        
        <!-- Header -->
        <div class="flex items-center justify-between border-b border-white/10 pb-2.5">
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-xl bg-gradient-to-tr from-accent-cyan via-accent-blue to-accent-magenta flex items-center justify-center shadow-lg shadow-accent-cyan/25 shrink-0">
              🎵
            </div>
            <div>
              <h3 class="text-xs sm:text-sm font-bold text-white">Music Space</h3>
              <p class="text-[10px] text-gray-400">Harmonic Audio & Cymatic Soundscapes</p>
            </div>
          </div>
          <span class="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
            ${this.isMicActive ? 'MIC' : this.loadedFileName ? 'CUSTOM' : 'DEMO'}
          </span>
        </div>

        <!-- Track Playlist Selection Cards -->
        <div class="flex flex-col gap-1.5">
          <span class="text-[10px] font-semibold text-gray-300">Acoustic Soundscapes:</span>
          <div class="flex flex-col gap-1.5">
            ${tracks.map(t => {
              const isSelected = !this.isMicActive && !this.loadedFileName && t.id === currentTrackId;
              return `
                <button
                  data-track="${t.id}"
                  class="btn-track-card glass-panel p-2.5 rounded-2xl flex flex-col gap-0.5 text-left transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer ${
                    isSelected
                      ? 'glass-panel-accent border-accent-cyan/60 shadow-md shadow-accent-cyan/20 ring-1 ring-accent-cyan'
                      : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/20'
                  }"
                >
                  <div class="flex items-center justify-between w-full">
                    <span class="font-bold text-xs ${isSelected ? 'text-cyan-300' : 'text-gray-100'}">${t.name}</span>
                    <span class="text-[9px] font-mono px-1.5 py-0.5 rounded-md bg-white/10 text-gray-300 font-semibold">${t.bpm} BPM</span>
                  </div>
                  <span class="text-[10px] text-gray-400 line-clamp-1">${t.description}</span>
                </button>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Custom File Dropzone & Microphone Input -->
        <div class="flex flex-col gap-2 pt-2 border-t border-white/10">
          <span class="text-[10px] font-semibold text-gray-300">Live Audio & Custom Audio:</span>
          
          <!-- Dropzone / Upload -->
          <label class="glass-panel p-2.5 rounded-2xl border-dashed border-white/20 hover:border-cyan-400/60 bg-black/30 flex flex-col items-center justify-center gap-1 cursor-pointer transition-all hover:bg-black/50 group">
            <svg class="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            <div class="text-[10px] text-gray-300 text-center">
              <span class="font-semibold text-white group-hover:text-cyan-300">Upload or drop audio</span>
              <span class="text-[9px] text-gray-400 block">MP3, WAV, FLAC</span>
            </div>
            <input type="file" id="lib-file-input" accept="audio/*" class="hidden" />
          </label>

          <!-- Live Mic Toggle -->
          <button
            id="lib-btn-mic"
            class="w-full py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 border transition-all cursor-pointer ${
              this.isMicActive
                ? 'bg-gradient-to-r from-red-500 to-accent-magenta text-white shadow-lg shadow-red-500/30 animate-pulse border-red-400'
                : 'bg-white/5 border-white/10 text-gray-300 hover:text-white hover:bg-white/10'
            }"
          >
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/>
              <line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
            <span>${this.isMicActive ? '🔴 Live Microphone Streaming' : 'Enable Microphone Input'}</span>
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
          this.loadedFileName = null;
          this.isMicActive = false;
          this.audioEngine.playDemoTrack(trackId);
          if (this.onTrackChange) this.onTrackChange(trackId);
          this.render();
        }
      });
    });

    // File input
    const fileInput = this.element.querySelector('#lib-file-input') as HTMLInputElement;
    fileInput?.addEventListener('change', async e => {
      const target = e.target as HTMLInputElement;
      if (target.files && target.files[0]) {
        const file = target.files[0];
        this.loadedFileName = file.name;
        this.isMicActive = false;
        await this.audioEngine.loadAudioFile(file);
        this.render();
      }
    });

    // Mic button
    this.element.querySelector('#lib-btn-mic')?.addEventListener('click', async () => {
      if (this.isMicActive) {
        this.audioEngine.stopMicrophone();
        this.isMicActive = false;
        this.audioEngine.playDemoTrack('cosmic-odyssey');
      } else {
        const ok = await this.audioEngine.startMicrophone();
        if (ok) {
          this.isMicActive = true;
          this.loadedFileName = null;
        }
      }
      this.render();
    });
  }
}
