import { VisualizerEngine } from '../visualizer/VisualizerEngine';
import { EngineMode } from './Header';

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
    this.render();
  }

  public resetDefaults(): void {
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
    window.dispatchEvent(new CustomEvent('camera-mode-changed', { detail: { mode: 'autocam' } }));
    window.dispatchEvent(new CustomEvent('palette-changed', { detail: { paletteId: 'cosmic-nebula' } }));
    window.dispatchEvent(new CustomEvent('optics-reset'));
    this.render();
  }

  private preventEventBleeding(): void {
    this.element.addEventListener('wheel', e => e.stopPropagation(), { passive: false });
  }

  public render(): void {
    const isMusicMode = this.currentMode === 'cymatics' || this.currentMode === 'music';
    const isCymaticsMode = this.currentMode === 'cymatics' || this.currentMode === 'modal' || this.currentMode === 'frequency';
    const isToneMode = this.currentMode === 'frequency';
    const isSpecializedLab = ['therapy', 'nobel', 'bio', 'voice'].includes(this.currentMode);

    const showMediumControls = isMusicMode;
    const showWaveControls = isMusicMode;
    const showParticleScale = isMusicMode || isCymaticsMode || isToneMode;
    const showParticleDensity = isMusicMode || isCymaticsMode || isToneMode;
    const showGlowControl = true; // Universal bloom across all modes

    const layers = this.visualizer?.getCymaticsLayers
      ? this.visualizer.getCymaticsLayers()
      : { plate: false, droplet: true, trap: true };

    const headerTitle = isSpecializedLab ? 'Scene Optics' : 'Scene Optics & Physics';

    // Calculations for slider filled gradients
    const waveSpeedPct = Math.round(((this.visualizer.waveSpeed - 1.0) / 11.0) * 100);
    const dampingPct = Math.round(((this.visualizer.waveDamping - 0.02) / 0.33) * 100);
    const bloomPct = Math.round(((this.visualizer.bloomStrength - 0.05) / 0.95) * 100);
    const densityPct = Math.round(((this.visualizer.particleDensity - 16384) / (262144 - 16384)) * 100);
    const scalePct = Math.round(((this.visualizer.particleScale - 0.4) / 1.6) * 100);

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

        ${
          showMediumControls
            ? `
        <!-- Cymatics Medium / Apparatus Multi-Layer Selector -->
        <div class="flex flex-col gap-1.5 bg-slate-950/50 p-2.5 rounded-2xl border border-white/5">
          <div class="flex items-center justify-between">
            <span class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Cymatics Medium</span>
            <span class="text-[9px] text-cyan-400 font-mono">Multi-Layer</span>
          </div>
          <div class="grid grid-cols-3 gap-1 bg-slate-950/80 p-1 rounded-xl border border-white/5">
            <button
              data-layer="plate"
              class="btn-physics-layer py-1.5 px-1 rounded-lg text-[10px] font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                layers.plate
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/50 ring-1 ring-cyan-400/30 shadow-sm font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }"
            >
              <span>${layers.plate ? '✓ ' : ''}2D Plate</span>
            </button>
            <button
              data-layer="droplet"
              class="btn-physics-layer py-1.5 px-1 rounded-lg text-[10px] font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                layers.droplet
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/50 ring-1 ring-cyan-400/30 shadow-sm font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }"
            >
              <span>${layers.droplet ? '✓ ' : ''}3D Droplet</span>
            </button>
            <button
              data-layer="trap"
              class="btn-physics-layer py-1.5 px-1 rounded-lg text-[10px] font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                layers.trap
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/50 ring-1 ring-cyan-400/30 shadow-sm font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }"
            >
              <span>${layers.trap ? '✓ ' : ''}3D Trap</span>
            </button>
          </div>
        </div>
        `
            : ''
        }

        ${
          showWaveControls
            ? `
        <!-- Simulation Physics Group -->
        <div class="flex flex-col gap-2.5 bg-slate-950/50 p-2.5 rounded-2xl border border-white/5">
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
        </div>
        `
            : ''
        }

        <!-- Optics & Rendering Fidelity Group -->
        <div class="flex flex-col gap-2.5 bg-slate-950/50 p-2.5 rounded-2xl border border-white/5">
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

    // Wave Speed
    const speedSlider = this.element.querySelector('#slider-wave-speed') as HTMLInputElement;
    speedSlider?.addEventListener('input', () => {
      const val = parseFloat(speedSlider.value);
      this.visualizer.waveSpeed = val;
      const label = this.element.querySelector('#val-wave-speed');
      if (label) label.textContent = val.toFixed(1);
      const pct = Math.round(((val - 1.0) / 11.0) * 100);
      speedSlider.style.background = `linear-gradient(to right, #38bdf8 ${pct}%, rgba(255, 255, 255, 0.1) ${pct}%)`;
      window.dispatchEvent(new CustomEvent('optics-value-changed'));
    });

    // Wave Damping
    const dampingSlider = this.element.querySelector('#slider-wave-damping') as HTMLInputElement;
    dampingSlider?.addEventListener('input', () => {
      const val = parseFloat(dampingSlider.value);
      this.visualizer.waveDamping = val;
      const label = this.element.querySelector('#val-wave-damping');
      if (label) label.textContent = val.toFixed(2);
      const pct = Math.round(((val - 0.02) / 0.33) * 100);
      dampingSlider.style.background = `linear-gradient(to right, #38bdf8 ${pct}%, rgba(255, 255, 255, 0.1) ${pct}%)`;
      window.dispatchEvent(new CustomEvent('optics-value-changed'));
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
      window.dispatchEvent(new CustomEvent('optics-value-changed'));
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
      window.dispatchEvent(new CustomEvent('optics-value-changed'));
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
      window.dispatchEvent(new CustomEvent('optics-value-changed'));
    });

    // Ground Grid Toggle Button
    this.element.querySelector('#btn-toggle-ground-grid')?.addEventListener('click', () => {
      const current = this.visualizer.getGroundGridVisible && this.visualizer.getGroundGridVisible();
      if (typeof this.visualizer.setGroundGridVisible === 'function') {
        this.visualizer.setGroundGridVisible(!current);
      }
      this.render();
      window.dispatchEvent(new CustomEvent('optics-value-changed'));
    });

    // Cymatics Medium Layer Toggles
    this.element.querySelectorAll('.btn-physics-layer').forEach(btn => {
      btn.addEventListener('click', e => {
        const target = e.currentTarget as HTMLElement;
        const layer = target.getAttribute('data-layer') as 'plate' | 'droplet' | 'trap';
        if (!layer || !this.visualizer) return;

        const currentLayers = this.visualizer.getCymaticsLayers
          ? this.visualizer.getCymaticsLayers()
          : { plate: false, droplet: true, trap: true };

        const newLayers = { ...currentLayers, [layer]: !currentLayers[layer] };
        // Ensure at least one layer remains active
        if (!newLayers.plate && !newLayers.droplet && !newLayers.trap) {
          newLayers[layer] = true;
        }

        if (typeof this.visualizer.setCymaticsLayers === 'function') {
          this.visualizer.setCymaticsLayers(newLayers);
        }
        if (newLayers.plate && !newLayers.droplet && !newLayers.trap) {
          this.visualizer.setStyle?.('cymatics-2d');
        } else {
          this.visualizer.setStyle?.('cymatics');
        }

        window.dispatchEvent(
          new CustomEvent('cymatics-layers-changed', {
            detail: newLayers,
          })
        );
        this.render();
      });
    });

    // Reset Defaults Button
    this.element.querySelector('#btn-reset-physics-drawer')?.addEventListener('click', () => {
      this.resetDefaults();
    });
  }

  private attachGlobalListeners(): void {
    window.addEventListener('optics-value-changed', () => {
      this.render();
    });

    window.addEventListener('optics-reset', () => {
      this.render();
    });

    window.addEventListener('cymatics-layers-changed', () => {
      this.render();
    });

    window.addEventListener('visual-style-changed', () => {
      this.render();
    });
  }
}
