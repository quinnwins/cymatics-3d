/**
 * NobelTelemetryHUD.ts
 * SoundForm 3D - Floating Glass Molecular & Biophysical Telemetry HUD
 *
 * Real-Time Telemetry:
 * - LINC Complex Tension (pN), Nuclear Pore Diameter (nm), Histone Acetylation Index, p53 (nM).
 * - FUS Acoustic Shear (Pa), Claudin-5 Pore Width (nm), Transvascular Drug Flux (%).
 * - Viral Capsid Mechanical Strain (%), Fatigue Damage Index, Selectivity Ratio.
 * - Senescent Cell Lysis (%), Healthy Tissue Preserved (%), SASP Cytokine Concentration (pg/mL).
 */

import { NobelFrontierId, NobelTelemetry } from '../math/NobelBiophysics';

export class NobelTelemetryHUD {
  private container: HTMLElement;
  private isVisible = false;

  constructor(parent?: HTMLElement) {
    this.container = document.createElement('div');
    this.container.id = 'nobel-telemetry-hud';
    this.container.className = 'w-full glass-panel p-3.5 rounded-2xl border border-white/10 backdrop-blur-xl shadow-xl text-white select-none transition-all duration-300 hidden';
    if (parent) {
      parent.appendChild(this.container);
    }
  }

  public getElement(): HTMLElement {
    return this.container;
  }

  public setVisible(visible: boolean) {
    this.isVisible = visible;
    if (visible) {
      this.container.classList.remove('hidden');
    } else {
      this.container.classList.add('hidden');
    }
  }

  public update(frontierId: NobelFrontierId, telemetry: NobelTelemetry) {
    if (!this.isVisible) return;

    let badgeHtml = '';
    let metricRowsHtml = '';

    switch (frontierId) {
      case 'mechanogenomics':
        badgeHtml = `
          <div class="flex items-center justify-between border-b border-white/10 pb-2 mb-2">
            <span class="font-bold text-xs text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
              <span class="w-2 h-2 rounded-full ${telemetry.isGeneTranscribing ? 'bg-emerald-400' : 'bg-amber-400'}"></span>
              Gene Activation Stats
            </span>
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${
              telemetry.isGeneTranscribing ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300'
            }">
              ${telemetry.isGeneTranscribing ? 'ACTIVE' : 'RESTING'}
            </span>
          </div>
        `;
        metricRowsHtml = `
          <div class="grid grid-cols-2 gap-2 text-xs">
            <div class="bg-slate-900/80 p-2 rounded-lg border border-white/5">
              <div class="text-[10px] text-slate-400">CYTOSKELETON TENSION</div>
              <div class="text-sm font-mono font-bold text-amber-300">${telemetry.lincTensionPN} pN</div>
            </div>
            <div class="bg-slate-900/80 p-2 rounded-lg border border-white/5">
              <div class="text-[10px] text-slate-400">NUCLEAR PORE SIZE</div>
              <div class="text-sm font-mono font-bold text-cyan-300">${telemetry.nuclearPoreDiameterNm} nm</div>
            </div>
            <div class="bg-slate-900/80 p-2 rounded-lg border border-white/5">
              <div class="text-[10px] text-slate-400">GENE ACCESS INDEX</div>
              <div class="text-sm font-mono font-bold text-emerald-300">${telemetry.histoneAcetylationIndex}</div>
            </div>
            <div class="bg-slate-900/80 p-2 rounded-lg border border-white/5">
              <div class="text-[10px] text-slate-400">p53 PROTEIN LEVEL</div>
              <div class="text-sm font-mono font-bold text-yellow-300">${telemetry.p53ProteinConcentrationNM} nM</div>
            </div>
          </div>
          <div class="mt-2 text-[10px] text-slate-300 bg-slate-900/60 p-2 rounded-lg border border-white/5 leading-relaxed">
            ${
              telemetry.isGeneTranscribing
                ? '<strong class="text-emerald-300">Tumor Defense Active:</strong> Nuclear pores expanded, allowing cell machinery to produce protective p53 proteins.'
                : '<strong class="text-amber-300">Resting State:</strong> DNA is tightly packed inside the cell nucleus.'
            }
          </div>
        `;
        break;

      case 'bbb-dilation':
        badgeHtml = `
          <div class="flex items-center justify-between border-b border-white/10 pb-2 mb-2">
            <span class="font-bold text-xs text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
              <span class="w-2 h-2 rounded-full ${telemetry.isBbmOpen ? 'bg-cyan-400' : 'bg-blue-400'}"></span>
              Blood-Brain Barrier Stats
            </span>
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${
              telemetry.isBbmOpen ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'bg-blue-500/20 text-blue-300'
            }">
              ${telemetry.isBbmOpen ? 'BARRIER OPEN' : 'BARRIER SEALED'}
            </span>
          </div>
        `;
        metricRowsHtml = `
          <div class="grid grid-cols-2 gap-2 text-xs">
            <div class="bg-slate-900/80 p-2 rounded-lg border border-white/5">
              <div class="text-[10px] text-slate-400">ACOUSTIC SHEAR</div>
              <div class="text-sm font-mono font-bold text-cyan-300">${telemetry.acousticShearStressPa} Pa</div>
            </div>
            <div class="bg-slate-900/80 p-2 rounded-lg border border-white/5">
              <div class="text-[10px] text-slate-400">VESSEL GAP SIZE</div>
              <div class="text-sm font-mono font-bold text-emerald-300">${telemetry.claudinPoreWidthNm} nm</div>
            </div>
            <div class="bg-slate-900/80 p-2 rounded-lg border border-white/5 col-span-2">
              <div class="text-[10px] text-slate-400">MEDICINE DELIVERY RATE</div>
              <div class="text-sm font-mono font-bold text-yellow-300">${telemetry.transvascularDrugFluxPercent}%</div>
            </div>
          </div>
          <div class="mt-2 text-[10px] text-slate-300 bg-slate-900/60 p-2 rounded-lg border border-white/5 leading-relaxed">
            ${
              telemetry.isBbmOpen
                ? '<strong class="text-cyan-300">Delivery Active:</strong> Blood vessel walls opened to allow therapeutic particles to pass through.'
                : '<strong class="text-blue-300">Barrier Intact:</strong> Blood vessels tightly sealed against outside particles.'
            }
          </div>
        `;
        break;

      case 'viral-shatter':
        badgeHtml = `
          <div class="flex items-center justify-between border-b border-white/10 pb-2 mb-2">
            <span class="font-bold text-xs text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
              <span class="w-2 h-2 rounded-full ${telemetry.isCapsidFractured ? 'bg-rose-400' : 'bg-purple-400'}"></span>
              Virus Disruption Stats
            </span>
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${
              telemetry.isCapsidFractured ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-purple-500/20 text-purple-300'
            }">
              ${telemetry.isCapsidFractured ? 'SHELL FRACTURED' : 'RESONANT VIBRATION'}
            </span>
          </div>
        `;
        metricRowsHtml = `
          <div class="grid grid-cols-2 gap-2 text-xs">
            <div class="bg-slate-900/80 p-2 rounded-lg border border-white/5">
              <div class="text-[10px] text-slate-400">SHELL STRAIN</div>
              <div class="text-sm font-mono font-bold text-purple-300">${telemetry.viralStrainPercent}%</div>
            </div>
            <div class="bg-slate-900/80 p-2 rounded-lg border border-white/5">
              <div class="text-[10px] text-slate-400">FATIGUE PROGRESS</div>
              <div class="text-sm font-mono font-bold text-rose-300">${telemetry.fatigueDamageIndex}</div>
            </div>
            <div class="bg-slate-900/80 p-2 rounded-lg border border-white/5 col-span-2">
              <div class="text-[10px] text-slate-400">SAFETY MARGIN (CELL VS VIRUS)</div>
              <div class="text-sm font-mono font-bold text-emerald-300">${telemetry.viralSelectivityRatio}:1</div>
            </div>
          </div>
          <div class="mt-2 text-[10px] text-slate-300 bg-slate-900/60 p-2 rounded-lg border border-white/5 leading-relaxed">
            ${
              telemetry.isCapsidFractured
                ? '<strong class="text-rose-300">Shell Broken:</strong> The viral outer coating has fractured, neutralizing the virus.'
                : '<strong class="text-purple-300">Resonant Vibration:</strong> Sound energy is building up stress on the virus shell.'
            }
          </div>
        `;
        break;

      case 'senolytic-clearance':
        badgeHtml = `
          <div class="flex items-center justify-between border-b border-white/10 pb-2 mb-2">
            <span class="font-bold text-xs text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
              <span class="w-2 h-2 rounded-full ${telemetry.isZombieCellCleared ? 'bg-emerald-400' : 'bg-teal-400'}"></span>
              Aging Cell Clearance Stats
            </span>
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${
              telemetry.isZombieCellCleared ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-teal-500/20 text-teal-300'
            }">
              ${telemetry.isZombieCellCleared ? 'CELL CLEARED' : 'AGING CELL ACTIVE'}
            </span>
          </div>
        `;
        metricRowsHtml = `
          <div class="grid grid-cols-2 gap-2 text-xs">
            <div class="bg-slate-900/80 p-2 rounded-lg border border-white/5">
              <div class="text-[10px] text-slate-400">AGING CELL BREAKDOWN</div>
              <div class="text-sm font-mono font-bold text-emerald-300">${telemetry.senescentLysisPercent}%</div>
            </div>
            <div class="bg-slate-900/80 p-2 rounded-lg border border-white/5">
              <div class="text-[10px] text-slate-400">HEALTHY CELLS SAVED</div>
              <div class="text-sm font-mono font-bold text-cyan-300">${telemetry.healthyPreservedPercent}%</div>
            </div>
            <div class="bg-slate-900/80 p-2 rounded-lg border border-white/5 col-span-2">
              <div class="text-[10px] text-slate-400">INFLAMMATION LEVEL</div>
              <div class="text-sm font-mono font-bold text-yellow-300">${telemetry.saspCytokineConcentrationPgMl} pg/mL</div>
            </div>
          </div>
          <div class="mt-2 text-[10px] text-slate-300 bg-slate-900/60 p-2 rounded-lg border border-white/5 leading-relaxed">
            ${
              telemetry.isZombieCellCleared
                ? '<strong class="text-emerald-300">Tissue Cleared:</strong> Aging cells removed and inflammatory signals reduced.'
                : '<strong class="text-teal-300">Aging Cell Present:</strong> Stiff cell releasing inflammatory signals.'
            }
          </div>
        `;
        break;
    }

    this.container.innerHTML = `
      ${badgeHtml}
      ${metricRowsHtml}
    `;
  }
}
