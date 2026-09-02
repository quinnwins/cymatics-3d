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
  private onToggleImmersive?: () => void;
  private isLeftSidebarOpen = typeof window !== 'undefined' ? window.innerWidth >= 1024 : true;
  private isRightSidebarOpen = typeof window !== 'undefined' ? window.innerWidth >= 1024 : true;
  private isImmersive = false;
  private currentMode: EngineMode = 'music';
  private isLabsMenuOpen = false;
  private documentClickHandler?: (e: MouseEvent) => void;
  private documentKeydownHandler?: (e: KeyboardEvent) => void;
  private windowResizeHandler?: () => void;
  private windowScrollHandler?: () => void;

  constructor(
    private audioEngine: AudioEngine,
    private visualizer: VisualizerEngine,
    onModeChange: (mode: EngineMode) => void,
    onStartTour?: () => void,
    _onExportDossier?: () => void,
    onToggleLeftSidebar?: () => void,
    onToggleRightSidebar?: () => void,
    onResetScene?: () => void,
    onToggleImmersive?: () => void
  ) {
    this.element = document.getElementById('header-root') as HTMLElement;
    this.onModeChange = onModeChange;
    this.onStartTour = onStartTour;
    this.onToggleLeftSidebar = onToggleLeftSidebar;
    this.onToggleRightSidebar = onToggleRightSidebar;
    this.onResetScene = onResetScene;
    this.onToggleImmersive = onToggleImmersive;
    this.render();
  }

  public setSidebarStates(leftOpen: boolean, rightOpen: boolean): void {
    this.isLeftSidebarOpen = leftOpen;
    this.isRightSidebarOpen = rightOpen;
  }

  public setImmersive(active: boolean): void {
    if (this.isImmersive === active) return;
    this.isImmersive = active;
    this.render();
  }

  public getIsImmersive(): boolean {
    return this.isImmersive;
  }

  public render(): void {
    const isMusic = this.currentMode === 'music' || this.currentMode === 'cymatics';
    const isFreq = this.currentMode === 'frequency' || this.currentMode === 'modal';
    const isTherapy = this.currentMode === 'therapy';
    const isNobel = this.currentMode === 'nobel';
    const isBio = this.currentMode === 'bio';
    const isVoice = this.currentMode === 'voice';
    const isLabs = isTherapy || isVoice || isNobel || isBio;

    this.element.innerHTML = `
      <div class="relative w-full flex flex-col md:flex-row md:items-center justify-between gap-2 md:gap-4 select-none min-h-[44px]">
        
        <!-- Left: Brand Cluster -->
        <div class="flex items-center justify-between w-full md:w-auto gap-2 shrink-0 z-10">
          <div class="flex items-center gap-2 md:gap-2.5 shrink-0">
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
            <button class="btn-header-reset-mobile p-1.5 rounded-xl text-xs font-semibold glass-btn text-slate-300 border border-white/10 hover:text-white active:scale-95 flex items-center justify-center gap-1 cursor-pointer min-w-[36px] min-h-[36px]" aria-label="Reset active studio to defaults" title="Reset active studio to defaults">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                <path d="M3 3v5h5"/>
              </svg>
            </button>
            <button class="btn-executive-tour px-2.5 py-1 rounded-xl text-xs font-semibold bg-amber-400/15 text-amber-300 border border-amber-400/30 flex items-center justify-center gap-1 cursor-pointer min-h-[36px]" aria-label="Start guided keynote tour">
              <span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
              <span>Tour</span>
            </button>
            <button id="btn-header-immersive-mobile" aria-label="${this.isImmersive ? 'Exit immersive view' : 'Enter immersive view'}" title="${this.isImmersive ? 'Exit immersive view' : 'Enter immersive view'}" class="glass-btn p-1.5 rounded-xl text-xs font-semibold cursor-pointer active:scale-95 transition-all flex items-center justify-center min-w-[36px] min-h-[36px] ${
              this.isImmersive ? 'glass-btn-active text-cyan-300 border-cyan-400/30' : 'text-slate-300'
            }">
              <svg class="w-4 h-4 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- Center: 3 Studio Modes Segmented Switcher Capsule -->
        <nav role="tablist" aria-label="Studio Navigation Modes" class="segmented-track overflow-visible relative md:absolute md:left-1/2 md:-translate-x-1/2 md:top-1/2 md:-translate-y-1/2 mx-auto md:mx-0 max-w-full flex-nowrap shrink-0 shadow-lg z-20">
          <button
            id="btn-mode-music"
            role="tab"
            aria-selected="${isMusic}"
            title="Music Studio: Curated tracks, audio file upload, live mic & cymatics"
            class="segmented-pill flex items-center justify-center gap-1.5 shrink-0 ${isMusic ? 'is-active glass-btn-active' : ''}"
          >
            <span>Music Studio</span>
          </button>
          <button
            id="btn-mode-freq"
            role="tab"
            aria-selected="${isFreq}"
            title="Frequencies: Pure tone synthesis, Solfeggio matrix, harmonic overtones & binaural beats"
            class="segmented-pill flex items-center justify-center gap-1.5 shrink-0 ${isFreq ? 'is-active glass-btn-active' : ''}"
          >
            <span>Frequencies</span>
          </button>
          <!-- Labs Dropdown Trigger Capsule -->
          <div class="relative shrink-0" id="labs-menu-wrapper">
            <button
              id="btn-mode-labs"
              type="button"
              role="button"
              aria-haspopup="menu"
              aria-expanded="${this.isLabsMenuOpen}"
              aria-controls="labs-dropdown-menu"
              title="${
                isTherapy
                  ? 'Labs: Sound Therapy active (Click to switch)'
                  : isVoice
                  ? 'Labs: Voice Studio active (Click to switch)'
                  : isNobel
                  ? 'Labs: Nobel Frontiers active (Click to switch)'
                  : isBio
                  ? 'Labs: Bio-Acoustics active (Click to switch)'
                  : 'Labs: Sound Therapy, Voice, Nobel & Bio-Acoustics'
              }"
              class="segmented-pill flex items-center justify-center gap-1.5 shrink-0 ${
                isLabs ? 'is-active glass-btn-active' : ''
              }"
            >
              ${
                isLabs
                  ? '<span class="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.9)] animate-pulse"></span>'
                  : ''
              }
              <span class="font-semibold">Labs</span>
              <svg class="labs-chevron w-3 h-3 text-slate-400 transition-transform duration-150 ${
                isLabs ? 'text-cyan-300' : ''
              } ${this.isLabsMenuOpen ? 'rotate-180' : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="m6 9 6 6 6-6"/>
              </svg>
            </button>

            <!-- Dropdown Menu -->
            <div
              id="labs-dropdown-menu"
              role="menu"
              aria-label="Experimental Labs"
              class="${this.isLabsMenuOpen ? 'flex' : 'hidden'} flex-col absolute right-0 top-full mt-2 p-2 bg-slate-950/95 backdrop-blur-2xl border border-white/15 rounded-2xl shadow-2xl shadow-black/90 min-w-[264px] z-50"
            >
              <div class="px-2 py-1 mb-1 border-b border-white/10 flex items-center justify-between">
                <span class="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Experimental Labs</span>
                <span class="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-slate-400 border border-white/10">4 Modes</span>
              </div>

              <!-- Sound Therapy Item -->
              <button
                id="btn-mode-therapy"
                role="menuitem"
                aria-selected="${isTherapy}"
                title="Sound Therapy: Targeted ultrasound resonance, anti-phase wave cancellation & oncology"
                class="w-full text-left px-3 py-2 rounded-lg flex items-start gap-2 transition-all duration-150 active:scale-95 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none cursor-pointer ${
                  isTherapy
                    ? 'bg-cyan-500/15 border border-cyan-400/30 text-cyan-300'
                    : 'text-slate-300 hover:text-white hover:bg-white/10 border border-transparent'
                }"
              >
                <div class="w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                  isTherapy ? 'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]' : 'bg-slate-600'
                }"></div>
                <div class="flex flex-col">
                  <div class="flex items-center gap-1.5">
                    <span class="text-xs font-semibold leading-snug">Sound Therapy</span>
                    ${
                      isTherapy
                        ? '<span class="text-[9px] font-medium px-1.5 py-0.2 rounded bg-cyan-400/20 text-cyan-200 border border-cyan-400/30">Active</span>'
                        : ''
                    }
                  </div>
                  <span class="text-[10px] text-slate-400 font-medium leading-tight mt-0.5">Ultrasound resonance & wave cancellation</span>
                </div>
              </button>

              <!-- Voice Studio Item -->
              <button
                id="btn-mode-voice"
                role="menuitem"
                aria-selected="${isVoice}"
                title="Voice Studio: Live microphone pitch tracking, vocal tract manifold & sound medicine"
                class="w-full text-left px-3 py-2 mt-1 rounded-lg flex items-start gap-2 transition-all duration-150 active:scale-95 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none cursor-pointer ${
                  isVoice
                    ? 'bg-cyan-500/15 border border-cyan-400/30 text-cyan-300'
                    : 'text-slate-300 hover:text-white hover:bg-white/10 border border-transparent'
                }"
              >
                <div class="w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                  isVoice ? 'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]' : 'bg-slate-600'
                }"></div>
                <div class="flex flex-col">
                  <div class="flex items-center gap-1.5">
                    <span class="text-xs font-semibold leading-snug">Voice Studio</span>
                    ${
                      isVoice
                        ? '<span class="text-[9px] font-medium px-1.5 py-0.2 rounded bg-cyan-400/20 text-cyan-200 border border-cyan-400/30">Active</span>'
                        : ''
                    }
                  </div>
                  <span class="text-[10px] text-slate-400 font-medium leading-tight mt-0.5">Live mic pitch & vocal tract manifold</span>
                </div>
              </button>

              <!-- Nobel Frontiers Item -->
              <button
                id="btn-mode-nobel"
                role="menuitem"
                aria-selected="${isNobel}"
                title="Nobel Frontiers: Frontier biophysics, mechanogenomics, BBB dilation & viral shatter"
                class="w-full text-left px-3 py-2 mt-1 rounded-lg flex items-start gap-2 transition-all duration-150 active:scale-95 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none cursor-pointer ${
                  isNobel
                    ? 'bg-cyan-500/15 border border-cyan-400/30 text-cyan-300'
                    : 'text-slate-300 hover:text-white hover:bg-white/10 border border-transparent'
                }"
              >
                <div class="w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                  isNobel ? 'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]' : 'bg-slate-600'
                }"></div>
                <div class="flex flex-col">
                  <div class="flex items-center gap-1.5">
                    <span class="text-xs font-semibold leading-snug">Nobel Frontiers</span>
                    ${
                      isNobel
                        ? '<span class="text-[9px] font-medium px-1.5 py-0.2 rounded bg-cyan-400/20 text-cyan-200 border border-cyan-400/30">Active</span>'
                        : ''
                    }
                  </div>
                  <span class="text-[10px] text-slate-400 font-medium leading-tight mt-0.5">Biophysics, BBB dilation & viral shatter</span>
                </div>
              </button>

              <!-- Bio-Acoustics Item -->
              <button
                id="btn-mode-bio"
                role="menuitem"
                aria-selected="${isBio}"
                title="Bio-Acoustics: Single cell elasticity spectroscopy & microfluidic sorting"
                class="w-full text-left px-3 py-2 mt-1 rounded-lg flex items-start gap-2 transition-all duration-150 active:scale-95 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none cursor-pointer ${
                  isBio
                    ? 'bg-cyan-500/15 border border-cyan-400/30 text-cyan-300'
                    : 'text-slate-300 hover:text-white hover:bg-white/10 border border-transparent'
                }"
              >
                <div class="w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                  isBio ? 'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]' : 'bg-slate-600'
                }"></div>
                <div class="flex flex-col">
                  <div class="flex items-center gap-1.5">
                    <span class="text-xs font-semibold leading-snug">Bio-Acoustics</span>
                    ${
                      isBio
                        ? '<span class="text-[9px] font-medium px-1.5 py-0.2 rounded bg-cyan-400/20 text-cyan-200 border border-cyan-400/30">Active</span>'
                        : ''
                    }
                  </div>
                  <span class="text-[10px] text-slate-400 font-medium leading-tight mt-0.5">Single-cell elasticity & sorting</span>
                </div>
              </button>
            </div>
          </div>
        </nav>

        <!-- Right: Reset, Guided Tour & Optics/Telemetry Sidebar Toggle -->
        <div class="hidden md:flex items-center gap-2 shrink-0 ml-auto z-10 min-h-[44px]">
          <!-- Reset Action -->
          <button id="btn-header-reset" aria-label="Reset active studio to defaults" title="Reset active studio to defaults" class="glass-btn px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white border border-white/10 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0 min-h-[36px]">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
              <path d="M3 3v5h5"/>
            </svg>
            <span class="hidden xl:inline text-[11px] font-medium">Reset</span>
          </button>

          <!-- Keynote Tour Action -->
          <button title="Start guided tour" aria-label="Start guided tour" class="btn-executive-tour px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-400/15 text-amber-300 border border-amber-400/30 hover:bg-amber-400/25 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0 min-h-[36px]">
            <span class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
            <span class="font-medium hidden xl:inline">Keynote </span><span class="font-medium">Tour</span>
          </button>

          <!-- Physics Provenance Badge Slot -->
          <div id="header-provenance-slot" class="flex items-center"></div>

          <!-- Immersive Action -->
          <button
            id="btn-header-immersive"
            aria-label="${this.isImmersive ? 'Exit immersive view (I)' : 'Enter immersive full-screen view (I)'}"
            title="${this.isImmersive ? 'Exit immersive view (I)' : 'Enter immersive view (I)'}"
            class="glass-btn px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white border border-white/10 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0 min-h-[36px] ${
              this.isImmersive ? 'glass-btn-active text-cyan-300 border-cyan-400/30' : ''
            }"
          >
            <svg class="w-3.5 h-3.5 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
            </svg>
            <span class="text-[11px] font-medium hidden xl:inline">Immersive</span>
          </button>
        </div>
      </div>
    `;

    // Mount physics provenance badge into designated desktop header slot
    const provenanceSlot = this.element.querySelector('#header-provenance-slot');
    if (provenanceSlot && this.visualizer?.provenanceBadge?.element) {
      provenanceSlot.appendChild(this.visualizer.provenanceBadge.element);
    }

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

    // Immersive Mode Triggers (Mobile & Desktop)
    const toggleImmersive = () => {
      if (this.onToggleImmersive) {
        this.onToggleImmersive();
      } else {
        window.dispatchEvent(new CustomEvent('soundform-immersive-toggle'));
      }
    };
    document.getElementById('btn-header-immersive')?.addEventListener('click', toggleImmersive);
    document.getElementById('btn-header-immersive-mobile')?.addEventListener('click', toggleImmersive);

    // Left & Right Sidebar Toggle Triggers (backward compatibility fallback)
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
      this.toggleLabsMenu(false);
      this.onModeChange('music');
    });

    document.getElementById('btn-mode-freq')?.addEventListener('click', () => {
      this.toggleLabsMenu(false);
      this.onModeChange('frequency');
    });

    document.getElementById('btn-mode-therapy')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleLabsMenu(false);
      this.onModeChange('therapy');
    });

    document.getElementById('btn-mode-voice')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleLabsMenu(false);
      this.onModeChange('voice');
    });

    // Labs Dropdown Trigger
    document.getElementById('btn-mode-labs')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleLabsMenu();
    });

    document.getElementById('btn-mode-bio')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleLabsMenu(false);
      this.onModeChange('bio');
    });

    document.getElementById('btn-mode-nobel')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleLabsMenu(false);
      this.onModeChange('nobel');
    });

    // Outside Click & Escape Handlers
    if (this.documentClickHandler) {
      document.removeEventListener('click', this.documentClickHandler);
    }
    if (this.documentKeydownHandler) {
      document.removeEventListener('keydown', this.documentKeydownHandler);
    }
    if (this.windowResizeHandler) {
      window.removeEventListener('resize', this.windowResizeHandler);
    }

    this.documentClickHandler = (e: MouseEvent) => {
      if (!this.isLabsMenuOpen) return;
      const target = e.target as Node | null;
      const wrapper = document.getElementById('labs-menu-wrapper');
      if (wrapper && !wrapper.contains(target)) {
        this.toggleLabsMenu(false);
      }
    };

    this.documentKeydownHandler = (e: KeyboardEvent) => {
      if (!this.isLabsMenuOpen) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        this.toggleLabsMenu(false);
        const trigger = document.getElementById('btn-mode-labs');
        trigger?.focus();
      }
    };

    this.windowResizeHandler = () => {
      if (this.isLabsMenuOpen) {
        this.toggleLabsMenu(false);
      }
    };

    document.addEventListener('click', this.documentClickHandler);
    document.addEventListener('keydown', this.documentKeydownHandler);
    window.addEventListener('resize', this.windowResizeHandler);
  }

  public toggleLabsMenu(forceState?: boolean): void {
    const nextState = typeof forceState === 'boolean' ? forceState : !this.isLabsMenuOpen;
    this.isLabsMenuOpen = nextState;

    const triggerBtn = document.getElementById('btn-mode-labs');
    const menuEl = document.getElementById('labs-dropdown-menu');
    const chevronIcon = triggerBtn?.querySelector('.labs-chevron');

    if (!triggerBtn || !menuEl) return;

    triggerBtn.setAttribute('aria-expanded', String(this.isLabsMenuOpen));

    if (this.isLabsMenuOpen) {
      menuEl.classList.remove('hidden');
      menuEl.classList.add('flex');
      chevronIcon?.classList.add('rotate-180');
    } else {
      menuEl.classList.add('hidden');
      menuEl.classList.remove('flex');
      chevronIcon?.classList.remove('rotate-180');
    }
  }

  public setMode(mode: EngineMode): void {
    const normalized = mode === 'cymatics' ? 'music' : mode === 'modal' ? 'frequency' : mode;
    if (this.currentMode === normalized) return;
    this.currentMode = normalized;
    this.isLabsMenuOpen = false;
    this.render();
  }

  public destroy(): void {
    if (this.documentClickHandler) {
      document.removeEventListener('click', this.documentClickHandler);
    }
    if (this.documentKeydownHandler) {
      document.removeEventListener('keydown', this.documentKeydownHandler);
    }
    if (this.windowResizeHandler) {
      window.removeEventListener('resize', this.windowResizeHandler);
    }
  }
}
