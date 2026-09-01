/**
 * AudioEngine.ts
 * Master Unified Audio Engine
 * Coordinates Web Audio Context, AnalyserNode, Tone Synthesizer, Demo Tracks, Mic Stream, File Player, Voice Biometrics, and Sound Medicine.
 */

import { FrequencySynthesizer } from './FrequencySynthesizer';
import { SpectralAnalyzer, AudioBands, ShockwaveEvent } from './SpectralAnalyzer';
import { DemoAudioGenerator } from './DemoAudioGenerator';
import { VoiceBiometricAnalyzer } from './VoiceBiometricAnalyzer';
import { SoundMedicineSynthesizer } from './SoundMedicineSynthesizer';
import { VocalBiomarkerReport } from '../math/VoiceBiometricsPhysics';

export type AudioInputMode = 'frequency-lab' | 'demo-track' | 'file-upload' | 'microphone' | 'sound-medicine';

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private analyserNode: AnalyserNode | null = null;

  public synthesizer: FrequencySynthesizer | null = null;
  public analyzer: SpectralAnalyzer | null = null;
  public demoGenerator: DemoAudioGenerator | null = null;
  public voiceBiometrics: VoiceBiometricAnalyzer | null = null;
  public soundMedicine: SoundMedicineSynthesizer | null = null;

  // File audio element
  private audioElement: HTMLAudioElement;
  private audioSourceNode: MediaElementAudioSourceNode | null = null;

  // Microphone stream
  private micStream: MediaStream | null = null;
  private micSourceNode: MediaStreamAudioSourceNode | null = null;

  private currentMode: AudioInputMode = 'demo-track';
  private isInitialized = false;
  private isMuted = false;
  private masterVolume = 0.8;
  private activeBlobUrl: string | null = null;
  private loadedFileName: string | null = null;
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.audioElement = new Audio();
    this.audioElement.crossOrigin = 'anonymous';
    this.audioElement.loop = true;
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public notifyChange(): void {
    this.listeners.forEach(l => {
      try {
        l();
      } catch (e) {
        console.error('Error in AudioEngine subscriber', e);
      }
    });
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized && this.ctx) {
      if (this.ctx.state === 'suspended') {
        await this.ctx.resume();
      }
      return;
    }

    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioContextClass();
      if (this.ctx.state === 'suspended') {
        await this.ctx.resume();
      }

      this.analyserNode = this.ctx.createAnalyser();
      this.analyserNode.fftSize = 4096;
      this.analyserNode.smoothingTimeConstant = 0.2;

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.masterVolume, this.ctx.currentTime);

      // Audio Graph: Sources -> MasterGain -> AnalyserNode -> Destination (Speakers)
      this.masterGain.connect(this.analyserNode);
      this.analyserNode.connect(this.ctx.destination);

      this.synthesizer = new FrequencySynthesizer(this.ctx, this.masterGain);
      this.analyzer = new SpectralAnalyzer(this.analyserNode, this.ctx.sampleRate);
      this.demoGenerator = new DemoAudioGenerator(this.ctx, this.masterGain);
      this.voiceBiometrics = new VoiceBiometricAnalyzer(this.ctx);
      this.soundMedicine = new SoundMedicineSynthesizer(this.ctx, this.masterGain);

      this.isInitialized = true;
    } catch (err) {
      console.warn('AudioContext initialization failed or pending user interaction', err);
    }
  }

  public setMode(mode: AudioInputMode): void {
    if (this.currentMode === mode) return;

    // Stop previous sources
    this.synthesizer?.stop();
    this.demoGenerator?.stop();
    this.soundMedicine?.stop();
    this.audioElement.pause();
    this.stopMicrophoneInternal();
    this.voiceBiometrics?.stopMicrophone();

    this.currentMode = mode;
    this.notifyChange();
  }

  public getMode(): AudioInputMode {
    return this.currentMode;
  }

  public getLoadedFileName(): string | null {
    return this.currentMode === 'file-upload' ? this.loadedFileName : null;
  }

  public isMicrophoneActive(): boolean {
    return this.currentMode === 'microphone' && this.micStream !== null;
  }

  public getActiveTrackId(): string {
    return this.demoGenerator?.getActiveTrackId() || 'cosmic-odyssey';
  }

  // --- Demo Track Playback ---
  public async playDemoTrack(trackId?: string): Promise<void> {
    await this.initialize();
    this.setMode('demo-track');
    this.loadedFileName = null;
    this.demoGenerator?.play(trackId);
    this.notifyChange();
  }

  public stopDemoTrack(): void {
    this.demoGenerator?.stop();
    this.notifyChange();
  }

  // --- Frequency Synthesizer Control ---
  public async startFrequencyTone(freqHz: number): Promise<void> {
    await this.initialize();
    this.setMode('frequency-lab');
    this.loadedFileName = null;
    this.synthesizer?.setFrequency(freqHz);
    this.synthesizer?.start(this.masterVolume);
    this.notifyChange();
  }

  public async playFrequency(freqHz: number): Promise<void> {
    await this.startFrequencyTone(freqHz);
  }

  public setTherapyAudioState(
    freqHz: number,
    phaseDeg: number,
    power: number,
    isAntiPhase: boolean,
    isHeterodyne: boolean
  ): void {
    if (this.currentMode !== 'frequency-lab') {
      this.setMode('frequency-lab');
    }
    this.synthesizer?.setFrequency(freqHz);
    this.synthesizer?.setTherapyAudioState(freqHz, phaseDeg, power, isAntiPhase, isHeterodyne);
    if (!this.synthesizer?.getIsPlaying() && power > 0.01) {
      this.synthesizer?.start(this.masterVolume * power);
    }
    this.notifyChange();
  }

  public stopFrequency(): void {
    this.synthesizer?.stop();
    this.notifyChange();
  }

  // --- Acoustic Entrainment & Harmonic Resonance Playback ---
  public async playPersonalizedSoundMedicine(
    prescription: VocalBiomarkerReport['soundMedicinePrescription']
  ): Promise<void> {
    await this.initialize();
    this.setMode('sound-medicine');
    this.loadedFileName = null;
    this.soundMedicine?.playPrescription(prescription, this.masterVolume);
    this.notifyChange();
  }

  public stopPersonalizedSoundMedicine(): void {
    this.soundMedicine?.stop();
    this.notifyChange();
  }

  public isPersonalizedSoundMedicinePlaying(): boolean {
    return this.soundMedicine?.getIsPlaying() ?? false;
  }

  // --- Custom Audio File Upload ---
  public async loadAudioFile(file: File): Promise<string> {
    await this.initialize();
    this.setMode('file-upload');

    if (this.activeBlobUrl) {
      URL.revokeObjectURL(this.activeBlobUrl);
    }

    this.activeBlobUrl = URL.createObjectURL(file);
    this.loadedFileName = file.name;
    this.audioElement.src = this.activeBlobUrl;

    if (this.ctx && !this.audioSourceNode) {
      this.audioSourceNode = this.ctx.createMediaElementSource(this.audioElement);
      if (this.masterGain) {
        this.audioSourceNode.connect(this.masterGain);
      }
    }

    await this.audioElement.play();
    this.notifyChange();
    return file.name;
  }

  public togglePlayPause(): boolean {
    if (this.currentMode === 'demo-track') {
      if (this.demoGenerator?.getIsPlaying()) {
        this.demoGenerator.stop();
        this.notifyChange();
        return false;
      } else {
        this.demoGenerator?.play();
        this.notifyChange();
        return true;
      }
    }

    if (this.currentMode === 'file-upload') {
      if (this.audioElement.paused) {
        this.audioElement.play();
        this.notifyChange();
        return true;
      } else {
        this.audioElement.pause();
        this.notifyChange();
        return false;
      }
    }

    if (this.currentMode === 'frequency-lab') {
      if (this.synthesizer?.getIsPlaying()) {
        this.synthesizer.stop();
        this.notifyChange();
        return false;
      } else {
        this.synthesizer?.start(this.masterVolume);
        this.notifyChange();
        return true;
      }
    }

    if (this.currentMode === 'sound-medicine') {
      if (this.soundMedicine?.getIsPlaying()) {
        this.soundMedicine.stop();
        this.notifyChange();
        return false;
      }
    }

    return false;
  }

  // --- Live Microphone Input ---
  public async startMicrophone(): Promise<boolean> {
    await this.initialize();
    if (!this.ctx || !this.analyserNode) return false;

    try {
      this.setMode('microphone');
      this.loadedFileName = null;
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      this.micSourceNode = this.ctx.createMediaStreamSource(this.micStream);
      // NOTE: Connect mic exclusively to analyserNode to prevent feedback howl
      this.micSourceNode.connect(this.analyserNode);

      this.notifyChange();
      return true;
    } catch (err) {
      console.warn('Microphone permission denied or unavailable', err);
      return false;
    }
  }

  public stopMicrophone(): void {
    this.stopMicrophoneInternal();
    this.notifyChange();
  }

  private stopMicrophoneInternal(): void {
    if (this.micSourceNode) {
      this.micSourceNode.disconnect();
      this.micSourceNode = null;
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach((t) => t.stop());
      this.micStream = null;
    }
  }

  // --- Voice Biometrics Live Analysis ---
  public async startVoiceBiometrics(): Promise<boolean> {
    await this.initialize();
    if (!this.voiceBiometrics) return false;

    this.setMode('microphone');
    this.loadedFileName = null;
    const ok = await this.voiceBiometrics.startMicrophone();
    this.notifyChange();
    return ok;
  }

  public stopVoiceBiometrics(): void {
    this.voiceBiometrics?.stopMicrophone();
    this.notifyChange();
  }

  // --- Global Audio Properties ---
  public setMasterVolume(vol: number): void {
    this.masterVolume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.masterVolume, this.ctx.currentTime);
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    this.setMasterVolume(this.masterVolume);
    this.notifyChange();
    return this.isMuted;
  }

  public getMasterVolume(): number {
    return this.masterVolume;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public getIsPlaying(): boolean {
    if (this.currentMode === 'demo-track') {
      return this.demoGenerator?.getIsPlaying() ?? false;
    }
    if (this.currentMode === 'file-upload') {
      return !this.audioElement.paused;
    }
    if (this.currentMode === 'frequency-lab') {
      return this.synthesizer?.getIsPlaying() ?? false;
    }
    if (this.currentMode === 'sound-medicine') {
      return this.soundMedicine?.getIsPlaying() ?? false;
    }
    if (this.currentMode === 'microphone') {
      return this.micStream !== null;
    }
    return false;
  }

  // --- Per-Frame Update Hook ---
  public update(currentTimeSeconds: number): void {
    if (!this.isInitialized || !this.analyzer) return;
    this.analyzer.update(currentTimeSeconds);
  }

  public getCurrentBands(): AudioBands {
    return this.analyzer ? this.analyzer.currentBands : { subBass: 0, bass: 0, lowMid: 0, mid: 0, highMid: 0, high: 0, rms: 0 };
  }

  public getAudioBands(): AudioBands {
    return this.getCurrentBands();
  }

  public getActiveShockwaves(): ShockwaveEvent[] {
    return this.analyzer ? this.analyzer.activeShockwaves : [];
  }

  public getRawFrequencyData(): Float32Array {
    return this.analyzer ? this.analyzer.getRawFrequencyData() : new Float32Array(2048);
  }

  public getFundamentalFrequency(): number {
    if (this.currentMode === 'frequency-lab') {
      return this.synthesizer ? this.synthesizer.frequency : 432;
    }
    return this.analyzer ? this.analyzer.fundamentalFreq : 0;
  }

  public getAudioElement(): HTMLAudioElement {
    return this.audioElement;
  }
}
