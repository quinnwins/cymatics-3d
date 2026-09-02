/**
 * AppleMusicConnector.test.ts
 * Tests for Apple Music & iTunes Catalog Connector
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AppleMusicConnector } from './AppleMusicConnector';

describe('AppleMusicConnector', () => {
  let connector: AppleMusicConnector;

  beforeEach(() => {
    connector = new AppleMusicConnector();
  });

  afterEach(() => {
    connector.dispose();
    vi.restoreAllMocks();
  });

  it('should initialize with serviceName apple-music', () => {
    expect(connector.serviceName).toBe('apple-music');
  });

  it('should return curated categories and tracks when search query is empty', async () => {
    const categories = connector.getCuratedCategories();
    expect(categories.length).toBeGreaterThan(0);
    expect(categories[0].tracks.length).toBeGreaterThan(0);

    const emptyResults = await connector.searchTracks('');
    expect(emptyResults.length).toBeGreaterThan(0);
    expect(emptyResults[0].source).toBe('apple-music');
    expect(emptyResults[0].artworkUrl).toContain('600x600');
  });

  it('should query Apple Music search API and format track results correctly', async () => {
    const mockApiResponse = {
      resultCount: 2,
      results: [
        {
          trackId: 1440857781,
          trackName: 'Starboy',
          artistName: 'The Weeknd',
          collectionName: 'Starboy',
          artworkUrl100: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/bf/1a/0a/bf1a0a5d/100x100bb.jpg',
          trackTimeMillis: 230453,
          previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/preview.m4a',
          primaryGenreName: 'Pop',
        },
      ],
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockApiResponse),
    } as unknown as Response);

    const results = await connector.searchTracks('Starboy', 10);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('apple-1440857781');
    expect(results[0].title).toBe('Starboy');
    expect(results[0].artist).toBe('The Weeknd');
    expect(results[0].artworkUrl).toContain('600x600bb.jpg');
    expect(results[0].previewUrl).toBe('https://audio-ssl.itunes.apple.com/itunes-assets/preview.m4a');
    expect(results[0].hasDirectAudio).toBe(true);
  });

  it('should gracefully fall back to local curated tracks on network error', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network Offline'));

    const results = await connector.searchTracks('Interstellar');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].title.toLowerCase()).toContain('interstellar');
  });

  it('should manage Apple Developer Token in localStorage safely', () => {
    expect(connector.getStoredDeveloperToken()).toBeNull();
    connector.setStoredDeveloperToken('mock-developer-jwt-token');
    expect(connector.getStoredDeveloperToken()).toBe('mock-developer-jwt-token');
    expect(connector.isAuthorized()).toBe(false);
  });
});
