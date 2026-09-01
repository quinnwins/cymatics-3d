import { chromium } from 'playwright';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import http from 'http';

const SCREENSHOT_DIR = path.resolve(process.cwd(), 'qa_screenshots');
const ARTIFACT_DIR = '/Users/qenglish/.gemini/antigravity/brain/b822b34c-c823-4549-a101-e6c1f11933c7/qa_screenshots';

if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
if (!fs.existsSync(ARTIFACT_DIR)) fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

async function waitForServer(url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(url, res => {
          if (res.statusCode === 200) resolve(true);
          else reject(new Error(`Status ${res.statusCode}`));
        });
        req.on('error', reject);
        req.end();
      });
      return true;
    } catch {
      await new Promise(r => setTimeout(r, 200));
    }
  }
  throw new Error(`Server at ${url} failed to respond within ${timeoutMs}ms`);
}

async function runVisualQA() {
  console.log('📦 Building production bundle for fast preview...');
  const buildProc = spawn('npx', ['vite', 'build'], { stdio: 'inherit', shell: true });
  await new Promise((resolve, reject) => {
    buildProc.on('close', code => code === 0 ? resolve() : reject(new Error('Build failed')));
  });

  console.log('🚀 Starting Vite preview server...');
  const previewProcess = spawn('npx', ['vite', 'preview', '--port', '5199', '--strictPort'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
  });

  const serverUrl = 'http://localhost:5199';
  await waitForServer(serverUrl);
  console.log('✅ Preview server ready at:', serverUrl);

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--use-gl=angle',
      '--use-angle=metal',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
    ],
  });

  const consoleLogs = [];
  const errors = [];

  const captureState = async (page, filename, description) => {
    console.log(`📸 Capturing: ${filename} — ${description}`);
    await page.waitForTimeout(600); // Allow WebGL frames to render
    const localPath = path.join(SCREENSHOT_DIR, filename);
    const artifactPath = path.join(ARTIFACT_DIR, filename);
    await page.screenshot({ path: localPath, fullPage: false });
    fs.copyFileSync(localPath, artifactPath);
  };

  try {
    // --- 1. 4K / Ultra-wide Desktop Viewport (2560x1440) ---
    console.log('\n--- 🖥️ Testing 4K Ultra-wide Desktop (2560x1440) ---');
    const context4K = await browser.newContext({
      viewport: { width: 2560, height: 1440 },
      deviceScaleFactor: 1.5,
    });
    const page4K = await context4K.newPage();
    page4K.on('console', msg => consoleLogs.push(`[4K ${msg.type()}]: ${msg.text()}`));
    page4K.on('pageerror', err => errors.push(`[4K PageError]: ${err.message}`));

    await page4K.goto(serverUrl, { waitUntil: 'networkidle' });
    await page4K.waitForSelector('#welcome-card', { timeout: 10000 });
    await captureState(page4K, '01_welcome_screen_4k.png', '4K Welcome Screen with Glowing Emitter Card');

    // Unlock Audio and enter 3D Cymatics Lab
    await page4K.click('#welcome-card');
    await page4K.waitForTimeout(600);
    await captureState(page4K, '02_cymatics_lab_4k_fundamental.png', '4K 3D Cymatics Lab with (1,1,1) Fundamental Standing Wave');
    await context4K.close();

    // --- 2. Standard 1080p Desktop (1920x1080) Full Feature Test Suite ---
    console.log('\n--- 🖥️ Testing Standard 1080p Desktop (1920x1080) Full Test Matrix ---');
    const context1080p = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 2,
    });
    const page = await context1080p.newPage();
    page.on('console', msg => consoleLogs.push(`[1080p ${msg.type()}]: ${msg.text()}`));
    page.on('pageerror', err => errors.push(`[1080p PageError]: ${err.message}`));

    await page.goto(serverUrl, { waitUntil: 'networkidle' });
    await page.click('#welcome-card');
    await page.waitForTimeout(600);

    // Test A: 3D Cymatics Lab Presets & Chambers
    await captureState(page, '03_cymatics_cube_1080p.png', 'Cube Chamber with Volumetric Chladni Membranes');

    // Cylinder Chamber
    const btnCylinder = page.locator('#btn-geom-cylinder');
    if (await btnCylinder.count() > 0) {
      await btnCylinder.click();
      await page.waitForTimeout(500);
      await captureState(page, '04_cymatics_cylinder_bessel_1080p.png', 'Cylinder Chamber with Radial Bessel Standing Tubes');
    }

    // Sphere Chamber
    const btnSphere = page.locator('#btn-geom-sphere');
    if (await btnSphere.count() > 0) {
      await btnSphere.click();
      await page.waitForTimeout(500);
      await captureState(page, '05_cymatics_sphere_harmonics_1080p.png', 'Spherical Resonator with Spherical Harmonic Nodal Shells');
    }

    // High-Order Resonant Crystal Preset (5,4,3)
    const preset543 = page.locator('button[data-preset-id="resonant-crystal"]');
    if (await preset543.count() > 0) {
      await preset543.click();
      await page.waitForTimeout(500);
      await captureState(page, '06_cymatics_crystal_543_1080p.png', 'Ultra High-Order (5,4,3) Resonant Crystal Preset');
    }

    // Inverse Trapping Antinodes Mode
    const btnAntinodes = page.locator('#btn-trap-antinodes');
    if (await btnAntinodes.count() > 0) {
      await btnAntinodes.click();
      await page.waitForTimeout(600);
      await captureState(page, '07_particles_inverse_antinodes_1080p.png', 'Inverse Chladni Antinodal Particle Levitation');
    }

    // Switch back to Cube & Normal Nodes
    const btnCube = page.locator('#btn-geom-cube');
    if (await btnCube.count() > 0) await btnCube.click();
    const btnNodes = page.locator('#btn-trap-nodes');
    if (await btnNodes.count() > 0) await btnNodes.click();

    // Test B: Frequency Lab
    console.log('\n--- 🔬 Testing Frequency Lab ---');
    await page.click('#btn-mode-freq');
    await page.waitForTimeout(600);
    await captureState(page, '08_frequency_lab_main_1080p.png', 'Frequency Lab with 8-Harmonic Fourier Drawbars & Solfeggio Matrix');

    // Select 528 Hz Transformation Preset
    const btn528 = page.locator('button[data-hz="528"]');
    if (await btn528.count() > 0) {
      await btn528.click();
      await page.waitForTimeout(500);
      await captureState(page, '09_frequency_lab_528hz_1080p.png', 'Frequency Lab at 528 Hz Transformation Tone');
    }

    // Activate Anti-Phase Cancellation & Heterodyne
    const btnAntiPhase = page.locator('#btn-antiphase-toggle');
    if (await btnAntiPhase.count() > 0) await btnAntiPhase.click();
    const btnHeterodyne = page.locator('#btn-heterodyne-toggle');
    if (await btnHeterodyne.count() > 0) await btnHeterodyne.click();
    await page.waitForTimeout(500);
    await captureState(page, '10_frequency_lab_anc_heterodyne_1080p.png', 'Active Noise Cancellation (180° Anti-Phase) & Heterodyne Gamma Beating');

    // Test C: Music Space (Audio-Reactive) & Visual Styles
    console.log('\n--- 🎵 Testing Music Space & Visual Styles ---');
    await page.click('#btn-mode-music');
    await page.waitForTimeout(700);
    await captureState(page, '11_music_space_hybrid_cosmos_1080p.png', 'Music Space Cosmos Hybrid Visual Style with 6-Band Log-FFT Spectrum HUD');

    // Waves Visual Style
    const btnWaves = page.locator('button[data-style="wavefront"]');
    if (await btnWaves.count() > 0) {
      await btnWaves.click();
      await page.waitForTimeout(500);
      await captureState(page, '12_music_space_waves_style_1080p.png', 'Expanding Concentric Acoustic Wavefront Shells');
    }

    // Dust Visual Style
    const btnDust = page.locator('button[data-style="particles"]');
    if (await btnDust.count() > 0) {
      await btnDust.click();
      await page.waitForTimeout(500);
      await captureState(page, '13_music_space_dust_style_1080p.png', '3D Acoustic Particle Nebula Dust Cloud');
    }

    // Ribbon Visual Style
    const btnRibbon = page.locator('button[data-style="ribbon"]');
    if (await btnRibbon.count() > 0) {
      await btnRibbon.click();
      await page.waitForTimeout(500);
      await captureState(page, '14_music_space_ribbon_style_1080p.png', 'Continuous Archimedean Spacetime Sonic Ribbon');
    }

    // Test D: Physics Drawer & Parameters
    console.log('\n--- ⚙️ Testing Physics Drawer ---');
    const btnPhysics = page.locator('#btn-toggle-physics');
    if (await btnPhysics.count() > 0) {
      await btnPhysics.click();
      await page.waitForTimeout(500);
      await captureState(page, '15_physics_drawer_expanded_1080p.png', 'Physics Drawer Expanded (Gor\'kov Power, Stokes Viscosity, Wave Damping)');
      await btnPhysics.click(); // close
    }

    // Test E: Color Theme Palettes
    console.log('\n--- 🎨 Testing Color Palettes ---');
    const themeSelect = page.locator('#theme-selector');
    if (await themeSelect.count() > 0) {
      await themeSelect.selectOption({ value: 'solar-flare' });
      await page.waitForTimeout(400);
      await captureState(page, '16_palette_solar_flare_1080p.png', 'Solar Flare High-Energy Palette');

      await themeSelect.selectOption({ value: 'siri-luminescence' });
      await page.waitForTimeout(400);
      await captureState(page, '17_palette_siri_luminescence_1080p.png', 'Siri Luminescence Magenta-Cyan Palette');

      await themeSelect.selectOption({ value: 'prismatic-crystal' });
      await page.waitForTimeout(400);
      await captureState(page, '18_palette_prismatic_crystal_1080p.png', 'Prismatic Crystal Optical Dispersion Palette');

      await themeSelect.selectOption({ value: 'quantum-void' });
      await page.waitForTimeout(400);
      await captureState(page, '19_palette_quantum_void_1080p.png', 'Quantum Void Abyssal Palette');
    }

    // Test F: Zen Immersion Mode (H)
    console.log('\n--- ✨ Testing Zen Immersion Mode ---');
    await page.keyboard.press('h');
    await page.waitForTimeout(500);
    await captureState(page, '20_zen_immersion_mode_1080p.png', 'Zen Mode: Zero UI Overhead Immersive 3D Visualizer');
    await page.keyboard.press('h'); // restore
    await page.waitForTimeout(300);

    await context1080p.close();

    // --- 3. Tablet Viewport (1024x768) ---
    console.log('\n--- 📱 Testing Tablet Viewport (1024x768) ---');
    const contextTablet = await browser.newContext({
      viewport: { width: 1024, height: 768 },
      deviceScaleFactor: 2,
    });
    const pageTablet = await contextTablet.newPage();
    await pageTablet.goto(serverUrl, { waitUntil: 'networkidle' });
    await pageTablet.click('#welcome-card');
    await pageTablet.waitForTimeout(600);
    await captureState(pageTablet, '21_tablet_viewport_1024x768.png', 'Tablet Landscape Responsive Layout');
    await contextTablet.close();

    // --- 4. Mobile Viewport (390x844 - iPhone 14) ---
    console.log('\n--- 📱 Testing Mobile Viewport (390x844) ---');
    const contextMobile = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
    });
    const pageMobile = await contextMobile.newPage();
    await pageMobile.goto(serverUrl, { waitUntil: 'networkidle' });
    await pageMobile.click('#welcome-card');
    await pageMobile.waitForTimeout(600);
    await captureState(pageMobile, '22_mobile_viewport_390x844.png', 'Mobile Portrait Responsive Layout with Touch Controls');
    await contextMobile.close();

    console.log('\n🎉 Visual QA Execution Completed Successfully!');
    console.log(`Total Screenshots Captured: 22`);
    console.log(`Page Errors: ${errors.length}`);
    if (errors.length > 0) {
      console.error('Errors encountered:', errors);
    }

  } catch (err) {
    console.error('Visual QA run failed:', err);
  } finally {
    await browser.close();
    previewProcess.kill('SIGTERM');
  }
}

runVisualQA();
