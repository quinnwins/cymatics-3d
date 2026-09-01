import { AudioEngine } from '../audio/AudioEngine';
import { VisualizerEngine, VisualStyle } from '../visualizer/VisualizerEngine';
import { ColorPalettes } from '../visualizer/ColorPalettes';

export type EngineMode = 'music' | 'frequency' | 'modal' | 'bio' | 'therapy' | 'voice' | 'nobel';

export class Header {
  private element: HTMLElement;
  private onModeChange: (mode: EngineMode) => void;
  private onStartTour?: () => void;
  private onExportDossier?: () => void;
  private onToggleLeftSidebar?: () => void;
  private onToggleRightSidebar?: () => void;
  private isLeftSidebarOpen = true;
  private isRightSidebarOpen = true;
  private currentMode: EngineMode = 'music';
  private currentPaletteId: string = 'cosmic-nebula';

  constructor(
    private audioEngine: AudioEngine,
    private visualizer: VisualizerEngine,
    onModeChange: (mode: EngineMode) => void,
    onStartTour?: () => void,
    onExportDossier?: () => void,
    onToggleLeftSidebar?: () => void,
    onToggleRightSidebar?: () => void
  ) {
    this.element = document.getElementById('header-root') as HTMLElement;
    this.onModeChange = onModeChange;
    this.onStartTour = onStartTour;
    this.onExportDossier = onExportDossier;
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
    const palettes = Object.values(ColorPalettes.PALETTES);

    this.element.innerHTML = `
      <div class="w-full flex flex-col md:flex-row md:items-center justify-between gap-2 md:gap-4">
        <!-- Top Row on Mobile / Left on Desktop: Brand & Left Sidebar Toggle -->
        <div class="flex items-center justify-between w-full md:w-auto gap-2">
          <div class="flex items-center gap-2 md:gap-2.5 shrink-0">
            <!-- Left Sidebar Toggle Button -->
            <button
              id="btn-toggle-left-sidebar"
              title="${this.isLeftSidebarOpen ? 'Collapse Controls Sidebar (Left)' : 'Expand Controls Sidebar (Left)'}"
              class="glass-btn p-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                this.isLeftSidebarOpen ? 'glass-btn-active text-cyan-300' : 'text-gray-400 hover:text-white'
              }"
            >
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <line x1="9" y1="3" x2="9" y2="21"/>
              </svg>
              <span class="hidden sm:inline text-[11px]">Controls</span>
            </button>

            <div class="w-8 h-8 md:w-9 md:h-9 rounded-xl bg-gradient-to-tr from-accent-cyan via-accent-blue to-accent-purple flex items-center justify-center shadow-lg shadow-accent-cyan/20 emitter-glow shrink-0">
              <svg class="w-4 h-4 md:w-5 md:h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M2 12h2a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H2v-8z"/>
                <path d="M22 12h-2a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h2v-8z"/>
                <path d="M6 12a6 6 0 0 1 12 0"/>
                <path d="M2 12a10 10 0 0 1 20 0"/>
              </svg>
            </div>
            <div class="drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
              <h1 class="inline-block text-sm md:text-base font-bold tracking-tight bg-gradient-to-r from-white via-cyan-100 to-cyan-300 bg-clip-text text-transparent drop-shadow-sm leading-none">
                SoundForm 3D
              </h1>
              <p class="text-[9px] md:text-[10px] text-gray-300 font-medium drop-shadow-sm mt-0.5">3D Acoustic Spacetime & Resonance</p>
            </div>
          </div>

          <!-- Mobile-Only Quick Action Buttons -->
          <div class="flex items-center gap-1.5 md:hidden">
            <button class="btn-executive-tour px-2.5 py-1 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-400 to-yellow-300 text-black shadow-md flex items-center gap-1 cursor-pointer">
              <span>✨</span>
              <span>Tour</span>
            </button>
            <button id="btn-toggle-right-sidebar-mobile" class="glass-btn p-1.5 rounded-xl text-xs font-semibold ${
              this.isRightSidebarOpen ? 'glass-btn-active text-cyan-300' : 'text-gray-300'
            }">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <line x1="15" y1="3" x2="15" y2="21"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- Mode Toggle Pill with Smooth Touch Scroll -->
        <div class="glass-panel p-1 rounded-2xl flex items-center gap-1 overflow-x-auto no-scrollbar max-w-full flex-nowrap shrink-0 shadow-lg border border-white/10 backdrop-blur-xl">
          <button id="btn-mode-music" class="px-2.5 md:px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0 ${
            this.currentMode === 'music' ? 'glass-btn-active font-bold text-white shadow-md' : 'text-gray-300 hover:text-white hover:bg-white/5'
          }">
            <span>🎵</span>
            <span>Music Space</span>
          </button>
          <button id="btn-mode-freq" class="px-2.5 md:px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0 ${
            this.currentMode === 'frequency' ? 'glass-btn-active font-bold text-white shadow-md' : 'text-gray-300 hover:text-white hover:bg-white/5'
          }">
            <span>🔬</span>
            <span>Frequency Lab</span>
          </button>
          <button id="btn-mode-modal" class="px-2.5 md:px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0 ${
            this.currentMode === 'modal' ? 'glass-btn-active font-bold text-white shadow-md' : 'text-gray-300 hover:text-white hover:bg-white/5'
          }">
            <span>💎</span>
            <span>3D Cymatics</span>
          </button>
          <button id="btn-mode-bio" class="px-2.5 md:px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0 ${
            this.currentMode === 'bio' ? 'glass-btn-active font-bold text-white shadow-md' : 'text-gray-300 hover:text-white hover:bg-white/5'
          }">
            <span>🧬</span>
            <span>Bio-Acoustics</span>
          </button>
          <button id="btn-mode-therapy" class="px-2.5 md:px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0 ${
            this.currentMode === 'therapy' ? 'glass-btn-active font-bold text-white shadow-md' : 'text-gray-300 hover:text-white hover:bg-white/5'
          }">
            <span>🎯</span>
            <span>Cancer Therapy</span>
          </button>
          <button id="btn-mode-voice" class="px-2.5 md:px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0 ${
            this.currentMode === 'voice' ? 'glass-btn-active font-bold text-white shadow-md' : 'text-gray-300 hover:text-white hover:bg-white/5'
          }">
            <span>🗣️</span>
            <span>Voice Biometrics</span>
          </button>
          <button id="btn-mode-nobel" class="px-2.5 md:px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 ${
            this.currentMode === 'nobel' ? 'bg-gradient-to-r from-amber-400 to-yellow-300 text-black shadow-lg shadow-amber-400/30' : 'text-amber-300 hover:text-amber-200 hover:bg-amber-400/10'
          }">
            <span>🏆</span>
            <span>Nobel Lab</span>
          </button>
        </div>

        <!-- Desktop-Only Right Controls -->
        <div class="hidden md:flex items-center gap-2 shrink-0">
          <!-- Visual Style Dropdown / Selector -->
          <div class="glass-panel p-1 rounded-xl hidden xl:flex items-center gap-1 shadow-lg border border-white/10 backdrop-blur-xl">
            ${[
              { id: 'hybrid', label: '🔮 Cosmos' },
              { id: 'wavefront', label: '🌊 Waves' },
              { id: 'cymatics', label: '💎 Cymatics' },
              { id: 'particles', label: '✨ Dust' },
              { id: 'ribbon', label: '🌀 Ribbon' },
            ]
              .map(
                s => `
              <button data-style="${s.id}" class="btn-style px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  this.visualizer.getStyle() === s.id ? 'glass-btn-active font-bold text-white shadow-md' : 'text-gray-300 hover:text-white'
                }">
                ${s.label}
              </button>
            `
              )
              .join('')}
          </div>

          <!-- Executive Keynote Tour & Clinical Dossier Export Actions -->
          <button title="Launch Guided Nobel & Pharma Executive Presentation Tour" class="btn-executive-tour px-2.5 py-1.5 md:px-3 md:py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 text-black hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-amber-400/25 flex items-center gap-1.5 cursor-pointer shrink-0">
            <span>✨</span>
            <span>Executive Tour</span>
          </button>

          <button id="btn-export-dossier" title="Export FDA/CDISC Clinical Trial Protocol & Telemetry Dossier" class="px-2.5 py-1.5 md:px-3 md:py-1.5 rounded-xl text-xs font-semibold bg-slate-900/90 text-cyan-200 border border-cyan-500/40 hover:text-white hover:border-cyan-400/80 shadow-lg shadow-cyan-500/10 hidden lg:flex items-center gap-1.5 transition-all cursor-pointer shrink-0 active:scale-95">
            <span>📥</span>
            <span>Clinical Dossier</span>
          </button>

          <!-- Color Theme Picker -->
          <select id="theme-selector" class="h-9 px-3 py-1 rounded-xl text-xs font-semibold text-gray-200 bg-slate-900/95 border border-white/15 hover:border-cyan-400/50 shadow-lg outline-none cursor-pointer">
            ${palettes
              .map(
                p => `
              <option value="${p.id}" class="bg-slate-900 text-gray-100" ${p.id === this.currentPaletteId ? 'selected' : ''}>${p.name}</option>
            `
              )
              .join('')}
          </select>

          <!-- Screenshot Button -->
          <button title="Save 3D Snapshot (PNG)" class="btn-screenshot glass-btn p-2 rounded-xl text-gray-300 hover:text-white cursor-pointer">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
          </button>

          <!-- Right Sidebar (Telemetry & Physics) Toggle -->
          <button
            id="btn-toggle-right-sidebar"
            title="${this.isRightSidebarOpen ? 'Collapse Telemetry & Analysis Sidebar (Right)' : 'Expand Telemetry & Analysis Sidebar (Right)'}"
            class="glass-btn p-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              this.isRightSidebarOpen ? 'glass-btn-active text-cyan-300' : 'text-gray-400 hover:text-white'
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

    document.getElementById('btn-export-dossier')?.addEventListener('click', () => {
      if (this.onExportDossier) this.onExportDossier();
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

    // Style buttons
    document.querySelectorAll('.btn-style').forEach(btn => {
      btn.addEventListener('click', e => {
        const target = e.currentTarget as HTMLElement;
        const style = target.getAttribute('data-style') as VisualStyle;
        if (style) {
          this.visualizer.setStyle(style);
          this.render();
        }
      });
    });

    // Theme selector
    document.getElementById('theme-selector')?.addEventListener('change', e => {
      const select = e.target as HTMLSelectElement;
      this.currentPaletteId = select.value;
      this.visualizer.setPalette(select.value);
    });

    // Snapshot button (mobile & desktop)
    document.querySelectorAll('.btn-screenshot').forEach(btn => {
      btn.addEventListener('click', () => {
        const dataUrl = this.visualizer.captureScreenshot();
        const link = document.createElement('a');
        link.download = `soundform-3d-${Date.now()}.png`;
        link.href = dataUrl;
        link.click();
      });
    });
  }

  public setMode(mode: EngineMode): void {
    this.currentMode = mode;
    this.render();
  }
}

