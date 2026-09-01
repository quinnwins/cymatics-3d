import './styles/main.css';
import { AudioEngine } from './audio/AudioEngine';
import { VisualizerEngine } from './visualizer/VisualizerEngine';
import { Header, EngineMode } from './ui/Header';
import { AudioControlsBar } from './ui/AudioControlsBar';
import { FrequencyLabControls } from './ui/FrequencyLabControls';
import { ModalSweeperControls } from './ui/ModalSweeperControls';
import { SpectrumHUD } from './ui/SpectrumHUD';
import { PhysicsDrawer } from './ui/PhysicsDrawer';

class App {
  private audioEngine: AudioEngine;
  private visualizer: VisualizerEngine;
  private header: Header;
  private audioControlsBar: AudioControlsBar;
  private frequencyLabControls: FrequencyLabControls;
  private modalSweeperControls: ModalSweeperControls;
  private spectrumHUD: SpectrumHUD;
  private physicsDrawer: PhysicsDrawer;

  private currentMode: EngineMode = 'modal';
  private footerRoot: HTMLElement;
  private centerPromptRoot: HTMLElement;
  private sidePanelRoot: HTMLElement;
  private hasInteracted = false;

  constructor() {
    this.footerRoot = document.getElementById('footer-root') as HTMLElement;
    this.centerPromptRoot = document.getElementById('center-prompt-root') as HTMLElement;
    this.sidePanelRoot = document.getElementById('side-panel-root') as HTMLElement;

    const canvasContainer = document.getElementById('canvas-container') as HTMLElement;

    // 1. Initialize Core Audio & Visualizer Engines
    this.audioEngine = new AudioEngine();
    this.visualizer = new VisualizerEngine(canvasContainer, this.audioEngine);

    // 2. Initialize UI Components
    this.audioControlsBar = new AudioControlsBar(this.audioEngine);
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

    this.spectrumHUD = new SpectrumHUD(this.audioEngine, this.visualizer);
    this.physicsDrawer = new PhysicsDrawer(this.visualizer);

    // Mount floating side panels (HUD & Physics)
    this.sidePanelRoot.appendChild(this.spectrumHUD.getElement());
    this.sidePanelRoot.appendChild(this.physicsDrawer.getElement());

    // 3. Mount Header with Mode Switcher
    this.header = new Header(
      this.audioEngine,
      this.visualizer,
      mode => this.switchMode(mode)
    );

    // 4. Initial Mount of Mode Controls
    this.switchMode('modal');

    // 5. Initial Audio Unlock Overlay
    this.showWelcomePrompt();
  }

  private switchMode(mode: EngineMode): void {
    this.currentMode = mode;
    this.header.setMode(mode);

    if (mode === 'modal') {
      this.visualizer.setStyle('cymatics');
      if (this.hasInteracted) {
        this.audioEngine.playFrequency(this.modalSweeperControls.getState().calculatedEigenfrequency);
      }
    } else if (mode === 'frequency') {
      this.visualizer.setStyle('hybrid');
      if (this.hasInteracted) {
        this.audioEngine.playFrequency(432);
      }
    } else if (mode === 'music') {
      this.visualizer.setStyle('hybrid');
      if (this.hasInteracted) {
        this.audioEngine.playDemoTrack('cosmic-odyssey');
      }
    }

    this.renderFooter();
  }

  private renderFooter(): void {
    this.footerRoot.innerHTML = '';
    if (this.currentMode === 'modal') {
      this.footerRoot.appendChild(this.modalSweeperControls.getElement());
    } else if (this.currentMode === 'frequency') {
      this.footerRoot.appendChild(this.frequencyLabControls.getElement());
    } else if (this.currentMode === 'music') {
      this.footerRoot.appendChild(this.audioControlsBar.getElement());
    }
  }

  private showWelcomePrompt(): void {
    this.centerPromptRoot.innerHTML = `
      <div id="welcome-card" class="glass-panel-accent p-6 md:p-8 rounded-3xl max-w-md text-center flex flex-col items-center gap-4 cursor-pointer transform hover:scale-105 transition-all shadow-2xl">
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
            Click anywhere to activate audio and explore 3D Cymatics standing waves and acoustic levitation fields.
          </p>
        </div>
        <div class="text-[11px] text-accent-cyan font-semibold flex items-center gap-1.5 mt-1">
          <span>💎</span>
          <span>Click to Enter 3D Cymatics Lab</span>
        </div>
      </div>
    `;

    const unlockAudio = async () => {
      if (this.hasInteracted) return;
      this.hasInteracted = true;

      await this.audioEngine.initialize();
      if (this.currentMode === 'modal') {
        this.audioEngine.playFrequency(this.modalSweeperControls.getState().calculatedEigenfrequency);
      } else if (this.currentMode === 'frequency') {
        this.audioEngine.playFrequency(432);
      } else {
        this.audioEngine.playDemoTrack('cosmic-odyssey');
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

      this.renderFooter();
    };

    document.getElementById('welcome-card')?.addEventListener('click', unlockAudio);
    window.addEventListener('keydown', unlockAudio, { once: true });
  }
}

// Boot application
window.addEventListener('DOMContentLoaded', () => {
  new App();
});
