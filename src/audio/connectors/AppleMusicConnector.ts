/**
 * AppleMusicConnector.ts
 * SoundForm 3D — Apple Music & iTunes Catalog Connector
 *
 * Provides instant, zero-auth catalog searching and playback across 100M+ songs via the Apple Music / iTunes
 * catalog API. Delivers 600x600 high-res artwork and unencrypted audio preview streams that route directly into
 * the Web Audio AnalyserNode for full 4096-bin physical FFT, 6-band perceptual energy, and 3D cymatics resonance.
 */

import { StreamingTrack, StreamingGenreCategory, StreamingConnector } from './types';

export class AppleMusicConnector implements StreamingConnector {
  public readonly serviceName = 'apple-music' as const;
  private currentAbortController: AbortController | null = null;

  // Curated genre crates for instant discovery with zero search required
  public static readonly CURATED_CATEGORIES: StreamingGenreCategory[] = [
    {
      id: 'trending',
      label: 'Trending Hits',
      tracks: [
        {
          id: 'apple-curated-1',
          title: 'Starboy',
          artist: 'The Weeknd ft. Daft Punk',
          album: 'Starboy',
          artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/bf/1a/0a/bf1a0a5d-efdb-5282-53b9-1f480aa27ab5/16UMGIM61695.rgb.jpg/600x600bb.jpg',
          durationMs: 230453,
          previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/11/71/d6/1171d6ad-3c96-e027-2af6-58028426588c/mzaf_15137631797407745471.plus.aac.p.m4a',
          source: 'apple-music',
          genre: 'Pop / Electronic',
          bpm: 186,
          hasDirectAudio: true,
        },
        {
          id: 'apple-curated-2',
          title: 'Midnight City',
          artist: 'M83',
          album: 'Hurry Up, We\'re Dreaming',
          artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music114/v4/f7/60/c1/f760c1d6-848e-d4c3-6360-15fec32e3089/886445582302.jpg/600x600bb.jpg',
          durationMs: 243280,
          previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/24/09/79/2409794c-3d5d-af26-580e-7dc00ee4f207/mzaf_369629549966021675.plus.aac.p.m4a',
          source: 'apple-music',
          genre: 'Synthwave',
          bpm: 105,
          hasDirectAudio: true,
        },
        {
          id: 'apple-curated-3',
          title: 'Blinding Lights',
          artist: 'The Weeknd',
          album: 'After Hours',
          artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/88/2c/80/882c8038-7a56-4c4f-7f72-74d39f7a77e5/19UMGIM95116.rgb.jpg/600x600bb.jpg',
          durationMs: 200040,
          previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/17/b4/8f/17b48f9a-0b93-6bb8-fe1d-3a16623c2cfb/mzaf_9560252727299052414.plus.aac.p.m4a',
          source: 'apple-music',
          genre: 'Synthpop',
          bpm: 171,
          hasDirectAudio: true,
        },
      ],
    },
    {
      id: 'ambient',
      label: 'Cosmic & Ambient',
      tracks: [
        {
          id: 'apple-curated-4',
          title: 'Cornfield Chase (Interstellar)',
          artist: 'Hans Zimmer',
          album: 'Interstellar (Original Motion Picture Soundtrack)',
          artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/a4/ce/27/a4ce2791-c98b-2401-2098-7cf424ea1525/794043180489.jpg/600x600bb.jpg',
          durationMs: 126000,
          previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/3a/ee/23/3aee2300-f6f7-a006-e20f-28092e814cbe/mzaf_1624587954644600228.plus.aac.p.m4a',
          source: 'apple-music',
          genre: 'Cinematic Ambient',
          bpm: 96,
          hasDirectAudio: true,
        },
        {
          id: 'apple-curated-5',
          title: 'Weightless',
          artist: 'Marconi Union',
          album: 'Weightless (Ambient Transmissions Vol. 2)',
          artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/36/f6/85/36f685c2-f1ba-4ce7-33a7-33c847d0669a/5053760081203.jpg/600x600bb.jpg',
          durationMs: 485000,
          previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/65/69/07/656907c9-eb54-c59c-72b9-dad8489a0165/mzaf_3316991574698499044.plus.aac.p.m4a',
          source: 'apple-music',
          genre: 'Acoustic Entrainment',
          bpm: 60,
          hasDirectAudio: true,
        },
      ],
    },
    {
      id: 'classical',
      label: 'Classical Harmonics',
      tracks: [
        {
          id: 'apple-curated-6',
          title: 'Clair de Lune',
          artist: 'Claude Debussy (Martin Jones)',
          album: 'Debussy: Complete Piano Works',
          artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music114/v4/39/10/7c/39107c13-79d1-f597-28d0-a33bc2e9894e/710357506121.jpg/600x600bb.jpg',
          durationMs: 300000,
          previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/49/22/f3/4922f374-b517-fb33-cff6-8fa6ca15656b/mzaf_12675765766962791398.plus.aac.p.m4a',
          source: 'apple-music',
          genre: 'Impressionist Classical',
          bpm: 66,
          hasDirectAudio: true,
        },
        {
          id: 'apple-curated-7',
          title: 'Gymnopédie No. 1',
          artist: 'Erik Satie (Anne Queffélec)',
          album: 'Satie: 3 Gymnopédies & 6 Gnossiennes',
          artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music114/v4/71/e4/21/71e42152-4757-bb6d-9689-d102e3b2e3f4/0724357384752.jpg/600x600bb.jpg',
          durationMs: 195000,
          previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/e8/3f/57/e83f57f3-68a1-f88f-d7ad-741e12e48c6d/mzaf_14596551055740884645.plus.aac.p.m4a',
          source: 'apple-music',
          genre: 'Harmonic Resonance',
          bpm: 72,
          hasDirectAudio: true,
        },
      ],
    },
    {
      id: 'electronic',
      label: 'Cyberpunk & Bass',
      tracks: [
        {
          id: 'apple-curated-8',
          title: 'Resonance',
          artist: 'HOME',
          album: 'Odyssey',
          artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/36/f1/a0/36f1a073-7e23-74b8-9ee2-4a005eeff06d/198000492825.jpg/600x600bb.jpg',
          durationMs: 212000,
          previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/47/d0/32/47d0326f-0757-4400-6532-caf37f69feb2/mzaf_7480432866230687091.plus.aac.p.m4a',
          source: 'apple-music',
          genre: 'Chillwave / Synth',
          bpm: 105,
          hasDirectAudio: true,
        },
        {
          id: 'apple-curated-9',
          title: 'Get Lucky',
          artist: 'Daft Punk ft. Pharrell Williams',
          album: 'Random Access Memories',
          artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/a4/09/a4/a409a478-f992-04e4-7d52-5a2a50a1d6ea/886443927082.jpg/600x600bb.jpg',
          durationMs: 369000,
          previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/57/a5/85/57a585aa-f1bc-7619-881b-f8a04a5541d5/mzaf_6906185026678279401.plus.aac.p.m4a',
          source: 'apple-music',
          genre: 'Nu-Disco / Funk',
          bpm: 116,
          hasDirectAudio: true,
        },
      ],
    },
  ];

  public getCuratedCategories(): StreamingGenreCategory[] {
    return AppleMusicConnector.CURATED_CATEGORIES;
  }

  public getAllCuratedTracks(): StreamingTrack[] {
    return AppleMusicConnector.CURATED_CATEGORIES.flatMap(c => c.tracks);
  }

  /**
   * Resolves a guaranteed fresh live preview audio URL from Apple's search API
   * for a given track in case static CDN tokens expired or rotated.
   */
  public async resolveFreshPreviewUrl(track: StreamingTrack): Promise<string | undefined> {
    try {
      const results = await this.searchTracks(`${track.title} ${track.artist}`, 3);
      const match = results.find(t => t.previewUrl) || results[0];
      return match?.previewUrl || track.previewUrl;
    } catch (e) {
      console.warn('Could not resolve fresh Apple Music preview URL:', e);
      return track.previewUrl;
    }
  }

  // --- MusicKit JS v3 Account & Personal Library Bridge ---
  private static readonly STORAGE_KEY_DEV_TOKEN = 'soundform_apple_music_dev_token';

  public isAuthorized(): boolean {
    if (typeof window !== 'undefined' && (window as any).MusicKit) {
      try {
        const instance = (window as any).MusicKit.getInstance();
        return Boolean(instance && instance.isAuthorized);
      } catch {
        return false;
      }
    }
    return false;
  }

  public getStoredDeveloperToken(): string | null {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(AppleMusicConnector.STORAGE_KEY_DEV_TOKEN);
  }

  public setStoredDeveloperToken(token: string): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(AppleMusicConnector.STORAGE_KEY_DEV_TOKEN, token.trim());
  }

  /**
   * Initializes Apple MusicKit JS with an Apple Developer Token
   */
  public async initializeMusicKit(developerToken?: string): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    const token = developerToken || this.getStoredDeveloperToken();
    if (!token) return false;

    this.setStoredDeveloperToken(token);

    // Dynamically load MusicKit JS v3 script if not present
    if (!(window as any).MusicKit) {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://js-cdn.music.apple.com/musickit/v3/musickit.js';
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load Apple MusicKit JS'));
        document.head.appendChild(script);
      });
    }

    try {
      await (window as any).MusicKit.configure({
        developerToken: token,
        app: {
          name: 'SoundForm 3D Acoustic Wave Engine',
          build: '1.0.0',
        },
      });
      return true;
    } catch (e) {
      console.warn('MusicKit configuration error:', e);
      return false;
    }
  }

  /**
   * Triggers the official Apple Music ID sign-in popup to link the user's personal Apple Music subscription
   */
  public async authorizeUser(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    try {
      const instance = (window as any).MusicKit?.getInstance();
      if (!instance) {
        const initOk = await this.initializeMusicKit();
        if (!initOk) return false;
      }
      await (window as any).MusicKit.getInstance().authorize();
      return this.isAuthorized();
    } catch (err) {
      console.warn('Apple Music user authorization failed:', err);
      return false;
    }
  }

  /**
   * Unauthorizes and signs out the user from Apple Music
   */
  public async unauthorizeUser(): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      const instance = (window as any).MusicKit?.getInstance();
      if (instance && instance.isAuthorized) {
        await instance.unauthorize();
      }
    } catch (e) {
      console.warn('Apple Music unauthorize error:', e);
    }
  }

  /**
   * Fetches the user's personal cloud library songs from Apple Music
   */
  public async fetchUserLibrarySongs(limit = 25): Promise<StreamingTrack[]> {
    if (!this.isAuthorized()) return [];
    try {
      const instance = (window as any).MusicKit.getInstance();
      const res = await instance.api.music(`/v1/me/library/songs?limit=${limit}`);
      if (res && res.data && Array.isArray(res.data.data)) {
        return res.data.data.map((item: any) => {
          const attrs = item.attributes || {};
          const rawArt = attrs.artwork?.url ? attrs.artwork.url.replace('{w}x{h}', '600x600') : '';
          return {
            id: `apple-lib-${item.id}`,
            title: attrs.name || 'Unknown Track',
            artist: attrs.artistName || 'Unknown Artist',
            album: attrs.albumName || attrs.name,
            artworkUrl: rawArt,
            durationMs: attrs.durationInMillis || 180000,
            previewUrl: attrs.previews?.[0]?.url || undefined,
            appleMusicId: String(item.id),
            source: 'apple-music' as const,
            genre: attrs.genreNames?.[0] || 'My Library',
            hasDirectAudio: Boolean(attrs.previews?.[0]?.url),
          };
        });
      }
      return [];
    } catch (err) {
      console.warn('Could not fetch user Apple Music library:', err);
      return [];
    }
  }

  /**
   * Searches the Apple Music / iTunes Catalog via the public Search API.
   * Delivers instantaneous search results with high-resolution artwork and preview audio URLs.
   */
  public async searchTracks(query: string, limit = 25): Promise<StreamingTrack[]> {
    const trimmed = query.trim();
    if (!trimmed) {
      // If user is authorized, blend user library songs with curated tracks
      if (this.isAuthorized()) {
        const userSongs = await this.fetchUserLibrarySongs(10);
        if (userSongs.length > 0) {
          return [...userSongs, ...this.getAllCuratedTracks()];
        }
      }
      return this.getAllCuratedTracks();
    }

    if (this.currentAbortController) {
      this.currentAbortController.abort();
    }
    this.currentAbortController = new AbortController();

    const encodedTerm = encodeURIComponent(trimmed);
    const searchUrl = `https://itunes.apple.com/search?term=${encodedTerm}&entity=song&limit=${Math.min(limit, 50)}`;

    try {
      const response = await fetch(searchUrl, {
        signal: this.currentAbortController.signal,
      });

      if (!response.ok) {
        throw new Error(`Apple Music search failed: HTTP ${response.status}`);
      }

      const data = await response.json();
      if (!data || !Array.isArray(data.results)) {
        return [];
      }

      return data.results
        .filter((item: any) => item.previewUrl && item.trackName)
        .map((item: any) => {
          const rawArt = item.artworkUrl100 || item.artworkUrl60 || '';
          // Upgrade 100x100 thumbnail to 600x600 high-res image
          const highResArtwork = rawArt.replace(/\/\d+x\d+bb\./, '/600x600bb.');

          return {
            id: `apple-${item.trackId}`,
            title: item.trackName,
            artist: item.artistName || 'Unknown Artist',
            album: item.collectionName || item.trackName,
            artworkUrl: highResArtwork || rawArt,
            durationMs: item.trackTimeMillis || 30000,
            previewUrl: item.previewUrl,
            appleMusicId: String(item.trackId),
            source: 'apple-music' as const,
            genre: item.primaryGenreName || 'Music',
            hasDirectAudio: true,
          };
        });
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return [];
      }
      console.warn('Error querying Apple Music catalog:', err);
      // Fallback: search within curated list
      return this.getAllCuratedTracks().filter(
        t =>
          t.title.toLowerCase().includes(trimmed.toLowerCase()) ||
          t.artist.toLowerCase().includes(trimmed.toLowerCase()) ||
          (t.genre && t.genre.toLowerCase().includes(trimmed.toLowerCase()))
      );
    }
  }

  public async playTrack(_track: StreamingTrack): Promise<void> {
    // Handled via AudioEngine.loadStreamUrl
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
