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
  private isLeftSidebarOpen = true;
  private isRightSidebarOpen = true;
  private hasInteracted = false;

  constructor() {
    this.leftSidebarRoot = document.getElementById('left-sidebar-root') as HTMLElement;
    this.rightSidebarRoot = document.getElementById('right-sidebar-root') as HTMLElement;
    this.bottomTransportRoot = document.getElementById('bottom-transport-root') as HTMLElement;
    this.centerPromptRoot = document.getElementById('center-prompt-root') as HTMLElement;

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
    this.audioControlsBar = new AudioControlsBar(this.audioEngine);
    this.musicLibraryCard = new MusicLibraryCard(this.audioEngine, () => {
      this.audioControlsBar.render();
    });
    this.frequencyLabControls = new FrequencyLabControls(this.audioEngine, mode => this.switchMode(mode));
    this.modalSweeperControls = new ModalSweeperControls(
      this.audioEngine,
      this.visualizer,
      state => {
        this.visualizer.volumetricChladni.setModes(state.n, state.m, state.l);
        this.visualizer.volumetricChladni.setChamberType(state.geometry === 'cube' ? 0 : state.geometry === 'cylinder' ? 1 : 2);
        this.visualizer.gpuAcousticParticles.setModalNumbers(state.n, state.m, state.l);
        this.visualizer.gpuAcousticParticles.setChamberGeometry(state.geometry);
        this.visualizer.gpuAcousticParticles.setChladniMode(state.trappingMode === 'nodes' ? 'normal' : 'inverse');
        this.visualizer.chamberEnclosure.setChamberType(state.geometry);
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

    // 6. Initial Welcome & Audio Unlock Overlay
    this.showWelcomePrompt();
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
        activeParticles: 262144,
        trappingMode: chamberState.trappingMode === 'nodes' ? 'nodes' : 'antinodes',
      },
      vocalReport,
      biophysTelemetry
    );
    const markdown = AcousticDataExporter.generateMarkdownReport(record);

    AcousticDataExporter.triggerDownload('SOUNDFORM3D_ACOUSTIC_SIMULATION.md', markdown, 'text/markdown');
    AcousticDataExporter.triggerDownload('SOUNDFORM3D_ACOUSTIC_SIMULATION.json', JSON.stringify(record, null, 2), 'application/json');
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
      this.visualizer.vocalBiometricsLab.setTherapyActive(false);
    }
    if (mode !== 'nobel') {
      this.nobelTelemetryHUD.setVisible(false);
    }

    if (mode === 'music') {
      this.visualizer.setStyle('hybrid');
      this.audioEngine.playDemoTrack('cosmic-odyssey');
    } else if (mode === 'frequency') {
      this.visualizer.setStyle('hybrid');
      this.audioEngine.playFrequency(432);
    } else if (mode === 'modal') {
      this.visualizer.setStyle('cymatics');
      this.audioEngine.playFrequency(this.modalSweeperControls.getState().calculatedEigenfrequency);
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

  private showWelcomePrompt(): void {
    this.centerPromptRoot.innerHTML = `
      <div id="welcome-card" class="glass-panel p-6 md:p-8 rounded-3xl max-w-md text-center flex flex-col items-center gap-4 cursor-pointer hover:border-cyan-400/40 transition-all shadow-2xl pointer-events-auto border border-white/10">
        <div class="w-14 h-14 rounded-2xl bg-cyan-500 text-slate-950 flex items-center justify-center shadow-lg shadow-cyan-500/20">
          <svg class="w-7 h-7 ml-0.5" viewBox="0 0 24 24" fill="currentColor" stroke="none">
            <polygon points="6 4 20 12 6 20 6 4"/>
          </svg>
        </div>
        <div class="flex flex-col gap-1">
          <h2 class="text-xl md:text-2xl font-bold text-white tracking-tight">
            SoundForm 3D
          </h2>
          <p class="text-xs text-slate-300">
            Click anywhere to start audio and explore 3D sound waves and biophysical acoustics.
          </p>
        </div>
        <div class="text-xs text-cyan-400 font-semibold mt-1">
          Click to Start
        </div>
      </div>
    `;

    const unlockAudio = async () => {
      if (this.hasInteracted) return;
      this.hasInteracted = true;

      await this.audioEngine.initialize();
      if (this.currentMode === 'music') {
        this.audioEngine.playDemoTrack('cosmic-odyssey');
      } else {
        this.switchMode(this.currentMode);
      }

      // Fade out welcome prompt
      const card = document.getElementById('welcome-card');
      if (card) {
        card.style.opacity = '0';
        card.style.transform = 'scale(0.9)';
        setTimeout(() => {
          this.centerPromptRoot.innerHTML = '';
        }, 300);
      }

      this.audioControlsBar.render();
    };

    document.getElementById('welcome-card')?.addEventListener('click', unlockAudio);
    window.addEventListener('keydown', unlockAudio, { once: true });
  }
}

// Boot application
window.addEventListener('DOMContentLoaded', () => {
  new App();
});

