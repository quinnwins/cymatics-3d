import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { VoiceBiometricsControls } from './VoiceBiometricsControls';
import { AudioEngine } from '../audio/AudioEngine';
import { VisualizerEngine } from '../visualizer/VisualizerEngine';

describe('VoiceBiometricsControls UI Component', () => {
  let audioEngine: AudioEngine;
  let visualizer: VisualizerEngine;
  let controls: VoiceBiometricsControls;

  beforeEach(() => {
    audioEngine = new AudioEngine();
    visualizer = {
      vocalBiometricsLab: {
        setTherapyActive: vi.fn(),
      },
    } as unknown as VisualizerEngine;

    controls = new VoiceBiometricsControls(audioEngine, visualizer);
  });

  afterEach(() => {
    controls.dispose();
  });

  it('renders the control panel with Vocal Health tab active by default', () => {
    const el = controls.getElement();
    expect(el).toBeDefined();
    expect(el.innerHTML).toContain('Vocal Health');
    expect(el.innerHTML).toContain('Pitch Match &amp; Warm-Up');
    expect(el.innerHTML).toContain('MIC LEVEL');

    const leds = el.querySelectorAll('.vu-led');
    expect(leds.length).toBe(12);
  });

  it('switches to Pitch Match tab and displays pitch biofeedback HUD', () => {
    const el = controls.getElement();
    const tabPitchMatch = el.querySelector('#tab-pitch-match') as HTMLButtonElement;
    expect(tabPitchMatch).toBeDefined();

    tabPitchMatch.click();
    expect(el.innerHTML).toContain('Target Warm-Up Tone:');
    expect(el.innerHTML).toContain('Sing into mic');
    expect(el.querySelector('#pitch-match-pointer')).not.toBeNull();
  });

  it('selects different target notes in Pitch Match mode', () => {
    const el = controls.getElement();
    const tabPitchMatch = el.querySelector('#tab-pitch-match') as HTMLButtonElement;
    tabPitchMatch.click();

    let noteButtons = el.querySelectorAll('.btn-target-note');
    expect(noteButtons.length).toBe(5);

    // Click C4 (Middle C - index 3)
    (noteButtons[3] as HTMLElement).click();

    // Re-query note buttons after re-render
    noteButtons = el.querySelectorAll('.btn-target-note');
    expect(noteButtons[3].classList.contains('bg-purple-600')).toBe(true);
  });

  it('synchronizes UI state with AudioEngine on render', () => {
    // Mock active mic and playing medicine
    audioEngine.voiceBiometrics = {
      getIsLiveMic: () => true,
      getIsVoicing: () => false,
      getVuLevels: () => ({ vuRms: 0.5, peakLevel: 0.6, snrDb: 18 }),
      update: () => ({
        f0Hz: 220,
        pitchConfidence: 0.95,
        jitterPercent: 0.25,
        shimmerPercent: 1.5,
        hnrDb: 26,
        cppDb: 17,
        formantsHz: [280, 2250, 3100, 3600] as [number, number, number, number],
        fcr: 0.95,
        vocalTractRadiiCm: [0.8],
        tremorFreqHz: 0,
        tremorDepthPercent: 0,
        diagnosticHallmarks: [],
        healthStatus: 'pristine' as const,
        soundMedicinePrescription: {
          baseToneHz: 432,
          binauralBeatHz: 10,
          harmonicOvertones: [432, 864],
          isochronicPulseRateHz: 5,
          prescriptionTitle: '432 Hz Calibration',
        },
      }),
      setProfile: vi.fn(),
      getActiveProfile: () => ({ id: 'bel-canto', name: 'Bel Canto' }),
    } as unknown as typeof audioEngine.voiceBiometrics;

    audioEngine.isPersonalizedSoundMedicinePlaying = vi.fn().mockReturnValue(true);

    controls.render();

    const el = controls.getElement();
    const micBtn = el.querySelector('#btn-voice-mic');
    expect(micBtn?.textContent).toContain('Stop Mic');

    const medicineBtn = el.querySelector('#btn-play-medicine');
    expect(medicineBtn?.textContent).toContain('Stop Balancing Tone');
  });
});
