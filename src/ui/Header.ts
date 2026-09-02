import { AudioEngine } from '../audio/AudioEngine';
import { VisualizerEngine } from '../visualizer/VisualizerEngine';

export type EngineMode = 'music' | 'frequency' | 'modal' | 'bio' | 'therapy' | 'voice' | 'nobel';

export class Header {
  private element: HTMLElement;
  private onModeChange: (mode: EngineMode) => void;
  private onStartTour?: () => void;
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
    onToggleRightSidebar?: () => void
  ) {
    this.element = document.getElementById('header-root') as HTMLElement;
    this.onModeChange = onModeChange;
    this.onStartTour = onStartTour;
    this.onToggleLeftSidebar = onToggleLeftSidebar;
    this.onToggleRightSidebar = onToggleRightSidebar;
    this.render();
  }

  public setSidebarStates(leftOpen: boolean, rightOpen: boolean): void {
    this.isLeftSidebarOpen = leftOpen;
    this.isRightSidebarOpen = rightOpen;
    this.render();
  }

  public render(): void {
    this.element.innerHTML = `
      <div class="w-full flex flex-col md:flex-row md:items-center justify-between gap-2 md:gap-4">
        <!-- Left on Desktop / Top on Mobile: Brand & Left Sidebar Toggle -->
        <div class="flex items-center justify-between w-full md:w-auto gap-2">
          <div class="flex items-center gap-2 md:gap-2.5 shrink-0">
            <!-- Left Sidebar Toggle Button -->
            <button
              id="btn-toggle-left-sidebar"
              title="${this.isLeftSidebarOpen ? 'Hide controls sidebar' : 'Show controls sidebar'}"
              class="glass-btn p-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                this.isLeftSidebarOpen ? 'glass-btn-active' : 'text-gray-400 hover:text-white'
              }"
            >
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <line x1="9" y1="3" x2="9" y2="21"/>
              </svg>
              <span class="hidden sm:inline text-[11px]">Controls</span>
            </button>

            <div class="w-8 h-8 md:w-9 md:h-9 rounded-xl bg-slate-800 border border-slate-700/80 flex items-center justify-center text-cyan-400 shrink-0 shadow-sm">
              <svg class="w-4 h-4 md:w-5 md:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M2 12h2a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H2v-8z"/>
                <path d="M22 12h-2a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h2v-8z"/>
                <path d="M6 12a6 6 0 0 1 12 0"/>
                <path d="M2 12a10 10 0 0 1 20 0"/>
              </svg>
            </div>
            <div>
              <h1 class="inline-block text-sm md:text-base font-bold tracking-tight text-white leading-none">
                SoundForm <span class="text-cyan-400 font-mono text-xs">3D</span>
              </h1>
              <p class="text-[9px] md:text-[10px] text-gray-400 font-medium mt-0.5">3D Acoustic & Resonance Engine</p>
            </div>
          </div>

          <!-- Mobile-Only Quick Action Buttons -->
          <div class="flex items-center gap-1.5 md:hidden">
            <button class="btn-executive-tour px-2.5 py-1 rounded-xl text-xs font-semibold bg-amber-400/10 text-amber-300 border border-amber-400/30 flex items-center gap-1 cursor-pointer">
              <span>Tour</span>
            </button>
            <button id="btn-toggle-right-sidebar-mobile" class="glass-btn p-1.5 rounded-xl text-xs font-semibold ${
              this.isRightSidebarOpen ? 'glass-btn-active' : 'text-gray-300'
            }">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <line x1="15" y1="3" x2="15" y2="21"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- Center: 7 Studio Modes Switcher Pill -->
        <div class="glass-panel p-1 rounded-2xl flex items-center gap-1 overflow-x-auto no-scrollbar max-w-full flex-nowrap shrink-0 shadow-lg border border-white/10">
          <button id="btn-mode-music" title="Real-time 3D audio visualizer" class="px-2.5 md:px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer ${
            this.currentMode === 'music' ? 'glass-btn-active font-bold text-white shadow-md' : 'text-gray-300 hover:text-white hover:bg-white/5'
          }">
            <span>Music Space</span>
          </button>
          <button id="btn-mode-modal" title="2D Chladni sand plate, 3D fluid droplet & acoustic levitation" class="px-2.5 md:px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer ${
            this.currentMode === 'modal' ? 'glass-btn-active font-bold text-white shadow-md' : 'text-gray-300 hover:text-white hover:bg-white/5'
          }">
            <span>Cymatics</span>
          </button>
          <button id="btn-mode-therapy" title="Targeted ultrasound, 180° phase cancellation & oncology" class="px-2.5 md:px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer ${
            this.currentMode === 'therapy' ? 'glass-btn-active font-bold text-rose-300 shadow-md ring-1 ring-rose-500/40' : 'text-gray-300 hover:text-white hover:bg-white/5'
          }">
            <span>Cancer Lab</span>
          </button>
          <button id="btn-mode-nobel" title="Frontier biophysics: Mechanogenomics, BBB opening, viral shatter & senolytics" class="px-2.5 md:px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer ${
            this.currentMode === 'nobel' ? 'glass-btn-active font-bold text-amber-300 shadow-md ring-1 ring-amber-500/40' : 'text-gray-300 hover:text-white hover:bg-white/5'
          }">
            <span>Nobel Frontiers</span>
          </button>
          <button id="btn-mode-bio" title="Cellular elasticity spectroscopy & microfluidic sorting" class="px-2.5 md:px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer ${
            this.currentMode === 'bio' ? 'glass-btn-active font-bold text-emerald-300 shadow-md ring-1 ring-emerald-500/40' : 'text-gray-300 hover:text-white hover:bg-white/5'
          }">
            <span>Bio-Acoustics</span>
          </button>
          <button id="btn-mode-voice" title="Live microphone pitch tracking, vocal tract & acoustic balance" class="px-2.5 md:px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer ${
            this.currentMode === 'voice' ? 'glass-btn-active font-bold text-cyan-300 shadow-md ring-1 ring-cyan-500/40' : 'text-gray-300 hover:text-white hover:bg-white/5'
          }">
            <span>Voice Studio</span>
          </button>
          <button id="btn-mode-freq" title="Pure frequency synthesizer, Solfeggio presets & overtones" class="px-2.5 md:px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer ${
            this.currentMode === 'frequency' ? 'glass-btn-active font-bold text-blue-300 shadow-md ring-1 ring-blue-500/40' : 'text-gray-300 hover:text-white hover:bg-white/5'
          }">
            <span>Tone Lab</span>
          </button>
        </div>

        <!-- Right: Guided Tour & Telemetry Toggle -->
        <div class="hidden md:flex items-center gap-2 shrink-0">
          <!-- Tour Action -->
          <button title="Start guided tour" class="btn-executive-tour px-2.5 py-1.5 md:px-3 md:py-1.5 rounded-xl text-xs font-semibold bg-amber-400/15 text-amber-300 border border-amber-400/30 hover:bg-amber-400/25 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer shrink-0">
            <span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            <span>Keynote Tour</span>
          </button>

          <!-- Right Sidebar (Telemetry) Toggle -->
          <button
            id="btn-toggle-right-sidebar"
            title="${this.isRightSidebarOpen ? 'Hide telemetry sidebar' : 'Show telemetry sidebar'}"
            class="glass-btn p-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              this.isRightSidebarOpen ? 'glass-btn-active' : 'text-gray-400 hover:text-white'
            }"
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <line x1="15" y1="3" x2="15" y2="21"/>
            </svg>
            <span class="hidden xl:inline text-[11px]">Telemetry</span>
          </button>
        </div>
      </div>
    `;

    this.attachEvents();
  }

  private attachEvents(): void {
    // Left & Right Sidebar Toggle Triggers
    document.getElementById('btn-toggle-left-sidebar')?.addEventListener('click', () => {
      this.isLeftSidebarOpen = !this.isLeftSidebarOpen;
      if (this.onToggleLeftSidebar) this.onToggleLeftSidebar();
      this.render();
    });

    const toggleRight = () => {
      this.isRightSidebarOpen = !this.isRightSidebarOpen;
      if (this.onToggleRightSidebar) this.onToggleRightSidebar();
      this.render();
    };

    document.getElementById('btn-toggle-right-sidebar')?.addEventListener('click', toggleRight);
    document.getElementById('btn-toggle-right-sidebar-mobile')?.addEventListener('click', toggleRight);

    // Executive tour triggers (mobile & desktop)
    document.querySelectorAll('.btn-executive-tour').forEach(btn => {
      btn.addEventListener('click', () => {
        if (this.onStartTour) this.onStartTour();
      });
    });

    // Mode toggles
    document.getElementById('btn-mode-music')?.addEventListener('click', () => {
      this.currentMode = 'music';
      this.render();
      this.onModeChange('music');
    });

    document.getElementById('btn-mode-freq')?.addEventListener('click', () => {
      this.currentMode = 'frequency';
      this.render();
      this.onModeChange('frequency');
    });

    document.getElementById('btn-mode-modal')?.addEventListener('click', () => {
      this.currentMode = 'modal';
      this.render();
      this.onModeChange('modal');
    });

    document.getElementById('btn-mode-bio')?.addEventListener('click', () => {
      this.currentMode = 'bio';
      this.render();
      this.onModeChange('bio');
    });

    document.getElementById('btn-mode-therapy')?.addEventListener('click', () => {
      this.currentMode = 'therapy';
      this.render();
      this.onModeChange('therapy');
    });

    document.getElementById('btn-mode-voice')?.addEventListener('click', () => {
      this.currentMode = 'voice';
      this.render();
      this.onModeChange('voice');
    });

    document.getElementById('btn-mode-nobel')?.addEventListener('click', () => {
      this.currentMode = 'nobel';
      this.render();
      this.onModeChange('nobel');
    });
  }

  public setMode(mode: EngineMode): void {
    if (this.currentMode === mode) return;
    this.currentMode = mode;
    this.render();
  }
}


