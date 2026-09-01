/**
 * PresentationTourHUD.ts
 * SoundForm 3D - Executive Keynote Presentation & Nobel Committee Guided Tour HUD
 *
 * Features:
 * - Floating glass cinematic subtitle & telemetry callout banner.
 * - Step progress indicator across all 7 presentation chapters.
 * - Web Speech narration with visual subtitle fallback.
 * - Next / Pause / Exit controls for executive review.
 */

export interface TourStep {
  id: string;
  chapterNumber: number;
  title: string;
  badge: string;
  subtitle: string;
  narrationText: string;
  durationMs: number;
}

export class PresentationTourHUD {
  public container: HTMLElement;
  private currentStepIndex = 0;
  private totalSteps = 7;
  private isNarrationMuted = false;

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
    this.container.className = 'fixed top-20 left-1/2 transform -translate-x-1/2 z-40 max-w-3xl w-[92%] glass-panel p-4 rounded-3xl border border-amber-400/30 backdrop-blur-2xl shadow-2xl shadow-amber-500/10 text-white transition-all duration-500 hidden';
    parent.appendChild(this.container);

    this.onNext = callbacks.onNext;
    this.onPrev = callbacks.onPrev;
    this.onTogglePause = callbacks.onTogglePause;
    this.onExit = callbacks.onExit;
  }

  public setVisible(visible: boolean) {
    if (visible) {
      this.container.classList.remove('hidden');
    } else {
      this.container.classList.add('hidden');
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
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
        return `<span class="h-2 rounded-full transition-all duration-300 ${
          isActive
            ? 'w-8 bg-gradient-to-r from-amber-400 to-yellow-300 shadow-md shadow-amber-400/50'
            : isPast
            ? 'w-2 bg-amber-400/60'
            : 'w-2 bg-white/20'
        }"></span>`;
      })
      .join('');

    this.container.innerHTML = `
      <div class="flex flex-col gap-2.5">
        <!-- Top Bar: Chapter Badge, Progress Dots & Controls -->
        <div class="flex items-center justify-between border-b border-white/10 pb-2">
          <div class="flex items-center gap-2">
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-gradient-to-r from-amber-400 to-yellow-400 text-black uppercase tracking-wider">
              ${step.badge}
            </span>
            <span class="text-xs font-bold text-white/90">
              Chapter ${step.chapterNumber} of ${total}: <span class="text-amber-300">${step.title}</span>
            </span>
          </div>

          <div class="flex items-center gap-3">
            <div class="flex items-center gap-1">
              ${progressDots}
            </div>

            <button id="btn-tour-exit" class="text-xs text-white/60 hover:text-white bg-white/10 hover:bg-white/20 px-2.5 py-1 rounded-lg transition-all font-semibold">
              ✕ Exit Tour
            </button>
          </div>
        </div>

        <!-- Middle: Cinematic Subtitle & Narration -->
        <div class="text-sm font-medium text-white/95 leading-relaxed bg-black/40 p-3 rounded-2xl border border-white/5 flex items-start gap-3">
          <span class="text-xl animate-pulse">🎙️</span>
          <div class="flex flex-col gap-1">
            <p class="text-xs md:text-sm text-cyan-100">${step.subtitle}</p>
          </div>
        </div>

        <!-- Bottom Controls -->
        <div class="flex items-center justify-between pt-1">
          <div class="flex items-center gap-2">
            <button id="btn-tour-prev" class="px-3 py-1 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 transition-all text-white/80 ${
              this.currentStepIndex === 0 ? 'opacity-40 pointer-events-none' : ''
            }">
              ◀ Previous
            </button>
            <button id="btn-tour-pause" class="px-3 py-1 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 transition-all text-white/80">
              ${this.isPaused ? '▶ Resume' : '⏸ Pause'}
            </button>
            <button id="btn-tour-next" class="px-3 py-1 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-400 to-yellow-300 text-black hover:opacity-90 transition-all shadow-lg shadow-amber-400/20">
              ${this.currentStepIndex === total - 1 ? '🎉 Finish Tour' : 'Next Chapter ▶'}
            </button>
          </div>

          <button id="btn-tour-mute" class="text-[11px] text-white/60 hover:text-white flex items-center gap-1">
            <span>${this.isNarrationMuted ? '🔇 Voice Muted' : '🔊 Voice Narration On'}</span>
          </button>
        </div>
      </div>
    `;

    this.attachEvents();
    this.speak(step.narrationText);
  }

  private speak(text: string) {
    if (this.isNarrationMuted) return;
    if (!('speechSynthesis' in window)) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;

    // Pick crisp English voice if available
    const voices = window.speechSynthesis.getVoices();
    const englishVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Daniel')));
    if (englishVoice) utterance.voice = englishVoice;

    window.speechSynthesis.speak(utterance);
  }

  private attachEvents() {
    this.container.querySelector('#btn-tour-prev')?.addEventListener('click', () => this.onPrev());
    this.container.querySelector('#btn-tour-next')?.addEventListener('click', () => this.onNext());
    this.container.querySelector('#btn-tour-pause')?.addEventListener('click', () => {
      this.isPaused = !this.isPaused;
      this.onTogglePause();
      const btn = this.container.querySelector('#btn-tour-pause');
      if (btn) btn.textContent = this.isPaused ? '▶ Resume' : '⏸ Pause';
      if (this.isPaused && 'speechSynthesis' in window) window.speechSynthesis.pause();
      else if (!this.isPaused && 'speechSynthesis' in window) window.speechSynthesis.resume();
    });
    this.container.querySelector('#btn-tour-exit')?.addEventListener('click', () => this.onExit());
    this.container.querySelector('#btn-tour-mute')?.addEventListener('click', () => {
      this.isNarrationMuted = !this.isNarrationMuted;
      if (this.isNarrationMuted && 'speechSynthesis' in window) window.speechSynthesis.cancel();
      const btn = this.container.querySelector('#btn-tour-mute');
      if (btn) btn.textContent = this.isNarrationMuted ? '🔇 Voice Muted' : '🔊 Voice Narration On';
    });
  }
}
