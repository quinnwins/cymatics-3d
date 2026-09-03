/**
 * scripts/record-showcase-video.ts
 * SoundForm 3D — Broadcast-Quality Twitter / X Developer Promo Video Generator
 *
 * Automatically records a 28-second 1080p 60 FPS promo video with 4-second cuts:
 * - Soundtrack: M83 — "Midnight City" (Apple Music live preview)
 * - Layer progression: Clean particle trap -> +plate -> +droplet
 * - Speed control: 1.0x -> 0.1x slow-motion micro-physics inspection
 * - Cylinder Bessel resonance with calibrated, non-blown-out bloom
 * - Comprehensive developer controls & telemetry HUD
 * - Full-aperture framing with commanding 3D chamber
 * - Sleek GitHub repository call-to-action outro
 */

import puppeteer from 'puppeteer-core';
import { preview } from 'vite';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { AppleMusicConnector } from '../src/audio/connectors/AppleMusicConnector';

interface RecordingOptions {
  searchQuery?: string;
  durationSeconds?: number;
  outputName?: string;
}

export async function recordShowcaseVideo(options: RecordingOptions = {}) {
  const query = options.searchQuery || 'Midnight City M83';
  const duration = options.durationSeconds || 28;
  const outputBase = options.outputName || 'soundform-3d-twitter-showcase';
  const outDir = path.resolve(process.cwd(), 'showcase_video');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const rawWebmPath = path.join(outDir, `${outputBase}-raw.webm`);
  const finalMp4Path = path.join(outDir, `${outputBase}.mp4`);

  console.log('=== STARTING SOUNDFORM 3D DEVELOPER PROMO RECORDING ===');
  console.log(`Track: "${query}" | Duration: ${duration}s | Target: 1080p @ 60 FPS (4s Cuts)\n`);

  // 1. Fetch live track & high-res artwork in Node.js
  console.log('1. Querying live Apple Music catalog for track...');
  const connector = new AppleMusicConnector();
  const searchResults = await connector.searchTracks(query, 5);
  if (searchResults.length === 0) {
    throw new Error(`No tracks found for query: "${query}"`);
  }

  const selectedTrack = searchResults.find(t => t.title.toLowerCase().includes('midnight city')) || searchResults[0];
  console.log(`   -> Found Track: "${selectedTrack.title}" by ${selectedTrack.artist}`);
  console.log(`   -> Preview Stream: ${selectedTrack.previewUrl}`);
  console.log(`   -> Artwork URL: ${selectedTrack.artworkUrl}`);

  // Fetch artwork directly to buffer and convert to Data URL for instant, CORS-free canvas rendering
  console.log('   -> Downloading 600x600 album artwork from Apple CDN...');
  const artRes = await fetch(selectedTrack.artworkUrl);
  if (!artRes.ok) {
    throw new Error(`Failed to download artwork: HTTP ${artRes.status}`);
  }
  const artBuffer = Buffer.from(await artRes.arrayBuffer());
  const artDataUrl = `data:image/jpeg;base64,${artBuffer.toString('base64')}`;
  console.log(`   -> Artwork ready (${(artBuffer.byteLength / 1024).toFixed(1)} KB)`);

  // 2. Start local Vite preview server
  console.log('\n2. Starting Vite preview server...');
  const server = await preview({
    preview: { port: 5186 },
  });
  const serverUrl = 'http://localhost:5186';
  console.log(`   -> Server running at ${serverUrl}`);

  // 3. Launch Google Chrome with Metal GPU acceleration & throttling disabled
  const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  console.log(`3. Launching Google Chrome (${chromePath})...`);

  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: false,
    args: [
      '--autoplay-policy=no-user-gesture-required',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--use-gl=angle',
      '--use-angle=metal',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-features=CalculateNativeWinOcclusion,IntensiveWakeUpThrottling',
      '--window-size=1920,1080',
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });

  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[Showcase]') || text.includes('Error') || text.includes('fail')) {
      console.log(`   [Browser] ${text}`);
    }
  });

  try {
    // 4. Navigate to application
    console.log(`4. Loading application at ${serverUrl}...`);
    await page.evaluateOnNewDocument(() => {
      (window as any).__name = (fn: any) => fn;
    });
    await page.goto(serverUrl, { waitUntil: 'networkidle0', timeout: 30000 });
    await page.evaluate(() => {
      (window as any).__name = (fn: any) => fn;
    });
    await new Promise(r => setTimeout(r, 800));

    // Focus window and bring to front on macOS
    await page.bringToFront();
    try {
      execSync(`osascript -e 'tell application "Google Chrome" to activate'`, { stdio: 'ignore' });
    } catch (e) {}

    // 5. Initialize and start Apple Music track inside browser
    console.log(`5. Starting playback for "${selectedTrack.title}" in Web Audio engine...`);
    const trackPayload = {
      ...selectedTrack,
      artDataUrl,
    };

    const trackStatus = await page.evaluate(async (track: any) => {
      (globalThis as any).__name = (globalThis as any).__name || ((fn: any) => fn);
      const engine = (window as any).__audioEngine;
      const app = (window as any).__soundformApp;
      if (!engine || !app) throw new Error('SoundForm app or AudioEngine not loaded');

      await engine.initialize();
      console.log(`[Showcase] Loading stream track: ${track.title}`);
      await engine.loadStreamTrack(track);

      // Wait for audio to begin streaming
      const audioEl = engine.audioElement;
      for (let i = 0; i < 60; i++) {
        if (audioEl && !audioEl.paused && audioEl.currentTime > 0.1) {
          return { ready: true, currentTime: audioEl.currentTime };
        }
        await new Promise(r => setTimeout(r, 100));
      }
      return { ready: false, currentTime: audioEl ? audioEl.currentTime : 0 };
    }, trackPayload);

    console.log('   -> Playback status:', trackStatus);
    if (!trackStatus.ready) {
      console.warn('   [WARN] Audio stream buffer waiting, delaying 2s...');
      await new Promise(r => setTimeout(r, 2000));
    }

    // 6. Setup 60 FPS Compositor & Recorder inside page
    console.log(`6. Executing ${duration}-second 60 FPS recording with 4-second cuts...`);

    const recordingResultPromise = page.evaluate(async (recDuration: number, meta: any) => {
      (globalThis as any).__name = (globalThis as any).__name || ((fn: any) => fn);
      const app = (window as any).__soundformApp;
      const engine = (window as any).__audioEngine;
      const visualizer = app.visualizer;
      const threeCanvas = document.querySelector('#canvas-container canvas') as HTMLCanvasElement;
      if (!threeCanvas) throw new Error('Three.js canvas not found');

      // Create 1920x1080 Compositor Canvas
      const compCanvas = document.createElement('canvas');
      compCanvas.width = 1920;
      compCanvas.height = 1080;
      const ctx = compCanvas.getContext('2d', { alpha: false })!;

      // Load Album Artwork from Data URL (instant, zero network latency, zero CORS)
      const artworkImg = new Image();
      await new Promise<void>((resolve) => {
        artworkImg.onload = () => resolve();
        artworkImg.onerror = () => resolve();
        artworkImg.src = meta.artDataUrl;
      });

      // Connect Web Audio direct digital stereo stream
      const audioCtx = engine.ctx;
      const destNode = audioCtx.createMediaStreamDestination();
      engine.masterGain.connect(destNode);

      // Setup 60 FPS capture stream
      const videoStream = compCanvas.captureStream(60);
      const combinedStream = new MediaStream([
        ...videoStream.getVideoTracks(),
        ...destNode.stream.getAudioTracks(),
      ]);

      const mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType: 'video/webm;codecs=vp9,opus',
        videoBitsPerSecond: 35000000, // 35 Mbps broadcast grade
      });

      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      const recordFinished = new Promise<Blob>((resolve) => {
        mediaRecorder.onstop = () => {
          resolve(new Blob(chunks, { type: 'video/webm' }));
        };
      });

      // Initialize visualizer settings: Start with clean particle trap only!
      visualizer.setPalette('cosmic-nebula');
      visualizer.setChamberGeometry('cube');
      visualizer.setCameraMode('orbit');
      visualizer.setCymaticsLayers({ plate: false, droplet: false, trap: true });
      visualizer.setBloomStrength(0.16); // Clean, non-blown-out bloom!

      mediaRecorder.start(100);
      const audioStart = engine.audioElement ? engine.audioElement.currentTime : 0;
      const t0 = performance.now();
      let isRecording = true;

      // Local state tracking for deterministic cuts
      let currentCut = -1;
      let currentGeom = 'cube';
      let currentPalette = 'cosmic-nebula';

      // Rounded rect drawing helper
      const drawRoundedRect = (
        c: CanvasRenderingContext2D,
        x: number,
        y: number,
        w: number,
        h: number,
        r: number
      ) => {
        c.beginPath();
        c.moveTo(x + r, y);
        c.lineTo(x + w - r, y);
        c.quadraticCurveTo(x + w, y, x + w, y + r);
        c.lineTo(x + w, y + h - r);
        c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        c.lineTo(x + r, y + h);
        c.quadraticCurveTo(x, y + h, x, y + h - r);
        c.lineTo(x, y + r);
        c.quadraticCurveTo(x, y, x + r, y);
        c.closePath();
      };

      // Main Render & Choreography Loop
      const renderFrame = () => {
        if (!isRecording) return;

        try {
          const now = performance.now();
          const elapsed = Math.max(0, (now - t0) / 1000);

          // Determine active cut index: 7 cuts, exactly 4.0 seconds of video each
          const cutIdx = Math.min(6, Math.floor(elapsed / 4.0));
          const cutT = (elapsed - cutIdx * 4.0) / 4.0; // Normalized 0..1 within cut

          // Handle discrete state transitions on cut boundaries
          if (cutIdx !== currentCut) {
            currentCut = cutIdx;
            console.log(`[Showcase] Entering Cut #${cutIdx + 1} at elapsed=${elapsed.toFixed(2)}s (Cut ${cutIdx + 1}/7)`);

            if (cutIdx === 0) {
              // Cut 1 (0-4s): Clean Trap Only (No plate, no droplet)
              visualizer.setCymaticsLayers({ plate: false, droplet: false, trap: true });
              visualizer.setChamberGeometry('cube');
              visualizer.setPalette('cosmic-nebula');
              visualizer.setBloomStrength(0.14);
              engine.setPlaybackSpeed(1.0);
            } else if (cutIdx === 1) {
              // Cut 2 (4-8s): Add Vibrating Sand Plate!
              visualizer.setCymaticsLayers({ plate: true, droplet: false, trap: true });
              visualizer.setBloomStrength(0.14);
              engine.setPlaybackSpeed(1.0);
            } else if (cutIdx === 2) {
              // Cut 3 (8-12s): Add Levitating Fluid Droplet!
              visualizer.setCymaticsLayers({ plate: true, droplet: true, trap: true });
              visualizer.setBloomStrength(0.14);
              engine.setPlaybackSpeed(1.0);
            } else if (cutIdx === 3) {
              // Cut 4 (12-16s): Slow-Mo Drop (1.0x -> 0.1x)!
              engine.setPlaybackSpeed(0.1);
              visualizer.setBloomStrength(0.14);
            } else if (cutIdx === 4) {
              // Cut 5 (16-20s): Return to 1.0x + Cylinder Bessel Morph!
              engine.setPlaybackSpeed(1.0);
              currentGeom = 'cylinder';
              visualizer.setChamberGeometry('cylinder');
              currentPalette = 'siri-luminescence';
              visualizer.setPalette('siri-luminescence');
              visualizer.setBloomStrength(0.14); // Tamed, crisp bloom - NO white blowout!
            } else if (cutIdx === 5) {
              // Cut 6 (20-24s): Sphere Harmonics / Zen Mode!
              engine.setPlaybackSpeed(1.0);
              currentGeom = 'sphere';
              visualizer.setChamberGeometry('sphere');
              visualizer.setPalette('siri-luminescence');
              visualizer.setBloomStrength(0.14);
            } else if (cutIdx === 6) {
              // Cut 7 (24-28s): Outro Card Reveal!
              engine.setPlaybackSpeed(1.0);
            }
          }

          // 1. Draw 3D WebGL Canvas
          ctx.drawImage(threeCanvas, 0, 0, 1920, 1080);

          // 2. Camera Choreography for Each Cut (Close, commanding, developer perspective)
          if (cutIdx === 0) {
            // Cut 1: Front-right 3/4 commanding angle (dist = 7.0, big in center!)
            const angle = 0.65 + cutT * 0.15;
            visualizer.camera.position.set(Math.cos(angle) * 7.0, 3.8, Math.sin(angle) * 7.0);
            visualizer.camera.lookAt(0, 0.3, 0);
          } else if (cutIdx === 1) {
            // Cut 2: Low-angle dramatic tilt up across the Chladni plate
            const angle = 1.35 + cutT * 0.12;
            visualizer.camera.position.set(Math.cos(angle) * 6.4, 1.8 + cutT * 0.4, Math.sin(angle) * 6.4);
            visualizer.camera.lookAt(0, 0.4, 0);
          } else if (cutIdx === 2) {
            // Cut 3: Macro close-up on the breathing fluid droplet
            const angle = 2.3 + cutT * 0.18;
            visualizer.camera.position.set(Math.cos(angle) * 5.2, 2.5 + Math.sin(cutT * Math.PI) * 0.3, Math.sin(angle) * 5.2);
            visualizer.camera.lookAt(0, 0.2, 0);
          } else if (cutIdx === 3) {
            // Cut 4: Slow-mo tracking orbit (0.1x physics speed)
            const angle = 2.8 + cutT * 0.14;
            visualizer.camera.position.set(Math.cos(angle) * 5.6, 2.7, Math.sin(angle) * 5.6);
            visualizer.camera.lookAt(0, 0.2, 0);
          } else if (cutIdx === 4) {
            // Cut 5: 45° elevated perspective looking into the Cylinder Bessel rings
            const angle = 3.6 + cutT * 0.25;
            visualizer.camera.position.set(Math.cos(angle) * 6.6, 4.0, Math.sin(angle) * 6.6);
            visualizer.camera.lookAt(0, 0.2, 0);
          } else if (cutIdx === 5) {
            // Cut 6: Dynamic 360° orbital sweep around the Sphere
            const angle = 4.2 + cutT * 0.85;
            visualizer.camera.position.set(Math.cos(angle) * 7.2, 3.2 + Math.cos(cutT * Math.PI) * 0.8, Math.sin(angle) * 7.2);
            visualizer.camera.lookAt(0, 0.3, 0);
          } else {
            // Cut 7: Pull back for the Outro reveal
            const angle = 4.6 + cutT * 0.12;
            const dist = 8.5 + cutT * 2.0;
            visualizer.camera.position.set(Math.cos(angle) * dist, 4.4, Math.sin(angle) * dist);
            visualizer.camera.lookAt(0, 0.4, 0);
          }

          // 3. Audio Frequency Bands
          const bands = engine.getCurrentBands() || { sub: 0.6, bass: 0.6, lowMid: 0.4, mid: 0.3, highMid: 0.2, high: 0.1, rms: 0.5 };

          // 4. UI Dissolve during Zen Mode (Cut 6) and Outro (Cut 7)
          let hudAlpha = 1.0;
          if (cutIdx === 5) {
            hudAlpha = 1.0 - cutT; // Fade out during Cut 6
          } else if (cutIdx >= 6) {
            hudAlpha = 0.0;
          }

          if (hudAlpha > 0.001) {
            ctx.save();
            ctx.globalAlpha = hudAlpha;

            // ================================================================
            // LEFT SIDEBAR DECK: Apple Music Player + Audio Spectrum HUD
            // ================================================================

            // A. Top Header Branding Pill
            drawRoundedRect(ctx, 44, 32, 330, 48, 14);
            ctx.fillStyle = 'rgba(10, 14, 26, 0.85)';
            ctx.fill();
            ctx.lineWidth = 1;
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
            ctx.stroke();

            // Glowing cyan indicator dot
            ctx.beginPath();
            ctx.arc(64, 56, 5, 0, Math.PI * 2);
            ctx.fillStyle = '#06b6d4';
            ctx.shadowColor = '#06b6d4';
            ctx.shadowBlur = 12;
            ctx.fill();
            ctx.shadowBlur = 0;

            ctx.font = 'bold 15px Inter, system-ui, sans-serif';
            ctx.fillStyle = '#ffffff';
            ctx.fillText('SoundForm 3D', 80, 61);

            ctx.font = '500 12px Inter, system-ui, sans-serif';
            ctx.fillStyle = '#94a3b8';
            ctx.fillText('Acoustic Resonance Engine', 196, 61);

            // B. Audio Spectrum HUD (Left side below logo)
            const specX = 44;
            const specY = 92;
            const specW = 360;
            const specH = 92;
            drawRoundedRect(ctx, specX, specY, specW, specH, 16);
            ctx.fillStyle = 'rgba(10, 14, 26, 0.85)';
            ctx.fill();
            ctx.lineWidth = 1;
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
            ctx.stroke();

            ctx.font = '600 11px JetBrains Mono, monospace';
            ctx.fillStyle = '#94a3b8';
            ctx.fillText('AUDIO SPECTRUM TELEMETRY', specX + 16, specY + 24);

            ctx.fillStyle = '#38bdf8';
            ctx.fillText('60 FPS • 4096-bin', specX + 224, specY + 24);

            // Spectrum Frequency Band Bars
            const bandNames = ['SUB', 'BASS', 'L-MID', 'MID', 'H-MID', 'HIGH'];
            const bandVals = [bands.sub, bands.bass, bands.lowMid, bands.mid, bands.highMid, bands.high];
            const barW = 44;
            const barSpacing = 10;

            for (let i = 0; i < 6; i++) {
              const bx = specX + 18 + i * (barW + barSpacing);
              const by = specY + 38;
              const bh = 24;

              drawRoundedRect(ctx, bx, by, barW, bh, 6);
              ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
              ctx.fill();

              const energy = Math.min(1, Math.max(0.12, bandVals[i]));
              const fillH = bh * energy;
              drawRoundedRect(ctx, bx, by + (bh - fillH), barW, fillH, 6);
              const grad = ctx.createLinearGradient(bx, by + bh, bx, by);
              grad.addColorStop(0, '#06b6d4');
              grad.addColorStop(1, '#a855f7');
              ctx.fillStyle = grad;
              ctx.fill();

              ctx.font = '600 9px JetBrains Mono, monospace';
              ctx.fillStyle = energy > 0.6 ? '#ffffff' : '#94a3b8';
              ctx.textAlign = 'center';
              ctx.fillText(bandNames[i], bx + barW / 2, by + bh + 14);
              ctx.textAlign = 'left';
            }

            // C. Apple Music "Now Playing" Glass Card (Bottom Left)
            const cardX = 44;
            const cardY = 820;
            const cardW = 540;
            const cardH = 212;
            drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 24);
            ctx.fillStyle = 'rgba(12, 17, 32, 0.94)';
            ctx.fill();
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
            ctx.stroke();

            // Ambient subtle glow behind album artwork
            ctx.save();
            ctx.shadowColor = 'rgba(250, 35, 59, 0.4)';
            ctx.shadowBlur = 20;
            drawRoundedRect(ctx, cardX + 22, cardY + 22, 168, 168, 16);
            ctx.fillStyle = '#000000';
            ctx.fill();
            ctx.restore();

            // Render High-Res Album Artwork
            if (artworkImg.complete && artworkImg.naturalWidth > 0) {
              ctx.save();
              drawRoundedRect(ctx, cardX + 22, cardY + 22, 168, 168, 16);
              ctx.clip();
              ctx.drawImage(artworkImg, cardX + 22, cardY + 22, 168, 168);
              ctx.restore();
            }

            // Apple Music Badge Pill
            const badgeX = cardX + 214;
            const badgeY = cardY + 26;
            drawRoundedRect(ctx, badgeX, badgeY, 138, 28, 14);
            const badgeGrad = ctx.createLinearGradient(badgeX, badgeY, badgeX + 138, badgeY + 28);
            badgeGrad.addColorStop(0, '#fa233b');
            badgeGrad.addColorStop(1, '#fb5c74');
            ctx.fillStyle = badgeGrad;
            ctx.fill();

            ctx.font = 'bold 12px Inter, system-ui, sans-serif';
            ctx.fillStyle = '#ffffff';
            ctx.fillText('♫  Apple Music', badgeX + 16, badgeY + 18);

            // Song Title
            ctx.font = 'bold 22px Inter, system-ui, sans-serif';
            ctx.fillStyle = '#ffffff';
            ctx.fillText(meta.title, badgeX, cardY + 86);

            // Artist
            ctx.font = '500 15px Inter, system-ui, sans-serif';
            ctx.fillStyle = 'rgba(226, 232, 240, 0.85)';
            ctx.fillText(meta.artist, badgeX, cardY + 112);

            // Animated mini EQ bars (12 bars, 3px wide, 3px gap)
            const eqX = badgeX;
            const eqY = cardY + 142;
            for (let b = 0; b < 12; b++) {
              const barVal = Math.sin(elapsed * 14 + b * 0.7) * 0.5 + 0.5;
              const h = 4 + barVal * 16 * Math.max(0.25, bands.bass * 1.5);
              ctx.fillStyle = b % 2 === 0 ? '#fa233b' : '#38bdf8';
              ctx.fillRect(eqX + b * 6, eqY + (20 - h), 3, h);
            }

            // Timeline stamp & Telemetry (Guaranteed zero overflow)
            const playSec = Math.floor(elapsed);
            const timeStr = `0:${playSec < 10 ? '0' + playSec : playSec} / 0:30  •  Web Audio 4096-bin`;
            ctx.font = '600 11px JetBrains Mono, monospace';
            ctx.fillStyle = '#94a3b8';
            ctx.fillText(timeStr, badgeX + 82, eqY + 15);

            // ================================================================
            // RIGHT SIDEBAR DECK: Developer Control & Physics Inspector
            // ================================================================
            const devX = 1490;
            const devY = 32;
            const devW = 386;
            const devH = 430;

            drawRoundedRect(ctx, devX, devY, devW, devH, 20);
            ctx.fillStyle = 'rgba(12, 17, 32, 0.90)';
            ctx.fill();
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
            ctx.stroke();

            // Header
            ctx.font = 'bold 13px JetBrains Mono, monospace';
            ctx.fillStyle = '#38bdf8';
            ctx.fillText('RESONATOR SHAPES & GEOMETRY', devX + 20, devY + 30);

            // 1. Multi-Layer Cymatics Apparatus Toggles
            ctx.font = '600 11px Inter, system-ui, sans-serif';
            ctx.fillStyle = '#94a3b8';
            ctx.fillText('Cymatics Apparatus:', devX + 20, devY + 58);

            const isPlateOn = cutIdx >= 1;
            const isDropletOn = cutIdx >= 2;
            const isTrapOn = true;

            const drawLayerPill = (label: string, active: boolean, px: number, py: number, pw: number) => {
              drawRoundedRect(ctx, px, py, pw, 32, 10);
              if (active) {
                ctx.fillStyle = 'rgba(6, 182, 212, 0.25)';
                ctx.fill();
                ctx.lineWidth = 1.5;
                ctx.strokeStyle = '#06b6d4';
                ctx.stroke();
                ctx.font = 'bold 12px Inter, system-ui, sans-serif';
                ctx.fillStyle = '#38bdf8';
              } else {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
                ctx.fill();
                ctx.lineWidth = 1;
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
                ctx.stroke();
                ctx.font = '500 12px Inter, system-ui, sans-serif';
                ctx.fillStyle = '#64748b';
              }
              ctx.textAlign = 'center';
              ctx.fillText((active ? '✓ ' : '○ ') + label, px + pw / 2, py + 20);
              ctx.textAlign = 'left';
            };

            drawLayerPill('2D Plate', isPlateOn, devX + 20, devY + 70, 108);
            drawLayerPill('3D Droplet', isDropletOn, devX + 138, devY + 70, 114);
            drawLayerPill('3D Trap', isTrapOn, devX + 262, devY + 70, 104);

            // 2. Chamber Shape Selector
            ctx.font = '600 11px Inter, system-ui, sans-serif';
            ctx.fillStyle = '#94a3b8';
            ctx.fillText('Chamber Geometry:', devX + 20, devY + 128);

            const isCubeActive = cutIdx <= 3;
            const isCylActive = cutIdx === 4;
            const isSphActive = cutIdx >= 5;

            const drawGeomButton = (label: string, active: boolean, gx: number, gy: number, gw: number) => {
              drawRoundedRect(ctx, gx, gy, gw, 32, 10);
              if (active) {
                const g = ctx.createLinearGradient(gx, gy, gx + gw, gy);
                g.addColorStop(0, '#06b6d4');
                g.addColorStop(1, '#3b82f6');
                ctx.fillStyle = g;
                ctx.fill();
                ctx.font = 'bold 12px Inter, system-ui, sans-serif';
                ctx.fillStyle = '#ffffff';
              } else {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
                ctx.fill();
                ctx.lineWidth = 1;
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
                ctx.stroke();
                ctx.font = '500 12px Inter, system-ui, sans-serif';
                ctx.fillStyle = '#94a3b8';
              }
              ctx.textAlign = 'center';
              ctx.fillText(label, gx + gw / 2, gy + 20);
              ctx.textAlign = 'left';
            };

            drawGeomButton('Cube', isCubeActive, devX + 20, devY + 140, 110);
            drawGeomButton('Cylinder', isCylActive, devX + 138, devY + 140, 110);
            drawGeomButton('Sphere', isSphActive, devX + 256, devY + 140, 110);

            // 3. Modal Numbers Sliders
            ctx.font = '600 11px Inter, system-ui, sans-serif';
            ctx.fillStyle = '#94a3b8';
            ctx.fillText('Modal Standing Wave Numbers (n, m, l):', devX + 20, devY + 198);

            const drawSlider = (label: string, val: number, maxVal: number, sx: number, sy: number) => {
              ctx.font = '600 11px JetBrains Mono, monospace';
              ctx.fillStyle = '#e2e8f0';
              ctx.fillText(label, sx, sy);
              ctx.fillStyle = '#38bdf8';
              ctx.fillText(String(val), sx + 310, sy);

              const trackW = 346;
              const fillW = (val / maxVal) * trackW;
              drawRoundedRect(ctx, sx, sy + 6, trackW, 6, 3);
              ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
              ctx.fill();

              drawRoundedRect(ctx, sx, sy + 6, fillW, 6, 3);
              ctx.fillStyle = '#06b6d4';
              ctx.fill();
            };

            const nVal = cutIdx <= 1 ? 3 : cutIdx === 2 ? 4 : cutIdx === 3 ? 3 : 5;
            const mVal = cutIdx <= 1 ? 2 : cutIdx === 2 ? 3 : cutIdx === 3 ? 2 : 4;
            const lVal = 1;

            drawSlider('Width X (n)', nVal, 8, devX + 20, devY + 218);
            drawSlider('Height Y (m)', mVal, 8, devX + 20, devY + 248);
            drawSlider('Depth Z (l)', lVal, 8, devX + 20, devY + 278);

            // 4. Physics Engine Telemetry & Speed Indicator
            ctx.font = '600 11px Inter, system-ui, sans-serif';
            ctx.fillStyle = '#94a3b8';
            ctx.fillText('Physics Engine State:', devX + 20, devY + 328);

            const isSlowMo = cutIdx === 3;
            drawRoundedRect(ctx, devX + 20, devY + 342, 346, 68, 12);
            ctx.fillStyle = isSlowMo ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255, 255, 255, 0.04)';
            ctx.fill();
            ctx.lineWidth = 1;
            ctx.strokeStyle = isSlowMo ? '#f59e0b' : 'rgba(255, 255, 255, 0.1)';
            ctx.stroke();

            ctx.font = 'bold 12px JetBrains Mono, monospace';
            ctx.fillStyle = isSlowMo ? '#fbbf24' : '#00F5D4';
            ctx.fillText(isSlowMo ? '⚡ SPEED: 0.1x (ULTRA SLOW-MO)' : '⚡ SPEED: 1.0x (REALTIME)', devX + 34, devY + 366);

            ctx.font = '500 11px JetBrains Mono, monospace';
            ctx.fillStyle = '#94a3b8';
            ctx.fillText('Particles: 131,072 GPU  •  FFT: 4096-bin', devX + 34, devY + 390);

            ctx.restore();
          }

          // 5. Cut Announcement Overlay Pill (Top Center, shines during each cut transition)
          const cutTitles = [
            'Cut 1: Clean Particle Trap (No Droplet, No Plate)',
            'Cut 2: Add 2D Vibrating Chladni Sand Plate',
            'Cut 3: Add 3D Levitating Fluid Droplet',
            'Cut 4: 0.1x Slow-Mo Micro-Physics Inspection',
            'Cut 5: Cylinder Bessel Standing Wave Resonance',
            'Cut 6: Spherical Harmonics & Zen Immersive Mode',
            'Cut 7: SoundForm 3D Open Source Launch',
          ];

          if (cutT < 0.35 && cutIdx < 6) {
            const bannerAlpha = Math.sin((cutT / 0.35) * Math.PI);
            ctx.save();
            ctx.globalAlpha = bannerAlpha;

            drawRoundedRect(ctx, 660, 36, 600, 44, 22);
            ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
            ctx.fill();
            ctx.lineWidth = 1;
            ctx.strokeStyle = '#06b6d4';
            ctx.stroke();

            ctx.font = '600 14px Inter, system-ui, sans-serif';
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.fillText('◈  ' + cutTitles[cutIdx], 960, 63);
            ctx.textAlign = 'left';
            ctx.restore();
          }

          // 6. Outro Card (Fades in during Cut 7: 24.0s - 28.0s)
          if (cutIdx >= 6) {
            const outroAlpha = Math.min(1, cutT * 2.0);
            ctx.save();
            ctx.globalAlpha = outroAlpha;

            // Ambient dark vignette
            const vignGrad = ctx.createRadialGradient(960, 540, 200, 960, 540, 1000);
            vignGrad.addColorStop(0, 'rgba(9, 10, 15, 0.35)');
            vignGrad.addColorStop(1, 'rgba(9, 10, 15, 0.88)');
            ctx.fillStyle = vignGrad;
            ctx.fillRect(0, 0, 1920, 1080);

            // Central Glass Card
            const outW = 880;
            const outH = 430;
            const outX = (1920 - outW) / 2;
            const outY = (1080 - outH) / 2;

            drawRoundedRect(ctx, outX, outY, outW, outH, 28);
            ctx.fillStyle = 'rgba(12, 17, 32, 0.94)';
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = 'rgba(6, 182, 212, 0.45)';
            ctx.stroke();

            // Title
            ctx.textAlign = 'center';
            ctx.font = 'bold 44px Inter, system-ui, sans-serif';
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = 'rgba(6, 182, 212, 0.6)';
            ctx.shadowBlur = 24;
            ctx.fillText('SoundForm 3D', 960, outY + 76);
            ctx.shadowBlur = 0;

            // Subtitle
            ctx.font = '500 18px Inter, system-ui, sans-serif';
            ctx.fillStyle = '#cbd5e1';
            ctx.fillText('Real-Time 3D Acoustic Resonance & Cymatics in WebGL2', 960, outY + 116);

            // Architecture Badges
            const pillY = outY + 160;
            const pills = [
              '🪨  Kirchhoff-Love Plate',
              '💧  Spherical Harmonics',
              '✨  131k Gor\'kov Trap',
            ];
            const pillW = 230;
            const pillGap = 20;
            const totalPillsW = 3 * pillW + 2 * pillGap;
            const startPillX = (1920 - totalPillsW) / 2;

            for (let p = 0; p < 3; p++) {
              const px = startPillX + p * (pillW + pillGap);
              drawRoundedRect(ctx, px, pillY, pillW, 42, 12);
              ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
              ctx.fill();
              ctx.lineWidth = 1;
              ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
              ctx.stroke();

              ctx.font = '600 13px Inter, system-ui, sans-serif';
              ctx.fillStyle = '#e2e8f0';
              ctx.fillText(pills[p], px + pillW / 2, pillY + 26);
            }

            // GitHub Repository Call to Action Button
            const btnW = 580;
            const btnH = 64;
            const btnX = (1920 - btnW) / 2;
            const btnY = outY + 238;

            drawRoundedRect(ctx, btnX, btnY, btnW, btnH, 20);
            const btnGrad = ctx.createLinearGradient(btnX, btnY, btnX + btnW, btnY + btnH);
            btnGrad.addColorStop(0, '#06b6d4');
            btnGrad.addColorStop(1, '#3b82f6');
            ctx.fillStyle = btnGrad;
            ctx.fill();

            ctx.font = 'bold 20px Inter, system-ui, sans-serif';
            ctx.fillStyle = '#ffffff';
            ctx.fillText('⭐  github.com/quinnwins/cymatics-3d', 960, btnY + 40);

            // Developer Quickstart Tag
            ctx.font = '500 14px JetBrains Mono, monospace';
            ctx.fillStyle = '#94a3b8';
            ctx.fillText('git clone & npm run dev  •  MIT Licensed Open Source', 960, outY + 348);

            ctx.font = '500 13px Inter, system-ui, sans-serif';
            ctx.fillStyle = '#64748b';
            ctx.fillText('WebGL2  •  Three.js  •  Web Audio 4096-bin FFT  •  TypeScript', 960, outY + 386);

            ctx.textAlign = 'left';
            ctx.restore();
          }

          // Smoothly fade out audio volume in the last 1.5s
          if (elapsed > recDuration - 1.5) {
            const fadeLeft = (recDuration - elapsed) / 1.5;
            const vol = Math.max(0, fadeLeft * 0.8);
            engine.masterGain.gain.setValueAtTime(vol, audioCtx.currentTime);
          }
        } catch (err) {
          console.error('[RenderFrame Error]', err);
        }

        requestAnimationFrame(renderFrame);
      };

      requestAnimationFrame(renderFrame);

      // Wait until wall time has progressed by the full duration
      while (isRecording) {
        await new Promise(r => setTimeout(r, 100));
        const wallElapsed = (performance.now() - t0) / 1000;
        if (wallElapsed >= recDuration) {
          break;
        }
      }

      isRecording = false;

      // Stop recorder and retrieve blob
      mediaRecorder.stop();
      const recordedBlob = await recordFinished;

      // Convert Blob to base64
      const reader = new FileReader();
      return new Promise<string>((resolve) => {
        reader.onloadend = () => {
          resolve(reader.result as string);
        };
        reader.readAsDataURL(recordedBlob);
      });
    }, duration, trackPayload);

    console.log('   -> Recording finished! Transferring WebM data...');
    const base64Data = await recordingResultPromise;
    const base64 = base64Data.split(',')[1];
    fs.writeFileSync(rawWebmPath, Buffer.from(base64, 'base64'));

    const webmSizeMb = (fs.statSync(rawWebmPath).size / (1024 * 1024)).toFixed(2);
    console.log(`7. Saved raw WebM: ${rawWebmPath} (${webmSizeMb} MB)`);

    // 8. FFmpeg Encoding to Twitter-compliant 1080p 60fps MP4
    console.log('\n8. Encoding with FFmpeg to Twitter / X broadcast specification...');
    const ffmpegCmd = [
      'ffmpeg',
      '-y',
      '-i', `"${rawWebmPath}"`,
      '-c:v', 'libx264',
      '-preset', 'slow',
      '-crf', '17',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac',
      '-b:a', '320k',
      '-ar', '48000',
      '-movflags', '+faststart',
      `"${finalMp4Path}"`,
    ].join(' ');

    console.log(`   -> Command: ${ffmpegCmd}`);
    execSync(ffmpegCmd, { stdio: 'inherit' });

    const mp4SizeMb = (fs.statSync(finalMp4Path).size / (1024 * 1024)).toFixed(2);
    console.log(`\n[SUCCESS] Final Twitter video encoded: ${finalMp4Path} (${mp4SizeMb} MB)`);

    // 9. Extract Keyframe Stills for Each of the 7 Cuts
    console.log('\n9. Extracting preview keyframe images for all 7 cuts & animated GIF teaser...');
    const stills = [
      { file: 'twitter-still-cut1-clean-trap.png', time: '00:00:02' },
      { file: 'twitter-still-cut2-add-plate.png', time: '00:00:06' },
      { file: 'twitter-still-cut3-add-droplet.png', time: '00:00:10' },
      { file: 'twitter-still-cut4-slowmo-0.1x.png', time: '00:00:14' },
      { file: 'twitter-still-cut5-cylinder-bessel.png', time: '00:00:18' },
      { file: 'twitter-still-cut6-sphere-zen.png', time: '00:00:22' },
      { file: 'twitter-still-cut7-developer-outro.png', time: '00:00:26' },
    ];

    for (const s of stills) {
      const stillPath = path.join(outDir, s.file);
      execSync(`ffmpeg -y -i "${finalMp4Path}" -ss ${s.time} -frames:v 1 -update 1 "${stillPath}"`, { stdio: 'ignore' });
    }

    const teaserGif = path.join(outDir, 'soundform-3d-twitter-teaser.gif');
    // Generate high-quality palette-optimized teaser GIF (720p width, 20fps, 4.5 seconds showing cuts 2 & 3)
    const gifPalette = path.join(outDir, 'gif-palette.png');
    execSync(`ffmpeg -y -ss 00:00:04 -t 4.5 -i "${finalMp4Path}" -vf "fps=20,scale=720:-1:flags=lanczos,palettegen" "${gifPalette}"`, { stdio: 'ignore' });
    execSync(`ffmpeg -y -ss 00:00:04 -t 4.5 -i "${finalMp4Path}" -i "${gifPalette}" -lavfi "fps=20,scale=720:-1:flags=lanczos [x]; [x][1:v] paletteuse" "${teaserGif}"`, { stdio: 'ignore' });
    if (fs.existsSync(gifPalette)) fs.unlinkSync(gifPalette);

    console.log(`   -> Extracted all 7 keyframe stills & teaser GIF.`);

    // Probe final video
    console.log('\n=== FINAL VIDEO VERIFICATION TELEMETRY ===');
    const probeOutput = execSync(`ffprobe -hide_banner "${finalMp4Path}" 2>&1`).toString();
    console.log(probeOutput);

  } finally {
    await browser.close();
    await server.httpServer.close();
  }
}

// CLI Execution
if (process.argv[1] && process.argv[1].endsWith('record-showcase-video.ts')) {
  recordShowcaseVideo({ durationSeconds: 28 }).catch(err => {
    console.error('Fatal recording error:', err);
    process.exit(1);
  });
}
