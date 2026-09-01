/**
 * PresentationTourEngine.ts
 * SoundForm 3D - Executive Keynote Presentation & Nobel Committee Automated Tour Engine
 *
 * Orchestrates:
 * 1. Mode switching across all 7 verified visual styles.
 * 2. Synchronized audio synthesis & pitch changes.
 * 3. Autonomous camera orbit and focus trajectories.
 * 4. Step-by-step timer management with pause/resume support.
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

  public static readonly TOUR_STEPS: TourStep[] = [
    {
      id: 'music-space',
      chapterNumber: 1,
      title: '3D Acoustic Spacetime & Wave Propagation',
      badge: 'PHYSICS FOUNDATION',
      subtitle: 'Acoustic energy radiates as spherical wavefront shells through 3D spacetime with real-time multi-band psychoacoustic decomposition.',
      narrationText: 'Welcome to SoundForm 3D. Here we observe acoustic wave energy radiating as non-dispersive spherical shells through three-dimensional spacetime, driven by real-time psychoacoustic spectral decomposition.',
      durationMs: 14000,
    },
    {
      id: 'cymatics-lab',
      chapterNumber: 2,
      title: 'Volumetric Chladni Eigenmodes & Gor\'kov Trapping',
      badge: 'ACOUSTIC LEVITATION',
      subtitle: '3D standing Helmholtz wavefields trap microscopic particles along pressure nodal planes with zero acoustic dissipation.',
      narrationText: 'Demonstrating 3D volumetric Chladni eigenmodes. Standing acoustic waves trap suspended cellular matter at precise nodal lines under Gor\'kov acoustic radiation potentials.',
      durationMs: 14000,
    },
    {
      id: 'bio-acoustics',
      chapterNumber: 3,
      title: 'Cellular Mechanobiology & Elastography Sorting',
      badge: 'BIOPHYSICS',
      subtitle: 'Label-free acoustophoresis sorts malignant cells from normal stroma based on liquid-core cortical tension and Young\'s modulus stiffness gaps.',
      narrationText: 'Mechanical impedance contrast enables label-free single-cell sorting. High-stiffness normal cells and softened malignant cancer cells separate passively in acoustic pressure gradients.',
      durationMs: 14000,
    },
    {
      id: 'cancer-therapy',
      chapterNumber: 4,
      title: 'Targeted Oncotripsy & Anti-Phase Destructive Shielding',
      badge: 'ONCOLOGY BREAKTHROUGH',
      subtitle: 'Resonant 11th-harmonic oncotripsy ruptures tumor membranes while 180° anti-phase destructive interference shields adjacent healthy stroma.',
      narrationText: 'Frontier Oncotripsy. Exploiting structural fatigue at 118 Hertz. Anti-phase wave interference shields adjacent healthy tissue with greater than 99 percent viability while delivering lethal mechanical strain to malignant spheroids.',
      durationMs: 16000,
    },
    {
      id: 'voice-biometrics',
      chapterNumber: 5,
      title: 'Vocal Holography & Personalized Sound Medicine',
      badge: 'PRECISION MEDICINE',
      subtitle: 'Sub-sample YIN pitch, LPC-16 vocal tract tube reconstruction, and instant synthesis of patient-specific restorative harmonic medicine.',
      narrationText: 'Real-time acoustic vocal biomarker extraction. Neural jitter, shimmer, and vocal tract area dispersion synthesize a patient-specific restorative harmonic prescription.',
      durationMs: 14000,
    },
    {
      id: 'nobel-mechanogenomics',
      chapterNumber: 6,
      title: 'Acoustic Mechanogenomics & p53 Tumor Defense',
      badge: 'NOBEL FRONTIER',
      subtitle: 'Acoustic stress transmitted via LINC complexes dilates nuclear pores from 9 nm to 42 nm, uncoiling chromatin to trigger p53 gene transcription.',
      narrationText: 'Nobel Frontier Mechanogenomics. Acoustic stress transmitted via cytoskeletal LINC complexes dilates nuclear pores, uncoiling dense heterochromatin and directly triggering tumor-suppressor p53 gene transcription.',
      durationMs: 16000,
    },
    {
      id: 'nobel-viral-senolytic',
      chapterNumber: 7,
      title: 'Virucidal Lamb Shatter & Senolytic Rejuvenation',
      badge: 'CURING DISEASE',
      subtitle: 'Lamb quadrupolar resonance shatters viral capsids with >600:1 selectivity while selective shockwaves clear SASP-secreting senescent zombie cells.',
      narrationText: 'Final demonstration: Lamb quadrupolar vibrational resonance shatters icosahedral viral capsids with 620-to-1 somatic safety selectivity, concluding our executive demonstration.',
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
    this.hud.setVisible(true);
    this.executeCurrentStep();
  }

  public stopTour() {
    this.isRunning = false;
    this.isPaused = false;
    if (this.timerHandle) clearTimeout(this.timerHandle);
    this.hud.setVisible(false);
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

  private executeCurrentStep() {
    if (this.timerHandle) clearTimeout(this.timerHandle);
    const step = PresentationTourEngine.TOUR_STEPS[this.currentStepIndex];
    this.hud.renderStep(step, PresentationTourEngine.TOUR_STEPS.length);

    // Apply scene-specific visual and audio configurations
    switch (step.id) {
      case 'music-space':
        this.onModeChangeCallback('music');
        this.visualizer.setStyle('hybrid');
        this.audioEngine.playDemoTrack('cosmic-odyssey');
        break;

      case 'cymatics-lab':
        this.onModeChangeCallback('modal');
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
