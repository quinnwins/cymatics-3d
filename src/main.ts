import './styles/main.css';
import { AudioEngine } from './audio/AudioEngine';
import { VisualizerEngine } from './visualizer/VisualizerEngine';
import { Header, EngineMode } from './ui/Header';
import { AudioControlsBar } from './ui/AudioControlsBar';
import { MusicLibraryCard } from './ui/MusicLibraryCard';
import { FrequencyLabControls } from './ui/FrequencyLabControls';
import { ModalSweeperControls } from './ui/ModalSweeperControls';
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

class App {
  private audioEngine: AudioEngine;
  private visualizer: VisualizerEngine;
  private header: Header;
  private audioControlsBar: AudioControlsBar;
  private musicLibraryCard: MusicLibraryCard;
  private frequencyLabControls: FrequencyLabControls;
  private modalSweeperControls: ModalSweeperControls;
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

  private currentMode: EngineMode = 'music';
  private leftSidebarRoot: HTMLElement;
  private rightSidebarRoot: HTMLElement;
  private bottomTransportRoot: HTMLElement;
  private centerPromptRoot: HTMLElement;
  private isLeftSidebarOpen = typeof window !== 'undefined' ? window.innerWidth >= 1024 : true;
  private isRightSidebarOpen = typeof window !== 'undefined' ? window.innerWidth >= 1024 : true;
  private hasInteracted = false;

  constructor() {
    this.leftSidebarRoot = document.getElementById('left-sidebar-root') as HTMLElement;
    this.rightSidebarRoot = document.getElementById('right-sidebar-root') as HTMLElement;
    this.bottomTransportRoot = document.getElementById('bottom-transport-root') as HTMLElement;
    this.centerPromptRoot = document.getElementById('center-prompt-root') as HTMLElement;

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
    this.musicLibraryCard = new MusicLibraryCard(this.audioEngine, this.visualizer, () => {
      this.audioControlsBar.render();
    });
    this.frequencyLabControls = new FrequencyLabControls(this.audioEngine, this.visualizer, mode => this.switchMode(mode));
    this.modalSweeperControls = new ModalSweeperControls(
      this.audioEngine,
      this.visualizer,
      state => {
        if (state.apparatus === '2d-plate') {
          this.visualizer.setStyle('cymatics-2d');
        } else {
          this.visualizer.setStyle('cymatics');
        }
        this.visualizer.cymaticsPlateMesh.setModes(state.n, state.m, state.l);
        this.visualizer.cymaticsPlateMesh.setChamberType(state.geometry === 'cube' ? 'square' : 'circle');
        this.visualizer.cymaticsPlateMesh.setAutoModal(state.audioCoupled);

        this.visualizer.volumetricChladni.setModes(state.n, state.m, state.l);
        this.visualizer.volumetricChladni.setChamberType(state.geometry === 'cube' ? 0 : state.geometry === 'cylinder' ? 1 : 2);
        this.visualizer.cymaticsMesh.setModes(state.n, state.m, state.l);
        this.visualizer.cymaticsMesh.setAutoModal(state.audioCoupled);
        this.visualizer.cymaticsMesh.setChamberType(state.geometry);
        this.visualizer.cymaticsMesh.setFrequency(state.calculatedEigenfrequency);
        this.visualizer.gpuAcousticParticles.setModalNumbers(state.n, state.m, state.l);
        this.visualizer.gpuAcousticParticles.setChamberGeometry(state.geometry);
        this.visualizer.gpuAcousticParticles.setChladniMode(state.trappingMode === 'nodes' ? 'normal' : 'inverse');
        this.visualizer.chamberEnclosure.setChamberType(state.geometry);
        this.visualizer.chamberEnclosure.setVisible(state.showEnclosure !== false);

        if (this.currentMode === 'modal' && this.audioEngine.synthesizer?.getIsPlaying()) {
          this.audioEngine.synthesizer.setFrequency(state.calculatedEigenfrequency);
        }
      },
      mode => this.switchMode(mode)
    );
    this.bioAcousticControls = new BioAcousticControls(this.audioEngine, this.visualizer, mode => this.switchMode(mode));
    this.therapyLabControls = new TherapyLabControls(this.audioEngine, this.visualizer, mode => this.switchMode(mode));
    this.voiceBiometricsControls = new VoiceBiometricsControls(this.audioEngine, this.visualizer);
    this.voiceTelemetryHUD = new VoiceTelemetryHUD(this.audioEngine);

    const nobelControlsContainer = document.createElement('div');
    nobelControlsContainer.className = 'w-full';
    this.nobelDiscoveryControls = new NobelDiscoveryControls(
      nobelControlsContainer,
      this.visualizer.nobelDiscoveryLab.state,
      state => {
        this.visualizer.nobelDiscoveryLab.state = { ...state };
        this.visualizer.nobelDiscoveryLab.setFrontier(state.frontierId);
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
      },
      () => this.exportClinicalDossier(),
      mode => this.switchMode(mode)
    );
    this.nobelTelemetryHUD = new NobelTelemetryHUD(this.rightSidebarRoot);

    this.spectrumHUD = new SpectrumHUD(this.audioEngine, this.visualizer);
    this.physicsDrawer = new PhysicsDrawer(this.visualizer);

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
      () => this.toggleRightSidebar()
    );

    // Mount Master Audio Transport in Bottom Dock
    this.bottomTransportRoot.appendChild(this.audioControlsBar.getElement());

    // 5. Initial Mount of Active Mode (3D Cymatics Lab)
    this.switchMode('modal');
    this.header.setMode('modal');

    // 6. Seamless Audio Unlock on First User Interaction (Zero UI Overlay)
    this.setupAudioUnlock();
  }

  private toggleLeftSidebar(): void {
    this.isLeftSidebarOpen = !this.isLeftSidebarOpen;
    if (this.isLeftSidebarOpen) {
      this.leftSidebarRoot.classList.remove('sidebar-collapsed');
    } else {
      this.leftSidebarRoot.classList.add('sidebar-collapsed');
    }
    this.header.setSidebarStates(this.isLeftSidebarOpen, this.isRightSidebarOpen);
  }

  private toggleRightSidebar(): void {
    this.isRightSidebarOpen = !this.isRightSidebarOpen;
    if (this.isRightSidebarOpen) {
      this.rightSidebarRoot.classList.remove('sidebar-collapsed');
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

    const chamberState = this.modalSweeperControls.getState();
    const vocalReport = this.audioEngine.voiceBiometrics?.update();
    const biophysTelemetry = this.visualizer.nobelDiscoveryLab.getTelemetry();
    const geomMap: Record<string, 'rectangular' | 'cylindrical' | 'spherical'> = {
      cube: 'rectangular',
      cylinder: 'cylindrical',
      sphere: 'spherical',
    };
    const record = AcousticDataExporter.generateRecord(
      {
        geometry: geomMap[chamberState.geometry] || 'rectangular',
        modalIndices: { n: chamberState.n, m: chamberState.m, l: chamberState.l },
        resonantFrequencyHz: chamberState.calculatedEigenfrequency,
        speedOfSoundMs: 343.0,
        mediumDensityKgM3: 1.204,
        acousticPower: 1.0,
      },
      {
        gorkovPotentialPeak: 0.25,
        activeParticles: this.visualizer.gpuAcousticParticles.getParticleCount(),
        trappingMode: chamberState.trappingMode === 'nodes' ? 'nodes' : 'antinodes',
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

    this.currentMode = mode;
    if (this.header) {
      this.header.setMode(mode);
    }

    // Reset audio and lab specific states when changing modes
    if (mode !== 'voice') {
      this.voiceTelemetryHUD.setVisible(false);
      this.audioEngine.stopPersonalizedSoundMedicine();
      this.audioEngine.stopVoiceBiometrics();
      this.audioEngine.stopMicrophone();
      this.visualizer.vocalBiometricsLab.setTherapyActive(false);
    }
    if (mode !== 'nobel') {
      this.nobelTelemetryHUD.setVisible(false);
    }

    if (mode === 'music') {
      this.visualizer.setStyle('hybrid');
      this.audioEngine.playDemoTrack('cosmic-odyssey');
    } else if (mode === 'frequency') {
      this.visualizer.setStyle('cymatics');
      const chamberGeom = this.frequencyLabControls.getGeometry();
      const showEnc = this.frequencyLabControls.getShowEnclosure();
      const trap = this.frequencyLabControls.getTrappingMode();
      const visMode = this.frequencyLabControls.getCymaticsVisibilityMode();
      this.visualizer.setCymaticsVisibilityMode(visMode);
      this.visualizer.cymaticsMesh.setChamberType(chamberGeom);
      this.visualizer.gpuAcousticParticles.setChamberGeometry(chamberGeom);
      this.visualizer.chamberEnclosure.setChamberType(chamberGeom);
      this.visualizer.chamberEnclosure.setVisible(showEnc);
      this.visualizer.gpuAcousticParticles.setChladniMode(trap === 'nodes' ? 'normal' : 'inverse');
      this.audioEngine.playFrequency(this.frequencyLabControls.getFrequency());
    } else if (mode === 'modal') {
      const state = this.modalSweeperControls.getState();
      if (state.apparatus === '2d-plate') {
        this.visualizer.setStyle('cymatics-2d');
        this.visualizer.cymaticsPlateMesh.setModes(state.n, state.m, state.l);
        this.visualizer.cymaticsPlateMesh.setChamberType(state.geometry === 'cube' ? 'square' : 'circle');
      } else {
        this.visualizer.setStyle('cymatics');
        const visMode = state.apparatus === '3d-droplet' ? 'droplet' : state.apparatus === '3d-particles' ? 'particles' : 'both';
        this.visualizer.setCymaticsVisibilityMode(visMode);
        this.visualizer.cymaticsMesh.setChamberType(state.geometry);
        this.visualizer.gpuAcousticParticles.setChamberGeometry(state.geometry);
        this.visualizer.chamberEnclosure.setChamberType(state.geometry);
        this.visualizer.chamberEnclosure.setVisible(state.showEnclosure !== false);
        this.visualizer.gpuAcousticParticles.setChladniMode(state.trappingMode === 'nodes' ? 'normal' : 'inverse');
      }
      this.audioEngine.playFrequency(state.calculatedEigenfrequency);
    } else if (mode === 'bio') {
      this.visualizer.setStyle('bio-acoustics');
      const spec = this.visualizer.bioAcousticResonator.getSpecimen();
      this.audioEngine.playFrequency(spec.audibleDownmixHz);
    } else if (mode === 'therapy') {
      this.visualizer.setStyle('therapy-lab');
      const state = this.visualizer.acousticTherapyLab.getState();
      this.audioEngine.setTherapyAudioState(
        state.frequencyHz,
        state.phaseDegrees,
        state.acousticPower,
        state.isAntiPhaseActive,
        state.isHeterodyneActive
      );
    } else if (mode === 'voice') {
      this.visualizer.setStyle('voice-biometrics');
      this.voiceTelemetryHUD.setVisible(true);
      const prof = this.audioEngine.voiceBiometrics?.getActiveProfile();
      if (prof) {
        this.audioEngine.playFrequency(prof.f0Hz);
      }
    } else if (mode === 'nobel') {
      this.visualizer.setStyle('nobel-lab');
      this.nobelTelemetryHUD.setVisible(true);
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

    this.renderSidebars();
    if (this.physicsDrawer) {
      this.physicsDrawer.setMode(mode);
    }
    this.audioControlsBar.render();
  }

  private renderSidebars(): void {
    // 1. Render Left Sidebar (Action Controls & Workflows)
    this.leftSidebarRoot.innerHTML = '';
    if (this.currentMode === 'music') {
      this.leftSidebarRoot.appendChild(this.musicLibraryCard.getElement());
    } else if (this.currentMode === 'frequency') {
      this.leftSidebarRoot.appendChild(this.frequencyLabControls.getElement());
    } else if (this.currentMode === 'modal') {
      this.leftSidebarRoot.appendChild(this.modalSweeperControls.getElement());
    } else if (this.currentMode === 'bio') {
      this.leftSidebarRoot.appendChild(this.bioAcousticControls.container);
    } else if (this.currentMode === 'therapy') {
      this.leftSidebarRoot.appendChild(this.therapyLabControls.container);
    } else if (this.currentMode === 'voice') {
      this.leftSidebarRoot.appendChild(this.voiceBiometricsControls.container);
    } else if (this.currentMode === 'nobel') {
      this.leftSidebarRoot.appendChild(this.nobelDiscoveryControls.container);
    }

    // 2. Render Right Sidebar (Spectrum Telemetry, Mode Diagnostics & Physics Deck)
    this.rightSidebarRoot.innerHTML = '';
    this.rightSidebarRoot.appendChild(this.spectrumHUD.getElement());

    if (this.currentMode === 'voice') {
      this.rightSidebarRoot.appendChild(this.voiceTelemetryHUD.getElement());
      this.voiceTelemetryHUD.setVisible(true);
    } else if (this.currentMode === 'nobel') {
      this.rightSidebarRoot.appendChild(this.nobelTelemetryHUD.getElement());
      this.nobelTelemetryHUD.setVisible(true);
    }

    this.rightSidebarRoot.appendChild(this.physicsDrawer.getElement());
  }

  private setupAudioUnlock(): void {
    const unlockAudio = async () => {
      if (this.hasInteracted) return;
      this.hasInteracted = true;

      await this.audioEngine.initialize();
      if (this.currentMode === 'music') {
        this.audioEngine.playDemoTrack('cosmic-odyssey');
      } else {
        this.switchMode(this.currentMode);
      }

      this.audioControlsBar.render();
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };

    window.addEventListener('pointerdown', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });
  }
}

// Boot application
window.addEventListener('DOMContentLoaded', () => {
  new App();
});

