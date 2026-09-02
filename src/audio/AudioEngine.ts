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
import { AppleMusicConnector } from './connectors/AppleMusicConnector';
import { SpotifyConnector } from './connectors/SpotifyConnector';
import { StreamingTrack } from './connectors/types';

export type AudioInputMode =
  | 'frequency-lab'
  | 'demo-track'
  | 'file-upload'
  | 'microphone'
  | 'sound-medicine'
  | 'apple-music'
  | 'spotify';

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private analyserNode: AnalyserNode | null = null;

  public synthesizer: FrequencySynthesizer | null = null;
  public analyzer: SpectralAnalyzer | null = null;
  public demoGenerator: DemoAudioGenerator | null = null;
  public voiceBiometrics: VoiceBiometricAnalyzer | null = null;
  public soundMedicine: SoundMedicineSynthesizer | null = null;
  public appleMusicConnector: AppleMusicConnector = new AppleMusicConnector();
  public spotifyConnector: SpotifyConnector = new SpotifyConnector();

  // Streaming track metadata
  private activeStreamingTrack: StreamingTrack | null = null;

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
  private playbackSpeed = 1.0;
  private activeBlobUrl: string | null = null;
  private loadedFileName: string | null = null;
  private listeners: Set<() => void> = new Set();
  private initPromise: Promise<void> | null = null;

  constructor() {
    if (typeof Audio !== 'undefined') {
      this.audioElement = new Audio();
      this.audioElement.loop = true;
      this.audioElement.playbackRate = this.playbackSpeed;
      this.audioElement.defaultPlaybackRate = this.playbackSpeed;
      (this.audioElement as any).preservesPitch = true;

      // Reactively notify listeners on playback timeline and state changes
      this.audioElement.addEventListener('timeupdate', () => this.notifyChange());
      this.audioElement.addEventListener('durationchange', () => this.notifyChange());
      this.audioElement.addEventListener('loadedmetadata', () => this.notifyChange());
      this.audioElement.addEventListener('ended', () => this.notifyChange());
      this.audioElement.addEventListener('play', () => this.notifyChange());
      this.audioElement.addEventListener('pause', () => this.notifyChange());
    } else {
      this.audioElement = {
        currentTime: 0,
        duration: 0,
        paused: true,
        play: () => Promise.resolve(),
        pause: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
      } as unknown as HTMLAudioElement;
    }
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

  public ensureInitializedSync(): void {
    if (this.isInitialized && this.ctx && this.ctx.state !== 'closed') {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(e => console.warn('AudioContext resume deferred', e));
      }
      return;
    }

    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!this.ctx || this.ctx.state === 'closed') {
        this.ctx = new AudioContextClass();
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }

      if (!this.analyserNode) {
        this.analyserNode = this.ctx.createAnalyser();
        this.analyserNode.fftSize = 4096;
        this.analyserNode.smoothingTimeConstant = 0.2;

        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(this.masterVolume, this.ctx.currentTime);

        this.masterGain.connect(this.ctx.destination);
        this.masterGain.connect(this.analyserNode);

        this.synthesizer = new FrequencySynthesizer(this.ctx, this.masterGain);
        this.analyzer = new SpectralAnalyzer(this.analyserNode, this.ctx.sampleRate);
        this.demoGenerator = new DemoAudioGenerator(this.ctx, this.masterGain);
        this.demoGenerator.setPlaybackSpeed(this.playbackSpeed);
        this.voiceBiometrics = new VoiceBiometricAnalyzer(this.ctx);
        this.soundMedicine = new SoundMedicineSynthesizer(this.ctx, this.masterGain);
      }

      this.isInitialized = true;
    } catch (err) {
      console.warn('AudioContext initialization deferred until direct user activation', err);
    }
  }

  public async initialize(): Promise<void> {
    this.ensureInitializedSync();
    return Promise.resolve();
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

    // Clear external synthetic analysis override when leaving streaming mode
    if (mode !== 'spotify' && mode !== 'apple-music') {
      this.activeStreamingTrack = null;
      this.analyzer?.setExternalBands(null);
    }

    this.currentMode = mode;
    this.notifyChange();
  }

  public getMode(): AudioInputMode {
    return this.currentMode;
  }

  public getLoadedFileName(): string | null {
    return this.currentMode === 'file-upload' ? this.loadedFileName : null;
  }

  public getActiveStreamingTrack(): StreamingTrack | null {
    return (this.currentMode === 'apple-music' || this.currentMode === 'spotify') ? this.activeStreamingTrack : null;
  }

  public getStreamingTrackTitle(): string | null {
    return this.getActiveStreamingTrack()?.title || null;
  }

  public getStreamingTrackArtist(): string | null {
    return this.getActiveStreamingTrack()?.artist || null;
  }

  public getStreamingTrackArtwork(): string | null {
    return this.getActiveStreamingTrack()?.artworkUrl || null;
  }

  public isMicrophoneActive(): boolean {
    return this.currentMode === 'microphone' && this.micStream !== null;
  }

  public getActiveTrackId(): string {
    return this.demoGenerator?.getActiveTrackId() || 'cosmic-odyssey';
  }

  // --- Demo Track Playback ---
  public playDemoTrack(trackId?: string): void {
    this.ensureInitializedSync();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(e => console.warn('AudioContext resume deferred', e));
    }
    this.setMode('demo-track');
    this.loadedFileName = null;
    this.demoGenerator?.play(trackId);
    this.notifyChange();
  }

  public stopDemoTrack(): void {
    this.demoGenerator?.stop();
    this.notifyChange();
  }

  /**
   * Universal silence command: synchronously terminates all procedural demo synthesis,
   * frequency oscillators, binaural beats, sound medicine entrainment, HTML5 audio playback,
   * active streaming preview CDN streams, and microphone inputs across the entire application.
   */
  public stopAll(): void {
    this.demoGenerator?.stop();
    this.synthesizer?.stop();
    this.soundMedicine?.stop();
    if (this.audioElement) {
      this.audioElement.pause();
    }
    this.stopMicrophoneInternal();
    this.voiceBiometrics?.stopMicrophone();
    this.activeStreamingTrack = null;
    this.analyzer?.setExternalBands(null);
    this.notifyChange();
  }

  // --- Frequency Synthesizer Control ---
  public startFrequencyTone(freqHz: number): void {
    this.ensureInitializedSync();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(e => console.warn('AudioContext resume deferred', e));
    }
    this.setMode('frequency-lab');
    this.loadedFileName = null;
    this.synthesizer?.setFrequency(freqHz);
    this.synthesizer?.start(this.masterVolume);
    this.notifyChange();
  }

  public playFrequency(freqHz: number): void {
    this.startFrequencyTone(freqHz);
  }

  public setTherapyAudioState(
    freqHz: number,
    phaseDeg: number,
    power: number,
    isAntiPhase: boolean,
    isHeterodyne: boolean
  ): void {
    this.ensureInitializedSync();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(e => console.warn('AudioContext resume deferred', e));
    }
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
    if (this.ctx && this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
      } catch (e) {
        console.warn('AudioContext resume deferred', e);
      }
    }
    this.setMode('file-upload');

    if (this.activeBlobUrl) {
      URL.revokeObjectURL(this.activeBlobUrl);
    }

    this.activeBlobUrl = URL.createObjectURL(file);
    this.loadedFileName = file.name;

    // Ensure no crossOrigin attribute taints local blob playback
    if (typeof this.audioElement.removeAttribute === 'function') {
      this.audioElement.removeAttribute('crossOrigin');
    }
    (this.audioElement as any).crossOrigin = null;
    this.audioElement.src = this.activeBlobUrl;
    this.audioElement.playbackRate = this.playbackSpeed;
    this.audioElement.defaultPlaybackRate = this.playbackSpeed;
    (this.audioElement as any).preservesPitch = true;

    if (this.ctx && !this.audioSourceNode) {
      try {
        this.audioSourceNode = this.ctx.createMediaElementSource(this.audioElement);
        if (this.masterGain) {
          this.audioSourceNode.connect(this.masterGain);
        }
      } catch (e) {
        console.warn('MediaElementSource already created or pending', e);
      }
    }

    try {
      await this.audioElement.play();
    } catch (e) {
      console.warn('Playback waiting on user gesture', e);
    }
    this.notifyChange();
    return file.name;
  }

  // --- External Streaming Track (Apple Music & Spotify) ---
  public async loadStreamTrack(track: StreamingTrack): Promise<void> {
    this.ensureInitializedSync();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(e => console.warn('AudioContext resume deferred', e));
    }

    this.setMode(track.source);
    this.activeStreamingTrack = track;
    this.loadedFileName = null;

    if (this.activeBlobUrl) {
      URL.revokeObjectURL(this.activeBlobUrl);
      this.activeBlobUrl = null;
    }

    // Set crossOrigin BEFORE setting src to guarantee no CORS tainting on Web Audio AnalyserNode
    if (typeof this.audioElement.setAttribute === 'function') {
      this.audioElement.setAttribute('crossOrigin', 'anonymous');
    }
    (this.audioElement as any).crossOrigin = 'anonymous';

    // Hook Web Audio MediaElementSourceNode if not already connected
    if (this.ctx && !this.audioSourceNode) {
      try {
        this.audioSourceNode = this.ctx.createMediaElementSource(this.audioElement);
        if (this.masterGain) {
          this.audioSourceNode.connect(this.masterGain);
        }
      } catch (e) {
        console.warn('MediaElementSource already created or pending', e);
      }
    }

    // If Spotify track, fetch structural audio analysis for real-time chroma synthesis
    if (track.source === 'spotify') {
      this.spotifyConnector.fetchAudioAnalysis(track.id).catch(() => {});
    } else {
      this.analyzer?.setExternalBands(null);
    }

    let urlToPlay = track.previewUrl;
    if (!urlToPlay) {
      if (track.source === 'apple-music') {
        urlToPlay = await this.appleMusicConnector.resolveFreshPreviewUrl(track);
      } else if (track.source === 'spotify') {
        urlToPlay = await this.spotifyConnector.resolveFreshPreviewUrl(track);
      }
      if (urlToPlay) {
        track.previewUrl = urlToPlay;
      }
    }

    if (urlToPlay) {
      this.audioElement.src = urlToPlay;
      this.audioElement.playbackRate = this.playbackSpeed;
      this.audioElement.defaultPlaybackRate = this.playbackSpeed;
      (this.audioElement as any).preservesPitch = true;
      if (typeof this.audioElement.load === 'function') {
        this.audioElement.load();
      }

      // Auto-recovery error listener for rotated CDN tokens
      this.audioElement.onerror = async () => {
        if (!(track as any)._hasRetried) {
          (track as any)._hasRetried = true;
          let freshUrl: string | undefined;
          if (track.source === 'apple-music') {
            freshUrl = await this.appleMusicConnector.resolveFreshPreviewUrl(track);
          } else if (track.source === 'spotify') {
            freshUrl = await this.spotifyConnector.resolveFreshPreviewUrl(track);
          }
          if (freshUrl && freshUrl !== urlToPlay) {
            track.previewUrl = freshUrl;
            this.audioElement.src = freshUrl;
            if (typeof this.audioElement.load === 'function') {
              this.audioElement.load();
            }
            this.audioElement.play().catch(e => console.warn('Retry playback waiting for gesture', e));
          }
        }
      };

      try {
        await this.audioElement.play();
      } catch (e) {
        console.warn('Playback waiting on user gesture', e);
      }
    }

    this.setMasterVolume(this.masterVolume);
    this.notifyChange();
  }

  public getCurrentTime(): number {
    if (this.currentMode === 'file-upload' || this.currentMode === 'apple-music' || this.currentMode === 'spotify') {
      return this.audioElement.currentTime || 0;
    }
    return 0;
  }

  public getDuration(): number {
    if (this.currentMode === 'file-upload' || this.currentMode === 'apple-music' || this.currentMode === 'spotify') {
      const d = this.audioElement.duration;
      return (isNaN(d) || !isFinite(d))
        ? (this.activeStreamingTrack?.durationMs ? this.activeStreamingTrack.durationMs / 1000 : 0)
        : d;
    }
    return 0;
  }

  public seek(seconds: number): void {
    if (this.currentMode === 'file-upload' || this.currentMode === 'apple-music' || this.currentMode === 'spotify') {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      const dur = this.getDuration();
      const targetTime = Math.max(0, dur > 0 ? Math.min(dur, seconds) : Math.max(0, seconds));
      this.audioElement.currentTime = targetTime;
      this.notifyChange();
    }
  }

  public getProgress(): number {
    const dur = this.getDuration();
    return dur > 0 ? Math.max(0, Math.min(1, this.getCurrentTime() / dur)) : 0;
  }

  public isSeekable(): boolean {
    return (
      (this.currentMode === 'file-upload' || this.currentMode === 'apple-music' || this.currentMode === 'spotify') &&
      this.getDuration() > 0
    );
  }

  public togglePlayPause(): boolean {
    this.ensureInitializedSync();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(e => console.warn('AudioContext resume deferred', e));
    }

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

    if (this.currentMode === 'file-upload' || this.currentMode === 'apple-music' || this.currentMode === 'spotify') {
      if (this.audioElement.paused) {
        this.audioElement.play().catch(e => console.warn('Play interrupted', e));
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
      } else if (this.soundMedicine?.getActivePrescription()) {
        this.soundMedicine.playPrescription(this.soundMedicine.getActivePrescription()!, this.masterVolume);
        this.notifyChange();
        return true;
      }
    }

    return false;
  }

  // --- Live Microphone Input ---
  public async startMicrophone(): Promise<boolean> {
    await this.initialize();
    if (!this.ctx || !this.analyserNode) return false;

    // Cleanly stop any existing mic stream / node before acquiring new stream
    this.stopMicrophoneInternal();

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
      const now = this.ctx.currentTime;
      const target = this.isMuted ? 0 : this.masterVolume;
      this.masterGain.gain.cancelScheduledValues(now);
      if (typeof this.masterGain.gain.setTargetAtTime === 'function') {
        this.masterGain.gain.setTargetAtTime(target, now, 0.02);
      } else {
        this.masterGain.gain.setValueAtTime(target, now);
      }
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

  public setPlaybackSpeed(speed: number): void {
    const clamped = Math.max(0.1, Math.min(4.0, speed));
    if (this.playbackSpeed === clamped) return;
    this.playbackSpeed = clamped;

    if (this.audioElement) {
      this.audioElement.playbackRate = this.playbackSpeed;
      this.audioElement.defaultPlaybackRate = this.playbackSpeed;
      (this.audioElement as any).preservesPitch = true;
    }

    if (this.demoGenerator) {
      this.demoGenerator.setPlaybackSpeed(this.playbackSpeed);
    }

    this.notifyChange();
  }

  public getPlaybackSpeed(): number {
    return this.playbackSpeed;
  }

  public getIsPlaying(): boolean {
    if (this.currentMode === 'demo-track') {
      return this.demoGenerator?.getIsPlaying() ?? false;
    }
    if (this.currentMode === 'file-upload' || this.currentMode === 'apple-music' || this.currentMode === 'spotify') {
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

    if (this.currentMode === 'spotify' && this.spotifyConnector.analysisSynthesizer.getAnalysis()) {
      const posSec = this.audioElement.currentTime || 0;
      const res = this.spotifyConnector.analysisSynthesizer.evaluateBands(posSec);
      this.analyzer.setExternalBands(res.bands);
      if (res.shockwave) {
        this.analyzer.triggerShockwave(2.5, 8.0);
      }
    }

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

  public getTimeDomainData(): Float32Array {
    return this.analyzer ? this.analyzer.getTimeDomainData() : new Float32Array(4096);
  }

  public getFundamentalFrequency(): number {
    if (this.currentMode === 'frequency-lab') {
      return this.synthesizer && this.synthesizer.getIsPlaying() ? this.synthesizer.frequency : 0;
    }
    return this.analyzer ? this.analyzer.fundamentalFreq : 0;
  }

  public getAudioElement(): HTMLAudioElement {
    return this.audioElement;
  }
}
