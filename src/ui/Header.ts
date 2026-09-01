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

        <!-- Mode Toggle Pill -->
        <div class="glass-panel p-1 rounded-2xl flex items-center gap-1 overflow-x-auto no-scrollbar max-w-full flex-nowrap shrink-0 shadow-lg border border-white/10">
          <button id="btn-mode-music" title="Real-time 3D audio visualizer" class="px-2.5 md:px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer ${
            this.currentMode === 'music' ? 'glass-btn-active font-bold text-white shadow-md' : 'text-gray-300 hover:text-white hover:bg-white/5'
          }">
            <span>🎵</span>
            <span>Music Space</span>
          </button>
          <button id="btn-mode-modal" title="3D cavity modes, standing waves & acoustic levitation" class="px-2.5 md:px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer ${
            this.currentMode === 'modal' ? 'glass-btn-active font-bold text-white shadow-md' : 'text-gray-300 hover:text-white hover:bg-white/5'
          }">
            <span>💎</span>
            <span>3D Cymatics</span>
          </button>
          <button id="btn-mode-therapy" title="Targeted oncotripsy, 180° anti-phase destructive shielding & oncology" class="px-2.5 md:px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer ${
            this.currentMode === 'therapy' ? 'glass-btn-active font-bold text-rose-300 shadow-md ring-1 ring-rose-500/40' : 'text-gray-300 hover:text-white hover:bg-white/5'
          }">
            <span>🎯</span>
            <span>Cancer Lab</span>
          </button>
          <button id="btn-mode-nobel" title="Nobel biophysics: Mechanogenomics, BBB opening, viral shatter & senolytics" class="px-2.5 md:px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer ${
            this.currentMode === 'nobel' ? 'glass-btn-active font-bold text-amber-300 shadow-md ring-1 ring-amber-500/40' : 'text-gray-300 hover:text-white hover:bg-white/5'
          }">
            <span>🏆</span>
            <span>Nobel Frontiers</span>
          </button>
          <button id="btn-mode-bio" title="Cellular elasticity spectroscopy & microfluidic sorting" class="px-2.5 md:px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer ${
            this.currentMode === 'bio' ? 'glass-btn-active font-bold text-emerald-300 shadow-md ring-1 ring-emerald-500/40' : 'text-gray-300 hover:text-white hover:bg-white/5'
          }">
            <span>🧬</span>
            <span>Bio-Acoustics</span>
          </button>
          <button id="btn-mode-voice" title="Live microphone pitch tracking, vocal tract & sound medicine" class="px-2.5 md:px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer ${
            this.currentMode === 'voice' ? 'glass-btn-active font-bold text-cyan-300 shadow-md ring-1 ring-cyan-500/40' : 'text-gray-300 hover:text-white hover:bg-white/5'
          }">
            <span>🗣️</span>
            <span>Voice Studio</span>
          </button>
          <button id="btn-mode-freq" title="Pure frequency synthesizer, Solfeggio presets & overtones" class="px-2.5 md:px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer ${
            this.currentMode === 'frequency' ? 'glass-btn-active font-bold text-blue-300 shadow-md ring-1 ring-blue-500/40' : 'text-gray-300 hover:text-white hover:bg-white/5'
          }">
            <span>⚡</span>
            <span>Tone Lab</span>
          </button>
        </div>

        <!-- Desktop-Only Right Controls -->
        <div class="hidden md:flex items-center gap-2 shrink-0">
          <!-- Visual Style Dropdown / Selector -->
          <div class="glass-panel p-1 rounded-xl hidden xl:flex items-center gap-1 shadow-lg border border-white/10">
            ${[
              { id: 'hybrid', label: 'Cosmos' },
              { id: 'wavefront', label: 'Waves' },
              { id: 'cymatics', label: 'Cymatics' },
              { id: 'particles', label: 'Dust' },
              { id: 'ribbon', label: 'Ribbon' },
            ]
              .map(
                s => `
              <button data-style="${s.id}" class="btn-style px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  this.visualizer.getStyle() === s.id ? 'glass-btn-active font-bold shadow-sm' : 'text-gray-300 hover:text-white'
                }">
                ${s.label}
              </button>
            `
              )
              .join('')}
          </div>

          <!-- Tour & Data Export Actions -->
          <button title="Start guided tour" class="btn-executive-tour px-2.5 py-1.5 md:px-3 md:py-1.5 rounded-xl text-xs font-semibold bg-amber-400/15 text-amber-300 border border-amber-400/30 hover:bg-amber-400/25 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer shrink-0">
            <span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            <span>Keynote Tour</span>
          </button>

          <button id="btn-export-dossier" title="Export simulation data (JSON/Markdown)" class="px-2.5 py-1.5 md:px-3 md:py-1.5 rounded-xl text-xs font-semibold bg-slate-900 text-cyan-200 border border-cyan-500/40 hover:text-white hover:border-cyan-400 shadow-sm hidden lg:flex items-center gap-1.5 transition-all cursor-pointer shrink-0 active:scale-95">
            <span>Export Data</span>
          </button>

          <!-- Color Theme Picker -->
          <select id="theme-selector" class="h-9 px-3 py-1 rounded-xl text-xs font-semibold text-gray-200 bg-slate-900 border border-white/15 hover:border-cyan-400/50 shadow-sm outline-none cursor-pointer">
            ${palettes
              .map(
                p => `
              <option value="${p.id}" class="bg-slate-900 text-gray-100" ${p.id === this.currentPaletteId ? 'selected' : ''}>${p.name}</option>
            `
              )
              .join('')}
          </select>

          <!-- Screenshot Button -->
          <button title="Save screenshot (PNG)" class="btn-screenshot glass-btn p-2 rounded-xl text-gray-300 hover:text-white cursor-pointer">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
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
    if (this.currentMode === mode) return;
    this.currentMode = mode;
    this.render();
  }
}

