import { describe, it, expect, beforeEach } from 'vitest';
import { AudioEngine } from '../audio/AudioEngine';
import { VoiceTelemetryHUD } from './VoiceTelemetryHUD';

describe('VoiceTelemetryHUD UI Component', () => {
  let audioEngine: AudioEngine;
  let hud: VoiceTelemetryHUD;

  beforeEach(() => {
    audioEngine = new AudioEngine();
    hud = new VoiceTelemetryHUD(audioEngine);
  });

  it('should instantiate and render the container element', () => {
    const el = hud.getElement();
    expect(el).toBeDefined();
    expect(el.innerHTML).toContain('Voice Telemetry');
  });

  it('should support switching between patient and clinician modes', () => {
    hud.setMode('patient');
    const patientPanel = hud.getElement().querySelector('#hud-patient-panel') as HTMLElement;
    const clinicianPanel = hud.getElement().querySelector('#hud-clinician-panel') as HTMLElement;

    expect(patientPanel.style.display).toBe('flex');
    expect(clinicianPanel.style.display).toBe('none');

    hud.setMode('clinician');
    expect(patientPanel.style.display).toBe('none');
    expect(clinicianPanel.style.display).toBe('flex');
  });

  it('should update telemetry values without throwing', () => {
    expect(() => hud.update()).not.toThrow();
  });
});
