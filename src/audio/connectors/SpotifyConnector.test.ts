/**
 * SpotifyConnector.test.ts
 * Tests for Spotify Connector, PKCE Authentication & Analysis Synthesizer
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SpotifyConnector, SpotifyAnalysisSynthesizer } from './SpotifyConnector';
import { SpotifyAudioAnalysis } from './types';

describe('SpotifyConnector', () => {
  let connector: SpotifyConnector;

  beforeEach(() => {
    localStorage.clear();
    connector = new SpotifyConnector();
  });

  afterEach(() => {
    connector.dispose();
    vi.restoreAllMocks();
  });

  it('should initialize with serviceName spotify and unauthenticated state', () => {
    expect(connector.serviceName).toBe('spotify');
    expect(connector.isAuthenticated()).toBe(false);
    expect(connector.getSession()).toBeNull();
  });

  it('should generate valid PKCE code verifier and code challenge', async () => {
    const verifier = connector.generateCodeVerifier(64);
    expect(verifier.length).toBe(64);
    expect(/^[A-Za-z0-9\-._~]+$/.test(verifier)).toBe(true);

    const challenge = await connector.generateCodeChallenge(verifier);
    expect(typeof challenge).toBe('string');
    expect(challenge.length).toBeGreaterThan(0);
  });

  it('should construct PKCE authorization URL correctly', async () => {
    const url = await connector.buildAuthorizeUrl('test-client-id', 'http://localhost:3000/callback');
    expect(url).toContain('https://accounts.spotify.com/authorize');
    expect(url).toContain('client_id=test-client-id');
    expect(url).toContain('code_challenge_method=S256');
    expect(url).toContain('response_type=code');
    expect(url).toContain('redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fcallback');
  });

  it('should handle auth callback and store session in localStorage', async () => {
    localStorage.setItem('spotify_pkce_verifier', 'mock-verifier-string');

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          access_token: 'mock-access-token-123',
          refresh_token: 'mock-refresh-token',
          expires_in: 3600,
          token_type: 'Bearer',
          scope: 'streaming user-read-email',
        }),
    } as unknown as Response);

    const session = await connector.handleAuthCallback('mock-code', 'test-client-id', 'http://localhost/callback');
    expect(session.accessToken).toBe('mock-access-token-123');
    expect(connector.isAuthenticated()).toBe(true);
    expect(connector.getSession()?.accessToken).toBe('mock-access-token-123');

    connector.logout();
    expect(connector.isAuthenticated()).toBe(false);
    expect(connector.getSession()).toBeNull();
  });

  it('should return curated tracks when search query is empty or unauthenticated', async () => {
    const categories = connector.getCuratedCategories();
    expect(categories.length).toBeGreaterThan(0);

    const results = await connector.searchTracks('Cyberpunk');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].source).toBe('spotify');
    expect(results[0].title.toLowerCase()).toContain('cyberpunk');
  });
});

describe('SpotifyAnalysisSynthesizer', () => {
  let synthesizer: SpotifyAnalysisSynthesizer;

  const mockAnalysis: SpotifyAudioAnalysis = {
    bars: [{ start: 0, duration: 2.0, confidence: 0.9 }],
    beats: [
      { start: 0.5, duration: 0.5, confidence: 0.8 },
      { start: 1.0, duration: 0.5, confidence: 0.85 },
    ],
    tatums: [{ start: 0.25, duration: 0.25, confidence: 0.7 }],
    sections: [
      {
        start: 0,
        duration: 10,
        loudness: -12,
        tempo: 120,
        key: 0,
        mode: 1,
        time_signature: 4,
      },
    ],
    segments: [
      {
        start: 0,
        duration: 1.0,
        confidence: 0.9,
        loudness_start: -20,
        loudness_max: -8,
        loudness_max_time: 0.2,
        pitches: [1.0, 0.2, 0.8, 0.1, 0.4, 0.1, 0.0, 0.7, 0.2, 0.5, 0.1, 0.9],
        timbre: [35, 12, -4, 8, 2, -1, 4, 3, 0, 1, 2, -2],
      },
    ],
  };

  beforeEach(() => {
    synthesizer = new SpotifyAnalysisSynthesizer();
  });

  it('should return zero bands when no analysis is loaded', () => {
    const result = synthesizer.evaluateBands(0.5);
    expect(result.bands.subBass).toBe(0);
    expect(result.bands.bass).toBe(0);
    expect(result.bands.mid).toBe(0);
    expect(result.bands.rms).toBe(0);
    expect(result.shockwave).toBe(false);
  });

  it('should correctly map chroma and timbre into 6-band AudioBands', () => {
    synthesizer.setAnalysis(mockAnalysis);
    expect(synthesizer.getAnalysis()).toBe(mockAnalysis);

    const result = synthesizer.evaluateBands(0.3);
    expect(result.bands.subBass).toBeGreaterThan(0);
    expect(result.bands.bass).toBeGreaterThan(0);
    expect(result.bands.lowMid).toBeGreaterThan(0);
    expect(result.bands.mid).toBeGreaterThan(0);
    expect(result.bands.highMid).toBeGreaterThan(0);
    expect(result.bands.high).toBeGreaterThan(0);
    expect(result.bands.rms).toBeGreaterThan(0);
  });

  it('should trigger shockwave on beat boundaries with high confidence', () => {
    synthesizer.setAnalysis(mockAnalysis);
    const beatResult = synthesizer.evaluateBands(0.52); // Close to beat at 0.5
    expect(beatResult.shockwave).toBe(true);
  });
});
