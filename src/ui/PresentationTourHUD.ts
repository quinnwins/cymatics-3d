/**
 * PresentationTourHUD.ts
 * SoundForm 3D - Keynote Presentation & Guided Tour HUD
 *
 * Features:
 * - Floating glass cinematic subtitle & telemetry callout banner.
 * - Responsive viewport positioning (top-28 sm:top-24 md:top-20) to prevent header overlap.
 * - Step progress indicator across all 7 presentation chapters.
 * - Screen reader friendly ARIA live region (aria-live="polite").
 * - Next / Pause / Exit controls for interactive review.
 */

export interface TourStep {
  id: string;
  chapterNumber: number;
  title: string;
  badge: string;
  subtitle: string;
  durationMs: number;
}

export class PresentationTourHUD {
  public container: HTMLElement;
  private currentStepIndex = 0;
  private totalSteps = 7;

  private onNext: () => void;
  private onPrev: () => void;
  private onTogglePause: () => void;
  private onExit: () => void;
  private isPaused = false;

  constructor(
    parent: HTMLElement,
    callbacks: {
      onNext: () => void;
      onPrev: () => void;
      onTogglePause: () => void;
      onExit: () => void;
    }
  ) {
    this.container = document.createElement('div');
    this.container.id = 'presentation-tour-hud';
    this.container.className = 'fixed top-28 sm:top-24 md:top-20 left-1/2 transform -translate-x-1/2 z-40 max-w-3xl w-[92%] glass-panel p-4 rounded-3xl border border-amber-400/30 backdrop-blur-2xl shadow-2xl shadow-amber-500/10 text-white transition-all duration-500 hidden';
    parent.appendChild(this.container);

    this.onNext = callbacks.onNext;
    this.onPrev = callbacks.onPrev;
    this.onTogglePause = callbacks.onTogglePause;
    this.onExit = callbacks.onExit;

    // Ensure any browser speech synthesis queue is canceled
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
  }

  public setVisible(visible: boolean) {
    if (visible) {
      this.container.classList.remove('hidden');
    } else {
      this.container.classList.add('hidden');
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel();
        } catch {}
      }
    }
  }

  public renderStep(step: TourStep, total: number) {
    this.currentStepIndex = step.chapterNumber - 1;
    this.totalSteps = total;

    const progressDots = Array.from({ length: total })
      .map((_, i) => {
        const isActive = i === this.currentStepIndex;
        const isPast = i < this.currentStepIndex;
        return `<span class="h-1.5 rounded-full transition-all duration-300 ${
          isActive
            ? 'w-6 bg-cyan-400 shadow-sm shadow-cyan-400/50'
            : isPast
            ? 'w-2 bg-cyan-400/50'
            : 'w-2 bg-white/20'
        }"></span>`;
      })
      .join('');

    this.container.innerHTML = `
      <div class="flex flex-col gap-2.5" role="region" aria-label="Guided Tour Presentation HUD">
        <!-- Top Bar: Chapter Badge, Progress Dots & Controls -->
        <div class="flex items-center justify-between border-b border-white/10 pb-2">
          <div class="flex items-center gap-2">
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-800 text-amber-300 border border-amber-400/30 uppercase tracking-wider">
              ${step.badge}
            </span>
            <span class="text-xs font-bold text-white">
              Chapter ${step.chapterNumber} of ${total}: <span class="text-cyan-400">${step.title}</span>
            </span>
          </div>

          <div class="flex items-center gap-3">
            <div class="flex items-center gap-1">
              ${progressDots}
            </div>

            <button id="btn-tour-exit" aria-label="Exit guided keynote tour" class="text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-2.5 py-1 rounded-xl transition-all font-semibold cursor-pointer border border-white/10">
              Exit
            </button>
          </div>
        </div>

        <!-- Middle: Visual Subtitle with ARIA Live Region -->
        <div aria-live="polite" class="text-sm font-medium text-slate-200 leading-relaxed bg-slate-950/80 p-3 rounded-2xl border border-white/5 flex items-start gap-3 shadow-inner">
          <div class="flex flex-col gap-1">
            <p class="text-xs md:text-sm text-slate-100">${step.subtitle}</p>
          </div>
        </div>

        <!-- Bottom Controls & Keyboard Shortcuts Legend -->
        <div class="flex items-center justify-between pt-1">
          <div class="flex items-center gap-2">
            <button id="btn-tour-prev" aria-label="Previous presentation chapter" class="px-3 py-1 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 transition-all text-slate-200 border border-white/10 cursor-pointer ${
              this.currentStepIndex === 0 ? 'opacity-40 pointer-events-none' : ''
            }">
              Previous
            </button>
            <button id="btn-tour-pause" aria-label="${this.isPaused ? 'Resume tour playback' : 'Pause tour playback'}" class="px-3 py-1 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 transition-all text-slate-200 border border-white/10 cursor-pointer">
              ${this.isPaused ? 'Resume' : 'Pause'}
            </button>
            <button id="btn-tour-next" aria-label="${this.currentStepIndex === total - 1 ? 'Finish guided tour' : 'Next presentation chapter'}" class="px-3 py-1 rounded-xl text-xs font-bold bg-cyan-400 hover:bg-cyan-300 text-slate-950 transition-all shadow-md shadow-cyan-400/30 cursor-pointer">
              ${this.currentStepIndex === total - 1 ? 'Finish Tour' : 'Next Chapter'}
            </button>
          </div>

          <span class="text-[10px] font-mono text-slate-400 hidden sm:inline">
            Space: Pause • Arrows: Nav • Esc: Exit
          </span>
        </div>
      </div>
    `;

    this.attachEvents();
  }

  private attachEvents() {
    this.container.querySelector('#btn-tour-prev')?.addEventListener('click', () => this.onPrev());
    this.container.querySelector('#btn-tour-next')?.addEventListener('click', () => this.onNext());
    this.container.querySelector('#btn-tour-pause')?.addEventListener('click', () => {
      this.isPaused = !this.isPaused;
      this.onTogglePause();
      const btn = this.container.querySelector('#btn-tour-pause');
      if (btn) btn.textContent = this.isPaused ? 'Resume' : 'Pause';
    });
    this.container.querySelector('#btn-tour-exit')?.addEventListener('click', () => this.onExit());
  }
}
