import { AudioEngine } from '../audio/AudioEngine';
import { WavePhysics, NoteInfo } from '../math/WavePhysics';
import { WaveformType } from '../audio/FrequencySynthesizer';
import { EngineMode } from './Header';
import { VisualizerEngine } from '../visualizer/VisualizerEngine';

export class FrequencyLabControls {
  private element: HTMLElement;
  private currentFreq = 432;
  private isAudioPlaying = false;
  private showHarmonicsDrawer = false;
  private onSwitchMode?: (mode: EngineMode) => void;

  constructor(
    private audioEngine: AudioEngine,
    private visualizer?: VisualizerEngine,
    onSwitchMode?: (mode: EngineMode) => void
  ) {
    this.onSwitchMode = onSwitchMode;
    this.element = document.createElement('div');
    this.element.className = 'w-full flex flex-col gap-2.5';
    this.preventEventBleeding();
  }

  private preventEventBleeding(): void {
    this.element.addEventListener('wheel', e => e.stopPropagation(), { passive: false });
    this.element.addEventListener('pointerdown', e => e.stopPropagation());
  }

  public getElement(): HTMLElement {
    this.render();
    return this.element;
  }

  // Convert linear slider [0..1000] to logarithmic Hz [20..20000]
  private sliderToHz(val: number): number {
    const minHz = 20;
    const maxHz = 20000;
    return Math.round(minHz * Math.pow(maxHz / minHz, val / 1000));
  }

  // Convert Hz [20..20000] to linear slider [0..1000]
  private hzToSlider(hz: number): number {
    const minHz = 20;
    const maxHz = 20000;
    const clamped = Math.max(minHz, Math.min(maxHz, hz));
    return Math.round((1000 * Math.log(clamped / minHz)) / Math.log(maxHz / minHz));
  }

  public render(): void {
    const noteInfo: NoteInfo = WavePhysics.frequencyToNote(this.currentFreq);
    const synth = this.audioEngine.synthesizer;
    const isPlaying = synth ? synth.getIsPlaying() : false;
    const waveform = synth ? synth.waveform : 'sine';
    const sliderVal = this.hzToSlider(this.currentFreq);

    this.element.innerHTML = `
      <!-- Acoustic Studio Hub Switcher -->
      <div class="glass-panel p-1 rounded-2xl flex items-center gap-1 bg-slate-900/60 border border-white/10 text-xs mb-1">
        <button id="hub-btn-modal" class="flex-1 py-1 px-1.5 rounded-xl font-semibold text-center transition-all cursor-pointer text-gray-400 hover:text-white hover:bg-white/5">
          3D Cymatics
        </button>
        <button id="hub-btn-freq" class="flex-1 py-1 px-1.5 rounded-xl font-bold text-center transition-all cursor-pointer glass-btn-active text-blue-300 shadow-sm ring-1 ring-blue-500/30">
          Tone Lab
        </button>
      </div>

      <div class="glass-panel w-full p-3.5 sm:p-4 rounded-3xl flex flex-col gap-3 shadow-xl border border-white/10 text-white select-none">
        
        <!-- Top Row: Audio Play, Frequency Readout, Note Badge, Waveform -->
        <div class="flex flex-col gap-2.5 border-b border-white/10 pb-2.5">
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              <div class="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-cyan-400 font-mono text-sm font-bold shrink-0 shadow-sm">
                Hz
              </div>
              <div>
                <h3 class="text-xs sm:text-sm font-bold text-white">Tone Generator</h3>
                <p class="text-[10px] text-gray-400">Pure frequencies and harmonic overtones</p>
              </div>
            </div>

            <!-- Sound Toggle -->
            <button id="btn-freq-sound-toggle" class="w-8 h-8 rounded-xl ${
              isPlaying
                ? 'bg-cyan-400 text-slate-950 font-bold hover:bg-cyan-300'
                : 'bg-slate-800 text-white border border-slate-700 hover:bg-slate-700'
            } flex items-center justify-center transition-all active:scale-95 shrink-0 cursor-pointer shadow-sm">
              ${
                isPlaying
                  ? `<svg class="w-4 h-4 fill-current" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>`
                  : `<svg class="w-4 h-4 fill-current ml-0.5" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>`
              }
            </button>
          </div>

          <!-- Frequency Display & Waveform -->
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-baseline gap-1.5">
              <input
                type="number"
                id="freq-number-input"
                min="1"
                max="20000"
                value="${this.currentFreq}"
                class="w-20 bg-slate-900 border border-white/10 rounded-xl px-2 py-1 text-sm font-bold font-mono text-cyan-400 text-right outline-none focus:border-cyan-400/60"
              />
              <span class="text-xs font-semibold text-gray-400">Hz</span>
              
              <!-- Musical Note Badge -->
              <div class="glass-panel px-2 py-0.5 rounded-lg flex items-center gap-1 border-slate-700 bg-slate-900/80">
                <span class="text-xs font-bold text-blue-400 font-mono">${noteInfo.name}</span>
                <span class="text-[9px] text-gray-400 font-mono">${noteInfo.cents >= 0 ? '+' : ''}${noteInfo.cents}c</span>
              </div>
            </div>

            <!-- Waveform Selector & Harmonics Button -->
            <div class="flex items-center gap-1.5">
              <select id="waveform-select" class="glass-btn px-2 py-1 rounded-xl text-xs font-semibold text-gray-200 bg-slate-900 border border-white/10 outline-none cursor-pointer">
                <option value="sine" ${waveform === 'sine' ? 'selected' : ''}>Sine</option>
                <option value="triangle" ${waveform === 'triangle' ? 'selected' : ''}>Triangle</option>
                <option value="sawtooth" ${waveform === 'sawtooth' ? 'selected' : ''}>Saw</option>
                <option value="square" ${waveform === 'square' ? 'selected' : ''}>Square</option>
                <option value="organ" ${waveform === 'organ' ? 'selected' : ''}>Organ</option>
              </select>

              <button id="btn-toggle-harmonics" class="glass-btn px-2 py-1 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                this.showHarmonicsDrawer ? 'glass-btn-active font-bold' : 'text-gray-300 hover:text-white'
              }">
                <span>Overtones</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Master Frequency Slider -->
        <div class="flex flex-col gap-1 w-full">
          <div class="flex justify-between text-[9px] md:text-[10px] text-gray-400 font-medium px-1 font-mono">
            <span>20 Hz (Deep Bass)</span>
            <span>250 Hz (Warm Bass)</span>
            <span>1,000 Hz (Mid)</span>
            <span>4,000 Hz (Treble)</span>
            <span>20,000 Hz</span>
          </div>
          <input
            type="range"
            id="freq-master-slider"
            min="0"
            max="1000"
            value="${sliderVal}"
            class="w-full cursor-pointer"
          />
        </div>

        <!-- Quick Resonance Presets -->
        <div class="flex items-center gap-1.5 pt-1 overflow-x-auto no-scrollbar flex-nowrap">
          <span class="text-[10px] md:text-[11px] text-gray-400 font-semibold whitespace-nowrap shrink-0">Quick Frequencies:</span>
          ${[
            { hz: 432, name: '432 Hz', desc: 'Natural A' },
            { hz: 528, name: '528 Hz', desc: 'Clear Tone' },
            { hz: 639, name: '639 Hz', desc: 'Mid Tone' },
            { hz: 440, name: '440 Hz', desc: 'Concert A (A4)' },
            { hz: 108, name: '108 Hz', desc: 'Deep Bass' },
            { hz: 256, name: '256 Hz', desc: 'Middle C (C4)' },
          ]
            .map(
              p => `
            <button data-hz="${p.hz}" title="${p.name} - ${p.desc}" class="btn-solfeggio glass-btn px-2.5 py-1 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-all ${
                this.currentFreq === p.hz ? 'glass-btn-active font-bold' : 'text-gray-300 hover:text-white'
              }">
              ${p.name}
            </button>
          `
            )
            .join('')}
        </div>

        <!-- Harmonics Matrix Drawer (Collapsible) -->
        ${
          this.showHarmonicsDrawer
            ? `
          <div class="glass-panel p-2.5 rounded-2xl mt-2 grid grid-cols-2 gap-2 border-slate-700/60 bg-slate-900/60">
            ${[1, 2, 3, 4, 5, 6, 7, 8]
              .map(h => {
                const weight = synth ? (synth.harmonics as unknown as Record<string, number>)[`h${h}`] || 0 : 0;
                return `
                <div class="flex flex-col gap-1 bg-white/5 p-2 rounded-xl border border-white/5">
                  <div class="flex justify-between text-[11px]">
                    <span class="font-bold text-gray-300">${h}× (${this.currentFreq * h} Hz)</span>
                    <span class="font-mono text-cyan-400">${Math.round(weight * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value="${weight}"
                    data-harmonic="${h}"
                    class="harmonic-slider cursor-pointer w-full"
                  />
                </div>
              `;
              })
              .join('')}
          </div>
        `
            : ''
        }

      </div>
    `;

    this.attachEvents();
  }

  private updateDisplay(fromSlider = false): void {
    const noteInfo: NoteInfo = WavePhysics.frequencyToNote(this.currentFreq);
    const synth = this.audioEngine.synthesizer;
    const isPlaying = synth ? synth.getIsPlaying() : false;

    const numInput = this.element.querySelector('#freq-number-input') as HTMLInputElement;
    if (numInput && document.activeElement !== numInput) {
      numInput.value = this.currentFreq.toString();
    }

    const slider = this.element.querySelector('#freq-master-slider') as HTMLInputElement;
    if (slider && !fromSlider) {
      slider.value = this.hzToSlider(this.currentFreq).toString();
    }

    const soundBtn = this.element.querySelector('#btn-freq-sound-toggle');
    if (soundBtn) {
      soundBtn.className = `w-8 h-8 rounded-xl ${
        isPlaying
          ? 'bg-cyan-400 text-slate-950 font-bold hover:bg-cyan-300'
          : 'bg-slate-800 text-white border border-slate-700 hover:bg-slate-700'
      } flex items-center justify-center transition-all active:scale-95 shrink-0 cursor-pointer shadow-sm`;
      soundBtn.innerHTML = isPlaying
        ? `<svg class="w-4 h-4 fill-current" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>`
        : `<svg class="w-4 h-4 fill-current ml-0.5" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
    }

    // Update Solfeggio button highlights
    this.element.querySelectorAll('.btn-solfeggio').forEach(btn => {
      const hz = parseFloat(btn.getAttribute('data-hz') || '0');
      if (Math.abs(hz - this.currentFreq) < 0.5) {
        btn.className = 'btn-solfeggio glass-btn px-2.5 py-1 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-all glass-btn-active font-bold';
      } else {
        btn.className = 'btn-solfeggio glass-btn px-2.5 py-1 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-all text-gray-300 hover:text-white';
      }
    });
  }

  private attachEvents(): void {
    // Sound Toggle
    this.element.querySelector('#btn-freq-sound-toggle')?.addEventListener('click', async () => {
      await this.audioEngine.initialize();
      if (this.audioEngine.synthesizer?.getIsPlaying()) {
        this.audioEngine.stopFrequency();
      } else {
        this.audioEngine.playFrequency(this.currentFreq);
      }
      this.updateDisplay();
    });

    // Master Slider
    const slider = this.element.querySelector('#freq-master-slider') as HTMLInputElement;
    slider?.addEventListener('input', () => {
      const hz = this.sliderToHz(parseFloat(slider.value));
      this.setFrequency(hz, true);
    });

    // Number Box
    const numInput = this.element.querySelector('#freq-number-input') as HTMLInputElement;
    numInput?.addEventListener('change', () => {
      const hz = parseFloat(numInput.value);
      if (!isNaN(hz)) {
        this.setFrequency(hz);
      }
    });

    // Solfeggio buttons
    this.element.querySelectorAll('.btn-solfeggio').forEach(btn => {
      btn.addEventListener('click', e => {
        const target = e.currentTarget as HTMLElement;
        const hz = parseFloat(target.getAttribute('data-hz') || '432');
        this.setFrequency(hz);
      });
    });

    // Waveform selector
    this.element.querySelector('#waveform-select')?.addEventListener('change', e => {
      const select = e.target as HTMLSelectElement;
      this.audioEngine.synthesizer?.setWaveform(select.value as WaveformType);
    });

    // Harmonics drawer toggle
    this.element.querySelector('#btn-toggle-harmonics')?.addEventListener('click', () => {
      this.showHarmonicsDrawer = !this.showHarmonicsDrawer;
      this.render();
    });

    // Harmonics sliders
    this.element.querySelectorAll('.harmonic-slider').forEach(hSlider => {
      hSlider.addEventListener('input', e => {
        const target = e.target as HTMLInputElement;
        const h = parseInt(target.getAttribute('data-harmonic') || '1', 10);
        const weight = parseFloat(target.value);
        this.audioEngine.synthesizer?.setHarmonicWeight(h, weight);
      });
    });

    // Acoustic Studio Hub Switcher
    this.element.querySelector('#hub-btn-modal')?.addEventListener('click', () => {
      if (this.onSwitchMode) this.onSwitchMode('modal');
    });
  }

  public setFrequency(hz: number, fromSlider = false): void {
    this.currentFreq = Math.max(1, Math.min(20000, hz));
    if (this.audioEngine.synthesizer) {
      this.audioEngine.synthesizer.setFrequency(this.currentFreq);
    }
    if (this.visualizer) {
      this.visualizer.cymaticsMesh.setFrequency(this.currentFreq);
    }
    this.updateDisplay(fromSlider);
  }
}
