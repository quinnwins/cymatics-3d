/**
 * ProvenanceBadge.ts
 * Scientific Integrity & Simulation Mode HUD Control
 *
 * Exposes and controls the physical simulation fidelity of the active visualization:
 * - Real-Time (Balanced): Real-time acoustic radiation forces at 60 FPS (Reduced-Order Gor'kov)
 * - Exact Math: Exact Helmholtz wave eigenmodes and tabulated Bessel roots (Analytic)
 * - Expressive Art: Dynamic sound-reactive motion and sonic memory (Interpretive)
 * - Lab Calibrated: Tuned to published ultrasonic levitation lab benchmarks (Benchmarked)
 *
 * Complies with the 6-Lens Autonomous UI/UX Micro-Craft Standard.
 */

export type ProvenanceType = 'ANALYTIC' | 'REDUCED_ORDER' | 'INTERPRETIVE' | 'BENCHMARKED';

export interface ProvenanceDetails {
  type: ProvenanceType;
  tag: string;
  legacyTag: string;
  headline: string;
  summary: string;
  technicalFormula: string;
  colorClass: string;
  dotColorClass: string;
  engineMode?: 'hybrid' | 'physical' | 'expressive';
}

export const PROVENANCE_DEFINITIONS: Record<ProvenanceType, ProvenanceDetails> = {
  REDUCED_ORDER: {
    type: 'REDUCED_ORDER',
    tag: 'Real-Time',
    legacyTag: 'REDUCED-ORDER',
    headline: 'Balanced Real-Time Physics',
    summary: 'Balances real acoustic wave forces with smooth 60 FPS animation.',
    technicalFormula: "Gor'kov acoustic radiation potential & Stokes drag",
    colorClass: 'text-cyan-300 border-cyan-500/30 bg-cyan-950/40',
    dotColorClass: 'bg-cyan-400',
    engineMode: 'hybrid',
  },
  ANALYTIC: {
    type: 'ANALYTIC',
    tag: 'Exact Math',
    legacyTag: 'ANALYTIC',
    headline: 'Exact Wave Mathematics',
    summary: 'Calculates precise acoustic nodal lines from pure wave equations.',
    technicalFormula: 'Helmholtz cavity eigenmodes & NIST DLMF Bessel roots',
    colorClass: 'text-emerald-300 border-emerald-500/30 bg-emerald-950/40',
    dotColorClass: 'bg-emerald-400',
    engineMode: 'physical',
  },
  INTERPRETIVE: {
    type: 'INTERPRETIVE',
    tag: 'Expressive',
    legacyTag: 'INTERPRETIVE',
    headline: 'Sound-Reactive Art',
    summary: 'A dynamic, expressive visual sculpture responding directly to sound.',
    technicalFormula: 'Sonic temporal memory & audio frequency manifold',
    colorClass: 'text-purple-300 border-purple-500/30 bg-purple-950/40',
    dotColorClass: 'bg-purple-400',
    engineMode: 'expressive',
  },
  BENCHMARKED: {
    type: 'BENCHMARKED',
    tag: 'Lab Calibrated',
    legacyTag: 'BENCHMARKED',
    headline: 'Calibrated Lab Mode',
    summary: 'Tuned to match published ultrasonic levitation lab benchmarks.',
    technicalFormula: 'Calibrated against published 3D Chladni experiments',
    colorClass: 'text-amber-300 border-amber-500/30 bg-amber-950/40',
    dotColorClass: 'bg-amber-400',
  },
};

export interface ProvenanceBadgeOptions {
  onModeSelect?: (mode: 'hybrid' | 'physical' | 'expressive') => void;
  onOpenPhysicsDrawer?: () => void;
}

export class ProvenanceBadge {
  public element: HTMLElement;
  private currentType: ProvenanceType = 'ANALYTIC';
  private badgeButton: HTMLButtonElement;
  private popover: HTMLDivElement;
  private isPopoverOpen = false;
  private options: ProvenanceBadgeOptions;
  private documentClickHandler?: (e: MouseEvent) => void;
  private documentKeydownHandler?: (e: KeyboardEvent) => void;
  private focusoutHandler?: (e: FocusEvent) => void;

  constructor(options: ProvenanceBadgeOptions = {}) {
    this.options = options;
    this.element = document.createElement('div');
    this.element.className = 'relative flex flex-col items-end pointer-events-auto select-none';

    // 1. Badge Pill Button (Minimum 44x44 tap target wrapper)
    this.badgeButton = document.createElement('button');
    this.badgeButton.setAttribute('type', 'button');
    this.badgeButton.setAttribute('aria-label', 'Simulation fidelity: Exact Math. Click to change or view details.');
    this.badgeButton.setAttribute('aria-haspopup', 'dialog');
    this.badgeButton.setAttribute('aria-expanded', 'false');
    this.badgeButton.setAttribute('aria-controls', 'simulation-fidelity-popover');
    this.badgeButton.className = [
      'group min-h-[44px] min-w-[44px] flex items-center justify-center p-0.5 cursor-pointer',
      'focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-900',
      'transition-transform duration-150 ease-out active:scale-95',
    ].join(' ');

    const pill = document.createElement('span');
    this.badgeButton.appendChild(pill);

    // 2. Interactive Mode Switcher Popover
    this.popover = document.createElement('div');
    this.popover.id = 'simulation-fidelity-popover';
    this.popover.setAttribute('role', 'dialog');
    this.popover.setAttribute('aria-label', 'Simulation fidelity settings');
    this.popover.className = [
      'hidden absolute top-full right-0 mt-2 w-80 p-4 rounded-2xl z-50',
      'bg-slate-950/95 border border-white/15 shadow-2xl shadow-black/90 backdrop-blur-2xl',
      'text-left transition-all duration-150 ease-out',
    ].join(' ');

    this.element.appendChild(this.badgeButton);
    this.element.appendChild(this.popover);

    this.attachEventListeners();
    this.render();
  }

  public setProvenance(type: ProvenanceType): void {
    if (this.currentType === type) return;
    this.currentType = type;
    this.render();
  }

  public getProvenance(): ProvenanceType {
    return this.currentType;
  }

  public togglePopover(): void {
    if (this.isPopoverOpen) {
      this.closePopover();
    } else {
      this.openPopover();
    }
  }

  public openPopover(): void {
    this.isPopoverOpen = true;
    this.badgeButton.setAttribute('aria-expanded', 'true');
    this.popover.classList.remove('hidden');
    this.renderPopover();

    // Focus active radio button
    const activeRadio = this.popover.querySelector<HTMLElement>('[role="radio"][tabindex="0"]') 
      || this.popover.querySelector<HTMLElement>('[role="radio"]');
    activeRadio?.focus();
  }

  public closePopover(): void {
    if (!this.isPopoverOpen) return;
    this.isPopoverOpen = false;
    this.badgeButton.setAttribute('aria-expanded', 'false');
    this.popover.classList.add('hidden');
    this.renderPill();
  }

  private attachEventListeners(): void {
    this.badgeButton.addEventListener('click', (e) => {
      e.stopPropagation();
      this.togglePopover();
    });

    // Delegated click handling inside the popover
    this.popover.addEventListener('click', (e) => {
      const target = (e.target as HTMLElement).closest('[data-mode]') as HTMLElement | null;
      if (target) {
        const mode = target.getAttribute('data-mode') as 'hybrid' | 'physical' | 'expressive' | null;
        if (mode) {
          if (this.options.onModeSelect) {
            this.options.onModeSelect(mode);
          }
          if (mode === 'hybrid') this.setProvenance('REDUCED_ORDER');
          else if (mode === 'physical') this.setProvenance('ANALYTIC');
          else if (mode === 'expressive') this.setProvenance('INTERPRETIVE');
        }
        return;
      }

      const openPhysicsBtn = (e.target as HTMLElement).closest('#btn-popover-open-physics');
      if (openPhysicsBtn) {
        this.closePopover();
        if (this.options.onOpenPhysicsDrawer) {
          this.options.onOpenPhysicsDrawer();
        } else {
          window.dispatchEvent(new CustomEvent('soundform-open-physics-settings'));
        }
      }
    });

    // Arrow navigation for radiogroup accessibility
    this.popover.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const radios = Array.from(this.popover.querySelectorAll<HTMLElement>('[role="radio"]'));
        if (radios.length === 0) return;
        e.preventDefault();
        const currentIndex = radios.findIndex(r => r === document.activeElement);
        let nextIndex = 0;
        if (e.key === 'ArrowDown') {
          nextIndex = currentIndex >= 0 ? (currentIndex + 1) % radios.length : 0;
        } else {
          nextIndex = currentIndex >= 0 ? (currentIndex - 1 + radios.length) % radios.length : radios.length - 1;
        }
        radios[nextIndex]?.focus();
        radios[nextIndex]?.click();
      }
    });

    // Robust outside click detection via composedPath to withstand detached nodes
    this.documentClickHandler = (e: MouseEvent) => {
      if (!this.isPopoverOpen) return;
      const path = e.composedPath ? e.composedPath() : [];
      if (!path.includes(this.element)) {
        this.closePopover();
      }
    };

    // Close on Escape and return focus
    this.documentKeydownHandler = (e: KeyboardEvent) => {
      if (this.isPopoverOpen && e.key === 'Escape') {
        this.closePopover();
        this.badgeButton.focus();
      }
    };

    // Focusout handling to prevent tab leakage
    this.focusoutHandler = (e: FocusEvent) => {
      if (this.isPopoverOpen && e.relatedTarget && !this.element.contains(e.relatedTarget as Node)) {
        this.closePopover();
      }
    };

    document.addEventListener('click', this.documentClickHandler);
    document.addEventListener('keydown', this.documentKeydownHandler);
    this.element.addEventListener('focusout', this.focusoutHandler);
  }

  public destroy(): void {
    if (this.documentClickHandler) {
      document.removeEventListener('click', this.documentClickHandler);
    }
    if (this.documentKeydownHandler) {
      document.removeEventListener('keydown', this.documentKeydownHandler);
    }
    if (this.focusoutHandler) {
      this.element.removeEventListener('focusout', this.focusoutHandler);
    }
    this.element.remove();
  }

  private render(): void {
    this.renderPill();
    this.renderPopover();
  }

  private renderPill(): void {
    const info = PROVENANCE_DEFINITIONS[this.currentType];
    this.badgeButton.setAttribute(
      'aria-label',
      `Simulation fidelity: ${info.tag}. Click to change or view details.`
    );

    const pill = this.badgeButton.firstElementChild as HTMLElement;
    if (pill) {
      pill.className = [
        'inline-flex items-center gap-1.5 px-3 py-1 rounded-full',
        'text-xs font-medium border backdrop-blur-md shadow-sm',
        'transition-all duration-150 ease-out group-hover:brightness-125',
        info.colorClass,
      ].join(' ');

      pill.innerHTML = `
        <span class="inline-block w-1.5 h-1.5 rounded-full ${info.dotColorClass} animate-pulse shrink-0"></span>
        <span class="text-slate-400 font-normal">Physics:</span>
        <span class="font-semibold text-slate-100">${info.tag}</span>
        <span class="sr-only">${info.legacyTag}</span>
        <svg class="w-3 h-3 text-slate-400 transition-transform duration-150 group-hover:text-white shrink-0 ${this.isPopoverOpen ? 'rotate-180' : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="m6 9 6 6 6-6"/>
        </svg>
      `;
    }
  }

  private renderPopover(): void {
    const info = PROVENANCE_DEFINITIONS[this.currentType];
    const isLabCalibrated = this.currentType === 'BENCHMARKED';

    const modes = [
      {
        id: 'hybrid' as const,
        provenanceType: 'REDUCED_ORDER' as const,
        label: 'Real-Time (Balanced)',
        sublabel: 'Smooth 60 FPS acoustic wave physics',
        badgeText: 'Recommended',
      },
      {
        id: 'physical' as const,
        provenanceType: 'ANALYTIC' as const,
        label: 'Exact Wave Math',
        sublabel: 'Strict analytical wave solver & nodal lines',
      },
      {
        id: 'expressive' as const,
        provenanceType: 'INTERPRETIVE' as const,
        label: 'Expressive Art',
        sublabel: 'Dynamic sound-reactive artistic shapes',
      },
    ];

    const modeSelectorHtml = isLabCalibrated
      ? `
        <div class="p-3 rounded-xl bg-amber-500/10 border border-amber-400/20 text-amber-200 text-xs leading-relaxed mb-3">
          <strong class="font-semibold text-amber-300">Lab Apparatus Active:</strong> Physics parameters are locked to published empirical benchmarks. To customize wave solving fidelity, switch to Music Studio or Frequency Lab.
        </div>
      `
      : `
        <div class="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Switch Physics Fidelity</div>
        <div role="radiogroup" aria-label="Simulation Mode" class="flex flex-col gap-2 mb-3">
          ${modes
            .map((m) => {
              const isActive = this.currentType === m.provenanceType;
              return `
                <button
                  type="button"
                  role="radio"
                  data-mode="${m.id}"
                  aria-checked="${isActive ? 'true' : 'false'}"
                  tabindex="${isActive ? '0' : '-1'}"
                  class="group flex items-start gap-2.5 p-2.5 rounded-xl border text-left cursor-pointer transition-all duration-150 ease-out active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                    isActive
                      ? 'bg-cyan-500/15 border-cyan-400/40 text-white shadow-sm'
                      : 'bg-white/5 border-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
                  }"
                >
                  <div class="w-3.5 h-3.5 rounded-full border mt-0.5 shrink-0 flex items-center justify-center transition-colors ${
                    isActive ? 'border-cyan-400 bg-cyan-500/30' : 'border-slate-600 group-hover:border-slate-400'
                  }">
                    ${isActive ? '<div class="w-1.5 h-1.5 rounded-full bg-cyan-400"></div>' : ''}
                  </div>
                  <div class="flex flex-col min-w-0 flex-1">
                    <div class="flex items-center justify-between gap-1">
                      <span class="text-xs font-semibold leading-tight ${isActive ? 'text-cyan-200' : 'text-slate-200'}">${m.label}</span>
                      ${
                        m.badgeText
                          ? `<span class="text-[9px] font-mono px-1.5 py-0.2 rounded bg-cyan-400/15 text-cyan-300 border border-cyan-400/30">${m.badgeText}</span>`
                          : ''
                      }
                    </div>
                    <span class="text-[10px] text-slate-400 leading-normal mt-0.5">${m.sublabel}</span>
                  </div>
                </button>
              `;
            })
            .join('')}
        </div>
      `;

    this.popover.innerHTML = `
      <div class="flex items-center justify-between gap-2 mb-2">
        <span class="text-[10px] font-mono tracking-wider uppercase font-semibold text-slate-400">Simulation Fidelity</span>
        <span class="text-[10px] font-mono px-1.5 py-0.5 rounded border ${info.colorClass}">${info.legacyTag}</span>
      </div>

      <div class="p-3 rounded-xl bg-slate-900/80 border border-white/10 mb-3">
        <h4 class="text-xs font-semibold text-white mb-1 leading-snug">${info.headline}</h4>
        <p class="text-[11px] text-slate-300 leading-relaxed mb-1.5">${info.summary}</p>
        <div class="text-[10px] text-slate-500 font-mono tracking-tight">${info.technicalFormula}</div>
      </div>

      ${modeSelectorHtml}

      <div class="pt-2 border-t border-white/10 flex items-center justify-between">
        <button
          type="button"
          id="btn-popover-open-physics"
          class="text-xs font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 rounded px-1.5 py-1 transition-colors duration-150"
        >
          <span>Open Physics Controls</span>
          <span aria-hidden="true">→</span>
        </button>
        <span class="text-[10px] text-slate-500 font-mono">60 FPS Calibrated</span>
      </div>
    `;
  }
}

