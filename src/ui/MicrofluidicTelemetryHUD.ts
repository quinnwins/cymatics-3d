/**
 * MicrofluidicTelemetryHUD.ts
 * SoundForm 3D - Microfluidic Cell Sorter Floating Glass Telemetry HUD
 *
 * Real-time indicators:
 * - Sorted vs Diverted Cell Count & Live Rates
 * - Gor'kov Acoustic Contrast Factors (Phi)
 * - Separation Purity Percentage
 * - Laminar Flow Velocity & Stokes Reynolds Number
 * - Clear, stress-free plain English explanations
 */

import { MicrofluidicTelemetryData } from '../math/MicrofluidicPhysics';

export class MicrofluidicTelemetryHUD {
  private container: HTMLElement;
  private isVisible = false;

  constructor(parent?: HTMLElement) {
    this.container = document.createElement('div');
    this.container.id = 'microfluidic-telemetry-hud';
    this.container.className =
      'w-full glass-panel p-3.5 rounded-3xl border border-white/10 backdrop-blur-2xl shadow-2xl text-white select-none transition-all duration-300 hidden flex flex-col gap-3';

    if (parent) {
      parent.appendChild(this.container);
    }
  }

  public getElement(): HTMLElement {
    return this.container;
  }

  public setVisible(visible: boolean): void {
    this.isVisible = visible;
    if (visible) {
      this.container.classList.remove('hidden');
    } else {
      this.container.classList.add('hidden');
    }
  }

  public update(telemetry: MicrofluidicTelemetryData): void {
    if (!this.isVisible) return;

    this.container.innerHTML = `
      <!-- Header Badge -->
      <div class="flex items-center justify-between border-b border-white/10 pb-2">
        <span class="font-bold text-xs text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
          <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          Sorter Live Telemetry
        </span>
        <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
          ${telemetry.separationPurityPercent}% PURITY
        </span>
      </div>

      <!-- Real-Time Metrics Grid -->
      <div class="grid grid-cols-2 gap-2 text-xs">
        <!-- Purified Somatic Stream -->
        <div class="bg-slate-900/80 p-2.5 rounded-2xl border border-cyan-500/30 flex flex-col gap-0.5 shadow-sm">
          <div class="text-[10px] text-slate-400 font-semibold flex items-center justify-between">
            <span>CLEAN CELLS</span>
            <span class="text-cyan-400 font-bold">Φ +${telemetry.contrastPhiSomatic}</span>
          </div>
          <div class="text-base font-mono font-bold text-cyan-300">
            ${telemetry.sortedSomaticCount.toLocaleString()}
          </div>
          <div class="text-[9px] text-slate-400 font-mono">
            +${telemetry.somaticSortingRate.toLocaleString()} cells/s (Center)
          </div>
        </div>

        <!-- Deflected CTC Stream -->
        <div class="bg-slate-900/80 p-2.5 rounded-2xl border border-rose-500/30 flex flex-col gap-0.5 shadow-sm">
          <div class="text-[10px] text-slate-400 font-semibold flex items-center justify-between">
            <span>CANCER CELLS</span>
            <span class="text-rose-400 font-bold">Φ ${telemetry.contrastPhiCtc}</span>
          </div>
          <div class="text-base font-mono font-bold text-rose-300">
            ${telemetry.divertedCtcCount.toLocaleString()}
          </div>
          <div class="text-[9px] text-slate-400 font-mono">
            +${telemetry.ctcIsolationRate} cells/s (Sides)
          </div>
        </div>

        <!-- Flow Velocity & Throughput -->
        <div class="bg-slate-900/80 p-2 rounded-xl border border-white/5">
          <div class="text-[9px] text-slate-400 font-semibold uppercase">Flow Velocity</div>
          <div class="text-sm font-mono font-bold text-emerald-300">
            ${telemetry.flowVelocityMmS} mm/s
          </div>
          <div class="text-[9px] text-slate-400 font-mono">
            ${telemetry.volumetricFlowRateUlMin} µL/min
          </div>
        </div>

        <!-- Flow Regime -->
        <div class="bg-slate-900/80 p-2 rounded-xl border border-white/5">
          <div class="text-[9px] text-slate-400 font-semibold uppercase">Flow Regime</div>
          <div class="text-sm font-mono font-bold text-amber-300">
            Re = ${telemetry.reynoldsNumber}
          </div>
          <div class="text-[9px] text-slate-400 font-mono">
            Laminar Stokes (Gentle)
          </div>
        </div>
      </div>

      <!-- Human-Friendly Stress-Free Explanation -->
      <div class="text-[10px] text-slate-300 bg-slate-900/60 p-2.5 rounded-2xl border border-white/5 leading-relaxed">
        <strong class="text-emerald-300">Gentle Acoustic Sorting:</strong> Sound vibrations pull healthy cells into the center stream while pushing larger cancer cells out to side collection channels without touching filters.
      </div>
    `;
  }
}
