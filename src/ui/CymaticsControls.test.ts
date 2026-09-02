import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AudioEngine } from '../audio/AudioEngine';
import { CymaticsControls } from './CymaticsControls';

describe('CymaticsControls Unified Deck', () => {
  let audioEngine: AudioEngine;
  let controls: CymaticsControls;
  let mockVisualizer: {
    currentStyle: string;
    layers: { plate: boolean; droplet: boolean; trap: boolean };
    getStyle: any;
    setStyle: any;
    getCymaticsLayers: any;
    setCymaticsLayers: any;
    setCymaticsVisibilityMode: any;
    cymaticsPlateMesh: { setModes: any; setChamberType: any; setAutoModal: any };
    cymaticsMesh: { setModes: any; setChamberType: any; setAutoModal: any; setFrequency: any };
    volumetricChladni: { setModes: any; setChamberType: any };
    gpuAcousticParticles: { setModalNumbers: any; setChamberGeometry: any; setChladniMode: any };
    chamberEnclosure: { setChamberType: any; setVisible: any };
  };

  beforeEach(() => {
    audioEngine = new AudioEngine();
    mockVisualizer = {
      currentStyle: 'cymatics',
      layers: { plate: false, droplet: true, trap: true },
      getStyle: vi.fn(() => mockVisualizer.currentStyle),
      setStyle: vi.fn((s: string) => {
        mockVisualizer.currentStyle = s;
      }),
      getCymaticsLayers: vi.fn(() => ({ ...mockVisualizer.layers })),
      setCymaticsLayers: vi.fn((l: any) => {
        mockVisualizer.layers = { ...mockVisualizer.layers, ...l };
      }),
      setCymaticsVisibilityMode: vi.fn(),
      cymaticsPlateMesh: {
        setModes: vi.fn(),
        setChamberType: vi.fn(),
        setAutoModal: vi.fn(),
      },
      cymaticsMesh: {
        setModes: vi.fn(),
        setChamberType: vi.fn(),
        setAutoModal: vi.fn(),
        setFrequency: vi.fn(),
      },
      volumetricChladni: {
        setModes: vi.fn(),
        setChamberType: vi.fn(),
      },
      gpuAcousticParticles: {
        setModalNumbers: vi.fn(),
        setChamberGeometry: vi.fn(),
        setChladniMode: vi.fn(),
      },
      chamberEnclosure: {
        setChamberType: vi.fn(),
        setVisible: vi.fn(),
      },
    };

    controls = new CymaticsControls(audioEngine, mockVisualizer as any);
  });

  it('should initialize with Resonator Shapes & Apparatus as primary open hero deck and Audio Drive below', () => {
    const el = controls.getElement();
    const state = controls.getState();

    expect(state.n).toBe(1);
    expect(state.m).toBe(1);
    expect(state.l).toBe(1);
    expect(state.geometry).toBe('cube');
    expect(state.calculatedEigenfrequency).toBeCloseTo(297.0, 1);
    expect(state.noteInfo.name).toBe('D4');

    // Resonator body is open by default as primary hero deck
    expect(controls.getIsResonatorOpen()).toBe(true);
    expect(el.querySelectorAll('.btn-cym-layer').length).toBe(3);
    expect(el.querySelectorAll('.btn-cym-geom').length).toBe(3);
    expect(el.querySelectorAll('.btn-cym-preset').length).toBeGreaterThan(0);

    // Resonator header is present with summary badge
    const accordionToggle = el.querySelector('#btn-toggle-cym-shapes') as HTMLButtonElement;
    expect(accordionToggle).toBeDefined();
    expect(accordionToggle.textContent).toContain('(1,1,1)');
    expect(accordionToggle.textContent).toContain('297Hz');

    // Audio track cards are rendered in Section 2 below
    expect(el.querySelectorAll('.btn-track-card').length).toBeGreaterThan(0);
  });

  it('should switch between Audio Drive sub-tabs (Tracks, Mic/File, Tone Synth)', () => {
    const el = controls.getElement();
    const micTabBtn = el.querySelector('#src-tab-mic-file') as HTMLButtonElement;
    expect(micTabBtn).toBeDefined();
    micTabBtn.click();

    expect(el.querySelector('#cym-btn-mic')).toBeDefined();
    expect(el.querySelector('#cym-file-input')).toBeDefined();

    const synthTabBtn = el.querySelector('#src-tab-synth') as HTMLButtonElement;
    synthTabBtn.click();

    expect(el.querySelector('#cym-btn-audition-synth')).toBeDefined();
    expect(el.querySelector('#cym-btn-audio-coupled')).toBeDefined();
  });

  it('should filter tracks by search query and category', () => {
    const el = controls.getElement();
    const searchInput = el.querySelector('#cym-search-input') as HTMLInputElement;
    expect(searchInput).toBeDefined();

    searchInput.value = 'Cosmic';
    searchInput.dispatchEvent(new Event('input'));

    const trackBtns = el.querySelectorAll('.btn-track-card');
    expect(trackBtns.length).toBeGreaterThan(0);
  });

  it('should apply 1-click shape presets directly from the shapes section', () => {
    controls.setResonatorOpen(true);
    const el = controls.getElement();
    const presetBtn = el.querySelector('[data-preset-id="cubic-lattice"]') as HTMLButtonElement;
    expect(presetBtn).toBeDefined();
    presetBtn.click();

    const state = controls.getState();
    expect(state.n).toBe(2);
    expect(state.m).toBe(2);
    expect(state.l).toBe(1);
    expect(state.calculatedEigenfrequency).toBeCloseTo(514.5, 1);
  });

  it('should step harmonic orders (n, m, l) with stepper buttons', () => {
    controls.setResonatorOpen(true);
    const el = controls.getElement();
    const stepNPlus = el.querySelector('[data-step-n="1"]') as HTMLButtonElement;
    expect(stepNPlus).toBeDefined();
    stepNPlus.click(); // n becomes 2

    const state = controls.getState();
    expect(state.n).toBe(2);
    // (2,1,1): c/2 * sqrt(4+1+1) = 171.5 * sqrt(6) = 420.08 Hz -> 420.1 Hz
    expect(state.calculatedEigenfrequency).toBeCloseTo(420.1, 1);
  });

  it('should toggle trapping mode between nodes and antinodes', () => {
    controls.setResonatorOpen(true);
    const el = controls.getElement();
    const trapBtn = el.querySelector('#cym-btn-trapping-mode') as HTMLButtonElement;
    expect(trapBtn).toBeDefined();

    expect(controls.getState().trappingMode).toBe('nodes');
    trapBtn.click();
    expect(controls.getState().trappingMode).toBe('antinodes');
  });

  it('should switch apparatus to 2D Sand Plate and back', () => {
    controls.setApparatus('2d-plate');
    expect(mockVisualizer.setCymaticsLayers).toHaveBeenCalledWith({ plate: true, droplet: false, trap: false });
    expect(mockVisualizer.setStyle).toHaveBeenCalledWith('cymatics-2d');
    expect(controls.getState().apparatus).toBe('2d-plate');

    controls.setApparatus('3d-droplet');
    expect(mockVisualizer.setCymaticsLayers).toHaveBeenCalledWith({ plate: false, droplet: true, trap: false });
    expect(mockVisualizer.setStyle).toHaveBeenCalledWith('cymatics');
    expect(controls.getState().apparatus).toBe('3d-droplet');
  });

  it('should support full Tone Synth frequency sweeper, Solfeggio presets, and overtones', () => {
    const el = controls.getElement();
    const synthTabBtn = el.querySelector('#src-tab-synth') as HTMLButtonElement;
    synthTabBtn.click();

    // 1. Switch to custom sweeper mode
    const sweeperBtn = el.querySelector('#cym-synth-sub-sweeper') as HTMLButtonElement;
    expect(sweeperBtn).toBeDefined();
    sweeperBtn.click();

    expect(el.querySelector('#cym-freq-master-slider')).toBeDefined();
    expect(el.querySelector('#cym-freq-number-input')).toBeDefined();

    // 2. Select Solfeggio preset 528 Hz
    const preset528 = el.querySelector('[data-hz="528"]') as HTMLButtonElement;
    expect(preset528).toBeDefined();
    preset528.click();

    const input = el.querySelector('#cym-freq-number-input') as HTMLInputElement;
    expect(parseFloat(input.value)).toBe(528);

    // 3. Step frequency by +10Hz
    const stepPlus10 = el.querySelector('[data-delta-hz="10"]') as HTMLButtonElement;
    expect(stepPlus10).toBeDefined();
    stepPlus10.click();

    const inputAfter = el.querySelector('#cym-freq-number-input') as HTMLInputElement;
    expect(parseFloat(inputAfter.value)).toBe(538);

    // 4. Toggle overtones drawer
    const overtonesBtn = el.querySelector('#cym-btn-toggle-overtones') as HTMLButtonElement;
    expect(overtonesBtn).toBeDefined();
    overtonesBtn.click();
    expect(el.querySelectorAll('.cym-harmonic-slider').length).toBe(8);
  });
});
