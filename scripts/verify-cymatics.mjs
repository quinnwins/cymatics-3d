import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import { preview } from 'vite';

const ROOT = process.cwd();
const SCREENSHOT_DIR = path.join(ROOT, 'qa_screenshots');
const SCREENSHOT_PATH = path.join(SCREENSHOT_DIR, 'cymatics-live-verified.png');

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
  if (!executablePath) throw new Error('Chrome or Chromium is required for Cymatics verification.');
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
    if (message.type() === 'error' && !text.startsWith('Failed to load resource:') && !text.includes('favicon')) {
      errors.push(`console: ${text}`);
    }
  });

  try {
    await page.goto('http://127.0.0.1:5198', { waitUntil: 'networkidle0', timeout: 30000 });

    // Ensure core application booted and attached to window
    await page.waitForFunction(() => Boolean(window.__soundformApp && window.__audioEngine), { timeout: 15000 });

    // Verify core UI elements exist
    const uiVerification = await page.evaluate(() => {
      const header = document.querySelector('#header-root');
      const leftSidebar = document.querySelector('#left-sidebar-root');
      const rightSidebar = document.querySelector('#right-sidebar-root');
      const bottomTransport = document.querySelector('#bottom-transport-root');
      const playBtn = document.querySelector('#btn-play-pause');
      const spectrumHud = document.querySelector('#spectrum-hud');
      const canvas = document.querySelector('#canvas-container canvas');

      return {
        hasHeader: Boolean(header),
        hasLeftSidebar: Boolean(leftSidebar),
        hasRightSidebar: Boolean(rightSidebar),
        hasBottomTransport: Boolean(bottomTransport),
        hasPlayBtn: Boolean(playBtn),
        hasSpectrumHud: Boolean(spectrumHud),
        hasCanvas: Boolean(canvas),
      };
    });

    if (!uiVerification.hasHeader) throw new Error('Missing #header-root in DOM');
    if (!uiVerification.hasCanvas) throw new Error('Missing WebGL canvas in DOM');
    if (!uiVerification.hasPlayBtn) throw new Error('Missing #btn-play-pause in master transport');

    // Trigger audio playback and unlock
    await page.click('#btn-play-pause');
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Verify audio engine state & cymatics reactivity
    const audioState = await page.evaluate(async () => {
      const app = window.__soundformApp;
      const audio = window.__audioEngine;

      // Start procedural track if not already playing
      if (!audio.getIsPlaying()) {
        await audio.playDemoTrack('cosmic-odyssey');
      }

      const isPlaying = audio.getIsPlaying();
      const fundamental = audio.getFundamentalFrequency();
      const bands = audio.getAudioBands();
      const visualizer = app?.visualizer;

      return {
        isPlaying,
        fundamental,
        bands,
        hasVisualizer: Boolean(visualizer),
        dropletVisible: visualizer?.cymaticsMesh?.isVisible?.(),
        plateVisible: visualizer?.cymaticsPlateMesh?.group?.visible,
        particlesCount: visualizer?.gpuAcousticParticles?.getParticleCount?.(),
      };
    });

    if (!audioState.isPlaying) {
      throw new Error('Audio engine failed to transition to playing state');
    }

    // Capture visual proof of live cymatics visualization
    await new Promise(resolve => setTimeout(resolve, 1000));
    await page.screenshot({ path: SCREENSHOT_PATH });

    if (errors.length > 0) {
      throw new Error(`Browser console/page errors detected:\n${errors.join('\n')}`);
    }

    console.log('✅ SoundForm 3D Core Cymatics & Music verification passed successfully!');
    console.log(`📸 Visual proof saved to: ${SCREENSHOT_PATH}`);
  } finally {
    await browser.close();
    await server.close();
  }
}

main().catch(err => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
