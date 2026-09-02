import { AudioEngine } from '../audio/AudioEngine';
import { VisualizerEngine } from '../visualizer/VisualizerEngine';

export type EngineMode = 'music' | 'frequency' | 'therapy' | 'nobel' | 'bio' | 'voice' | 'cymatics' | 'modal';

export class Header {
  private element: HTMLElement;
  private onModeChange: (mode: EngineMode) => void;
  private onStartTour?: () => void;
  private onResetScene?: () => void;
  private onToggleLeftSidebar?: () => void;
  private onToggleRightSidebar?: () => void;
  private isLeftSidebarOpen = typeof window !== 'undefined' ? window.innerWidth >= 1024 : true;
  private isRightSidebarOpen = typeof window !== 'undefined' ? window.innerWidth >= 1024 : true;
  private currentMode: EngineMode = 'music';

  constructor(
    private audioEngine: AudioEngine,
    private visualizer: VisualizerEngine,
    onModeChange: (mode: EngineMode) => void,
    onStartTour?: () => void,
    _onExportDossier?: () => void,
    onToggleLeftSidebar?: () => void,
    onToggleRightSidebar?: () => void,
    onResetScene?: () => void
  ) {
    this.element = document.getElementById('header-root') as HTMLElement;
    this.onModeChange = onModeChange;
    this.onStartTour = onStartTour;
    this.onToggleLeftSidebar = onToggleLeftSidebar;
    this.onToggleRightSidebar = onToggleRightSidebar;
    this.onResetScene = onResetScene;
    this.render();
  }

  public setSidebarStates(leftOpen: boolean, rightOpen: boolean): void {
    this.isLeftSidebarOpen = leftOpen;
    this.isRightSidebarOpen = rightOpen;
    this.render();
  }

  public render(): void {
    const isMusic = this.currentMode === 'music' || this.currentMode === 'cymatics';
    const isFreq = this.currentMode === 'frequency' || this.currentMode === 'modal';
    const isTherapy = this.currentMode === 'therapy';
    const isNobel = this.currentMode === 'nobel';
    const isBio = this.currentMode === 'bio';
    const isVoice = this.currentMode === 'voice';

    this.element.innerHTML = `
      <div class="w-full flex flex-col md:flex-row md:items-center justify-between gap-2 md:gap-4 select-none">
        
        <!-- Left: Brand Cluster & Controls Sidebar Toggle -->
        <div class="flex items-center justify-between w-full md:w-auto gap-2">
          <div class="flex items-center gap-2 md:gap-2.5 shrink-0">
            <!-- Left Sidebar Toggle Button -->
            <button
              id="btn-toggle-left-sidebar"
              aria-label="${this.isLeftSidebarOpen ? 'Hide controls sidebar' : 'Show controls sidebar'}"
              title="${this.isLeftSidebarOpen ? 'Hide controls sidebar' : 'Show controls sidebar'}"
              class="glass-btn px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                this.isLeftSidebarOpen ? 'glass-btn-active' : 'text-slate-400 hover:text-white'
              }"
            >
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <line x1="9" y1="3" x2="9" y2="21"/>
              </svg>
              <span class="hidden sm:inline text-[11px] font-medium">Controls</span>
            </button>

            <!-- Brand Icon & App Title -->
            <div class="flex items-center gap-2">
              <div class="w-8 h-8 rounded-xl bg-slate-900/90 border border-white/15 flex items-center justify-center text-cyan-400 shrink-0 shadow-md shadow-cyan-500/10">
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M2 12h2a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H2v-8z"/>
                  <path d="M22 12h-2a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h2v-8z"/>
                  <path d="M6 12a6 6 0 0 1 12 0"/>
                  <path d="M2 12a10 10 0 0 1 20 0"/>
                </svg>
              </div>
              <div>
                <h1 class="text-sm md:text-base font-bold tracking-tight text-white leading-tight flex items-center gap-1.5">
                  SoundForm <span class="text-cyan-400 font-mono text-xs px-1 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20">3D</span>
                </h1>
                <p class="text-[10px] text-slate-400 font-medium leading-none hidden sm:block">Acoustic & Resonance Engine</p>
              </div>
            </div>
          </div>

          <!-- Mobile Quick Action Buttons -->
          <div class="flex items-center gap-1.5 md:hidden">
            <button class="btn-header-reset-mobile p-1.5 rounded-xl text-xs font-semibold glass-btn text-slate-300 border border-white/10 hover:text-white active:scale-95 flex items-center gap-1 cursor-pointer" aria-label="Reset active studio to defaults" title="Reset active studio to defaults">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                <path d="M3 3v5h5"/>
              </svg>
            </button>
            <button class="btn-executive-tour px-2.5 py-1 rounded-xl text-xs font-semibold bg-amber-400/15 text-amber-300 border border-amber-400/30 flex items-center gap-1 cursor-pointer" aria-label="Start guided keynote tour">
              <span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
              <span>Tour</span>
            </button>
            <button id="btn-toggle-right-sidebar-mobile" aria-label="Toggle telemetry and optics sidebar" title="Toggle telemetry and optics sidebar" class="glass-btn p-1.5 rounded-xl text-xs font-semibold cursor-pointer ${
              this.isRightSidebarOpen ? 'glass-btn-active' : 'text-slate-300'
            }">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <line x1="15" y1="3" x2="15" y2="21"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- Center: 6 Studio Modes Segmented Switcher Capsule -->
        <nav role="tablist" aria-label="Studio Navigation Modes" class="segmented-track overflow-x-auto no-scrollbar max-w-full flex-nowrap shrink-0 shadow-lg">
          <button
            id="btn-mode-music"
            role="tab"
            aria-selected="${isMusic}"
            title="Music Studio: Curated tracks, audio file upload, live mic & cymatics"
            class="segmented-pill flex items-center gap-1.5 shrink-0 ${isMusic ? 'is-active glass-btn-active' : ''}"
          >
            <span>Music Studio</span>
          </button>
          <button
            id="btn-mode-freq"
            role="tab"
            aria-selected="${isFreq}"
            title="Frequencies: Pure tone synthesis, Solfeggio matrix, harmonic overtones & binaural beats"
            class="segmented-pill flex items-center gap-1.5 shrink-0 ${isFreq ? 'is-active glass-btn-active' : ''}"
          >
            <span>Frequencies</span>
          </button>
          <button
            id="btn-mode-therapy"
            role="tab"
            aria-selected="${isTherapy}"
            title="Sound Therapy: Targeted ultrasound resonance, anti-phase wave cancellation & oncology"
            class="segmented-pill flex items-center gap-1.5 shrink-0 ${isTherapy ? 'is-active glass-btn-active' : ''}"
          >
            <span>Sound Therapy</span>
          </button>
          <button
            id="btn-mode-nobel"
            role="tab"
            aria-selected="${isNobel}"
            title="Nobel Frontiers: Frontier biophysics, mechanogenomics, BBB dilation & viral shatter"
            class="segmented-pill flex items-center gap-1.5 shrink-0 ${isNobel ? 'is-active glass-btn-active' : ''}"
          >
            <span>Nobel Frontiers</span>
          </button>
          <button
            id="btn-mode-bio"
            role="tab"
            aria-selected="${isBio}"
            title="Bio-Acoustics: Single cell elasticity spectroscopy & microfluidic sorting"
            class="segmented-pill flex items-center gap-1.5 shrink-0 ${isBio ? 'is-active glass-btn-active' : ''}"
          >
            <span>Bio-Acoustics</span>
          </button>
          <button
            id="btn-mode-voice"
            role="tab"
            aria-selected="${isVoice}"
            title="Voice Studio: Live microphone pitch tracking, vocal tract manifold & sound medicine"
            class="segmented-pill flex items-center gap-1.5 shrink-0 ${isVoice ? 'is-active glass-btn-active' : ''}"
          >
            <span>Voice Studio</span>
          </button>
        </nav>

        <!-- Right: Reset, Guided Tour & Optics/Telemetry Sidebar Toggle -->
        <div class="hidden md:flex items-center gap-2 shrink-0">
          <!-- Reset Action -->
          <button id="btn-header-reset" aria-label="Reset active studio to defaults" title="Reset active studio to defaults" class="glass-btn px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white border border-white/10 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer shrink-0">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
              <path d="M3 3v5h5"/>
            </svg>
            <span class="hidden sm:inline text-[11px] font-medium">Reset</span>
          </button>

          <!-- Keynote Tour Action -->
          <button title="Start guided tour" aria-label="Start guided tour" class="btn-executive-tour px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-400/15 text-amber-300 border border-amber-400/30 hover:bg-amber-400/25 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer shrink-0">
            <span class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
            <span class="font-medium">Keynote Tour</span>
          </button>

          <!-- Right Sidebar Toggle -->
          <button
            id="btn-toggle-right-sidebar"
            aria-label="${this.isRightSidebarOpen ? 'Hide optics and shapes sidebar' : 'Show optics and shapes sidebar'}"
            title="${this.isRightSidebarOpen ? 'Hide optics and shapes sidebar' : 'Show optics and shapes sidebar'}"
            class="glass-btn px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              this.isRightSidebarOpen ? 'glass-btn-active' : 'text-slate-400 hover:text-white'
            }"
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <line x1="15" y1="3" x2="15" y2="21"/>
            </svg>
            <span class="hidden xl:inline text-[11px] font-medium">Optics & Shapes</span>
          </button>
        </div>
      </div>
    `;

    this.attachEvents();
  }

  private attachEvents(): void {
    // Reset Triggers (Mobile & Desktop)
    const handleReset = () => {
      if (this.onResetScene) this.onResetScene();
    };
    document.getElementById('btn-header-reset')?.addEventListener('click', handleReset);
    document.querySelectorAll('.btn-header-reset-mobile').forEach(btn => {
      btn.addEventListener('click', handleReset);
    });

    // Left & Right Sidebar Toggle Triggers
    document.getElementById('btn-toggle-left-sidebar')?.addEventListener('click', () => {
      if (this.onToggleLeftSidebar) this.onToggleLeftSidebar();
    });

    const toggleRight = () => {
      if (this.onToggleRightSidebar) this.onToggleRightSidebar();
    };

    document.getElementById('btn-toggle-right-sidebar')?.addEventListener('click', toggleRight);
    document.getElementById('btn-toggle-right-sidebar-mobile')?.addEventListener('click', toggleRight);

    // Executive tour triggers (mobile & desktop)
    document.querySelectorAll('.btn-executive-tour').forEach(btn => {
      btn.addEventListener('click', () => {
        if (this.onStartTour) this.onStartTour();
      });
    });

    // Studio Mode triggers
    document.getElementById('btn-mode-music')?.addEventListener('click', () => {
      this.onModeChange('music');
    });

    document.getElementById('btn-mode-freq')?.addEventListener('click', () => {
      this.onModeChange('frequency');
    });

    document.getElementById('btn-mode-bio')?.addEventListener('click', () => {
      this.onModeChange('bio');
    });

    document.getElementById('btn-mode-therapy')?.addEventListener('click', () => {
      this.onModeChange('therapy');
    });

    document.getElementById('btn-mode-voice')?.addEventListener('click', () => {
      this.onModeChange('voice');
    });

    document.getElementById('btn-mode-nobel')?.addEventListener('click', () => {
      this.onModeChange('nobel');
    });
  }

  public setMode(mode: EngineMode): void {
    const normalized = mode === 'cymatics' ? 'music' : mode === 'modal' ? 'frequency' : mode;
    if (this.currentMode === normalized) return;
    this.currentMode = normalized;
    this.render();
  }

  public destroy(): void {
    // Teardown header event listeners
  }
}
