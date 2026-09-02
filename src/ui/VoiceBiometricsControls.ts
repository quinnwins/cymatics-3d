/**
 * VoiceBiometricsControls.ts
 * SoundForm 3D - Human Voice Studio & Personalized Sound Medicine Controls
 *
 * Implements:
 * 1. Customer-Facing Plain-Language Interface (Zero Cognitive Load).
 * 2. 1-Touch Live Microphone Toggle with Real-Time 12-Segment LED VU Meter.
 * 3. Visual Preset Chip Carousel with Friendly Icons & Plain Explanations.
 * 4. 1-Touch "Harmonic Balancing Tone" Polyphonic Bio-Resonance Synthesizer.
 * 5. Interactive Pitch Match & Vocal Warm-Up Biofeedback Mode.
 */

import { AudioEngine } from '../audio/AudioEngine';
import { VisualizerEngine } from '../visualizer/VisualizerEngine';
import { VoiceBiometricsPhysics, ClinicalVoiceProfile } from '../math/VoiceBiometricsPhysics';

export class VoiceBiometricsControls {
  public container: HTMLElement;
  private isMicActive = false;
  private isMedicinePlaying = false;
  private activeProfile: ClinicalVoiceProfile;
  private activeTab: 'health' | 'pitch-match' = 'health';

  // Pitch Match & Warm-up State
  private targetNotes = [
    { name: 'C3 (Low Warmth)', f0: 130.81 },
    { name: 'G3 (Mid Chest)', f0: 196.0 },
    { name: 'A3 (Concert Pitch)', f0: 220.0 },
    { name: 'C4 (Middle C)', f0: 261.63 },
    { name: 'E4 (Vocal Ring)', f0: 329.63 },
  ];
  private currentTargetIndex = 2; // A3
  private pitchMatchCents = 0;
  private isPitchLocked = false;
  private animFrameId: number | null = null;

  constructor(
    private audioEngine: AudioEngine,
    private visualizer: VisualizerEngine
  ) {
    this.container = document.createElement('div');
    this.container.className = 'w-full flex flex-col gap-2.5 select-none text-white';
    this.activeProfile = VoiceBiometricsPhysics.PROFILES['bel-canto'];
    this.preventEventBleeding();
    this.render();
    this.startVuLoop();
  }

  public getElement(): HTMLElement {
    return this.container;
  }

  private preventEventBleeding(): void {
    this.container.addEventListener('wheel', (e) => e.stopPropagation(), { passive: false });
  }

  private startVuLoop(): void {
    const updateMeter = () => {
      if (this.isMicActive && this.audioEngine.voiceBiometrics) {
        const vuData = this.audioEngine.voiceBiometrics.getVuLevels();
        const report = this.audioEngine.voiceBiometrics.update();
        this.updateVuLeds(vuData.vuRms, vuData.peakLevel);

        if (this.activeTab === 'pitch-match' && report.f0Hz > 60) {
          const targetF0 = this.targetNotes[this.currentTargetIndex].f0;
          const cents = 1200 * Math.log2(report.f0Hz / targetF0);
          this.pitchMatchCents = Math.max(-100, Math.min(100, cents));
          this.isPitchLocked = Math.abs(cents) <= 15 && report.pitchConfidence > 0.6;
          this.updatePitchMatchHUD(report.f0Hz, cents, this.isPitchLocked);
        }
      }
      this.animFrameId = requestAnimationFrame(updateMeter);
    };
    this.animFrameId = requestAnimationFrame(updateMeter);
  }

  private updateVuLeds(vuRms: number, peakLevel: number): void {
    const leds = this.container.querySelectorAll('.vu-led');
    const total = leds.length;
    if (total === 0) return;

    const litCount = Math.round(vuRms * total * 1.5);
    const peakIdx = Math.min(total - 1, Math.floor(peakLevel * total));

    leds.forEach((led, idx) => {
      const el = led as HTMLElement;
      if (idx <= litCount) {
        el.style.opacity = '1.0';
        el.style.filter = 'drop-shadow(0 0 4px currentColor)';
      } else if (idx === peakIdx && peakLevel > 0.05) {
        el.style.opacity = '0.9';
      } else {
        el.style.opacity = '0.15';
        el.style.filter = 'none';
      }
    });
  }

  private updatePitchMatchHUD(currentF0: number, cents: number, isLocked: boolean): void {
    const pointerEl = this.container.querySelector('#pitch-match-pointer') as HTMLElement;
    const readOutEl = this.container.querySelector('#pitch-match-readout') as HTMLElement;
    const badgeEl = this.container.querySelector('#pitch-match-badge') as HTMLElement;

    if (pointerEl) {
      // Map [-100, 100] cents to [0%, 100%]
      const pct = 50 + (cents / 100) * 45;
      pointerEl.style.left = `${Math.max(5, Math.min(95, pct))}%`;
    }

    if (readOutEl) {
      const sign = cents > 0 ? '+' : '';
      readOutEl.textContent = `${currentF0.toFixed(1)} Hz (${sign}${Math.round(cents)} cents)`;
    }

    if (badgeEl) {
      if (isLocked) {
        badgeEl.textContent = 'Harmonic Lock (Pristine)';
        badgeEl.className = 'text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
      } else if (Math.abs(cents) < 40) {
        badgeEl.textContent = 'Almost There';
        badgeEl.className = 'text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30';
      } else {
        badgeEl.textContent = 'Adjust Pitch';
        badgeEl.className = 'text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-800 text-gray-400 border border-white/10';
      }
    }
  }

  public render(): void {
    const profiles = Object.values(VoiceBiometricsPhysics.PROFILES);
    const report = this.audioEngine.voiceBiometrics
      ? this.audioEngine.voiceBiometrics.update()
      : null;

    const rx = report?.soundMedicinePrescription;

    this.container.innerHTML = `
      <div class="glass-panel p-3.5 sm:p-4 rounded-3xl flex flex-col gap-3 shadow-2xl border border-white/10 text-white select-none backdrop-blur-xl">
        
        <!-- Top Mode Tabs: Vocal Health vs Pitch Match -->
        <div class="flex items-center justify-between gap-2 border-b border-white/10 pb-2.5">
          <div class="flex items-center gap-1.5 p-1 bg-slate-900/80 rounded-2xl border border-white/5">
            <button
              id="tab-vocal-health"
              class="px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                this.activeTab === 'health'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md'
                  : 'text-gray-400 hover:text-white'
              }"
            >
              Vocal Health
            </button>
            <button
              id="tab-pitch-match"
              class="px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                this.activeTab === 'pitch-match'
                  ? 'bg-gradient-to-r from-purple-500 to-pink-600 text-white shadow-md'
                  : 'text-gray-400 hover:text-white'
              }"
            >
              Pitch Match & Warm-Up
            </button>
          </div>

          <!-- 1-Touch Microphone Button -->
          <button
            id="btn-voice-mic"
            class="px-3.5 py-2 rounded-2xl font-bold text-xs flex items-center gap-2 transition-all shadow-lg cursor-pointer shrink-0 ${
              this.isMicActive
                ? 'bg-rose-500 text-white animate-pulse'
                : 'bg-slate-800 text-slate-100 border border-slate-700 hover:bg-slate-700 hover:border-white/20'
            }"
          >
            <span class="w-2 h-2 rounded-full ${this.isMicActive ? 'bg-white' : 'bg-rose-400'}"></span>
            <span>${this.isMicActive ? 'Stop Mic' : 'Live Mic'}</span>
          </button>
        </div>

        <!-- 12-Segment LED VU Meter Bar -->
        <div class="flex flex-col gap-1 bg-slate-950/70 p-2 rounded-2xl border border-white/5">
          <div class="flex items-center justify-between text-[10px] text-gray-400 px-1 font-mono">
            <span>MIC LEVEL</span>
            <span class="text-cyan-400 font-semibold">${this.isMicActive ? 'ACTIVE TAP' : 'STANDBY'}</span>
          </div>
          <div class="flex items-center gap-1 h-3 px-1">
            ${Array.from({ length: 12 })
              .map((_, i) => {
                const color = i < 8 ? 'text-emerald-400 bg-emerald-400' : i < 10 ? 'text-amber-400 bg-amber-400' : 'text-rose-500 bg-rose-500';
                return `<div class="vu-led flex-1 h-full rounded-sm ${color} opacity-15 transition-opacity"></div>`;
              })
              .join('')}
          </div>
        </div>

        ${
          this.activeTab === 'health'
            ? `
          <!-- Visual Voice Profile Carousel -->
          <div class="flex flex-col gap-1.5">
            <div class="flex items-center justify-between text-[11px] text-gray-300 font-semibold px-1">
              <span>Voice Archetype:</span>
              <span class="text-cyan-400 font-bold">${this.activeProfile.name}</span>
            </div>
            
            <select
              id="voice-preset-select"
              class="w-full bg-slate-900/90 text-gray-100 text-xs font-semibold rounded-2xl px-3 py-2 border border-white/10 outline-none focus:border-cyan-400 cursor-pointer hover:bg-slate-800 transition-colors shadow-inner"
            >
              ${profiles
                .map(
                  (p) => `
                <option value="${p.id}" class="bg-slate-900 text-gray-100" ${p.id === this.activeProfile.id ? 'selected' : ''}>
                  ${p.name} (${p.category.toUpperCase()})
                </option>
              `
                )
                .join('')}
            </select>
          </div>

          <!-- Plain Description Card -->
          <div class="bg-slate-900/60 p-3 rounded-2xl border border-white/5 flex flex-col gap-1 text-xs">
            <span class="text-gray-400 font-medium">${this.activeProfile.description}</span>
          </div>

          <!-- 1-Touch Custom Balancing Tone Button -->
          <div class="bg-gradient-to-br from-indigo-950/70 via-purple-950/40 to-slate-900/80 p-3.5 rounded-3xl border border-purple-500/20 flex flex-col gap-2.5 shadow-xl">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full bg-purple-400 animate-pulse shrink-0"></span>
                <div>
                  <h4 class="text-xs font-bold text-white">${rx?.prescriptionTitle ?? 'Harmonic Balancing Tone'}</h4>
                  <p class="text-[10px] text-purple-300/80">Bio-harmonic carrier + binaural entrainment</p>
                </div>
              </div>
            </div>

            <button
              id="btn-play-medicine"
              class="w-full py-2.5 px-4 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg ${
                this.isMedicinePlaying
                  ? 'bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow-rose-500/25'
                  : 'bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white shadow-cyan-500/25'
              }"
            >
              <span>${this.isMedicinePlaying ? 'Stop Balancing Tone' : 'Play Balancing Tone'}</span>
            </button>
          </div>
        `
            : `
          <!-- Pitch Match & Vocal Warm-Up Biofeedback Screen -->
          <div class="bg-slate-900/80 p-3.5 rounded-3xl border border-purple-500/20 flex flex-col gap-3">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-white">Target Warm-Up Tone:</span>
              <span id="pitch-match-badge" class="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-800 text-gray-400 border border-white/10">
                Sing into mic
              </span>
            </div>

            <div class="grid grid-cols-5 gap-1">
              ${this.targetNotes
                .map(
                  (n, i) => `
                <button
                  class="btn-target-note py-2 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                    i === this.currentTargetIndex
                      ? 'bg-purple-600 text-white shadow-lg border border-purple-400'
                      : 'bg-slate-950 text-gray-400 hover:text-white border border-white/5'
                  }"
                  data-idx="${i}"
                >
                  ${n.name.split(' ')[0]}
                </button>
              `
                )
                .join('')}
            </div>

            <!-- Pitch Gauge Bar -->
            <div class="flex flex-col gap-1.5 pt-1">
              <div class="relative h-6 bg-slate-950 rounded-xl border border-white/10 overflow-hidden flex items-center">
                <!-- Center Target Ribbon -->
                <div class="absolute left-1/2 -translate-x-1/2 w-8 h-full bg-emerald-500/25 border-x border-emerald-400/50"></div>
                <!-- Dynamic Pointer -->
                <div
                  id="pitch-match-pointer"
                  class="absolute top-1 bottom-1 w-3 rounded-full bg-gradient-to-r from-cyan-400 to-purple-400 shadow-md transition-all duration-75"
                  style="left: 50%"
                ></div>
              </div>
              <div class="flex items-center justify-between text-[10px] text-gray-400 font-mono">
                <span>-100 Cents</span>
                <span id="pitch-match-readout" class="text-cyan-400 font-semibold">Ready</span>
                <span>+100 Cents</span>
              </div>
            </div>
          </div>
        `
        }

      </div>
    `;

    this.attachEventListeners();
  }

  private attachEventListeners(): void {
    // Tab switching
    this.container.querySelector('#tab-vocal-health')?.addEventListener('click', () => {
      this.activeTab = 'health';
      this.render();
    });

    this.container.querySelector('#tab-pitch-match')?.addEventListener('click', () => {
      this.activeTab = 'pitch-match';
      this.render();
    });

    // Microphone toggle
    this.container.querySelector('#btn-voice-mic')?.addEventListener('click', async () => {
      if (this.isMicActive) {
        this.audioEngine.stopVoiceBiometrics();
        this.isMicActive = false;
      } else {
        const ok = await this.audioEngine.startVoiceBiometrics();
        this.isMicActive = ok;
      }
      this.render();
    });

    // Preset selection
    const presetSelect = this.container.querySelector('#voice-preset-select') as HTMLSelectElement;
    presetSelect?.addEventListener('change', () => {
      const p = this.audioEngine.voiceBiometrics?.setProfile(presetSelect.value);
      if (p) {
        this.activeProfile = p;
        this.render();
      }
    });

    // Sound medicine toggle
    this.container.querySelector('#btn-play-medicine')?.addEventListener('click', () => {
      if (!this.audioEngine.soundMedicine) return;

      if (this.isMedicinePlaying) {
        this.audioEngine.soundMedicine.stop();
        this.isMedicinePlaying = false;
        this.visualizer.vocalBiometricsLab.setTherapyActive(false);
      } else {
        const report = this.audioEngine.voiceBiometrics?.update();
        if (report?.soundMedicinePrescription) {
          this.audioEngine.soundMedicine.playPrescription(report.soundMedicinePrescription, 0.65);
          this.isMedicinePlaying = true;
          this.visualizer.vocalBiometricsLab.setTherapyActive(true);
        }
      }
      this.render();
    });

    // Target note buttons
    this.container.querySelectorAll('.btn-target-note').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const idx = Number((e.currentTarget as HTMLElement).dataset.idx);
        this.currentTargetIndex = idx;
        this.render();
      });
    });
  }

  public dispose(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }
}
