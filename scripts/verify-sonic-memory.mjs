import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import { preview } from 'vite';

const ROOT = process.cwd();
const SCREENSHOT_DIR = path.join(ROOT, 'qa_screenshots');
const SCREENSHOT_PATH = path.join(SCREENSHOT_DIR, 'sonic-memory-smoke.png');

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].filter(Boolean);

  return candidates.find(candidate => fs.existsSync(candidate));
}

async function main() {
  const executablePath = findChrome();
  if (!executablePath) {
    throw new Error('Google Chrome or Chromium was not found for the Sonic Memory smoke test.');
  }

  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const server = await preview({
    root: ROOT,
    preview: {
      host: '127.0.0.1',
      port: 5197,
      strictPort: true,
    },
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
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });

  try {
    await page.goto('http://127.0.0.1:5197', {
      waitUntil: 'networkidle0',
      timeout: 30_000,
    });
    await page.waitForSelector('#sonic-memory-control .sm-pill', { timeout: 15_000 });
    await page.waitForSelector('#canvas-container canvas', { timeout: 15_000 });

    const boot = await page.evaluate(() => {
      const app = window.__soundformApp;
      const visualizer = app?.visualizer;
      const sculpture = visualizer?.cymaticsMesh?.temporalSculpture;
      return {
        hasApp: Boolean(app),
        hasSculpture: Boolean(sculpture),
        pointCount: sculpture?.getPointCount?.() ?? 0,
        webgl2: Boolean(visualizer?.renderer?.capabilities?.isWebGL2),
      };
    });

    if (!boot.hasApp || !boot.hasSculpture) {
      throw new Error(`Sonic Memory did not boot: ${JSON.stringify(boot)}`);
    }
    if (boot.pointCount < 4096) {
      throw new Error(`Sonic Memory point field is incomplete: ${boot.pointCount}`);
    }
    if (!boot.webgl2) {
      throw new Error('Sonic Memory smoke test did not receive a WebGL2 renderer.');
    }

    // A real pointer gesture unlocks Web Audio before starting the deterministic demo.
    await page.mouse.click(720, 450);
    await page.evaluate(() => {
      const engine = window.__audioEngine;
      engine?.ensureInitializedSync?.();
      engine?.playDemoTrack?.('cosmic-odyssey');
    });
    await new Promise(resolve => setTimeout(resolve, 2200));

    const live = await page.evaluate(() => {
      const sculpture = window.__soundformApp?.visualizer?.cymaticsMesh?.temporalSculpture;
      const uniforms = sculpture?.material?.uniforms;
      return {
        signal: uniforms?.uSignal?.value ?? 0,
        historyHead: uniforms?.uHistoryHead?.value ?? 0,
        visible: sculpture?.points?.visible ?? false,
      };
    });

    if (!live.visible || live.signal <= 0 || live.historyHead <= 0) {
      throw new Error(`Live audio did not populate Sonic Memory: ${JSON.stringify(live)}`);
    }

    await page.click('#sonic-memory-control .sm-pill');
    await page.waitForSelector('#sm-panel:not([hidden])');

    // Time Lens: move the center two seconds into the stored past.
    const headBeforeLookback = live.historyHead;
    await page.$eval('[data-control="lookback"]', element => {
      element.value = '2';
      element.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await new Promise(resolve => setTimeout(resolve, 150));
    const headAfterLookback = await page.evaluate(() => {
      const sculpture = window.__soundformApp?.visualizer?.cymaticsMesh?.temporalSculpture;
      return sculpture?.material?.uniforms?.uHistoryHead?.value ?? 0;
    });
    if (Math.abs(headAfterLookback - headBeforeLookback) < 0.01) {
      throw new Error('The Sonic Memory Time Lens did not move through history.');
    }

    // Freeze must stop both history writes and shader phase, leaving a stable sculpture.
    await page.click('[data-action="freeze"]');
    await page.waitForFunction(() => document.querySelector('#sonic-memory-control em')?.textContent === 'FROZEN');
    const frozenBefore = await page.evaluate(() => {
      const uniforms = window.__soundformApp?.visualizer?.cymaticsMesh?.temporalSculpture?.material?.uniforms;
      return { time: uniforms?.uTime?.value ?? 0, head: uniforms?.uHistoryHead?.value ?? 0 };
    });
    await new Promise(resolve => setTimeout(resolve, 500));
    const frozenAfter = await page.evaluate(() => {
      const uniforms = window.__soundformApp?.visualizer?.cymaticsMesh?.temporalSculpture?.material?.uniforms;
      return { time: uniforms?.uTime?.value ?? 0, head: uniforms?.uHistoryHead?.value ?? 0 };
    });
    if (Math.abs(frozenAfter.time - frozenBefore.time) > 0.0001 || Math.abs(frozenAfter.head - frozenBefore.head) > 0.0001) {
      throw new Error(`Frozen sculpture moved: ${JSON.stringify({ frozenBefore, frozenAfter })}`);
    }

    // Immersive mode must enter cleanly and remain escapable from the keyboard.
    await page.click('[data-action="immersive"]');
    await page.waitForFunction(() => document.body.classList.contains('soundform-immersive'));
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.body.classList.contains('soundform-immersive'));

    await page.screenshot({ path: SCREENSHOT_PATH, fullPage: false });

    if (errors.length > 0) {
      throw new Error(`Browser reported errors:\n${errors.join('\n')}`);
    }

    console.log('Sonic Memory browser smoke test passed.', {
      pointCount: boot.pointCount,
      signal: Number(live.signal.toFixed(3)),
      screenshot: SCREENSHOT_PATH,
    });
  } finally {
    await browser.close();
    await server.httpServer.close();
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
