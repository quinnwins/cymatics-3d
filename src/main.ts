import './styles/main.css';
import { AudioEngine } from './audio/AudioEngine';
import { VisualizerEngine } from './visualizer/VisualizerEngine';
import { Header, EngineMode } from './ui/Header';
import { AudioControlsBar } from './ui/AudioControlsBar';
import { MusicLibraryCard } from './ui/MusicLibraryCard';
import { ModalSweeperControls } from './ui/ModalSweeperControls';
import { FrequencyLabControls } from './ui/FrequencyLabControls';
import { BioAcousticControls } from './ui/BioAcousticControls';
import { TherapyLabControls } from './ui/TherapyLabControls';
import { VoiceBiometricsControls } from './ui/VoiceBiometricsControls';
import { VoiceTelemetryHUD } from './ui/VoiceTelemetryHUD';
import { NobelDiscoveryControls } from './ui/NobelDiscoveryControls';
import { NobelTelemetryHUD } from './ui/NobelTelemetryHUD';
import { PresentationTourHUD } from './ui/PresentationTourHUD';
import { PresentationTourEngine } from './visualizer/PresentationTourEngine';
import { AcousticDataExporter } from './ui/AcousticDataExporter';
import { SpectrumHUD } from './ui/SpectrumHUD';
import { PhysicsDrawer } from './ui/PhysicsDrawer';
import { ViewportCameraThemeHUD } from './ui/ViewportCameraThemeHUD';

class App {
  private audioEngine: AudioEngine;
  private visualizer: VisualizerEngine;
  private header: Header;
  private audioControlsBar: AudioControlsBar;
  private musicLibraryCard!: MusicLibraryCard;
  private modalSweeperControls: ModalSweeperControls;
  private frequencyLabControls: FrequencyLabControls;
  private bioAcousticControls: BioAcousticControls;
  private therapyLabControls: TherapyLabControls;
  private voiceBiometricsControls: VoiceBiometricsControls;
  private voiceTelemetryHUD: VoiceTelemetryHUD;
  private nobelDiscoveryControls: NobelDiscoveryControls;
  private nobelTelemetryHUD: NobelTelemetryHUD;
  private presentationTourHUD: PresentationTourHUD;
  private presentationTourEngine: PresentationTourEngine;
  private spectrumHUD: SpectrumHUD;
  private physicsDrawer: PhysicsDrawer;
  private viewportHUD: ViewportCameraThemeHUD;

  private currentMode: EngineMode = 'music';
  private leftSidebarRoot: HTMLElement;
  private rightSidebarRoot: HTMLElement;
  private bottomTransportRoot: HTMLElement;
  private centerPromptRoot: HTMLElement;
  private viewportHudRoot: HTMLElement;
  private isLeftSidebarOpen = typeof window !== 'undefined' ? window.innerWidth >= 1024 : true;
  private isRightSidebarOpen = typeof window !== 'undefined' ? window.innerWidth >= 1024 : true;
  private hasInteracted = false;

  constructor() {
    this.leftSidebarRoot = document.getElementById('left-sidebar-root') as HTMLElement;
    this.rightSidebarRoot = document.getElementById('right-sidebar-root') as HTMLElement;
    this.bottomTransportRoot = document.getElementById('bottom-transport-root') as HTMLElement;
    this.centerPromptRoot = document.getElementById('center-prompt-root') as HTMLElement;
    this.viewportHudRoot = document.getElementById('viewport-hud-root') as HTMLElement;

    if (!this.isLeftSidebarOpen) {
      this.leftSidebarRoot.classList.add('sidebar-collapsed');
    }
    if (!this.isRightSidebarOpen) {
      this.rightSidebarRoot.classList.add('sidebar-collapsed');
    }

    const canvasContainer = document.getElementById('canvas-container') as HTMLElement;

    // 1. Initialize Core Engines
    this.audioEngine = new AudioEngine();
    this.visualizer = new VisualizerEngine(canvasContainer, this.audioEngine);

    // 2. Initialize Presentation Tour HUD & Engine
    this.presentationTourHUD = new PresentationTourHUD(document.body, {
      onNext: () => this.presentationTourEngine.nextStep(),
      onPrev: () => this.presentationTourEngine.prevStep(),
      onTogglePause: () => this.presentationTourEngine.togglePause(),
      onExit: () => this.presentationTourEngine.stopTour(),
    });

    this.presentationTourEngine = new PresentationTourEngine(
      this.visualizer,
      this.audioEngine,
      this.presentationTourHUD,
      mode => {
        this.header.setMode(mode);
        this.switchMode(mode, true);
      }
    );

    // 3. Initialize UI Components
    this.audioControlsBar = new AudioControlsBar(
      this.audioEngine,
      () => this.captureScreenshot(),
      () => this.exportClinicalDossier()
    );

    this.modalSweeperControls = new ModalSweeperControls(
      this.audioEngine,
      this.visualizer,
      state => {
        if (this.currentMode === 'music' || this.currentMode === 'cymatics' || this.currentMode === 'frequency' || this.currentMode === 'modal') {
          const layers = this.visualizer.getCymaticsLayers();
          if (layers.plate && !layers.droplet && !layers.trap) {
            this.visualizer.setStyle('cymatics-2d');
          } else {
            this.visualizer.setStyle('cymatics');
          }
          this.visualizer.chamberEnclosure.setVisible(state.showEnclosure !== false);
        }

        if (typeof this.visualizer.setChamberGeometry === 'function') {
          this.visualizer.setChamberGeometry(state.geometry);
        }

        this.visualizer.cymaticsPlateMesh.setModes(state.n, state.m, state.l);
        this.visualizer.cymaticsPlateMesh.setAutoModal(state.audioCoupled);

        this.visualizer.volumetricChladni.setModes(state.n, state.m, state.l);
        this.visualizer.cymaticsMesh.setModes(state.n, state.m, state.l);
        this.visualizer.cymaticsMesh.setAutoModal(state.audioCoupled);
        this.visualizer.cymaticsMesh.setFrequency(state.calculatedEigenfrequency);
        this.visualizer.gpuAcousticParticles.setModalNumbers(state.n, state.m, state.l);
        this.visualizer.gpuAcousticParticles.setChladniMode(state.trappingMode === 'nodes' ? 'normal' : 'inverse');

        this.audioControlsBar.render();
      },
      mode => this.switchMode(mode)
    );

    this.musicLibraryCard = new MusicLibraryCard(this.audioEngine, this.visualizer);

    this.frequencyLabControls = new FrequencyLabControls(this.audioEngine, this.visualizer);
    this.bioAcousticControls = new BioAcousticControls(this.audioEngine, this.visualizer, mode => this.switchMode(mode));
    this.therapyLabControls = new TherapyLabControls(this.audioEngine, this.visualizer, mode => this.switchMode(mode));
    this.voiceBiometricsControls = new VoiceBiometricsControls(this.audioEngine, this.visualizer);
    this.voiceTelemetryHUD = new VoiceTelemetryHUD(this.audioEngine, mode => {
      this.visualizer.vocalBiometricsLab.setStageMode(mode);
    });

    const nobelControlsContainer = document.createElement('div');
    nobelControlsContainer.className = 'w-full';
    this.nobelDiscoveryControls = new NobelDiscoveryControls(
      nobelControlsContainer,
      this.visualizer.nobelDiscoveryLab.state,
      state => {
        this.visualizer.nobelDiscoveryLab.state = { ...state };
        this.visualizer.nobelDiscoveryLab.setFrontier(state.frontierId);
        if (this.hasInteracted) {
          if (state.frontierId === 'viral-shatter') {
            this.visualizer.nobelDiscoveryLab.setVirus(state.selectedVirusId);
            this.audioEngine.playFrequency(state.frequencyHz);
          } else if (state.frontierId === 'mechanogenomics') {
            this.audioEngine.playFrequency(432);
          } else if (state.frontierId === 'bbb-dilation') {
            this.audioEngine.playFrequency(220);
          } else if (state.frontierId === 'senolytic-clearance') {
            this.audioEngine.playFrequency(145);
          }
        }
      },
      () => this.exportClinicalDossier(),
      mode => this.switchMode(mode)
    );
    this.nobelTelemetryHUD = new NobelTelemetryHUD(this.rightSidebarRoot);

    this.spectrumHUD = new SpectrumHUD(this.audioEngine, this.visualizer);
    this.physicsDrawer = new PhysicsDrawer(this.visualizer);
    this.viewportHUD = new ViewportCameraThemeHUD(this.visualizer);
    if (this.viewportHudRoot) {
      this.viewportHudRoot.appendChild(this.viewportHUD.getElement());
    }

    // Periodic HUD update timer (10 Hz for smooth live metrics)
    setInterval(() => {
      if (this.currentMode === 'voice') {
        this.voiceTelemetryHUD.update();
      } else if (this.currentMode === 'nobel') {
        const frontier = this.visualizer.nobelDiscoveryLab.state.frontierId;
        const telemetry = this.visualizer.nobelDiscoveryLab.getTelemetry();
        this.nobelTelemetryHUD.update(frontier, telemetry);
      }
    }, 100);

    // 4. Mount Header with Mode Switch & Presentation Actions
    this.header = new Header(
      this.audioEngine,
      this.visualizer,
      mode => this.switchMode(mode),
      () => this.presentationTourEngine.startTour(),
      () => this.exportClinicalDossier(),
      () => this.toggleLeftSidebar(),
      () => this.toggleRightSidebar(),
      () => this.resetActiveMode()
    );

    // Mount Master Audio Transport in Bottom Dock
    this.bottomTransportRoot.appendChild(this.audioControlsBar.getElement());
    this.header.setSidebarStates(this.isLeftSidebarOpen, this.isRightSidebarOpen);

    // 5. Initial Mount of Active Mode (Music Studio)
    this.switchMode('music');
    this.header.setMode('music');

    // 6. Seamless Audio Unlock on First User Interaction (Zero UI Overlay)
    this.setupAudioUnlock();

    if (typeof window !== 'undefined') {
      (window as any).__audioEngine = this.audioEngine;
      (window as any).__soundformApp = this;
    }
  }

  private resetActiveMode(): void {
    if (this.presentationTourEngine?.getIsRunning()) {
      this.presentationTourEngine.stopTour();
    }
    this.physicsDrawer.resetDefaults();
    if (this.viewportHUD) {
      this.viewportHUD.syncState();
    }
    if (this.currentMode === 'music' || this.currentMode === 'cymatics') {
      this.visualizer.setStyle('cymatics');
      this.audioEngine.playDemoTrack('cosmic-odyssey');
    } else if (this.currentMode === 'frequency' || this.currentMode === 'modal') {
      this.frequencyLabControls.setFrequency(432);
    }
    this.switchMode(this.currentMode);
  }

  private toggleLeftSidebar(): void {
    this.isLeftSidebarOpen = !this.isLeftSidebarOpen;
    if (this.isLeftSidebarOpen) {
      this.leftSidebarRoot.classList.remove('sidebar-collapsed');
      if (typeof window !== 'undefined' && window.innerWidth < 1024 && this.isRightSidebarOpen) {
        this.isRightSidebarOpen = false;
        this.rightSidebarRoot.classList.add('sidebar-collapsed');
      }
    } else {
      this.leftSidebarRoot.classList.add('sidebar-collapsed');
    }
    this.header.setSidebarStates(this.isLeftSidebarOpen, this.isRightSidebarOpen);
  }

  private toggleRightSidebar(): void {
    this.isRightSidebarOpen = !this.isRightSidebarOpen;
    if (this.isRightSidebarOpen) {
      this.rightSidebarRoot.classList.remove('sidebar-collapsed');
      if (typeof window !== 'undefined' && window.innerWidth < 1024 && this.isLeftSidebarOpen) {
        this.isLeftSidebarOpen = false;
        this.leftSidebarRoot.classList.add('sidebar-collapsed');
      }
    } else {
      this.rightSidebarRoot.classList.add('sidebar-collapsed');
    }
    this.header.setSidebarStates(this.isLeftSidebarOpen, this.isRightSidebarOpen);
  }

  private exportClinicalDossier(): void {
    if (this.currentMode === 'voice') {
      const vocalReport = this.audioEngine.voiceBiometrics?.update();
      if (!vocalReport) return;

      const isLiveMic = this.audioEngine.voiceBiometrics?.getIsLiveMic() ?? false;
      const profile = this.audioEngine.voiceBiometrics?.getActiveProfile();
      const dossier = AcousticDataExporter.generateVocalDossier(vocalReport, isLiveMic, profile?.name);
      const markdown = AcousticDataExporter.generateVocalMarkdownReport(dossier);
      const csv = AcousticDataExporter.generateVocalCSV(dossier);

      AcousticDataExporter.triggerDownload(`CLINICAL_VOCAL_DOSSIER_${dossier.dossierId}.md`, markdown, 'text/markdown');
      AcousticDataExporter.triggerDownload(`CLINICAL_VOCAL_DOSSIER_${dossier.dossierId}.json`, JSON.stringify(dossier, null, 2), 'application/json');
      AcousticDataExporter.triggerDownload(`CLINICAL_VOCAL_DOSSIER_${dossier.dossierId}.csv`, csv, 'text/csv');

      if (navigator.clipboard) {
        navigator.clipboard.writeText(markdown).catch(() => {});
      }
      return;
    }

    const isFreqMode = this.currentMode === 'frequency' || this.currentMode === 'modal';
    const chamberState = this.modalSweeperControls.getState();
    const activeFreq = isFreqMode ? this.frequencyLabControls.getFrequency() : chamberState.calculatedEigenfrequency;
    const activeGeom = isFreqMode ? this.frequencyLabControls.getGeometry() : chamberState.geometry;
    const activeTrap = isFreqMode ? this.frequencyLabControls.getTrappingMode() : chamberState.trappingMode;

    const vocalReport = this.audioEngine.voiceBiometrics?.update();
    const biophysTelemetry = this.visualizer.nobelDiscoveryLab.getTelemetry();
    const geomMap: Record<string, 'rectangular' | 'cylindrical' | 'spherical'> = {
      cube: 'rectangular',
      cylinder: 'cylindrical',
      sphere: 'spherical',
    };
    const record = AcousticDataExporter.generateRecord(
      {
        geometry: geomMap[activeGeom] || 'rectangular',
        modalIndices: { n: chamberState.n, m: chamberState.m, l: chamberState.l },
        resonantFrequencyHz: activeFreq,
        speedOfSoundMs: 343.0,
        mediumDensityKgM3: 1.204,
        acousticPower: 1.0,
      },
      {
        gorkovPotentialPeak: 0.25,
        activeParticles: this.visualizer.gpuAcousticParticles.getParticleCount(),
        trappingMode: activeTrap === 'nodes' ? 'nodes' : 'antinodes',
      },
      vocalReport,
      biophysTelemetry
    );
    const markdown = AcousticDataExporter.generateMarkdownReport(record);

    AcousticDataExporter.triggerDownload('SOUNDFORM3D_ACOUSTIC_SIMULATION.md', markdown, 'text/markdown');
    AcousticDataExporter.triggerDownload('SOUNDFORM3D_ACOUSTIC_SIMULATION.json', JSON.stringify(record, null, 2), 'application/json');
  }

  private captureScreenshot(): void {
    const dataUrl = this.visualizer.captureScreenshot();
    const link = document.createElement('a');
    link.download = `soundform-3d-${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
  }

  private switchMode(mode: EngineMode, fromTour = false): void {
    if (!fromTour && this.presentationTourEngine?.getIsRunning()) {
      this.presentationTourEngine.stopTour();
    }

    const normalizedMode = mode === 'cymatics' ? 'music' : mode === 'modal' ? 'frequency' : mode;
    this.currentMode = normalizedMode;
    if (this.header) {
      this.header.setMode(normalizedMode);
    }

    // Reset audio and lab specific states when changing modes
    this.audioEngine.stopFrequency();
    this.audioEngine.stopPersonalizedSoundMedicine();
    this.audioEngine.stopVoiceBiometrics();
    this.audioEngine.stopMicrophone();
    this.visualizer.vocalBiometricsLab.setTherapyActive(false);

    if (normalizedMode !== 'voice') {
      this.voiceTelemetryHUD.setVisible(false);
    }
    if (normalizedMode !== 'nobel') {
      this.nobelTelemetryHUD.setVisible(false);
    }

    if (normalizedMode === 'music') {
      this.visualizer.setStyle('cymatics');
      const layers = this.visualizer.getCymaticsLayers();
      if (layers.plate && !layers.droplet && !layers.trap) {
        this.visualizer.setStyle('cymatics-2d');
      }

      if (fromTour && this.hasInteracted) {
        this.audioEngine.playDemoTrack('cosmic-odyssey');
      }
    } else if (normalizedMode === 'frequency') {
      this.visualizer.setStyle('cymatics');
      const chamberGeom = this.frequencyLabControls.getGeometry();
      const showEnc = this.frequencyLabControls.getShowEnclosure();
      const trap = this.frequencyLabControls.getTrappingMode();
      const visMode = this.frequencyLabControls.getCymaticsVisibilityMode();
      this.visualizer.setCymaticsVisibilityMode(visMode);
      if (typeof this.visualizer.setChamberGeometry === 'function') {
        this.visualizer.setChamberGeometry(chamberGeom);
      }
      this.visualizer.chamberEnclosure.setVisible(showEnc);
      this.visualizer.gpuAcousticParticles.setChladniMode(trap === 'nodes' ? 'normal' : 'inverse');
      if (fromTour && this.hasInteracted) {
        this.audioEngine.playFrequency(this.frequencyLabControls.getFrequency());
      }
    } else if (normalizedMode === 'bio') {
      this.visualizer.setStyle('bio-acoustics');
      if (fromTour && this.hasInteracted) {
        const spec = this.visualizer.bioAcousticResonator.getSpecimen();
        this.audioEngine.playFrequency(spec.audibleDownmixHz);
      }
    } else if (normalizedMode === 'therapy') {
      this.visualizer.setStyle('therapy-lab');
      if (fromTour && this.hasInteracted) {
        const state = this.visualizer.acousticTherapyLab.getState();
        this.audioEngine.setTherapyAudioState(
          state.frequencyHz,
          state.phaseDegrees,
          state.acousticPower,
          state.isAntiPhaseActive,
          state.isHeterodyneActive
        );
      }
    } else if (normalizedMode === 'voice') {
      this.visualizer.setStyle('voice-biometrics');
      this.voiceTelemetryHUD.setVisible(true);
      if (fromTour && this.hasInteracted) {
        const prof = this.audioEngine.voiceBiometrics?.getActiveProfile();
        if (prof) {
          this.audioEngine.playFrequency(prof.f0Hz);
        }
      }
    } else if (normalizedMode === 'nobel') {
      this.visualizer.setStyle('nobel-lab');
      this.nobelTelemetryHUD.setVisible(true);
      if (fromTour && this.hasInteracted) {
        const frontier = this.visualizer.nobelDiscoveryLab.state.frontierId;
        if (frontier === 'mechanogenomics') {
          this.audioEngine.playFrequency(432);
        } else if (frontier === 'bbb-dilation') {
          this.audioEngine.playFrequency(220);
        } else if (frontier === 'viral-shatter') {
          this.audioEngine.playFrequency(this.visualizer.nobelDiscoveryLab.state.frequencyHz);
        } else {
          this.audioEngine.playFrequency(145);
        }
      }
    }

    this.renderSidebars();
    if (this.modalSweeperControls) {
      this.modalSweeperControls.setMode(normalizedMode);
    }
    if (this.physicsDrawer) {
      this.physicsDrawer.setMode(normalizedMode);
    }
    if (this.viewportHUD) {
      this.viewportHUD.setMode(normalizedMode);
    }
    this.audioControlsBar.setMode(normalizedMode);
  }

  private renderSidebars(): void {
    // Clear and re-mount appropriate control decks to left sidebar
    // Audio Spectrum HUD is anchored at the top of the left column across all modes
    this.leftSidebarRoot.innerHTML = '';
    this.leftSidebarRoot.appendChild(this.spectrumHUD.getElement());

    if (this.currentMode === 'music' || this.currentMode === 'cymatics') {
      this.leftSidebarRoot.appendChild(this.musicLibraryCard.getElement());
    } else if (this.currentMode === 'frequency' || this.currentMode === 'modal') {
      this.leftSidebarRoot.appendChild(this.frequencyLabControls.getElement());
    } else if (this.currentMode === 'bio') {
      this.leftSidebarRoot.appendChild(this.bioAcousticControls.getElement());
    } else if (this.currentMode === 'therapy') {
      this.leftSidebarRoot.appendChild(this.therapyLabControls.getElement());
    } else if (this.currentMode === 'voice') {
      this.leftSidebarRoot.appendChild(this.voiceBiometricsControls.getElement());
    } else if (this.currentMode === 'nobel') {
      this.leftSidebarRoot.appendChild(this.nobelDiscoveryControls.getElement());
    }

    // Mount right sidebar: In Music Studio, mount Resonator Shapes exclusively; mount PhysicsDrawer in lab modes
    this.rightSidebarRoot.innerHTML = '';

    if (this.currentMode === 'music' || this.currentMode === 'cymatics') {
      this.rightSidebarRoot.appendChild(this.modalSweeperControls.getElement());
    } else if (this.currentMode === 'frequency' || this.currentMode === 'modal') {
      this.rightSidebarRoot.appendChild(this.physicsDrawer.getElement());
      this.rightSidebarRoot.appendChild(this.modalSweeperControls.getElement());
    } else if (this.currentMode === 'voice') {
      this.rightSidebarRoot.appendChild(this.physicsDrawer.getElement());
      this.rightSidebarRoot.appendChild(this.voiceTelemetryHUD.getElement());
      this.voiceTelemetryHUD.setVisible(true);
    } else if (this.currentMode === 'nobel') {
      this.rightSidebarRoot.appendChild(this.physicsDrawer.getElement());
      this.rightSidebarRoot.appendChild(this.nobelTelemetryHUD.getElement());
      this.nobelTelemetryHUD.setVisible(true);
    } else {
      this.rightSidebarRoot.appendChild(this.physicsDrawer.getElement());
    }
  }

  private setupAudioUnlock(): void {
    const unlockAudio = async () => {
      if (this.hasInteracted) return;
      this.hasInteracted = true;

      await this.audioEngine.initialize();
      this.audioControlsBar.render();
      window.removeEventListener('pointerdown', unlockAudio, true);
      window.removeEventListener('keydown', unlockAudio, true);
      window.removeEventListener('click', unlockAudio, true);
    };

    window.addEventListener('pointerdown', unlockAudio, { once: true, capture: true });
    window.addEventListener('keydown', unlockAudio, { once: true, capture: true });
    window.addEventListener('click', unlockAudio, { once: true, capture: true });
  }
}

// Boot application
window.addEventListener('DOMContentLoaded', () => {
  (window as unknown as { app: App }).app = new App();
});

