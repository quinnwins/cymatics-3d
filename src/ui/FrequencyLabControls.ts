/**
 * FrequencyLabControls.ts
 * SoundForm 3D — Precision Acoustic Frequency & Harmonic Synthesizer Deck
 *
 * Provides a dedicated tone generation suite:
 * 1. Master Pure Tone Synthesizer: Precision Hz numeric input, note/cents badge, waveform chips, log slider, octave multipliers & fine steppers.
 * 2. Solfeggio & Sacred Presets: 1-click resonant harmonic matrix (174 Hz to 963 Hz, 108 Hz, 256 Hz).
 * 3. Harmonic Overtones Series: 8-harmonic drawbar engine with live overtone calculations and timbre presets.
 * 4. Binaural Beats Engine: Stereo carrier frequency modulation for Delta, Theta, Alpha, Beta, and Gamma entrainment.
 */

import { AudioEngine } from '../audio/AudioEngine';
import { WavePhysics, NoteInfo } from '../math/WavePhysics';
import { WaveformType } from '../audio/FrequencySynthesizer';
import { VisualizerEngine } from '../visualizer/VisualizerEngine';

export type ChamberGeometry = 'cube' | 'cylinder' | 'sphere';
export type TrappingMode = 'nodes' | 'antinodes';

export interface ApparatusLayers {
  plate: boolean;
  droplet: boolean;
  trap: boolean;
}

export class FrequencyLabControls {
  private element: HTMLElement;
  private currentFreq = 432;
  private isPlaying = false;
  private binauralBeatHz = 7.83; // Schumann Resonance default
  private isBinauralActive = false;

  // Accordion section states
  private openSection: 'solfeggio' | 'harmonics' | 'binaural' | 'none' = 'solfeggio';

  // Resonator state cache for backwards-compatible queries & synchronization
  private geometry: ChamberGeometry = 'cube';
  private showEnclosure = false;
  private trappingMode: TrappingMode = 'nodes';
  private audioCoupled = true;
  private apparatusLayers: ApparatusLayers = { plate: false, droplet: true, trap: true };

  private unsubscribe?: () => void;
  private modalStateListener?: EventListener;
  private freqListener?: EventListener;
  private waveformListener?: EventListener;

  constructor(
    private audioEngine: AudioEngine,
    private visualizer?: VisualizerEngine
  ) {
    if (this.visualizer) {
      const initialLayers = this.visualizer.getCymaticsLayers();
      if (initialLayers) {
        this.apparatusLayers = {
          plate: Boolean(initialLayers.plate),
          droplet: Boolean(initialLayers.droplet),
          trap: Boolean(initialLayers.trap),
        };
      }
    }
    this.element = document.createElement('div');
    this.element.className = 'w-full flex flex-col gap-2.5 select-none transition-all duration-300';
    this.preventEventBleeding();

    // Cross-column state synchronization listeners
    this.modalStateListener = ((e: CustomEvent<{
      geometry?: ChamberGeometry;
      trappingMode?: TrappingMode;
      showEnclosure?: boolean;
      audioCoupled?: boolean;
      apparatusLayers?: ApparatusLayers;
    }>) => {
      if (e.detail) {
        if (e.detail.geometry) this.geometry = e.detail.geometry;
        if (e.detail.trappingMode) this.trappingMode = e.detail.trappingMode;
        if (typeof e.detail.showEnclosure === 'boolean') this.showEnclosure = e.detail.showEnclosure;
        if (typeof e.detail.audioCoupled === 'boolean') this.audioCoupled = e.detail.audioCoupled;
        if (e.detail.apparatusLayers) this.apparatusLayers = { ...e.detail.apparatusLayers };
      }
    }) as EventListener;

    this.freqListener = ((e: CustomEvent<{ frequency: number; source?: string }>) => {
      if (e.detail?.frequency && Math.abs(e.detail.frequency - this.currentFreq) >= 0.01) {
        if (e.detail.source !== 'freq-controls') {
          this.setFrequency(e.detail.frequency, false);
        }
      }
    }) as EventListener;

    this.waveformListener = ((e: CustomEvent<{ waveform: WaveformType }>) => {
      if (e.detail?.waveform) {
        this.render();
      }
    }) as EventListener;

    window.addEventListener('modal-state-changed', this.modalStateListener);
    window.addEventListener('frequency-changed', this.freqListener);
    window.addEventListener('waveform-changed', this.waveformListener);

    this.unsubscribe = this.audioEngine.subscribe(() => {
      const synthPlaying = this.audioEngine.synthesizer?.getIsPlaying() ?? false;
      if (synthPlaying !== this.isPlaying) {
        this.isPlaying = synthPlaying;
        this.updatePlayStateUI();
      }
    });
  }

  public destroy(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = undefined;
    }
    if (this.modalStateListener) {
      window.removeEventListener('modal-state-changed', this.modalStateListener);
    }
    if (this.freqListener) {
      window.removeEventListener('frequency-changed', this.freqListener);
    }
    if (this.waveformListener) {
      window.removeEventListener('waveform-changed', this.waveformListener);
    }
  }

  public setVisualizer(visualizer: VisualizerEngine): void {
    this.visualizer = visualizer;
  }

  private preventEventBleeding(): void {
    this.element.addEventListener('wheel', e => e.stopPropagation(), { passive: false });
  }

  public getElement(): HTMLElement {
    this.render();
    return this.element;
  }

  public getGeometry(): ChamberGeometry {
    return this.geometry;
  }

  public getShowEnclosure(): boolean {
    return this.showEnclosure;
  }

  public getTrappingMode(): TrappingMode {
    return this.trappingMode;
  }

  public getAudioCoupled(): boolean {
    return this.audioCoupled;
  }

  public getApparatusLayers(): ApparatusLayers {
    return { ...this.apparatusLayers };
  }

  public getCymaticsVisibilityMode(): 'both' | 'particles' | 'droplet' | 'plate' {
    if (this.apparatusLayers.plate && !this.apparatusLayers.droplet && !this.apparatusLayers.trap) return 'plate';
    if (this.apparatusLayers.droplet && this.apparatusLayers.trap) return 'both';
    if (this.apparatusLayers.droplet) return 'droplet';
    return 'particles';
  }

  public getFrequency(): number {
    return this.currentFreq;
  }

  public setFrequency(hz: number, dispatchEvent = true): void {
    const clampedHz = Math.max(1, Math.min(20000, Math.round(hz * 10) / 10));
    if (Math.abs(this.currentFreq - clampedHz) < 0.01) return;

    this.currentFreq = clampedHz;

    // Update synthesizer
    if (this.audioEngine.synthesizer) {
      this.audioEngine.synthesizer.setFrequency(this.currentFreq);
    }

    // Dynamic physical wave coupling on 3D visualizer
    if (this.visualizer) {
      if (this.visualizer.cymaticsMesh) {
        this.visualizer.cymaticsMesh.setFrequency(this.currentFreq);
      }
      if (this.visualizer.cymaticsPlateMesh) {
        this.visualizer.cymaticsPlateMesh.setFrequency(this.currentFreq);
      }
      const speed = Math.max(1.0, Math.min(15.0, this.currentFreq / 50.0));
      this.visualizer.waveSpeed = speed;
    }

    if (dispatchEvent) {
      window.dispatchEvent(
        new CustomEvent('frequency-changed', {
          detail: { frequency: this.currentFreq, source: 'freq-controls' },
        })
      );
    }

    this.updateFrequencyDisplay();
  }

  // Convert linear slider [0..1000] to Hz [20..20000] logarithmically
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
    this.isPlaying = synth ? synth.getIsPlaying() : false;
    const waveform = synth ? synth.waveform : 'sine';
    const sliderVal = this.hzToSlider(this.currentFreq);
    const sliderPct = Math.round((sliderVal / 1000) * 100);

    this.element.innerHTML = `
      <div class="glass-panel w-full p-3.5 sm:p-4 rounded-3xl flex flex-col gap-3 shadow-xl border border-white/10 text-white select-none backdrop-blur-xl">
        
        <!-- Header & Main Tone Generator -->
        <div class="flex flex-col gap-2.5 border-b border-white/10 pb-2.5">
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              <div class="w-7 h-7 rounded-xl bg-slate-900 border border-white/15 flex items-center justify-center text-cyan-400 font-mono text-xs font-bold shrink-0 shadow-sm">
                Hz
              </div>
              <div>
                <h3 class="text-xs sm:text-sm font-bold text-white tracking-tight">Frequency Lab</h3>
                <p class="text-[10px] text-slate-400 font-medium">Pure acoustic synthesizer & harmonics</p>
              </div>
            </div>

            <!-- Sound Play/Pause Toggle Button -->
            <button
              id="btn-freq-sound-toggle"
              class="w-8 h-8 rounded-xl ${
                this.isPlaying
                  ? 'bg-cyan-400 text-slate-950 font-bold hover:bg-cyan-300 shadow-md shadow-cyan-400/40 ring-2 ring-cyan-300/50'
                  : 'bg-slate-900 text-white border border-slate-700 hover:bg-slate-800'
              } flex items-center justify-center transition-all active:scale-95 shrink-0 cursor-pointer shadow-sm"
              aria-label="${this.isPlaying ? 'Stop Tone' : 'Play Tone'}"
              title="${this.isPlaying ? 'Stop Tone' : 'Play Tone'}"
            >
              ${
                this.isPlaying
                  ? `<svg class="w-4 h-4 fill-current" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>`
                  : `<svg class="w-4 h-4 fill-current ml-0.5" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>`
              }
            </button>
          </div>

          <!-- Precision Frequency Input & Musical Note Readout -->
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-baseline gap-1.5">
              <input
                type="number"
                id="freq-number-input"
                min="1"
                max="20000"
                value="${this.currentFreq}"
                aria-label="Target frequency in Hertz"
                class="w-20 bg-slate-950/90 border border-white/15 rounded-xl px-2 py-1 text-sm font-bold font-mono text-cyan-400 text-right outline-none focus:border-cyan-400/80 shadow-inner tabular-nums"
              />
              <span class="text-xs font-semibold text-slate-400 font-mono">Hz</span>
              
              <!-- Musical Note Badge -->
              <div class="glass-panel px-2 py-0.5 rounded-lg flex items-center gap-1 border-white/10 bg-slate-950/80">
                <span id="label-note-name" class="text-xs font-bold text-blue-400 font-mono">${noteInfo.name}</span>
                <span id="label-note-cents" class="text-[9px] text-slate-400 font-mono tabular-nums">${noteInfo.cents >= 0 ? '+' : ''}${noteInfo.cents}c</span>
              </div>
            </div>

            <!-- Waveform Selector Chips -->
            <select id="waveform-select" aria-label="Oscillator Waveform Shape" class="glass-btn px-2 py-1 rounded-xl text-xs font-semibold text-slate-200 bg-slate-950 border border-white/10 outline-none cursor-pointer">
              <option value="sine" ${waveform === 'sine' ? 'selected' : ''}>Sine (~)</option>
              <option value="triangle" ${waveform === 'triangle' ? 'selected' : ''}>Triangle (/\)</option>
              <option value="sawtooth" ${waveform === 'sawtooth' ? 'selected' : ''}>Saw (/\_)</option>
              <option value="square" ${waveform === 'square' ? 'selected' : ''}>Square (⎍)</option>
              <option value="organ" ${waveform === 'organ' ? 'selected' : ''}>Organ (𝅘𝅥𝅯)</option>
            </select>
          </div>
        </div>

        <!-- Master Logarithmic Frequency Slider with Dynamic Filled Track -->
        <div class="flex flex-col gap-1 w-full">
          <div class="flex justify-between text-[9px] text-slate-400 font-medium px-0.5 font-mono">
            <span>20Hz (Sub)</span>
            <span>250Hz</span>
            <span>1kHz</span>
            <span>4kHz</span>
            <span>20kHz</span>
          </div>
          <input
            type="range"
            id="freq-master-slider"
            min="0"
            max="1000"
            value="${sliderVal}"
            aria-label="Frequency pitch slider"
            style="background: linear-gradient(to right, #38bdf8 ${sliderPct}%, rgba(255, 255, 255, 0.1) ${sliderPct}%);"
            class="w-full min-w-0 cursor-pointer slider-cyan"
          />

          <!-- Multiplier & Precision Stepper Grid -->
          <div class="grid grid-cols-6 gap-1 pt-1">
            <button data-multiplier="0.5" aria-label="Halve frequency (Down 1 Octave)" class="btn-freq-mult py-1 rounded-lg text-[10px] font-mono font-bold bg-slate-950/80 hover:bg-slate-900 text-cyan-300 border border-white/10 cursor-pointer shadow-sm active:scale-95 transition-all">÷2</button>
            <button data-delta-hz="-10" aria-label="Decrease 10 Hz" class="btn-freq-step py-1 rounded-lg text-[10px] font-mono font-bold bg-slate-950/80 hover:bg-slate-900 text-slate-300 border border-white/10 cursor-pointer shadow-sm active:scale-95 transition-all">-10Hz</button>
            <button data-delta-hz="-1" aria-label="Decrease 1 Hz" class="btn-freq-step py-1 rounded-lg text-[10px] font-mono font-bold bg-slate-950/80 hover:bg-slate-900 text-slate-300 border border-white/10 cursor-pointer shadow-sm active:scale-95 transition-all">-1Hz</button>
            <button data-delta-hz="1" aria-label="Increase 1 Hz" class="btn-freq-step py-1 rounded-lg text-[10px] font-mono font-bold bg-slate-950/80 hover:bg-slate-900 text-slate-300 border border-white/10 cursor-pointer shadow-sm active:scale-95 transition-all">+1Hz</button>
            <button data-delta-hz="10" aria-label="Increase 10 Hz" class="btn-freq-step py-1 rounded-lg text-[10px] font-mono font-bold bg-slate-950/80 hover:bg-slate-900 text-slate-300 border border-white/10 cursor-pointer shadow-sm active:scale-95 transition-all">+10Hz</button>
            <button data-multiplier="2" aria-label="Double frequency (Up 1 Octave)" class="btn-freq-mult py-1 rounded-lg text-[10px] font-mono font-bold bg-slate-950/80 hover:bg-slate-900 text-cyan-300 border border-white/10 cursor-pointer shadow-sm active:scale-95 transition-all">×2</button>
          </div>
        </div>

        <!-- ACCORDION 1: SOLFEGGIO & SACRED HARMONIC MATRIX -->
        <div class="flex flex-col bg-slate-950/60 rounded-2xl border border-white/5 overflow-hidden">
          <button id="btn-toggle-solfeggio" class="w-full p-2.5 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors text-left">
            <div class="flex items-center gap-1.5">
              <span class="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
              <span class="text-xs font-bold text-slate-200">Solfeggio & Sacred Matrix</span>
            </div>
            <span class="text-[10px] text-slate-400 font-mono">${this.openSection === 'solfeggio' ? '▲' : '▼'}</span>
          </button>

          <div class="${this.openSection === 'solfeggio' ? 'grid' : 'hidden'} grid-cols-3 sm:grid-cols-4 gap-1 p-2 pt-0 border-t border-white/5">
            ${[
              { hz: 174, name: '174 Hz', desc: 'Foundation' },
              { hz: 285, name: '285 Hz', desc: 'Regeneration' },
              { hz: 396, name: '396 Hz', desc: 'Root Base' },
              { hz: 417, name: '417 Hz', desc: 'Transmutation' },
              { hz: 432, name: '432 Hz', desc: 'Cosmic A' },
              { hz: 528, name: '528 Hz', desc: 'Transformation' },
              { hz: 639, name: '639 Hz', desc: 'Harmonics' },
              { hz: 741, name: '741 Hz', desc: 'Clarity' },
              { hz: 852, name: '852 Hz', desc: 'Intuition' },
              { hz: 963, name: '963 Hz', desc: 'Crown' },
              { hz: 108, name: '108 Hz', desc: 'Sacred Bass' },
              { hz: 256, name: '256 Hz', desc: 'Scientific C' },
            ]
              .map(
                p => `
              <button
                data-hz="${p.hz}"
                title="${p.name} - ${p.desc}"
                class="btn-solfeggio py-1 px-1.5 rounded-xl text-[10px] font-mono font-semibold truncate transition-all cursor-pointer ${
                  Math.abs(this.currentFreq - p.hz) < 0.5
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/50 ring-1 ring-cyan-400/30 shadow-sm font-bold bg-slate-800'
                    : 'bg-slate-900/60 border border-white/5 hover:border-white/20 text-slate-300'
                }"
              >
                ${p.name}
              </button>
            `
              )
              .join('')}
          </div>
        </div>

        <!-- ACCORDION 2: ADDITIVE HARMONIC GENERATOR -->
        <div class="flex flex-col bg-slate-950/60 rounded-2xl border border-white/5 overflow-hidden">
          <button id="btn-toggle-harmonics" class="w-full p-2.5 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors text-left">
            <div class="flex items-center gap-1.5">
              <span class="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
              <span class="text-xs font-bold text-slate-200">Additive Harmonic Generator</span>
            </div>
            <span class="text-[10px] text-slate-400 font-mono">${this.openSection === 'harmonics' ? '▲' : '▼'}</span>
          </button>

          <div class="${this.openSection === 'harmonics' ? 'flex' : 'hidden'} flex-col gap-1.5 p-2 pt-0 border-t border-white/5">
            <!-- Timbre Quick Presets -->
            <div class="grid grid-cols-4 gap-1 text-[9px] font-semibold pt-1">
              <button data-timbre="pure" class="btn-timbre py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-white/5 cursor-pointer">Pure 1f</button>
              <button data-timbre="warm" class="btn-timbre py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-white/5 cursor-pointer">Warm 1/n</button>
              <button data-timbre="odd" class="btn-timbre py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-white/5 cursor-pointer">Hollow</button>
              <button data-timbre="organ" class="btn-timbre py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-white/5 cursor-pointer">Octaves</button>
            </div>

            <!-- 8 Harmonic Drawbar Sliders -->
            <div class="grid grid-cols-2 gap-1.5 pt-1">
              ${[1, 2, 3, 4, 5, 6, 7, 8]
                .map(h => {
                  const weight = synth ? (synth.harmonics as unknown as Record<string, number>)[`h${h}`] || 0 : 0;
                  return `
                <div class="flex flex-col gap-0.5 bg-slate-900/80 p-1.5 rounded-xl border border-white/5 min-w-0">
                  <div class="flex justify-between text-[10px]">
                    <span class="font-bold text-slate-300">${h}× (${Math.round(this.currentFreq * h)}Hz)</span>
                    <span class="font-mono text-cyan-400 tabular-nums">${Math.round(weight * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value="${weight}"
                    data-harmonic="${h}"
                    aria-label="Harmonic ${h} weight"
                    class="harmonic-slider cursor-pointer w-full min-w-0 slider-cyan"
                  />
                </div>
              `;
                })
                .join('')}
            </div>
          </div>
        </div>

        <!-- ACCORDION 3: BINAURAL BEATS STEREO ENTRAINMENT ENGINE -->
        <div class="flex flex-col bg-slate-950/60 rounded-2xl border border-white/5 overflow-hidden">
          <button id="btn-toggle-binaural" class="w-full p-2.5 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors text-left">
            <div class="flex items-center gap-1.5">
              <span class="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
              <span class="text-xs font-bold text-slate-200">Stereo Binaural Beats Engine</span>
            </div>
            <span class="text-[10px] text-slate-400 font-mono">${this.openSection === 'binaural' ? '▲' : '▼'}</span>
          </button>

          <div class="${this.openSection === 'binaural' ? 'flex' : 'hidden'} flex-col gap-2 p-2 pt-0 border-t border-white/5">
            <!-- Brainwave Bands -->
            <div class="grid grid-cols-5 gap-1 text-[9px] font-semibold pt-1">
              <button data-band="delta" data-beat="2.5" class="btn-brainwave py-1 px-0.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-white/5 text-center cursor-pointer">Delta (2.5Hz)</button>
              <button data-band="theta" data-beat="6.0" class="btn-brainwave py-1 px-0.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-white/5 text-center cursor-pointer">Theta (6Hz)</button>
              <button data-band="alpha" data-beat="10.0" class="btn-brainwave py-1 px-0.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-white/5 text-center cursor-pointer">Alpha (10Hz)</button>
              <button data-band="beta" data-beat="20.0" class="btn-brainwave py-1 px-0.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-white/5 text-center cursor-pointer">Beta (20Hz)</button>
              <button data-band="gamma" data-beat="40.0" class="btn-brainwave py-1 px-0.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-white/5 text-center cursor-pointer">Gamma (40Hz)</button>
            </div>

            <!-- Beat Frequency Slider & Stereo Active Toggle -->
            <div class="flex flex-col gap-1.5 bg-slate-900/80 p-2 rounded-xl border border-white/5">
              <div class="flex justify-between items-center text-[10px]">
                <span class="text-slate-300 font-medium">Stereo Offset (Δf)</span>
                <button id="btn-toggle-binaural-active" class="px-2 py-0.5 rounded-lg text-[9px] font-bold border transition-all cursor-pointer ${
                  this.isBinauralActive
                    ? 'bg-purple-500/20 text-purple-300 border-purple-500/40 shadow-sm'
                    : 'bg-slate-800 text-slate-400 border-white/5'
                }">
                  ${this.isBinauralActive ? '✓ Stereo ON' : 'Stereo OFF'}
                </button>
              </div>
              <div class="text-[10px] font-mono text-purple-400 font-bold" id="label-binaural-offset">
                L: ${this.currentFreq} Hz | R: ${(this.currentFreq + this.binauralBeatHz).toFixed(1)} Hz (Δ ${this.binauralBeatHz.toFixed(1)} Hz)
              </div>
              <input
                type="range"
                id="slider-binaural-beat"
                min="0.5"
                max="45"
                step="0.5"
                value="${this.binauralBeatHz}"
                aria-label="Binaural beat frequency offset"
                class="w-full min-w-0 cursor-pointer slider-purple"
              />
            </div>
          </div>
        </div>

      </div>
    `;

    this.attachEvents();
  }

  private attachEvents(): void {
    // Sound Play/Pause Button
    this.element.querySelector('#btn-freq-sound-toggle')?.addEventListener('click', async () => {
      await this.audioEngine.initialize();
      const synth = this.audioEngine.synthesizer;
      if (synth && synth.getIsPlaying()) {
        this.audioEngine.stopFrequency();
      } else {
        await this.audioEngine.playFrequency(this.currentFreq);
      }
      this.render();
    });

    // Precision Numeric Input
    const numInput = this.element.querySelector('#freq-number-input') as HTMLInputElement;
    numInput?.addEventListener('change', () => {
      const val = parseFloat(numInput.value);
      if (!isNaN(val)) {
        this.setFrequency(val);
      }
    });

    // Waveform Selector
    const waveformSelect = this.element.querySelector('#waveform-select') as HTMLSelectElement;
    waveformSelect?.addEventListener('change', () => {
      const wf = waveformSelect.value as WaveformType;
      this.audioEngine.synthesizer?.setWaveform(wf);
      window.dispatchEvent(new CustomEvent('waveform-changed', { detail: { waveform: wf } }));
      this.render();
    });

    // Master Frequency Slider
    const masterSlider = this.element.querySelector('#freq-master-slider') as HTMLInputElement;
    masterSlider?.addEventListener('input', () => {
      const hz = this.sliderToHz(parseFloat(masterSlider.value));
      this.setFrequency(hz);
      const pct = Math.round((parseFloat(masterSlider.value) / 1000) * 100);
      masterSlider.style.background = `linear-gradient(to right, #38bdf8 ${pct}%, rgba(255, 255, 255, 0.1) ${pct}%)`;
    });

    // Multiplier buttons (x2 / div2)
    this.element.querySelectorAll('.btn-freq-mult').forEach(btn => {
      btn.addEventListener('click', e => {
        const mult = parseFloat((e.currentTarget as HTMLElement).getAttribute('data-multiplier') || '1');
        this.setFrequency(this.currentFreq * mult);
      });
    });

    // Step buttons (+/- Hz)
    this.element.querySelectorAll('.btn-freq-step').forEach(btn => {
      btn.addEventListener('click', e => {
        const delta = parseFloat((e.currentTarget as HTMLElement).getAttribute('data-delta-hz') || '0');
        this.setFrequency(this.currentFreq + delta);
      });
    });

    // Accordion Toggles
    this.element.querySelector('#btn-toggle-solfeggio')?.addEventListener('click', () => {
      this.openSection = this.openSection === 'solfeggio' ? 'none' : 'solfeggio';
      this.render();
    });
    this.element.querySelector('#btn-toggle-harmonics')?.addEventListener('click', () => {
      this.openSection = this.openSection === 'harmonics' ? 'none' : 'harmonics';
      this.render();
    });
    this.element.querySelector('#btn-toggle-binaural')?.addEventListener('click', () => {
      this.openSection = this.openSection === 'binaural' ? 'none' : 'binaural';
      this.render();
    });

    // Solfeggio Presets
    this.element.querySelectorAll('.btn-solfeggio').forEach(btn => {
      btn.addEventListener('click', e => {
        const target = e.currentTarget as HTMLElement;
        const hz = parseFloat(target.getAttribute('data-hz') || '432');
        this.setFrequency(hz);
      });
    });

    // Timbre presets
    this.element.querySelectorAll('.btn-timbre').forEach(btn => {
      btn.addEventListener('click', e => {
        const timbre = (e.currentTarget as HTMLElement).getAttribute('data-timbre');
        const synth = this.audioEngine.synthesizer;
        if (!synth) return;

        const weights: Record<string, number[]> = {
          pure: [1, 0, 0, 0, 0, 0, 0, 0],
          warm: [1, 0.5, 0.33, 0.25, 0.2, 0.16, 0.14, 0.12],
          odd: [1, 0, 0.4, 0, 0.2, 0, 0.1, 0],
          organ: [1, 0.8, 0, 0.6, 0, 0, 0, 0.4],
        };
        const arr = weights[timbre || 'pure'] || weights.pure;
        arr.forEach((w, idx) => {
          synth.setHarmonicWeight(idx + 1, w);
        });
        this.render();
      });
    });

    // Harmonic Sliders
    this.element.querySelectorAll('.harmonic-slider').forEach(slider => {
      slider.addEventListener('input', e => {
        const target = e.currentTarget as HTMLInputElement;
        const h = parseInt(target.getAttribute('data-harmonic') || '1', 10);
        const weight = parseFloat(target.value);
        this.audioEngine.synthesizer?.setHarmonicWeight(h, weight);
      });
    });

    // Binaural Beat Slider
    const binauralSlider = this.element.querySelector('#slider-binaural-beat') as HTMLInputElement;
    binauralSlider?.addEventListener('input', () => {
      this.binauralBeatHz = parseFloat(binauralSlider.value);
      this.audioEngine.synthesizer?.setBinauralBeat(this.binauralBeatHz, this.isBinauralActive);
      const label = this.element.querySelector('#label-binaural-offset');
      if (label) {
        label.textContent = `L: ${this.currentFreq} Hz | R: ${(this.currentFreq + this.binauralBeatHz).toFixed(1)} Hz (Δ ${this.binauralBeatHz.toFixed(1)} Hz)`;
      }
    });

    // Binaural Active Toggle
    this.element.querySelector('#btn-toggle-binaural-active')?.addEventListener('click', () => {
      this.isBinauralActive = !this.isBinauralActive;
      this.audioEngine.synthesizer?.setBinauralBeat(this.binauralBeatHz, this.isBinauralActive);
      this.render();
    });

    // Brainwave band presets
    this.element.querySelectorAll('.btn-brainwave').forEach(btn => {
      btn.addEventListener('click', e => {
        const beat = parseFloat((e.currentTarget as HTMLElement).getAttribute('data-beat') || '10.0');
        this.binauralBeatHz = beat;
        this.isBinauralActive = true;
        this.audioEngine.synthesizer?.setBinauralBeat(this.binauralBeatHz, true);
        this.render();
      });
    });
  }

  private updateFrequencyDisplay(): void {
    const numInput = this.element.querySelector('#freq-number-input') as HTMLInputElement;
    if (numInput && document.activeElement !== numInput) {
      numInput.value = this.currentFreq.toString();
    }

    const masterSlider = this.element.querySelector('#freq-master-slider') as HTMLInputElement;
    if (masterSlider && document.activeElement !== masterSlider) {
      const val = this.hzToSlider(this.currentFreq);
      masterSlider.value = val.toString();
      const pct = Math.round((val / 1000) * 100);
      masterSlider.style.background = `linear-gradient(to right, #38bdf8 ${pct}%, rgba(255, 255, 255, 0.1) ${pct}%)`;
    }

    const noteInfo = WavePhysics.frequencyToNote(this.currentFreq);
    const noteNameEl = this.element.querySelector('#label-note-name');
    if (noteNameEl) noteNameEl.textContent = noteInfo.name;

    const noteCentsEl = this.element.querySelector('#label-note-cents');
    if (noteCentsEl) noteCentsEl.textContent = `${noteInfo.cents >= 0 ? '+' : ''}${noteInfo.cents}c`;
  }

  private updatePlayStateUI(): void {
    const btn = this.element.querySelector('#btn-freq-sound-toggle');
    if (!btn) return;

    if (this.isPlaying) {
      btn.className = 'w-8 h-8 rounded-xl bg-cyan-400 text-slate-950 font-bold hover:bg-cyan-300 shadow-md shadow-cyan-400/40 ring-2 ring-cyan-300/50 flex items-center justify-center transition-all active:scale-95 shrink-0 cursor-pointer shadow-sm';
      btn.innerHTML = `<svg class="w-4 h-4 fill-current" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>`;
    } else {
      btn.className = 'w-8 h-8 rounded-xl bg-slate-900 text-white border border-slate-700 hover:bg-slate-800 flex items-center justify-center transition-all active:scale-95 shrink-0 cursor-pointer shadow-sm';
      btn.innerHTML = `<svg class="w-4 h-4 fill-current ml-0.5" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
    }
  }
}
