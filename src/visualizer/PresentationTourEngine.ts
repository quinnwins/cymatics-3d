/**
 * PresentationTourEngine.ts
 * SoundForm 3D - Executive Keynote Presentation & Nobel Committee Automated Tour Engine
 *
 * Orchestrates:
 * 1. Mode switching across all 7 verified visual styles.
 * 2. Synchronized audio synthesis & pitch changes.
 * 3. Autonomous camera orbit and focus trajectories.
 * 4. Step-by-step timer management with pause/resume support.
 * 5. Keyboard hotkeys: Space (Pause/Resume), ArrowRight (Next), ArrowLeft (Prev), Escape (Exit).
 */

import { VisualizerEngine } from './VisualizerEngine';
import { AudioEngine } from '../audio/AudioEngine';
import { PresentationTourHUD, TourStep } from '../ui/PresentationTourHUD';
import { EngineMode } from '../ui/Header';

export class PresentationTourEngine {
  private currentStepIndex = 0;
  private isRunning = false;
  private isPaused = false;
  private timerHandle: any = null;
  private keydownListener: ((e: KeyboardEvent) => void) | null = null;

  public static readonly TOUR_STEPS: TourStep[] = [
    {
      id: 'music-space',
      chapterNumber: 1,
      title: '3D Wave Propagation & Music Space',
      badge: 'WAVE PHYSICS',
      subtitle: 'Sound waves radiate outward as concentric spheres, mapped in real time to the music frequency spectrum.',
      durationMs: 14000,
    },
    {
      id: 'cymatics-lab',
      chapterNumber: 2,
      title: '3D Standing Waves & Cymatics',
      badge: 'STANDING WAVES',
      subtitle: 'Standing sound waves create quiet pressure nodes where particles naturally gather and hover.',
      durationMs: 14000,
    },
    {
      id: 'bio-acoustics',
      chapterNumber: 3,
      title: 'Cell Mechanics & Sorting',
      badge: 'BIOPHYSICS',
      subtitle: 'Sound frequencies separate different cell types based on their natural elasticity and physical properties.',
      durationMs: 14000,
    },
    {
      id: 'cancer-therapy',
      chapterNumber: 4,
      title: 'Targeted Ultrasound & Wave Cancellation',
      badge: 'TARGETED THERAPY',
      subtitle: 'Resonant frequencies target tumor membranes while 180° phase cancellation protects surrounding healthy tissue.',
      durationMs: 16000,
    },
    {
      id: 'voice-biometrics',
      chapterNumber: 5,
      title: 'Voice Analysis & Acoustic Balancing',
      badge: 'VOICE LAB',
      subtitle: 'Precision pitch and vocal stability analysis generate tailored harmonic balancing tones.',
      durationMs: 14000,
    },
    {
      id: 'nobel-mechanogenomics',
      chapterNumber: 6,
      title: 'Sound Waves & Gene Activation',
      badge: 'GENE REGULATION',
      subtitle: 'Gentle sound pressure stretches the cell nucleus, opening pores to activate tumor-fighting defense genes.',
      durationMs: 16000,
    },
    {
      id: 'nobel-viral-senolytic',
      chapterNumber: 7,
      title: 'Resonant Disruption & Tissue Health',
      badge: 'TISSUE HEALTH',
      subtitle: 'Resonant frequencies break down viral shells and clear aging cells while preserving healthy tissue.',
      durationMs: 16000,
    },
  ];

  constructor(
    private visualizer: VisualizerEngine,
    private audioEngine: AudioEngine,
    private hud: PresentationTourHUD,
    private onModeChangeCallback: (mode: EngineMode) => void
  ) {}

  public startTour() {
    this.isRunning = true;
    this.isPaused = false;
    this.currentStepIndex = 0;
    this.visualizer.setCameraMode('autocam');
    this.hud.setVisible(true);
    this.attachKeyboardListener();
    this.executeCurrentStep();
  }

  public stopTour() {
    this.isRunning = false;
    this.isPaused = false;
    if (this.timerHandle) clearTimeout(this.timerHandle);
    this.detachKeyboardListener();
    this.hud.setVisible(false);
    this.audioEngine.stopAll();
  }

  public getIsRunning(): boolean {
    return this.isRunning;
  }

  public nextStep() {
    if (this.currentStepIndex < PresentationTourEngine.TOUR_STEPS.length - 1) {
      this.currentStepIndex++;
      this.executeCurrentStep();
    } else {
      this.stopTour();
    }
  }

  public prevStep() {
    if (this.currentStepIndex > 0) {
      this.currentStepIndex--;
      this.executeCurrentStep();
    }
  }

  public togglePause() {
    this.isPaused = !this.isPaused;
    if (!this.isPaused) {
      this.scheduleNextStep();
    } else if (this.timerHandle) {
      clearTimeout(this.timerHandle);
    }
  }

  private attachKeyboardListener() {
    if (this.keydownListener || typeof window === 'undefined') return;
    this.keydownListener = (e: KeyboardEvent) => {
      if (!this.isRunning) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        this.togglePause();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        this.nextStep();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        this.prevStep();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.stopTour();
      }
    };
    window.addEventListener('keydown', this.keydownListener);
  }

  private detachKeyboardListener() {
    if (this.keydownListener && typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.keydownListener);
      this.keydownListener = null;
    }
  }

  private executeCurrentStep() {
    if (this.timerHandle) clearTimeout(this.timerHandle);
    const step = PresentationTourEngine.TOUR_STEPS[this.currentStepIndex];
    this.hud.renderStep(step, PresentationTourEngine.TOUR_STEPS.length);

    // Apply scene-specific visual and audio configurations
    switch (step.id) {
      case 'music-space':
        this.onModeChangeCallback('music');
        this.visualizer.setStyle('cymatics');
        this.audioEngine.playDemoTrack('cosmic-odyssey');
        break;

      case 'cymatics-lab':
        this.onModeChangeCallback('frequency');
        this.visualizer.setStyle('cymatics');
        this.visualizer.volumetricChladni.setModes(2, 2, 2);
        this.audioEngine.playFrequency(118);
        break;

      case 'bio-acoustics':
        this.onModeChangeCallback('bio');
        this.visualizer.setStyle('bio-acoustics');
        this.audioEngine.playFrequency(240);
        break;

      case 'cancer-therapy':
        this.onModeChangeCallback('therapy');
        this.visualizer.setStyle('therapy-lab');
        this.visualizer.acousticTherapyLab.setState({
          frequencyHz: 118,
          phaseDegrees: 180,
          acousticPower: 1.0,
          isAntiPhaseActive: true,
          isHeterodyneActive: true,
        });
        this.audioEngine.setTherapyAudioState(118, 180, 1.0, true, true);
        break;

      case 'voice-biometrics':
        this.onModeChangeCallback('voice');
        this.visualizer.setStyle('voice-biometrics');
        this.audioEngine.playFrequency(220);
        break;

      case 'nobel-mechanogenomics':
        this.onModeChangeCallback('nobel');
        this.visualizer.setStyle('nobel-lab');
        this.visualizer.nobelDiscoveryLab.setFrontier('mechanogenomics');
        this.visualizer.nobelDiscoveryLab.state.isP53TranscriptionActive = true;
        this.audioEngine.playFrequency(432);
        break;

      case 'nobel-viral-senolytic':
        this.onModeChangeCallback('nobel');
        this.visualizer.setStyle('nobel-lab');
        this.visualizer.nobelDiscoveryLab.setFrontier('viral-shatter');
        this.visualizer.nobelDiscoveryLab.state.isLambResonanceLocked = true;
        this.audioEngine.playFrequency(185);
        break;
    }

    if (!this.isPaused) {
      this.scheduleNextStep();
    }
  }

  private scheduleNextStep() {
    const step = PresentationTourEngine.TOUR_STEPS[this.currentStepIndex];
    this.timerHandle = setTimeout(() => {
      if (this.isRunning && !this.isPaused) {
        this.nextStep();
      }
    }, step.durationMs);
  }
}
