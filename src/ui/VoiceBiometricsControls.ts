/**
 * VoiceBiometricsControls.ts
 * SoundForm 3D - Human Voice Biometrics & Personalized Sound Medicine Controls
 *
 * Implements:
 * 1. Live Microphone Toggle & Audio VU meter.
 * 2. 7 Clinical Human Voice Presets (Bel Canto, Grounded Chest, Vocal Strain, Nodules, Parkinson's, Pulmonary, Edema).
 * 3. One-Touch "💊 Synthesize Personalized Sound Medicine" trigger.
 * 4. Active Sound Medicine Prescription Card with real-time bio-resonance synthesis.
 */

import { AudioEngine } from '../audio/AudioEngine';
import { VisualizerEngine } from '../visualizer/VisualizerEngine';
import { VoiceBiometricsPhysics, ClinicalVoiceProfile } from '../math/VoiceBiometricsPhysics';

export class VoiceBiometricsControls {
  public container: HTMLElement;
  private isMicActive = false;
  private isMedicinePlaying = false;
  private activeProfile: ClinicalVoiceProfile;

  constructor(
    private audioEngine: AudioEngine,
    private visualizer: VisualizerEngine
  ) {
    this.container = document.createElement('div');
    this.container.className = 'w-full flex flex-col gap-2.5 select-none';
    this.activeProfile = VoiceBiometricsPhysics.PROFILES['bel-canto'];
    this.preventEventBleeding();
    this.render();
  }

  private preventEventBleeding(): void {
    this.container.addEventListener('wheel', e => e.stopPropagation(), { passive: false });
    this.container.addEventListener('pointerdown', e => e.stopPropagation());
  }

  public render(): void {
    const profiles = Object.values(VoiceBiometricsPhysics.PROFILES);
    const report = this.audioEngine.voiceBiometrics
      ? this.audioEngine.voiceBiometrics.update()
      : null;

    const rx = report?.soundMedicinePrescription;

    this.container.innerHTML = `
      <div class="glass-panel p-3.5 sm:p-4 rounded-3xl flex flex-col gap-3 shadow-xl border border-white/10 text-white select-none">
        
        <!-- Header Bar: Mic Toggle & Preset Selector -->
        <div class="flex flex-col gap-2 border-b border-white/10 pb-2.5">
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              <div class="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-purple-400 font-mono text-xs font-bold shrink-0 shadow-sm">
                VOX
              </div>
              <div>
                <h3 class="text-xs sm:text-sm font-bold text-white">Voice Analysis</h3>
                <p class="text-[10px] text-gray-400">Vocal pitch, tone health, and acoustic balance</p>
              </div>
            </div>

            <!-- Microphone Capture -->
            <button
              id="btn-voice-mic"
              class="px-3 py-1.5 rounded-xl font-semibold text-xs flex items-center gap-1.5 transition-all shadow-sm cursor-pointer shrink-0 ${
                this.isMicActive
                  ? 'bg-rose-500 text-white'
                  : 'bg-slate-800 text-slate-100 border border-slate-700 hover:bg-slate-700'
              }"
            >
              <span class="w-1.5 h-1.5 rounded-full ${this.isMicActive ? 'bg-white' : 'bg-rose-400'}"></span>
              <span>${this.isMicActive ? 'Stop Mic' : 'Record Mic'}</span>
            </button>
          </div>

          <!-- Clinical Preset Selector -->
          <div class="flex items-center gap-2">
            <label class="text-[10px] text-gray-400 font-semibold whitespace-nowrap">Preset:</label>
            <select
              id="voice-preset-select"
              class="w-full bg-slate-900 text-gray-100 text-xs font-semibold rounded-xl px-2.5 py-1.5 border border-white/10 outline-none focus:border-cyan-400 cursor-pointer hover:bg-slate-800 shadow-sm transition-colors"
            >
              ${profiles
                .map(
                  p => `
                <option value="${p.id}" class="bg-slate-900 text-gray-100" ${p.id === this.activeProfile.id ? 'selected' : ''}>
                  ${p.name}
                </option>
              `
                )
                .join('')}
            </select>
          </div>
        </div>

        <!-- Middle Bar: Clinical Summary & Diagnostics -->
        <div class="flex flex-col gap-2.5">
          
          <!-- Vocal Profile Card -->
          <div class="bg-slate-900/60 p-2.5 rounded-2xl border border-white/5 flex flex-col justify-between gap-1.5">
            <div>
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-gray-200">${this.activeProfile.name}</span>
                <span class="text-[9px] px-2 py-0.5 rounded-full font-mono uppercase font-bold ${
                  this.activeProfile.category === 'healthy'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : this.activeProfile.category === 'neurological'
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                }">
                  ${this.activeProfile.category}
                </span>
              </div>
              <p class="text-[10px] text-gray-400 mt-0.5 leading-tight">${this.activeProfile.description}</p>
            </div>

            <!-- Quick Telemetry Chips -->
            <div class="flex flex-wrap gap-1.5 pt-1">
              <span class="text-[9px] font-mono bg-white/5 px-1.5 py-0.5 rounded-lg text-gray-300">
                Pitch: <strong class="text-cyan-400">${Math.round(this.activeProfile.f0Hz)} Hz</strong>
              </span>
              <span class="text-[9px] font-mono bg-white/5 px-1.5 py-0.5 rounded-lg text-gray-300">
                Jitter: <strong class="${this.activeProfile.jitterPercent > 1.04 ? 'text-rose-400' : 'text-emerald-400'}">${this.activeProfile.jitterPercent.toFixed(2)}%</strong>
              </span>
              <span class="text-[9px] font-mono bg-white/5 px-1.5 py-0.5 rounded-lg text-gray-300">
                Clarity (HNR): <strong class="${this.activeProfile.hnrDb < 15 ? 'text-rose-400' : 'text-emerald-400'}">${this.activeProfile.hnrDb.toFixed(1)} dB</strong>
              </span>
            </div>
          </div>

          <!-- Restorative Balancing Tone Action & Prescription -->
          <div class="bg-slate-900/60 p-2.5 rounded-2xl border border-purple-500/20 flex flex-col gap-2 shadow-sm">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-purple-300">
                Custom Balancing Tone
              </span>
              <span class="text-[9px] font-mono text-gray-400">Harmonic Balance</span>
            </div>

            <div class="text-[10px] text-gray-300 leading-tight">
              ${rx ? `<strong class="text-white">${rx.prescriptionTitle}</strong>` : 'Analyzes your vocal profile to generate a custom harmonic balancing tone.'}
            </div>

            <!-- Action Button -->
            <button
              id="btn-play-medicine"
              class="w-full py-2 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer ${
                this.isMedicinePlaying
                  ? 'bg-purple-500 text-white font-bold'
                  : 'bg-purple-500/20 text-purple-300 border border-purple-500/40 hover:bg-purple-500/30'
              }"
            >
              <span>${this.isMedicinePlaying ? 'Stop Balancing Tone' : 'Play Balancing Tone'}</span>
            </button>
          </div>

        </div>

      </div>
    `;

    this.attachEvents();
  }

  private attachEvents(): void {
    // 1. Microphone Toggle
    this.container.querySelector('#btn-voice-mic')?.addEventListener('click', async () => {
      await this.audioEngine.initialize();
      if (this.isMicActive) {
        this.audioEngine.voiceBiometrics?.stopMicrophone();
        this.isMicActive = false;
      } else {
        const ok = await this.audioEngine.voiceBiometrics?.startMicrophone();
        if (ok) {
          this.isMicActive = true;
          this.isMedicinePlaying = false;
          this.audioEngine.stopPersonalizedSoundMedicine();
          this.visualizer.vocalBiometricsLab.setTherapyActive(false);
        }
      }
      this.render();
    });

    // 2. Clinical Preset Dropdown
    this.container.querySelector('#voice-preset-select')?.addEventListener('change', async e => {
      await this.audioEngine.initialize();
      const select = e.target as HTMLSelectElement;
      if (this.isMicActive) {
        this.audioEngine.voiceBiometrics?.stopMicrophone();
        this.isMicActive = false;
      }
      if (this.audioEngine.voiceBiometrics) {
        this.activeProfile = this.audioEngine.voiceBiometrics.setProfile(select.value);
        this.audioEngine.playFrequency(this.activeProfile.f0Hz);
      }
      if (this.isMedicinePlaying) {
        this.isMedicinePlaying = false;
        this.audioEngine.stopPersonalizedSoundMedicine();
        this.visualizer.vocalBiometricsLab.setTherapyActive(false);
      }
      this.render();
    });

    // 3. Sound Medicine Synthesis Button
    this.container.querySelector('#btn-play-medicine')?.addEventListener('click', async () => {
      await this.audioEngine.initialize();
      if (this.isMedicinePlaying) {
        this.audioEngine.stopPersonalizedSoundMedicine();
        this.isMedicinePlaying = false;
        this.visualizer.vocalBiometricsLab.setTherapyActive(false);
      } else {
        const report = this.audioEngine.voiceBiometrics
          ? this.audioEngine.voiceBiometrics.update()
          : null;
        if (report) {
          await this.audioEngine.playPersonalizedSoundMedicine(report.soundMedicinePrescription);
          this.isMedicinePlaying = true;
          this.visualizer.vocalBiometricsLab.setTherapyActive(true);
        }
      }
      this.render();
    });
  }
}
