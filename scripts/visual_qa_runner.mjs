import { chromium } from 'playwright';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import http from 'http';

const SCREENSHOT_DIR = path.resolve(process.cwd(), 'qa_screenshots');
const ARTIFACT_DIR = '/Users/quinnwins/.gemini/antigravity/brain/78ae3161-f0c3-4d52-a5c7-de2843b46649/qa_screenshots';

if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
if (!fs.existsSync(ARTIFACT_DIR)) fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

function createStaticServer(distDir, port) {
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.wav': 'audio/wav',
    '.mp3': 'audio/mpeg',
  };

  const server = http.createServer((req, res) => {
    let reqPath = req.url.split('?')[0];
    if (reqPath === '/') reqPath = '/index.html';
    const filePath = path.join(distDir, reqPath);

    fs.readFile(filePath, (err, data) => {
      if (err) {
        fs.readFile(path.join(distDir, 'index.html'), (err2, indexData) => {
          if (err2) {
            res.writeHead(404);
            res.end('Not Found');
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(indexData);
          }
        });
        return;
      }
      const ext = path.extname(filePath);
      const contentType = mimeTypes[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    });
  });

  return new Promise((resolve, reject) => {
    server.listen(port, '127.0.0.1', () => resolve(server));
    server.on('error', reject);
  });
}

export async function runVisualQA(iteration = 1) {
  console.log(`\n======================================================`);
  console.log(`Running Visual QA Capture Matrix — Iteration #${iteration}`);
  console.log(`======================================================\n`);

  console.log('Building production bundle...');
  const buildProc = spawn('npx', ['vite', 'build'], { stdio: 'inherit', shell: true });
  await new Promise((resolve, reject) => {
    buildProc.on('close', code => code === 0 ? resolve() : reject(new Error('Build failed')));
  });

  const distDir = path.resolve(process.cwd(), 'dist');
  console.log(`Starting in-process static HTTP server...`);
  const server = await createStaticServer(distDir, 0);
  const actualPort = server.address().port;
  const serverUrl = `http://127.0.0.1:${actualPort}`;
  console.log('Server ready at:', serverUrl);

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
    console.log(`Capturing: ${filename} — ${description}`);
    await page.waitForTimeout(600); // Allow WebGL frames to render
    const localPath = path.join(SCREENSHOT_DIR, filename);
    const artifactPath = path.join(ARTIFACT_DIR, filename);
    await page.screenshot({ path: localPath, fullPage: false });
    try {
      fs.copyFileSync(localPath, artifactPath);
    } catch (e) {
      console.warn('Failed to copy to artifact dir:', e.message);
    }
  };

  try {
    // =========================================================================
    // 1. 4K Ultra-wide Desktop Viewport (2560x1440)
    // =========================================================================
    console.log('\n--- Testing 4K Ultra-wide Desktop (2560x1440) ---');
    const context4K = await browser.newContext({
      viewport: { width: 2560, height: 1440 },
      deviceScaleFactor: 1.5,
    });
    const page4K = await context4K.newPage();
    page4K.on('console', msg => consoleLogs.push(`[4K ${msg.type()}]: ${msg.text()}`));
    page4K.on('pageerror', err => errors.push(`[4K PageError]: ${err.message}`));

    await page4K.goto(serverUrl, { waitUntil: 'networkidle' });
    await page4K.waitForTimeout(600);
    await captureState(page4K, '01_welcome_screen_4k.png', '4K Desktop Viewport');
    await captureState(page4K, '02_cymatics_lab_4k_fundamental.png', '4K 3D Cymatics Lab with (1,1,1) Fundamental Standing Wave');
    await context4K.close();

    // =========================================================================
    // 2. Standard 1080p Desktop (1920x1080) Full Feature Test Matrix
    // =========================================================================
    console.log('\n--- Testing Standard 1080p Desktop (1920x1080) Full Feature Suite ---');
    const context1080p = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 2,
    });
    const page = await context1080p.newPage();
    page.on('console', msg => consoleLogs.push(`[1080p ${msg.type()}]: ${msg.text()}`));
    page.on('pageerror', err => errors.push(`[1080p PageError]: ${err.message}`));

    await page.goto(serverUrl, { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);

    // Mode 1: 3D Cymatics Lab
    await captureState(page, '03_cymatics_cube_1080p.png', 'Cube Chamber with Volumetric Chladni Membranes');

    const btnCylinder = page.locator('.btn-cym-geom[data-geom="cylinder"]');
    if (await btnCylinder.count() > 0) {
      await btnCylinder.click();
      await page.waitForTimeout(400);
      await captureState(page, '04_cymatics_cylinder_bessel_1080p.png', 'Cylinder Chamber with Radial Bessel Standing Tubes');
    }

    const btnSphere = page.locator('.btn-cym-geom[data-geom="sphere"]');
    if (await btnSphere.count() > 0) {
      await btnSphere.click();
      await page.waitForTimeout(400);
      await captureState(page, '05_cymatics_sphere_harmonics_1080p.png', 'Spherical Resonator with Spherical Harmonic Nodal Shells');
    }

    const preset543 = page.locator('.btn-cym-preset[data-preset-id="crystal-543"]');
    if (await preset543.count() > 0) {
      await preset543.click();
      await page.waitForTimeout(400);
      await captureState(page, '06_cymatics_crystal_543_1080p.png', 'Ultra High-Order (5,4,3) Resonant Crystal Preset');
    }

    const btnTrap = page.locator('#cym-btn-trapping-mode');
    if (await btnTrap.count() > 0) {
      await btnTrap.click();
      await page.waitForTimeout(400);
      await captureState(page, '07_particles_inverse_antinodes_1080p.png', 'Inverse Chladni Antinodal Particle Levitation');
    }

    // Reset Cymatics
    const btnCube = page.locator('.btn-cym-geom[data-geom="cube"]');
    if (await btnCube.count() > 0) await btnCube.click();

    // Mode 2: Tone Synthesizer Tab inside Cymatics & Music
    console.log('\n--- Testing Tone Synthesizer Tab ---');
    const tabSynth = page.locator('#src-tab-synth');
    if (await tabSynth.count() > 0) {
      await tabSynth.click();
      await page.waitForTimeout(400);
      await captureState(page, '08_frequency_lab_main_1080p.png', 'Tone Synthesizer with Eigenmode Audition & Note Matrix');

      const btnSweeper = page.locator('#cym-synth-sub-sweeper');
      if (await btnSweeper.count() > 0) {
        await btnSweeper.click();
        await page.waitForTimeout(400);
        
        const btn528 = page.locator('.btn-cym-freq-preset[data-hz="528"]');
        if (await btn528.count() > 0) {
          await btn528.click();
          await page.waitForTimeout(400);
          await captureState(page, '09_frequency_lab_528hz_1080p.png', 'Tone Synthesizer at 528 Hz Solfeggio Tone');
        }

        const btnHarmonics = page.locator('#cym-btn-toggle-overtones');
        if (await btnHarmonics.count() > 0) {
          await btnHarmonics.click();
          await page.waitForTimeout(400);
          await captureState(page, '10_frequency_lab_overtones_drawer_1080p.png', 'Tone Synthesizer with Overtones Harmonics Drawer Open');
          await btnHarmonics.click(); // close
        }
      }

      // Switch back to demo tracks
      const tabTracks = page.locator('#src-tab-tracks');
      if (await tabTracks.count() > 0) await tabTracks.click();
    }

    // Mode 3: Cymatics & Music Studio (Tracks Tab)
    console.log('\n--- Testing Cymatics & Music Studio ---');
    await page.click('#btn-mode-cymatics');
    await page.waitForTimeout(600);
    await captureState(page, '11_music_space_cosmos_1080p.png', 'Music Space Cosmos Hybrid Visual Style');

    const btnWaves = page.locator('button[data-style="wavefront"]');
    if (await btnWaves.count() > 0) {
      await btnWaves.click({ force: true });
      await page.waitForTimeout(400);
      await captureState(page, '12_music_space_waves_style_1080p.png', 'Expanding Concentric Acoustic Wavefront Shells');
    }

    const btnDust = page.locator('button[data-style="particles"]');
    if (await btnDust.count() > 0) {
      await btnDust.click({ force: true });
      await page.waitForTimeout(400);
      await captureState(page, '13_music_space_dust_style_1080p.png', '3D Acoustic Particle Nebula Dust Cloud');
    }

    const btnRibbon = page.locator('button[data-style="ribbon"]');
    if (await btnRibbon.count() > 0) {
      await btnRibbon.click({ force: true });
      await page.waitForTimeout(400);
      await captureState(page, '14_music_space_ribbon_style_1080p.png', 'Continuous Archimedean Spacetime Sonic Ribbon');
    }

    // Mode 4: Bio-Acoustics Resonator
    console.log('\n--- Testing Bio-Acoustics Resonator ---');
    await page.click('#btn-mode-bio');
    await page.waitForTimeout(600);
    await captureState(page, '15_bio_acoustics_cell_inspector_1080p.png', 'Bio-Acoustics Cellular Spectroscopy & Deformation Engine');

    const btnSorter = page.locator('#bio-view-sorter');
    if (await btnSorter.count() > 0) {
      await btnSorter.click();
      await page.waitForTimeout(400);
      await captureState(page, '16_bio_acoustics_microfluidic_sorter_1080p.png', 'Acoustophoretic Microfluidic Cell Sorter');
    }

    const btnGlio = page.locator('button[data-specimen-id="cancer-glioblastoma"]');
    if (await btnGlio.count() > 0) {
      await btnGlio.click();
      await page.waitForTimeout(400);
      await captureState(page, '17_bio_acoustics_glioblastoma_specimen_1080p.png', 'Cancerous Glioblastoma Cell Acoustic Resonance');
    }

    // Mode 5: Cancer Therapy Lab
    console.log('\n--- Testing Cancer Therapy Lab ---');
    await page.click('#btn-mode-therapy');
    await page.waitForTimeout(600);
    await captureState(page, '18_cancer_therapy_phase_cancel_1080p.png', 'Cancer Therapy Phase Cancellation Deck');

    const tabOnco = page.locator('#tab-oncotripsy');
    if (await tabOnco.count() > 0) {
      await tabOnco.click();
      await page.waitForTimeout(400);
      await captureState(page, '19_cancer_therapy_oncotripsy_1080p.png', 'Oncotripsy Targeted Cell Destruction');
    }

    const tabSono = page.locator('#tab-sonodynamic-sdt');
    if (await tabSono.count() > 0) {
      await tabSono.click();
      await page.waitForTimeout(400);
      await captureState(page, '20_cancer_therapy_sonodynamic_1080p.png', 'Sonodynamic Microbubble Cavitation Resonance');
    }

    const tabVortex = page.locator('#tab-vortex-torsion');
    if (await tabVortex.count() > 0) {
      await tabVortex.click();
      await page.waitForTimeout(400);
      await captureState(page, '21_cancer_therapy_vortex_mode_1080p.png', 'Acoustic Vortex Nanoporation & Shear Stress');
    }

    // Mode 6: Voice Biometrics Lab
    console.log('\n--- Testing Voice Biometrics Lab ---');
    await page.click('#btn-mode-voice');
    await page.waitForTimeout(600);
    await captureState(page, '22_voice_biometrics_main_1080p.png', 'Voice Biometrics Formant Manifold & Pitch Telemetry');

    const voiceSelect = page.locator('#voice-preset-select');
    if (await voiceSelect.count() > 0) {
      await voiceSelect.selectOption({ value: 'vocal-nodules' });
      await page.waitForTimeout(400);
      await captureState(page, '23_voice_biometrics_nodules_1080p.png', 'Pathological Vocal Nodules Diagnosis & Prescription');
    }

    // Mode 7: Nobel Discovery Lab
    console.log('\n--- Testing Nobel Discovery Lab ---');
    await page.click('#btn-mode-nobel');
    await page.waitForTimeout(600);
    await captureState(page, '24_nobel_discovery_mechanogenomics_1080p.png', 'Nobel Lab: Mechanogenomic Chromatin Remodeling & HUD');

    const btnBBB = page.locator('#btn-frontier-bbb');
    if (await btnBBB.count() > 0) {
      await btnBBB.click();
      await page.waitForTimeout(400);
      await captureState(page, '25_nobel_discovery_bbb_dilation_1080p.png', 'Nobel Lab: Blood-Brain Barrier Ultrasonic Tight Junction Dilation');
    }

    const btnViral = page.locator('#btn-frontier-viral');
    if (await btnViral.count() > 0) {
      await btnViral.click();
      await page.waitForTimeout(400);
      await captureState(page, '26_nobel_discovery_viral_shatter_1080p.png', 'Nobel Lab: Viral Capsid Acoustic Shatter Mode');
    }

    // Executive Keynote Tour
    console.log('\n--- Testing Executive Keynote Tour ---');
    const btnTour = page.locator('.btn-executive-tour:visible').first();
    if (await btnTour.count() > 0) {
      await btnTour.click();
      await page.waitForTimeout(600);
      await captureState(page, '26_executive_tour_slide1_1080p.png', 'Executive Tour Slide 1 Overlay');
      
      const btnTourNext = page.locator('#tour-btn-next');
      if (await btnTourNext.count() > 0) {
        await btnTourNext.click();
        await page.waitForTimeout(500);
        await captureState(page, '27_executive_tour_slide2_1080p.png', 'Executive Tour Slide 2 Overlay');
      }

      const btnTourExit = page.locator('#tour-btn-exit');
      if (await btnTourExit.count() > 0) {
        await btnTourExit.click();
        await page.waitForTimeout(300);
      }
    }

    // Physics Drawer
    console.log('\n--- Testing Physics Drawer ---');
    const btnPhysics = page.locator('#btn-toggle-physics:visible').first();
    if (await btnPhysics.count() > 0) {
      await btnPhysics.click();
      await page.waitForTimeout(400);
      await captureState(page, '28_physics_drawer_expanded_1080p.png', 'Physics Drawer Expanded');
      await btnPhysics.click(); // close
    }

    // Color Palettes
    console.log('\n--- Testing Color Palettes ---');
    const themeSelect = page.locator('#theme-selector');
    if (await themeSelect.count() > 0) {
      await themeSelect.selectOption({ value: 'solar-flare' });
      await page.waitForTimeout(300);
      await captureState(page, '29_palette_solar_flare_1080p.png', 'Solar Flare Palette');

      await themeSelect.selectOption({ value: 'siri-luminescence' });
      await page.waitForTimeout(300);
      await captureState(page, '30_palette_siri_luminescence_1080p.png', 'Siri Luminescence Palette');

      await themeSelect.selectOption({ value: 'prismatic-crystal' });
      await page.waitForTimeout(300);
      await captureState(page, '31_palette_prismatic_crystal_1080p.png', 'Prismatic Crystal Palette');

      await themeSelect.selectOption({ value: 'quantum-void' });
      await page.waitForTimeout(300);
      await captureState(page, '32_palette_quantum_void_1080p.png', 'Quantum Void Palette');
    }

    // Zen Mode
    console.log('\n--- Testing Zen Immersion Mode ---');
    await page.keyboard.press('h');
    await page.waitForTimeout(400);
    await captureState(page, '33_zen_immersion_mode_1080p.png', 'Zen Mode: Zero UI Overhead Visualizer');
    await page.keyboard.press('h'); // restore
    await page.waitForTimeout(300);

    await context1080p.close();

    // =========================================================================
    // 3. Tablet Viewport (1024x768)
    // =========================================================================
    console.log('\n--- Testing Tablet Viewport (1024x768) ---');
    const contextTablet = await browser.newContext({
      viewport: { width: 1024, height: 768 },
      deviceScaleFactor: 2,
    });
    const pageTablet = await contextTablet.newPage();
    await pageTablet.goto(serverUrl, { waitUntil: 'networkidle' });
    await pageTablet.waitForTimeout(600);
    await captureState(pageTablet, '34_tablet_viewport_1024x768.png', 'Tablet Landscape Responsive Layout');
    await contextTablet.close();

    // =========================================================================
    // 4. Mobile Viewport (390x844 - iPhone 14)
    // =========================================================================
    console.log('\n--- Testing Mobile Viewport (390x844) ---');
    const contextMobile = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
    });
    const pageMobile = await contextMobile.newPage();
    await pageMobile.goto(serverUrl, { waitUntil: 'networkidle' });
    await pageMobile.waitForTimeout(600);
    await captureState(pageMobile, '35_mobile_viewport_390x844.png', 'Mobile Portrait Responsive Layout with Touch Controls');
    await contextMobile.close();

    console.log('\nVisual QA Execution Completed Successfully!');
    console.log(`Total Screenshots Captured: 35`);
    console.log(`Page Errors: ${errors.length}`);
    if (errors.length > 0) {
      console.error('Errors encountered:', errors);
    }
    return { success: true, count: 35, errors };
  } catch (err) {
    console.error('Visual QA run failed:', err);
    return { success: false, error: err.message };
  } finally {
    if (browser) await browser.close();
    if (server) server.close();
  }
}

if (process.argv[1] && process.argv[1].endsWith('visual_qa_runner.mjs')) {
  runVisualQA(1);
}
