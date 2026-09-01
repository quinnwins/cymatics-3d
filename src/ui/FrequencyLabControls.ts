import { AudioEngine } from '../audio/AudioEngine';
import { WavePhysics, NoteInfo } from '../math/WavePhysics';
import { WaveformType } from '../audio/FrequencySynthesizer';

export class FrequencyLabControls {
  private element: HTMLElement;
  private currentFreq = 432;
  private isAudioPlaying = false;
  private showHarmonicsDrawer = false;

  constructor(private audioEngine: AudioEngine) {
    this.element = document.createElement('div');
    this.element.className = 'w-full flex flex-col items-center gap-2';
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
      <div class="glass-panel w-full max-w-4xl p-4 md:p-5 rounded-3xl flex flex-col gap-3 shadow-2xl">
        
        <!-- Top Row: Audio Play, Frequency Readout, Note Badge, Waveform -->
        <div class="flex flex-wrap items-center justify-between gap-3">
          
          <!-- Sound Toggle & Frequency Display -->
          <div class="flex items-center gap-3">
            <button id="btn-freq-sound-toggle" class="w-11 h-11 rounded-2xl ${
              isPlaying
                ? 'bg-gradient-to-tr from-accent-magenta to-accent-purple text-white shadow-lg shadow-accent-magenta/30 scale-105'
                : 'bg-gradient-to-tr from-accent-cyan to-accent-blue text-white shadow-lg shadow-accent-cyan/30'
            } flex items-center justify-center transition-all hover:scale-105 active:scale-95">
              ${
                isPlaying
                  ? `<svg class="w-5 h-5 fill-current" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>`
                  : `<svg class="w-5 h-5 fill-current ml-0.5" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>`
              }
            </button>

            <div class="flex items-baseline gap-2">
              <input
                type="number"
                id="freq-number-input"
                min="1"
                max="20000"
                value="${this.currentFreq}"
                class="w-24 md:w-28 bg-white/5 border border-white/10 rounded-xl px-2.5 py-1 text-lg md:text-xl font-bold font-mono text-accent-cyan text-right outline-none focus:border-accent-cyan/60"
              />
              <span class="text-sm font-semibold text-gray-400">Hz</span>
              
              <!-- Musical Note Badge -->
              <div class="glass-panel px-2.5 py-1 rounded-xl flex items-center gap-1.5 ml-1 border-accent-blue/30">
                <span class="text-sm font-bold text-accent-blue font-mono">${noteInfo.name}</span>
                <span class="text-[10px] text-gray-400">${noteInfo.cents >= 0 ? '+' : ''}${noteInfo.cents}c</span>
              </div>
            </div>
          </div>

          <!-- Waveform & Harmonics Button -->
          <div class="flex items-center gap-2">
            <!-- Waveform Selector -->
            <select id="waveform-select" class="glass-btn px-3 py-1.5 rounded-xl text-xs font-semibold text-gray-200 outline-none cursor-pointer">
              <option value="sine" ${waveform === 'sine' ? 'selected' : ''}>Pure Sine Tone</option>
              <option value="triangle" ${waveform === 'triangle' ? 'selected' : ''}>Warm Triangle</option>
              <option value="sawtooth" ${waveform === 'sawtooth' ? 'selected' : ''}>Bright Sawtooth</option>
              <option value="square" ${waveform === 'square' ? 'selected' : ''}>Hollow Square</option>
              <option value="organ" ${waveform === 'organ' ? 'selected' : ''}>Harmonic Organ</option>
            </select>

            <!-- Harmonics Matrix Toggle -->
            <button id="btn-toggle-harmonics" class="glass-btn px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 ${
              this.showHarmonicsDrawer ? 'glass-btn-active' : 'text-gray-300 hover:text-white'
            }">
              <span>🌊</span>
              <span>Overtones (${this.showHarmonicsDrawer ? 'Hide' : 'Show'})</span>
            </button>
          </div>
        </div>

        <!-- Master Frequency Slider -->
        <div class="flex flex-col gap-1.5 w-full">
          <div class="flex justify-between text-[11px] text-gray-400 font-medium px-1">
            <span>20 Hz (Deep Sub)</span>
            <span>250 Hz (Warm Bass)</span>
            <span>1,000 Hz (Vocal Mid)</span>
            <span>4,000 Hz (High Treble)</span>
            <span>20,000 Hz</span>
          </div>
          <input
            type="range"
            id="freq-master-slider"
            min="0"
            max="1000"
            value="${sliderVal}"
            class="w-full cursor-pointer h-2"
          />
        </div>

        <!-- Sacred Solfeggio & Harmonic Note Presets -->
        <div class="flex flex-wrap items-center gap-1.5 pt-1">
          <span class="text-[11px] text-gray-400 font-semibold mr-1">Quick Resonance:</span>
          ${[
            { hz: 432, name: '432 Hz', desc: 'Verdi Harmony' },
            { hz: 528, name: '528 Hz', desc: 'Transformation' },
            { hz: 639, name: '639 Hz', desc: 'Connection' },
            { hz: 440, name: '440 Hz', desc: 'Concert A4' },
            { hz: 108, name: '108 Hz', desc: 'Deep Sacred' },
            { hz: 256, name: '256 Hz', desc: 'Scientific C4' },
          ]
            .map(
              p => `
            <button data-hz="${p.hz}" class="btn-solfeggio glass-btn px-2.5 py-1 rounded-lg text-xs font-medium ${
                this.currentFreq === p.hz ? 'glass-btn-active text-accent-cyan' : 'text-gray-300 hover:text-white'
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
          <div class="glass-panel p-3 rounded-2xl mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2.5 border-accent-blue/20">
            ${[1, 2, 3, 4, 5, 6, 7, 8]
              .map(h => {
                const weight = synth ? (synth.harmonics as unknown as Record<string, number>)[`h${h}`] || 0 : 0;
                return `
                <div class="flex flex-col gap-1 bg-white/5 p-2 rounded-xl border border-white/5">
                  <div class="flex justify-between text-[11px]">
                    <span class="font-bold text-gray-300">${h}× (${this.currentFreq * h} Hz)</span>
                    <span class="font-mono text-accent-cyan">${Math.round(weight * 100)}%</span>
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

  private attachEvents(): void {
    // Sound Toggle
    this.element.querySelector('#btn-freq-sound-toggle')?.addEventListener('click', async () => {
      await this.audioEngine.initialize();
      if (this.audioEngine.synthesizer?.getIsPlaying()) {
        this.audioEngine.stopFrequency();
      } else {
        this.audioEngine.playFrequency(this.currentFreq);
      }
      this.render();
    });

    // Master Slider
    const slider = this.element.querySelector('#freq-master-slider') as HTMLInputElement;
    slider?.addEventListener('input', () => {
      const hz = this.sliderToHz(parseFloat(slider.value));
      this.setFrequency(hz);
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
      this.render();
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
  }

  public setFrequency(hz: number): void {
    this.currentFreq = Math.max(1, Math.min(20000, hz));
    if (this.audioEngine.synthesizer) {
      this.audioEngine.synthesizer.setFrequency(this.currentFreq);
    }
    this.render();
  }
}
