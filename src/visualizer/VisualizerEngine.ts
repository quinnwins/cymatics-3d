import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

import { AudioEngine } from '../audio/AudioEngine';
import { HistoryTexture } from './HistoryTexture';
import { CymaticsMesh } from './CymaticsMesh';
import { VolumetricChladniMesh } from './VolumetricChladniMesh';
import { GpuAcousticParticles } from './GpuAcousticParticles';
import { ChamberEnclosure } from './ChamberEnclosure';
import { BioAcousticResonator } from './BioAcousticResonator';
import { AcousticTherapyLab } from './AcousticTherapyLab';
import { VocalBiometricsLab } from './VocalBiometricsLab';
import { NobelDiscoveryLab } from './NobelDiscoveryLab';
import { CymaticsPlateMesh } from './CymaticsPlateMesh';
import { ScientificGroundDatum } from './ScientificGroundDatum';
import { ColorPalettes, PalettePreset } from './ColorPalettes';

export type VisualStyle = 'cymatics' | 'cymatics-2d' | 'bio-acoustics' | 'therapy-lab' | 'voice-biometrics' | 'nobel-lab';
export type CameraMode = 'orbit' | 'autocam' | 'emitter-lock' | 'top-down';

export interface CymaticsLayerState {
  plate: boolean;   // 2D Sand Plate
  droplet: boolean; // 3D Fluid Droplet
  trap: boolean;    // 3D Particle Trap
}

export class VisualizerEngine {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private composer!: EffectComposer;
  private bloomPass!: UnrealBloomPass;

  // Components
  public historyTexture: HistoryTexture;
  public cymaticsMesh: CymaticsMesh;
  public cymaticsPlateMesh: CymaticsPlateMesh;
  public volumetricChladni: VolumetricChladniMesh;
  public gpuAcousticParticles: GpuAcousticParticles;
  public chamberEnclosure: ChamberEnclosure;
  public bioAcousticResonator: BioAcousticResonator;
  public acousticTherapyLab: AcousticTherapyLab;
  public vocalBiometricsLab: VocalBiometricsLab;
  public nobelDiscoveryLab: NobelDiscoveryLab;
  public scientificGroundDatum!: ScientificGroundDatum;

  // Calibrated 3-Point Studio Lighting Rig
  private keyLight!: THREE.DirectionalLight;
  private fillLight!: THREE.DirectionalLight;
  private rimLight!: THREE.DirectionalLight;
  private hemiLight!: THREE.HemisphereLight;

  // State
  private currentStyle: VisualStyle = 'cymatics';
  private currentPalette: PalettePreset;
  private cameraMode: CameraMode = 'autocam';
  private clock = new THREE.Clock();

  // Multi-Select Cymatics Layer State (2D Sand Plate, 3D Fluid Droplet, 3D Particle Trap)
  public cymaticsLayers: CymaticsLayerState = {
    plate: true,
    droplet: true,
    trap: true,
  };

  // 6-DOF Harmonic Camera Choreography & Recoil Springs
  private recoilOffset = new THREE.Vector3();
  private recoilVelocity = new THREE.Vector3();
  private lastShockwaveBirth = 0;
  private lastAnimTime = 0;

  // Physics & Visual Tuning
  public waveSpeed = 6.0;
  public waveDamping = 0.12;
  public bloomStrength = 0.22;
  public particleScale = 1.0;
  public particleDensity = 131072;
  public cymaticsVisibilityMode: 'both' | 'particles' | 'droplet' = 'both';
  public autoRotateSpeed = 0.5;
  public groundGridVisible = false;

  // Performance telemetry
  public fps = 60;
  private frameCount = 0;
  private lastFpsTime = 0;

  // Lifecycle
  private animFrameId: number | null = null;
  private isDisposed = false;
  private resizeHandler: (() => void) | null = null;

  constructor(container: HTMLElement, private audioEngine: AudioEngine) {
    this.container = container;
    this.currentPalette = ColorPalettes.getPalette('cosmic-nebula');

    // 1. WebGL2 Renderer Setup with resilient fallback for diverse GPU and headless environments
    let isHeadless = false;
    try {
      this.renderer = new THREE.WebGLRenderer({
        powerPreference: 'high-performance',
        antialias: false,
        stencil: false,
        depth: true,
        alpha: false,
        preserveDrawingBuffer: true, // For screenshot capture
        failIfMajorPerformanceCaveat: false,
      });
    } catch (e1) {
      try {
        const canvas = document.createElement('canvas');
        this.renderer = new THREE.WebGLRenderer({
          canvas,
          powerPreference: 'default',
          failIfMajorPerformanceCaveat: false,
        });
      } catch (e2) {
        console.warn('WebGL hardware acceleration unavailable; initializing canvas fallback', e2);
        isHeadless = true;
        const canvas = document.createElement('canvas');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        this.renderer = {
          domElement: canvas,
          setClearColor: () => {},
          setPixelRatio: () => {},
          setSize: () => {},
          render: () => {},
          dispose: () => {},
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.05,
          capabilities: { isWebGL2: false, maxTextures: 16 } as any,
        } as unknown as THREE.WebGLRenderer;
      }
    }

    if (!isHeadless) {
      this.renderer.setClearColor(0x02040a, 1.0);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.05;
    }
    if (this.container && this.renderer.domElement) {
      this.container.appendChild(this.renderer.domElement);
    }

    // 2. Scene & Fog
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x02040a);
    this.scene.fog = new THREE.FogExp2(0x02040a, 0.03);

    // 3. Camera
    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 200);
    this.camera.position.set(0, 3.5, 9.5);

    // 4. Orbit Controls (Interactive Grabbing, Rotation, Panning, and Zooming)
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxDistance = 50;
    this.controls.minDistance = 1.2;
    this.controls.enablePan = true;
    this.controls.screenSpacePanning = true;
    this.controls.rotateSpeed = 0.85;
    this.controls.zoomSpeed = 1.0;
    this.controls.panSpeed = 0.85;

    // Transition seamlessly from automatic cinematic camera to user orbit on grab
    this.controls.addEventListener('start', () => {
      this.container.classList.add('is-grabbing');
      if (this.cameraMode === 'autocam') {
        this.cameraMode = 'orbit';
        const isVolumetric = ['cymatics', 'cymatics-2d', 'bio-acoustics', 'therapy-lab', 'voice-biometrics', 'nobel-lab'].includes(this.currentStyle);
        const targetY = isVolumetric ? 0.45 : 0.0;
        this.controls.target.set(0, targetY, 0);
        this.controls.update();
        window.dispatchEvent(new CustomEvent('camera-mode-changed', { detail: { mode: 'orbit' } }));
      }
    });

    this.controls.addEventListener('end', () => {
      this.container.classList.remove('is-grabbing');
    });

    // 5. History Ring-Buffer Texture
    this.historyTexture = new HistoryTexture();

    // 6. Visual Subsystems
    this.cymaticsMesh = new CymaticsMesh(this.currentPalette);
    this.cymaticsPlateMesh = new CymaticsPlateMesh(this.currentPalette);
    this.volumetricChladni = new VolumetricChladniMesh(this.currentPalette);
    this.gpuAcousticParticles = new GpuAcousticParticles(this.renderer, this.currentPalette);
    this.chamberEnclosure = new ChamberEnclosure(this.currentPalette);
    this.bioAcousticResonator = new BioAcousticResonator('healthy-somatic');
    this.acousticTherapyLab = new AcousticTherapyLab();
    this.vocalBiometricsLab = new VocalBiometricsLab();
    this.nobelDiscoveryLab = new NobelDiscoveryLab();

    this.scene.add(this.cymaticsMesh.group);
    this.scene.add(this.cymaticsPlateMesh.group);
    this.scene.add(this.volumetricChladni.group);
    this.scene.add(this.gpuAcousticParticles.group);
    this.scene.add(this.chamberEnclosure.group);
    this.scene.add(this.bioAcousticResonator.group);
    this.scene.add(this.acousticTherapyLab.group);
    this.scene.add(this.vocalBiometricsLab.group);
    this.scene.add(this.nobelDiscoveryLab.group);

    // 7. Calibrated 3-Point Studio Lighting Rig
    // Key Light: Neutral 4500K warm key (0xffeedb)
    this.keyLight = new THREE.DirectionalLight(0xffeedb, 1.8);
    this.keyLight.position.set(6.0, 8.0, 5.0);
    this.scene.add(this.keyLight);

    // Fill Light: 6500K cool daylight fill (0xdceeff)
    this.fillLight = new THREE.DirectionalLight(0xdceeff, 0.9);
    this.fillLight.position.set(-6.0, 3.0, 4.0);
    this.scene.add(this.fillLight);

    // Rim Light: Soft neutral rim backlight (0xf0f4ff)
    this.rimLight = new THREE.DirectionalLight(0xf0f4ff, 1.5);
    this.rimLight.position.set(0.0, 5.0, -7.0);
    this.scene.add(this.rimLight);

    // Subtle ambient hemisphere
    this.hemiLight = new THREE.HemisphereLight(0x1a2236, 0x02040a, 0.45);
    this.scene.add(this.hemiLight);

    // 8. Scientific Ground Datum Grid (Anti-Aliased Ground Coordinate Plane)
    this.scientificGroundDatum = new ScientificGroundDatum(18.0);
    this.scientificGroundDatum.setVisible(this.groundGridVisible);
    this.scene.add(this.scientificGroundDatum.mesh);

    // 9. Post-Processing Pipeline with Tuned UnrealBloomPass (threshold ~0.88, strength ~0.25)
    if (!isHeadless) {
      try {
        const renderTarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
          type: THREE.HalfFloatType,
          format: THREE.RGBAFormat,
        });
        this.composer = new EffectComposer(this.renderer, renderTarget);
        this.composer.addPass(new RenderPass(this.scene, this.camera));

        this.bloomPass = new UnrealBloomPass(
          new THREE.Vector2(window.innerWidth, window.innerHeight),
          0.22, // strength 0.22 (calibrated high-energy peak glow without washing out structural textures)
          0.35, // radius
          0.88  // threshold 0.88 (prevents blown-out white glare)
        );
        this.composer.addPass(this.bloomPass);
        this.composer.addPass(new OutputPass());
      } catch (composerErr) {
        console.warn('EffectComposer initialization deferred', composerErr);
      }
    }

    this.setStyle('cymatics');
    this.setupResizeListener();
    this.animate();
  }

  public setStyle(style: VisualStyle): void {
    this.currentStyle = style;

    // Reset volumetric components visibility
    this.cymaticsMesh.setVisible(false);
    this.cymaticsPlateMesh.setVisible(false);
    this.volumetricChladni.setVisible(false);
    this.gpuAcousticParticles.setVisible(false);
    this.chamberEnclosure.setVisible(false);
    this.bioAcousticResonator.setVisible(false);
    this.acousticTherapyLab.setVisible(false);
    this.vocalBiometricsLab.setVisible(false);
    this.nobelDiscoveryLab.setVisible(false);
    this.scientificGroundDatum.setVisible(this.groundGridVisible);

    switch (style) {
      case 'cymatics-2d':
        this.scientificGroundDatum.setVisible(this.groundGridVisible);
        this.cymaticsLayers.plate = true;
        this.cymaticsLayers.droplet = false;
        this.cymaticsLayers.trap = false;
        this.applyCymaticsLayers();
        this.camera.position.set(0, 3.8, 4.8);
        this.controls.target.set(0, 0, 0);
        this.controls.update();
        break;
      case 'cymatics':
        this.scientificGroundDatum.setVisible(this.groundGridVisible);
        this.applyCymaticsLayers();
        break;
      case 'bio-acoustics':
        this.bioAcousticResonator.setVisible(true);
        this.bioAcousticResonator.group.position.y = 0.45;
        break;
      case 'therapy-lab':
        this.acousticTherapyLab.setVisible(true);
        this.acousticTherapyLab.group.position.y = 0.45;
        break;
      case 'voice-biometrics':
        this.vocalBiometricsLab.setVisible(true);
        this.vocalBiometricsLab.group.position.y = 0.45;
        break;
      case 'nobel-lab':
        this.nobelDiscoveryLab.setVisible(true);
        this.nobelDiscoveryLab.group.position.y = 0.45;
        break;
      default:
        this.applyCymaticsLayers();
        break;
    }

    window.dispatchEvent(new CustomEvent('visual-style-changed', { detail: { style } }));
  }

  public getStyle(): VisualStyle {
    return this.currentStyle;
  }

  public setCymaticsLayers(layers: Partial<CymaticsLayerState>): void {
    if (layers.plate !== undefined) this.cymaticsLayers.plate = layers.plate;
    if (layers.droplet !== undefined) this.cymaticsLayers.droplet = layers.droplet;
    if (layers.trap !== undefined) this.cymaticsLayers.trap = layers.trap;

    // Ensure at least one layer is active
    if (!this.cymaticsLayers.plate && !this.cymaticsLayers.droplet && !this.cymaticsLayers.trap) {
      this.cymaticsLayers.droplet = true;
    }

    // Keep cymaticsVisibilityMode synchronized with cymaticsLayers
    if (this.cymaticsLayers.droplet && this.cymaticsLayers.trap) {
      this.cymaticsVisibilityMode = 'both';
    } else if (this.cymaticsLayers.trap) {
      this.cymaticsVisibilityMode = 'particles';
    } else if (this.cymaticsLayers.droplet) {
      this.cymaticsVisibilityMode = 'droplet';
    }

    if (this.currentStyle === 'cymatics' || this.currentStyle === 'cymatics-2d') {
      this.applyCymaticsLayers();
    }

    window.dispatchEvent(
      new CustomEvent('cymatics-layers-changed', {
        detail: { ...this.cymaticsLayers },
      })
    );
  }

  public getCymaticsLayers(): Readonly<CymaticsLayerState> {
    return { ...this.cymaticsLayers };
  }

  public applyCymaticsLayers(): void {
    if (this.currentStyle !== 'cymatics' && this.currentStyle !== 'cymatics-2d') {
      this.cymaticsPlateMesh.setVisible(false);
      this.cymaticsMesh.setVisible(false);
      this.gpuAcousticParticles.setVisible(false);
      this.chamberEnclosure.setVisible(false);
      this.volumetricChladni.setVisible(false);
      return;
    }

    this.cymaticsPlateMesh.setVisible(this.cymaticsLayers.plate);
    this.cymaticsMesh.setVisible(this.cymaticsLayers.droplet);
    this.gpuAcousticParticles.setVisible(this.cymaticsLayers.trap);

    // Calibrated spatial positioning for multi-layer physical coherence:
    if (this.cymaticsLayers.plate) {
      this.cymaticsPlateMesh.group.position.y = 0.0;
      // When 2D plate is active, droplet levitates above the plate
      this.cymaticsMesh.group.position.y = 0.65;
      this.gpuAcousticParticles.group.position.y = 0.45;
      this.chamberEnclosure.group.position.y = 0.45;
      this.volumetricChladni.group.position.y = 0.45;
    } else {
      this.cymaticsMesh.group.position.y = 0.45;
      this.gpuAcousticParticles.group.position.y = 0.45;
      this.chamberEnclosure.group.position.y = 0.45;
      this.volumetricChladni.group.position.y = 0.45;
    }
  }

  public setChamberGeometry(geometry: 'cube' | 'cylinder' | 'sphere'): void {
    this.cymaticsMesh.setChamberType(geometry);
    this.cymaticsPlateMesh.setChamberType(geometry === 'cylinder' ? 'circle' : 'square');
    this.volumetricChladni.setChamberType(geometry === 'cube' ? 0 : geometry === 'cylinder' ? 1 : 2);
    this.gpuAcousticParticles.setChamberGeometry(geometry);
    this.chamberEnclosure.setChamberType(geometry);
  }

  public setBloomStrength(strength: number): void {
    this.bloomStrength = strength;
    if (this.bloomPass) {
      this.bloomPass.strength = strength;
    }
  }

  public setParticleDensity(count: number): void {
    this.particleDensity = count;
    this.gpuAcousticParticles.setParticleDensity(count);
    this.cymaticsPlateMesh.setParticleDensity(count);
  }

  public setParticleCount(count: number): void {
    this.setParticleDensity(count);
  }

  public setParticleScale(scale: number): void {
    this.particleScale = scale;
    this.gpuAcousticParticles.setParticleScale(scale);
    this.cymaticsPlateMesh.setParticleScale(scale);
  }

  public setCymaticsVisibilityMode(mode: 'both' | 'particles' | 'droplet' | 'plate' | 'all'): void {
    if (mode === 'droplet') {
      this.cymaticsVisibilityMode = 'droplet';
      this.setCymaticsLayers({ plate: false, droplet: true, trap: false });
    } else if (mode === 'particles') {
      this.cymaticsVisibilityMode = 'particles';
      this.setCymaticsLayers({ plate: false, droplet: false, trap: true });
    } else if (mode === 'both') {
      this.cymaticsVisibilityMode = 'both';
      this.setCymaticsLayers({ plate: false, droplet: true, trap: true });
    } else if (mode === 'plate') {
      this.setCymaticsLayers({ plate: true, droplet: false, trap: false });
    } else if (mode === 'all') {
      this.setCymaticsLayers({ plate: true, droplet: true, trap: true });
    }
  }

  public setDropletVisible(visible: boolean): void {
    this.setCymaticsLayers({ droplet: visible });
  }

  public setGroundGridVisible(visible: boolean): void {
    this.groundGridVisible = visible;
    this.scientificGroundDatum.setVisible(visible);
  }

  public getGroundGridVisible(): boolean {
    return this.groundGridVisible;
  }

  public setChamberEnclosureVisible(visible: boolean): void {
    if (this.chamberEnclosure) {
      this.chamberEnclosure.setVisible(visible);
    }
  }

  public getChamberEnclosureVisible(): boolean {
    return this.chamberEnclosure ? this.chamberEnclosure.isVisible() : false;
  }

  public setPalette(paletteId: string): void {
    const pal = ColorPalettes.getPalette(paletteId);
    this.currentPalette = pal;
    this.cymaticsMesh.setPalette(pal);
    this.cymaticsPlateMesh.setPalette(pal);
    this.volumetricChladni.setPalette(pal);
    this.gpuAcousticParticles.setPalette(pal);
    this.chamberEnclosure.setPalette(pal);
  }

  public getCurrentPaletteId(): string {
    return this.currentPalette?.id || 'cosmic-nebula';
  }

  public setCameraMode(mode: CameraMode): void {
    this.cameraMode = mode;
    const isVolumetric = ['cymatics', 'cymatics-2d', 'bio-acoustics', 'therapy-lab', 'voice-biometrics', 'nobel-lab'].includes(this.currentStyle);
    const targetY = isVolumetric ? 0.45 : 0.0;

    if (mode === 'top-down') {
      this.camera.position.set(0, targetY + 14.5, 0.001);
      this.camera.lookAt(0, targetY, 0);
      this.controls.target.set(0, targetY, 0);
      this.controls.update();
    } else if (mode === 'emitter-lock') {
      this.camera.position.set(0, targetY + 0.5, 2.5);
      this.camera.lookAt(0, targetY, 0);
      this.controls.target.set(0, targetY, 0);
      this.controls.update();
    } else if (mode === 'orbit') {
      this.controls.target.set(0, targetY, 0);
      this.controls.update();
    }
    window.dispatchEvent(new CustomEvent('camera-mode-changed', { detail: { mode } }));
  }

  public getCameraMode(): CameraMode {
    return this.cameraMode;
  }

  public captureScreenshot(): string {
    this.composer.render();
    return this.renderer.domElement.toDataURL('image/png');
  }

  private setupResizeListener(): void {
    window.addEventListener('resize', () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      this.renderer.setSize(w, h);
      this.composer.setSize(w, h);
      this.volumetricChladni.resize(w, h);
    });
  }

  private animate = (): void => {
    requestAnimationFrame(this.animate);

    const time = this.clock.getElapsedTime();
    this.audioEngine.update(time);

    // Telemetry FPS calculation
    this.frameCount++;
    if (time - this.lastFpsTime >= 0.5) {
      this.fps = Math.round((this.frameCount / (time - this.lastFpsTime)));
      this.frameCount = 0;
      this.lastFpsTime = time;
    }

    const bands = this.audioEngine.getAudioBands();
    const shockwaves = this.audioEngine.getActiveShockwaves();
    const fundamentalHz = this.audioEngine.getFundamentalFrequency();
    const rawFft = this.audioEngine.getRawFrequencyData();
    this.historyTexture.pushSpectralFrame(rawFft, bands.subBass, fundamentalHz);

    // Vector uniforms
    const vBands03 = new THREE.Vector4(bands.subBass, bands.bass, bands.lowMid, bands.mid);
    const vBands45 = new THREE.Vector2(bands.highMid, bands.high);
    const vShockwaves = shockwaves.map(sw => new THREE.Vector4(sw.birthTime, sw.strength, sw.speed, 0));

    // Update 3D visual components
    if (this.groundGridVisible) {
      this.scientificGroundDatum.update(this.camera);
    }
    const dt = this.lastAnimTime > 0 ? Math.min(0.1, time - this.lastAnimTime) : 0.016;
    this.lastAnimTime = time;

    this.cymaticsMesh.update(time, vBands03, vBands45, fundamentalHz, dt, this.camera);
    this.cymaticsPlateMesh.update(time, vBands03, vBands45, fundamentalHz, dt, this.camera);
    this.volumetricChladni.update(time, vBands03, vBands45, fundamentalHz, this.camera);
    if (this.gpuAcousticParticles.isVisible()) {
      const activeModes = this.cymaticsMesh.getModes();
      this.gpuAcousticParticles.setModalNumbers(activeModes.x, activeModes.y, activeModes.z);
      this.gpuAcousticParticles.update(time, dt, vBands03, vBands45, vShockwaves, fundamentalHz);
    }
    if (this.chamberEnclosure.isVisible()) {
      this.chamberEnclosure.update(time, dt, vBands03, vBands45, this.camera);
    }
    this.bioAcousticResonator.update(time, dt, this.camera, vBands03);
    this.acousticTherapyLab.update(time, dt, this.camera, vBands03);
    this.nobelDiscoveryLab.update(time, dt, this.camera, vBands03);

    if (this.audioEngine.voiceBiometrics) {
      const voiceReport = this.audioEngine.voiceBiometrics.update();
      this.vocalBiometricsLab.update(dt, time, this.camera, voiceReport);
    }

    // 6-DOF Harmonic Recoil Spring Dynamics (Triggered on Audio Shockwaves)
    if (shockwaves.length > 0 && shockwaves[0].birthTime > this.lastShockwaveBirth) {
      this.lastShockwaveBirth = shockwaves[0].birthTime;
      const kickMag = Math.min(0.35, shockwaves[0].strength * 0.08);
      // Push camera outward along viewing ray
      const viewDir = new THREE.Vector3().subVectors(this.camera.position, this.controls.target).normalize();
      this.recoilVelocity.addScaledVector(viewDir, kickMag * 22.0);
    }

    // Exact Analytical Critically Damped Harmonic Return (zeta = 1.0, omega = 14 rad/s)
    const omega = 14.0;
    const expTerm = Math.exp(-omega * dt);

    const updateAxis = (pos: number, vel: number): [number, number] => {
      const c1 = pos;
      const c2 = vel + omega * pos;
      const newPos = (c1 + c2 * dt) * expTerm;
      const newVel = (vel - omega * c2 * dt) * expTerm;
      return [newPos, newVel];
    };

    const [nx, vx] = updateAxis(this.recoilOffset.x, this.recoilVelocity.x);
    const [ny, vy] = updateAxis(this.recoilOffset.y, this.recoilVelocity.y);
    const [nz, vz] = updateAxis(this.recoilOffset.z, this.recoilVelocity.z);

    this.recoilOffset.set(nx, ny, nz);
    this.recoilVelocity.set(vx, vy, vz);

    // Camera Auto-Choreography Orbit
    if (this.cameraMode === 'autocam') {
      const isCymatics = this.currentStyle === 'cymatics';
      const isPlate = this.currentStyle === 'cymatics-2d';
      const isBio = this.currentStyle === 'bio-acoustics';
      const isTherapy = this.currentStyle === 'therapy-lab';
      const isVoice = this.currentStyle === 'voice-biometrics';
      const isNobel = this.currentStyle === 'nobel-lab';
      const isSorter = isBio && this.bioAcousticResonator.getViewMode() === 'microfluidic-sorter';
      const radius = isCymatics ? 8.6 : isPlate ? 8.2 : isSorter ? 12.5 : isTherapy ? 8.2 : isBio ? 6.8 : isVoice ? 7.6 : isNobel ? 7.8 : 9.5;
      const targetY = (isCymatics || isPlate || isBio || isTherapy || isVoice || isNobel) ? 0.45 : 0.0;

      // Camera Choreography
      if (isVoice) {
        // Frontal Parallax Arc for Side-by-Side Dual-Stage Clarity (Zero Occlusion)
        const sweepX = Math.sin(time * 0.12 * this.autoRotateSpeed) * 1.6;
        const sweepY = 1.6 + Math.sin(time * 0.18) * 0.25;
        const sweepZ = 9.4 + Math.cos(time * 0.12 * this.autoRotateSpeed) * 0.6;
        this.camera.position.set(
          sweepX + this.recoilOffset.x,
          sweepY + this.recoilOffset.y,
          sweepZ + this.recoilOffset.z
        );
        this.camera.lookAt(0, targetY, 0);
        this.controls.target.set(0, targetY, 0);
      } else {
        // 6-DOF Harmonic Lissajous Path Choreography for Central Single-Stage Systems
        const baseAngle = time * 0.10 * this.autoRotateSpeed;
        const lissX = Math.sin(baseAngle) * radius + Math.sin(time * 0.23) * 0.25;
        const lissZ = Math.cos(baseAngle) * radius + Math.cos(time * 0.19) * 0.25;
        const baseHeight = isCymatics ? 3.0 : isPlate ? 3.4 : isSorter ? 3.0 : isTherapy ? 2.2 : isBio ? 1.6 : isNobel ? 2.2 : 3.2;
        const lissY = baseHeight + Math.sin(time * 0.15) * 0.45 + Math.cos(time * 0.31) * 0.20;

        this.camera.position.set(
          lissX + this.recoilOffset.x,
          lissY + this.recoilOffset.y,
          lissZ + this.recoilOffset.z
        );
        this.camera.lookAt(0, targetY, 0);
        this.controls.target.set(0, targetY, 0);
      }
    } else {
      this.controls.update();
    }

    // Calibrated post-processed rendering (120 FPS tuned bloom + ACES Filmic tonemapping)
    if (this.composer) {
      this.composer.render();
    } else if (this.renderer && typeof this.renderer.render === 'function') {
      this.renderer.render(this.scene, this.camera);
    }
  };

  public dispose(): void {
    this.isDisposed = true;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
      this.resizeHandler = null;
    }

    try {
      this.cymaticsMesh?.dispose();
      this.cymaticsPlateMesh?.dispose();
      this.volumetricChladni?.dispose();
      this.gpuAcousticParticles?.dispose();
      this.chamberEnclosure?.dispose();
      this.bioAcousticResonator?.dispose();
      this.acousticTherapyLab?.dispose();
      this.vocalBiometricsLab?.dispose();
      this.nobelDiscoveryLab?.dispose();
      this.historyTexture?.dispose();
      this.renderer?.dispose();
      this.composer?.dispose();
    } catch (e) {
      console.warn('Error during visualizer engine disposal', e);
    }
  }
}
