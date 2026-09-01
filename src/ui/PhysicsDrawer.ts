import { VisualizerEngine, VisualStyle, CameraMode } from '../visualizer/VisualizerEngine';
import { ColorPalettes } from '../visualizer/ColorPalettes';
import { EngineMode } from './Header';

export class PhysicsDrawer {
  private element: HTMLElement;
  private isOpen = true;
  private isVisualsOpen = true;
  private isCameraOpen = true;
  private isPhysicsOpen = true;
  private currentMode: EngineMode = 'music';
  private currentPaletteId: string = 'solfeggio-gold';

  constructor(private visualizer: VisualizerEngine) {
    this.currentPaletteId =
      this.visualizer && typeof this.visualizer.getCurrentPaletteId === 'function'
        ? this.visualizer.getCurrentPaletteId()
        : 'solfeggio-gold';
    this.element = document.createElement('div');
    this.element.className = 'glass-panel p-3.5 rounded-2xl flex flex-col gap-2.5 shadow-xl w-full border-white/10 backdrop-blur-xl transition-all duration-300 select-none';
    this.render();
    this.attachGlobalToggleListener();
    this.preventEventBleeding();
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
    this.currentMode = mode;
    this.render();
  }

  public getMode(): EngineMode {
    return this.currentMode;
  }

  public syncState(): void {
    this.render();
  }

  private preventEventBleeding(): void {
    this.element.addEventListener('wheel', e => e.stopPropagation(), { passive: false });
    this.element.addEventListener('pointerdown', e => e.stopPropagation());
  }

  public render(): void {
    const palettes = Object.values(ColorPalettes.PALETTES);
    const activeStyle = this.visualizer.getStyle();

    const isMusicMode = this.currentMode === 'music';
    const isCymaticsMode = this.currentMode === 'modal';
    const isToneMode = this.currentMode === 'frequency';
    const isSpecializedLab = ['therapy', 'nobel', 'bio', 'voice'].includes(this.currentMode);

    const showVisualsSection = isMusicMode || isCymaticsMode || isToneMode;
    const showRenderStyles = isMusicMode;
    const showPalettePicker = isMusicMode || isCymaticsMode || isToneMode;

    const showWaveControls = isMusicMode;
    const showParticleScale = isMusicMode || isCymaticsMode;
    const showParticleDensity = isMusicMode || isCymaticsMode;
    const showCymaticsDisplay = isCymaticsMode;
    const showGlowControl = true; // Universal bloom across all modes

    let headerTitle = 'Physics & Visuals';
    if (isSpecializedLab) {
      headerTitle = 'Camera & Scene Optics';
    } else if (isCymaticsMode) {
      headerTitle = 'Cymatics & Camera Deck';
    }

    let visualsSectionHtml = '';
    if (showVisualsSection) {
      visualsSectionHtml = `
        <!-- Nested Group 1: Visual Style & Color Theme -->
        <div class="flex flex-col bg-slate-900/60 rounded-xl border border-white/5 overflow-hidden transition-all">
          <button id="btn-toggle-nested-visuals" class="w-full px-2.5 py-1.5 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors text-left">
            <span class="text-[11px] font-semibold text-slate-300">Visuals & Theme</span>
            <span class="text-[10px] text-slate-400 font-mono">${this.isVisualsOpen ? '▲' : '▼'}</span>
          </button>

          <div id="nested-visuals-body" class="${this.isVisualsOpen ? 'flex' : 'hidden'} flex-col gap-2 p-2.5 pt-1 border-t border-white/5">
            ${
              showRenderStyles
                ? `
            <!-- Visual Render Style (Music Space Only) -->
            <div class="flex flex-col gap-1">
              <span class="text-[10px] text-slate-400 font-medium">Render Style:</span>
              <div class="grid grid-cols-3 gap-1">
                ${[
                  { id: 'cymatics', label: 'Cymatics 3D' },
                  { id: 'hybrid', label: 'Cosmos' },
                  { id: 'wavefront', label: 'Wavefront' },
                  { id: 'particles', label: 'Tracer Dust' },
                  { id: 'ribbon', label: 'Sonic Ribbon' },
                ]
                  .map(
                    s => `
                  <button data-style="${s.id}" class="btn-style glass-btn py-1.5 px-1.5 rounded-lg text-[11px] font-medium transition-all text-center cursor-pointer ${
                      activeStyle === s.id ? 'glass-btn-active font-bold shadow-sm ring-1 ring-cyan-400/30' : 'text-gray-300 hover:text-white'
                    }">
                    ${s.label}
                  </button>
                `
                  )
                  .join('')}
              </div>
            </div>
            `
                : ''
            }

            ${
              showCymaticsDisplay
                ? `
            <!-- Specimen Layer Toggle (3D Cymatics) -->
            <div class="flex flex-col gap-1">
              <span class="text-[10px] text-slate-400 font-medium">Specimen Display:</span>
              <div class="grid grid-cols-3 gap-1">
                ${[
                  { id: 'both', label: 'All Layers' },
                  { id: 'particles', label: 'Dust Only' },
                  { id: 'droplet', label: 'Droplet Only' },
                ]
                  .map(
                    v => `
                  <button data-cymatics-vis="${v.id}" class="btn-cymatics-vis glass-btn py-1.5 px-1 rounded-lg text-[10px] font-medium transition-all text-center cursor-pointer ${
                      this.visualizer.cymaticsVisibilityMode === v.id ? 'glass-btn-active font-bold shadow-sm ring-1 ring-cyan-400/30 text-cyan-300' : 'text-gray-300 hover:text-white'
                    }">
                    ${v.label}
                  </button>
                `
                  )
                  .join('')}
              </div>
            </div>
            `
                : ''
            }

            ${
              showPalettePicker
                ? `
            <!-- Color Theme Picker -->
            <div class="flex flex-col gap-1 ${showRenderStyles || showCymaticsDisplay ? 'pt-1 border-t border-white/5' : ''}">
              <span class="text-[10px] text-slate-400 font-medium">Color Palette:</span>
              <select id="theme-selector" class="h-8 px-2.5 py-1 rounded-lg text-xs font-semibold text-gray-200 bg-slate-950 border border-white/10 hover:border-cyan-400/50 shadow-sm outline-none cursor-pointer w-full">
                ${palettes
                  .map(
                    p => `
                  <option value="${p.id}" class="bg-slate-900 text-gray-100" ${p.id === this.currentPaletteId ? 'selected' : ''}>${p.name}</option>
                `
                  )
                  .join('')}
              </select>
            </div>
            `
                : ''
            }
          </div>
        </div>
      `;
    }

    this.element.innerHTML = `
      <!-- Main Accordion Header -->
      <button id="btn-toggle-accordion-physics" class="w-full flex items-center justify-between cursor-pointer group text-left">
        <div class="flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-cyan-400 shadow-sm shadow-cyan-400/50"></span>
          <span class="text-xs font-bold text-slate-200 tracking-wide">${headerTitle}</span>
        </div>
        <span class="text-xs text-slate-400 group-hover:text-white transition-transform font-mono">
          ${this.isOpen ? '▲' : '▼'}
        </span>
      </button>

      <!-- Main Collapsible Body (Nested Structure) -->
      <div id="physics-body" class="${this.isOpen ? 'flex' : 'hidden'} flex-col gap-2.5 text-xs pt-2 border-t border-white/10">
        
        ${visualsSectionHtml}

        <!-- Nested Group 2: Camera Viewport (Universal across all modes) -->
        <div class="flex flex-col bg-slate-900/60 rounded-xl border border-white/5 overflow-hidden transition-all">
          <button id="btn-toggle-nested-camera" class="w-full px-2.5 py-1.5 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors text-left">
            <span class="text-[11px] font-semibold text-slate-300">Camera Viewport</span>
            <span class="text-[10px] text-slate-400 font-mono">${this.isCameraOpen ? '▲' : '▼'}</span>
          </button>

          <div id="nested-camera-body" class="${this.isCameraOpen ? 'flex' : 'hidden'} flex-col gap-1.5 p-2.5 pt-1 border-t border-white/5">
            <div class="grid grid-cols-2 gap-1.5">
              ${[
                { id: 'autocam', label: 'Cinematic' },
                { id: 'orbit', label: 'Free Orbit' },
                { id: 'emitter-lock', label: 'Focus Center' },
                { id: 'top-down', label: 'Top-Down' },
              ]
                .map(
                  c => `
                <button data-camera="${c.id}" class="btn-cam-mode glass-btn py-1.5 px-2 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                    this.visualizer.getCameraMode() === c.id ? 'glass-btn-active font-bold' : 'text-slate-400 hover:text-white'
                  }">
                  ${c.label}
                </button>
              `
                )
                .join('')}
            </div>
          </div>
        </div>

        <!-- Nested Group 3: Acoustic & Optical Physics -->
        <div class="flex flex-col bg-slate-900/60 rounded-xl border border-white/5 overflow-hidden transition-all">
          <button id="btn-toggle-nested-physics" class="w-full px-2.5 py-1.5 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors text-left">
            <span class="text-[11px] font-semibold text-slate-300">${isSpecializedLab ? 'Scene Optics' : 'Physics & Optics'}</span>
            <span class="text-[10px] text-slate-400 font-mono">${this.isPhysicsOpen ? '▲' : '▼'}</span>
          </button>

          <div id="nested-physics-body" class="${this.isPhysicsOpen ? 'flex' : 'hidden'} flex-col gap-2.5 p-2.5 pt-1 border-t border-white/5">
            ${
              showWaveControls
                ? `
            <!-- Wave Propagation Speed (c) -->
            <div class="flex flex-col gap-1">
              <div class="flex justify-between text-slate-300">
                <span class="text-[10px]">Wave Speed</span>
                <span id="val-wave-speed" class="font-mono text-cyan-400">${this.visualizer.waveSpeed.toFixed(1)}</span>
              </div>
              <input
                type="range"
                id="slider-wave-speed"
                min="1.0"
                max="12.0"
                step="0.2"
                value="${this.visualizer.waveSpeed}"
                class="w-full cursor-pointer"
              />
            </div>

            <!-- Medium Wave Damping (alpha) -->
            <div class="flex flex-col gap-1">
              <div class="flex justify-between text-slate-300">
                <span class="text-[10px]">Sound Absorption</span>
                <span id="val-wave-damping" class="font-mono text-cyan-400">${this.visualizer.waveDamping.toFixed(2)}</span>
              </div>
              <input
                type="range"
                id="slider-wave-damping"
                min="0.02"
                max="0.35"
                step="0.01"
                value="${this.visualizer.waveDamping}"
                class="w-full cursor-pointer"
              />
            </div>
            `
                : ''
            }

            ${
              showGlowControl
                ? `
            <!-- Bloom & Glow Intensity (Universal) -->
            <div class="flex flex-col gap-1">
              <div class="flex justify-between text-slate-300">
                <span class="text-[10px]">Glow Brightness</span>
                <span id="val-bloom" class="font-mono text-cyan-400">${this.visualizer.bloomStrength.toFixed(2)}</span>
              </div>
              <input
                type="range"
                id="slider-bloom"
                min="0.05"
                max="2.5"
                step="0.05"
                value="${this.visualizer.bloomStrength}"
                class="w-full cursor-pointer"
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
              <div class="flex justify-between text-slate-300">
                <span class="text-[10px]">Particle Density</span>
                <span id="val-particle-density" class="font-mono text-cyan-400">${Math.round(this.visualizer.particleDensity / 1024)}k</span>
              </div>
              <input
                type="range"
                id="slider-particle-density"
                min="16384"
                max="262144"
                step="16384"
                value="${this.visualizer.particleDensity}"
                class="w-full cursor-pointer"
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
              <div class="flex justify-between text-slate-300">
                <span class="text-[10px]">Particle Size</span>
                <span id="val-particle-scale" class="font-mono text-cyan-400">${this.visualizer.particleScale.toFixed(1)}×</span>
              </div>
              <input
                type="range"
                id="slider-particle-scale"
                min="0.4"
                max="2.0"
                step="0.1"
                value="${this.visualizer.particleScale}"
                class="w-full cursor-pointer"
              />
            </div>
            `
                : ''
            }
          </div>
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

    // Nested Accordion Toggles
    this.element.querySelector('#btn-toggle-nested-visuals')?.addEventListener('click', () => {
      this.isVisualsOpen = !this.isVisualsOpen;
      this.render();
    });

    this.element.querySelector('#btn-toggle-nested-camera')?.addEventListener('click', () => {
      this.isCameraOpen = !this.isCameraOpen;
      this.render();
    });

    this.element.querySelector('#btn-toggle-nested-physics')?.addEventListener('click', () => {
      this.isPhysicsOpen = !this.isPhysicsOpen;
      this.render();
    });

    // Style buttons
    this.element.querySelectorAll('.btn-style').forEach(btn => {
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
    this.element.querySelector('#theme-selector')?.addEventListener('change', e => {
      const select = e.target as HTMLSelectElement;
      this.currentPaletteId = select.value;
      this.visualizer.setPalette(select.value);
    });

    // Wave Speed
    const speedSlider = this.element.querySelector('#slider-wave-speed') as HTMLInputElement;
    speedSlider?.addEventListener('input', () => {
      const val = parseFloat(speedSlider.value);
      this.visualizer.waveSpeed = val;
      this.visualizer.wavefrontShells.setPropagationSpeed(val);
      this.visualizer.particleNebula.setPropagationSpeed(val);
      this.visualizer.sonicRibbon.setPropagationSpeed(val);
      const valEl = this.element.querySelector('#val-wave-speed');
      if (valEl) valEl.textContent = val.toFixed(1);
    });

    // Wave Damping
    const dampingSlider = this.element.querySelector('#slider-wave-damping') as HTMLInputElement;
    dampingSlider?.addEventListener('input', () => {
      const val = parseFloat(dampingSlider.value);
      this.visualizer.waveDamping = val;
      this.visualizer.wavefrontShells.setWaveDamping(val);
      const valEl = this.element.querySelector('#val-wave-damping');
      if (valEl) valEl.textContent = val.toFixed(2);
    });

    // Cymatics Specimen Layer Visibility Toggle
    this.element.querySelectorAll('.btn-cymatics-vis').forEach(btn => {
      btn.addEventListener('click', e => {
        const target = e.currentTarget as HTMLElement;
        const visMode = target.getAttribute('data-cymatics-vis') as 'both' | 'particles' | 'droplet';
        if (visMode) {
          this.visualizer.setCymaticsVisibilityMode(visMode);
          this.render();
          window.dispatchEvent(new CustomEvent('cymatics-visibility-changed', { detail: { mode: visMode } }));
        }
      });
    });

    // Bloom Strength
    const bloomSlider = this.element.querySelector('#slider-bloom') as HTMLInputElement;
    bloomSlider?.addEventListener('input', () => {
      const val = parseFloat(bloomSlider.value);
      this.visualizer.setBloomStrength(val);
      const valEl = this.element.querySelector('#val-bloom');
      if (valEl) valEl.textContent = val.toFixed(2);
    });

    // Particle Density (Count)
    const densitySlider = this.element.querySelector('#slider-particle-density') as HTMLInputElement;
    densitySlider?.addEventListener('input', () => {
      const val = parseInt(densitySlider.value, 10);
      this.visualizer.setParticleDensity(val);
      const valEl = this.element.querySelector('#val-particle-density');
      if (valEl) valEl.textContent = `${Math.round(val / 1024)}k`;
      window.dispatchEvent(new CustomEvent('particle-density-changed', { detail: { density: val } }));
    });

    // Particle Scale
    const particleSlider = this.element.querySelector('#slider-particle-scale') as HTMLInputElement;
    particleSlider?.addEventListener('input', () => {
      const val = parseFloat(particleSlider.value);
      this.visualizer.setParticleScale(val);
      const valEl = this.element.querySelector('#val-particle-scale');
      if (valEl) valEl.textContent = `${val.toFixed(1)}×`;
    });

    // Camera Mode
    this.element.querySelectorAll('.btn-cam-mode').forEach(btn => {
      btn.addEventListener('click', e => {
        const target = e.currentTarget as HTMLElement;
        const mode = target.getAttribute('data-camera') as CameraMode;
        if (mode) {
          this.visualizer.setCameraMode(mode);
          this.render();
        }
      });
    });
  }

  private attachGlobalToggleListener(): void {
    window.addEventListener('toggle-physics-drawer', () => {
      this.isOpen = !this.isOpen;
      this.render();
    });

    window.addEventListener('camera-mode-changed', ((e: CustomEvent<{ mode: CameraMode }>) => {
      const currentMode = e.detail?.mode || this.visualizer.getCameraMode();
      this.element.querySelectorAll('.btn-cam-mode').forEach(btn => {
        const btnMode = btn.getAttribute('data-camera');
        if (btnMode === currentMode) {
          btn.classList.add('glass-btn-active', 'font-bold');
          btn.classList.remove('text-slate-400');
        } else {
          btn.classList.remove('glass-btn-active', 'font-bold');
          btn.classList.add('text-slate-400');
        }
      });
    }) as EventListener);

    window.addEventListener('cymatics-visibility-changed', ((e: CustomEvent<{ mode: 'both' | 'particles' | 'droplet' }>) => {
      if (this.currentMode === 'modal') {
        this.render();
      }
    }) as EventListener);

    window.addEventListener('particle-density-changed', ((e: CustomEvent<{ density: number }>) => {
      const valEl = this.element.querySelector('#val-particle-density');
      const slider = this.element.querySelector('#slider-particle-density') as HTMLInputElement;
      if (valEl && e.detail?.density) {
        valEl.textContent = `${Math.round(e.detail.density / 1024)}k`;
      }
      if (slider && e.detail?.density) {
        slider.value = e.detail.density.toString();
      }
    }) as EventListener);
  }
}


