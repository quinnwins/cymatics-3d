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

  constructor(parent: HTMLElement) {
    this.container = document.createElement('div');
    this.container.id = 'nobel-telemetry-hud';
    this.container.className = 'fixed top-20 right-6 z-30 max-w-sm w-80 glass-panel p-4 rounded-2xl border border-white/10 backdrop-blur-xl shadow-2xl text-white pointer-events-none select-none transition-all duration-300 transform translate-x-0 opacity-100 hidden';
    parent.appendChild(this.container);
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
              <span class="w-2 h-2 rounded-full ${telemetry.isGeneTranscribing ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}"></span>
              🧬 Mechanogenomics HUD
            </span>
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${
              telemetry.isGeneTranscribing ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300'
            }">
              ${telemetry.isGeneTranscribing ? 'ACTIVE TRANSCRIBING' : 'BASAL REPRESSED'}
            </span>
          </div>
        `;
        metricRowsHtml = `
          <div class="grid grid-cols-2 gap-2 text-xs">
            <div class="bg-black/30 p-2 rounded-lg border border-white/5">
              <div class="text-[10px] text-white/60">LINC TENSION</div>
              <div class="text-sm font-mono font-bold text-amber-300">${telemetry.lincTensionPN} pN</div>
            </div>
            <div class="bg-black/30 p-2 rounded-lg border border-white/5">
              <div class="text-[10px] text-white/60">NPC PORE SIZE</div>
              <div class="text-sm font-mono font-bold text-cyan-300">${telemetry.nuclearPoreDiameterNm} nm</div>
            </div>
            <div class="bg-black/30 p-2 rounded-lg border border-white/5">
              <div class="text-[10px] text-white/60">HISTONE ACETYL</div>
              <div class="text-sm font-mono font-bold text-emerald-300">${telemetry.histoneAcetylationIndex}</div>
            </div>
            <div class="bg-black/30 p-2 rounded-lg border border-white/5">
              <div class="text-[10px] text-white/60">p53 PROTEIN</div>
              <div class="text-sm font-mono font-bold text-yellow-300">${telemetry.p53ProteinConcentrationNM} nM</div>
            </div>
          </div>
          <div class="mt-2 text-[10px] text-white/70 bg-white/5 p-2 rounded-lg border border-white/5 leading-relaxed">
            ${
              telemetry.isGeneTranscribing
                ? '✨ <strong class="text-emerald-300">Tumor Defense Active:</strong> Nuclear pores dilated >25 nm; histone acetyltransferase decondensing chromatin for p53 burst.'
                : '🔒 <strong class="text-amber-300">Basal State:</strong> Chromatin in dense heterochromatin solenoid packing.'
            }
          </div>
        `;
        break;

      case 'bbb-dilation':
        badgeHtml = `
          <div class="flex items-center justify-between border-b border-white/10 pb-2 mb-2">
            <span class="font-bold text-xs text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
              <span class="w-2 h-2 rounded-full ${telemetry.isBbmOpen ? 'bg-cyan-400 animate-ping' : 'bg-blue-400'}"></span>
              🧠 BBB Dilation HUD
            </span>
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${
              telemetry.isBbmOpen ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'bg-blue-500/20 text-blue-300'
            }">
              ${telemetry.isBbmOpen ? 'BARRIER OPEN' : 'TIGHT SEALED'}
            </span>
          </div>
        `;
        metricRowsHtml = `
          <div class="grid grid-cols-2 gap-2 text-xs">
            <div class="bg-black/30 p-2 rounded-lg border border-white/5">
              <div class="text-[10px] text-white/60">SHEAR STRESS</div>
              <div class="text-sm font-mono font-bold text-cyan-300">${telemetry.acousticShearStressPa} Pa</div>
            </div>
            <div class="bg-black/30 p-2 rounded-lg border border-white/5">
              <div class="text-[10px] text-white/60">CLAUDIN-5 GAP</div>
              <div class="text-sm font-mono font-bold text-emerald-300">${telemetry.claudinPoreWidthNm} nm</div>
            </div>
            <div class="bg-black/30 p-2 rounded-lg border border-white/5 col-span-2">
              <div class="text-[10px] text-white/60">NANOMEDICINE EXTRAVASATION FLUX</div>
              <div class="text-sm font-mono font-bold text-yellow-300">${telemetry.transvascularDrugFluxPercent}%</div>
            </div>
          </div>
          <div class="mt-2 text-[10px] text-white/70 bg-white/5 p-2 rounded-lg border border-white/5 leading-relaxed">
            ${
              telemetry.isBbmOpen
                ? '💉 <strong class="text-cyan-300">Extravasation Active:</strong> Paracellular clefts opened to deliver therapeutic mRNA nanobots directly into glioblastoma.'
                : '🛡️ <strong class="text-blue-300">Intact Endothelium:</strong> Claudin-5 tight junctions preventing macromolecule entry.'
            }
          </div>
        `;
        break;

      case 'viral-shatter':
        badgeHtml = `
          <div class="flex items-center justify-between border-b border-white/10 pb-2 mb-2">
            <span class="font-bold text-xs text-pink-300 uppercase tracking-wider flex items-center gap-1.5">
              <span class="w-2 h-2 rounded-full ${telemetry.isCapsidFractured ? 'bg-rose-400 animate-ping' : 'bg-pink-400'}"></span>
              🦠 Viral Lamb HUD
            </span>
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${
              telemetry.isCapsidFractured ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-pink-500/20 text-pink-300'
            }">
              ${telemetry.isCapsidFractured ? 'CAPSID SHATTERED' : 'RESONANT STRAIN'}
            </span>
          </div>
        `;
        metricRowsHtml = `
          <div class="grid grid-cols-2 gap-2 text-xs">
            <div class="bg-black/30 p-2 rounded-lg border border-white/5">
              <div class="text-[10px] text-white/60">CAPSID STRAIN</div>
              <div class="text-sm font-mono font-bold text-pink-300">${telemetry.viralStrainPercent}%</div>
            </div>
            <div class="bg-black/30 p-2 rounded-lg border border-white/5">
              <div class="text-[10px] text-white/60">FATIGUE INDEX</div>
              <div class="text-sm font-mono font-bold text-rose-300">${telemetry.fatigueDamageIndex}</div>
            </div>
            <div class="bg-black/30 p-2 rounded-lg border border-white/5 col-span-2">
              <div class="text-[10px] text-white/60">SOMATIC SELECTIVITY SAFETY RATIO</div>
              <div class="text-sm font-mono font-bold text-emerald-300">${telemetry.viralSelectivityRatio}:1</div>
            </div>
          </div>
          <div class="mt-2 text-[10px] text-white/70 bg-white/5 p-2 rounded-lg border border-white/5 leading-relaxed">
            ${
              telemetry.isCapsidFractured
                ? '💥 <strong class="text-rose-300">Virucidal Shatter:</strong> Capsomer cleavage complete; viral genome neutral and non-infectious.'
                : '⚡ <strong class="text-pink-300">Lamb Resonant Mode:</strong> Accumulating harmonic quadrupolar fatigue on capsid facets.'
            }
          </div>
        `;
        break;

      case 'senolytic-clearance':
        badgeHtml = `
          <div class="flex items-center justify-between border-b border-white/10 pb-2 mb-2">
            <span class="font-bold text-xs text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
              <span class="w-2 h-2 rounded-full ${telemetry.isZombieCellCleared ? 'bg-emerald-400 animate-ping' : 'bg-teal-400'}"></span>
              ⏳ Senolytic HUD
            </span>
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${
              telemetry.isZombieCellCleared ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-teal-500/20 text-teal-300'
            }">
              ${telemetry.isZombieCellCleared ? 'ZOMBIE CLEARED' : 'SASP ACTIVE'}
            </span>
          </div>
        `;
        metricRowsHtml = `
          <div class="grid grid-cols-2 gap-2 text-xs">
            <div class="bg-black/30 p-2 rounded-lg border border-white/5">
              <div class="text-[10px] text-white/60">SENESCENT LYSIS</div>
              <div class="text-sm font-mono font-bold text-emerald-300">${telemetry.senescentLysisPercent}%</div>
            </div>
            <div class="bg-black/30 p-2 rounded-lg border border-white/5">
              <div class="text-[10px] text-white/60">HEALTHY PRESERVED</div>
              <div class="text-sm font-mono font-bold text-cyan-300">${telemetry.healthyPreservedPercent}%</div>
            </div>
            <div class="bg-black/30 p-2 rounded-lg border border-white/5 col-span-2">
              <div class="text-[10px] text-white/60">SASP TOXIC CYTOKINE LEVEL</div>
              <div class="text-sm font-mono font-bold text-yellow-300">${telemetry.saspCytokineConcentrationPgMl} pg/mL</div>
            </div>
          </div>
          <div class="mt-2 text-[10px] text-white/70 bg-white/5 p-2 rounded-lg border border-white/5 leading-relaxed">
            ${
              telemetry.isZombieCellCleared
                ? '🌿 <strong class="text-emerald-300">Tissue Rejuvenation:</strong> Senescent cell cleared; SASP toxic haze depleted.'
                : '☣️ <strong class="text-teal-300">Senescent Load:</strong> Stiff zombie cell secreting pro-inflammatory SASP cytokines.'
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
