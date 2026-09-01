import { VisualizerEngine, CameraMode } from '../visualizer/VisualizerEngine';

export class PhysicsDrawer {
  private element: HTMLElement;
  private isOpen = false;

  constructor(private visualizer: VisualizerEngine) {
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

  private preventEventBleeding(): void {
    this.element.addEventListener('wheel', e => e.stopPropagation(), { passive: false });
    this.element.addEventListener('pointerdown', e => e.stopPropagation());
  }

  private render(): void {
    this.element.innerHTML = `
      <!-- Accordion Header -->
      <button id="btn-toggle-accordion-physics" class="w-full flex items-center justify-between cursor-pointer group text-left">
        <div class="flex items-center gap-2">
          <span class="text-xs font-bold text-slate-200 tracking-wide">Physics & Camera</span>
        </div>
        <span class="text-xs text-slate-400 group-hover:text-white transition-transform font-mono">
          ${this.isOpen ? '▲' : '▼'}
        </span>
      </button>

      <!-- Collapsible Body -->
      <div id="physics-body" class="${this.isOpen ? 'flex' : 'hidden'} flex-col gap-3 text-xs pt-2 border-t border-white/10">
        
        <!-- Wave Propagation Speed (c) -->
        <div class="flex flex-col gap-1">
          <div class="flex justify-between text-slate-300">
            <span>Wave Speed</span>
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
            <span>Sound Absorption</span>
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

        <!-- Bloom & Glow Intensity -->
        <div class="flex flex-col gap-1">
          <div class="flex justify-between text-slate-300">
            <span>Glow Brightness</span>
            <span id="val-bloom" class="font-mono text-cyan-400">${this.visualizer.bloomStrength.toFixed(1)}</span>
          </div>
          <input
            type="range"
            id="slider-bloom"
            min="0.2"
            max="3.0"
            step="0.1"
            value="${this.visualizer.bloomStrength}"
            class="w-full cursor-pointer"
          />
        </div>

        <!-- Particle Size Scale -->
        <div class="flex flex-col gap-1">
          <div class="flex justify-between text-slate-300">
            <span>Particle Size</span>
            <span id="val-particle-scale" class="font-mono text-cyan-400">${this.visualizer.particleScale.toFixed(1)}×</span>
          </div>
          <input
            type="range"
            id="slider-particle-scale"
            min="0.5"
            max="2.5"
            step="0.1"
            value="${this.visualizer.particleScale}"
            class="w-full cursor-pointer"
          />
        </div>

        <!-- Camera Perspective Mode -->
        <div class="flex flex-col gap-1.5 pt-1 border-t border-white/10">
          <span class="text-slate-300 font-semibold text-[11px]">Camera View:</span>
          <div class="grid grid-cols-2 gap-1.5">
            ${[
              { id: 'autocam', label: 'Cinematic' },
              { id: 'orbit', label: 'Free Orbit' },
              { id: 'emitter-lock', label: 'Focus Center' },
              { id: 'top-down', label: 'Top-Down View' },
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
    `;

    this.attachEvents();
  }

  private attachEvents(): void {
    // Accordion Toggle
    this.element.querySelector('#btn-toggle-accordion-physics')?.addEventListener('click', () => {
      this.isOpen = !this.isOpen;
      this.render();
    });

    // Wave Speed
    const speedSlider = this.element.querySelector('#slider-wave-speed') as HTMLInputElement;
    speedSlider?.addEventListener('input', () => {
      const val = parseFloat(speedSlider.value);
      this.visualizer.waveSpeed = val;
      this.visualizer.wavefrontShells.setPropagationSpeed(val);
      this.visualizer.particleNebula.setPropagationSpeed(val);
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

    // Bloom
    const bloomSlider = this.element.querySelector('#slider-bloom') as HTMLInputElement;
    bloomSlider?.addEventListener('input', () => {
      const val = parseFloat(bloomSlider.value);
      this.visualizer.bloomStrength = val;
      const valEl = this.element.querySelector('#val-bloom');
      if (valEl) valEl.textContent = val.toFixed(1);
    });

    // Particle Scale
    const particleSlider = this.element.querySelector('#slider-particle-scale') as HTMLInputElement;
    particleSlider?.addEventListener('input', () => {
      const val = parseFloat(particleSlider.value);
      this.visualizer.particleScale = val;
      this.visualizer.particleNebula.setParticleScale(val);
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
  }
}
