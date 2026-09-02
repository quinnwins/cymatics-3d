import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(rootDir, 'dist');
const screenshotPath = path.join(rootDir, 'sonic-memory-smoke.png');

const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

function findChrome() {
  const candidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    process.env.CHROME_PATH,
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].filter(Boolean);

  const executable = candidates.find(candidate => fs.existsSync(candidate));
  if (!executable) {
    throw new Error(`Chrome executable not found. Checked: ${candidates.join(', ')}`);
  }
  return executable;
}

function contentType(filename) {
  const extension = path.extname(filename).toLowerCase();
  return {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.wav': 'audio/wav',
    '.mp3': 'audio/mpeg',
  }[extension] || 'application/octet-stream';
}

async function startServer() {
  if (!fs.existsSync(path.join(distDir, 'index.html'))) {
    throw new Error('dist/index.html is missing. Run npm run build before the smoke test.');
  }

  const server = http.createServer((request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url || '/', 'http://localhost').pathname);
      const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
      let filename = path.resolve(distDir, relativePath);

      if (!filename.startsWith(`${distDir}${path.sep}`) && filename !== path.join(distDir, 'index.html')) {
        response.writeHead(403);
        response.end('Forbidden');
        return;
      }

      if (!fs.existsSync(filename) || fs.statSync(filename).isDirectory()) {
        filename = path.join(distDir, 'index.html');
      }

      response.writeHead(200, {
        'Content-Type': contentType(filename),
        'Cache-Control': 'no-store',
      });
      fs.createReadStream(filename).pipe(response);
    } catch (error) {
      response.writeHead(500);
      response.end(error instanceof Error ? error.message : String(error));
    }
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Static server did not expose a port.');
  return { server, url: `http://127.0.0.1:${address.port}` };
}

const errors = [];
let browser;
let server;

try {
  const serving = await startServer();
  server = serving.server;

  browser = await puppeteer.launch({
    executablePath: findChrome(),
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--autoplay-policy=no-user-gesture-required',
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });

  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(`console.error: ${message.text()}`);
  });

  await page.goto(serving.url, { waitUntil: 'networkidle0', timeout: 30_000 });
  await page.waitForSelector('#sonic-memory-control', { timeout: 12_000 });

  // Unlock Web Audio exactly as a real visitor would, then feed the live analyzer.
  await page.mouse.click(720, 450);
  await page.evaluate(() => {
    const audioEngine = window.__audioEngine;
    if (!audioEngine) throw new Error('AudioEngine was not exposed by the application.');
    audioEngine.ensureInitializedSync();
    audioEngine.playDemoTrack('cosmic-odyssey');
  });
  await sleep(1_800);

  const initial = await page.evaluate(() => {
    const app = window.__soundformApp;
    const canvas = document.querySelector('#canvas-container canvas');
    const visualizer = app?.visualizer;
    const sculpture = visualizer?.cymaticsMesh?.temporalSculpture;
    const material = sculpture?.material;

    return {
      hasApp: Boolean(app),
      hasCanvas: canvas instanceof HTMLCanvasElement,
      hasWebGL2: canvas instanceof HTMLCanvasElement && Boolean(canvas.getContext('webgl2')),
      pointCount: sculpture?.getPointCount?.() || 0,
      visible: Boolean(sculpture?.group?.visible && sculpture?.points?.visible),
      signal: Number(material?.uniforms?.uSignal?.value || 0),
    };
  });

  if (!initial.hasApp || !initial.hasCanvas || !initial.hasWebGL2) {
    throw new Error(`WebGL application did not initialize: ${JSON.stringify(initial)}`);
  }
  if (initial.pointCount !== 65_536) {
    throw new Error(`Unexpected Sonic Memory point count: ${initial.pointCount}`);
  }
  if (!initial.visible || initial.signal <= 0.001) {
    throw new Error(`Sonic Memory did not become active from live audio: ${JSON.stringify(initial)}`);
  }

  await page.click('.sm-pill');
  await page.click('[data-action="freeze"]');
  await sleep(100);
  const frozenStatus = await page.$eval('.sm-pill em', element => element.textContent);
  if (frozenStatus !== 'FROZEN') throw new Error(`Freeze control reported ${frozenStatus}`);

  await page.$eval('[data-control="lookback"]', input => {
    input.value = '1.2';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const timeLens = await page.$eval('[data-value="lookback"]', output => output.value);
  if (timeLens !== '−1.2 s') throw new Error(`Time Lens did not update: ${timeLens}`);

  await page.click('[data-action="immersive"]');
  const immersiveOn = await page.$eval('body', body => body.classList.contains('soundform-immersive'));
  if (!immersiveOn) throw new Error('Immersive mode did not activate.');
  await page.keyboard.press('Escape');
  const immersiveOff = await page.$eval('body', body => !body.classList.contains('soundform-immersive'));
  if (!immersiveOff) throw new Error('Escape did not exit immersive mode.');

  await page.click('[data-action="freeze"]');
  await sleep(100);
  const liveStatus = await page.$eval('.sm-pill em', element => element.textContent);
  if (liveStatus !== 'LIVE') throw new Error(`Resume control reported ${liveStatus}`);

  await page.screenshot({ path: screenshotPath, type: 'png' });

  if (errors.length > 0) {
    throw new Error(`Browser console failures:\n${errors.join('\n')}`);
  }

  console.log('Sonic Memory browser smoke test passed:', initial);
  console.log('Screenshot:', screenshotPath);
} finally {
  await browser?.close();
  await new Promise(resolve => server?.close(resolve));
}
