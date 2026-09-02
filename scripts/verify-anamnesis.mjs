import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import { preview } from 'vite';

const ROOT = process.cwd();
const SCREENSHOT_DIR = path.join(ROOT, 'qa_screenshots');
const SCREENSHOT_PATH = path.join(SCREENSHOT_DIR, 'anamnesis-song-remembers.png');

function findChrome() {
  return [
    process.env.CHROME_PATH,
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].filter(Boolean).find(candidate => fs.existsSync(candidate));
}

async function main() {
  const executablePath = findChrome();
  if (!executablePath) throw new Error('Chrome or Chromium is required for Anamnesis verification.');
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const server = await preview({
    root: ROOT,
    preview: { host: '127.0.0.1', port: 5198, strictPort: true },
  });
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--autoplay-policy=no-user-gesture-required',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
      '--enable-unsafe-swiftshader',
      '--use-gl=angle',
      '--use-angle=swiftshader',
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  page.on('console', message => {
    const text = message.text();
    if (message.type() === 'error' && !text.startsWith('Failed to load resource:')) {
      errors.push(`console: ${text}`);
    }
  });
  page.on('response', response => {
    if (response.status() >= 500 || (response.status() >= 400 && /\.(?:js|css|wasm)(?:\?|$)/i.test(response.url()))) {
      errors.push(`resource: ${response.status()} ${response.url()}`);
    }
  });

  try {
    await page.goto('http://127.0.0.1:5198', { waitUntil: 'networkidle0', timeout: 30_000 });
    await page.waitForSelector('#bottom-transport-root', { timeout: 15_000 });

    // Enable Memory so live Web Audio feeds the long-memory model.
    await page.evaluate(() => window.__anamnesis?.setEnabled?.(true));
    await page.waitForFunction(() => window.__anamnesis?.getState?.().enabled === true, { timeout: 15_000 });

    // Prove that ordinary live Web Audio feeds the long-memory model.
    await page.mouse.click(720, 450);
    await page.evaluate(() => {
      window.__audioEngine?.ensureInitializedSync?.();
      window.__audioEngine?.playDemoTrack?.('cosmic-odyssey');
    });
    await page.waitForFunction(
      () => (window.__anamnesis?.getState?.().stats?.moments || 0) >= 3,
      { timeout: 10_000 }
    );
    const liveMoments = await page.evaluate(() => window.__anamnesis.getState().stats.moments);

    // Stop playback and inject a deterministic phrase/contrast/return sequence
    // through the same public observation API. This isolates recurrence logic
    // from the timing variance of a software WebGL runner.
    const recurrence = await page.evaluate(() => {
      const experience = window.__anamnesis;
      const audio = window.__audioEngine;
      audio.stopAll();
      experience.beginSession({
        identity: 'demo:cosmic-odyssey',
        title: 'Anamnesis acceptance phrase',
        artist: 'Deterministic browser proof',
        source: 'qa',
        durationSeconds: 24,
      });

      const sampleRate = 48_000;
      const binCount = 2048;
      const spectrumFor = notes => {
        const spectrum = new Float32Array(binCount);
        spectrum.fill(-110);
        const binWidth = sampleRate / (binCount * 2);
        for (const fundamental of notes) {
          for (let harmonic = 1; harmonic <= 7; harmonic += 1) {
            const frequency = fundamental * harmonic;
            if (frequency > 18_000) continue;
            const bin = Math.round(frequency / binWidth);
            for (let spread = -1; spread <= 1; spread += 1) {
              const index = bin + spread;
              if (index <= 0 || index >= spectrum.length) continue;
              spectrum[index] = Math.max(
                spectrum[index],
                -34 - 9 * Math.log2(harmonic) - Math.abs(spread) * 4
              );
            }
          }
        }
        return spectrum;
      };
      const warm = { subBass: 0.18, bass: 0.48, lowMid: 0.83, mid: 0.62, highMid: 0.25, high: 0.12, rms: 0.52 };
      const bright = { subBass: 0.08, bass: 0.22, lowMid: 0.46, mid: 0.72, highMid: 0.68, high: 0.42, rms: 0.56 };
      const phrase = [
        [220, 277.18, 329.63], [220, 277.18, 329.63],
        [246.94, 311.13, 369.99], [246.94, 311.13, 369.99],
        [261.63, 329.63, 392], [261.63, 329.63, 392],
        [196, 246.94, 293.66], [196, 246.94, 293.66],
      ];
      const contrast = [
        [146.83, 220, 293.66], [146.83, 220, 293.66],
        [164.81, 246.94, 329.63], [164.81, 246.94, 329.63],
        [174.61, 261.63, 349.23], [174.61, 261.63, 349.23],
        [130.81, 196, 261.63], [130.81, 196, 261.63],
      ];
      const ingest = (start, notes, bands) => {
        notes.forEach((chord, index) => experience.ingestObservation({
          timeSeconds: start + index * 0.4,
          durationSeconds: 24,
          sampleRate,
          spectrum: spectrumFor(chord),
          bands,
          fundamentalHz: chord[0],
          transient: index === 0 ? 1.2 : 0,
        }, start + index * 0.4));
      };
      ingest(0, phrase, warm);
      ingest(6, contrast, bright);
      ingest(12, contrast.map(chord => chord.map(note => note * 0.943874)), bright);
      ingest(18, phrase, warm);

      return {
        stats: experience.getState().stats,
        points: experience.field.getRenderedPointCount(),
        threads: experience.field.getRenderedThreadCount(),
      };
    });

    if (recurrence.stats.echoes < 1 || recurrence.threads < 1 || recurrence.points < 24) {
      throw new Error(`Phrase recurrence did not become a visible memory: ${JSON.stringify(recurrence)}`);
    }

    // Enter through the actual product hotkey directly
    const isExpanded = await page.evaluate(() => window.__anamnesis?.getState?.().expanded === true);
    if (!isExpanded) {
      await page.keyboard.press('KeyA');
    }
    await page.waitForFunction(() => document.body.classList.contains('soundform-anamnesis'));
    await page.waitForFunction(() => window.__anamnesis?.getState?.().expanded === true);
    await new Promise(resolve => setTimeout(resolve, 1200));

    const visualProof = await page.evaluate(() => {
      const visualizer = window.__soundformApp.visualizer;
      const experience = window.__anamnesis;
      // Isolate the long-memory field for a meaningful pixel-occupancy gate.
      visualizer.cymaticsMesh.temporalSculpture.setVisible(false);
      const renderer = visualizer.renderer;
      renderer.render(visualizer.scene, visualizer.camera);
      const gl = renderer.getContext();
      const width = renderer.domElement.width;
      const height = renderer.domElement.height;
      const pixels = new Uint8Array(width * height * 4);
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

      let lit = 0;
      let outerLit = 0;
      let minX = width;
      let maxX = 0;
      let minY = height;
      let maxY = 0;
      for (let y = 0; y < height; y += 2) {
        for (let x = 0; x < width; x += 2) {
          const offset = (y * width + x) * 4;
          const luminance = pixels[offset] + pixels[offset + 1] + pixels[offset + 2];
          if (luminance < 38) continue;
          lit += 1;
          const dx = x - width / 2;
          const dy = y - height / 2;
          if (Math.sqrt(dx * dx + dy * dy) > Math.min(width, height) * 0.12) outerLit += 1;
          minX = Math.min(minX, x); maxX = Math.max(maxX, x);
          minY = Math.min(minY, y); maxY = Math.max(maxY, y);
        }
      }
      return {
        lit,
        outerLit,
        spanX: maxX - minX,
        spanY: maxY - minY,
        state: experience.getState(),
      };
    });

    // Always preserve visual proof, including on a failed legibility gate, so
    // artistic regressions remain inspectable instead of collapsing to numbers.
    await page.screenshot({ path: SCREENSHOT_PATH, fullPage: false });

    if (visualProof.outerLit < 900 || visualProof.spanX < 340 || visualProof.spanY < 170) {
      throw new Error(`Anamnesis is technically present but not visually legible: ${JSON.stringify(visualProof)}`);
    }

    const relicProof = await page.evaluate(() => {
      const experience = window.__anamnesis;
      const first = experience.saveRelic(false);
      const second = experience.saveRelic(false);
      window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
      if (!first || !second) return { saved: false };
      const stored = JSON.parse(localStorage.getItem('soundform.anamnesis.relics.v1') || '[]');
      const viewed = experience.viewRelic(first.id);
      const viewing = experience.getState().viewingRelic;
      experience.returnToLive();
      return {
        saved: true,
        viewed,
        viewing,
        sameId: first.id === second.id,
        storedCount: stored.length,
        id: first.id,
      };
    });
    if (
      !relicProof.saved
      || !relicProof.viewed
      || !relicProof.viewing
      || !relicProof.sameId
      || relicProof.storedCount !== 1
    ) {
      throw new Error(`Memory relic lifecycle failed: ${JSON.stringify(relicProof)}`);
    }

    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.body.classList.contains('soundform-anamnesis'));

    // Verify that disabling memory disables Anamnesis and suppresses whispers
    await page.evaluate(() => window.__anamnesis?.setEnabled?.(false));
    await page.waitForFunction(() => window.__anamnesis?.getState?.().enabled === false, { timeout: 15_000 });
    const suppressed = await page.evaluate(() => {
      const whisper = document.querySelector('#anamnesis-whisper');
      return {
        enabled: window.__anamnesis.getState().enabled,
        whisperVisible: whisper?.classList.contains('is-visible') ?? false,
      };
    });
    if (suppressed.enabled || suppressed.whisperVisible) {
      throw new Error(`Anamnesis was not properly suppressed when memory was turned off: ${JSON.stringify(suppressed)}`);
    }

    if (errors.length) throw new Error(`Browser reported errors:\n${errors.join('\n')}`);
    console.log('Anamnesis browser verification passed.', {
      liveMoments,
      echoes: recurrence.stats.echoes,
      families: recurrence.stats.families,
      outerLit: visualProof.outerLit,
      span: `${visualProof.spanX}×${visualProof.spanY}`,
      screenshot: SCREENSHOT_PATH,
    });
  } finally {
    await browser.close();
    await new Promise(resolve => server.httpServer.close(resolve));
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
