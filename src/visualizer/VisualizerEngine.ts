import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

import { AudioEngine } from '../audio/AudioEngine';
import { HistoryTexture } from './HistoryTexture';
import { WavefrontShells } from './WavefrontShells';
import { CymaticsMesh } from './CymaticsMesh';
import { ParticleNebula } from './ParticleNebula';
import { SonicRibbon } from './SonicRibbon';
import { CentralEmitter } from './CentralEmitter';
import { VolumetricChladniMesh } from './VolumetricChladniMesh';
import { GpuAcousticParticles } from './GpuAcousticParticles';
import { ChamberEnclosure } from './ChamberEnclosure';
import { BioAcousticResonator } from './BioAcousticResonator';
import { AcousticTherapyLab } from './AcousticTherapyLab';
import { VocalBiometricsLab } from './VocalBiometricsLab';
import { NobelDiscoveryLab } from './NobelDiscoveryLab';
import { ColorPalettes, PalettePreset } from './ColorPalettes';

export type VisualStyle = 'wavefront' | 'particles' | 'cymatics' | 'ribbon' | 'hybrid' | 'bio-acoustics' | 'therapy-lab' | 'voice-biometrics' | 'nobel-lab';
export type CameraMode = 'orbit' | 'autocam' | 'emitter-lock' | 'top-down';

export class VisualizerEngine {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private composer: EffectComposer;
  private bloomPass: UnrealBloomPass;

  // Components
  public historyTexture: HistoryTexture;
  public wavefrontShells: WavefrontShells;
  public cymaticsMesh: CymaticsMesh;
  public particleNebula: ParticleNebula;
  public sonicRibbon: SonicRibbon;
  public centralEmitter: CentralEmitter;
  public volumetricChladni: VolumetricChladniMesh;
  public gpuAcousticParticles: GpuAcousticParticles;
  public chamberEnclosure: ChamberEnclosure;
  public bioAcousticResonator: BioAcousticResonator;
  public acousticTherapyLab: AcousticTherapyLab;
  public vocalBiometricsLab: VocalBiometricsLab;
  public nobelDiscoveryLab: NobelDiscoveryLab;

  // State
  private currentStyle: VisualStyle = 'hybrid';
  private currentPalette: PalettePreset;
  private cameraMode: CameraMode = 'autocam';
  private clock = new THREE.Clock();

  // 6-DOF Harmonic Camera Choreography & Recoil Springs
  private recoilOffset = new THREE.Vector3();
  private recoilVelocity = new THREE.Vector3();
  private lastShockwaveBirth = 0;
  private lastAnimTime = 0;

  // Physics & Visual Tuning
  public waveSpeed = 6.0;
  public waveDamping = 0.12;
  public bloomStrength = 0.35;
  public particleScale = 1.0;
  public autoRotateSpeed = 0.5;

  // Performance telemetry
  public fps = 60;
  private frameCount = 0;
  private lastFpsTime = 0;

  constructor(container: HTMLElement, private audioEngine: AudioEngine) {
    this.container = container;
    this.currentPalette = ColorPalettes.getPalette('cosmic-nebula');

    // 1. WebGL2 Renderer Setup
    this.renderer = new THREE.WebGLRenderer({
      powerPreference: 'high-performance',
      antialias: false,
      stencil: false,
      depth: true,
      alpha: false,
      preserveDrawingBuffer: true, // For screenshot capture
    });
    this.renderer.setClearColor(0x02040a, 1.0);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.container.appendChild(this.renderer.domElement);

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
        const isVolumetric = ['cymatics', 'bio-acoustics', 'therapy-lab', 'voice-biometrics', 'nobel-lab'].includes(this.currentStyle);
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
    this.wavefrontShells = new WavefrontShells(this.historyTexture.texture, this.currentPalette);
    this.cymaticsMesh = new CymaticsMesh(this.currentPalette);
    this.particleNebula = new ParticleNebula(this.historyTexture.texture, this.currentPalette);
    this.sonicRibbon = new SonicRibbon(this.historyTexture.texture, this.currentPalette);
    this.centralEmitter = new CentralEmitter(this.currentPalette);
    this.volumetricChladni = new VolumetricChladniMesh(this.currentPalette);
    this.gpuAcousticParticles = new GpuAcousticParticles(this.renderer, this.currentPalette);
    this.chamberEnclosure = new ChamberEnclosure(this.currentPalette);
    this.bioAcousticResonator = new BioAcousticResonator('healthy-somatic');
    this.acousticTherapyLab = new AcousticTherapyLab();
    this.vocalBiometricsLab = new VocalBiometricsLab();
    this.nobelDiscoveryLab = new NobelDiscoveryLab();

    this.scene.add(this.wavefrontShells.group);
    this.scene.add(this.cymaticsMesh.group);
    this.scene.add(this.particleNebula.group);
    this.scene.add(this.sonicRibbon.group);
    this.scene.add(this.centralEmitter.group);
    this.scene.add(this.volumetricChladni.group);
    this.scene.add(this.gpuAcousticParticles.group);
    this.scene.add(this.chamberEnclosure.group);
    this.scene.add(this.bioAcousticResonator.group);
    this.scene.add(this.acousticTherapyLab.group);
    this.scene.add(this.vocalBiometricsLab.group);
    this.scene.add(this.nobelDiscoveryLab.group);

    // 7. Post-Processing Pipeline
    const renderTarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
    });
    this.composer = new EffectComposer(this.renderer, renderTarget);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.35,
      0.25,
      0.85
    );
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(new OutputPass());

    this.setStyle('hybrid');
    this.setupResizeListener();
    this.animate();
  }

  public setStyle(style: VisualStyle): void {
    this.currentStyle = style;

    // Reset volumetric components visibility
    this.volumetricChladni.setVisible(false);
    this.gpuAcousticParticles.setVisible(false);
    this.chamberEnclosure.setVisible(false);
    this.bioAcousticResonator.setVisible(false);
    this.acousticTherapyLab.setVisible(false);
    this.vocalBiometricsLab.setVisible(false);
    this.nobelDiscoveryLab.setVisible(false);

    switch (style) {
      case 'wavefront':
        this.wavefrontShells.setVisible(true);
        this.particleNebula.setVisible(false);
        this.cymaticsMesh.setVisible(false);
        this.sonicRibbon.setVisible(false);
        this.centralEmitter.group.visible = true;
        break;
      case 'particles':
        this.wavefrontShells.setVisible(false);
        this.particleNebula.setVisible(true);
        this.cymaticsMesh.setVisible(false);
        this.sonicRibbon.setVisible(false);
        this.centralEmitter.group.visible = true;
        break;
      case 'cymatics':
        this.wavefrontShells.setVisible(false);
        this.particleNebula.setVisible(false);
        this.cymaticsMesh.setVisible(false);
        this.sonicRibbon.setVisible(false);
        this.centralEmitter.group.visible = false;
        this.volumetricChladni.setVisible(true);
        this.gpuAcousticParticles.setVisible(true);
        this.chamberEnclosure.setVisible(true);
        this.volumetricChladni.group.position.y = 0.45;
        this.gpuAcousticParticles.group.position.y = 0.45;
        this.chamberEnclosure.group.position.y = 0.45;
        break;
      case 'bio-acoustics':
        this.wavefrontShells.setVisible(false);
        this.particleNebula.setVisible(false);
        this.cymaticsMesh.setVisible(false);
        this.sonicRibbon.setVisible(false);
        this.centralEmitter.group.visible = false;
        this.bioAcousticResonator.setVisible(true);
        this.bioAcousticResonator.group.position.y = 0.45;
        break;
      case 'therapy-lab':
        this.wavefrontShells.setVisible(false);
        this.particleNebula.setVisible(false);
        this.cymaticsMesh.setVisible(false);
        this.sonicRibbon.setVisible(false);
        this.centralEmitter.group.visible = false;
        this.acousticTherapyLab.setVisible(true);
        this.acousticTherapyLab.group.position.y = 0.45;
        break;
      case 'voice-biometrics':
        this.wavefrontShells.setVisible(false);
        this.particleNebula.setVisible(false);
        this.cymaticsMesh.setVisible(false);
        this.sonicRibbon.setVisible(false);
        this.centralEmitter.group.visible = false;
        this.vocalBiometricsLab.setVisible(true);
        this.vocalBiometricsLab.group.position.y = 0.45;
        break;
      case 'nobel-lab':
        this.wavefrontShells.setVisible(false);
        this.particleNebula.setVisible(false);
        this.cymaticsMesh.setVisible(false);
        this.sonicRibbon.setVisible(false);
        this.centralEmitter.group.visible = false;
        this.nobelDiscoveryLab.setVisible(true);
        this.nobelDiscoveryLab.group.position.y = 0.45;
        break;
      case 'ribbon':
        this.wavefrontShells.setVisible(false);
        this.particleNebula.setVisible(false);
        this.cymaticsMesh.setVisible(false);
        this.sonicRibbon.setVisible(true);
        this.centralEmitter.group.visible = true;
        break;
      case 'hybrid':
      default:
        this.wavefrontShells.setVisible(true);
        this.particleNebula.setVisible(true);
        this.cymaticsMesh.setVisible(false);
        this.sonicRibbon.setVisible(false);
        this.centralEmitter.group.visible = true;
        break;
    }
  }

  public getStyle(): VisualStyle {
    return this.currentStyle;
  }

  public setPalette(paletteId: string): void {
    const pal = ColorPalettes.getPalette(paletteId);
    this.currentPalette = pal;
    this.wavefrontShells.setPalette(pal);
    this.cymaticsMesh.setPalette(pal);
    this.particleNebula.setPalette(pal);
    this.sonicRibbon.setPalette(pal);
    this.centralEmitter.setPalette(pal);
    this.volumetricChladni.setPalette(pal);
    this.gpuAcousticParticles.setPalette(pal);
    this.chamberEnclosure.setPalette(pal);
  }

  public setCameraMode(mode: CameraMode): void {
    this.cameraMode = mode;
    const isVolumetric = ['cymatics', 'bio-acoustics', 'therapy-lab', 'voice-biometrics', 'nobel-lab'].includes(this.currentStyle);
    const targetY = isVolumetric ? 0.45 : 0.0;

    if (mode === 'top-down') {
      this.camera.position.set(0, 15, 0.001);
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
    const historyHead = this.historyTexture.pushSpectralFrame(rawFft, bands.subBass, fundamentalHz);

    // Vector uniforms
    const vBands03 = new THREE.Vector4(bands.subBass, bands.bass, bands.lowMid, bands.mid);
    const vBands45 = new THREE.Vector2(bands.highMid, bands.high);
    const vShockwaves = shockwaves.map(sw => new THREE.Vector4(sw.birthTime, sw.strength, sw.speed, 0));

    // Update 3D visual components
    this.wavefrontShells.update(time, historyHead, vBands03, vBands45, vShockwaves);
    this.cymaticsMesh.update(time, vBands03, vBands45, fundamentalHz);
    this.particleNebula.update(time, historyHead, vBands03, vBands45, vShockwaves);
    const dt = this.lastAnimTime > 0 ? Math.min(0.1, time - this.lastAnimTime) : 0.016;
    this.lastAnimTime = time;

    this.sonicRibbon.update(time, historyHead, vBands03, vBands45);
    this.centralEmitter.update(time, bands.subBass, shockwaves.length > 0 ? shockwaves[0].strength : 0);
    this.volumetricChladni.update(time, vBands03, vBands45, fundamentalHz, this.camera);
    if (this.currentStyle === 'particles' || this.currentStyle === 'cymatics') {
      this.gpuAcousticParticles.update(time, dt, vBands03, vBands45, vShockwaves, fundamentalHz);
    }
    this.chamberEnclosure.update(time, dt, vBands03, vBands45, this.camera);
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

    // Camera handling
    if (this.cameraMode === 'autocam') {
      const isCymatics = this.currentStyle === 'cymatics';
      const isBio = this.currentStyle === 'bio-acoustics';
      const isTherapy = this.currentStyle === 'therapy-lab';
      const isVoice = this.currentStyle === 'voice-biometrics';
      const isNobel = this.currentStyle === 'nobel-lab';
      const isSorter = isBio && this.bioAcousticResonator.getViewMode() === 'microfluidic-sorter';
      const radius = isCymatics ? 9.6 : isSorter ? 12.5 : isTherapy ? 8.2 : isBio ? 6.8 : isVoice ? 7.6 : isNobel ? 7.8 : 9.5;
      const targetY = (isCymatics || isBio || isTherapy || isVoice || isNobel) ? 0.45 : 0.0;

      // 6-DOF Harmonic Lissajous Path Choreography
      const baseAngle = time * 0.10 * this.autoRotateSpeed;
      const lissX = Math.sin(baseAngle) * radius + Math.sin(time * 0.23) * 0.25;
      const lissZ = Math.cos(baseAngle) * radius + Math.cos(time * 0.19) * 0.25;
      const baseHeight = isCymatics ? 2.8 : isSorter ? 3.0 : isTherapy ? 2.2 : isBio ? 1.6 : isVoice ? 2.0 : isNobel ? 2.2 : 3.2;
      const lissY = baseHeight + Math.sin(time * 0.15) * 0.45 + Math.cos(time * 0.31) * 0.20;

      this.camera.position.set(
        lissX + this.recoilOffset.x,
        lissY + this.recoilOffset.y,
        lissZ + this.recoilOffset.z
      );
      this.camera.lookAt(0, targetY, 0);
      this.controls.target.set(0, targetY, 0);
    } else {
      this.controls.update();
    }

    // Direct high-performance rendering (crystal-clear 120 FPS shader glow)
    this.renderer.render(this.scene, this.camera);
  };
}
