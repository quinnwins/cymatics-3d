/**
 * VoiceTelemetryHUD.ts
 * SoundForm 3D - Floating Clinical Vocal Biometrics Telemetry Card
 */

import { AudioEngine } from '../audio/AudioEngine';
import { VocalBiomarkerReport } from '../math/VoiceBiometricsPhysics';

export class VoiceTelemetryHUD {
  private element: HTMLElement;
  private isVisible = true;

  constructor(private audioEngine: AudioEngine) {
    this.element = document.createElement('div');
    this.element.className = 'w-full flex flex-col gap-2 transition-all duration-300 select-none';
    this.render();
  }

  public getElement(): HTMLElement {
    return this.element;
  }

  public setVisible(visible: boolean): void {
    this.isVisible = visible;
    this.element.style.display = visible ? 'flex' : 'none';
  }

  public render(): void {
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
          diagnosticHallmarks: ['✨ Pristine Harmonic Resonance'],
          healthStatus: 'pristine',
          soundMedicinePrescription: {
            baseToneHz: 432,
            binauralBeatHz: 10,
            harmonicOvertones: [432, 864],
            isochronicPulseRateHz: 5,
            prescriptionTitle: '💎 432 Hz Solfeggio Golden-Ratio Resonance Radiance',
          },
        };

    const isJitterHigh = report.jitterPercent > 1.04;
    const isShimmerHigh = report.shimmerPercent > 3.81;
    const isHnrLow = report.hnrDb < 15.0;
    const isCppLow = report.cppDb < 9.0;
    const isFcrHigh = report.fcr > 1.20;

    this.element.innerHTML = `
      <div class="glass-panel p-3.5 rounded-3xl border border-white/10 flex flex-col gap-2.5 shadow-2xl backdrop-blur-xl pointer-events-auto">
        
        <!-- Header -->
        <div class="flex items-center justify-between border-b border-white/5 pb-2">
          <div class="flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-full ${
              report.healthStatus === 'pristine'
                ? 'bg-accent-emerald animate-pulse'
                : report.healthStatus === 'neurological-tremor'
                ? 'bg-accent-purple animate-ping'
                : 'bg-accent-magenta animate-pulse'
            }"></span>
            <span class="text-xs font-bold text-gray-200">Vocal Biometrics HUD</span>
          </div>
          <span class="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full font-bold ${
            report.healthStatus === 'pristine'
              ? 'bg-emerald-500/20 text-accent-emerald'
              : report.healthStatus === 'neurological-tremor'
              ? 'bg-purple-500/20 text-accent-purple'
              : 'bg-red-500/20 text-accent-magenta'
          }">
            ${report.healthStatus}
          </span>
        </div>

        <!-- Metric Grid -->
        <div class="grid grid-cols-2 gap-2 text-[11px] font-mono">
          
          <div class="bg-black/30 p-2 rounded-xl border border-white/5 flex flex-col">
            <span class="text-[9px] text-gray-400 uppercase">Pitch (f₀)</span>
            <span class="text-xs font-bold text-accent-cyan">${Math.round(report.f0Hz)} Hz</span>
          </div>

          <div class="bg-black/30 p-2 rounded-xl border border-white/5 flex flex-col">
            <span class="text-[9px] text-gray-400 uppercase">Jitter (J_loc)</span>
            <span class="text-xs font-bold ${isJitterHigh ? 'text-red-400' : 'text-emerald-400'}">
              ${report.jitterPercent.toFixed(2)}% <span class="text-[9px] text-gray-500">(&lt;1%)</span>
            </span>
          </div>

          <div class="bg-black/30 p-2 rounded-xl border border-white/5 flex flex-col">
            <span class="text-[9px] text-gray-400 uppercase">Shimmer (S_loc)</span>
            <span class="text-xs font-bold ${isShimmerHigh ? 'text-red-400' : 'text-emerald-400'}">
              ${report.shimmerPercent.toFixed(2)}% <span class="text-[9px] text-gray-500">(&lt;3.8%)</span>
            </span>
          </div>

          <div class="bg-black/30 p-2 rounded-xl border border-white/5 flex flex-col">
            <span class="text-[9px] text-gray-400 uppercase">HNR Ratio</span>
            <span class="text-xs font-bold ${isHnrLow ? 'text-red-400' : 'text-emerald-400'}">
              ${report.hnrDb.toFixed(1)} dB <span class="text-[9px] text-gray-500">(&gt;15)</span>
            </span>
          </div>

          <div class="bg-black/30 p-2 rounded-xl border border-white/5 flex flex-col">
            <span class="text-[9px] text-gray-400 uppercase">Cepstral Peak (CPP)</span>
            <span class="text-xs font-bold ${isCppLow ? 'text-red-400' : 'text-emerald-400'}">
              ${report.cppDb.toFixed(1)} dB
            </span>
          </div>

          <div class="bg-black/30 p-2 rounded-xl border border-white/5 flex flex-col">
            <span class="text-[9px] text-gray-400 uppercase">Centralization (FCR)</span>
            <span class="text-xs font-bold ${isFcrHigh ? 'text-amber-400' : 'text-cyan-400'}">
              ${report.fcr.toFixed(2)}
            </span>
          </div>

        </div>

        <!-- Formant Ladder -->
        <div class="bg-black/40 p-2 rounded-xl border border-white/5 flex items-center justify-between text-[10px] font-mono">
          <span class="text-gray-400">Formants:</span>
          <span class="text-gray-200">
            F₁:<strong class="text-accent-cyan">${Math.round(report.formantsHz[0])}</strong>
            F₂:<strong class="text-accent-blue">${Math.round(report.formantsHz[1])}</strong>
            F₃:<strong class="text-accent-purple">${Math.round(report.formantsHz[2])}</strong>
          </span>
        </div>

        <!-- Diagnostic Hallmarks -->
        <div class="flex flex-col gap-1 border-t border-white/5 pt-2">
          <span class="text-[9px] uppercase font-bold text-gray-400 tracking-wider">Clinical Hallmarks:</span>
          ${report.diagnosticHallmarks
            .map(
              h => `
            <div class="text-[10px] text-gray-300 flex items-start gap-1 leading-tight">
              <span>•</span>
              <span>${h}</span>
            </div>
          `
            )
            .join('')}
        </div>

      </div>
    `;
  }
}
