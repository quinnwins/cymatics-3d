/**
 * AudioControlsBar.ts
 * SoundForm 3D - Music Space Audio Controls Bar
 */

import { AudioEngine } from '../audio/AudioEngine';
import { DemoAudioGenerator } from '../audio/DemoAudioGenerator';

export class AudioControlsBar {
  private element: HTMLElement;
  private isMicActive = false;
  private loadedFileName: string | null = null;
  private hasInitGlobalListeners = false;

  constructor(private audioEngine: AudioEngine) {
    this.element = document.createElement('div');
    this.element.className = 'w-full flex flex-col items-center gap-3';
    this.initGlobalListeners();
  }

  private initGlobalListeners(): void {
    if (this.hasInitGlobalListeners) return;
    this.hasInitGlobalListeners = true;

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

  public getElement(): HTMLElement {
    this.render();
    return this.element;
  }

  public render(): void {
    const isPlaying = this.audioEngine.getIsPlaying();
    const tracks = DemoAudioGenerator.TRACKS;
    const currentTrackId = this.audioEngine.demoGenerator?.getActiveTrackId() || 'cosmic-odyssey';

    this.element.innerHTML = `
      <div class="glass-panel px-4 py-2 rounded-2xl flex flex-wrap items-center justify-between gap-3 md:gap-4 shadow-2xl border border-white/10 backdrop-blur-2xl max-w-2xl w-full mx-auto select-none">
        
        <!-- Left: Play/Pause & Track Selector -->
        <div class="flex items-center gap-2.5 flex-1 min-w-[200px]">
          <!-- Play / Pause Button -->
          <button id="btn-play-pause" title="${isPlaying ? 'Pause' : 'Play'}" class="w-9 h-9 rounded-xl ${
            isPlaying
              ? 'bg-gradient-to-tr from-accent-magenta to-accent-purple text-white shadow-lg shadow-accent-magenta/30 scale-105'
              : 'bg-gradient-to-tr from-accent-cyan to-accent-blue text-white shadow-lg shadow-accent-cyan/30'
          } flex items-center justify-center transition-all hover:scale-105 active:scale-95 shrink-0 cursor-pointer">
            ${
              isPlaying
                ? `<svg class="w-4 h-4 fill-current" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>`
                : `<svg class="w-4 h-4 fill-current ml-0.5" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>`
            }
          </button>

          <!-- Track Dropdown / Loaded File Info -->
          <div class="flex flex-col flex-1 min-w-0">
            <div class="flex items-center gap-1.5">
              ${
                this.loadedFileName
                  ? `<div class="text-xs font-semibold text-accent-cyan truncate max-w-[180px]">${this.loadedFileName}</div>`
                  : this.isMicActive
                  ? `<div class="text-xs font-semibold text-accent-magenta flex items-center gap-1.5">
                      <span class="w-2 h-2 rounded-full bg-accent-magenta animate-ping"></span>
                      <span>Microphone Active</span>
                    </div>`
                  : `<select id="track-select" class="bg-black/50 text-gray-200 text-xs font-medium rounded-xl px-2.5 py-1 border border-white/10 outline-none focus:border-accent-cyan cursor-pointer hover:bg-black/70 transition-colors w-full max-w-[200px]">
                      ${tracks
                        .map(
                          t => `
                        <option value="${t.id}" class="bg-slate-900 text-gray-100" ${t.id === currentTrackId ? 'selected' : ''}>
                          ${t.name} (${t.bpm} BPM)
                        </option>
                      `
                        )
                        .join('')}
                    </select>`
              }
            </div>
          </div>
        </div>

        <!-- Right: Input Options & Volume Controls -->
        <div class="flex items-center gap-2 shrink-0">
          
          <!-- File Upload Button -->
          <label class="btn-icon p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/5 cursor-pointer transition-all flex items-center gap-1 text-xs font-medium" title="Upload Audio File (MP3, WAV, FLAC)">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            <span class="hidden sm:inline text-[11px]">Upload</span>
            <input type="file" id="file-input" accept="audio/*" class="hidden" />
          </label>

          <!-- Microphone Toggle -->
          <button id="btn-mic" class="btn-icon p-2 rounded-xl ${
            this.isMicActive
              ? 'bg-accent-magenta text-white shadow-lg shadow-accent-magenta/30'
              : 'bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/5'
          } transition-all flex items-center gap-1 text-xs font-medium cursor-pointer" title="Toggle Live Microphone Input">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
            <span class="hidden sm:inline text-[11px]">Mic</span>
          </button>

          <!-- Volume Controls -->
          <div class="flex items-center gap-1.5 bg-black/40 px-2.5 py-1.5 rounded-xl border border-white/5">
            <!-- Mute/Unmute -->
            <button id="btn-mute" class="text-gray-400 hover:text-white transition-colors cursor-pointer p-0.5">
              ${
                this.audioEngine.getIsMuted()
                  ? `<svg class="w-3.5 h-3.5 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>`
                  : `<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`
              }
            </button>

            <!-- Volume Slider -->
            <input 
              id="volume-slider" 
              type="range" 
              min="0" 
              max="1" 
              step="0.01" 
              value="${this.audioEngine.getMasterVolume()}"
              class="w-14 sm:w-20 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-accent-cyan" 
            />
          </div>
        </div>

      </div>
    `;

    this.attachEvents();
  }

  private attachEvents(): void {
    // Play/Pause button
    this.element.querySelector('#btn-play-pause')?.addEventListener('click', async () => {
      await this.audioEngine.initialize();
      this.audioEngine.togglePlayPause();
      this.render();
    });

    // Track Selector
    this.element.querySelector('#track-select')?.addEventListener('change', async e => {
      await this.audioEngine.initialize();
      const select = e.target as HTMLSelectElement;
      this.loadedFileName = null;
      this.isMicActive = false;
      this.audioEngine.playDemoTrack(select.value);
      this.render();
    });

    // File Input
    const fileInput = this.element.querySelector('#file-input') as HTMLInputElement;
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

    // Mic Toggle
    this.element.querySelector('#btn-mic')?.addEventListener('click', async () => {
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

    // Mute button
    this.element.querySelector('#btn-mute')?.addEventListener('click', () => {
      this.audioEngine.toggleMute();
      this.render();
    });

    // Volume slider
    this.element.querySelector('#volume-slider')?.addEventListener('input', e => {
      const slider = e.target as HTMLInputElement;
      this.audioEngine.setMasterVolume(parseFloat(slider.value));
    });
  }
}
