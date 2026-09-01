import { AudioEngine } from '../audio/AudioEngine';
import { VisualizerEngine, VisualStyle } from '../visualizer/VisualizerEngine';
import { ColorPalettes } from '../visualizer/ColorPalettes';

export type EngineMode = 'modal' | 'frequency' | 'music';

export class Header {
  private element: HTMLElement;
  private onModeChange: (mode: EngineMode) => void;
  private currentMode: EngineMode = 'modal';

  constructor(
    private audioEngine: AudioEngine,
    private visualizer: VisualizerEngine,
    onModeChange: (mode: EngineMode) => void
  ) {
    this.element = document.getElementById('header-root') as HTMLElement;
    this.onModeChange = onModeChange;
    this.render();
  }

  public render(): void {
    const palettes = Object.values(ColorPalettes.PALETTES);

    this.element.innerHTML = `
      <!-- Brand & Mode Switcher -->
      <div class="flex flex-wrap items-center gap-3 md:gap-6">
        <div class="flex items-center gap-2.5">
          <div class="w-9 h-9 rounded-xl bg-gradient-to-tr from-accent-cyan via-accent-blue to-accent-purple flex items-center justify-center shadow-lg shadow-accent-cyan/20 emitter-glow">
            <svg class="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M2 12h2a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H2v-8z"/>
              <path d="M22 12h-2a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h2v-8z"/>
              <path d="M6 12a6 6 0 0 1 12 0"/>
              <path d="M2 12a10 10 0 0 1 20 0"/>
            </svg>
          </div>
          <div>
            <h1 class="text-base md:text-lg font-bold tracking-tight bg-gradient-to-r from-white via-cyan-100 to-cyan-300 bg-clip-text text-transparent">
              SoundForm 3D
            </h1>
            <p class="text-[11px] text-gray-400 font-medium">3D Cymatics & Acoustic Wave Engine</p>
          </div>
        </div>

        <!-- Mode Toggle Pill -->
        <div class="glass-panel p-1 rounded-2xl flex items-center gap-1 overflow-x-auto max-w-full">
          <button id="btn-mode-modal" class="px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
            this.currentMode === 'modal' ? 'glass-btn-active' : 'text-gray-400 hover:text-white'
          }">
            <span>💎</span>
            <span>3D Cymatics Lab</span>
          </button>
          <button id="btn-mode-freq" class="px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
            this.currentMode === 'frequency' ? 'glass-btn-active' : 'text-gray-400 hover:text-white'
          }">
            <span>🔬</span>
            <span>Frequency Lab</span>
          </button>
          <button id="btn-mode-music" class="px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
            this.currentMode === 'music' ? 'glass-btn-active' : 'text-gray-400 hover:text-white'
          }">
            <span>🎵</span>
            <span>Music Space</span>
          </button>
        </div>
      </div>

      <!-- Right Controls: Visual Styles, Themes, Snapshot, Physics Drawer -->
      <div class="flex items-center gap-2">
        <!-- Visual Style Selector -->
        <div class="glass-panel p-1 rounded-xl hidden sm:flex items-center gap-1">
          ${[
            { id: 'cymatics', label: '💎 Cymatics' },
            { id: 'wavefront', label: '🌊 Waves' },
            { id: 'particles', label: '✨ Dust' },
            { id: 'ribbon', label: '🌀 Ribbon' },
            { id: 'hybrid', label: '🔮 Cosmos' },
          ]
            .map(
              s => `
            <button data-style="${s.id}" class="btn-style px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                this.visualizer.getStyle() === s.id ? 'glass-btn-active' : 'text-gray-400 hover:text-gray-200'
              }">
              ${s.label}
            </button>
          `
            )
            .join('')}
        </div>

        <!-- Color Theme Picker -->
        <select id="theme-selector" class="glass-btn px-3 py-1.5 rounded-xl text-xs font-medium text-gray-200 bg-background/80 outline-none cursor-pointer">
          ${palettes
            .map(
              p => `
            <option value="${p.id}" ${p.id === 'cosmic-nebula' ? 'selected' : ''}>${p.name}</option>
          `
            )
            .join('')}
        </select>

        <!-- Screenshot Button -->
        <button id="btn-screenshot" title="Save 3D Snapshot (PNG)" class="glass-btn p-2 rounded-xl text-gray-300 hover:text-white">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
            <circle cx="12" cy="13" r="4"/>
          </svg>
        </button>

        <!-- Physics Drawer Toggle -->
        <button id="btn-toggle-physics" title="Acoustic Physics & Chamber Controls" class="glass-btn p-2 rounded-xl text-gray-300 hover:text-white">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="4" y1="21" x2="4" y2="14"/>
            <line x1="4" y1="10" x2="4" y2="3"/>
            <line x1="12" y1="21" x2="12" y2="12"/>
            <line x1="12" y1="8" x2="12" y2="3"/>
            <line x1="20" y1="21" x2="20" y2="16"/>
            <line x1="20" y1="12" x2="20" y2="3"/>
            <line x1="1" y1="14" x2="7" y2="14"/>
            <line x1="9" y1="8" x2="15" y2="8"/>
            <line x1="17" y1="16" x2="23" y2="16"/>
          </svg>
        </button>
      </div>
    `;

    this.attachEvents();
  }

  private attachEvents(): void {
    // Mode toggles
    document.getElementById('btn-mode-modal')?.addEventListener('click', () => {
      this.currentMode = 'modal';
      this.render();
      this.onModeChange('modal');
    });

    document.getElementById('btn-mode-freq')?.addEventListener('click', () => {
      this.currentMode = 'frequency';
      this.render();
      this.onModeChange('frequency');
    });

    document.getElementById('btn-mode-music')?.addEventListener('click', () => {
      this.currentMode = 'music';
      this.render();
      this.onModeChange('music');
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
      this.visualizer.setPalette(select.value);
    });

    // Snapshot button
    document.getElementById('btn-screenshot')?.addEventListener('click', () => {
      const dataUrl = this.visualizer.captureScreenshot();
      const link = document.createElement('a');
      link.download = `soundform-3d-cymatics-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
    });

    // Physics drawer toggle
    document.getElementById('btn-toggle-physics')?.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('toggle-physics-drawer'));
    });
  }

  public setMode(mode: EngineMode): void {
    this.currentMode = mode;
    this.render();
  }
}
