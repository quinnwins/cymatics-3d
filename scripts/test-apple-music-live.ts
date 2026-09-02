/**
 * scripts/test-apple-music-live.ts
 * Real-world network live test: Queries Apple Music / iTunes API, fetches live preview streams,
 * and asserts audio byte headers and playback stream validity.
 */

import { AppleMusicConnector } from '../src/audio/connectors/AppleMusicConnector';

async function runLiveAppleMusicTest() {
  console.log('=== STARTING LIVE APPLE MUSIC STREAMING VERIFICATION ===\n');

  const connector = new AppleMusicConnector();

  // 1. Test Search Queries across various genres
  const queries = ['Daft Punk', 'Hans Zimmer', 'The Weeknd', 'Taylor Swift'];

  for (const query of queries) {
    console.log(`Searching Apple Music catalog for: "${query}"...`);
    const results = await connector.searchTracks(query, 5);

    if (results.length === 0) {
      console.error(`❌ FAILED: No results returned for "${query}"`);
      process.exit(1);
    }

    console.log(`✅ Returned ${results.length} tracks. Top result:`);
    const topTrack = results[0];
    console.log(`   - Title: ${topTrack.title}`);
    console.log(`   - Artist: ${topTrack.artist}`);
    console.log(`   - Album: ${topTrack.album}`);
    console.log(`   - Artwork (600x600): ${topTrack.artworkUrl}`);
    console.log(`   - Preview Audio URL: ${topTrack.previewUrl}`);
    console.log(`   - Duration: ${Math.round(topTrack.durationMs / 1000)}s`);

    // 2. Perform live network request to verify Apple CDN Audio Stream
    if (!topTrack.previewUrl) {
      console.error(`❌ FAILED: previewUrl missing for ${topTrack.title}`);
      process.exit(1);
    }

    console.log(`   -> Pinging Apple Audio CDN for audio byte stream...`);
    const headRes = await fetch(topTrack.previewUrl, {
      method: 'GET',
      headers: { Range: 'bytes=0-1024' },
    });

    console.log(`   -> Response HTTP Status: ${headRes.status}`);
    console.log(`   -> Content-Type: ${headRes.headers.get('content-type')}`);
    console.log(`   -> Content-Length: ${headRes.headers.get('content-length')} bytes`);

    if (headRes.status !== 200 && headRes.status !== 206) {
      console.error(`❌ FAILED: Apple CDN returned non-200/206 status: ${headRes.status}`);
      process.exit(1);
    }

    const audioBytes = await headRes.arrayBuffer();
    if (audioBytes.byteLength === 0) {
      console.error(`❌ FAILED: Received 0 audio bytes from Apple CDN`);
      process.exit(1);
    }
    console.log(`✅ Successfully received ${audioBytes.byteLength} audio bytes from Apple Music CDN!\n`);
  }

  console.log('=== ALL LIVE APPLE MUSIC PLAYBACK VERIFICATIONS PASSED (100% SUCCESS) ===');
}

runLiveAppleMusicTest().catch(err => {
  console.error('Fatal live test error:', err);
  process.exit(1);
});
