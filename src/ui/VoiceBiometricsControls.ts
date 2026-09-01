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
    this.container.className = 'w-full max-w-4xl mx-auto flex flex-col gap-3';
    this.activeProfile = VoiceBiometricsPhysics.PROFILES['bel-canto'];
    this.render();
  }

  public render(): void {
    const profiles = Object.values(VoiceBiometricsPhysics.PROFILES);
    const report = this.audioEngine.voiceBiometrics
      ? this.audioEngine.voiceBiometrics.update()
      : null;

    const rx = report?.soundMedicinePrescription;

    this.container.innerHTML = `
      <div class="glass-panel p-3 md:p-4 rounded-3xl flex flex-col gap-3">
        
        <!-- Header Bar: Mic Toggle & Preset Selector -->
        <div class="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-3">
          
          <!-- Left: Microphone Capture -->
          <div class="flex items-center gap-3">
            <button
              id="btn-voice-mic"
              class="px-4 py-2 rounded-2xl font-bold text-xs flex items-center gap-2 transition-all shadow-lg ${
                this.isMicActive
                  ? 'bg-gradient-to-r from-red-500 to-accent-magenta text-white shadow-red-500/30 scale-105 animate-pulse'
                  : 'bg-gradient-to-r from-accent-cyan to-accent-blue text-white shadow-accent-cyan/30 hover:scale-105'
              }"
            >
              <span>${this.isMicActive ? '⏹️ Stop Mic' : '🎙️ Record Voice'}</span>
            </button>

            <span class="text-[11px] text-gray-400 font-medium">
              ${this.isMicActive ? '🔴 Live Vocal Stream Active' : 'Or select clinical preset:'}
            </span>
          </div>

          <!-- Right: 7 Clinical Human Voice Presets -->
          <div class="flex items-center gap-2 flex-1 max-w-[340px]">
            <select
              id="voice-preset-select"
              class="w-full bg-gray-800/80 text-gray-200 text-xs font-semibold rounded-xl px-3 py-2 border border-white/10 outline-none focus:border-accent-cyan cursor-pointer hover:bg-gray-800 transition-colors"
            >
              ${profiles
                .map(
                  p => `
                <option value="${p.id}" ${p.id === this.activeProfile.id ? 'selected' : ''}>
                  ${p.name}
                </option>
              `
                )
                .join('')}
            </select>
          </div>

        </div>

        <!-- Middle Bar: Clinical Summary & Diagnostics -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          
          <!-- Vocal Profile Card -->
          <div class="bg-black/30 p-3 rounded-2xl border border-white/5 flex flex-col justify-between gap-2">
            <div>
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-gray-200">${this.activeProfile.name}</span>
                <span class="text-[10px] px-2 py-0.5 rounded-full font-mono uppercase font-bold ${
                  this.activeProfile.category === 'healthy'
                    ? 'bg-emerald-500/20 text-accent-emerald border border-emerald-500/30'
                    : this.activeProfile.category === 'neurological'
                    ? 'bg-purple-500/20 text-accent-purple border border-purple-500/30'
                    : 'bg-red-500/20 text-accent-magenta border border-red-500/30'
                }">
                  ${this.activeProfile.category}
                </span>
              </div>
              <p class="text-[11px] text-gray-400 mt-1 leading-relaxed">${this.activeProfile.description}</p>
            </div>

            <!-- Quick Telemetry Chips -->
            <div class="flex flex-wrap gap-2 pt-1">
              <span class="text-[10px] font-mono bg-white/5 px-2 py-1 rounded-lg text-gray-300">
                f₀: <strong class="text-accent-cyan">${Math.round(this.activeProfile.f0Hz)} Hz</strong>
              </span>
              <span class="text-[10px] font-mono bg-white/5 px-2 py-1 rounded-lg text-gray-300">
                Jitter: <strong class="${this.activeProfile.jitterPercent > 1.04 ? 'text-red-400' : 'text-emerald-400'}">${this.activeProfile.jitterPercent.toFixed(2)}%</strong>
              </span>
              <span class="text-[10px] font-mono bg-white/5 px-2 py-1 rounded-lg text-gray-300">
                HNR: <strong class="${this.activeProfile.hnrDb < 15 ? 'text-red-400' : 'text-emerald-400'}">${this.activeProfile.hnrDb.toFixed(1)} dB</strong>
              </span>
              <span class="text-[10px] font-mono bg-white/5 px-2 py-1 rounded-lg text-gray-300">
                FCR: <strong class="${this.activeProfile.fcr > 1.2 ? 'text-amber-400' : 'text-cyan-400'}">${this.activeProfile.fcr.toFixed(2)}</strong>
              </span>
            </div>
          </div>

          <!-- One-Touch Personalized Sound Medicine Action & Prescription -->
          <div class="bg-gradient-to-br from-purple-950/40 via-blue-950/30 to-black/40 p-3 rounded-2xl border border-accent-purple/20 flex flex-col justify-between gap-2 shadow-inner">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-accent-purple flex items-center gap-1.5">
                <span>💊</span>
                <span>Personalized Sound Medicine</span>
              </span>
              <span class="text-[10px] font-mono text-gray-400">4-Tier Bio-Harmonic Synthesis</span>
            </div>

            <div class="text-[11px] text-gray-300 leading-tight">
              ${rx ? `<strong class="text-white">${rx.prescriptionTitle}</strong>` : 'Analyzes your vocal profile to compose a custom restorative acoustic wave.'}
            </div>

            <!-- Action Button -->
            <button
              id="btn-play-medicine"
              class="w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg ${
                this.isMedicinePlaying
                  ? 'bg-gradient-to-r from-accent-magenta via-accent-purple to-accent-cyan text-white shadow-accent-purple/40 animate-pulse'
                  : 'bg-gradient-to-r from-accent-purple to-accent-blue text-white shadow-accent-purple/30 hover:scale-[1.02]'
              }"
            >
              <span>${this.isMedicinePlaying ? '⏸️ Stop Sound Medicine' : '✨ Synthesize & Play Sound Medicine'}</span>
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
