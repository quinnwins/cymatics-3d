import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import { preview } from 'vite';

const ROOT = process.cwd();
const SCREENSHOT_DIR = path.join(ROOT, 'qa_screenshots');
const SCREENSHOT_PATH = path.join(SCREENSHOT_DIR, 'sonic-memory-smoke.png');

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

function isCriticalResourceFailure(url, status) {
  if (status < 400) return false;
  if (status >= 500) return true;
  return /\.(?:js|css|wasm)(?:\?|$)/i.test(url);
}

async function setRange(page, control, value) {
  await page.$eval(`[data-control="${control}"]`, (element, nextValue) => {
    element.value = nextValue;
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }, String(value));
}

async function readSculptureState(page) {
  return page.evaluate(() => {
    const sculpture = window.__soundformApp?.visualizer?.cymaticsMesh?.temporalSculpture;
    const uniforms = sculpture?.material?.uniforms;
    return {
      signal: uniforms?.uSignal?.value ?? 0,
      historyHead: uniforms?.uHistoryHead?.value ?? 0,
      memoryFrames: uniforms?.uMemoryFrames?.value ?? 0,
      time: uniforms?.uTime?.value ?? 0,
      visible: sculpture?.points?.visible ?? false,
    };
  });
}

async function main() {
  const executablePath = findChrome();
  if (!executablePath) throw new Error('Chrome or Chromium was not found for Sonic Memory QA.');

  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const server = await preview({
    root: ROOT,
    preview: { host: '127.0.0.1', port: 5197, strictPort: true },
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

  const errors = [];
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  page.on('console', message => {
    const text = message.text();
    if (message.type() === 'error' && !text.startsWith('Failed to load resource:')) {
      errors.push(`console: ${text}`);
    }
  });
  page.on('response', response => {
    if (isCriticalResourceFailure(response.url(), response.status())) {
      errors.push(`resource: ${response.status()} ${response.url()}`);
    }
  });

  try {
    await page.goto('http://127.0.0.1:5197', { waitUntil: 'networkidle0', timeout: 30_000 });
    await page.waitForSelector('#sonic-memory-control .sm-pill', { timeout: 15_000 });
    await page.waitForSelector('#canvas-container canvas', { timeout: 15_000 });

    const boot = await page.evaluate(() => {
      const visualizer = window.__soundformApp?.visualizer;
      const sculpture = visualizer?.cymaticsMesh?.temporalSculpture;
      return {
        hasApp: Boolean(window.__soundformApp),
        hasSculpture: Boolean(sculpture),
        pointCount: sculpture?.getPointCount?.() ?? 0,
        webgl2: Boolean(visualizer?.renderer?.capabilities?.isWebGL2),
      };
    });
    if (!boot.hasApp || !boot.hasSculpture || !boot.webgl2 || boot.pointCount < 4096) {
      throw new Error(`Sonic Memory did not boot correctly: ${JSON.stringify(boot)}`);
    }

    await page.mouse.click(720, 450);
    await page.evaluate(() => {
      const engine = window.__audioEngine;
      engine?.ensureInitializedSync?.();
      engine?.playDemoTrack?.('cosmic-odyssey');
    });
    await page.waitForFunction(
      () => {
        const uniforms = window.__soundformApp?.visualizer?.cymaticsMesh?.temporalSculpture?.material?.uniforms;
        return (uniforms?.uSignal?.value ?? 0) > 0.35 && (uniforms?.uHistoryHead?.value ?? 0) > 0;
      },
      { timeout: 12_000, polling: 'raf' }
    );

    await page.click('#sonic-memory-control .sm-pill');
    await page.waitForSelector('#sm-panel:not([hidden])');
    await setRange(page, 'memory', 2.5);
    await setRange(page, 'gain', 1.45);
    await setRange(page, 'warp', 1.15);
    await setRange(page, 'lookback', 0);
    await new Promise(resolve => setTimeout(resolve, 2600));

    const live = await readSculptureState(page);
    if (!live.visible || live.signal <= 0.35 || live.memoryFrames < 30) {
      throw new Error(`Live audio did not create a useful memory volume: ${JSON.stringify(live)}`);
    }

    // Freeze the entire sculpture, then prove the Time Lens can move through
    // stored audio without advancing the frozen shader phase.
    await page.click('[data-action="freeze"]');
    await page.waitForFunction(() => document.querySelector('#sonic-memory-control em')?.textContent === 'FROZEN');
    const frozenPresent = await readSculptureState(page);
    await setRange(page, 'lookback', 1.25);
    await page.waitForFunction(
      headBefore => {
        const uniforms = window.__soundformApp?.visualizer?.cymaticsMesh?.temporalSculpture?.material?.uniforms;
        return Math.abs((uniforms?.uHistoryHead?.value ?? 0) - headBefore) > 0.01;
      },
      { timeout: 8_000, polling: 'raf' },
      frozenPresent.historyHead
    );
    const frozenPast = await readSculptureState(page);
    if (Math.abs(frozenPast.time - frozenPresent.time) > 0.0001) {
      throw new Error(`Time Lens advanced frozen phase: ${JSON.stringify({ frozenPresent, frozenPast })}`);
    }
    await new Promise(resolve => setTimeout(resolve, 450));
    const frozenStable = await readSculptureState(page);
    if (
      Math.abs(frozenStable.time - frozenPast.time) > 0.0001
      || Math.abs(frozenStable.historyHead - frozenPast.historyHead) > 0.0001
    ) {
      throw new Error(`Frozen sculpture moved: ${JSON.stringify({ frozenPast, frozenStable })}`);
    }

    // Return to now and isolate Sonic Memory for visual acceptance. The test
    // deliberately hides the droplet so a tiny emitter cannot masquerade as a
    // successful temporal volume.
    await setRange(page, 'lookback', 0);
    await page.evaluate(() => {
      const visualizer = window.__soundformApp?.visualizer;
      visualizer?.setCymaticsLayers?.({ plate: false, droplet: true, trap: false });
      visualizer?.setCameraMode?.('orbit');
      visualizer?.cymaticsMesh?.setDropletVisible?.(false);
      visualizer?.cymaticsMesh?.temporalSculpture?.setVisible?.(true);
      if (visualizer?.camera && visualizer?.controls) {
        visualizer.camera.position.set(0, 1.35, 6.25);
        visualizer.controls.target.set(0, 0.45, 0);
        visualizer.controls.update();
      }
    });

    await page.click('[data-action="immersive"]');
    await page.waitForFunction(() => document.body.classList.contains('soundform-immersive'));
    await page.click('[data-close]');
    await page.waitForFunction(() => document.querySelector('#sm-panel')?.hasAttribute('hidden'));
    await new Promise(resolve => setTimeout(resolve, 750));

    const visual = await page.evaluate(() => {
      const visualizer = window.__soundformApp?.visualizer;
      visualizer?.composer?.render?.();
      const renderer = visualizer?.renderer;
      const canvas = renderer?.domElement;
      const gl = renderer?.getContext?.();
      if (!canvas || !gl) return null;

      const width = canvas.width;
      const height = canvas.height;
      const pixels = new Uint8Array(width * height * 4);
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

      let brightPixels = 0;
      let outerPixels = 0;
      let maxRadius = 0;
      let minX = width;
      let maxX = -1;
      let minY = height;
      let maxY = -1;
      const centerX = width / 2;
      const centerY = height / 2;
      const coreRadius = Math.min(width, height) * 0.16;

      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const offset = (y * width + x) * 4;
          const luminance = Math.max(pixels[offset], pixels[offset + 1], pixels[offset + 2]);
          if (luminance < 14) continue;
          brightPixels += 1;
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
          const radius = Math.hypot(x - centerX, y - centerY);
          maxRadius = Math.max(maxRadius, radius);
          if (radius > coreRadius) outerPixels += 1;
        }
      }

      return {
        width,
        height,
        brightPixels,
        outerPixels,
        maxRadius,
        boundsWidth: maxX >= minX ? maxX - minX + 1 : 0,
        boundsHeight: maxY >= minY ? maxY - minY + 1 : 0,
      };
    });

    if (!visual) throw new Error('Unable to read Sonic Memory WebGL pixels.');
    if (
      visual.brightPixels < 2_500
      || visual.outerPixels < 700
      || visual.boundsWidth < 360
      || visual.boundsHeight < 300
      || visual.maxRadius < 190
    ) {
      throw new Error(`Sonic Memory failed visual occupancy: ${JSON.stringify(visual)}`);
    }

    await page.screenshot({ path: SCREENSHOT_PATH, fullPage: false });
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.body.classList.contains('soundform-immersive'));

    if (errors.length > 0) throw new Error(`Browser reported errors:\n${errors.join('\n')}`);

    console.log('Sonic Memory browser and visual acceptance passed.', {
      pointCount: boot.pointCount,
      signal: Number(live.signal.toFixed(3)),
      visual,
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
