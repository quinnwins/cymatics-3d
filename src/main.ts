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
import { ClinicalReportExporter } from './ui/ClinicalReportExporter';
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
        this.switchMode(mode);
      }
    );

    // 3. Initialize UI Components
    this.audioControlsBar = new AudioControlsBar(this.audioEngine);
    this.musicLibraryCard = new MusicLibraryCard(this.audioEngine, () => {
      this.audioControlsBar.render();
    });
    this.frequencyLabControls = new FrequencyLabControls(this.audioEngine);
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
      }
    );
    this.bioAcousticControls = new BioAcousticControls(this.audioEngine, this.visualizer);
    this.therapyLabControls = new TherapyLabControls(this.audioEngine, this.visualizer);
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
      () => this.exportClinicalDossier()
    );
    this.nobelTelemetryHUD = new NobelTelemetryHUD(this.rightSidebarRoot);

    this.spectrumHUD = new SpectrumHUD(this.audioEngine, this.visualizer);
    this.physicsDrawer = new PhysicsDrawer(this.visualizer);

    // Periodic HUD update timer (10 Hz for smooth live metrics)
    setInterval(() => {
      if (this.currentMode === 'voice') {
        this.voiceTelemetryHUD.render();
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
    const telemetry = this.visualizer.nobelDiscoveryLab.getTelemetry();
    const vocalReport = this.audioEngine.voiceBiometrics?.update();
    const record = ClinicalReportExporter.generateClinicalRecord(telemetry, vocalReport);
    const markdown = ClinicalReportExporter.generateMarkdownDossier(record);

    ClinicalReportExporter.downloadMarkdown(markdown, 'SOUNDFORM3D_CLINICAL_TRIAL_DOSSIER.md');
    ClinicalReportExporter.downloadJson(record, 'SOUNDFORM3D_CLINICAL_TRIAL_DATA.json');
  }

  private switchMode(mode: EngineMode): void {
    this.currentMode = mode;

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
      <div id="welcome-card" class="glass-panel-accent p-6 md:p-8 rounded-3xl max-w-md text-center flex flex-col items-center gap-4 cursor-pointer transform hover:scale-105 transition-all shadow-2xl pointer-events-auto">
        <div class="w-16 h-16 rounded-2xl bg-gradient-to-tr from-accent-cyan via-accent-blue to-accent-magenta flex items-center justify-center shadow-lg shadow-accent-cyan/30 emitter-glow">
          <svg class="w-8 h-8 text-white ml-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="5 3 19 12 5 21 5 3" fill="currentColor"/>
          </svg>
        </div>
        <div class="flex flex-col gap-1">
          <h2 class="text-xl md:text-2xl font-bold bg-gradient-to-r from-white via-cyan-100 to-cyan-300 bg-clip-text text-transparent">
            SoundForm 3D
          </h2>
          <p class="text-xs text-gray-300">
            Click anywhere to activate audio and explore 3D Acoustic Wave Spacetime & Computational Mechanomedicine.
          </p>
        </div>
        <div class="text-[11px] text-accent-cyan font-semibold flex items-center gap-1.5 mt-1">
          <span>✨</span>
          <span>Tap to Enter Platform</span>
        </div>
      </div>
    `;

    const unlockAudio = async () => {
      if (this.hasInteracted) return;
      this.hasInteracted = true;

      await this.audioEngine.initialize();
      this.audioEngine.playDemoTrack('cosmic-odyssey');

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

