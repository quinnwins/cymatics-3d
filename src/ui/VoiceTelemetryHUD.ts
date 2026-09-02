/**
 * VoiceTelemetryHUD.ts
 * SoundForm 3D - Floating Clinical Vocal Biometrics & Health Telemetry HUD
 *
 * Implements:
 * 1. 3D Stage Focus Mode Switcher:
 *    - 🗣 Airway: Centers the 3D Volumetric Head & Vocal Tract.
 *    - 🎯 Vowels: Centers the 3D Vowel Target Bullseye.
 *    - 👁 Dual: Side-by-side comparative layout.
 * 2. Dual-View Mode Switcher:
 *    - 👤 Patient View (Default): Plain-language health cards, vocal seal rating, voice smoothness.
 *    - 🩺 Clinician View: Full multi-parametric clinical telemetry (Jitter, Shimmer, HNR, CPP, DSI, AVQI v03.01).
 * 3. Customer-Facing Plain-Language Health Status Hero Banner.
 */

import { AudioEngine } from '../audio/AudioEngine';
import { VocalBiomarkerReport } from '../math/VoiceBiometricsPhysics';

export type HUDViewMode = 'patient' | 'clinician';
export type StageFocusMode = 'airway' | 'vowels' | 'dual';

export class VoiceTelemetryHUD {
  private element: HTMLElement;
  private isVisible = true;
  private mode: HUDViewMode = 'patient';
  private stageMode: StageFocusMode = 'dual';

  // Cached DOM elements
  private statusBanner: HTMLElement | null = null;
  private statusDescription: HTMLElement | null = null;
  private f0El: HTMLElement | null = null;
  private steadinessEl: HTMLElement | null = null;
  private consistencyEl: HTMLElement | null = null;
  private clarityEl: HTMLElement | null = null;
  private f1Bar: HTMLElement | null = null;
  private f2Bar: HTMLElement | null = null;
  private f3Bar: HTMLElement | null = null;
  private dsiEl: HTMLElement | null = null;
  private avqiEl: HTMLElement | null = null;
  private hallmarksList: HTMLElement | null = null;

  // Patient view specific elements
  private patientPanel: HTMLElement | null = null;
  private clinicianPanel: HTMLElement | null = null;
  private patientSealEl: HTMLElement | null = null;
  private patientSmoothnessEl: HTMLElement | null = null;
  private patientPitchEl: HTMLElement | null = null;
  private patientAdviceEl: HTMLElement | null = null;

  // Mode buttons
  private btnPatientMode: HTMLButtonElement | null = null;
  private btnClinicianMode: HTMLButtonElement | null = null;

  // Stage buttons
  private btnStageAirway: HTMLButtonElement | null = null;
  private btnStageVowels: HTMLButtonElement | null = null;
  private btnStageDual: HTMLButtonElement | null = null;

  constructor(
    private audioEngine: AudioEngine,
    private onStageModeChange?: (mode: StageFocusMode) => void
  ) {
    this.element = document.createElement('div');
    this.element.className = 'w-full flex flex-col gap-2.5 transition-all duration-300 select-none text-white';
    this.render();
    this.cacheElements();
    this.setupListeners();
  }

  public getElement(): HTMLElement {
    return this.element;
  }

  public setVisible(visible: boolean): void {
    this.isVisible = visible;
    this.element.style.display = visible ? 'flex' : 'none';
  }

  public setStageMode(stage: StageFocusMode): void {
    this.stageMode = stage;
    this.onStageModeChange?.(stage);

    const activeClass = ['bg-cyan-500/30', 'text-cyan-300', 'border-cyan-500/40'];
    const inactiveClass = ['text-gray-400', 'border-transparent'];

    [this.btnStageAirway, this.btnStageVowels, this.btnStageDual].forEach((btn) => {
      btn?.classList.remove(...activeClass);
      btn?.classList.add(...inactiveClass);
    });

    if (stage === 'airway') {
      this.btnStageAirway?.classList.add(...activeClass);
      this.btnStageAirway?.classList.remove(...inactiveClass);
    } else if (stage === 'vowels') {
      this.btnStageVowels?.classList.add(...activeClass);
      this.btnStageVowels?.classList.remove(...inactiveClass);
    } else {
      this.btnStageDual?.classList.add(...activeClass);
      this.btnStageDual?.classList.remove(...inactiveClass);
    }
  }

  public setMode(mode: HUDViewMode): void {
    this.mode = mode;
    if (this.patientPanel && this.clinicianPanel) {
      if (mode === 'patient') {
        this.patientPanel.style.display = 'flex';
        this.clinicianPanel.style.display = 'none';
        this.btnPatientMode?.classList.add('bg-cyan-500/30', 'text-cyan-300', 'border-cyan-500/40');
        this.btnPatientMode?.classList.remove('text-gray-400', 'border-transparent');
        this.btnClinicianMode?.classList.remove('bg-cyan-500/30', 'text-cyan-300', 'border-cyan-500/40');
        this.btnClinicianMode?.classList.add('text-gray-400', 'border-transparent');
      } else {
        this.patientPanel.style.display = 'none';
        this.clinicianPanel.style.display = 'flex';
        this.btnClinicianMode?.classList.add('bg-cyan-500/30', 'text-cyan-300', 'border-cyan-500/40');
        this.btnClinicianMode?.classList.remove('text-gray-400', 'border-transparent');
        this.btnPatientMode?.classList.remove('bg-cyan-500/30', 'text-cyan-300', 'border-cyan-500/40');
        this.btnPatientMode?.classList.add('text-gray-400', 'border-transparent');
      }
    }
  }

  private setupListeners(): void {
    this.btnPatientMode?.addEventListener('click', () => this.setMode('patient'));
    this.btnClinicianMode?.addEventListener('click', () => this.setMode('clinician'));

    this.btnStageAirway?.addEventListener('click', () => this.setStageMode('airway'));
    this.btnStageVowels?.addEventListener('click', () => this.setStageMode('vowels'));
    this.btnStageDual?.addEventListener('click', () => this.setStageMode('dual'));
  }

  private cacheElements(): void {
    this.statusBanner = this.element.querySelector('#hud-voice-banner');
    this.statusDescription = this.element.querySelector('#hud-voice-desc');
    this.f0El = this.element.querySelector('#hud-vocal-f0');
    this.steadinessEl = this.element.querySelector('#hud-vocal-steadiness');
    this.consistencyEl = this.element.querySelector('#hud-vocal-consistency');
    this.clarityEl = this.element.querySelector('#hud-vocal-clarity');
    this.f1Bar = this.element.querySelector('#hud-bar-f1');
    this.f2Bar = this.element.querySelector('#hud-bar-f2');
    this.f3Bar = this.element.querySelector('#hud-bar-f3');
    this.dsiEl = this.element.querySelector('#hud-vocal-dsi');
    this.avqiEl = this.element.querySelector('#hud-vocal-avqi');
    this.hallmarksList = this.element.querySelector('#hud-vocal-hallmarks');

    this.patientPanel = this.element.querySelector('#hud-patient-panel');
    this.clinicianPanel = this.element.querySelector('#hud-clinician-panel');
    this.patientSealEl = this.element.querySelector('#hud-patient-seal');
    this.patientSmoothnessEl = this.element.querySelector('#hud-patient-smoothness');
    this.patientPitchEl = this.element.querySelector('#hud-patient-pitch');
    this.patientAdviceEl = this.element.querySelector('#hud-patient-advice');

    this.btnPatientMode = this.element.querySelector('#btn-mode-patient');
    this.btnClinicianMode = this.element.querySelector('#btn-mode-clinician');

    this.btnStageAirway = this.element.querySelector('#btn-stage-airway');
    this.btnStageVowels = this.element.querySelector('#btn-stage-vowels');
    this.btnStageDual = this.element.querySelector('#btn-stage-dual');
  }

  public update(): void {
    if (!this.isVisible) return;

    const report: VocalBiomarkerReport = this.audioEngine.voiceBiometrics
      ? this.audioEngine.voiceBiometrics.update()
      : {
          f0Hz: 220,
          pitchConfidence: 0.95,
          jitterPercent: 0.24,
          jitterRapPercent: 0.18,
          jitterPpq5Percent: 0.21,
          shimmerPercent: 1.45,
          shimmerDb: 0.12,
          shimmerApq11Percent: 1.1,
          hnrDb: 26.8,
          cppDb: 17.2,
          formantsHz: [280, 2250, 3100, 3600],
          fcr: 0.92,
          dsiScore: 6.8,
          avqiScore: 1.8,
          vocalTractRadiiCm: new Array(16).fill(0.8),
          tremorFreqHz: 0,
          tremorDepthPercent: 0,
          diagnosticHallmarks: ['Pristine Harmonic Resonance (Optimal Vocal Fold Adduction)'],
          healthStatus: 'pristine',
          soundMedicinePrescription: {
            baseToneHz: 432,
            binauralBeatHz: 10,
            harmonicOvertones: [432, 864],
            isochronicPulseRateHz: 5,
            prescriptionTitle: 'Harmonic Calibration',
          },
        };

    const isJitterHigh = report.jitterPercent > 1.04;
    const isShimmerHigh = report.shimmerPercent > 3.81;
    const isHnrHigh = report.hnrDb > 18.0;

    // 1. Status Banner & Plain Translation
    if (this.statusBanner && this.statusDescription) {
      switch (report.healthStatus) {
        case 'pristine':
          this.statusBanner.textContent = 'Optimal Resonance';
          this.statusBanner.className = 'text-xs font-bold px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm';
          this.statusDescription.textContent = 'Vocal cords are closing cleanly with balanced acoustic projection.';
          break;
        case 'mild-strain':
          this.statusBanner.textContent = 'Mild Tension';
          this.statusBanner.className = 'text-xs font-bold px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-sm';
          this.statusDescription.textContent = 'Slight vocal fatigue or strain detected. Gentle relaxation tone recommended.';
          break;
        case 'neurological-tremor':
          this.statusBanner.textContent = 'Tremor Active';
          this.statusBanner.className = 'text-xs font-bold px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 shadow-sm';
          this.statusDescription.textContent = 'Rhythmic frequency flutter detected. 6 Hz Theta balancing active.';
          break;
        case 'pathological-dysphonia':
          this.statusBanner.textContent = 'Aspiration Strain';
          this.statusBanner.className = 'text-xs font-bold px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 shadow-sm';
          this.statusDescription.textContent = 'Breathiness or cord gap detected. Low-inertance resting tone formulated.';
          break;
        case 'respiratory-fatigue':
        default:
          this.statusBanner.textContent = 'Breath Support Needed';
          this.statusBanner.className = 'text-xs font-bold px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 shadow-sm';
          this.statusDescription.textContent = 'Airflow pressure is low. Diaphragmatic pacing recommended.';
          break;
      }
    }

    // 2. Patient View Updates
    if (this.patientSealEl) {
      const sealScore = Math.max(10, Math.min(100, Math.round(100 - report.jitterPercent * 28)));
      const isLeaking = sealScore < 70;
      this.patientSealEl.innerHTML = `
        <span class="${isLeaking ? 'text-rose-400' : 'text-emerald-400'} font-bold">${sealScore}%</span>
        <span class="text-[10px] ${isLeaking ? 'text-rose-300' : 'text-gray-400'}">(${isLeaking ? 'Air Leaking' : 'Clean Seal'})</span>
      `;
    }

    if (this.patientSmoothnessEl) {
      const smoothScore = Math.max(10, Math.min(100, Math.round(100 - report.shimmerPercent * 10)));
      const isRaspy = smoothScore < 70;
      this.patientSmoothnessEl.innerHTML = `
        <span class="${isRaspy ? 'text-amber-400' : 'text-emerald-400'} font-bold">${smoothScore}%</span>
        <span class="text-[10px] ${isRaspy ? 'text-amber-300' : 'text-gray-400'}">(${isRaspy ? 'Raspy / Strained' : 'Smooth'})</span>
      `;
    }

    if (this.patientPitchEl) {
      const pitchNote = report.f0Hz < 100 ? 'Low (Gravelly)' : report.f0Hz > 260 ? 'High' : 'Healthy Range';
      this.patientPitchEl.innerHTML = `
        <span class="text-cyan-400 font-bold">${Math.round(report.f0Hz)} Hz</span>
        <span class="text-[10px] text-gray-400">(${pitchNote})</span>
      `;
    }

    if (this.patientAdviceEl) {
      if (report.healthStatus === 'pathological-dysphonia' || report.f0Hz < 100) {
        this.patientAdviceEl.textContent = '💡 Your vocal cords are heavy with fluid buildup, causing air leakage and deep raspy pitch. Play the 110 Hz Balancing Tone to assist smooth vibration.';
      } else if (report.healthStatus === 'mild-strain') {
        this.patientAdviceEl.textContent = '💡 Mild tension detected in the throat. Relax shoulders and take a slow diaphragmatic breath before speaking.';
      } else {
        this.patientAdviceEl.textContent = '✨ Your vocal cords are oscillating smoothly with optimal acoustic projection and balanced resonance.';
      }
    }

    // 3. Clinician View Metric Values
    if (this.f0El) {
      this.f0El.textContent = `${Math.round(report.f0Hz)} Hz`;
    }

    if (this.steadinessEl) {
      const steadinessScore = Math.max(0, Math.min(100, Math.round(100 - report.jitterPercent * 25)));
      this.steadinessEl.innerHTML = `
        <span class="${isJitterHigh ? 'text-amber-400' : 'text-emerald-400'} font-bold">${steadinessScore}%</span>
        <span class="text-[10px] text-gray-400">(${report.jitterPercent.toFixed(2)}% jitter)</span>
      `;
    }

    if (this.consistencyEl) {
      const consistencyScore = Math.max(0, Math.min(100, Math.round(100 - report.shimmerPercent * 10)));
      this.consistencyEl.innerHTML = `
        <span class="${isShimmerHigh ? 'text-amber-400' : 'text-emerald-400'} font-bold">${consistencyScore}%</span>
        <span class="text-[10px] text-gray-400">(${report.shimmerPercent.toFixed(2)}% shimmer)</span>
      `;
    }

    if (this.clarityEl) {
      this.clarityEl.innerHTML = `
        <span class="${isHnrHigh ? 'text-emerald-400' : 'text-amber-400'} font-bold">${report.hnrDb.toFixed(1)} dB</span>
        <span class="text-[10px] text-gray-400">(${report.cppDb.toFixed(1)} dB CPP)</span>
      `;
    }

    // 4. Formant Bars
    if (this.f1Bar) {
      const pct = Math.min(100, ((report.formantsHz[0] - 200) / 700) * 100);
      this.f1Bar.style.width = `${pct}%`;
    }
    if (this.f2Bar) {
      const pct = Math.min(100, ((report.formantsHz[1] - 800) / 1600) * 100);
      this.f2Bar.style.width = `${pct}%`;
    }
    if (this.f3Bar) {
      const pct = Math.min(100, ((report.formantsHz[2] - 2000) / 1400) * 100);
      this.f3Bar.style.width = `${pct}%`;
    }

    // 5. Clinical Indices
    if (this.dsiEl) {
      const dsi = report.dsiScore ?? 5.5;
      this.dsiEl.textContent = `DSI: ${dsi > 0 ? '+' : ''}${dsi.toFixed(1)}`;
      this.dsiEl.className = `text-[11px] font-mono font-bold ${dsi > 3.0 ? 'text-emerald-400' : dsi > 1.6 ? 'text-amber-400' : 'text-rose-400'}`;
    }

    if (this.avqiEl) {
      const avqi = report.avqiScore ?? 2.1;
      this.avqiEl.textContent = `AVQI: ${avqi.toFixed(2)}`;
      this.avqiEl.className = `text-[11px] font-mono font-bold ${avqi < 2.95 ? 'text-emerald-400' : 'text-rose-400'}`;
    }

    // 6. Hallmarks List
    if (this.hallmarksList) {
      this.hallmarksList.innerHTML = report.diagnosticHallmarks
        .map(
          (h) => `
        <li class="flex items-start gap-1.5 text-[11px] text-gray-300">
          <span class="text-cyan-400 font-bold shrink-0 mt-0.5">•</span>
          <span>${h}</span>
        </li>
      `
        )
        .join('');
    }
  }

  private render(): void {
    this.element.innerHTML = `
      <div class="glass-panel p-4 rounded-3xl flex flex-col gap-3 shadow-2xl border border-white/10 text-white backdrop-blur-xl">
        
        <!-- Top Bar: Header & 3D Stage View Selector -->
        <div class="flex items-center justify-between gap-2 border-b border-white/10 pb-2.5">
          <div>
            <h3 class="text-xs font-bold text-gray-300 uppercase tracking-wider">Voice Telemetry</h3>
            <p id="hud-voice-desc" class="text-[11px] text-gray-400">Real-time biofeedback engine</p>
          </div>
          
          <!-- Stage View Focus Mode Selector -->
          <div class="flex items-center bg-slate-950/80 p-0.5 rounded-full border border-white/10 text-[10px] font-semibold">
            <button id="btn-stage-airway" class="px-2 py-1 rounded-full text-gray-400 border border-transparent hover:text-white transition-all">
              🗣 Airway
            </button>
            <button id="btn-stage-vowels" class="px-2 py-1 rounded-full text-gray-400 border border-transparent hover:text-white transition-all">
              🎯 Vowels
            </button>
            <button id="btn-stage-dual" class="px-2 py-1 rounded-full bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 transition-all">
              👁 Dual
            </button>
          </div>
        </div>

        <!-- Mode Toggle & Status -->
        <div class="flex items-center justify-between bg-slate-900/60 p-2 rounded-2xl border border-white/5">
          <div id="hud-voice-banner" class="text-xs font-bold px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            Optimal Resonance
          </div>

          <!-- Simple vs Pro HUD Selector -->
          <div class="flex items-center bg-slate-950/80 p-0.5 rounded-full border border-white/10 text-[10px] font-semibold">
            <button id="btn-mode-patient" class="px-2.5 py-1 rounded-full bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 transition-all">
              👤 Simple
            </button>
            <button id="btn-mode-clinician" class="px-2.5 py-1 rounded-full text-gray-400 border border-transparent hover:text-white transition-all">
              🩺 Pro
            </button>
          </div>
        </div>

        <!-- ================= PATIENT SIMPLE VIEW ================= -->
        <div id="hud-patient-panel" class="flex flex-col gap-2.5">
          <div class="grid grid-cols-3 gap-2">
            <!-- Vocal Seal -->
            <div class="bg-slate-900/70 p-2.5 rounded-2xl border border-white/5 flex flex-col gap-0.5">
              <span class="text-[10px] text-gray-400 font-semibold">🫁 Vocal Seal</span>
              <div id="hud-patient-seal" class="flex flex-col text-sm font-bold text-emerald-400">
                95% <span class="text-[10px] text-gray-400">(Clean Seal)</span>
              </div>
            </div>

            <!-- Voice Smoothness -->
            <div class="bg-slate-900/70 p-2.5 rounded-2xl border border-white/5 flex flex-col gap-0.5">
              <span class="text-[10px] text-gray-400 font-semibold">🗣 Smoothness</span>
              <div id="hud-patient-smoothness" class="flex flex-col text-sm font-bold text-emerald-400">
                92% <span class="text-[10px] text-gray-400">(Smooth)</span>
              </div>
            </div>

            <!-- Voice Pitch -->
            <div class="bg-slate-900/70 p-2.5 rounded-2xl border border-white/5 flex flex-col gap-0.5">
              <span class="text-[10px] text-gray-400 font-semibold">🎵 Voice Pitch</span>
              <div id="hud-patient-pitch" class="flex flex-col text-sm font-bold text-cyan-400">
                220 Hz <span class="text-[10px] text-gray-400">(Healthy)</span>
              </div>
            </div>
          </div>

          <!-- Plain Advice Box -->
          <div class="bg-slate-950/60 p-3 rounded-2xl border border-cyan-500/20 text-[11px] text-gray-300 leading-relaxed">
            <p id="hud-patient-advice">✨ Your vocal cords are oscillating smoothly with optimal acoustic projection and balanced resonance.</p>
          </div>
        </div>

        <!-- ================= CLINICIAN PRO VIEW ================= -->
        <div id="hud-clinician-panel" class="flex flex-col gap-3" style="display: none;">
          <!-- 4 Primary Clinical Metric Cards -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <!-- Pitch Card -->
            <div class="bg-slate-900/70 p-2.5 rounded-2xl border border-white/5 flex flex-col gap-0.5">
              <span class="text-[10px] text-gray-400 font-semibold">Fundamental f₀</span>
              <span id="hud-vocal-f0" class="text-sm font-bold text-cyan-400">220 Hz</span>
            </div>

            <!-- Steadiness Card -->
            <div class="bg-slate-900/70 p-2.5 rounded-2xl border border-white/5 flex flex-col gap-0.5">
              <span class="text-[10px] text-gray-400 font-semibold">Jitter Perturbation</span>
              <div id="hud-vocal-steadiness" class="flex items-center gap-1 text-sm font-bold text-emerald-400">
                95% <span class="text-[10px] text-gray-400">(0.2% Jloc)</span>
              </div>
            </div>

            <!-- Consistency Card -->
            <div class="bg-slate-900/70 p-2.5 rounded-2xl border border-white/5 flex flex-col gap-0.5">
              <span class="text-[10px] text-gray-400 font-semibold">Shimmer Perturbation</span>
              <div id="hud-vocal-consistency" class="flex items-center gap-1 text-sm font-bold text-emerald-400">
                92% <span class="text-[10px] text-gray-400">(1.4% Sloc)</span>
              </div>
            </div>

            <!-- Clarity Card -->
            <div class="bg-slate-900/70 p-2.5 rounded-2xl border border-white/5 flex flex-col gap-0.5">
              <span class="text-[10px] text-gray-400 font-semibold">Tone Clarity (CPP)</span>
              <div id="hud-vocal-clarity" class="flex items-center gap-1 text-sm font-bold text-emerald-400">
                26.8 dB <span class="text-[10px] text-gray-400">(17 dB CPP)</span>
              </div>
            </div>
          </div>

          <!-- Formant Resonance Spectrum Bars -->
          <div class="bg-slate-900/50 p-3 rounded-2xl border border-white/5 flex flex-col gap-2">
            <div class="flex items-center justify-between text-[11px] text-gray-300 font-semibold">
              <span>Acoustic Formant Spectrum</span>
              <div class="flex items-center gap-2">
                <span id="hud-vocal-dsi" class="text-[11px] font-mono text-emerald-400 font-bold">DSI: +6.8</span>
                <span id="hud-vocal-avqi" class="text-[11px] font-mono text-emerald-400 font-bold">AVQI: 1.80</span>
              </div>
            </div>

            <div class="flex flex-col gap-1.5 text-[10px]">
              <!-- F1 -->
              <div class="flex items-center gap-2">
                <span class="w-16 text-gray-400 font-mono">F1 Depth</span>
                <div class="flex-1 h-2 bg-slate-950 rounded-full overflow-hidden">
                  <div id="hud-bar-f1" class="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full" style="width: 35%"></div>
                </div>
              </div>
              <!-- F2 -->
              <div class="flex items-center gap-2">
                <span class="w-16 text-gray-400 font-mono">F2 Clarity</span>
                <div class="flex-1 h-2 bg-slate-950 rounded-full overflow-hidden">
                  <div id="hud-bar-f2" class="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full" style="width: 65%"></div>
                </div>
              </div>
              <!-- F3 -->
              <div class="flex items-center gap-2">
                <span class="w-16 text-gray-400 font-mono">F3 Ring</span>
                <div class="flex-1 h-2 bg-slate-950 rounded-full overflow-hidden">
                  <div id="hud-bar-f3" class="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full" style="width: 80%"></div>
                </div>
              </div>
            </div>
          </div>

          <!-- Clinical Insights & Hallmarks -->
          <div class="flex flex-col gap-1.5">
            <span class="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Acoustic Insights</span>
            <ul id="hud-vocal-hallmarks" class="flex flex-col gap-1">
              <li class="flex items-start gap-1.5 text-[11px] text-gray-300">
                <span class="text-cyan-400 font-bold shrink-0 mt-0.5">•</span>
                <span>Pristine Harmonic Resonance (Optimal Vocal Fold Adduction)</span>
              </li>
            </ul>
          </div>
        </div>

      </div>
    `;
  }
}
