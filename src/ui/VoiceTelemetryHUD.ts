/**
 * VoiceTelemetryHUD.ts
 * SoundForm 3D - Floating Clinical Vocal Biometrics Telemetry Card
 */

import { AudioEngine } from '../audio/AudioEngine';
import { VocalBiomarkerReport } from '../math/VoiceBiometricsPhysics';

export class VoiceTelemetryHUD {
  private element: HTMLElement;
  private isVisible = true;

  // Cached DOM elements
  private statusBadge: HTMLElement | null = null;
  private statusDot: HTMLElement | null = null;
  private f0El: HTMLElement | null = null;
  private jitterEl: HTMLElement | null = null;
  private shimmerEl: HTMLElement | null = null;
  private hnrEl: HTMLElement | null = null;
  private cppEl: HTMLElement | null = null;
  private fcrEl: HTMLElement | null = null;
  private f1El: HTMLElement | null = null;
  private f2El: HTMLElement | null = null;
  private f3El: HTMLElement | null = null;
  private hallmarksList: HTMLElement | null = null;

  constructor(private audioEngine: AudioEngine) {
    this.element = document.createElement('div');
    this.element.className = 'w-full flex flex-col gap-2 transition-all duration-300 select-none';
    this.render();
    this.cacheElements();
  }

  public getElement(): HTMLElement {
    return this.element;
  }

  public setVisible(visible: boolean): void {
    this.isVisible = visible;
    this.element.style.display = visible ? 'flex' : 'none';
  }

  private cacheElements(): void {
    this.statusBadge = this.element.querySelector('#hud-voice-status');
    this.statusDot = this.element.querySelector('#hud-voice-dot');
    this.f0El = this.element.querySelector('#hud-vocal-f0');
    this.jitterEl = this.element.querySelector('#hud-vocal-jitter');
    this.shimmerEl = this.element.querySelector('#hud-vocal-shimmer');
    this.hnrEl = this.element.querySelector('#hud-vocal-hnr');
    this.cppEl = this.element.querySelector('#hud-vocal-cpp');
    this.fcrEl = this.element.querySelector('#hud-vocal-fcr');
    this.f1El = this.element.querySelector('#hud-vocal-f1');
    this.f2El = this.element.querySelector('#hud-vocal-f2');
    this.f3El = this.element.querySelector('#hud-vocal-f3');
    this.hallmarksList = this.element.querySelector('#hud-vocal-hallmarks');
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
          shimmerApq11Percent: 1.10,
          hnrDb: 26.8,
          cppDb: 17.2,
          formantsHz: [280, 2250, 3100, 3600],
          fcr: 0.92,
          vocalTractRadiiCm: new Array(16).fill(0.8),
          tremorFreqHz: 0,
          tremorDepthPercent: 0,
          diagnosticHallmarks: ['Pristine Harmonic Resonance'],
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
    const isHnrLow = report.hnrDb < 15.0;
    const isCppLow = report.cppDb < 9.0;
    const isFcrHigh = report.fcr > 1.20;

    if (this.statusBadge) {
      this.statusBadge.textContent = report.healthStatus;
      this.statusBadge.className = `text-[10px] font-mono uppercase px-2 py-0.5 rounded-full font-bold ${
        report.healthStatus === 'pristine'
          ? 'bg-emerald-500/20 text-emerald-300'
          : report.healthStatus === 'neurological-tremor'
          ? 'bg-purple-500/20 text-purple-300'
          : 'bg-rose-500/20 text-rose-300'
      }`;
    }

    if (this.statusDot) {
      this.statusDot.className = `w-2.5 h-2.5 rounded-full ${
        report.healthStatus === 'pristine'
          ? 'bg-emerald-400'
          : report.healthStatus === 'neurological-tremor'
          ? 'bg-purple-400'
          : 'bg-rose-400'
      }`;
    }

    if (this.f0El) this.f0El.textContent = `${Math.round(report.f0Hz)} Hz`;
    if (this.jitterEl) {
      this.jitterEl.className = `text-xs font-bold ${isJitterHigh ? 'text-rose-400' : 'text-emerald-400'}`;
      this.jitterEl.innerHTML = `${report.jitterPercent.toFixed(2)}% <span class="text-[9px] text-slate-500">(&lt;1%)</span>`;
    }
    if (this.shimmerEl) {
      this.shimmerEl.className = `text-xs font-bold ${isShimmerHigh ? 'text-rose-400' : 'text-emerald-400'}`;
      this.shimmerEl.innerHTML = `${report.shimmerPercent.toFixed(2)}% <span class="text-[9px] text-slate-500">(&lt;3.8%)</span>`;
    }
    if (this.hnrEl) {
      this.hnrEl.className = `text-xs font-bold ${isHnrLow ? 'text-rose-400' : 'text-emerald-400'}`;
      this.hnrEl.innerHTML = `${report.hnrDb.toFixed(1)} dB <span class="text-[9px] text-slate-500">(&gt;15)</span>`;
    }
    if (this.cppEl) {
      this.cppEl.className = `text-xs font-bold ${isCppLow ? 'text-rose-400' : 'text-emerald-400'}`;
      this.cppEl.textContent = `${report.cppDb.toFixed(1)} dB`;
    }
    if (this.fcrEl) {
      this.fcrEl.className = `text-xs font-bold ${isFcrHigh ? 'text-amber-400' : 'text-cyan-400'}`;
      this.fcrEl.textContent = report.fcr.toFixed(2);
    }
    if (this.f1El) this.f1El.textContent = Math.round(report.formantsHz[0] || 0).toString();
    if (this.f2El) this.f2El.textContent = Math.round(report.formantsHz[1] || 0).toString();
    if (this.f3El) this.f3El.textContent = Math.round(report.formantsHz[2] || 0).toString();

    if (this.hallmarksList) {
      this.hallmarksList.innerHTML = report.diagnosticHallmarks
        .map(h => `<div class="text-[10px] text-slate-300 flex items-start gap-1 leading-tight"><span>•</span><span>${h}</span></div>`)
        .join('');
    }
  }

  public render(): void {
    this.element.innerHTML = `
      <div class="glass-panel p-3.5 rounded-3xl border border-white/10 flex flex-col gap-2.5 shadow-xl pointer-events-auto">
        
        <!-- Header -->
        <div class="flex items-center justify-between border-b border-white/5 pb-2">
          <div class="flex items-center gap-2">
            <span id="hud-voice-dot" class="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
            <span class="text-xs font-bold text-slate-200">Voice Analysis HUD</span>
          </div>
          <span id="hud-voice-status" class="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full font-bold bg-emerald-500/20 text-emerald-300">
            Pristine
          </span>
        </div>

        <!-- Metric Grid -->
        <div class="grid grid-cols-2 gap-2 text-[11px] font-mono">
          
          <div class="bg-slate-900/60 p-2 rounded-xl border border-white/5 flex flex-col">
            <span class="text-[9px] text-slate-400 uppercase">Pitch (f₀)</span>
            <span id="hud-vocal-f0" class="text-xs font-bold text-cyan-400">220 Hz</span>
          </div>

          <div class="bg-slate-900/60 p-2 rounded-xl border border-white/5 flex flex-col">
            <span class="text-[9px] text-slate-400 uppercase">Pitch Stability (Jitter)</span>
            <span id="hud-vocal-jitter" class="text-xs font-bold text-emerald-400">
              0.24% <span class="text-[9px] text-slate-500">(&lt;1%)</span>
            </span>
          </div>

          <div class="bg-slate-900/60 p-2 rounded-xl border border-white/5 flex flex-col">
            <span class="text-[9px] text-slate-400 uppercase">Volume Stability (Shimmer)</span>
            <span id="hud-vocal-shimmer" class="text-xs font-bold text-emerald-400">
              1.45% <span class="text-[9px] text-slate-500">(&lt;3.8%)</span>
            </span>
          </div>

          <div class="bg-slate-900/60 p-2 rounded-xl border border-white/5 flex flex-col">
            <span class="text-[9px] text-slate-400 uppercase">Tone Clarity (HNR)</span>
            <span id="hud-vocal-hnr" class="text-xs font-bold text-emerald-400">
              26.8 dB <span class="text-[9px] text-slate-500">(&gt;15)</span>
            </span>
          </div>

          <div class="bg-slate-900/60 p-2 rounded-xl border border-white/5 flex flex-col">
            <span class="text-[9px] text-slate-400 uppercase">Harmonic Peak (CPP)</span>
            <span id="hud-vocal-cpp" class="text-xs font-bold text-emerald-400">
              17.2 dB
            </span>
          </div>

          <div class="bg-slate-900/60 p-2 rounded-xl border border-white/5 flex flex-col">
            <span class="text-[9px] text-slate-400 uppercase">Vowel Focus (FCR)</span>
            <span id="hud-vocal-fcr" class="text-xs font-bold text-cyan-400">
              0.92
            </span>
          </div>

        </div>

        <!-- Formant Ladder -->
        <div class="bg-slate-900/60 p-2 rounded-xl border border-white/5 flex items-center justify-between text-[10px] font-mono">
          <span class="text-slate-400">Vocal Formants:</span>
          <span class="text-slate-200">
            F₁:<strong id="hud-vocal-f1" class="text-cyan-400">280</strong> Hz
            F₂:<strong id="hud-vocal-f2" class="text-blue-400">2250</strong> Hz
            F₃:<strong id="hud-vocal-f3" class="text-purple-400">3100</strong> Hz
          </span>
        </div>

        <!-- Diagnostic Hallmarks -->
        <div class="flex flex-col gap-1 border-t border-white/5 pt-2">
          <span class="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Acoustic Analysis:</span>
          <div id="hud-vocal-hallmarks" class="flex flex-col gap-1">
            <div class="text-[10px] text-slate-300 flex items-start gap-1 leading-tight">
              <span>•</span>
              <span>Pristine Harmonic Resonance</span>
            </div>
          </div>
        </div>

      </div>
    `;
    this.cacheElements();
  }
}
