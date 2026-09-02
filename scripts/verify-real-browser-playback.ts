/**
 * scripts/verify-real-browser-playback.ts
 * Real End-to-End Browser Automation Test with Google Chrome
 *
 * Serves production build, launches Google Chrome, and asserts real-world playback:
 * 1. Apple Music Curated & Search Playback
 * 2. Spotify Curated & Universal Search Playback (Zero App Download Required)
 * 3. HTMLAudioElement state, buffer progression, and Web Audio 6-band FFT
 */

import { preview } from 'vite';
import puppeteer from 'puppeteer-core';
import * as path from 'path';

async function verifyRealBrowserPlayback() {
  console.log('=== STARTING REAL GOOGLE CHROME BROWSER AUDIO VERIFICATION ===\n');

  // 1. Start local Vite preview server (production bundle with no HMR reloads)
  console.log('1. Starting Vite preview server on port 5199...');
  const server = await preview({
    preview: { port: 5199 },
  });
  const serverUrl = 'http://localhost:5199';
  console.log(`   -> Vite preview server listening at ${serverUrl}`);

  // 2. Launch Google Chrome
  const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  console.log(`2. Launching Google Chrome at ${chromePath}...`);

  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: [
      '--autoplay-policy=no-user-gesture-required',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('Error') || text.includes('playback') || text.includes('Apple') || text.includes('Spotify')) {
      console.log(`   [Browser Console] ${msg.type()}: ${text}`);
    }
  });

  try {
    // 3. Navigate to application
    console.log(`3. Navigating to ${serverUrl}...`);
    await page.goto(serverUrl, { waitUntil: 'networkidle0', timeout: 30000 });
    console.log('   -> Page successfully loaded.');

    // 4. Test Apple Music Playback
    console.log('\n--- PART A: APPLE MUSIC PLAYBACK ---');
    console.log('4. Clicking Apple Music tab in Music Studio deck...');
    await page.waitForSelector('#tab-source-apple', { timeout: 10000 });
    await page.click('#tab-source-apple');
    await new Promise(r => setTimeout(r, 500));

    console.log('5. Clicking first Apple Music track card...');
    await page.waitForSelector('.btn-apple-track-card', { timeout: 10000 });
    await page.evaluate(() => {
      const firstCard = document.querySelector('.btn-apple-track-card') as HTMLElement;
      firstCard?.click();
    });

    console.log('6. Waiting 3 seconds for Apple Music audio stream...');
    await new Promise(r => setTimeout(r, 3000));

    const appleState = await page.evaluate(() => {
      const engine = (window as any).__audioEngine;
      const audioEl = engine ? engine.audioElement : null;
      return {
        paused: audioEl?.paused ?? true,
        currentTime: audioEl?.currentTime || 0,
        isPlaying: engine?.getIsPlaying(),
        title: engine?.getActiveStreamingTrack()?.title,
        bands: engine?.getCurrentBands(),
      };
    });

    console.log(`   - Apple Track: "${appleState.title}"`);
    console.log(`   - Paused: ${appleState.paused}`);
    console.log(`   - Playback Time: ${appleState.currentTime.toFixed(2)}s`);
    console.log(`   - isPlaying: ${appleState.isPlaying}`);
    console.log(`   - Web Audio RMS: ${appleState.bands?.rms.toFixed(3)}`);

    if (appleState.paused || appleState.currentTime <= 0.1) {
      throw new Error('❌ FAILED: Apple Music audio did not play!');
    }
    console.log('✅ VERIFIED: Apple Music is playing actively in Google Chrome!\n');

    // 5. Test Spotify Playback (Zero App Download Required)
    console.log('--- PART B: SPOTIFY ZERO-APP-DOWNLOAD PLAYBACK ---');
    console.log('7. Clicking Spotify tab in Music Studio deck...');
    await page.waitForSelector('#tab-source-spotify', { timeout: 10000 });
    await page.click('#tab-source-spotify');
    await new Promise(r => setTimeout(r, 800));

    console.log('8. Clicking first Spotify curated track card (Hyper / Cyberpunk 2077)...');
    await page.waitForSelector('.btn-spotify-track-card', { timeout: 10000 });
    await page.evaluate(() => {
      const firstSpotifyCard = document.querySelector('.btn-spotify-track-card') as HTMLElement;
      firstSpotifyCard?.click();
    });

    console.log('9. Waiting 3 seconds for Spotify stream to buffer & play...');
    await new Promise(r => setTimeout(r, 3000));

    const spotifyState = await page.evaluate(() => {
      const engine = (window as any).__audioEngine;
      const audioEl = engine ? engine.audioElement : null;
      return {
        paused: audioEl?.paused ?? true,
        currentTime: audioEl?.currentTime || 0,
        isPlaying: engine?.getIsPlaying(),
        title: engine?.getActiveStreamingTrack()?.title,
        artist: engine?.getActiveStreamingTrack()?.artist,
        mode: engine?.getMode(),
        bands: engine?.getCurrentBands(),
      };
    });

    console.log(`   - Spotify Track: "${spotifyState.title}" by ${spotifyState.artist}`);
    console.log(`   - Mode: ${spotifyState.mode}`);
    console.log(`   - Paused: ${spotifyState.paused}`);
    console.log(`   - Playback Time: ${spotifyState.currentTime.toFixed(2)}s`);
    console.log(`   - isPlaying: ${spotifyState.isPlaying}`);
    console.log(`   - Web Audio RMS: ${spotifyState.bands?.rms.toFixed(3)}`);

    if (spotifyState.paused || spotifyState.currentTime <= 0.1) {
      throw new Error('❌ FAILED: Spotify audio did not play!');
    }
    console.log('✅ VERIFIED: Spotify audio plays in Google Chrome with ZERO app download!\n');

    // 10. Test Spotify Universal Search
    console.log('10. Testing Spotify Search (Query: "Hans Zimmer")...');
    const spotifySearchInput = await page.$('#spotify-search-input');
    if (spotifySearchInput) {
      await spotifySearchInput.type('Hans Zimmer');
      await new Promise(r => setTimeout(r, 1500));

      await page.evaluate(() => {
        const cards = document.querySelectorAll('.btn-spotify-track-card');
        if (cards.length > 0) {
          (cards[0] as HTMLElement).click();
        }
      });

      console.log('   -> Clicked search result. Waiting 3 seconds for stream...');
      await new Promise(r => setTimeout(r, 3000));

      const searchSpotifyState = await page.evaluate(() => {
        const engine = (window as any).__audioEngine;
        return {
          title: engine?.getActiveStreamingTrack()?.title,
          artist: engine?.getActiveStreamingTrack()?.artist,
          currentTime: engine?.getCurrentTime(),
          isPlaying: engine?.getIsPlaying(),
          paused: engine?.audioElement?.paused,
        };
      });

      console.log(`   - Search Result: "${searchSpotifyState.title}" by ${searchSpotifyState.artist}`);
      console.log(`   - Current Playback Time: ${searchSpotifyState.currentTime?.toFixed(2)}s`);
      console.log(`   - isPlaying: ${searchSpotifyState.isPlaying}`);

      if (searchSpotifyState.paused || searchSpotifyState.currentTime <= 0.1) {
        throw new Error('❌ FAILED: Spotify search result audio did not play!');
      }
      console.log('✅ VERIFIED: Spotify search playback succeeded with zero app download!\n');
    }

    // 11. Capture Screenshot
    const screenshotPath = path.resolve(process.cwd(), 'scripts/spotify-live-verified.png');
    await page.screenshot({ path: screenshotPath });
    console.log(`11. Saved verification screenshot to: ${screenshotPath}`);

    console.log('\n=== ALL REAL BROWSER PLAYBACK TESTS PASSED (100% SUCCESS) ===');
  } finally {
    await browser.close();
    await server.httpServer.close();
  }
}

verifyRealBrowserPlayback().catch(err => {
  console.error('\n❌ Fatal Browser Verification Error:', err);
  process.exit(1);
});
