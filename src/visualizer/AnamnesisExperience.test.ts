import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';
import { AnamnesisExperience, canControlAnamnesisPlayback } from './AnamnesisExperience';
import { temporalMemory } from './TemporalMemory';
import { ColorPalettes } from './ColorPalettes';
import type { AudioEngine } from '../audio/AudioEngine';

describe('Anamnesis playback semantics', () => {
  it('allows pausable sources and refuses to pretend live microphone input can pause', () => {
    for (const source of ['demo-track', 'file-upload', 'apple-music', 'spotify'] as const) {
      expect(canControlAnamnesisPlayback(source)).toBe(true);
    }
    expect(canControlAnamnesisPlayback('microphone')).toBe(false);
  });

  it('disables transport while inspecting a stored relic regardless of source', () => {
    for (const source of ['demo-track', 'file-upload', 'apple-music', 'spotify', 'microphone'] as const) {
      expect(canControlAnamnesisPlayback(source, true)).toBe(false);
    }
  });
});

describe('Anamnesis temporalMemory lifecycle and whisper suppression', () => {
  let experience: AnamnesisExperience | null = null;

  function createMockVisualizer() {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    const canvas = document.createElement('canvas');
    const renderer = {
      domElement: canvas,
      render: vi.fn(),
      getContext: () => ({
        readPixels: vi.fn(),
        RGBA: 0x1908,
        UNSIGNED_BYTE: 0x1401,
      }),
    } as unknown as THREE.WebGLRenderer;
    const controls = {
      target: new THREE.Vector3(),
      update: vi.fn(),
    };
    const makeVisibleObject = () => ({
      group: new THREE.Group(),
      setVisible: vi.fn(),
    });

    return {
      scene,
      camera,
      renderer,
      controls,
      simTime: 10,
      getStyle: () => 'cymatics',
      getCurrentPaletteId: () => 'cosmic-nebula',
      setCameraMode: vi.fn(),
      getCameraMode: () => 'orbit',
      applyCymaticsLayers: vi.fn(),
      cymaticsPlateMesh: makeVisibleObject(),
      cymaticsMesh: {
        ...makeVisibleObject(),
        temporalSculpture: makeVisibleObject(),
        setDropletVisible: vi.fn(),
      },
      gpuAcousticParticles: makeVisibleObject(),
      chamberEnclosure: {
        ...makeVisibleObject(),
        triggerRecognitionFlash: vi.fn(),
        isVisible: () => true,
      },
      volumetricChladni: makeVisibleObject(),
    };
  }

  function createMockAudio() {
    return {
      getMode: () => 'demo-track',
      getActiveTrackId: () => 'cosmic-odyssey',
      getLoadedFileName: () => null,
      getActiveStreamingTrack: () => null,
      getDuration: () => 120,
      getCurrentTime: () => 15,
      getPlaybackSpeed: () => 1,
      getIsPlaying: () => true,
      getActiveShockwaves: () => [],
      getRawFrequencyData: () => new Float32Array(2048),
      getAudioBands: () => ({ subBass: 0.5, bass: 0.5, lowMid: 0.5, mid: 0.5, highMid: 0.5, high: 0.5, rms: 0.5 }),
      getFundamentalFrequency: () => 440,
      isSeekable: () => true,
      seek: vi.fn(),
      togglePlayPause: vi.fn(),
    } as unknown as AudioEngine;
  }

  beforeEach(() => {
    temporalMemory.setEnabled(false);
  });

  afterEach(() => {
    experience?.dispose();
    experience = null;
    temporalMemory.setEnabled(false);
  });

  it('initializes enabled state strictly from temporalMemory settings', () => {
    temporalMemory.setEnabled(false);
    const audio = createMockAudio();
    const visualizer = createMockVisualizer();
    experience = new AnamnesisExperience(audio, visualizer as any, ColorPalettes.getPalette('cosmic-nebula'));

    expect(experience.getState().enabled).toBe(false);
    expect(experience.field.group.visible).toBe(false);
  });

  it('synchronizes dynamically when temporalMemory is toggled on and off', () => {
    temporalMemory.setEnabled(false);
    const audio = createMockAudio();
    const visualizer = createMockVisualizer();
    experience = new AnamnesisExperience(audio, visualizer as any, ColorPalettes.getPalette('cosmic-nebula'));
    expect(experience.getState().enabled).toBe(false);

    // Turn memory on
    temporalMemory.setEnabled(true);
    expect(experience.getState().enabled).toBe(true);

    // Turn memory off
    temporalMemory.setEnabled(false);
    expect(experience.getState().enabled).toBe(false);
    expect(experience.field.group.visible).toBe(false);
  });

  it('suppresses ingestObservation and return celebration when memory is off', () => {
    temporalMemory.setEnabled(false);
    const audio = createMockAudio();
    const visualizer = createMockVisualizer();
    experience = new AnamnesisExperience(audio, visualizer as any, ColorPalettes.getPalette('cosmic-nebula'));

    experience.ingestObservation({
      timeSeconds: 1.0,
      durationSeconds: 120,
      sampleRate: 44100,
      spectrum: new Float32Array(2048).fill(-30),
      bands: { subBass: 0.5, bass: 0.5, lowMid: 0.5, mid: 0.5, highMid: 0.5, high: 0.5, rms: 0.5 },
      fundamentalHz: 440,
      transient: 1.0,
    });

    expect(experience.getState().stats.moments).toBe(0);
    expect(visualizer.chamberEnclosure.triggerRecognitionFlash).not.toHaveBeenCalled();
  });

  it('automatically enables temporalMemory when user explicitly enters The Song Remembers', () => {
    temporalMemory.setEnabled(false);
    const audio = createMockAudio();
    const visualizer = createMockVisualizer();
    experience = new AnamnesisExperience(audio, visualizer as any, ColorPalettes.getPalette('cosmic-nebula'));
    expect(experience.getState().enabled).toBe(false);

    experience.toggleExpanded();
    expect(temporalMemory.getSettings().enabled).toBe(true);
    expect(experience.getState().enabled).toBe(true);
    expect(experience.getState().expanded).toBe(true);
  });

  it('hides whisper banner immediately when memory is turned off', () => {
    temporalMemory.setEnabled(true);
    const audio = createMockAudio();
    const visualizer = createMockVisualizer();
    experience = new AnamnesisExperience(audio, visualizer as any, ColorPalettes.getPalette('cosmic-nebula'));

    const whisper = document.getElementById('anamnesis-whisper');
    expect(whisper).not.toBeNull();

    // Turn memory off: whisper must be suppressed and cleared
    temporalMemory.setEnabled(false);
    expect(whisper?.classList.contains('is-visible')).toBe(false);
    expect(whisper?.textContent).toBe('');
  });
});
