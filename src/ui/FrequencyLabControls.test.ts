import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AudioEngine } from '../audio/AudioEngine';
import { FrequencyLabControls } from './FrequencyLabControls';
import type { VisualizerEngine } from '../visualizer/VisualizerEngine';

function createMockVisualizer(): VisualizerEngine {
  const vis = {
    cymaticsVisibilityMode: 'both' as 'both' | 'particles' | 'droplet',
    setCymaticsVisibilityMode: vi.fn((mode: 'both' | 'particles' | 'droplet') => {
      vis.cymaticsVisibilityMode = mode;
    }),
    cymaticsMesh: {
      setFrequency: vi.fn(),
      setChamberType: vi.fn(),
      setAutoModal: vi.fn(),
    },
    gpuAcousticParticles: {
      setChamberGeometry: vi.fn(),
      setChladniMode: vi.fn(),
    },
    volumetricChladni: {
      setChamberType: vi.fn(),
    },
    chamberEnclosure: {
      setChamberType: vi.fn(),
      setVisible: vi.fn(),
    },
  } as unknown as VisualizerEngine;
  return vis;
}

describe('FrequencyLabControls UI & Option Parity', () => {
  let audioEngine: AudioEngine;
  let visualizer: VisualizerEngine;
  let controls: FrequencyLabControls;

  beforeEach(() => {
    audioEngine = new AudioEngine();
    visualizer = createMockVisualizer();
    controls = new FrequencyLabControls(audioEngine, visualizer);
  });

  it('initializes with default 432 Hz, cube geometry, glass enclosure, and node trapping', () => {
    const el = controls.getElement();
    expect(controls.getFrequency()).toBe(432);
    expect(controls.getGeometry()).toBe('cube');
    expect(controls.getShowEnclosure()).toBe(true);
    expect(controls.getTrappingMode()).toBe('nodes');
    expect(controls.getAudioCoupled()).toBe(true);
    expect(controls.getCymaticsVisibilityMode()).toBe('both');

    const numInput = el.querySelector('#freq-number-input') as HTMLInputElement;
    expect(numInput.value).toBe('432');

    const cubeBtn = el.querySelector('[data-geometry="cube"]');
    expect(cubeBtn?.classList.contains('glass-btn-active')).toBe(true);

    const glassBtn = el.querySelector('#btn-enclosure-glass');
    expect(glassBtn?.classList.contains('glass-btn-active')).toBe(true);

    const allLayersBtn = el.querySelector('[data-cymatics-vis="both"]');
    expect(allLayersBtn?.classList.contains('glass-btn-active')).toBe(true);
  });

  it('renders all chamber physics & boundary controls matching 3D Cymatics', () => {
    const el = controls.getElement();

    // Geometry options
    expect(el.querySelector('[data-geometry="cube"]')).not.toBeNull();
    expect(el.querySelector('[data-geometry="cylinder"]')).not.toBeNull();
    expect(el.querySelector('[data-geometry="sphere"]')).not.toBeNull();

    // Chamber boundary
    expect(el.querySelector('#btn-enclosure-glass')).not.toBeNull();
    expect(el.querySelector('#btn-enclosure-free')).not.toBeNull();

    // Specimen display
    expect(el.querySelectorAll('.btn-freq-vis').length).toBe(3);
    expect(el.querySelector('[data-cymatics-vis="both"]')).not.toBeNull();
    expect(el.querySelector('[data-cymatics-vis="particles"]')).not.toBeNull();
    expect(el.querySelector('[data-cymatics-vis="droplet"]')).not.toBeNull();

    // Particle trapping
    expect(el.querySelector('#btn-trap-nodes')).not.toBeNull();
    expect(el.querySelector('#btn-trap-antinodes')).not.toBeNull();

    // Audio sync toggle
    expect(el.querySelector('#btn-toggle-coupling')).not.toBeNull();
  });

  it('updates visualizer and state when chamber geometry is changed', () => {
    const el = controls.getElement();
    const cylinderBtn = el.querySelector('[data-geometry="cylinder"]') as HTMLElement;
    cylinderBtn.click();

    expect(controls.getGeometry()).toBe('cylinder');
    expect(visualizer.cymaticsMesh.setChamberType).toHaveBeenCalledWith('cylinder');
    expect(visualizer.gpuAcousticParticles.setChamberGeometry).toHaveBeenCalledWith('cylinder');
    expect(visualizer.volumetricChladni.setChamberType).toHaveBeenCalledWith(1);
    expect(visualizer.chamberEnclosure.setChamberType).toHaveBeenCalledWith('cylinder');
  });

  it('updates visualizer and state when boundary enclosure is changed', () => {
    const el = controls.getElement();
    const freeBtn = el.querySelector('#btn-enclosure-free') as HTMLElement;
    freeBtn.click();

    expect(controls.getShowEnclosure()).toBe(false);
    expect(visualizer.chamberEnclosure.setVisible).toHaveBeenCalledWith(false);
  });

  it('updates visualizer and button UI active state when specimen visibility layer is clicked', () => {
    const el = controls.getElement();
    const bothBtn = el.querySelector('[data-cymatics-vis="both"]') as HTMLElement;
    const dustBtn = el.querySelector('[data-cymatics-vis="particles"]') as HTMLElement;
    const dropletBtn = el.querySelector('[data-cymatics-vis="droplet"]') as HTMLElement;

    expect(bothBtn.classList.contains('glass-btn-active')).toBe(true);
    expect(dustBtn.classList.contains('glass-btn-active')).toBe(false);

    dustBtn.click();

    expect(controls.getCymaticsVisibilityMode()).toBe('particles');
    expect(visualizer.setCymaticsVisibilityMode).toHaveBeenCalledWith('particles');

    const updatedBothBtn = el.querySelector('[data-cymatics-vis="both"]') as HTMLElement;
    const updatedDustBtn = el.querySelector('[data-cymatics-vis="particles"]') as HTMLElement;
    expect(updatedDustBtn.classList.contains('glass-btn-active')).toBe(true);
    expect(updatedBothBtn.classList.contains('glass-btn-active')).toBe(false);

    // Click droplet
    updatedDustBtn.closest('.glass-panel')?.querySelector('[data-cymatics-vis="droplet"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(controls.getCymaticsVisibilityMode()).toBe('droplet');
    const updatedDropletBtn = el.querySelector('[data-cymatics-vis="droplet"]') as HTMLElement;
    expect(updatedDropletBtn.classList.contains('glass-btn-active')).toBe(true);
  });

  it('updates trapping mode and visualizer when trapping buttons are clicked', () => {
    const el = controls.getElement();
    const antinodesBtn = el.querySelector('#btn-trap-antinodes') as HTMLElement;
    antinodesBtn.click();

    expect(controls.getTrappingMode()).toBe('antinodes');
    expect(visualizer.gpuAcousticParticles.setChladniMode).toHaveBeenCalledWith('inverse');
  });

  it('responds to global modal-state-changed event', () => {
    const el = controls.getElement();
    window.dispatchEvent(
      new CustomEvent('modal-state-changed', {
        detail: {
          geometry: 'sphere',
          trappingMode: 'antinodes',
          showEnclosure: false,
          audioCoupled: false,
          cymaticsVisibilityMode: 'droplet',
        },
      })
    );

    expect(controls.getGeometry()).toBe('sphere');
    expect(controls.getTrappingMode()).toBe('antinodes');
    expect(controls.getShowEnclosure()).toBe(false);
    expect(controls.getAudioCoupled()).toBe(false);
    expect(controls.getCymaticsVisibilityMode()).toBe('droplet');

    const dropletBtn = el.querySelector('[data-cymatics-vis="droplet"]');
    expect(dropletBtn?.classList.contains('glass-btn-active')).toBe(true);
  });
});
