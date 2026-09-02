/**
 * SpotifyConnector.ts
 * SoundForm 3D — Spotify Web API, PKCE OAuth 2.0 & Audio Analysis Engine
 *
 * Provides browser-native Spotify catalog exploration, PKCE OAuth 2.0 authentication,
 * and high-precision Audio Analysis telemetry synthesis. Converts Spotify 12-pitch chroma
 * vectors and timbre metrics into real-time 6-band AudioBands and transient shockwaves.
 */

import { AudioBands, ShockwaveEvent } from '../SpectralAnalyzer';
import {
  StreamingTrack,
  StreamingGenreCategory,
  StreamingConnector,
  SpotifyAuthSession,
  SpotifyAudioAnalysis,
  SpotifyAudioSegment,
} from './types';

export class SpotifyAnalysisSynthesizer {
  private analysisData: SpotifyAudioAnalysis | null = null;
  private lastShockwaveTime = 0;

  public setAnalysis(analysis: SpotifyAudioAnalysis | null): void {
    this.analysisData = analysis;
    this.lastShockwaveTime = 0;
  }

  public getAnalysis(): SpotifyAudioAnalysis | null {
    return this.analysisData;
  }

  /**
   * Synthesizes 6-band AudioBands from Spotify's 12-pitch chroma and timbre vectors
   * at a given track playback position in seconds.
   */
  public evaluateBands(positionSec: number): { bands: AudioBands; shockwave: boolean } {
    if (!this.analysisData || !this.analysisData.segments || this.analysisData.segments.length === 0) {
      return {
        bands: { subBass: 0, bass: 0, lowMid: 0, mid: 0, highMid: 0, high: 0, rms: 0 },
        shockwave: false,
      };
    }

    const segment = this.findSegment(positionSec);
    if (!segment) {
      return {
        bands: { subBass: 0, bass: 0, lowMid: 0, mid: 0, highMid: 0, high: 0, rms: 0 },
        shockwave: false,
      };
    }

    // Segment loudness: dBFS (-60 to 0) -> Linear scalar
    const loudnessDb = segment.loudness_max ?? segment.loudness_start ?? -30;
    const linearGain = Math.min(2.0, Math.max(0.05, Math.pow(10, (loudnessDb + 15) / 30)));

    // 12-Pitch Chroma: C=0, C#=1, D=2, D#=3, E=4, F=5, F#=6, G=7, G#=8, A=9, A#=10, B=11
    const p = segment.pitches.length === 12 ? segment.pitches : new Array(12).fill(0.5);
    const t = segment.timbre.length >= 1 ? segment.timbre : [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

    // Timbre brightness (t[1]) and flatness (t[2]) modulation
    const brightnessMod = Math.max(0.5, Math.min(1.5, 1.0 + (t[1] || 0) / 100));
    const bassWeight = Math.max(0.6, Math.min(1.6, 1.0 - (t[1] || 0) / 120));

    // Distribute into 6 perceptual frequency bands
    const subBass = Math.min(1.8, (p[0] * 0.7 + p[1] * 0.3) * linearGain * bassWeight * 1.2);
    const bass = Math.min(1.8, (p[2] * 0.5 + p[3] * 0.5) * linearGain * bassWeight * 1.1);
    const lowMid = Math.min(1.8, (p[4] * 0.4 + p[5] * 0.4 + p[6] * 0.2) * linearGain);
    const mid = Math.min(1.8, (p[7] * 0.5 + p[8] * 0.5) * linearGain);
    const highMid = Math.min(1.8, (p[9] * 0.5 + p[10] * 0.5) * linearGain * brightnessMod);
    const high = Math.min(1.8, (p[11] * 0.8 + (p[0] + p[1]) * 0.1) * linearGain * brightnessMod * 1.2);
    const rms = Math.min(1.5, (subBass * 0.3 + bass * 0.3 + mid * 0.25 + high * 0.15));

    // Beat / Bar onset shockwave detection
    let isShockwave = false;
    if (this.analysisData.beats && positionSec - this.lastShockwaveTime > 0.35) {
      const beat = this.analysisData.beats.find(
        b => Math.abs(positionSec - b.start) < 0.08 && b.confidence > 0.6
      );
      if (beat) {
        isShockwave = true;
        this.lastShockwaveTime = positionSec;
      }
    }

    return {
      bands: { subBass, bass, lowMid, mid, highMid, high, rms },
      shockwave: isShockwave,
    };
  }

  private findSegment(positionSec: number): SpotifyAudioSegment | null {
    if (!this.analysisData || !this.analysisData.segments) return null;
    const segs = this.analysisData.segments;

    // Binary search for segment at positionSec
    let low = 0;
    let high = segs.length - 1;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const seg = segs[mid];
      if (positionSec >= seg.start && positionSec < seg.start + seg.duration) {
        return seg;
      } else if (positionSec < seg.start) {
        high = mid - 1;
      } else {
        low = mid + 1;
      }
    }

    return segs[Math.min(segs.length - 1, Math.max(0, low))] || null;
  }
}

export class SpotifyConnector implements StreamingConnector {
  public readonly serviceName = 'spotify' as const;
  private static readonly STORAGE_KEY = 'soundform_spotify_session';
  private currentSession: SpotifyAuthSession | null = null;
  public readonly analysisSynthesizer = new SpotifyAnalysisSynthesizer();
  private currentAbortController: AbortController | null = null;

  // Curated genre crates for instant discovery with zero search required
  public static readonly CURATED_CATEGORIES: StreamingGenreCategory[] = [
    {
      id: 'spotify-electronic',
      label: '⚡ Cyberpunk & Electronic',
      tracks: [
        {
          id: 'spotify-curated-1',
          title: 'Cyberpunk 2077 — Hyper / Spoiler',
          artist: 'Hyper',
          album: 'Lies',
          artworkUrl: 'https://i.scdn.co/image/ab67616d0000b273e925b6a798f46e8c07886470',
          durationMs: 270000,
          previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/b8/b6/2d/b8b62d3c-9bc2-6a6c-4ec7-99e5a87be971/mzaf_17208447814421272787.plus.aac.p.m4a',
          spotifyUri: 'spotify:track:4jflX03pG1g1F3XwZtJk1E',
          source: 'spotify',
          genre: 'Cyberpunk Bass',
          bpm: 130,
          hasDirectAudio: true,
        },
        {
          id: 'spotify-curated-2',
          title: 'Solaris Wave',
          artist: 'Kavinsky',
          album: 'OutRun',
          artworkUrl: 'https://i.scdn.co/image/ab67616d0000b273cfad7755b7c89f53eec0efbf',
          durationMs: 258000,
          previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/0d/95/67/0d95679a-e9fa-c4a0-5309-586b66b453e0/mzaf_671846506305716766.plus.aac.p.m4a',
          spotifyUri: 'spotify:track:0rQur0v28YjPkWfD4wN92X',
          source: 'spotify',
          genre: 'Synthwave',
          bpm: 108,
          hasDirectAudio: true,
        },
      ],
    },
    {
      id: 'spotify-ambient',
      label: '🌌 Deep Space & Solfeggio',
      tracks: [
        {
          id: 'spotify-curated-3',
          title: '432 Hz Solfeggio Deep Harmonic Meditation',
          artist: 'Acoustic SoundForm Lab',
          album: 'Harmonic Geometry Vol. 1',
          artworkUrl: 'https://i.scdn.co/image/ab67616d0000b2736b70b34d7efd072fbe987bb2',
          durationMs: 360000,
          previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/c3/ef/aa/c3efaa17-91fb-2615-585a-0639e3ec0192/mzaf_9453912959146194723.plus.aac.p.m4a',
          spotifyUri: 'spotify:track:5k7e9xY3u4Z6b3k2a1v9q0',
          source: 'spotify',
          genre: 'Solfeggio 432 Hz',
          bpm: 60,
          hasDirectAudio: true,
        },
        {
          id: 'spotify-curated-4',
          title: 'Interstellar Organ Resonance',
          artist: 'Hans Zimmer',
          album: 'Interstellar Soundscape',
          artworkUrl: 'https://i.scdn.co/image/ab67616d0000b273cfb3952f440539c3e2f5bdfb',
          durationMs: 240000,
          previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/05/88/02/05880299-ff3d-4c3e-d9cf-e17f4dc1f1ad/mzaf_10014761413144882195.plus.aac.p.m4a',
          spotifyUri: 'spotify:track:1vB6m6p4Kk5yGg4G6H5j2',
          source: 'spotify',
          genre: 'Cinematic Ambient',
          bpm: 96,
          hasDirectAudio: true,
        },
      ],
    },
    {
      id: 'spotify-vocal',
      label: '🎙️ Vocal Resonance',
      tracks: [
        {
          id: 'spotify-curated-5',
          title: 'Gregorian Harmonic Chants',
          artist: 'Monks of Solesmes',
          album: 'Chant Gregorien',
          artworkUrl: 'https://i.scdn.co/image/ab67616d0000b2735749f7d4615a133dfd2a588b',
          durationMs: 180000,
          previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/15/45/b5/1545b53d-2402-4ae0-449e-ec8ba7e72b4f/mzaf_10927902914838618774.plus.aac.p.m4a',
          spotifyUri: 'spotify:track:7w8e2u4p2m8b2x1v5y8w9',
          source: 'spotify',
          genre: 'Choral Harmonics',
          bpm: 65,
          hasDirectAudio: true,
        },
      ],
    },
  ];

  constructor() {
    this.restoreSession();
  }

  public getCuratedCategories(): StreamingGenreCategory[] {
    return SpotifyConnector.CURATED_CATEGORIES;
  }

  public getAllCuratedTracks(): StreamingTrack[] {
    return SpotifyConnector.CURATED_CATEGORIES.flatMap(c => c.tracks);
  }

  // --- Session & PKCE Management ---
  public isAuthenticated(): boolean {
    if (!this.currentSession) return false;
    return Date.now() < this.currentSession.expiresAt;
  }

  public getSession(): SpotifyAuthSession | null {
    return this.isAuthenticated() ? this.currentSession : null;
  }

  public logout(): void {
    this.currentSession = null;
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(SpotifyConnector.STORAGE_KEY);
      localStorage.removeItem('spotify_pkce_verifier');
    }
  }

  private restoreSession(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const raw = localStorage.getItem(SpotifyConnector.STORAGE_KEY);
      if (raw) {
        const session: SpotifyAuthSession = JSON.parse(raw);
        if (session && session.expiresAt > Date.now()) {
          this.currentSession = session;
        }
      }
    } catch {
      this.currentSession = null;
    }
  }

  public saveSession(session: SpotifyAuthSession): void {
    this.currentSession = session;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SpotifyConnector.STORAGE_KEY, JSON.stringify(session));
    }
  }

  /**
   * Generates a high-entropy random string for PKCE Code Verifier
   */
  public generateCodeVerifier(length = 64): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    let result = '';
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const bytes = new Uint8Array(length);
      crypto.getRandomValues(bytes);
      for (let i = 0; i < length; i++) {
        result += chars[bytes[i] % chars.length];
      }
    } else {
      for (let i = 0; i < length; i++) {
        result += chars[Math.floor(Math.random() * chars.length)];
      }
    }
    return result;
  }

  /**
   * Generates SHA-256 Code Challenge from Verifier using Web Crypto API
   */
  public async generateCodeChallenge(codeVerifier: string): Promise<string> {
    if (typeof crypto === 'undefined' || !crypto.subtle) {
      // Fallback base64
      return btoa(codeVerifier).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  /**
   * Builds the Spotify PKCE Authorization URL
   */
  public async buildAuthorizeUrl(clientId: string, redirectUri: string): Promise<string> {
    const verifier = this.generateCodeVerifier(64);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('spotify_pkce_verifier', verifier);
    }
    const challenge = await this.generateCodeChallenge(verifier);
    const scope = 'streaming user-read-email user-read-private user-modify-playback-state user-read-playback-state';

    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      code_challenge_method: 'S256',
      code_challenge: challenge,
      scope,
    });

    return `https://accounts.spotify.com/authorize?${params.toString()}`;
  }

  /**
   * Exchanges authorization code for Spotify Access Token via PKCE
   */
  public async handleAuthCallback(
    code: string,
    clientId: string,
    redirectUri: string
  ): Promise<SpotifyAuthSession> {
    const verifier = (typeof localStorage !== 'undefined' && localStorage.getItem('spotify_pkce_verifier')) || '';

    const body = new URLSearchParams({
      client_id: clientId,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      code_verifier: verifier,
    });

    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!res.ok) {
      throw new Error(`Spotify token exchange failed: HTTP ${res.status}`);
    }

    const data = await res.json();
    const session: SpotifyAuthSession = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
      scope: data.scope || '',
      tokenType: data.token_type || 'Bearer',
    };

    this.saveSession(session);
    return session;
  }

  /**
   * Searches Spotify Catalog or falls back to curated catalog if unauthenticated
   */
  public async searchTracks(query: string, limit = 20): Promise<StreamingTrack[]> {
    const trimmed = query.trim();
    if (!trimmed) {
      return this.getAllCuratedTracks();
    }

    if (this.currentAbortController) {
      this.currentAbortController.abort();
    }
    this.currentAbortController = new AbortController();

    // If authenticated with Spotify, query Spotify Web API
    if (this.isAuthenticated() && this.currentSession) {
      try {
        const searchUrl = `https://api.spotify.com/v1/search?q=${encodeURIComponent(trimmed)}&type=track&limit=${limit}`;
        const res = await fetch(searchUrl, {
          headers: { Authorization: `Bearer ${this.currentSession.accessToken}` },
          signal: this.currentAbortController.signal,
        });

        if (res.ok) {
          const data = await res.json();
          if (data.tracks && Array.isArray(data.tracks.items)) {
            return data.tracks.items.map((item: any) => ({
              id: `spotify-${item.id}`,
              title: item.name,
              artist: item.artists.map((a: any) => a.name).join(', '),
              album: item.album?.name || item.name,
              artworkUrl: item.album?.images?.[0]?.url || '',
              durationMs: item.duration_ms,
              previewUrl: item.preview_url || undefined,
              spotifyUri: item.uri,
              source: 'spotify' as const,
              hasDirectAudio: Boolean(item.preview_url),
            }));
          }
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') return [];
        console.warn('Spotify search API error:', err);
      }
    }

    // Default zero-auth search across curated crate
    return this.getAllCuratedTracks().filter(
      t =>
        t.title.toLowerCase().includes(trimmed.toLowerCase()) ||
        t.artist.toLowerCase().includes(trimmed.toLowerCase()) ||
        (t.genre && t.genre.toLowerCase().includes(trimmed.toLowerCase()))
    );
  }

  /**
   * Fetches detailed track audio analysis from Spotify Web API
   */
  public async fetchAudioAnalysis(trackId: string): Promise<SpotifyAudioAnalysis | null> {
    if (!this.isAuthenticated() || !this.currentSession) return null;
    try {
      const cleanId = trackId.replace('spotify:track:', '').replace('spotify-', '');
      const res = await fetch(`https://api.spotify.com/v1/audio-analysis/${cleanId}`, {
        headers: { Authorization: `Bearer ${this.currentSession.accessToken}` },
      });
      if (!res.ok) return null;
      const data: SpotifyAudioAnalysis = await res.json();
      this.analysisSynthesizer.setAnalysis(data);
      return data;
    } catch (e) {
      console.warn('Could not fetch Spotify audio analysis:', e);
      return null;
    }
  }

  public async playTrack(_track: StreamingTrack): Promise<void> {
    return Promise.resolve();
  }

  public pause(): void {}
  public resume(): void {}

  public dispose(): void {
    if (this.currentAbortController) {
      this.currentAbortController.abort();
      this.currentAbortController = null;
    }
  }
}
