/**
 * types.ts
 * SoundForm 3D — Streaming Music Connector Type Definitions
 *
 * Defines unified interfaces for external music streaming providers (Apple Music, Spotify),
 * track metadata, playback states, search results, and audio analysis telemetry.
 */

import { AudioBands } from '../SpectralAnalyzer';

export type StreamingServiceType = 'apple-music' | 'spotify';

export interface StreamingTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  artworkUrl: string;
  durationMs: number;
  previewUrl?: string;
  spotifyUri?: string;
  appleMusicId?: string;
  source: StreamingServiceType;
  genre?: string;
  bpm?: number;
  hasDirectAudio: boolean; // true if playable via Web Audio AnalyserNode
}

export interface StreamingGenreCategory {
  id: string;
  label: string;
  tracks: StreamingTrack[];
}

export interface SpotifyAuthSession {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number; // Epoch timestamp ms
  scope: string;
  tokenType: string;
}

export interface SpotifyAudioSegment {
  start: number;
  duration: number;
  confidence: number;
  loudness_start: number;
  loudness_max: number;
  loudness_max_time: number;
  pitches: number[]; // 12-dimensional chroma vector (0=C, 1=C#, ..., 11=B)
  timbre: number[];  // 12-dimensional timbre vector
}

export interface SpotifyAudioAnalysis {
  bars: Array<{ start: number; duration: number; confidence: number }>;
  beats: Array<{ start: number; duration: number; confidence: number }>;
  tatums: Array<{ start: number; duration: number; confidence: number }>;
  sections: Array<{
    start: number;
    duration: number;
    loudness: number;
    tempo: number;
    key: number;
    mode: number;
    time_signature: number;
  }>;
  segments: SpotifyAudioSegment[];
}

export interface StreamingConnector {
  readonly serviceName: StreamingServiceType;
  searchTracks(query: string, limit?: number): Promise<StreamingTrack[]>;
  getCuratedCategories(): StreamingGenreCategory[];
  playTrack(track: StreamingTrack): Promise<void>;
  pause(): void;
  resume(): void;
  dispose?(): void;
}
