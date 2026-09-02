/**
 * MusicLibraryCard.ts
 * SoundForm 3D — Music Studio Audio Source & Track Crate Deck
 *
 * Provides a dedicated 5-way unified music source controller:
 * 1. Studio Crate: 15 curated genre-categorized procedural tracks with instant search and category filters.
 * 2. Apple Music: 100M+ searchable songs via Apple/iTunes Catalog with 600x600 artwork, curated stations, and preview streaming.
 * 3. Spotify: Curated cyber/ambient crates, PKCE OAuth 2.0 account integration, and real-time audio analysis synthesis.
 * 4. Custom Upload: High-speed audio file dropzone & inspector (WAV, MP3, FLAC, OGG, AAC) with interactive scrubber.
 * 5. Live Microphone: Hardware input stream with real-time VU peak meter, headphone feedback safety notice, and gain trim.
 */

import { AudioEngine } from '../audio/AudioEngine';
import { DemoAudioGenerator } from '../audio/DemoAudioGenerator';
import { VisualizerEngine } from '../visualizer/VisualizerEngine';
import { StreamingTrack } from '../audio/connectors/types';
import { AppleMusicConnector } from '../audio/connectors/AppleMusicConnector';
import { SpotifyConnector } from '../audio/connectors/SpotifyConnector';

export type MusicSourceTab = 'crate' | 'apple-music' | 'spotify' | 'upload' | 'mic';

export class MusicLibraryCard {
  private element: HTMLElement;
  private onTrackChange?: (trackId: string) => void;
  private unsubscribe?: () => void;
  private animFrameId: number | null = null;

  // Active Source Deck: 'crate' | 'apple-music' | 'spotify' | 'upload' | 'mic'
  private activeSource: MusicSourceTab = 'crate';
  private selectedCategory = 'all';
  private searchQuery = '';
  private isScrubbing = false;

  // Streaming search results cache
  private appleMusicTracks: StreamingTrack[] = AppleMusicConnector.CURATED_CATEGORIES.flatMap(c => c.tracks);
  private spotifyTracks: StreamingTrack[] = SpotifyConnector.CURATED_CATEGORIES.flatMap(c => c.tracks);
  private isSearchingStreaming = false;
  private searchDebounceTimer: any = null;
  private showAppleDevSettings = false;
  private showSpotifyDevSettings = false;

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
      this.updateTrackListOnly();
    });
    this.startVUMeterLoop();
  }

  public setVisualizer(visualizer: VisualizerEngine): void {
    this.visualizer = visualizer;
  }

  public destroy(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = undefined;
    }
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
      this.searchDebounceTimer = null;
    }
  }

  public getElement(): HTMLElement {
    return this.element;
  }

  public getActiveSource(): MusicSourceTab {
    return this.activeSource;
  }

  public setActiveSource(source: MusicSourceTab): void {
    this.activeSource = source;
    this.selectedCategory = 'all';
    this.searchQuery = '';
    this.render();
    this.setupListeners();
  }

  private preventEventBleeding(): void {
    this.element.addEventListener('wheel', e => e.stopPropagation(), { passive: false });
  }

  private startVUMeterLoop(): void {
    const updateMeter = () => {
      if (this.activeSource === 'mic' && this.audioEngine.isMicrophoneActive()) {
        const bands = this.audioEngine.getCurrentBands();
        const maxLevel = Math.max(bands.bass, bands.mid, bands.high, bands.rms, 0.02);
        const levelPct = Math.min(100, Math.round(maxLevel * 100));

        const meterBar = this.element.querySelector('#mic-vu-level') as HTMLElement;
        const meterDb = this.element.querySelector('#mic-vu-db') as HTMLElement;
        if (meterBar) {
          meterBar.style.width = `${levelPct}%`;
          if (levelPct > 85) {
            meterBar.className = 'h-full rounded-full bg-rose-500 transition-all duration-75 shadow-sm shadow-rose-500/50';
          } else if (levelPct > 60) {
            meterBar.className = 'h-full rounded-full bg-amber-400 transition-all duration-75 shadow-sm shadow-amber-400/50';
          } else {
            meterBar.className = 'h-full rounded-full bg-cyan-400 transition-all duration-75 shadow-sm shadow-cyan-400/50';
          }
        }
        if (meterDb) {
          const dbValue = maxLevel > 0.001 ? (20 * Math.log10(maxLevel)).toFixed(1) : '-60.0';
          meterDb.textContent = `${dbValue} dB`;
        }
      }
      this.animFrameId = requestAnimationFrame(updateMeter);
    };
    this.animFrameId = requestAnimationFrame(updateMeter);
  }

  public render(): void {
    const isPlaying = this.audioEngine.getIsPlaying();
    const isMicActive = this.audioEngine.isMicrophoneActive();
    const loadedFileName = this.audioEngine.getLoadedFileName();
    const streamingTrack = this.audioEngine.getActiveStreamingTrack();
    const currentTrackId = this.audioEngine.getActiveTrackId();
    const currentTime = this.audioEngine.getCurrentTime();
    const duration = this.audioEngine.getDuration();
    const progressPct = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;
    const mode = this.audioEngine.getMode();

    this.element.innerHTML = `
      <div class="glass-panel p-3 sm:p-4 rounded-3xl flex flex-col gap-3 shadow-xl border border-white/10 text-white select-none backdrop-blur-xl">
        
        <!-- Header & 5-Way Source Deck Selector -->
        <div class="flex flex-col gap-2.5 border-b border-white/10 pb-2.5">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div class="w-7 h-7 rounded-xl bg-slate-900 border border-white/15 flex items-center justify-center text-cyan-400 font-mono text-xs font-bold shrink-0 shadow-sm">
                <svg class="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"/></svg>
              </div>
              <div>
                <h3 class="text-xs sm:text-sm font-bold text-white tracking-tight">Music Studio</h3>
                <p class="text-[10px] text-slate-400 font-medium">Streaming connectors & audio sources</p>
              </div>
            </div>
            <span class="text-[9px] font-bold font-mono px-2 py-0.5 rounded-full ${
              isMicActive
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse'
                : isPlaying
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'bg-slate-900 text-slate-400 border border-white/10'
            }">
              ${isMicActive ? 'MIC LIVE' : isPlaying ? 'PLAYING' : 'READY'}
            </span>
          </div>

          <!-- 5-Way Source Selector Tabs -->
          <div class="segmented-track grid grid-cols-5 gap-0.5 text-[10px] p-0.5">
            <button
              id="tab-source-crate"
              data-tab="crate"
              class="segmented-pill flex items-center justify-center gap-0.5 py-1 px-1 truncate ${
                this.activeSource === 'crate' ? 'is-active glass-btn-active font-bold' : ''
              }"
              title="Studio Demo Tracks"
            >
              <span>Tracks</span>
            </button>
            <button
              id="tab-source-apple"
              data-tab="apple-music"
              class="segmented-pill flex items-center justify-center gap-0.5 py-1 px-1 truncate ${
                this.activeSource === 'apple-music' ? 'is-active glass-btn-active font-bold text-rose-300' : ''
              }"
              title="Apple Music Catalog"
            >
              <span>Apple</span>
            </button>
            <button
              id="tab-source-spotify"
              data-tab="spotify"
              class="segmented-pill flex items-center justify-center gap-0.5 py-1 px-1 truncate ${
                this.activeSource === 'spotify' ? 'is-active glass-btn-active font-bold text-emerald-300' : ''
              }"
              title="Spotify Web & Analysis"
            >
              <span>Spotify</span>
            </button>
            <button
              id="tab-source-upload"
              data-tab="upload"
              class="segmented-pill flex items-center justify-center gap-0.5 py-1 px-1 truncate ${
                this.activeSource === 'upload' ? 'is-active glass-btn-active font-bold' : ''
              }"
              title="Custom Audio File Upload"
            >
              <span>File</span>
            </button>
            <button
              id="tab-source-mic"
              data-tab="mic"
              class="segmented-pill flex items-center justify-center gap-0.5 py-1 px-1 truncate ${
                this.activeSource === 'mic' ? 'is-active glass-btn-active font-bold text-amber-300' : ''
              }"
              title="Live Microphone Input"
            >
              <span>Mic</span>
            </button>
          </div>
        </div>

        <!-- ACTIVE VIEW CONTAINER -->
        ${
          this.activeSource === 'crate'
            ? this.renderCrateView(currentTrackId, loadedFileName, isMicActive, isPlaying)
            : this.activeSource === 'apple-music'
            ? this.renderAppleMusicView(streamingTrack, mode, isPlaying)
            : this.activeSource === 'spotify'
            ? this.renderSpotifyView(streamingTrack, mode, isPlaying)
            : this.activeSource === 'upload'
            ? this.renderUploadView(loadedFileName, isPlaying, currentTime, duration, progressPct)
            : this.renderMicView(isMicActive)
        }

      </div>
    `;
  }

  // --- SUB-VIEW 1: PROCEDURAL STUDIO CRATE ---
  private renderCrateView(
    currentTrackId: string,
    loadedFileName: string | null,
    isMicActive: boolean,
    isPlaying: boolean
  ): string {
    const filteredTracks = DemoAudioGenerator.TRACKS.filter(t => {
      const matchCat = this.selectedCategory === 'all' || t.category === this.selectedCategory;
      const matchQuery =
        !this.searchQuery ||
        t.name.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        t.genre.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        t.description.toLowerCase().includes(this.searchQuery.toLowerCase());
      return matchCat && matchQuery;
    });

    return `
      <div class="flex flex-col gap-2.5">
        <!-- Search & Filter -->
        <div class="flex flex-col gap-1.5">
          <div class="relative">
            <input
              type="text"
              id="lib-search-input"
              placeholder="Search 15 tracks, genre, BPM..."
              value="${this.searchQuery}"
              class="w-full h-8 pl-8 pr-7 rounded-xl text-xs bg-slate-950/80 border border-white/10 placeholder-slate-500 text-white outline-none focus:border-cyan-400/80 transition-all shadow-inner"
            />
            <svg class="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            ${
              this.searchQuery
                ? `<button id="btn-clear-search" class="absolute right-2 top-2 text-slate-400 hover:text-white text-xs font-bold cursor-pointer">✕</button>`
                : ''
            }
          </div>

          <!-- Category Filter Pills -->
          <div class="flex items-center gap-1 overflow-x-auto pb-1 custom-scrollbar text-[10px]">
            ${[
              { id: 'all', label: 'All (15)' },
              { id: 'cosmic', label: 'Cosmic' },
              { id: 'electronic', label: 'Electronic' },
              { id: 'classical', label: 'Classical' },
              { id: 'organic', label: 'Organic' },
              { id: 'vocal', label: 'Vocal' },
            ]
              .map(
                c => `
              <button
                data-category="${c.id}"
                class="btn-lib-filter px-2 py-1 rounded-lg font-medium whitespace-nowrap transition-all cursor-pointer ${
                  this.selectedCategory === c.id
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/50 shadow-sm font-bold'
                    : 'bg-slate-900/60 border border-white/5 hover:border-white/20 text-slate-300'
                }"
              >
                ${c.label}
              </button>
            `
              )
              .join('')}
          </div>
        </div>

        <!-- Track List -->
        <div id="crate-track-list" class="flex flex-col gap-1 max-h-60 overflow-y-auto pr-0.5 custom-scrollbar">
          ${
            filteredTracks.length === 0
              ? `
            <div class="p-4 rounded-xl bg-slate-950/40 border border-white/5 text-center flex flex-col items-center justify-center gap-1">
              <span class="text-xs text-slate-300 font-medium">No tracks found</span>
              <span class="text-[10px] text-slate-500">Try adjusting your search query</span>
            </div>
          `
              : filteredTracks
                  .map(
                    t => `
            <button
              data-track="${t.id}"
              class="btn-track-card p-2 rounded-xl flex items-center justify-between transition-all cursor-pointer ${
                t.id === currentTrackId && !loadedFileName && !isMicActive && this.audioEngine.getMode() === 'demo-track'
                  ? 'bg-cyan-500/20 border border-cyan-400/50 shadow-sm ring-1 ring-cyan-400/30'
                  : 'bg-slate-950/40 border border-white/5 hover:bg-white/[0.06] hover:border-white/15'
              }"
            >
              <div class="flex items-center gap-2 min-w-0">
                <span class="text-xs font-mono shrink-0 ${
                  t.id === currentTrackId && !loadedFileName && !isMicActive && this.audioEngine.getMode() === 'demo-track'
                    ? 'text-cyan-400 font-bold'
                    : 'text-slate-500'
                }">
                  ${
                    t.id === currentTrackId && isPlaying && !loadedFileName && !isMicActive && this.audioEngine.getMode() === 'demo-track'
                      ? `<span class="inline-flex items-end gap-0.5 h-3 w-3"><span class="w-0.5 bg-cyan-400 h-full animate-pulse"></span><span class="w-0.5 bg-cyan-400 h-2/3 animate-bounce"></span><span class="w-0.5 bg-cyan-400 h-4/5 animate-pulse"></span></span>`
                      : '♪'
                  }
                </span>
                <div class="flex flex-col text-left min-w-0">
                  <span class="text-[11px] font-semibold truncate ${
                    t.id === currentTrackId && !loadedFileName && !isMicActive && this.audioEngine.getMode() === 'demo-track'
                      ? 'text-cyan-300 font-bold'
                      : 'text-slate-200'
                  }">${t.name}</span>
                  <span class="text-[9px] text-slate-400 font-mono">${t.genre} • ${t.bpm} BPM</span>
                </div>
              </div>
              <div class="flex items-center gap-1 shrink-0">
                <span class="text-[8px] font-mono uppercase px-1.5 py-0.5 rounded bg-slate-900/80 text-cyan-400/90 border border-white/10">${t.category}</span>
              </div>
            </button>
          `
                  )
                  .join('')
          }
        </div>
      </div>
    `;
  }

  // --- SUB-VIEW 2: APPLE MUSIC CATALOG ---
  private renderAppleMusicView(
    streamingTrack: StreamingTrack | null,
    mode: string,
    isPlaying: boolean
  ): string {
    const isAppleActive = mode === 'apple-music' && streamingTrack !== null;
    const isAuthorized = this.audioEngine.appleMusicConnector.isAuthorized();

    return `
      <div class="flex flex-col gap-2.5">
        <!-- Apple Search & Account Status Bar -->
        <div class="flex flex-col gap-1.5">
          <div class="flex items-center justify-between gap-1.5">
            <div class="relative flex-1">
              <input
                type="text"
                id="apple-search-input"
                placeholder="Search 100M+ Apple Music songs & artists..."
                value="${this.searchQuery}"
                class="w-full h-8 pl-8 pr-7 rounded-xl text-xs bg-slate-950/80 border border-rose-500/20 placeholder-slate-500 text-white outline-none focus:border-rose-400/80 transition-all shadow-inner"
              />
              <svg class="w-3.5 h-3.5 text-rose-400 absolute left-2.5 top-2.5 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
              ${
                this.searchQuery
                  ? `<button id="btn-clear-apple-search" class="absolute right-2 top-2 text-slate-400 hover:text-white text-xs font-bold cursor-pointer">✕</button>`
                  : ''
              }
            </div>

            <!-- Apple Music Account / Sign In Button -->
            <button
              id="btn-apple-auth"
              class="px-2.5 py-1.5 rounded-xl text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer shrink-0 ${
                isAuthorized
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/30 hover:bg-rose-500/20'
              }"
              title="${isAuthorized ? 'Connected to Apple Music Account' : 'Account & Developer Settings'}"
            >
              <span>${isAuthorized ? '✓ Linked' : 'Setup'}</span>
            </button>
          </div>

          ${
            this.showAppleDevSettings
              ? `
          <!-- Inline Apple Music Settings Panel (Replaces browser window.prompt) -->
          <div class="p-3 rounded-2xl bg-slate-950/95 border border-rose-500/30 flex flex-col gap-2 shadow-xl">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-rose-300">Apple Music Settings</span>
              <button id="btn-close-apple-dev" class="text-xs text-slate-400 hover:text-white px-1.5 py-0.5 rounded hover:bg-white/10 cursor-pointer">✕</button>
            </div>
            <p class="text-[10px] text-slate-300 leading-relaxed">
              <strong class="text-white">Instant Mode Active:</strong> You can search and play 100M+ songs right now with zero login!
            </p>
            <p class="text-[9px] text-slate-400 leading-relaxed">
              Optional: Enter an Apple Developer Token (MusicKit JS JWT) if you want to link your personal subscriber account:
            </p>
            <div class="flex items-center gap-1.5">
              <input
                type="password"
                id="input-apple-dev-token"
                placeholder="Paste Apple Music Developer Token..."
                value="${this.audioEngine.appleMusicConnector.getStoredDeveloperToken() || ''}"
                class="flex-1 h-7 px-2 rounded-lg text-[10px] bg-slate-900 border border-white/10 text-white placeholder-slate-600 outline-none focus:border-rose-400"
              />
              <button
                id="btn-save-apple-token"
                class="px-2.5 h-7 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-bold hover:bg-rose-500/30 cursor-pointer shrink-0"
              >
                ${isAuthorized ? 'Update' : 'Save'}
              </button>
            </div>
          </div>
          `
              : ''
          }

          <!-- Apple Curated Genre Filter Pills -->
          <div class="flex items-center gap-1 overflow-x-auto pb-1 custom-scrollbar text-[10px]">
            ${[
              { id: 'all', label: isAuthorized ? 'My Library' : 'All Curated' },
              { id: 'trending', label: 'Trending' },
              { id: 'ambient', label: 'Ambient' },
              { id: 'classical', label: 'Classical' },
              { id: 'electronic', label: 'Electronic' },
            ]
              .map(
                c => `
              <button
                data-apple-cat="${c.id}"
                class="btn-apple-filter px-2 py-1 rounded-lg font-medium whitespace-nowrap transition-all cursor-pointer ${
                  this.selectedCategory === c.id
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-400/50 shadow-sm font-bold'
                    : 'bg-slate-900/60 border border-white/5 hover:border-white/20 text-slate-300'
                }"
              >
                ${c.label}
              </button>
            `
              )
              .join('')}
          </div>
        </div>

        <!-- Apple Music Track List -->
        <div id="apple-track-list" class="flex flex-col gap-1 max-h-60 overflow-y-auto pr-0.5 custom-scrollbar">
          ${
            this.isSearchingStreaming
              ? `
            <div class="p-4 rounded-xl bg-slate-950/40 border border-white/5 text-center flex flex-col items-center justify-center gap-2">
              <span class="w-4 h-4 rounded-full border-2 border-rose-400 border-t-transparent animate-spin"></span>
              <span class="text-[10px] text-slate-400">Searching Apple Music Catalog...</span>
            </div>
          `
              : this.appleMusicTracks.length === 0
              ? `
            <div class="p-4 rounded-xl bg-slate-950/40 border border-white/5 text-center flex flex-col items-center justify-center gap-1">
              <span class="text-xs text-slate-300 font-medium">No Apple Music tracks found</span>
              <span class="text-[10px] text-slate-500">Try searching for an artist or song name</span>
            </div>
          `
              : this.appleMusicTracks
                  .map(
                    t => `
            <button
              data-stream-id="${t.id}"
              class="btn-apple-track-card p-2 rounded-xl flex items-center justify-between transition-all cursor-pointer ${
                isAppleActive && streamingTrack?.id === t.id
                  ? 'bg-rose-500/20 border border-rose-400/50 shadow-sm ring-1 ring-rose-400/30'
                  : 'bg-slate-950/60 border border-white/5 hover:bg-slate-900/80 hover:border-white/15'
              }"
            >
              <div class="flex items-center gap-2 min-w-0">
                <img
                  src="${t.artworkUrl}"
                  alt="${t.title}"
                  class="w-8 h-8 rounded-lg object-cover shrink-0 border border-white/10 shadow-sm"
                  loading="lazy"
                  onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'32\\' height=\\'32\\' fill=\\'%23f43f5e\\'><rect width=\\'32\\' height=\\'32\\' fill=\\'%231e1e2e\\'/><text x=\\'50%\\' y=\\'50%\\' dominant-baseline=\\'middle\\' text-anchor=\\'middle\\' fill=\\'%23f43f5e\\' font-size=\\'16\\'>♪</text></svg>'"
                />
                <div class="flex flex-col text-left min-w-0">
                  <span class="text-[11px] font-semibold truncate ${
                    isAppleActive && streamingTrack?.id === t.id ? 'text-rose-300' : 'text-slate-200'
                  }">${t.title}</span>
                  <span class="text-[9px] text-slate-400 truncate">${t.artist}</span>
                </div>
              </div>
              <div class="flex items-center gap-1.5 shrink-0">
                ${
                  isAppleActive && streamingTrack?.id === t.id && isPlaying
                    ? `<span class="inline-flex items-end gap-0.5 h-3 w-3"><span class="w-0.5 bg-rose-400 h-full animate-pulse"></span><span class="w-0.5 bg-rose-400 h-2/3 animate-bounce"></span><span class="w-0.5 bg-rose-400 h-4/5 animate-pulse"></span></span>`
                    : `<span class="text-[9px] text-rose-400/80 font-mono">30s HD</span>`
                }
              </div>
            </button>
          `
                  )
                  .join('')
          }
        </div>

        <!-- Apple Music Zero-Auth Indicator -->
        <div class="p-2 rounded-xl bg-rose-950/30 border border-rose-500/20 flex items-center justify-between text-[10px] text-rose-200/90">
          <div class="flex items-center gap-1.5">
            <span class="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
            <span>Direct Web Audio 4096-bin FFT • Instant Catalog</span>
          </div>
          <span class="text-[9px] font-mono text-rose-400 font-semibold">Ready</span>
        </div>
      </div>
    `;
  }

  // --- SUB-VIEW 3: SPOTIFY CONNECTOR & AUDIO ANALYSIS ---
  private renderSpotifyView(
    streamingTrack: StreamingTrack | null,
    mode: string,
    isPlaying: boolean
  ): string {
    const isSpotifyActive = mode === 'spotify' && streamingTrack !== null;
    const isAuth = this.audioEngine.spotifyConnector.isAuthenticated();

    return `
      <div class="flex flex-col gap-2.5">
        <!-- Spotify Search & Account Status -->
        <div class="flex flex-col gap-1.5">
          <div class="flex items-center justify-between gap-1.5">
            <div class="relative flex-1">
              <input
                type="text"
                id="spotify-search-input"
                placeholder="Search Spotify tracks, artists..."
                value="${this.searchQuery}"
                class="w-full h-8 pl-8 pr-7 rounded-xl text-xs bg-slate-950/80 border border-emerald-500/20 placeholder-slate-500 text-white outline-none focus:border-emerald-400/80 transition-all shadow-inner"
              />
              <svg class="w-3.5 h-3.5 text-emerald-400 absolute left-2.5 top-2.5 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
              ${
                this.searchQuery
                  ? `<button id="btn-clear-spotify-search" class="absolute right-2 top-2 text-slate-400 hover:text-white text-xs font-bold cursor-pointer">✕</button>`
                  : ''
              }
            </div>

            <!-- PKCE Connect / Status Button -->
            <button
              id="btn-spotify-auth"
              class="px-2.5 py-1.5 rounded-xl text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer shrink-0 ${
                isAuth
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20'
              }"
              title="${isAuth ? 'Connected to Spotify Account' : 'Account & Developer Settings'}"
            >
              <span>${isAuth ? '✓ Connected' : 'Setup'}</span>
            </button>
          </div>

          ${
            this.showSpotifyDevSettings
              ? `
          <!-- Inline Spotify Settings Panel (Replaces browser window.prompt) -->
          <div class="p-3 rounded-2xl bg-slate-950/95 border border-emerald-500/30 flex flex-col gap-2 shadow-xl">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-emerald-300">Spotify Settings</span>
              <button id="btn-close-spotify-dev" class="text-xs text-slate-400 hover:text-white px-1.5 py-0.5 rounded hover:bg-white/10 cursor-pointer">✕</button>
            </div>
            <p class="text-[10px] text-slate-300 leading-relaxed">
              <strong class="text-white">Instant Mode Active:</strong> Curated tracks and synthetic analysis work right now with zero login!
            </p>
            <p class="text-[9px] text-slate-400 leading-relaxed">
              Optional: Enter a Spotify Client ID to log in via PKCE and stream from your user account:
            </p>
            <div class="flex items-center gap-1.5">
              <input
                type="text"
                id="input-spotify-client-id"
                placeholder="Enter Spotify Client ID..."
                class="flex-1 h-7 px-2 rounded-lg text-[10px] bg-slate-900 border border-white/10 text-white placeholder-slate-600 outline-none focus:border-emerald-400"
              />
              <button
                id="btn-connect-spotify-pkce"
                class="px-2.5 h-7 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold hover:bg-emerald-500/30 cursor-pointer shrink-0"
              >
                ${isAuth ? 'Reconnect' : 'Connect'}
              </button>
            </div>
          </div>
          `
              : ''
          }

          <!-- Spotify Curated Genre Filter Pills -->
          <div class="flex items-center gap-1 overflow-x-auto pb-1 custom-scrollbar text-[10px]">
            ${[
              { id: 'all', label: 'All Curated' },
              { id: 'spotify-electronic', label: 'Cyberpunk' },
              { id: 'spotify-ambient', label: 'Solfeggio' },
              { id: 'spotify-vocal', label: 'Vocal' },
            ]
              .map(
                c => `
              <button
                data-spotify-cat="${c.id}"
                class="btn-spotify-filter px-2 py-1 rounded-lg font-medium whitespace-nowrap transition-all cursor-pointer ${
                  this.selectedCategory === c.id
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/50 shadow-sm font-bold'
                    : 'bg-slate-900/60 border border-white/5 hover:border-white/20 text-slate-300'
                }"
              >
                ${c.label}
              </button>
            `
              )
              .join('')}
          </div>
        </div>

        <!-- Spotify Track List -->
        <div id="spotify-track-list" class="flex flex-col gap-1 max-h-60 overflow-y-auto pr-0.5 custom-scrollbar">
          ${
            this.spotifyTracks.length === 0
              ? `
            <div class="p-4 rounded-xl bg-slate-950/40 border border-white/5 text-center flex flex-col items-center justify-center gap-1">
              <span class="text-xs text-slate-300 font-medium">No Spotify tracks found</span>
              <span class="text-[10px] text-slate-500">Try searching for a different track</span>
            </div>
          `
              : this.spotifyTracks
                  .map(
                    t => `
            <button
              data-stream-id="${t.id}"
              class="btn-spotify-track-card p-2 rounded-xl flex items-center justify-between transition-all cursor-pointer ${
                isSpotifyActive && streamingTrack?.id === t.id
                  ? 'bg-emerald-500/20 border border-emerald-400/50 shadow-sm ring-1 ring-emerald-400/30'
                  : 'bg-slate-950/60 border border-white/5 hover:bg-slate-900/80 hover:border-white/15'
              }"
            >
              <div class="flex items-center gap-2 min-w-0">
                <img
                  src="${t.artworkUrl}"
                  alt="${t.title}"
                  class="w-8 h-8 rounded-lg object-cover shrink-0 border border-white/10 shadow-sm"
                  loading="lazy"
                  onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'32\\' height=\\'32\\' fill=\\'%2310b981\\'><rect width=\\'32\\' height=\\'32\\' fill=\\'%231e1e2e\\'/><text x=\\'50%\\' y=\\'50%\\' dominant-baseline=\\'middle\\' text-anchor=\\'middle\\' fill=\\'%2310b981\\' font-size=\\'16\\'>♪</text></svg>'"
                />
                <div class="flex flex-col text-left min-w-0">
                  <span class="text-[11px] font-semibold truncate ${
                    isSpotifyActive && streamingTrack?.id === t.id ? 'text-emerald-300' : 'text-slate-200'
                  }">${t.title}</span>
                  <span class="text-[9px] text-slate-400 truncate">${t.artist}</span>
                </div>
              </div>
              <div class="flex items-center gap-1.5 shrink-0">
                ${
                  isSpotifyActive && streamingTrack?.id === t.id && isPlaying
                    ? `<span class="inline-flex items-end gap-0.5 h-3 w-3"><span class="w-0.5 bg-emerald-400 h-full animate-pulse"></span><span class="w-0.5 bg-emerald-400 h-2/3 animate-bounce"></span><span class="w-0.5 bg-emerald-400 h-4/5 animate-pulse"></span></span>`
                    : `<span class="text-[9px] text-emerald-400/80 font-mono">Sync</span>`
                }
              </div>
            </button>
          `
                  )
                  .join('')
          }
        </div>

        <!-- Spotify Audio Analysis Telemetry Badge -->
        <div class="p-2 rounded-xl bg-emerald-950/30 border border-emerald-500/20 flex items-center justify-between text-[10px] text-emerald-200/90">
          <div class="flex items-center gap-1.5">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Chroma 12-Pitch & Timbre Synthesizer</span>
          </div>
          <span class="text-[9px] font-mono text-emerald-400 font-semibold">Active</span>
        </div>
      </div>
    `;
  }

  // --- SUB-VIEW 4: CUSTOM UPLOAD ---
  private renderUploadView(
    loadedFileName: string | null,
    isPlaying: boolean,
    currentTime: number,
    duration: number,
    progressPct: number
  ): string {
    return `
      <div class="flex flex-col gap-3">
        <label id="upload-dropzone" class="p-4 sm:p-6 rounded-2xl border-2 border-dashed border-white/15 hover:border-cyan-400/50 bg-slate-950/40 hover:bg-slate-900/70 transition-all flex flex-col items-center justify-center gap-2 cursor-pointer group">
          <div class="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 group-hover:scale-110 transition-transform shadow-sm">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>
          </div>
          <div class="text-center">
            <span class="text-xs font-bold text-slate-200 block">Drop audio file here</span>
            <span class="text-[10px] text-slate-400">or click to browse local files</span>
          </div>
          <span class="text-[9px] font-mono text-cyan-400/80 bg-slate-900/90 px-2 py-0.5 rounded-full border border-white/10">
            WAV • MP3 • FLAC • OGG • AAC • M4A
          </span>
          <input type="file" id="lib-file-input" accept="audio/*" class="hidden" />
        </label>

        ${
          loadedFileName
            ? `
        <!-- Loaded File Details Card with Scrubber & Playback -->
        <div class="p-3.5 rounded-2xl bg-slate-950/90 border border-cyan-500/40 flex flex-col gap-2.5 shadow-md">
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2 min-w-0">
              <button
                id="lib-file-play-pause"
                aria-label="${isPlaying ? 'Pause custom audio' : 'Play custom audio'}"
                class="w-7 h-7 rounded-lg ${
                  isPlaying
                    ? 'bg-cyan-400 text-slate-950 font-bold hover:bg-cyan-300 shadow-md shadow-cyan-400/40'
                    : 'bg-slate-900 text-white border border-slate-700 hover:bg-slate-800'
                } flex items-center justify-center shrink-0 cursor-pointer transition-all active:scale-95"
              >
                ${
                  isPlaying
                    ? `<svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>`
                    : `<svg class="w-3.5 h-3.5 fill-current ml-0.5" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>`
                }
              </button>
              <div class="flex flex-col min-w-0">
                <span class="text-xs font-bold text-cyan-300 truncate" title="${loadedFileName}">${loadedFileName}</span>
                <span class="text-[9px] font-mono text-slate-400">Decoded • ${duration > 0 ? this.formatTime(duration) : 'Loading...'}</span>
              </div>
            </div>
            <button id="btn-eject-file" class="text-[10px] text-rose-400 hover:text-rose-300 font-semibold px-2 py-1 rounded-lg bg-rose-500/10 border border-rose-500/20 cursor-pointer shrink-0">
              Eject
            </button>
          </div>

          <!-- Upload File Scrubber Slider -->
          <div class="flex flex-col gap-1 pt-1.5 border-t border-white/5">
            <div class="flex items-center gap-2">
              <span id="lib-file-cur-time" class="text-[10px] font-mono text-cyan-300 tabular-nums shrink-0 font-medium">${this.formatTime(currentTime)}</span>
              <input
                type="range"
                id="lib-file-scrubber"
                min="0"
                max="${duration > 0 ? duration : 100}"
                step="0.1"
                value="${currentTime}"
                aria-label="Seek uploaded audio file"
                class="w-full h-1.5 rounded-full cursor-pointer appearance-none bg-white/10 slider-cyan transition-all"
                style="background: linear-gradient(to right, #22d3ee ${progressPct}%, rgba(255, 255, 255, 0.12) ${progressPct}%);"
              />
              <span id="lib-file-dur-time" class="text-[10px] font-mono text-slate-400 tabular-nums shrink-0">${duration > 0 ? this.formatTime(duration) : '--:--'}</span>
            </div>
          </div>
        </div>
        `
            : ''
        }
      </div>
    `;
  }

  // --- SUB-VIEW 5: LIVE MICROPHONE ---
  private renderMicView(isMicActive: boolean): string {
    return `
      <div class="flex flex-col gap-3">
        <div class="p-3.5 rounded-2xl bg-slate-950/90 border border-white/10 flex flex-col gap-3 shadow-inner">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div class="w-8 h-8 rounded-xl ${
                isMicActive ? 'bg-rose-500/20 border border-rose-500/40 text-rose-400' : 'bg-slate-900 border border-white/10 text-slate-400'
              } flex items-center justify-center">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/></svg>
              </div>
              <div>
                <h4 class="text-xs font-bold text-slate-200">Microphone Input</h4>
                <p class="text-[10px] text-slate-400">Live physical voice & sound excitation</p>
              </div>
            </div>

            <button
              id="lib-btn-mic"
              class="px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm ${
                isMicActive
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/50 animate-pulse font-bold'
                  : 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/50 hover:bg-cyan-500/30 font-medium'
              }"
            >
              <span>${isMicActive ? 'Stop Mic' : 'Start Mic'}</span>
            </button>
          </div>

          <!-- Real-Time VU Meter Strip -->
          <div class="flex flex-col gap-1 pt-1 border-t border-white/5">
            <div class="flex justify-between text-[10px] font-mono text-slate-400">
              <span>Signal Peak Level</span>
              <span id="mic-vu-db" class="text-cyan-400 font-bold">${isMicActive ? '-18.4 dB' : 'Offline'}</span>
            </div>
            <div class="w-full h-2 rounded-full bg-slate-900 border border-white/10 overflow-hidden p-0.5">
              <div id="mic-vu-level" class="h-full rounded-full bg-cyan-400 transition-all duration-75" style="width: ${isMicActive ? '35%' : '0%'};"></div>
            </div>
          </div>
        </div>

        <!-- Plain-Language Friendly Feedback Tip -->
        <div class="p-2.5 rounded-xl bg-cyan-950/30 border border-cyan-500/20 flex items-start gap-2 text-[10px] text-cyan-200/90">
          <svg class="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
          <span>Tip: Use headphones while the microphone is active to prevent acoustic echo and feedback loops.</span>
        </div>
      </div>
    `;
  }

  private setupListeners(): void {
    // 5-Way Source Tabs
    this.element.querySelectorAll('[data-tab]').forEach(btn => {
      btn.addEventListener('click', e => {
        const target = e.currentTarget as HTMLElement;
        const tab = target.getAttribute('data-tab') as MusicSourceTab;
        if (tab && tab !== this.activeSource) {
          this.setActiveSource(tab);
        }
      });
    });

    if (this.activeSource === 'crate') {
      const searchInput = this.element.querySelector('#lib-search-input') as HTMLInputElement;
      searchInput?.addEventListener('input', () => {
        this.searchQuery = searchInput.value;
        this.updateTrackListOnly();
      });

      this.element.querySelector('#btn-clear-search')?.addEventListener('click', () => {
        this.searchQuery = '';
        this.render();
        this.setupListeners();
      });

      this.element.querySelectorAll('.btn-lib-filter').forEach(btn => {
        btn.addEventListener('click', e => {
          const target = e.currentTarget as HTMLElement;
          this.selectedCategory = target.getAttribute('data-category') || 'all';
          this.render();
          this.setupListeners();
        });
      });

      this.element.querySelectorAll('.btn-track-card').forEach(btn => {
        btn.addEventListener('click', async e => {
          const target = e.currentTarget as HTMLElement;
          const trackId = target.getAttribute('data-track');
          if (trackId) {
            await this.audioEngine.initialize();
            await this.audioEngine.playDemoTrack(trackId);
            this.onTrackChange?.(trackId);
            this.render();
            this.setupListeners();
          }
        });
      });

    } else if (this.activeSource === 'apple-music') {
      const appleSearchInput = this.element.querySelector('#apple-search-input') as HTMLInputElement;
      appleSearchInput?.addEventListener('input', () => {
        this.searchQuery = appleSearchInput.value;
        if (this.searchDebounceTimer) clearTimeout(this.searchDebounceTimer);
        this.searchDebounceTimer = setTimeout(async () => {
          this.isSearchingStreaming = true;
          this.render();
          this.setupListeners();
          this.appleMusicTracks = await this.audioEngine.appleMusicConnector.searchTracks(this.searchQuery);
          this.isSearchingStreaming = false;
          this.render();
          this.setupListeners();
        }, 300);
      });

      this.element.querySelector('#btn-clear-apple-search')?.addEventListener('click', async () => {
        this.searchQuery = '';
        this.appleMusicTracks = this.audioEngine.appleMusicConnector.getAllCuratedTracks();
        this.render();
        this.setupListeners();
      });

      this.element.querySelector('#btn-apple-auth')?.addEventListener('click', () => {
        this.showAppleDevSettings = !this.showAppleDevSettings;
        this.render();
        this.setupListeners();
      });

      this.element.querySelector('#btn-close-apple-dev')?.addEventListener('click', () => {
        this.showAppleDevSettings = false;
        this.render();
        this.setupListeners();
      });

      this.element.querySelector('#btn-save-apple-token')?.addEventListener('click', async () => {
        const inputEl = this.element.querySelector('#input-apple-dev-token') as HTMLInputElement;
        const token = inputEl?.value?.trim();
        if (token) {
          const ok = await this.audioEngine.appleMusicConnector.initializeMusicKit(token);
          if (ok) {
            await this.audioEngine.appleMusicConnector.authorizeUser();
            const userSongs = await this.audioEngine.appleMusicConnector.fetchUserLibrarySongs();
            if (userSongs.length > 0) {
              this.appleMusicTracks = userSongs;
            }
          }
        }
        this.showAppleDevSettings = false;
        this.render();
        this.setupListeners();
      });

      this.element.querySelectorAll('.btn-apple-filter').forEach(btn => {
        btn.addEventListener('click', e => {
          const target = e.currentTarget as HTMLElement;
          const cat = target.getAttribute('data-apple-cat') || 'all';
          this.selectedCategory = cat;
          if (cat === 'all') {
            this.appleMusicTracks = this.audioEngine.appleMusicConnector.getAllCuratedTracks();
          } else {
            const group = AppleMusicConnector.CURATED_CATEGORIES.find(c => c.id === cat);
            this.appleMusicTracks = group ? group.tracks : [];
          }
          this.render();
          this.setupListeners();
        });
      });

      this.element.querySelectorAll('.btn-apple-track-card').forEach(btn => {
        btn.addEventListener('click', async e => {
          const target = e.currentTarget as HTMLElement;
          const streamId = target.getAttribute('data-stream-id');
          const track = this.appleMusicTracks.find(t => t.id === streamId);
          if (track) {
            await this.audioEngine.loadStreamTrack(track);
            this.render();
            this.setupListeners();
          }
        });
      });

    } else if (this.activeSource === 'spotify') {
      const spotifySearchInput = this.element.querySelector('#spotify-search-input') as HTMLInputElement;
      spotifySearchInput?.addEventListener('input', () => {
        this.searchQuery = spotifySearchInput.value;
        if (this.searchDebounceTimer) clearTimeout(this.searchDebounceTimer);
        this.searchDebounceTimer = setTimeout(async () => {
          this.spotifyTracks = await this.audioEngine.spotifyConnector.searchTracks(this.searchQuery);
          this.render();
          this.setupListeners();
        }, 300);
      });

      this.element.querySelector('#btn-clear-spotify-search')?.addEventListener('click', () => {
        this.searchQuery = '';
        this.spotifyTracks = this.audioEngine.spotifyConnector.getAllCuratedTracks();
        this.render();
        this.setupListeners();
      });

      this.element.querySelector('#btn-spotify-auth')?.addEventListener('click', () => {
        this.showSpotifyDevSettings = !this.showSpotifyDevSettings;
        this.render();
        this.setupListeners();
      });

      this.element.querySelector('#btn-close-spotify-dev')?.addEventListener('click', () => {
        this.showSpotifyDevSettings = false;
        this.render();
        this.setupListeners();
      });

      this.element.querySelector('#btn-connect-spotify-pkce')?.addEventListener('click', async () => {
        const inputEl = this.element.querySelector('#input-spotify-client-id') as HTMLInputElement;
        const clientId = inputEl?.value?.trim();
        if (clientId) {
          const redirectUri = window.location.origin + window.location.pathname;
          const authUrl = await this.audioEngine.spotifyConnector.buildAuthorizeUrl(clientId, redirectUri);
          window.location.href = authUrl;
        }
      });

      this.element.querySelectorAll('.btn-spotify-filter').forEach(btn => {
        btn.addEventListener('click', e => {
          const target = e.currentTarget as HTMLElement;
          const cat = target.getAttribute('data-spotify-cat') || 'all';
          this.selectedCategory = cat;
          if (cat === 'all') {
            this.spotifyTracks = this.audioEngine.spotifyConnector.getAllCuratedTracks();
          } else {
            const group = SpotifyConnector.CURATED_CATEGORIES.find(c => c.id === cat);
            this.spotifyTracks = group ? group.tracks : [];
          }
          this.render();
          this.setupListeners();
        });
      });

      this.element.querySelectorAll('.btn-spotify-track-card').forEach(btn => {
        btn.addEventListener('click', async e => {
          const target = e.currentTarget as HTMLElement;
          const streamId = target.getAttribute('data-stream-id');
          const track = this.spotifyTracks.find(t => t.id === streamId);
          if (track) {
            await this.audioEngine.loadStreamTrack(track);
            this.render();
            this.setupListeners();
          }
        });
      });

    } else if (this.activeSource === 'upload') {
      const dropzone = this.element.querySelector('#upload-dropzone') as HTMLElement;
      const fileInput = this.element.querySelector('#lib-file-input') as HTMLInputElement;

      if (dropzone) {
        dropzone.addEventListener('dragover', e => {
          e.preventDefault();
          e.stopPropagation();
          dropzone.classList.add('border-cyan-400', 'bg-cyan-500/10');
        });

        dropzone.addEventListener('dragleave', e => {
          e.preventDefault();
          e.stopPropagation();
          dropzone.classList.remove('border-cyan-400', 'bg-cyan-500/10');
        });

        dropzone.addEventListener('drop', async e => {
          e.preventDefault();
          e.stopPropagation();
          dropzone.classList.remove('border-cyan-400', 'bg-cyan-500/10');
          if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
            await this.audioEngine.initialize();
            await this.audioEngine.loadAudioFile(e.dataTransfer.files[0]);
            this.render();
            this.setupListeners();
          }
        });
      }

      fileInput?.addEventListener('change', async () => {
        if (fileInput.files && fileInput.files[0]) {
          await this.audioEngine.initialize();
          await this.audioEngine.loadAudioFile(fileInput.files[0]);
          this.render();
          this.setupListeners();
        }
      });

      this.element.querySelector('#lib-file-play-pause')?.addEventListener('click', async () => {
        await this.audioEngine.initialize();
        this.audioEngine.togglePlayPause();
      });

      const fileScrubber = this.element.querySelector('#lib-file-scrubber') as HTMLInputElement;
      if (fileScrubber) {
        fileScrubber.addEventListener('input', () => {
          this.isScrubbing = true;
          const val = parseFloat(fileScrubber.value);
          const max = parseFloat(fileScrubber.max) || 100;
          const curLabel = this.element.querySelector('#lib-file-cur-time');
          if (curLabel) {
            curLabel.textContent = this.formatTime(val);
          }
          const pct = max > 0 ? (val / max) * 100 : 0;
          fileScrubber.style.background = `linear-gradient(to right, #22d3ee ${pct}%, rgba(255, 255, 255, 0.12) ${pct}%)`;
          this.audioEngine.seek(val);
        });

        const finishFileScrub = () => {
          if (!this.isScrubbing) return;
          const val = parseFloat(fileScrubber.value);
          this.audioEngine.seek(val);
          this.isScrubbing = false;
        };

        fileScrubber.addEventListener('change', finishFileScrub);
        fileScrubber.addEventListener('pointerup', finishFileScrub);
        fileScrubber.addEventListener('touchend', finishFileScrub);
      }

      this.element.querySelector('#btn-eject-file')?.addEventListener('click', () => {
        this.audioEngine.setMode('demo-track');
        this.render();
        this.setupListeners();
      });

    } else if (this.activeSource === 'mic') {
      this.element.querySelector('#lib-btn-mic')?.addEventListener('click', async () => {
        await this.audioEngine.initialize();
        if (this.audioEngine.isMicrophoneActive()) {
          this.audioEngine.stopMicrophone();
        } else {
          await this.audioEngine.startMicrophone();
        }
        this.render();
        this.setupListeners();
      });
    }
  }

  private updateTrackListOnly(): void {
    if (this.activeSource === 'upload' && !this.isScrubbing) {
      const fileScrubber = this.element.querySelector('#lib-file-scrubber') as HTMLInputElement;
      const curTimeEl = this.element.querySelector('#lib-file-cur-time');
      const durTimeEl = this.element.querySelector('#lib-file-dur-time');
      const playPauseBtn = this.element.querySelector('#lib-file-play-pause');

      const currentTime = this.audioEngine.getCurrentTime();
      const duration = this.audioEngine.getDuration();
      const isPlaying = this.audioEngine.getIsPlaying();
      const pct = duration > 0 ? (currentTime / duration) * 100 : 0;

      if (fileScrubber) {
        fileScrubber.max = duration > 0 ? duration.toString() : '100';
        fileScrubber.value = currentTime.toString();
        fileScrubber.style.background = `linear-gradient(to right, #22d3ee ${pct}%, rgba(255, 255, 255, 0.12) ${pct}%)`;
      }
      if (curTimeEl) curTimeEl.textContent = this.formatTime(currentTime);
      if (durTimeEl) durTimeEl.textContent = duration > 0 ? this.formatTime(duration) : '--:--';
      if (playPauseBtn) {
        playPauseBtn.innerHTML = isPlaying
          ? `<svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>`
          : `<svg class="w-3.5 h-3.5 fill-current ml-0.5" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
      }
    }

    if (this.activeSource === 'crate') {
      const trackListContainer = this.element.querySelector('#crate-track-list');
      if (!trackListContainer) return;

      const currentTrackId = this.audioEngine.getActiveTrackId();
      const isPlaying = this.audioEngine.getIsPlaying();
      const loadedFileName = this.audioEngine.getLoadedFileName();
      const isMicActive = this.audioEngine.isMicrophoneActive();

      const filteredTracks = DemoAudioGenerator.TRACKS.filter(t => {
        const matchCat = this.selectedCategory === 'all' || t.category === this.selectedCategory;
        const matchQuery =
          !this.searchQuery ||
          t.name.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
          t.genre.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
          t.description.toLowerCase().includes(this.searchQuery.toLowerCase());
        return matchCat && matchQuery;
      });

      if (filteredTracks.length === 0) {
        trackListContainer.innerHTML = `
          <div class="p-4 rounded-xl bg-slate-950/40 border border-white/5 text-center flex flex-col items-center justify-center gap-1">
            <span class="text-xs text-slate-300 font-medium">No tracks found</span>
            <span class="text-[10px] text-slate-500">Try adjusting your search query</span>
          </div>
        `;
        return;
      }

      trackListContainer.innerHTML = filteredTracks
        .map(
          t => `
        <button
          data-track="${t.id}"
          class="btn-track-card p-2 rounded-xl flex items-center justify-between transition-all cursor-pointer ${
            t.id === currentTrackId && !loadedFileName && !isMicActive && this.audioEngine.getMode() === 'demo-track'
              ? 'bg-cyan-500/20 border border-cyan-400/50 shadow-sm ring-1 ring-cyan-400/30'
              : 'bg-slate-950/60 border border-white/5 hover:bg-slate-900/80 hover:border-white/15'
          }"
        >
          <div class="flex items-center gap-2 min-w-0">
            <span class="text-xs font-mono shrink-0 ${
              t.id === currentTrackId && !loadedFileName && !isMicActive && this.audioEngine.getMode() === 'demo-track'
                ? 'text-cyan-400 font-bold'
                : 'text-slate-500'
            }">
              ${
                t.id === currentTrackId && isPlaying && !loadedFileName && !isMicActive && this.audioEngine.getMode() === 'demo-track'
                  ? `<span class="inline-flex items-end gap-0.5 h-3 w-3"><span class="w-0.5 bg-cyan-400 h-full animate-pulse"></span><span class="w-0.5 bg-cyan-400 h-2/3 animate-bounce"></span><span class="w-0.5 bg-cyan-400 h-4/5 animate-pulse"></span></span>`
                  : '♪'
              }
            </span>
            <div class="flex flex-col text-left min-w-0">
              <span class="text-[11px] font-semibold truncate ${
                t.id === currentTrackId && !loadedFileName && !isMicActive && this.audioEngine.getMode() === 'demo-track'
                  ? 'text-cyan-300'
                  : 'text-slate-200'
              }">${t.name}</span>
              <span class="text-[9px] text-slate-400 font-mono">${t.genre} • ${t.bpm} BPM</span>
            </div>
          </div>
          <div class="flex items-center gap-1 shrink-0">
            <span class="text-[8px] font-mono uppercase px-1.5 py-0.5 rounded bg-slate-900 text-cyan-400/80 border border-white/10">${t.category}</span>
          </div>
        </button>
      `
        )
        .join('');

      trackListContainer.querySelectorAll('.btn-track-card').forEach(btn => {
        btn.addEventListener('click', async e => {
          const target = e.currentTarget as HTMLElement;
          const trackId = target.getAttribute('data-track');
          if (trackId) {
            await this.audioEngine.initialize();
            await this.audioEngine.playDemoTrack(trackId);
            this.onTrackChange?.(trackId);
            this.render();
            this.setupListeners();
          }
        });
      });
    }
  }

  private formatTime(secs: number): string {
    if (isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }
}
