import * as THREE from 'three';
import type { AudioEngine, AudioInputMode } from '../audio/AudioEngine';
import { DemoAudioGenerator } from '../audio/DemoAudioGenerator';
import { ColorPalettes } from './ColorPalettes';
import type { PalettePreset } from './ColorPalettes';
import {
  AnamnesisModel,
  MemoryRelicStore,
} from './AnamnesisModel';
import type {
  AnamnesisStats,
  MemoryObservation,
  MemoryPoint,
  MemoryRelic,
  MemorySessionMeta,
} from './AnamnesisModel';
import { AnamnesisField } from './AnamnesisField';
import {
  temporalMemory,
  TEMPORAL_MEMORY_EVENT,
} from './TemporalMemory';
import type { TemporalMemorySettings } from './TemporalMemory';

export const ANAMNESIS_TOGGLE_EVENT = 'soundform-anamnesis-toggle';
export const ANAMNESIS_STATE_EVENT = 'soundform-anamnesis-state';
export const ANAMNESIS_RETURN_EVENT = 'soundform-anamnesis-return';

export function canControlAnamnesisPlayback(
  mode: AudioInputMode,
  viewingRelic = false
): boolean {
  return mode !== 'microphone' && !viewingRelic;
}

interface RuntimeControls {
  target: THREE.Vector3;
  update(): void;
}

interface RuntimeVisibleObject {
  group: THREE.Group;
  setVisible(visible: boolean): void;
}

interface RuntimeCymaticsMesh extends RuntimeVisibleObject {
  temporalSculpture: RuntimeVisibleObject;
  setDropletVisible(visible: boolean): void;
}

interface RuntimeVisualizer {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: RuntimeControls;
  simTime?: number;
  cymaticsMesh: RuntimeCymaticsMesh;
  cymaticsPlateMesh: RuntimeVisibleObject;
  gpuAcousticParticles: RuntimeVisibleObject;
  chamberEnclosure: RuntimeVisibleObject & { isVisible?(): boolean; triggerRecognitionFlash?(intensity?: number): void };
  volumetricChladni: RuntimeVisibleObject;
  getStyle(): string;
  getCurrentPaletteId?(): string;
  getCameraMode(): string;
  setCameraMode(mode: 'orbit' | 'autocam' | 'emitter-lock' | 'top-down'): void;
  getCymaticsLayers(): { plate: boolean; droplet: boolean; trap: boolean };
  applyCymaticsLayers(): void;
}

interface RuntimeApp {
  visualizer: RuntimeVisualizer;
}

interface AnamnesisWindow extends Window {
  __soundformApp?: RuntimeApp;
  __audioEngine?: AudioEngine;
  __anamnesis?: AnamnesisExperience;
}

interface FocusSnapshot {
  cameraMode: string;
  cameraPosition: THREE.Vector3;
  controlsTarget: THREE.Vector3;
  chamberVisible: boolean;
  volumetricVisible: boolean;
  temporalSculptureVisible: boolean;
}

export interface AnamnesisState {
  enabled: boolean;
  expanded: boolean;
  contextVisible: boolean;
  viewingRelic: boolean;
  title: string;
  stats: AnamnesisStats;
}

let singleton: AnamnesisExperience | null = null;
let mountRequested = false;

function formatTime(seconds: number): string {
  const safe = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(safe / 60);
  const remainder = Math.floor(safe % 60);
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function strongestTransient(audio: AudioEngine, nowSeconds: number): number {
  let strongest = 0;
  for (const shockwave of audio.getActiveShockwaves()) {
    const age = Math.max(0, nowSeconds - shockwave.birthTime);
    if (age <= 0.35) strongest = Math.max(strongest, shockwave.strength * (1 - age / 0.35));
  }
  return Math.min(3, strongest);
}

/** Mount after App exposes its runtime. The feature stays a removable lens. */
export function mountAnamnesisExperience(): void {
  if (singleton || typeof window === 'undefined') return;
  const runtime = window as unknown as AnamnesisWindow;
  if (runtime.__anamnesis) {
    singleton = runtime.__anamnesis;
    return;
  }
  const visualizer = runtime.__soundformApp?.visualizer;
  const audio = runtime.__audioEngine;
  if (visualizer && audio && visualizer.scene && visualizer.renderer?.domElement) {
    const palette = ColorPalettes.getPalette(visualizer.getCurrentPaletteId?.() || 'cosmic-nebula');
    singleton = new AnamnesisExperience(audio, visualizer, palette);
    runtime.__anamnesis = singleton;
  }
}

/**
 * Whole-performance memory for SoundForm.
 *
 * Sonic Memory answers “where is the recent past?” Anamnesis asks “when has
 * this music been here before?” It creates a sparse self-similarity
 * constellation around the radial sculpture and draws luminous chords between
 * phrase-level returns.
 */
export class AnamnesisExperience {
  public readonly model = new AnamnesisModel();
  public readonly field: AnamnesisField;

  private readonly store = new MemoryRelicStore();
  private readonly visualizer: RuntimeVisualizer;
  private readonly audio: AudioEngine;
  private enabled = temporalMemory.getSettings().enabled;
  private expanded = false;
  private contextVisible = true;
  private sessionIdentity = '';
  private sessionElapsed = 0;
  private savedRelicId: string | null = null;
  private lastSavedFingerprint = '';
  private viewingRelic: MemoryRelic | null = null;
  private latestLivePoints: readonly MemoryPoint[] = [];
  private lastUiUpdate = -Infinity;
  private visualTime = 0;
  private temporaryMessage = '';
  private temporaryMessageUntil = 0;
  private hoveredIndex = -1;
  private disposed = false;
  private frameId: number | null = null;
  private sampleTimer: number | null = null;
  private lastFrameAt = 0;
  private lastSampleClock = 0;
  private focusSnapshot: FocusSnapshot | null = null;

  private root: HTMLElement | null = null;
  private whisper: HTMLElement | null = null;
  private tooltip: HTMLElement | null = null;
  private archivePanel: HTMLElement | null = null;

  private readonly toggleListener = (): void => this.toggleExpanded();
  private readonly keyListener = (event: KeyboardEvent): void => this.onKeyDown(event);
  private readonly pointerMoveListener = (event: PointerEvent): void => this.onPointerMove(event);
  private readonly pointerLeaveListener = (): void => this.clearHover();
  private readonly pointerClickListener = (event: PointerEvent): void => this.onPointerClick(event);
  private readonly pageHideListener = (): void => { this.saveRelic(false); };
  private readonly paletteListener = (event: Event): void => {
    const id = (event as CustomEvent<{ paletteId?: string }>).detail?.paletteId;
    if (id) this.field.setPalette(ColorPalettes.getPalette(id));
  };
  private readonly temporalMemoryListener = (event: Event): void => {
    const detail = (event as CustomEvent<TemporalMemorySettings>).detail;
    const isEnabled = typeof detail?.enabled === 'boolean'
      ? detail.enabled
      : temporalMemory.getSettings().enabled;
    this.setEnabled(isEnabled);
  };

  constructor(audio: AudioEngine, visualizer: RuntimeVisualizer, palette: PalettePreset) {
    singleton = this;
    if (typeof window !== 'undefined') {
      (window as unknown as AnamnesisWindow).__anamnesis = this;
    }
    this.audio = audio;
    this.visualizer = visualizer;
    this.field = new AnamnesisField(palette);
    this.field.setEnabled(this.enabled);
    this.visualizer.scene.add(this.field.group);
    this.mountUi();

    window.addEventListener(ANAMNESIS_TOGGLE_EVENT, this.toggleListener);
    window.addEventListener(TEMPORAL_MEMORY_EVENT, this.temporalMemoryListener);
    window.addEventListener('keydown', this.keyListener);
    window.addEventListener('pagehide', this.pageHideListener);
    window.addEventListener('palette-changed', this.paletteListener);
    this.visualizer.renderer.domElement.addEventListener('pointermove', this.pointerMoveListener);
    this.visualizer.renderer.domElement.addEventListener('pointerleave', this.pointerLeaveListener);
    this.visualizer.renderer.domElement.addEventListener('click', this.pointerClickListener);
    this.lastFrameAt = performance.now();
    this.lastSampleClock = this.lastFrameAt;
    // Analysis cadence must not collapse when the GPU is busy. The model owns
    // its 400 ms sampling interval; this lightweight clock simply gives it
    // regular opportunities independent of the render frame rate.
    this.sampleTimer = window.setInterval(this.captureAudio, 100);
    this.frameId = requestAnimationFrame(this.animate);
    this.emitState();
  }

  public ingestObservation(observation: MemoryObservation, visualTime = this.visualTime): void {
    if (!this.enabled) return;
    const result = this.model.ingest(observation);
    if (!result) return;
    this.latestLivePoints = this.model.getPoints();
    if (!this.viewingRelic) this.field.setData(this.model.getPoints(), this.model.getThreads());

    if (result.thread) {
      this.field.celebrateReturn(result.thread);
      this.visualizer.chamberEnclosure.triggerRecognitionFlash?.(1.0);
      const transposition = result.thread.transposition === 0
        ? ''
        : ` · ${result.thread.transposition > 0 ? '+' : ''}${result.thread.transposition} semitones`;
      this.temporaryMessage = `IT HAS BEEN HERE BEFORE · ${formatTime(result.stats.lastReturn?.fromSeconds || 0)} ↔ ${formatTime(result.stats.lastReturn?.toSeconds || 0)}${transposition}`;
      this.temporaryMessageUntil = visualTime + 6;
      window.dispatchEvent(new CustomEvent(ANAMNESIS_RETURN_EVENT, {
        detail: { thread: result.thread, stats: result.stats },
      }));
    }
    this.emitState();
  }

  public beginSession(meta: MemorySessionMeta): void {
    if (this.sessionIdentity && this.model.getStats().moments >= 16) this.saveRelic(false);
    this.sessionIdentity = meta.identity;
    this.sessionElapsed = 0;
    this.savedRelicId = null;
    this.lastSavedFingerprint = '';
    this.viewingRelic = null;
    this.model.reset(meta);
    this.latestLivePoints = [];
    this.field.setData([], []);
    this.temporaryMessage = 'LISTEN UNTIL THE MUSIC RECOGNIZES ITSELF';
    this.temporaryMessageUntil = this.visualTime + 4;
    this.emitState();
  }

  public setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    if (!enabled) {
      this.field.setEnabled(false);
      if (this.expanded) this.setExpanded(false);
      this.temporaryMessage = '';
      this.temporaryMessageUntil = 0;
      if (this.whisper) {
        this.whisper.textContent = '';
        this.whisper.classList.remove('is-visible');
      }
      this.clearHover();
    }
    this.emitState();
  }

  public toggleExpanded(): void {
    if (!this.contextVisible || !this.isMemorySource(this.audio.getMode())) return;
    if (!this.enabled && !this.expanded) {
      temporalMemory.setEnabled(true);
    }
    this.setExpanded(!this.expanded);
  }

  public setExpanded(expanded: boolean): void {
    if (this.expanded === expanded) return;
    this.expanded = expanded;
    this.field.setExpanded(expanded);
    this.setFocus(expanded);
    document.body.classList.toggle('soundform-anamnesis', expanded);
    if (!expanded) {
      this.clearHover();
      if (this.archivePanel) this.archivePanel.hidden = true;
    }
    this.renderUi(this.visualTime);
    this.emitState();
  }

  public getState(): AnamnesisState {
    return {
      enabled: this.enabled,
      expanded: this.expanded,
      contextVisible: this.contextVisible,
      viewingRelic: Boolean(this.viewingRelic),
      title: this.viewingRelic?.meta.title || this.model.getMeta().title,
      stats: this.viewingRelic?.stats || this.model.getStats(),
    };
  }

  public saveRelic(showMessage = true): MemoryRelic | null {
    if (this.viewingRelic) return this.viewingRelic;
    if (this.model.getStats().moments < 8) {
      if (showMessage) this.showTemporaryMessage('THE RELIC NEEDS A FEW MORE MOMENTS', 2.5);
      return null;
    }
    const fingerprint = this.getRelicFingerprint();
    if (fingerprint === this.lastSavedFingerprint) {
      if (showMessage) this.showTemporaryMessage('THIS RELIC IS ALREADY KEPT', 2.5);
      return this.savedRelicId
        ? this.store.list().find(item => item.id === this.savedRelicId) || null
        : null;
    }

    const relic = this.model.toRelic();
    // One live listening session owns one relic. Later autosaves update that
    // relic as the performance grows instead of flooding the twelve-slot
    // archive with timestamp variants of the same memory.
    if (this.savedRelicId) relic.id = this.savedRelicId;
    this.store.save(relic);
    this.savedRelicId = relic.id;
    this.lastSavedFingerprint = fingerprint;
    if (showMessage) this.showTemporaryMessage('THIS MEMORY NOW LIVES HERE', 3.5);
    this.renderArchive();
    return relic;
  }

  public viewRelic(id: string): boolean {
    const relic = this.store.list().find(item => item.id === id);
    if (!relic) return false;
    if (!this.enabled) {
      temporalMemory.setEnabled(true);
    }
    this.viewingRelic = relic;
    this.field.setRelic(relic);
    if (!this.expanded) this.setExpanded(true);
    this.showTemporaryMessage('A PAST PERFORMANCE HAS RETURNED', 3.5);
    this.renderUi(this.visualTime);
    this.emitState();
    return true;
  }

  public returnToLive(): void {
    if (!this.viewingRelic) return;
    this.viewingRelic = null;
    this.field.setData(this.model.getPoints(), this.model.getThreads());
    this.showTemporaryMessage('LIVE MEMORY RESTORED', 2.5);
    this.emitState();
  }

  public clearLiveMemory(): void {
    const meta = this.model.getMeta();
    this.model.reset(meta);
    this.savedRelicId = null;
    this.lastSavedFingerprint = '';
    this.latestLivePoints = [];
    this.viewingRelic = null;
    this.field.setData([], []);
    this.showTemporaryMessage('THE FIELD IS EMPTY AGAIN', 2.5);
    this.emitState();
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.saveRelic(false);
    if (this.frameId !== null) cancelAnimationFrame(this.frameId);
    if (this.sampleTimer !== null) window.clearInterval(this.sampleTimer);
    this.setFocus(false);
    this.visualizer.scene.remove(this.field.group);
    this.field.dispose();
    window.removeEventListener(ANAMNESIS_TOGGLE_EVENT, this.toggleListener);
    window.removeEventListener(TEMPORAL_MEMORY_EVENT, this.temporalMemoryListener);
    window.removeEventListener('keydown', this.keyListener);
    window.removeEventListener('pagehide', this.pageHideListener);
    window.removeEventListener('palette-changed', this.paletteListener);
    this.visualizer.renderer.domElement.removeEventListener('pointermove', this.pointerMoveListener);
    this.visualizer.renderer.domElement.removeEventListener('pointerleave', this.pointerLeaveListener);
    this.visualizer.renderer.domElement.removeEventListener('click', this.pointerClickListener);
    this.root?.remove();
    this.whisper?.remove();
    this.tooltip?.remove();
    document.getElementById('anamnesis-styles')?.remove();
    singleton = null;
    mountRequested = false;
  }

  private readonly captureAudio = (): void => {
    if (this.disposed) return;

    const nowMs = performance.now();
    const elapsedSeconds = Math.max(0, (nowMs - this.lastSampleClock) / 1000);
    this.lastSampleClock = nowMs;

    const style = this.visualizer.getStyle();
    const mode = this.audio.getMode();
    const contextVisible = style === 'cymatics' || style === 'cymatics-2d';
    if (!this.enabled || !contextVisible || !this.isMemorySource(mode)) return;

    const meta = this.resolveSessionMeta(mode);
    if (meta.identity !== this.sessionIdentity) this.beginSession(meta);
    if (!this.audio.getIsPlaying() || this.viewingRelic) return;

    const playbackTime = this.getPlaybackTime(mode, elapsedSeconds);
    this.ingestObservation({
      timeSeconds: playbackTime,
      durationSeconds: meta.durationSeconds,
      sampleRate: this.getSampleRate(),
      spectrum: this.audio.getRawFrequencyData(),
      bands: this.audio.getAudioBands(),
      fundamentalHz: this.audio.getFundamentalFrequency(),
      transient: strongestTransient(this.audio, this.visualTime),
    });
  };

  private readonly animate = (nowMs: number): void => {
    if (this.disposed) return;
    const dt = Math.min(0.1, Math.max(0, (nowMs - this.lastFrameAt) / 1000));
    this.lastFrameAt = nowMs;
    this.visualTime = Number(this.visualizer.simTime) || nowMs / 1000;

    const style = this.visualizer.getStyle();
    this.contextVisible = style === 'cymatics' || style === 'cymatics-2d';
    const mode = this.audio.getMode();
    const memorySource = this.isMemorySource(mode);
    const shouldShow = this.enabled && this.contextVisible && memorySource;
    this.field.setEnabled(shouldShow);
    this.field.update(this.visualTime, dt, window.innerHeight);

    if (!shouldShow && this.expanded) this.setExpanded(false);

    if (this.visualTime - this.lastUiUpdate > 0.2) {
      this.lastUiUpdate = this.visualTime;
      this.renderUi(this.visualTime);
    }
    this.frameId = requestAnimationFrame(this.animate);
  };

  private setFocus(expanded: boolean): void {
    if (expanded) {
      if (this.focusSnapshot) return;
      this.focusSnapshot = {
        cameraMode: this.visualizer.getCameraMode(),
        cameraPosition: this.visualizer.camera.position.clone(),
        controlsTarget: this.visualizer.controls.target.clone(),
        chamberVisible: this.visualizer.chamberEnclosure.isVisible?.()
          ?? this.visualizer.chamberEnclosure.group.visible,
        volumetricVisible: this.visualizer.volumetricChladni.group.visible,
        temporalSculptureVisible: this.visualizer.cymaticsMesh.temporalSculpture.group.visible,
      };
      this.visualizer.setCameraMode('orbit');
      this.visualizer.cymaticsPlateMesh.setVisible(false);
      this.visualizer.cymaticsMesh.setDropletVisible(true);
      this.visualizer.cymaticsMesh.temporalSculpture.setVisible(false);
      this.visualizer.gpuAcousticParticles.setVisible(false);
      this.visualizer.chamberEnclosure.setVisible(false);
      this.visualizer.volumetricChladni.setVisible(false);
      this.visualizer.camera.position.set(0, 3.8, 12.6);
      this.visualizer.controls.target.set(0, 0.45, 0);
      this.visualizer.controls.update();
      return;
    }

    const snapshot = this.focusSnapshot;
    if (!snapshot) return;
    this.focusSnapshot = null;
    this.visualizer.applyCymaticsLayers();
    this.visualizer.cymaticsMesh.temporalSculpture.setVisible(snapshot.temporalSculptureVisible);
    this.visualizer.chamberEnclosure.setVisible(snapshot.chamberVisible);
    this.visualizer.volumetricChladni.setVisible(snapshot.volumetricVisible);
    this.visualizer.camera.position.copy(snapshot.cameraPosition);
    this.visualizer.controls.target.copy(snapshot.controlsTarget);
    this.visualizer.setCameraMode(
      snapshot.cameraMode === 'autocam'
        || snapshot.cameraMode === 'emitter-lock'
        || snapshot.cameraMode === 'top-down'
        ? snapshot.cameraMode
        : 'orbit'
    );
    this.visualizer.controls.update();
  }

  private isMemorySource(mode: AudioInputMode): boolean {
    return mode === 'demo-track'
      || mode === 'file-upload'
      || mode === 'apple-music'
      || mode === 'spotify'
      || mode === 'microphone';
  }

  private resolveSessionMeta(mode: AudioInputMode): MemorySessionMeta {
    if (mode === 'demo-track') {
      const id = this.audio.getActiveTrackId();
      const track = DemoAudioGenerator.TRACKS.find(item => item.id === id);
      return {
        identity: `demo:${id}`,
        title: track?.name || id,
        artist: 'SoundForm procedural instrument',
        source: 'demo-track',
      };
    }
    if (mode === 'file-upload') {
      const title = this.audio.getLoadedFileName() || 'Local audio';
      return {
        identity: `file:${title}:${Math.round(this.audio.getDuration() * 10)}`,
        title,
        source: 'file-upload',
        durationSeconds: this.audio.getDuration(),
      };
    }
    if (mode === 'apple-music' || mode === 'spotify') {
      const track = this.audio.getActiveStreamingTrack();
      return {
        identity: `${mode}:${track?.id || track?.title || 'unresolved'}`,
        title: track?.title || 'Streaming preview',
        artist: track?.artist,
        source: mode,
        durationSeconds: this.audio.getDuration(),
        artworkUrl: track?.artworkUrl,
      };
    }
    if (mode === 'microphone') {
      const existing = this.sessionIdentity.startsWith('microphone:')
        ? this.sessionIdentity
        : `microphone:${Date.now().toString(36)}`;
      return {
        identity: existing,
        title: 'Live room',
        artist: 'A moment that existed once',
        source: 'microphone',
      };
    }
    return { identity: `idle:${mode}`, title: 'Untitled performance', source: mode };
  }

  private getPlaybackTime(mode: AudioInputMode, dt: number): number {
    if (mode === 'file-upload' || mode === 'apple-music' || mode === 'spotify') {
      return this.audio.getCurrentTime();
    }
    this.sessionElapsed += Math.max(0, dt) * this.audio.getPlaybackSpeed();
    return this.sessionElapsed;
  }

  private getSampleRate(): number {
    const runtimeAudio = this.audio as unknown as { ctx?: AudioContext };
    return runtimeAudio.ctx?.sampleRate || 48_000;
  }

  private mountUi(): void {
    const style = document.createElement('style');
    style.id = 'anamnesis-styles';
    style.textContent = `
      #anamnesis-hud{position:fixed;z-index:92;inset:0 0 88px 0;display:none;align-items:flex-start;justify-content:center;padding:clamp(16px,3vh,40px) 24px 8px;pointer-events:none;opacity:0;transition:opacity .45s ease;color:#f8fafc;font-family:Inter,system-ui,sans-serif}
      body.soundform-anamnesis #anamnesis-hud{display:flex;opacity:1}#anamnesis-hud *{box-sizing:border-box}
      #anamnesis-hud .ana-card{width:min(620px,calc(100vw - 32px));text-align:center;pointer-events:none;text-shadow:0 2px 18px #000;background:radial-gradient(ellipse at 50% 0%,#0a1223b8 0%,#03071180 52%,transparent 76%);padding:22px 26px 28px;border-radius:28px}
      body.soundform-anamnesis #anamnesis-hud .ana-card{pointer-events:auto}
      #anamnesis-hud .ana-kicker{font:700 9px/1 ui-monospace,SFMono-Regular,monospace;letter-spacing:.38em;color:#67e8f9;margin-bottom:10px}
      #anamnesis-hud h1{font:500 clamp(24px,4vw,44px)/1.02 Georgia,'Times New Roman',serif;letter-spacing:.02em;margin:0;color:#fff}
      #anamnesis-hud .ana-track{margin-top:10px;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#cbd5e1}
      #anamnesis-hud .ana-artist{margin-top:4px;font-size:10px;color:#64748b}
      #anamnesis-hud .ana-thought{min-height:23px;margin:17px auto 9px;font:600 10px/1.5 ui-monospace,SFMono-Regular,monospace;letter-spacing:.12em;color:#a5f3fc}
      #anamnesis-hud .ana-stats{display:flex;justify-content:center;gap:20px;color:#94a3b8;font:9px ui-monospace,SFMono-Regular,monospace;text-transform:uppercase;letter-spacing:.09em}
      #anamnesis-hud .ana-actions{display:flex;justify-content:center;flex-wrap:wrap;gap:8px;margin-top:16px}
      #anamnesis-hud button{border:1px solid #94a3b82e;background:#050a14b8;color:#cbd5e1;border-radius:999px;padding:9px 13px;font:700 8px ui-monospace,SFMono-Regular,monospace;letter-spacing:.12em;cursor:pointer;backdrop-filter:blur(14px)}
      #anamnesis-hud button:hover{border-color:#67e8f977;color:#fff;background:#0e1b2fcb}#anamnesis-hud button[data-primary]{border-color:#67e8f955;color:#cffafe}#anamnesis-hud button:disabled{opacity:.42;cursor:default;border-color:#94a3b81f;color:#64748b;background:#03071188}
      #anamnesis-hud .ana-archive{margin:18px auto 0;width:min(520px,100%);max-height:40vh;overflow:auto;border:1px solid #94a3b821;border-radius:18px;background:#030711dc;padding:8px;text-align:left}
      #anamnesis-hud .ana-relic{display:grid;grid-template-columns:1fr auto;gap:8px;padding:10px;border-radius:12px}.ana-relic+.ana-relic{border-top:1px solid #94a3b817}.ana-relic strong{display:block;font-size:10px}.ana-relic small{display:block;margin-top:3px;color:#64748b;font:8px ui-monospace}.ana-relic nav{display:flex;gap:5px;align-items:center}.ana-relic button{padding:7px 9px}
      #anamnesis-whisper{position:fixed;z-index:90;top:clamp(70px,12vh,130px);left:50%;transform:translate(-50%,-12px);opacity:0;pointer-events:none;color:#e0f2fe;text-align:center;font:700 9px/1.5 ui-monospace,SFMono-Regular,monospace;letter-spacing:.18em;text-shadow:0 2px 18px #000,0 0 28px #22d3ee88;transition:opacity .6s ease,transform .6s ease;max-width:calc(100vw - 40px)}
      #anamnesis-whisper.is-visible{opacity:1;transform:translate(-50%,0)}
      #anamnesis-tooltip{position:fixed;z-index:94;display:none;pointer-events:none;min-width:112px;padding:8px 10px;border:1px solid #67e8f944;border-radius:12px;background:#020711e8;color:#e0f2fe;font:8px/1.45 ui-monospace,SFMono-Regular,monospace;letter-spacing:.07em;box-shadow:0 12px 38px #000b;backdrop-filter:blur(12px)}
      body.soundform-anamnesis #header-root,body.soundform-anamnesis #left-sidebar-root,body.soundform-anamnesis #right-sidebar-root,body.soundform-anamnesis #center-prompt-root{opacity:0!important;pointer-events:none!important;transition:opacity .35s ease!important}
      body.soundform-anamnesis #bottom-transport-root{opacity:1!important;pointer-events:auto!important;z-index:95!important}
      @media(max-width:700px){#anamnesis-hud{padding-top:24px}#anamnesis-hud .ana-card{padding:16px 12px 18px}#anamnesis-hud .ana-stats{gap:10px;font-size:8px}#anamnesis-hud .ana-thought{font-size:8px}}
      @media(prefers-reduced-motion:reduce){#anamnesis-hud,#anamnesis-whisper{transition:none}}
    `;
    document.head.appendChild(style);

    this.root = document.createElement('div');
    this.root.id = 'anamnesis-hud';
    this.root.innerHTML = `
      <section class="ana-card" aria-label="Anamnesis whole-song memory">
        <div class="ana-kicker">ANAMNESIS</div>
        <h1>THE SONG REMEMBERS</h1>
        <div class="ana-track" data-title>Untitled performance</div>
        <div class="ana-artist" data-artist></div>
        <div class="ana-thought" data-thought>LISTEN UNTIL THE MUSIC RECOGNIZES ITSELF</div>
        <div class="ana-stats"><span data-moments>0 moments</span><span data-echoes>0 returns</span><span data-families>0 families</span></div>
        <div class="ana-actions">
          <button data-action="play">PAUSE</button>
          <button data-primary data-action="save">KEEP THIS RELIC</button>
          <button data-action="capture">CAPTURE</button>
          <button data-action="archive">RELICS</button>
          <button data-action="clear">CLEAR</button>
          <button data-action="live" hidden>RETURN TO LIVE</button>
          <button data-action="close">RETURN</button>
        </div>
        <section class="ana-archive" data-archive hidden></section>
      </section>
    `;
    document.body.appendChild(this.root);
    this.archivePanel = this.root.querySelector<HTMLElement>('[data-archive]');

    this.whisper = document.createElement('div');
    this.whisper.id = 'anamnesis-whisper';
    document.body.appendChild(this.whisper);
    this.tooltip = document.createElement('div');
    this.tooltip.id = 'anamnesis-tooltip';
    document.body.appendChild(this.tooltip);

    this.root.querySelector<HTMLButtonElement>('[data-action="close"]')!.onclick = () => this.setExpanded(false);
    this.root.querySelector<HTMLButtonElement>('[data-action="play"]')!.onclick = () => {
      const mode = this.audio.getMode();
      if (!canControlAnamnesisPlayback(mode, Boolean(this.viewingRelic))) {
        this.showTemporaryMessage(
          mode === 'microphone' ? 'MICROPHONE REMAINS LIVE' : 'RETURN TO LIVE TO CONTROL PLAYBACK',
          2.5
        );
        return;
      }
      this.audio.togglePlayPause();
      this.renderUi(this.visualTime);
    };
    this.root.querySelector<HTMLButtonElement>('[data-action="save"]')!.onclick = () => this.saveRelic(true);
    this.root.querySelector<HTMLButtonElement>('[data-action="capture"]')!.onclick = () => {
      try {
        const link = document.createElement('a');
        link.download = `soundform-anamnesis-${Date.now()}.png`;
        link.href = this.visualizer.renderer.domElement.toDataURL('image/png');
        link.click();
        this.showTemporaryMessage('THE MEMORY BECAME AN IMAGE', 2.8);
      } catch (error) {
        console.warn('Anamnesis capture failed', error);
      }
    };
    this.root.querySelector<HTMLButtonElement>('[data-action="archive"]')!.onclick = () => {
      if (!this.archivePanel) return;
      this.renderArchive();
      this.archivePanel.hidden = !this.archivePanel.hidden;
    };
    this.root.querySelector<HTMLButtonElement>('[data-action="clear"]')!.onclick = () => this.clearLiveMemory();
    this.root.querySelector<HTMLButtonElement>('[data-action="live"]')!.onclick = () => this.returnToLive();
    this.archivePanel!.onclick = event => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-relic-id]');
      if (!button) return;
      const id = button.dataset.relicId || '';
      if (button.dataset.action === 'view-relic') this.viewRelic(id);
      if (button.dataset.action === 'delete-relic') {
        this.store.remove(id);
        if (this.viewingRelic?.id === id) this.returnToLive();
        this.renderArchive();
      }
    };
  }

  private renderUi(time: number): void {
    if (!this.root) return;
    const meta = this.viewingRelic?.meta || this.model.getMeta();
    const stats = this.viewingRelic?.stats || this.model.getStats();
    this.root.querySelector<HTMLElement>('[data-title]')!.textContent = meta.title;
    this.root.querySelector<HTMLElement>('[data-artist]')!.textContent = meta.artist || meta.source;
    this.root.querySelector<HTMLElement>('[data-moments]')!.textContent = `${stats.moments} moments`;
    this.root.querySelector<HTMLElement>('[data-echoes]')!.textContent = `${stats.echoes} returns`;
    this.root.querySelector<HTMLElement>('[data-families]')!.textContent = `${stats.families} families`;
    const playButton = this.root.querySelector<HTMLButtonElement>('[data-action="play"]')!;
    const mode = this.audio.getMode();
    const playbackControllable = canControlAnamnesisPlayback(mode, Boolean(this.viewingRelic));
    playButton.disabled = !playbackControllable;
    playButton.textContent = mode === 'microphone'
      ? 'LIVE INPUT'
      : this.viewingRelic
        ? 'RELIC VIEW'
        : this.audio.getIsPlaying() ? 'PAUSE' : 'RESUME';
    this.root.querySelector<HTMLButtonElement>('[data-action="live"]')!.hidden = !this.viewingRelic;

    let thought = 'LISTEN UNTIL THE MUSIC RECOGNIZES ITSELF';
    if (this.viewingRelic) thought = `RELIC KEPT ${new Date(this.viewingRelic.createdAt).toLocaleDateString()}`;
    else if (this.temporaryMessage && time < this.temporaryMessageUntil) thought = this.temporaryMessage;
    else if (stats.lastReturn) {
      const transpose = stats.lastReturn.transposition === 0
        ? ''
        : ` · ${stats.lastReturn.transposition > 0 ? '+' : ''}${stats.lastReturn.transposition} semitones`;
      thought = `${formatTime(stats.lastReturn.fromSeconds)} RETURNED AT ${formatTime(stats.lastReturn.toSeconds)}${transpose}`;
    } else if (stats.moments > 0) thought = 'THE PERFORMANCE IS LEARNING ITS OWN SHAPE';
    this.root.querySelector<HTMLElement>('[data-thought]')!.textContent = thought;

    if (this.whisper) {
      this.whisper.textContent = '';
      this.whisper.classList.remove('is-visible');
    }
  }

  private renderArchive(): void {
    if (!this.archivePanel) return;
    const relics = this.store.list();
    this.archivePanel.innerHTML = relics.length === 0
      ? '<div class="ana-relic"><div><strong>NO RELICS YET</strong><small>A saved performance will live here.</small></div></div>'
      : relics.map(relic => `
        <article class="ana-relic">
          <div><strong>${escapeHtml(relic.meta.title)}</strong><small>${new Date(relic.createdAt).toLocaleDateString()} · ${relic.stats.moments} moments · ${relic.stats.echoes} returns</small></div>
          <nav><button data-action="view-relic" data-relic-id="${escapeHtml(relic.id)}">VIEW</button><button data-action="delete-relic" data-relic-id="${escapeHtml(relic.id)}">×</button></nav>
        </article>
      `).join('');
  }

  private onKeyDown(event: KeyboardEvent): void {
    const target = event.target;
    if (target instanceof HTMLElement) {
      const tag = target.tagName.toLowerCase();
      if (target.isContentEditable || tag === 'input' || tag === 'textarea' || tag === 'select') return;
    }
    const key = event.key.toLowerCase();
    if ((key === 'a' || key === 'm') && this.contextVisible) {
      event.preventDefault();
      this.toggleExpanded();
    } else if (event.key === 'Escape' && this.expanded) {
      event.preventDefault();
      this.setExpanded(false);
    }
  }

  private onPointerMove(event: PointerEvent): void {
    if (!this.expanded) return;
    const canvas = this.visualizer.renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((event.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1,
      -((event.clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1
    );
    const index = this.field.pick(ndc, this.visualizer.camera);
    if (index === this.hoveredIndex) return;
    this.hoveredIndex = index;
    this.field.setHoverIndex(index);
    const point = this.activePoints()[index];
    if (!this.tooltip || !point) {
      if (this.tooltip) this.tooltip.style.display = 'none';
      canvas.style.cursor = '';
      return;
    }
    const meaning = point.echoStrength > 0.01
      ? `RETURN · ${Math.round(point.echoStrength * 100)}% kinship`
      : point.novelty > 0.58
        ? 'THRESHOLD · THE SONG CHANGED'
        : 'MEMORY MOMENT';
    this.tooltip.textContent = `${formatTime(point.timeSeconds)}\n${meaning}${this.audio.isSeekable() && !this.viewingRelic ? '\nCLICK TO RETURN' : ''}`;
    this.tooltip.style.whiteSpace = 'pre-line';
    this.tooltip.style.left = `${Math.min(window.innerWidth - 150, event.clientX + 14)}px`;
    this.tooltip.style.top = `${Math.min(window.innerHeight - 74, event.clientY + 14)}px`;
    this.tooltip.style.display = 'block';
    canvas.style.cursor = this.audio.isSeekable() && !this.viewingRelic ? 'pointer' : 'crosshair';
  }

  private onPointerClick(event: PointerEvent): void {
    if (!this.expanded || this.hoveredIndex < 0 || this.viewingRelic || !this.audio.isSeekable()) return;
    const point = this.activePoints()[this.hoveredIndex];
    if (!point) return;
    this.audio.seek(point.timeSeconds);
    this.showTemporaryMessage(`RETURNED TO ${formatTime(point.timeSeconds)}`, 2.6);
    event.preventDefault();
  }

  private clearHover(): void {
    this.hoveredIndex = -1;
    this.field.setHoverIndex(-1);
    if (this.tooltip) this.tooltip.style.display = 'none';
    this.visualizer.renderer.domElement.style.cursor = '';
  }

  private activePoints(): readonly MemoryPoint[] {
    return this.viewingRelic?.points || this.latestLivePoints;
  }

  private getRelicFingerprint(): string {
    const points = this.model.getPoints();
    const stats = this.model.getStats();
    const last = points[points.length - 1];
    return [
      this.sessionIdentity,
      stats.moments,
      stats.echoes,
      last?.id ?? -1,
      (last?.timeSeconds ?? 0).toFixed(3),
    ].join('|');
  }

  private showTemporaryMessage(message: string, seconds: number): void {
    this.temporaryMessage = message;
    this.temporaryMessageUntil = this.visualTime + seconds;
    this.renderUi(this.visualTime);
  }

  private emitState(): void {
    window.dispatchEvent(new CustomEvent(ANAMNESIS_STATE_EVENT, { detail: this.getState() }));
  }
}
