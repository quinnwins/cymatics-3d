import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AudioEngine } from './AudioEngine';

class MockAudioContext {
  public state = 'running';
  public sampleRate = 44100;
  public currentTime = 0;
  public destination = {};
  public createAnalyser() {
    return {
      fftSize: 4096,
      smoothingTimeConstant: 0.2,
      getFloatFrequencyData: vi.fn(),
      getFloatTimeDomainData: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
  }
  public createGain() {
    return {
      gain: {
        value: 1,
        setValueAtTime: vi.fn(),
        setTargetAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
        cancelScheduledValues: vi.fn(),
      },
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
  }
  public createOscillator() {
    return {
      type: 'sine',
      frequency: {
        value: 440,
        setValueAtTime: vi.fn(),
        setTargetAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
        cancelScheduledValues: vi.fn(),
      },
      connect: vi.fn(),
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };
  }
  public createBiquadFilter() {
    return {
      type: 'lowpass',
      frequency: {
        value: 1000,
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      Q: { value: 1, setValueAtTime: vi.fn() },
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
  }
  public createBuffer(channels: number, length: number, sampleRate: number) {
    const data = new Float32Array(length);
    return {
      numberOfChannels: channels,
      length,
      sampleRate,
      getChannelData: (_ch: number) => data,
    };
  }
  public createBufferSource() {
    return {
      buffer: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };
  }
  public createStereoPanner() {
    return {
      pan: {
        value: 0,
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
  }
  public createMediaStreamSource() {
    return {
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
  }
  public createDynamicsCompressor() {
    return {
      threshold: { setValueAtTime: vi.fn() },
      knee: { setValueAtTime: vi.fn() },
      ratio: { setValueAtTime: vi.fn() },
      attack: { setValueAtTime: vi.fn() },
      release: { setValueAtTime: vi.fn() },
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
  }
  public createMediaElementSource() {
    return {
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
  }
  public resume() {
    this.state = 'running';
    return Promise.resolve();
  }
}

describe('AudioEngine Transport & Scrubber', () => {
  let audioEngine: AudioEngine;

  beforeEach(() => {
    (global as any).window = global.window || {};
    (global.window as any).AudioContext = MockAudioContext;
    audioEngine = new AudioEngine();
  });

  it('should initialize with 0 currentTime and 0 duration when no file is loaded', () => {
    expect(audioEngine.getCurrentTime()).toBe(0);
    expect(audioEngine.getDuration()).toBe(0);
    expect(audioEngine.getProgress()).toBe(0);
    expect(audioEngine.isSeekable()).toBe(false);
  });

  it('should notify subscribers on audio change', () => {
    const listener = vi.fn();
    const unsubscribe = audioEngine.subscribe(listener);

    audioEngine.notifyChange();
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    audioEngine.notifyChange();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('should support volume change and mute toggling', () => {
    audioEngine.setMasterVolume(0.5);
    expect(audioEngine.getMasterVolume()).toBe(0.5);

    const isMuted = audioEngine.toggleMute();
    expect(isMuted).toBe(true);
    expect(audioEngine.getIsMuted()).toBe(true);

    const isUnmuted = audioEngine.toggleMute();
    expect(isUnmuted).toBe(false);
  });

  it('should clamp seek position correctly', () => {
    expect(() => audioEngine.seek(10)).not.toThrow();
  });

  it('should handle custom audio file upload correctly', async () => {
    // Mock URL.createObjectURL and URL.revokeObjectURL
    global.URL.createObjectURL = vi.fn().mockReturnValue('blob:http://localhost/test-uuid');
    global.URL.revokeObjectURL = vi.fn();

    const mockFile = new File(['dummy audio pcm data'], 'Joel Stewart - Breath.mp3', { type: 'audio/mp3' });
    const loadedName = await audioEngine.loadAudioFile(mockFile);

    expect(loadedName).toBe('Joel Stewart - Breath.mp3');
    expect(audioEngine.getMode()).toBe('file-upload');
    expect(audioEngine.getLoadedFileName()).toBe('Joel Stewart - Breath.mp3');
    expect(global.URL.createObjectURL).toHaveBeenCalledWith(mockFile);
  });

  it('should toggle play and pause state in file-upload mode', async () => {
    global.URL.createObjectURL = vi.fn().mockReturnValue('blob:http://localhost/test-uuid-2');
    const mockFile = new File(['dummy audio'], 'ambient-pulse.wav', { type: 'audio/wav' });
    await audioEngine.loadAudioFile(mockFile);

    expect(audioEngine.getMode()).toBe('file-upload');
    expect(audioEngine.getLoadedFileName()).toBe('ambient-pulse.wav');

    const isPlaying = audioEngine.togglePlayPause();
    expect(typeof isPlaying).toBe('boolean');
  });

  it('should return 0 or fundamental frequency safely without throwing', () => {
    const freq = audioEngine.getFundamentalFrequency();
    expect(freq).toBeGreaterThanOrEqual(0);

    const bands = audioEngine.getAudioBands();
    expect(bands).toHaveProperty('subBass');
    expect(bands).toHaveProperty('bass');
    expect(bands).toHaveProperty('mid');
    expect(bands).toHaveProperty('high');
  });

  it('should play procedural demo tracks and switch tracks cleanly', async () => {
    await audioEngine.playDemoTrack('cyber-pulse');

    expect(audioEngine.getMode()).toBe('demo-track');
    expect(audioEngine.getActiveTrackId()).toBe('cyber-pulse');
    expect(audioEngine.getIsPlaying()).toBe(true);

    await audioEngine.playDemoTrack('quantum-glitch');
    expect(audioEngine.getActiveTrackId()).toBe('quantum-glitch');

    audioEngine.stopDemoTrack();
    expect(audioEngine.getIsPlaying()).toBe(false);
  });

  it('should toggle play and pause state in demo-track mode', async () => {
    await audioEngine.playDemoTrack('solfeggio-528');
    expect(audioEngine.getIsPlaying()).toBe(true);

    const isPlayingAfterToggle1 = audioEngine.togglePlayPause();
    expect(isPlayingAfterToggle1).toBe(false);
    expect(audioEngine.getIsPlaying()).toBe(false);

    const isPlayingAfterToggle2 = audioEngine.togglePlayPause();
    expect(isPlayingAfterToggle2).toBe(true);
    expect(audioEngine.getIsPlaying()).toBe(true);
  });

  it('should stop demo generator when switching mode to microphone or file-upload', async () => {
    await audioEngine.playDemoTrack('cyber-pulse');
    expect(audioEngine.getMode()).toBe('demo-track');
    expect(audioEngine.getIsPlaying()).toBe(true);

    audioEngine.setMode('frequency-lab');
    expect(audioEngine.getMode()).toBe('frequency-lab');
    expect(audioEngine.demoGenerator?.getIsPlaying()).toBe(false);
  });

  it('should stop frequency synthesizer cleanly when stopFrequency() is called', () => {
    audioEngine.playFrequency(432);
    expect(audioEngine.getMode()).toBe('frequency-lab');
    expect(audioEngine.synthesizer?.getIsPlaying()).toBe(true);
    expect(audioEngine.getIsPlaying()).toBe(true);

    audioEngine.stopFrequency();
    expect(audioEngine.synthesizer?.getIsPlaying()).toBe(false);
    expect(audioEngine.getIsPlaying()).toBe(false);
  });

  it('should prevent frequency tone bleeding when switching back to demo tracks', async () => {
    audioEngine.playFrequency(528);
    expect(audioEngine.synthesizer?.getIsPlaying()).toBe(true);

    audioEngine.stopFrequency();
    await audioEngine.playDemoTrack('cosmic-odyssey');

    expect(audioEngine.synthesizer?.getIsPlaying()).toBe(false);
    expect(audioEngine.getMode()).toBe('demo-track');
    expect(audioEngine.getActiveTrackId()).toBe('cosmic-odyssey');
  });

  it('should load Apple Music and Spotify streaming tracks and update metadata cleanly', async () => {
    const mockTrack = {
      id: 'apple-12345',
      title: 'Midnight Resonance',
      artist: 'Synthesizer Ensemble',
      album: 'Cosmic Harmonics',
      artworkUrl: 'https://example.com/art.jpg',
      durationMs: 180000,
      previewUrl: 'https://audio-ssl.itunes.apple.com/preview.m4a',
      source: 'apple-music' as const,
      hasDirectAudio: true,
    };

    await audioEngine.loadStreamTrack(mockTrack);
    expect(audioEngine.getMode()).toBe('apple-music');
    expect(audioEngine.getActiveStreamingTrack()?.title).toBe('Midnight Resonance');
    expect(audioEngine.getStreamingTrackTitle()).toBe('Midnight Resonance');
    expect(audioEngine.getStreamingTrackArtist()).toBe('Synthesizer Ensemble');
    expect(audioEngine.getStreamingTrackArtwork()).toBe('https://example.com/art.jpg');
    expect(audioEngine.getDuration()).toBe(180);

    // Switching mode to demo-track should clear streaming track
    audioEngine.setMode('demo-track');
    expect(audioEngine.getMode()).toBe('demo-track');
    expect(audioEngine.getActiveStreamingTrack()).toBeNull();
  });

  it('should get, set, and clamp sound playback speed', () => {
    expect(audioEngine.getPlaybackSpeed()).toBe(1.0);

    audioEngine.setPlaybackSpeed(1.5);
    expect(audioEngine.getPlaybackSpeed()).toBe(1.5);
    expect(audioEngine.getAudioElement().playbackRate).toBe(1.5);
    expect(audioEngine.getAudioElement().defaultPlaybackRate).toBe(1.5);

    // Clamping limits
    audioEngine.setPlaybackSpeed(0.02);
    expect(audioEngine.getPlaybackSpeed()).toBe(0.1);

    audioEngine.setPlaybackSpeed(5.0);
    expect(audioEngine.getPlaybackSpeed()).toBe(4.0);
  });

  it('should persist configured sound speed when loading new audio files or streaming tracks', async () => {
    audioEngine.setPlaybackSpeed(1.25);
    expect(audioEngine.getPlaybackSpeed()).toBe(1.25);

    global.URL.createObjectURL = vi.fn().mockReturnValue('blob:http://localhost/speed-test');
    const mockFile = new File(['audio pcm'], 'speed-test.mp3', { type: 'audio/mp3' });
    await audioEngine.loadAudioFile(mockFile);

    expect(audioEngine.getAudioElement().playbackRate).toBe(1.25);
    expect(audioEngine.getAudioElement().defaultPlaybackRate).toBe(1.25);
  });
});
