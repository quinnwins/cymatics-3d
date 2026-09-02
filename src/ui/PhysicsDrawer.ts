import { VisualizerEngine, CameraMode } from '../visualizer/VisualizerEngine';
import { ColorPalettes } from '../visualizer/ColorPalettes';
import { EngineMode } from './Header';
import {
  temporalMemory,
  TEMPORAL_MEDIA,
  TEMPORAL_MEMORY_EVENT,
  type TemporalMediumId,
} from '../visualizer/TemporalMemory';

export class PhysicsDrawer {
  private element: HTMLElement;
  private isOpen = true;
  private currentMode: EngineMode = 'cymatics';

  constructor(private visualizer: VisualizerEngine) {
    this.element = document.createElement('div');
    this.element.className =
      'glass-panel p-3.5 sm:p-4 rounded-3xl flex flex-col gap-2.5 shadow-xl w-full border-white/10 backdrop-blur-xl transition-all duration-300 select-none';
    this.render();
    this.preventEventBleeding();
    this.attachGlobalListeners();
  }

  public getElement(): HTMLElement {
    return this.element;
  }

  public setOpen(open: boolean): void {
    this.isOpen = open;
    this.render();
  }

  public getIsOpen(): boolean {
    return this.isOpen;
  }

  public setMode(mode: EngineMode): void {
    const normalized = mode === 'cymatics' ? 'music' : mode === 'modal' ? 'frequency' : mode;
    this.currentMode = normalized;
    this.render();
  }

  public getMode(): EngineMode {
    return this.currentMode;
  }

  public syncState(): void {
    this.syncValuesFromVisualizer(false);
  }

  public syncValuesFromVisualizer(skipFocused = true): void {
    if (!this.visualizer) return;

    // Wave Speed
    const speedSlider = this.element.querySelector('#slider-wave-speed') as HTMLInputElement | null;
    const speedVal = this.element.querySelector('#val-wave-speed');
    if (speedSlider) {
      if (!skipFocused || document.activeElement !== speedSlider) {
        speedSlider.value = this.visualizer.waveSpeed.toString();
      }
      const pct = Math.round(((this.visualizer.waveSpeed - 1.0) / 11.0) * 100);
      speedSlider.style.background = `linear-gradient(to right, #38bdf8 ${pct}%, rgba(255, 255, 255, 0.1) ${pct}%)`;
    }
    if (speedVal) {
      speedVal.textContent = this.visualizer.waveSpeed.toFixed(1);
    }

    // Wave Damping
    const dampingSlider = this.element.querySelector('#slider-wave-damping') as HTMLInputElement | null;
    const dampingVal = this.element.querySelector('#val-wave-damping');
    if (dampingSlider) {
      if (!skipFocused || document.activeElement !== dampingSlider) {
        dampingSlider.value = this.visualizer.waveDamping.toString();
      }
      const pct = Math.round(((this.visualizer.waveDamping - 0.02) / 0.33) * 100);
      dampingSlider.style.background = `linear-gradient(to right, #38bdf8 ${pct}%, rgba(255, 255, 255, 0.1) ${pct}%)`;
    }
    if (dampingVal) {
      dampingVal.textContent = this.visualizer.waveDamping.toFixed(2);
    }

    // Bloom Strength
    const bloomSlider = this.element.querySelector('#slider-bloom') as HTMLInputElement | null;
    const bloomVal = this.element.querySelector('#val-bloom');
    if (bloomSlider) {
      if (!skipFocused || document.activeElement !== bloomSlider) {
        bloomSlider.value = this.visualizer.bloomStrength.toString();
      }
      const pct = Math.round(((this.visualizer.bloomStrength - 0.05) / 0.95) * 100);
      bloomSlider.style.background = `linear-gradient(to right, #38bdf8 ${pct}%, rgba(255, 255, 255, 0.1) ${pct}%)`;
    }
    if (bloomVal) {
      bloomVal.textContent = this.visualizer.bloomStrength.toFixed(2);
    }

    // Particle Density
    const densitySlider = this.element.querySelector('#slider-particle-density') as HTMLInputElement | null;
    const densityVal = this.element.querySelector('#val-particle-density');
    if (densitySlider) {
      if (!skipFocused || document.activeElement !== densitySlider) {
        densitySlider.value = this.visualizer.particleDensity.toString();
      }
      const pct = Math.round(((this.visualizer.particleDensity - 16384) / (262144 - 16384)) * 100);
      densitySlider.style.background = `linear-gradient(to right, #38bdf8 ${pct}%, rgba(255, 255, 255, 0.1) ${pct}%)`;
    }
    if (densityVal) {
      densityVal.textContent = `${Math.round(this.visualizer.particleDensity / 1024)}k`;
    }

    // Particle Scale
    const scaleSlider = this.element.querySelector('#slider-particle-scale') as HTMLInputElement | null;
    const scaleVal = this.element.querySelector('#val-particle-scale');
    if (scaleSlider) {
      if (!skipFocused || document.activeElement !== scaleSlider) {
        scaleSlider.value = this.visualizer.particleScale.toString();
      }
      const pct = Math.round(((this.visualizer.particleScale - 0.4) / 1.6) * 100);
      scaleSlider.style.background = `linear-gradient(to right, #38bdf8 ${pct}%, rgba(255, 255, 255, 0.1) ${pct}%)`;
    }
    if (scaleVal) {
      scaleVal.textContent = `${this.visualizer.particleScale.toFixed(1)}×`;
    }

    // Camera Perspective Dropdown
    const cameraSelect = this.element.querySelector('#select-camera-mode') as HTMLSelectElement | null;
    if (cameraSelect) {
      const activeMode =
        this.visualizer && typeof this.visualizer.getCameraMode === 'function'
          ? this.visualizer.getCameraMode()
          : 'autocam';
      if (!skipFocused || document.activeElement !== cameraSelect) {
        cameraSelect.value = activeMode;
      }
    }

    // Color Palette Dropdown
    const paletteSelect = this.element.querySelector('#select-color-palette') as HTMLSelectElement | null;
    if (paletteSelect) {
      const activePalette =
        this.visualizer && typeof this.visualizer.getCurrentPaletteId === 'function'
          ? this.visualizer.getCurrentPaletteId()
          : 'cosmic-nebula';
      if (!skipFocused || document.activeElement !== paletteSelect) {
        paletteSelect.value = activePalette;
      }
    }

    // Apparatus Simulation Mode Dropdown
    const engineSelect = this.element.querySelector('#select-engine-mode') as HTMLSelectElement | null;
    if (engineSelect && this.visualizer && typeof this.visualizer.getEngineMode === 'function') {
      const activeEngineMode = this.visualizer.getEngineMode();
      if (!skipFocused || document.activeElement !== engineSelect) {
        engineSelect.value = activeEngineMode;
      }
    }

    // Particle Motion Mode Dropdown
    const particleMotionSelect = this.element.querySelector('#select-particle-motion') as HTMLSelectElement | null;
    if (particleMotionSelect && this.visualizer?.gpuAcousticParticles && typeof this.visualizer.gpuAcousticParticles.getSimulationMode === 'function') {
      const activeMotion = this.visualizer.gpuAcousticParticles.getSimulationMode();
      if (!skipFocused || document.activeElement !== particleMotionSelect) {
        particleMotionSelect.value = activeMotion;
      }
    }

    // Floor Grid Toggle Button
    const gridBtn = this.element.querySelector('#btn-toggle-ground-grid') as HTMLButtonElement | null;
    if (gridBtn) {
      const isGrid = !!(this.visualizer.getGroundGridVisible && this.visualizer.getGroundGridVisible());
      gridBtn.setAttribute('aria-checked', String(isGrid));
      gridBtn.className = `px-2.5 py-1 rounded-xl text-[10px] font-semibold transition-all cursor-pointer flex items-center gap-1 ${
        isGrid
          ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-400/60 shadow-sm font-bold ring-1 ring-cyan-400/40'
          : 'bg-slate-900/80 text-slate-400 hover:text-white border border-white/10 hover:border-white/20'
      }`;
      gridBtn.innerHTML = `<span>${isGrid ? '✓ On' : 'Off'}</span>`;
    }
  }

  public resetDefaults(): void {
    if (!this.visualizer) return;
    if (typeof this.visualizer.setWaveSpeed === 'function') {
      this.visualizer.setWaveSpeed(6.0);
    } else {
      this.visualizer.waveSpeed = 6.0;
    }
    if (typeof this.visualizer.setWaveDamping === 'function') {
      this.visualizer.setWaveDamping(0.12);
    } else {
      this.visualizer.waveDamping = 0.12;
    }
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
    window.dispatchEvent(new CustomEvent('camera-mode-changed', { detail: { mode: 'autocam' } }));
    window.dispatchEvent(new CustomEvent('palette-changed', { detail: { paletteId: 'cosmic-nebula' } }));
    window.dispatchEvent(new CustomEvent('optics-reset'));
    this.syncValuesFromVisualizer(false);
  }

  private preventEventBleeding(): void {
    this.element.addEventListener('wheel', e => e.stopPropagation(), { passive: false });
  }

  public render(): void {
    const isMusicMode = this.currentMode === 'cymatics' || this.currentMode === 'music';
    const isCymaticsMode = this.currentMode === 'cymatics' || this.currentMode === 'modal' || this.currentMode === 'frequency';
    const isToneMode = this.currentMode === 'frequency';
    const isSpecializedLab = ['therapy', 'nobel', 'bio', 'voice'].includes(this.currentMode);

    const showWaveControls = isMusicMode;
    const showParticleScale = isMusicMode || isCymaticsMode || isToneMode;
    const showParticleDensity = isMusicMode || isCymaticsMode || isToneMode;
    const showGlowControl = true; // Universal bloom across all modes

    const headerTitle = isSpecializedLab ? 'Scene Optics' : 'Scene Optics & Physics';

    const cameraOptions: { id: CameraMode; label: string; title: string }[] = [
      { id: 'autocam', label: 'Cinematic', title: 'Cinematic auto-rotating camera' },
      { id: 'orbit', label: 'Free Orbit', title: 'Free 360° mouse & touch orbit' },
      { id: 'emitter-lock', label: 'Focus Center', title: 'Lock focus on acoustic center' },
      { id: 'top-down', label: 'Top-Down', title: 'Top-down orthogonal perspective' },
    ];

    const palettes = Object.values(ColorPalettes.PALETTES);
    const activeCameraMode =
      this.visualizer && typeof this.visualizer.getCameraMode === 'function'
        ? this.visualizer.getCameraMode()
        : 'autocam';
    const activePaletteId =
      this.visualizer && typeof this.visualizer.getCurrentPaletteId === 'function'
        ? this.visualizer.getCurrentPaletteId()
        : 'cosmic-nebula';

    // Calculations for slider filled gradients
    const waveSpeedPct = Math.round(((this.visualizer.waveSpeed - 1.0) / 11.0) * 100);
    const dampingPct = Math.round(((this.visualizer.waveDamping - 0.02) / 0.33) * 100);
    const bloomPct = Math.round(((this.visualizer.bloomStrength - 0.05) / 0.95) * 100);
    const densityPct = Math.round(((this.visualizer.particleDensity - 16384) / (262144 - 16384)) * 100);
    const scalePct = Math.round(((this.visualizer.particleScale - 0.4) / 1.6) * 100);

    const memSettings = temporalMemory.getSettings();
    const lookbackPct = Math.round((memSettings.lookbackSeconds / 10.0) * 100);
    const memoryPct = Math.round(((memSettings.memorySeconds - 1.0) / 9.0) * 100);

    this.element.innerHTML = `
      <!-- Main Accordion Header -->
      <button id="btn-toggle-accordion-physics" class="w-full flex items-center justify-between cursor-pointer group text-left">
        <div class="flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-cyan-400 shadow-sm shadow-cyan-400/50 animate-pulse"></span>
          <span class="text-xs font-bold text-slate-200 tracking-wide">${headerTitle}</span>
        </div>
        <span class="text-xs text-slate-400 group-hover:text-white transition-transform font-mono">
          ${this.isOpen ? '▲' : '▼'}
        </span>
      </button>

      <!-- Main Collapsible Body (Streamlined Direct Controls) -->
      <div id="physics-body" class="${this.isOpen ? 'flex' : 'hidden'} flex-col gap-3 text-xs pt-2.5 border-t border-white/10">

        <!-- Viewport Perspective & Color Theme Group (Universal Across All Pages) -->
        <div class="flex flex-col gap-2.5 bg-slate-950/40 p-2.5 rounded-2xl border border-white/5">
          <div class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Perspective & Theme</div>
          
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <!-- Camera View Dropdown -->
            <div class="flex flex-col gap-1 min-w-0">
              <label for="select-camera-mode" class="text-[10px] font-medium text-slate-300 flex items-center gap-1">
                <svg class="w-3.5 h-3.5 text-cyan-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2" ry="2"/></svg>
                <span class="truncate">Camera</span>
              </label>
              <select
                id="select-camera-mode"
                aria-label="Camera Perspective View"
                title="Switch camera viewport perspective"
                class="glass-select glass-select-sm w-full cursor-pointer text-xs"
              >
                ${cameraOptions
                  .map(
                    cam => `
                  <option value="${cam.id}" ${cam.id === activeCameraMode ? 'selected' : ''}>${cam.label}</option>
                `
                  )
                  .join('')}
              </select>
            </div>

            <!-- Color Palette Theme Dropdown -->
            <div class="flex flex-col gap-1 min-w-0">
              <label for="select-color-palette" class="text-[10px] font-medium text-slate-300 flex items-center gap-1">
                <svg class="w-3.5 h-3.5 text-cyan-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>
                <span class="truncate">Color Theme</span>
              </label>
              <select
                id="select-color-palette"
                aria-label="Visualizer Color Theme Palette"
                title="Switch color palette"
                class="glass-select glass-select-sm w-full cursor-pointer text-xs"
              >
                ${palettes
                  .map(
                    p => `
                  <option value="${p.id}" ${p.id === activePaletteId ? 'selected' : ''}>${p.name}</option>
                `
                  )
                  .join('')}
              </select>
            </div>
          </div>
        </div>

        ${
          showWaveControls
            ? `
        <!-- Simulation Physics Group -->
        <div class="flex flex-col gap-2.5 bg-slate-950/40 p-2.5 rounded-2xl border border-white/5">
          <div class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Acoustic Physics</div>
          
          <!-- Wave Propagation Speed (c) -->
          <div class="flex flex-col gap-1">
            <div class="flex justify-between text-slate-300 font-mono">
              <span class="text-[10px]">Wave Speed</span>
              <span id="val-wave-speed" class="text-cyan-400 tabular-nums">${this.visualizer.waveSpeed.toFixed(1)}</span>
            </div>
            <input
              type="range"
              id="slider-wave-speed"
              min="1.0"
              max="12.0"
              step="0.2"
              value="${this.visualizer.waveSpeed}"
              aria-label="Wave propagation speed slider"
              style="background: linear-gradient(to right, #38bdf8 ${waveSpeedPct}%, rgba(255, 255, 255, 0.1) ${waveSpeedPct}%);"
              class="w-full min-w-0 cursor-pointer slider-cyan"
            />
          </div>

          <!-- Medium Wave Damping (alpha) -->
          <div class="flex flex-col gap-1">
            <div class="flex justify-between text-slate-300 font-mono">
              <span class="text-[10px]">Sound Absorption</span>
              <span id="val-wave-damping" class="text-cyan-400 tabular-nums">${this.visualizer.waveDamping.toFixed(2)}</span>
            </div>
            <input
              type="range"
              id="slider-wave-damping"
              min="0.02"
              max="0.35"
              step="0.01"
              value="${this.visualizer.waveDamping}"
              aria-label="Sound absorption damping slider"
              style="background: linear-gradient(to right, #38bdf8 ${dampingPct}%, rgba(255, 255, 255, 0.1) ${dampingPct}%);"
              class="w-full min-w-0 cursor-pointer slider-cyan"
            />
          </div>

          <!-- Apparatus Simulation Mode -->
          <div class="flex flex-col gap-1 min-w-0 pt-1 border-t border-white/5">
            <label for="select-engine-mode" class="text-[10px] font-medium text-slate-300 flex items-center gap-1">
              <span>Apparatus Mode</span>
            </label>
            <select
              id="select-engine-mode"
              aria-label="Apparatus physics mode"
              class="glass-select glass-select-sm w-full cursor-pointer text-xs"
            >
              <option value="hybrid" ${this.visualizer.getEngineMode && this.visualizer.getEngineMode() === 'hybrid' ? 'selected' : ''}>Hybrid (Resonance & Visual Glow)</option>
              <option value="physical" ${this.visualizer.getEngineMode && this.visualizer.getEngineMode() === 'physical' ? 'selected' : ''}>Physical (Exact Solver & Migration)</option>
              <option value="expressive" ${this.visualizer.getEngineMode && this.visualizer.getEngineMode() === 'expressive' ? 'selected' : ''}>Expressive (Direct Audio Shapes)</option>
            </select>
          </div>

          <!-- Particle Motion Simulation Mode -->
          <div class="flex flex-col gap-1 min-w-0">
            <label for="select-particle-motion" class="text-[10px] font-medium text-slate-300 flex items-center gap-1">
              <span>Particle Motion</span>
            </label>
            <select
              id="select-particle-motion"
              aria-label="Particle motion simulation mode"
              class="glass-select glass-select-sm w-full cursor-pointer text-xs"
            >
              <option value="equilibrium" ${this.visualizer.gpuAcousticParticles?.getSimulationMode?.() === 'equilibrium' ? 'selected' : ''}>Instant Preview (Nodal Surface)</option>
              <option value="dynamic" ${this.visualizer.gpuAcousticParticles?.getSimulationMode?.() === 'dynamic' ? 'selected' : ''}>Physical Migration (Acoustophoresis)</option>
            </select>
          </div>
        </div>

        <!-- Song Memory ("The Song Remembers") Group -->
        <div id="drawer-temporal-acoustics" class="flex flex-col gap-2.5 bg-slate-950/40 p-2.5 rounded-2xl border border-white/5">
          <div class="flex items-center justify-between">
            <div class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <span>Song Memory</span>
            </div>
          </div>

          <!-- Enter The Song Remembers Action Button -->
          <div>
            <button
              id="btn-drawer-theater"
              type="button"
              class="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-cyan-500/20 to-indigo-500/20 hover:from-cyan-500/30 hover:to-indigo-500/30 text-cyan-200 border border-cyan-400/40 text-[11px] font-semibold cursor-pointer transition-all active:scale-95 flex items-center justify-center gap-1.5 shadow-sm"
              aria-label="Enter The Song Remembers"
            >
              <span>The Song Remembers (A or M)</span>
            </button>
          </div>
        </div>
        `
            : ''
        }

        <!-- Optics & Rendering Fidelity Group -->
        <div class="flex flex-col gap-2.5 bg-slate-950/40 p-2.5 rounded-2xl border border-white/5">
          <div class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Optics & Particles</div>

          ${
            showGlowControl
              ? `
          <!-- Bloom & Glow Intensity (Universal) -->
          <div class="flex flex-col gap-1">
            <div class="flex justify-between text-slate-300 font-mono">
              <span class="text-[10px]">Glow Brightness</span>
              <span id="val-bloom" class="text-cyan-400 tabular-nums">${this.visualizer.bloomStrength.toFixed(2)}</span>
            </div>
            <input
              type="range"
              id="slider-bloom"
              min="0.05"
              max="1.0"
              step="0.05"
              value="${this.visualizer.bloomStrength}"
              aria-label="Bloom glow brightness slider"
              style="background: linear-gradient(to right, #38bdf8 ${bloomPct}%, rgba(255, 255, 255, 0.1) ${bloomPct}%);"
              class="w-full min-w-0 cursor-pointer slider-cyan"
            />
          </div>
          `
              : ''
          }

          ${
            showParticleDensity
              ? `
          <!-- Particle Density (Count) -->
          <div class="flex flex-col gap-1">
            <div class="flex justify-between text-slate-300 font-mono">
              <span class="text-[10px]">Particle Density</span>
              <span id="val-particle-density" class="text-cyan-400 tabular-nums">${Math.round(this.visualizer.particleDensity / 1024)}k</span>
            </div>
            <input
              type="range"
              id="slider-particle-density"
              min="16384"
              max="262144"
              step="16384"
              value="${this.visualizer.particleDensity}"
              aria-label="Particle field density count slider"
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
          <!-- Particle Size Scale -->
          <div class="flex flex-col gap-1">
            <div class="flex justify-between text-slate-300 font-mono">
              <span class="text-[10px]">Particle Size</span>
              <span id="val-particle-scale" class="text-cyan-400 tabular-nums">${this.visualizer.particleScale.toFixed(1)}×</span>
            </div>
            <input
              type="range"
              id="slider-particle-scale"
              min="0.4"
              max="2.0"
              step="0.1"
              value="${this.visualizer.particleScale}"
              aria-label="Particle visual scale slider"
              style="background: linear-gradient(to right, #38bdf8 ${scalePct}%, rgba(255, 255, 255, 0.1) ${scalePct}%);"
              class="w-full min-w-0 cursor-pointer slider-cyan"
            />
          </div>
          `
              : ''
          }

          <!-- Floor Reference Grid Toggle (Universal) -->
          <div class="flex items-center justify-between pt-1 border-t border-white/5">
            <span class="text-[10px] text-slate-300 font-medium">Floor Grid</span>
            <button
              id="btn-toggle-ground-grid"
              role="switch"
              aria-checked="${this.visualizer.getGroundGridVisible && this.visualizer.getGroundGridVisible()}"
              aria-label="Toggle Spatial Floor Reference Grid"
              class="px-2.5 py-1 rounded-xl text-[10px] font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                this.visualizer.getGroundGridVisible && this.visualizer.getGroundGridVisible()
                  ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-400/60 shadow-sm font-bold ring-1 ring-cyan-400/40'
                  : 'bg-slate-900/80 text-slate-400 hover:text-white border border-white/10 hover:border-white/20'
              }"
            >
              <span>${this.visualizer.getGroundGridVisible && this.visualizer.getGroundGridVisible() ? '✓ On' : 'Off'}</span>
            </button>
          </div>
        </div>

        <!-- Restore Defaults Action Button -->
        <div class="flex items-center justify-between pt-1 border-t border-white/10 mt-0.5">
          <span class="text-[10px] text-slate-400">Restore factory optics</span>
          <button id="btn-reset-physics-drawer" title="Reset all visual settings to defaults" class="glass-btn px-2.5 py-1 rounded-xl text-[10px] font-semibold text-slate-300 hover:text-white flex items-center gap-1.5 cursor-pointer transition-all active:scale-95">
            <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
            <span>Reset Visuals</span>
          </button>
        </div>

      </div>
    `;

    this.attachEvents();
  }

  private attachEvents(): void {
    // Outer Accordion Toggle
    this.element.querySelector('#btn-toggle-accordion-physics')?.addEventListener('click', () => {
      this.isOpen = !this.isOpen;
      this.render();
    });

    // Camera Perspective Dropdown Event
    const cameraSelect = this.element.querySelector('#select-camera-mode') as HTMLSelectElement | null;
    cameraSelect?.addEventListener('change', e => {
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

    // Color Theme Palette Dropdown Event
    const paletteSelect = this.element.querySelector('#select-color-palette') as HTMLSelectElement | null;
    paletteSelect?.addEventListener('change', e => {
      const target = (e.target as HTMLSelectElement).value;
      if (target && this.visualizer && typeof this.visualizer.setPalette === 'function') {
        this.visualizer.setPalette(target);
        window.dispatchEvent(
          new CustomEvent('palette-changed', {
            detail: { paletteId: target },
          })
        );
      }
    });

    // Wave Speed
    const speedSlider = this.element.querySelector('#slider-wave-speed') as HTMLInputElement;
    speedSlider?.addEventListener('input', () => {
      const val = parseFloat(speedSlider.value);
      if (typeof this.visualizer.setWaveSpeed === 'function') {
        this.visualizer.setWaveSpeed(val);
      } else {
        this.visualizer.waveSpeed = val;
      }
      const label = this.element.querySelector('#val-wave-speed');
      if (label) label.textContent = val.toFixed(1);
      const pct = Math.round(((val - 1.0) / 11.0) * 100);
      speedSlider.style.background = `linear-gradient(to right, #38bdf8 ${pct}%, rgba(255, 255, 255, 0.1) ${pct}%)`;
      window.dispatchEvent(new CustomEvent('optics-value-changed', { detail: { source: 'physics-drawer' } }));
    });

    // Wave Damping
    const dampingSlider = this.element.querySelector('#slider-wave-damping') as HTMLInputElement;
    dampingSlider?.addEventListener('input', () => {
      const val = parseFloat(dampingSlider.value);
      if (typeof this.visualizer.setWaveDamping === 'function') {
        this.visualizer.setWaveDamping(val);
      } else {
        this.visualizer.waveDamping = val;
      }
      const label = this.element.querySelector('#val-wave-damping');
      if (label) label.textContent = val.toFixed(2);
      const pct = Math.round(((val - 0.02) / 0.33) * 100);
      dampingSlider.style.background = `linear-gradient(to right, #38bdf8 ${pct}%, rgba(255, 255, 255, 0.1) ${pct}%)`;
      window.dispatchEvent(new CustomEvent('optics-value-changed', { detail: { source: 'physics-drawer' } }));
    });

    // Apparatus Simulation Mode
    const engineModeSelect = this.element.querySelector('#select-engine-mode') as HTMLSelectElement | null;
    engineModeSelect?.addEventListener('change', () => {
      const val = engineModeSelect.value as any;
      if (typeof this.visualizer.setEngineMode === 'function') {
        this.visualizer.setEngineMode(val);
      }
      this.syncValuesFromVisualizer(false);
      window.dispatchEvent(new CustomEvent('optics-value-changed', { detail: { source: 'physics-drawer' } }));
    });

    // Particle Motion Mode
    const particleMotionSelect = this.element.querySelector('#select-particle-motion') as HTMLSelectElement | null;
    particleMotionSelect?.addEventListener('change', () => {
      const val = particleMotionSelect.value as any;
      if (this.visualizer.gpuAcousticParticles && typeof this.visualizer.gpuAcousticParticles.setSimulationMode === 'function') {
        this.visualizer.gpuAcousticParticles.setSimulationMode(val);
      }
      this.syncValuesFromVisualizer(false);
      window.dispatchEvent(new CustomEvent('optics-value-changed', { detail: { source: 'physics-drawer' } }));
    });

    // Bloom Strength
    const bloomSlider = this.element.querySelector('#slider-bloom') as HTMLInputElement;
    bloomSlider?.addEventListener('input', () => {
      const val = parseFloat(bloomSlider.value);
      this.visualizer.bloomStrength = val;
      if (typeof this.visualizer.setBloomStrength === 'function') {
        this.visualizer.setBloomStrength(val);
      }
      const label = this.element.querySelector('#val-bloom');
      if (label) label.textContent = val.toFixed(2);
      const pct = Math.round(((val - 0.05) / 0.95) * 100);
      bloomSlider.style.background = `linear-gradient(to right, #38bdf8 ${pct}%, rgba(255, 255, 255, 0.1) ${pct}%)`;
      window.dispatchEvent(new CustomEvent('optics-value-changed', { detail: { source: 'physics-drawer' } }));
    });

    // Particle Density
    const densitySlider = this.element.querySelector('#slider-particle-density') as HTMLInputElement;
    densitySlider?.addEventListener('input', () => {
      const val = parseInt(densitySlider.value, 10);
      this.visualizer.particleDensity = val;
      if (typeof this.visualizer.setParticleDensity === 'function') {
        this.visualizer.setParticleDensity(val);
      }
      if (this.visualizer.gpuAcousticParticles) {
        this.visualizer.gpuAcousticParticles.setParticleDensity(val);
      }
      const label = this.element.querySelector('#val-particle-density');
      if (label) label.textContent = `${Math.round(val / 1024)}k`;
      const pct = Math.round(((val - 16384) / (262144 - 16384)) * 100);
      densitySlider.style.background = `linear-gradient(to right, #38bdf8 ${pct}%, rgba(255, 255, 255, 0.1) ${pct}%)`;
      window.dispatchEvent(new CustomEvent('particle-density-changed', { detail: { density: val } }));
      window.dispatchEvent(new CustomEvent('optics-value-changed', { detail: { source: 'physics-drawer' } }));
    });

    // Particle Scale
    const scaleSlider = this.element.querySelector('#slider-particle-scale') as HTMLInputElement;
    scaleSlider?.addEventListener('input', () => {
      const val = parseFloat(scaleSlider.value);
      this.visualizer.particleScale = val;
      if (typeof this.visualizer.setParticleScale === 'function') {
        this.visualizer.setParticleScale(val);
      }
      if (this.visualizer.gpuAcousticParticles) {
        this.visualizer.gpuAcousticParticles.setParticleScale(val);
      }
      const label = this.element.querySelector('#val-particle-scale');
      if (label) label.textContent = `${val.toFixed(1)}×`;
      const pct = Math.round(((val - 0.4) / 1.6) * 100);
      scaleSlider.style.background = `linear-gradient(to right, #38bdf8 ${pct}%, rgba(255, 255, 255, 0.1) ${pct}%)`;
      window.dispatchEvent(new CustomEvent('optics-value-changed', { detail: { source: 'physics-drawer' } }));
    });

    // Ground Grid Toggle Button
    this.element.querySelector('#btn-toggle-ground-grid')?.addEventListener('click', () => {
      const current = this.visualizer.getGroundGridVisible && this.visualizer.getGroundGridVisible();
      if (typeof this.visualizer.setGroundGridVisible === 'function') {
        this.visualizer.setGroundGridVisible(!current);
      }
      this.syncValuesFromVisualizer(false);
      window.dispatchEvent(new CustomEvent('optics-value-changed', { detail: { source: 'physics-drawer' } }));
    });

    // Reset Defaults Button
    this.element.querySelector('#btn-reset-physics-drawer')?.addEventListener('click', () => {
      this.resetDefaults();
    });

    // The Song Remembers Button
    this.element.querySelector('#btn-drawer-theater')?.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('soundform-anamnesis-toggle'));
    });
  }

  private attachGlobalListeners(): void {

    window.addEventListener('soundform-memory-drawer-toggle', () => {
      this.isOpen = true;
      this.render();
      const card = this.element.querySelector('#drawer-temporal-acoustics');
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });

    window.addEventListener('camera-mode-changed', () => {
      this.syncValuesFromVisualizer(true);
    });

    window.addEventListener('palette-changed', () => {
      this.syncValuesFromVisualizer(true);
    });

    window.addEventListener('optics-value-changed', ((e: CustomEvent<{ source?: string }>) => {
      if (e.detail?.source === 'physics-drawer') return;
      this.syncValuesFromVisualizer(true);
    }) as EventListener);

    window.addEventListener('optics-reset', () => {
      this.syncValuesFromVisualizer(false);
    });

    window.addEventListener('cymatics-layers-changed', () => {
      this.syncValuesFromVisualizer(false);
    });

    window.addEventListener('visual-style-changed', () => {
      this.syncValuesFromVisualizer(false);
    });
  }
}
