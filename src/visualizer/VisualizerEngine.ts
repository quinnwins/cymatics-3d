import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

import { AudioEngine } from '../audio/AudioEngine';
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
import { ModalOscillatorBank } from '../math/ModalOscillatorBank';
import { ProvenanceBadge, ProvenanceType } from '../ui/ProvenanceBadge';
import type { FieldShapeType, SuperquadricParams } from './GpuAcousticParticles';
import { CustomMeshFieldSampler, ParsedCustomMesh } from './CustomMeshFieldSampler';

export type VisualStyle = 'cymatics' | 'cymatics-2d' | 'bio-acoustics' | 'therapy-lab' | 'voice-biometrics' | 'nobel-lab';
export type CameraMode = 'orbit' | 'autocam' | 'emitter-lock' | 'top-down';
export type EnginePhysicsMode = 'physical' | 'expressive' | 'hybrid';

export interface CymaticsLayerState {
  plate: boolean;   // 2D Sand Plate
  droplet: boolean; // 3D Fluid Droplet
  trap: boolean;    // 3D Particle Trap
}

export class VisualizerEngine {
  private container: HTMLElement;
  public renderer: THREE.WebGLRenderer;
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public controls: OrbitControls;
  private composer!: EffectComposer;
  private bloomPass!: UnrealBloomPass;

  // Components
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
  public modalOscillatorBank: ModalOscillatorBank;
  public provenanceBadge: ProvenanceBadge;
  public engineMode: EnginePhysicsMode = 'hybrid';

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
  public simTime = 0;

  // Physics & Visual Tuning
  public waveSpeed = 6.0;
  public waveDamping = 0.12;
  public bloomStrength = 0.22;
  public particleScale = 1.0;
  public particleDensity = 131072;
  public cymaticsVisibilityMode: 'both' | 'particles' | 'droplet' = 'both';
  public autoRotateSpeed = 0.5;
  public groundGridVisible = false;
  private isImmersive = false;

  // Zero-GC Pre-allocated Vectors for 120 FPS Render Loop
  private tempVBands03 = new THREE.Vector4();
  private tempVBands45 = new THREE.Vector2();
  private tempShockwaves: THREE.Vector4[] = [
    new THREE.Vector4(),
    new THREE.Vector4(),
    new THREE.Vector4(),
    new THREE.Vector4(),
  ];
  private tempViewDir = new THREE.Vector3();

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
    this.camera.position.set(0, 2.4, 9.2);

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

    // Modal Oscillator Bank & Provenance HUD
    this.modalOscillatorBank = new ModalOscillatorBank(32);
    this.provenanceBadge = new ProvenanceBadge({
      onModeSelect: (mode) => {
        this.setEngineMode(mode);
      },
      onOpenPhysicsDrawer: () => {
        window.dispatchEvent(new CustomEvent('soundform-open-physics-settings'));
      },
    });

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
    this.updateViewportOffset();

    if (typeof window !== 'undefined') {
      window.addEventListener('soundform-immersive-changed', ((e: CustomEvent<{ immersive: boolean }>) => {
        if (e.detail) {
          this.setImmersive(e.detail.immersive);
        }
      }) as EventListener);
    }

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
    const has3DShape = this.cymaticsLayers.droplet || this.cymaticsLayers.trap;

    if (this.cymaticsLayers.plate && has3DShape) {
      // When 2D plate is selected WITH the 3D shape, position the 2D board directly at the bottom base of the 3D shape
      if (this.cymaticsLayers.trap) {
        // 3D particle trap & chamber enclosure extend from y = 0.45 - 1.95 = -1.50 up to y = 2.40
        this.cymaticsPlateMesh.group.position.y = -1.50;
      } else {
        // 3D fluid droplet only (radius 1.15 centered at y = 0.45, bottom boundary at y = -0.70)
        this.cymaticsPlateMesh.group.position.y = -0.80;
      }
      this.cymaticsMesh.group.position.y = 0.45;
      this.gpuAcousticParticles.group.position.y = 0.45;
      this.chamberEnclosure.group.position.y = 0.45;
      this.volumetricChladni.group.position.y = 0.45;
      if (this.scientificGroundDatum) {
        this.scientificGroundDatum.mesh.position.y = this.cymaticsLayers.trap ? -1.94 : -1.24;
      }
    } else if (this.cymaticsLayers.plate) {
      // 2D plate standalone mode (no 3D shape)
      this.cymaticsPlateMesh.group.position.y = 0.0;
      this.cymaticsMesh.group.position.y = 0.45;
      this.gpuAcousticParticles.group.position.y = 0.45;
      this.chamberEnclosure.group.position.y = 0.45;
      this.volumetricChladni.group.position.y = 0.45;
      if (this.scientificGroundDatum) {
        this.scientificGroundDatum.mesh.position.y = 0.0;
      }
    } else {
      // 3D shape only (no 2D plate)
      this.cymaticsMesh.group.position.y = 0.45;
      this.gpuAcousticParticles.group.position.y = 0.45;
      this.chamberEnclosure.group.position.y = 0.45;
      this.volumetricChladni.group.position.y = 0.45;
      if (this.scientificGroundDatum) {
        this.scientificGroundDatum.mesh.position.y = 0.0;
      }
    }
  }

  public setChamberGeometry(geometry: 'cube' | 'cylinder' | 'sphere'): void {
    this.cymaticsMesh.setChamberType(geometry);
    this.cymaticsPlateMesh.setChamberType(geometry === 'cylinder' || geometry === 'sphere' ? 'circle' : 'square');
    this.volumetricChladni.setChamberType(geometry === 'cube' ? 0 : geometry === 'cylinder' ? 1 : 2);
    this.gpuAcousticParticles.setChamberGeometry(geometry);
    this.chamberEnclosure.setChamberType(geometry);
  }

  public setFieldMode(enabled: boolean, shape?: FieldShapeType, params?: Partial<SuperquadricParams>): void {
    this.gpuAcousticParticles.setFieldMode(enabled);
    this.volumetricChladni.setFieldMode(enabled);
    this.chamberEnclosure.setFieldMode(enabled);

    if (shape) {
      this.setFieldShape(shape, params);
    }
  }

  public getFieldMode(): boolean {
    return this.gpuAcousticParticles.getFieldMode();
  }

  public setFieldShape(shape: FieldShapeType, params?: Partial<SuperquadricParams>): void {
    this.gpuAcousticParticles.setFieldShape(shape, params);
    this.volumetricChladni.setFieldShape(shape, params);
    this.chamberEnclosure.setFieldShape(shape, params);
  }

  public getFieldShape(): FieldShapeType {
    return this.gpuAcousticParticles.getFieldShape();
  }

  public setFieldContourVisible(visible: boolean): void {
    this.chamberEnclosure.setContourVisible(visible);
  }

  public getFieldContourVisible(): boolean {
    return this.chamberEnclosure.getContourVisible();
  }

  public loadCustomMeshObj(objText: string, name?: string): ParsedCustomMesh {
    const parsed = CustomMeshFieldSampler.parseOBJ(objText, name);
    this.chamberEnclosure.setCustomMeshWireframe(parsed.wireframePositions);
    this.gpuAcousticParticles.setCustomMeshSamples(parsed.surfaceSamples);
    this.setFieldMode(true, 'custom');
    return parsed;
  }

  public loadCustomMeshPreset(preset: 'bunny' | 'teapot' | 'star'): ParsedCustomMesh {
    let parsed: ParsedCustomMesh;
    if (preset === 'bunny') {
      parsed = CustomMeshFieldSampler.getStanfordBunnyPreset();
    } else if (preset === 'teapot') {
      parsed = CustomMeshFieldSampler.getUtahTeapotPreset();
    } else {
      parsed = CustomMeshFieldSampler.getStellatedStarPreset();
    }
    this.chamberEnclosure.setCustomMeshWireframe(parsed.wireframePositions);
    this.gpuAcousticParticles.setCustomMeshSamples(parsed.surfaceSamples);
    this.setFieldMode(true, 'custom');
    return parsed;
  }

  public setWaveSpeed(speed: number): void {
    this.waveSpeed = speed;
    if (this.cymaticsPlateMesh) {
      this.cymaticsPlateMesh.setWaveSpeed(speed);
    }
  }

  public setWaveDamping(damping: number): void {
    this.waveDamping = damping;
    if (this.cymaticsPlateMesh) {
      this.cymaticsPlateMesh.setWaveDamping(damping);
    }
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
    if (this.scientificGroundDatum) {
      const has3DShape = this.cymaticsLayers.droplet || this.cymaticsLayers.trap;
      if (this.cymaticsLayers.plate && has3DShape) {
        this.scientificGroundDatum.mesh.position.y = this.cymaticsLayers.trap ? -1.94 : -1.24;
      } else {
        this.scientificGroundDatum.mesh.position.y = 0.0;
      }
    }
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
    this.updateViewportOffset();
    window.dispatchEvent(new CustomEvent('camera-mode-changed', { detail: { mode } }));
  }

  public getCameraMode(): CameraMode {
    return this.cameraMode;
  }

  public setEngineMode(mode: EnginePhysicsMode): void {
    this.engineMode = mode;
    if (mode === 'physical') {
      // 1. EXACT WAVE MATHEMATICS (Analytic):
      // Strict analytical wave equations, high physical damping, crisp optical focus, tight Gor'kov trapping
      this.setWaveDamping(0.24);
      this.setWaveSpeed(4.5);
      this.setBloomStrength(0.10);
      if (this.gpuAcousticParticles) {
        this.gpuAcousticParticles.setSimulationMode('dynamic');
        this.gpuAcousticParticles.setGorkovStrength(32.0);
        this.gpuAcousticParticles.setStokesDrag(2.5);
        this.gpuAcousticParticles.setBrownianMotion(0.02);
      }
      if (this.cymaticsMesh) {
        this.cymaticsMesh.setAcousticPressure(1.0);
      }
      this.provenanceBadge.setProvenance('ANALYTIC');
    } else if (mode === 'expressive') {
      // 2. EXPRESSIVE ART (Interpretive):
      // Low damping (lush ripples), fast speed, rich saturated glow without white blowout, energetic Rayleigh streaming swirls
      this.setWaveDamping(0.05);
      this.setWaveSpeed(7.2);
      this.setBloomStrength(0.26);
      if (this.gpuAcousticParticles) {
        this.gpuAcousticParticles.setSimulationMode('equilibrium');
        this.gpuAcousticParticles.setGorkovStrength(12.0);
        this.gpuAcousticParticles.setStokesDrag(0.8);
        this.gpuAcousticParticles.setBrownianMotion(0.40);
      }
      if (this.cymaticsMesh) {
        this.cymaticsMesh.setAcousticPressure(1.2);
      }
      this.provenanceBadge.setProvenance('INTERPRETIVE');
    } else {
      // 3. REAL-TIME BALANCED (Hybrid / Reduced-Order):
      // Organic acoustic trapping, smooth 60 FPS dynamics, balanced studio glow, natural fluid decay
      this.setWaveDamping(0.12);
      this.setWaveSpeed(6.0);
      this.setBloomStrength(0.20);
      if (this.gpuAcousticParticles) {
        this.gpuAcousticParticles.setSimulationMode('equilibrium');
        this.gpuAcousticParticles.setGorkovStrength(16.0);
        this.gpuAcousticParticles.setStokesDrag(1.2);
        this.gpuAcousticParticles.setBrownianMotion(0.20);
      }
      if (this.cymaticsMesh) {
        this.cymaticsMesh.setAcousticPressure(1.0);
      }
      this.provenanceBadge.setProvenance('REDUCED_ORDER');
    }
    window.dispatchEvent(new CustomEvent('optics-value-changed', { detail: { source: 'visualizer-engine' } }));
  }

  public getEngineMode(): EnginePhysicsMode {
    return this.engineMode;
  }

  public captureScreenshot(): string {
    this.composer.render();
    return this.renderer.domElement.toDataURL('image/png');
  }

  public setImmersive(enabled: boolean): void {
    this.isImmersive = enabled;
    this.updateViewportOffset();
  }

  public updateViewportOffset(): void {
    if (typeof window === 'undefined' || !this.camera || typeof this.camera.setViewOffset !== 'function') {
      return;
    }
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (!w || !h || w <= 0 || h <= 0) return;

    if (this.isImmersive) {
      if (typeof this.camera.clearViewOffset === 'function') {
        this.camera.clearViewOffset();
      }
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      return;
    }

    let offX = 0;
    // Calibrated optical vertical elevation compensation (accounts for UI asymmetry and 3D perspective pitch)
    let offY = 56;

    if (typeof document !== 'undefined') {
      const overlay = document.getElementById('center-viewport-overlay');
      if (overlay) {
        const rect = overlay.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          const apertureCenterX = rect.left + rect.width / 2;
          const apertureCenterY = rect.top + rect.height / 2;
          offX = (w / 2) - apertureCenterX;
          // Compensate for asymmetrical top/bottom UI bars and perspective pitch foreshortening to raise shape into space
          offY = (h / 2) - apertureCenterY + 48;
        }
      }
    }

    this.camera.setViewOffset(w, h, offX, offY, w, h);
  }

  private setupResizeListener(): void {
    this.resizeHandler = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      this.camera.aspect = w / h;
      this.updateViewportOffset();
      this.camera.updateProjectionMatrix();
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      this.renderer.setSize(w, h);
      this.composer?.setSize?.(w, h);
      this.volumetricChladni.resize(w, h);
    };
    window.addEventListener('resize', this.resizeHandler);
  }

  private animate = (): void => {
    requestAnimationFrame(this.animate);

    const time = this.clock.getElapsedTime();
    const rawDt = this.lastAnimTime > 0 ? Math.min(0.1, time - this.lastAnimTime) : 0.016;
    const dt = rawDt;
    this.lastAnimTime = time;

    const playbackSpeed = this.audioEngine ? this.audioEngine.getPlaybackSpeed() : 1.0;
    const simDt = rawDt * playbackSpeed;
    this.simTime += simDt;

    this.audioEngine?.update(this.simTime);

    // Physical modal oscillator bank driven by live time-domain PCM signal
    const pcmData = this.audioEngine ? this.audioEngine.getTimeDomainData() : new Float32Array(1024);
    this.modalOscillatorBank.update(simDt, pcmData);

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

    // Sync provenance badge to active visualizer style & physics mode
    if (this.currentStyle === 'cymatics' || this.currentStyle === 'cymatics-2d') {
      if (this.engineMode === 'physical') {
        this.provenanceBadge.setProvenance('ANALYTIC');
      } else if (this.engineMode === 'hybrid') {
        this.provenanceBadge.setProvenance('REDUCED_ORDER');
      } else {
        this.provenanceBadge.setProvenance('INTERPRETIVE');
      }
    } else {
      this.provenanceBadge.setProvenance('BENCHMARKED');
    }

    // Zero-GC Vector uniforms
    this.tempVBands03.set(bands.subBass, bands.bass, bands.lowMid, bands.mid);
    this.tempVBands45.set(bands.highMid, bands.high);
    const shockwaveCount = Math.min(shockwaves.length, 4);
    for (let i = 0; i < 4; i++) {
      if (i < shockwaveCount) {
        this.tempShockwaves[i].set(shockwaves[i].birthTime, shockwaves[i].strength, shockwaves[i].speed, 0);
      } else {
        this.tempShockwaves[i].set(0, 0, 0, 0);
      }
    }

    // Update 3D visual components
    if (this.groundGridVisible) {
      this.scientificGroundDatum.update(this.camera);
    }

    this.cymaticsMesh.update(this.simTime, this.tempVBands03, this.tempVBands45, fundamentalHz, simDt, this.camera);
    this.cymaticsPlateMesh.update(this.simTime, this.tempVBands03, this.tempVBands45, fundamentalHz, simDt, this.camera);
    this.volumetricChladni.update(this.simTime, this.tempVBands03, this.tempVBands45, fundamentalHz, this.camera);
    if (this.gpuAcousticParticles.isVisible()) {
      const activeModes = this.cymaticsMesh.getModes();
      this.gpuAcousticParticles.setModalNumbers(activeModes.x, activeModes.y, activeModes.z);
      this.gpuAcousticParticles.update(this.simTime, simDt, this.tempVBands03, this.tempVBands45, this.tempShockwaves, fundamentalHz);
    }
    if (this.chamberEnclosure.isVisible()) {
      this.chamberEnclosure.update(this.simTime, simDt, this.tempVBands03, this.tempVBands45, this.camera);
    }
    this.bioAcousticResonator.update(this.simTime, simDt, this.camera, this.tempVBands03);
    this.acousticTherapyLab.update(this.simTime, simDt, this.camera, this.tempVBands03);
    this.nobelDiscoveryLab.update(this.simTime, simDt, this.camera, this.tempVBands03);

    if (this.audioEngine.voiceBiometrics) {
      const voiceReport = this.audioEngine.voiceBiometrics.update();
      this.vocalBiometricsLab.update(simDt, this.simTime, this.camera, voiceReport);
    }

    // 6-DOF Harmonic Recoil Spring Dynamics (Triggered on Audio Shockwaves)
    if (shockwaves.length > 0 && shockwaves[0].birthTime > this.lastShockwaveBirth) {
      this.lastShockwaveBirth = shockwaves[0].birthTime;
      const kickMag = Math.min(0.35, shockwaves[0].strength * 0.08);
      // Push camera outward along viewing ray
      this.tempViewDir.subVectors(this.camera.position, this.controls.target).normalize();
      this.recoilVelocity.addScaledVector(this.tempViewDir, kickMag * 22.0);
    }

    // Exact Analytical Critically Damped Harmonic Return (zeta = 1.0, omega = 14 rad/s)
    const omega = 14.0;
    const expTerm = Math.exp(-omega * dt);

    const c1x = this.recoilOffset.x;
    const c2x = this.recoilVelocity.x + omega * c1x;
    const nx = (c1x + c2x * dt) * expTerm;
    const vx = (this.recoilVelocity.x - omega * c2x * dt) * expTerm;

    const c1y = this.recoilOffset.y;
    const c2y = this.recoilVelocity.y + omega * c1y;
    const ny = (c1y + c2y * dt) * expTerm;
    const vy = (this.recoilVelocity.y - omega * c2y * dt) * expTerm;

    const c1z = this.recoilOffset.z;
    const c2z = this.recoilVelocity.z + omega * c1z;
    const nz = (c1z + c2z * dt) * expTerm;
    const vz = (this.recoilVelocity.z - omega * c2z * dt) * expTerm;

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
      const radius = isCymatics ? 8.6 : isPlate ? 8.2 : isSorter ? 18.5 : isTherapy ? 8.2 : isBio ? 6.8 : isVoice ? 7.6 : isNobel ? 7.8 : 9.5;
      const targetY = isSorter ? 0.0 : (isCymatics || isPlate || isBio || isTherapy || isVoice || isNobel) ? 0.45 : 0.0;

      // Camera Choreography
      if (isSorter) {
        // Elevated 3/4 Isometric Perspective for Longitudinal Microfluidic Channel Clarity
        const baseAngle = 0.65 + Math.sin(time * 0.06 * this.autoRotateSpeed) * 0.18;
        const camX = Math.sin(baseAngle) * radius;
        const camZ = Math.cos(baseAngle) * radius;
        const camY = 8.5 + Math.sin(time * 0.12) * 0.35;
        this.camera.position.set(
          camX + this.recoilOffset.x,
          camY + this.recoilOffset.y,
          camZ + this.recoilOffset.z
        );
        this.camera.lookAt(0, targetY, 0);
        this.controls.target.set(0, targetY, 0);
      } else if (isVoice) {
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
        const baseHeight = isCymatics ? 2.2 : isPlate ? 3.4 : isTherapy ? 2.2 : isBio ? 1.6 : isNobel ? 2.2 : 3.2;
        const lissY = baseHeight + Math.sin(time * 0.15) * 0.30 + Math.cos(time * 0.31) * 0.15;

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
      this.provenanceBadge?.destroy?.();
      this.cymaticsMesh?.dispose();
      this.cymaticsPlateMesh?.dispose();
      this.volumetricChladni?.dispose();
      this.gpuAcousticParticles?.dispose();
      this.chamberEnclosure?.dispose();
      this.bioAcousticResonator?.dispose();
      this.acousticTherapyLab?.dispose();
      this.vocalBiometricsLab?.dispose();
      this.nobelDiscoveryLab?.dispose();
      this.renderer?.dispose();
      this.composer?.dispose();
    } catch (e) {
      console.warn('Error during visualizer engine disposal', e);
    }
  }
}
