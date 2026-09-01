/**
 * Master Audio Engine
 * Coordinates Web Audio Context, AnalyserNode, Tone Synthesizer, Demo Tracks, Mic Stream, and File Player.
 */

import { FrequencySynthesizer } from './FrequencySynthesizer';
import { SpectralAnalyzer, AudioBands, ShockwaveEvent } from './SpectralAnalyzer';
import { DemoAudioGenerator } from './DemoAudioGenerator';

export type AudioInputMode = 'frequency-lab' | 'demo-track' | 'file-upload' | 'microphone';

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private analyserNode: AnalyserNode | null = null;

  public synthesizer: FrequencySynthesizer | null = null;
  public analyzer: SpectralAnalyzer | null = null;
  public demoGenerator: DemoAudioGenerator | null = null;

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

  constructor() {
    this.audioElement = new Audio();
    this.audioElement.crossOrigin = 'anonymous';
    this.audioElement.loop = true;
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
    this.audioElement.pause();
    this.stopMicrophone();

    this.currentMode = mode;
  }

  public getMode(): AudioInputMode {
    return this.currentMode;
  }

  // --- Demo Track Playback ---
  public async playDemoTrack(trackId = 'cosmic-odyssey'): Promise<void> {
    await this.initialize();
    this.setMode('demo-track');
    this.demoGenerator?.play(trackId);
  }

  public stopDemoTrack(): void {
    this.demoGenerator?.stop();
  }

  // --- Frequency Lab Playback ---
  public async playFrequency(freq: number): Promise<void> {
    await this.initialize();
    this.setMode('frequency-lab');
    if (this.synthesizer) {
      this.synthesizer.setFrequency(freq);
      this.synthesizer.start(this.masterVolume);
    }
  }

  public async startFrequencyTone(freq: number): Promise<void> {
    await this.playFrequency(freq);
  }

  public stopFrequency(): void {
    this.synthesizer?.stop();
  }

  // --- File Upload Playback ---
  public async loadAudioFile(file: File): Promise<string> {
    await this.initialize();
    this.setMode('file-upload');

    if (this.activeBlobUrl) {
      URL.revokeObjectURL(this.activeBlobUrl);
    }
    this.activeBlobUrl = URL.createObjectURL(file);
    this.audioElement.src = this.activeBlobUrl;

    if (!this.audioSourceNode && this.ctx && this.masterGain) {
      this.audioSourceNode = this.ctx.createMediaElementSource(this.audioElement);
      this.audioSourceNode.connect(this.masterGain);
    }

    await this.audioElement.play();
    return file.name;
  }

  public togglePlayPause(): boolean {
    if (this.currentMode === 'frequency-lab') {
      if (this.synthesizer?.getIsPlaying()) {
        this.synthesizer.stop();
        return false;
      } else {
        this.synthesizer?.start(this.masterVolume);
        return true;
      }
    } else if (this.currentMode === 'demo-track') {
      if (this.demoGenerator?.getIsRunning()) {
        this.demoGenerator.stop();
        return false;
      } else {
        const activeTrack = this.demoGenerator?.getActiveTrackId() || 'cosmic-odyssey';
        this.demoGenerator?.play(activeTrack);
        return true;
      }
    } else if (this.currentMode === 'file-upload') {
      if (this.audioElement.paused) {
        this.audioElement.play();
        return true;
      } else {
        this.audioElement.pause();
        return false;
      }
    }
    return false;
  }

  public getIsPlaying(): boolean {
    if (this.currentMode === 'frequency-lab') return this.synthesizer?.getIsPlaying() ?? false;
    if (this.currentMode === 'demo-track') return this.demoGenerator?.getIsRunning() ?? false;
    if (this.currentMode === 'file-upload') return !this.audioElement.paused;
    if (this.currentMode === 'microphone') return this.micStream !== null;
    return false;
  }

  // --- Live Microphone Input ---
  public async startMicrophone(): Promise<boolean> {
    await this.initialize();
    this.setMode('microphone');

    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      if (this.ctx && this.analyserNode) {
        this.micSourceNode = this.ctx.createMediaStreamSource(this.micStream);
        // Connect mic ONLY to analyserNode, NOT to masterGain/destination, to prevent feedback loops!
        this.micSourceNode.connect(this.analyserNode);
      }
      return true;
    } catch (err) {
      console.warn('Microphone permission denied or unavailable', err);
      return false;
    }
  }

  public stopMicrophone(): void {
    if (this.micStream) {
      this.micStream.getTracks().forEach(track => track.stop());
      this.micStream = null;
    }
    if (this.micSourceNode) {
      this.micSourceNode.disconnect();
      this.micSourceNode = null;
    }
  }

  // --- Master Volume & Mute ---
  public setMasterVolume(vol: number): void {
    this.masterVolume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : this.masterVolume, now, 0.05);
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    this.setMasterVolume(this.masterVolume);
    return this.isMuted;
  }

  public getMasterVolume(): number {
    return this.masterVolume;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  // --- Per-Frame Update Hook ---
  public update(currentTimeSeconds: number): void {
    if (!this.isInitialized || !this.analyzer) return;
    this.analyzer.update(currentTimeSeconds);
  }

  public getCurrentBands(): AudioBands {
    return this.analyzer ? this.analyzer.currentBands : { subBass: 0, bass: 0, lowMid: 0, mid: 0, highMid: 0, high: 0, rms: 0 };
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
