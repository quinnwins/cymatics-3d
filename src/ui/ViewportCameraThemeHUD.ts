import { VisualizerEngine, CameraMode } from '../visualizer/VisualizerEngine';
import { ColorPalettes } from '../visualizer/ColorPalettes';
import { EngineMode } from './Header';

export class ViewportCameraThemeHUD {
  private element: HTMLElement;
  private currentMode: EngineMode = 'music';
  private currentPaletteId: string = 'cosmic-nebula';
  private isOpticsOpen = false;

  constructor(private visualizer: VisualizerEngine) {
    this.currentPaletteId =
      this.visualizer && typeof this.visualizer.getCurrentPaletteId === 'function'
        ? this.visualizer.getCurrentPaletteId()
        : 'cosmic-nebula';

    this.element = document.createElement('div');
    this.element.id = 'viewport-camera-theme-hud';
    this.element.className = 'relative flex flex-col items-end pointer-events-auto select-none';

    this.render();
    this.attachGlobalListeners();
  }

  public getElement(): HTMLElement {
    return this.element;
  }

  public setMode(mode: EngineMode): void {
    const normalized = mode === 'cymatics' ? 'music' : mode === 'modal' ? 'frequency' : mode;
    if (this.currentMode === normalized) return;
    this.currentMode = normalized;
    this.render();
  }

  public getMode(): EngineMode {
    return this.currentMode;
  }

  public setOpticsOpen(open: boolean): void {
    this.isOpticsOpen = open;
    this.render();
  }

  public getIsOpticsOpen(): boolean {
    return this.isOpticsOpen;
  }

  public syncState(): void {
    if (this.visualizer && typeof this.visualizer.getCurrentPaletteId === 'function') {
      this.currentPaletteId = this.visualizer.getCurrentPaletteId();
    }
    this.render();
  }

  public resetVisuals(): void {
    if (!this.visualizer) return;
    this.visualizer.waveSpeed = 6.0;
    this.visualizer.waveDamping = 0.12;
    this.visualizer.bloomStrength = 0.22;
    if (typeof this.visualizer.setBloomStrength === 'function') {
      this.visualizer.setBloomStrength(0.22);
    }
    this.visualizer.particleScale = 1.0;
    if (typeof this.visualizer.setParticleScale === 'function') {
      this.visualizer.setParticleScale(1.0);
    }
    this.visualizer.particleDensity = 131072;
    if (typeof this.visualizer.setParticleDensity === 'function') {
      this.visualizer.setParticleDensity(131072);
    }
    if (typeof this.visualizer.setPalette === 'function') {
      this.visualizer.setPalette('cosmic-nebula');
    }
    if (typeof this.visualizer.setCameraMode === 'function') {
      this.visualizer.setCameraMode('autocam');
    }
    if (typeof this.visualizer.setGroundGridVisible === 'function') {
      this.visualizer.setGroundGridVisible(false);
    }
    this.currentPaletteId = 'cosmic-nebula';

    window.dispatchEvent(new CustomEvent('camera-mode-changed', { detail: { mode: 'autocam' } }));
    window.dispatchEvent(new CustomEvent('palette-changed', { detail: { paletteId: 'cosmic-nebula' } }));
    window.dispatchEvent(new CustomEvent('optics-reset'));
    this.render();
  }

  public render(): void {
    const isMusicMode = this.currentMode === 'music' || this.currentMode === 'cymatics';
    const isCymaticsMode = this.currentMode === 'frequency' || this.currentMode === 'modal';
    const showPalettePicker = isMusicMode || isCymaticsMode;
    const showWaveControls = isMusicMode;
    const showParticleScale = isMusicMode || isCymaticsMode;
    const showParticleDensity = isMusicMode || isCymaticsMode;

    const palettes = Object.values(ColorPalettes.PALETTES);
    const activeCameraMode =
      this.visualizer && typeof this.visualizer.getCameraMode === 'function'
        ? this.visualizer.getCameraMode()
        : 'autocam';

    const cameraOptions: { id: CameraMode; label: string; icon: string; title: string }[] = [
      { id: 'autocam', label: 'Cinematic', icon: '🎬', title: 'Cinematic auto-rotating camera' },
      { id: 'orbit', label: 'Free Orbit', icon: '🌐', title: 'Free 360° mouse & touch orbit' },
      { id: 'emitter-lock', label: 'Focus Center', icon: '🎯', title: 'Lock focus on acoustic center' },
      { id: 'top-down', label: 'Top-Down', icon: '📐', title: 'Top-down orthogonal perspective' },
    ];

    let paletteHtml = '';
    if (showPalettePicker) {
      paletteHtml = `
        <!-- Theme Palette Dropdown -->
        <div class="flex items-center gap-1.5 shrink-0">
          <span class="text-xs" aria-hidden="true">🎨</span>
          <select
            id="viewport-theme-selector"
            aria-label="Visualizer Color Theme Palette"
            title="Switch color palette"
            class="h-7 px-2 rounded-xl text-[11px] font-semibold text-slate-200 bg-slate-900/80 border border-white/10 hover:border-cyan-400/50 shadow-sm outline-none cursor-pointer transition-colors"
          >
            ${palettes
              .map(
                p => `
              <option value="${p.id}" class="bg-slate-900 text-gray-100" ${p.id === this.currentPaletteId ? 'selected' : ''}>${p.name}</option>
            `
              )
              .join('')}
          </select>
        </div>

        <!-- Vertical Divider -->
        <div class="w-px h-4 bg-white/10 shrink-0" aria-hidden="true"></div>
      `;
    }

    // Calculations for slider filled gradients in popover
    const waveSpeedPct = Math.round(((this.visualizer.waveSpeed - 1.0) / 11.0) * 100);
    const dampingPct = Math.round(((this.visualizer.waveDamping - 0.02) / 0.33) * 100);
    const bloomPct = Math.round(((this.visualizer.bloomStrength - 0.05) / 0.95) * 100);
    const densityPct = Math.round(((this.visualizer.particleDensity - 16384) / (262144 - 16384)) * 100);
    const scalePct = Math.round(((this.visualizer.particleScale - 0.4) / 1.6) * 100);

    let opticsPopoverHtml = '';
    if (this.isOpticsOpen) {
      opticsPopoverHtml = `
        <!-- Floating Visual Optics & Tuning Flyout Popover -->
        <div id="hud-optics-popover" class="glass-panel absolute top-full right-0 mt-2 p-3 sm:p-3.5 rounded-2xl w-68 sm:w-76 flex flex-col gap-2.5 shadow-2xl border border-white/10 backdrop-blur-2xl z-40 transition-all duration-200">
          <div class="flex items-center justify-between pb-1.5 border-b border-white/10">
            <div class="flex items-center gap-1.5">
              <span class="text-xs">✨</span>
              <span class="text-xs font-bold text-slate-200 tracking-wide">Scene Optics & Visuals</span>
            </div>
            <button id="btn-close-hud-optics" class="text-slate-400 hover:text-white text-xs p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer" aria-label="Close optics flyout">✕</button>
          </div>

          <div class="flex flex-col gap-2 text-xs">
            ${
              showWaveControls
                ? `
            <!-- Wave Propagation Speed -->
            <div class="flex flex-col gap-0.5">
              <div class="flex justify-between text-slate-300 font-mono text-[10px]">
                <span>Wave Speed</span>
                <span id="hud-val-wave-speed" class="text-cyan-400 tabular-nums">${this.visualizer.waveSpeed.toFixed(1)}</span>
              </div>
              <input
                type="range"
                id="hud-slider-wave-speed"
                min="1.0"
                max="12.0"
                step="0.2"
                value="${this.visualizer.waveSpeed}"
                aria-label="Wave speed slider"
                style="background: linear-gradient(to right, #38bdf8 ${waveSpeedPct}%, rgba(255, 255, 255, 0.1) ${waveSpeedPct}%);"
                class="w-full min-w-0 cursor-pointer slider-cyan"
              />
            </div>

            <!-- Sound Absorption -->
            <div class="flex flex-col gap-0.5">
              <div class="flex justify-between text-slate-300 font-mono text-[10px]">
                <span>Sound Absorption</span>
                <span id="hud-val-wave-damping" class="text-cyan-400 tabular-nums">${this.visualizer.waveDamping.toFixed(2)}</span>
              </div>
              <input
                type="range"
                id="hud-slider-wave-damping"
                min="0.02"
                max="0.35"
                step="0.01"
                value="${this.visualizer.waveDamping}"
                aria-label="Sound absorption slider"
                style="background: linear-gradient(to right, #38bdf8 ${dampingPct}%, rgba(255, 255, 255, 0.1) ${dampingPct}%);"
                class="w-full min-w-0 cursor-pointer slider-cyan"
              />
            </div>
            `
                : ''
            }

            <!-- Glow Brightness (Bloom) -->
            <div class="flex flex-col gap-0.5">
              <div class="flex justify-between text-slate-300 font-mono text-[10px]">
                <span>Glow Brightness</span>
                <span id="hud-val-bloom" class="text-cyan-400 tabular-nums">${this.visualizer.bloomStrength.toFixed(2)}</span>
              </div>
              <input
                type="range"
                id="hud-slider-bloom"
                min="0.05"
                max="1.0"
                step="0.05"
                value="${this.visualizer.bloomStrength}"
                aria-label="Glow brightness slider"
                style="background: linear-gradient(to right, #38bdf8 ${bloomPct}%, rgba(255, 255, 255, 0.1) ${bloomPct}%);"
                class="w-full min-w-0 cursor-pointer slider-cyan"
              />
            </div>

            ${
              showParticleDensity
                ? `
            <!-- Particle Density -->
            <div class="flex flex-col gap-0.5">
              <div class="flex justify-between text-slate-300 font-mono text-[10px]">
                <span>Particle Density</span>
                <span id="hud-val-particle-density" class="text-cyan-400 tabular-nums">${Math.round(this.visualizer.particleDensity / 1024)}k</span>
              </div>
              <input
                type="range"
                id="hud-slider-particle-density"
                min="16384"
                max="262144"
                step="16384"
                value="${this.visualizer.particleDensity}"
                aria-label="Particle density slider"
                style="background: linear-gradient(to right, #38bdf8 ${densityPct}%, rgba(255, 255, 255, 0.1) ${densityPct}%);"
                class="w-full min-w-0 cursor-pointer slider-cyan"
              />
            </div>
            `
                : ''
            }

            ${
              showParticleScale
                ? `
            <!-- Particle Size -->
            <div class="flex flex-col gap-0.5">
              <div class="flex justify-between text-slate-300 font-mono text-[10px]">
                <span>Particle Size</span>
                <span id="hud-val-particle-scale" class="text-cyan-400 tabular-nums">${this.visualizer.particleScale.toFixed(1)}×</span>
              </div>
              <input
                type="range"
                id="hud-slider-particle-scale"
                min="0.4"
                max="2.0"
                step="0.1"
                value="${this.visualizer.particleScale}"
                aria-label="Particle size slider"
                style="background: linear-gradient(to right, #38bdf8 ${scalePct}%, rgba(255, 255, 255, 0.1) ${scalePct}%);"
                class="w-full min-w-0 cursor-pointer slider-cyan"
              />
            </div>
            `
                : ''
            }

            <!-- Floor Grid Toggle -->
            <div class="flex items-center justify-between pt-1 border-t border-white/5">
              <span class="text-[10px] text-slate-300 font-medium">Floor Grid</span>
              <button
                id="hud-btn-toggle-grid"
                role="switch"
                aria-checked="${this.visualizer.getGroundGridVisible && this.visualizer.getGroundGridVisible()}"
                class="px-2 py-0.5 rounded-lg text-[10px] font-semibold transition-all cursor-pointer ${
                  this.visualizer.getGroundGridVisible && this.visualizer.getGroundGridVisible()
                    ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-400/60 font-bold'
                    : 'bg-slate-900/80 text-slate-400 hover:text-white border border-white/10'
                }"
              >
                <span>${this.visualizer.getGroundGridVisible && this.visualizer.getGroundGridVisible() ? '✓ On' : 'Off'}</span>
              </button>
            </div>

            <!-- Reset Action -->
            <div class="flex items-center justify-between pt-1 border-t border-white/10 mt-0.5">
              <span class="text-[10px] text-slate-400">Restore factory optics</span>
              <button id="hud-btn-reset-visuals" title="Reset all visual settings to defaults" class="glass-btn px-2 py-1 rounded-xl text-[10px] font-semibold text-slate-300 hover:text-white flex items-center gap-1 cursor-pointer transition-all active:scale-95">
                <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                <span>Reset</span>
              </button>
            </div>
          </div>
        </div>
      `;
    }

    this.element.innerHTML = `
      <!-- Main Capsule Pill -->
      <div class="glass-panel px-2 py-1.5 sm:px-2.5 sm:py-1.5 rounded-2xl flex items-center gap-2 shadow-2xl border border-white/10 backdrop-blur-2xl transition-all duration-300 max-w-full overflow-x-auto no-scrollbar">
        ${paletteHtml}

        <!-- Camera Perspective Dropdown -->
        <div class="flex items-center gap-1.5 shrink-0">
          <span class="text-xs" aria-hidden="true">🎥</span>
          <select
            id="viewport-camera-selector"
            aria-label="Camera Perspective Mode"
            title="Switch camera viewport perspective"
            class="h-7 px-2 rounded-xl text-[11px] font-semibold text-slate-200 bg-slate-900/80 border border-white/10 hover:border-cyan-400/50 shadow-sm outline-none cursor-pointer transition-colors"
          >
            ${cameraOptions
              .map(
                cam => `
              <option value="${cam.id}" class="bg-slate-900 text-gray-100" ${cam.id === activeCameraMode ? 'selected' : ''}>${cam.icon} ${cam.label}</option>
            `
              )
              .join('')}
          </select>
        </div>

        <!-- Vertical Divider -->
        <div class="w-px h-4 bg-white/10 shrink-0" aria-hidden="true"></div>

        <!-- ✨ Optics & Visuals Flyout Trigger Button -->
        <button
          id="btn-toggle-hud-optics"
          title="Adjust visual optics, glow & particle fidelity"
          aria-label="Toggle visual optics flyout"
          class="glass-btn px-2.5 py-1 rounded-xl text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
            this.isOpticsOpen ? 'glass-btn-active font-bold text-cyan-300' : 'text-slate-300 hover:text-white'
          }"
        >
          <span>✨ Optics</span>
          <span class="text-[9px] font-mono opacity-80">${this.isOpticsOpen ? '▲' : '▼'}</span>
        </button>
      </div>

      ${opticsPopoverHtml}
    `;

    this.attachEvents();
  }

  private attachEvents(): void {
    // Theme Palette Selector Event
    const themeSelect = this.element.querySelector('#viewport-theme-selector') as HTMLSelectElement;
    if (themeSelect) {
      themeSelect.addEventListener('change', e => {
        const target = e.target as HTMLSelectElement;
        this.currentPaletteId = target.value;
        if (this.visualizer && typeof this.visualizer.setPalette === 'function') {
          this.visualizer.setPalette(target.value);
        }
        window.dispatchEvent(
          new CustomEvent('palette-changed', {
            detail: { paletteId: target.value },
          })
        );
      });
    }

    // Camera Mode Dropdown Event
    const cameraSelect = this.element.querySelector('#viewport-camera-selector') as HTMLSelectElement;
    if (cameraSelect) {
      cameraSelect.addEventListener('change', e => {
        const target = (e.target as HTMLSelectElement).value as CameraMode;
        if (target && this.visualizer && typeof this.visualizer.setCameraMode === 'function') {
          this.visualizer.setCameraMode(target);
          window.dispatchEvent(
            new CustomEvent('camera-mode-changed', {
              detail: { mode: target },
            })
          );
        }
      });
    }

    // Optics Flyout Toggle Button
    this.element.querySelector('#btn-toggle-hud-optics')?.addEventListener('click', () => {
      this.isOpticsOpen = !this.isOpticsOpen;
      this.render();
    });

    // Close Button in Popover
    this.element.querySelector('#btn-close-hud-optics')?.addEventListener('click', () => {
      this.isOpticsOpen = false;
      this.render();
    });

    // Sliders inside the Optics Popover
    if (this.isOpticsOpen) {
      // Wave Speed
      const speedSlider = this.element.querySelector('#hud-slider-wave-speed') as HTMLInputElement;
      speedSlider?.addEventListener('input', () => {
        const val = parseFloat(speedSlider.value);
        this.visualizer.waveSpeed = val;
        const label = this.element.querySelector('#hud-val-wave-speed');
        if (label) label.textContent = val.toFixed(1);
        const pct = Math.round(((val - 1.0) / 11.0) * 100);
        speedSlider.style.background = `linear-gradient(to right, #38bdf8 ${pct}%, rgba(255, 255, 255, 0.1) ${pct}%)`;
        window.dispatchEvent(new CustomEvent('optics-value-changed'));
      });

      // Wave Damping
      const dampingSlider = this.element.querySelector('#hud-slider-wave-damping') as HTMLInputElement;
      dampingSlider?.addEventListener('input', () => {
        const val = parseFloat(dampingSlider.value);
        this.visualizer.waveDamping = val;
        const label = this.element.querySelector('#hud-val-wave-damping');
        if (label) label.textContent = val.toFixed(2);
        const pct = Math.round(((val - 0.02) / 0.33) * 100);
        dampingSlider.style.background = `linear-gradient(to right, #38bdf8 ${pct}%, rgba(255, 255, 255, 0.1) ${pct}%)`;
        window.dispatchEvent(new CustomEvent('optics-value-changed'));
      });

      // Bloom
      const bloomSlider = this.element.querySelector('#hud-slider-bloom') as HTMLInputElement;
      bloomSlider?.addEventListener('input', () => {
        const val = parseFloat(bloomSlider.value);
        this.visualizer.bloomStrength = val;
        if (typeof this.visualizer.setBloomStrength === 'function') {
          this.visualizer.setBloomStrength(val);
        }
        const label = this.element.querySelector('#hud-val-bloom');
        if (label) label.textContent = val.toFixed(2);
        const pct = Math.round(((val - 0.05) / 0.95) * 100);
        bloomSlider.style.background = `linear-gradient(to right, #38bdf8 ${pct}%, rgba(255, 255, 255, 0.1) ${pct}%)`;
        window.dispatchEvent(new CustomEvent('optics-value-changed'));
      });

      // Particle Density
      const densitySlider = this.element.querySelector('#hud-slider-particle-density') as HTMLInputElement;
      densitySlider?.addEventListener('input', () => {
        const val = parseInt(densitySlider.value, 10);
        this.visualizer.particleDensity = val;
        if (typeof this.visualizer.setParticleDensity === 'function') {
          this.visualizer.setParticleDensity(val);
        }
        if (this.visualizer.gpuAcousticParticles) {
          this.visualizer.gpuAcousticParticles.setParticleDensity(val);
        }
        const label = this.element.querySelector('#hud-val-particle-density');
        if (label) label.textContent = `${Math.round(val / 1024)}k`;
        const pct = Math.round(((val - 16384) / (262144 - 16384)) * 100);
        densitySlider.style.background = `linear-gradient(to right, #38bdf8 ${pct}%, rgba(255, 255, 255, 0.1) ${pct}%)`;
        window.dispatchEvent(new CustomEvent('particle-density-changed', { detail: { density: val } }));
        window.dispatchEvent(new CustomEvent('optics-value-changed'));
      });

      // Particle Scale
      const scaleSlider = this.element.querySelector('#hud-slider-particle-scale') as HTMLInputElement;
      scaleSlider?.addEventListener('input', () => {
        const val = parseFloat(scaleSlider.value);
        this.visualizer.particleScale = val;
        if (typeof this.visualizer.setParticleScale === 'function') {
          this.visualizer.setParticleScale(val);
        }
        if (this.visualizer.gpuAcousticParticles) {
          this.visualizer.gpuAcousticParticles.setParticleScale(val);
        }
        const label = this.element.querySelector('#hud-val-particle-scale');
        if (label) label.textContent = `${val.toFixed(1)}×`;
        const pct = Math.round(((val - 0.4) / 1.6) * 100);
        scaleSlider.style.background = `linear-gradient(to right, #38bdf8 ${pct}%, rgba(255, 255, 255, 0.1) ${pct}%)`;
        window.dispatchEvent(new CustomEvent('optics-value-changed'));
      });

      // Floor Grid Toggle
      this.element.querySelector('#hud-btn-toggle-grid')?.addEventListener('click', () => {
        const current = this.visualizer.getGroundGridVisible && this.visualizer.getGroundGridVisible();
        if (typeof this.visualizer.setGroundGridVisible === 'function') {
          this.visualizer.setGroundGridVisible(!current);
        }
        this.render();
        window.dispatchEvent(new CustomEvent('optics-value-changed'));
      });

      // Reset Visuals
      this.element.querySelector('#hud-btn-reset-visuals')?.addEventListener('click', () => {
        this.resetVisuals();
      });
    }
  }

  private attachGlobalListeners(): void {
    window.addEventListener('camera-mode-changed', ((e: CustomEvent<{ mode: CameraMode }>) => {
      if (e.detail?.mode) {
        const cameraSelect = this.element.querySelector('#viewport-camera-selector') as HTMLSelectElement;
        if (cameraSelect && cameraSelect.value !== e.detail.mode) {
          cameraSelect.value = e.detail.mode;
        }
      }
    }) as EventListener);

    window.addEventListener('palette-changed', ((e: CustomEvent<{ paletteId: string }>) => {
      if (e.detail?.paletteId) {
        this.currentPaletteId = e.detail.paletteId;
        const themeSelect = this.element.querySelector('#viewport-theme-selector') as HTMLSelectElement;
        if (themeSelect && themeSelect.value !== e.detail.paletteId) {
          themeSelect.value = e.detail.paletteId;
        }
      }
    }) as EventListener);

    window.addEventListener('optics-value-changed', () => {
      if (this.isOpticsOpen) {
        this.render();
      }
    });

    window.addEventListener('optics-reset', () => {
      this.render();
    });
  }
}
