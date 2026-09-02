import * as THREE from 'three';
import type {
  EchoThread,
  MemoryPoint,
  MemoryRelic,
} from './AnamnesisModel';
import type { PalettePreset } from './ColorPalettes';

const MAX_POINTS = 1152;
const MAX_THREADS = 1400;

const POINT_VERTEX_SHADER = `
precision highp float;

#define TAU 6.2831853071795864769252867665590

uniform float uTime;
uniform float uOpacity;
uniform float uPointScale;
uniform float uLayer;
uniform float uCurrentIndex;
uniform float uHoverIndex;
uniform float uReturnFamily;
uniform float uReturnPulse;
uniform vec3 uPaletteA;
uniform vec3 uPaletteB;
uniform vec3 uPaletteC;
uniform vec3 uPaletteD;
uniform vec3 uCoreGlow;
uniform vec3 uAccent;

attribute float aIndex;
attribute float aEnergy;
attribute float aNovelty;
attribute float aPitch;
attribute float aProgress;
attribute float aFamily;
attribute float aEcho;

varying vec3 vColor;
varying float vAlpha;
varying float vCore;

vec3 palette(float t) {
  return uPaletteA + uPaletteB * cos(TAU * (uPaletteC * t + uPaletteD));
}

void main() {
  vec3 p = position;
  float familyPulse = aFamily >= 0.0 && abs(aFamily - uReturnFamily) < 0.5
    ? uReturnPulse
    : 0.0;
  float current = 1.0 - step(0.5, abs(aIndex - uCurrentIndex));
  float hovered = 1.0 - step(0.5, abs(aIndex - uHoverIndex));

  // A returning phrase does not teleport the path. Its related moments breathe
  // toward one another, making musical recollection visible as attraction.
  float breath = sin(uTime * 1.7 + aProgress * 28.0 + aPitch * 0.31) * 0.025;
  p *= 1.0 + breath * (0.2 + aEnergy) + familyPulse * 0.025;

  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  float perspective = clamp(22.0 / max(2.0, -mvPosition.z), 0.55, 3.0);
  float pointSize = 1.65
    + aEnergy * 3.1
    + aNovelty * 4.8
    + aEcho * 3.5
    + familyPulse * 3.0
    + current * 6.4
    + hovered * 7.2;
  float layerScale = mix(1.0, 2.35, uLayer);
  gl_PointSize = clamp(
    pointSize * perspective * uPointScale * layerScale,
    mix(1.6, 4.2, uLayer),
    mix(18.0, 38.0, uLayer)
  );

  vec3 chronology = palette(fract(aProgress * 0.83 + aPitch / 18.0));
  vec3 familyColor = palette(fract(aFamily * 0.137 + 0.18));
  vec3 color = mix(chronology, familyColor, step(0.0, aFamily) * (0.35 + aEcho * 0.35));
  color = mix(color, uAccent, aNovelty * 0.34 + familyPulse * 0.28);
  color = mix(color, uCoreGlow, current * 0.56 + uLayer * 0.22);
  color = mix(color, vec3(1.0), current * 0.58 + hovered * 0.72 + familyPulse * 0.2 + uLayer * 0.08);

  vColor = color;
  vCore = max(max(current, hovered), familyPulse * 0.75);
  float corePresence = 0.42 + aEnergy * 0.46 + aNovelty * 0.34 + aEcho * 0.36 + vCore * 0.48;
  float auraPresence = 0.24 + aEnergy * 0.24 + aNovelty * 0.18 + aEcho * 0.26 + vCore * 0.26;
  vAlpha = uOpacity * mix(corePresence, auraPresence, uLayer);
}
`;

const POINT_FRAGMENT_SHADER = `
precision highp float;

uniform float uLayer;

varying vec3 vColor;
varying float vAlpha;
varying float vCore;

void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float radius = length(p);
  if (radius > 1.0) discard;

  float core = exp(-radius * radius * 7.2);
  float halo = exp(-radius * radius * 1.75);
  float coreProfile = core + halo * (0.42 + vCore * 0.32);
  float auraProfile = halo * (0.82 + core * 0.36);
  float profile = mix(coreProfile, auraProfile, uLayer);
  float alpha = clamp(vAlpha * profile, 0.0, mix(0.96, 0.52, uLayer));
  if (alpha < 0.002) discard;
  float radiance = mix(1.05 + core * 1.42 + vCore * 0.62, 0.92 + halo * 0.88 + vCore * 0.28, uLayer);
  gl_FragColor = vec4(vColor * radiance, alpha);
}
`;

const THREAD_VERTEX_SHADER = `
precision highp float;

#define TAU 6.2831853071795864769252867665590

uniform float uTime;
uniform float uOpacity;
uniform float uReturnFamily;
uniform float uReturnPulse;
uniform vec3 uPaletteA;
uniform vec3 uPaletteB;
uniform vec3 uPaletteC;
uniform vec3 uPaletteD;
uniform vec3 uAccent;

attribute float aStrength;
attribute float aFamily;
attribute float aTransposition;
attribute float aPhase;

varying vec3 vColor;
varying float vAlpha;

vec3 palette(float t) {
  return uPaletteA + uPaletteB * cos(TAU * (uPaletteC * t + uPaletteD));
}

void main() {
  float returnMatch = aFamily >= 0.0 && abs(aFamily - uReturnFamily) < 0.5
    ? uReturnPulse
    : 0.0;
  float shimmer = 0.72 + 0.28 * sin(uTime * 2.2 + aPhase * 13.0 + aTransposition * 0.8);
  vColor = mix(
    palette(fract(aFamily * 0.137 + aTransposition / 18.0 + 0.2)),
    uAccent,
    0.2 + returnMatch * 0.42
  );
  vColor = mix(vColor, vec3(1.0), returnMatch * 0.32);
  vAlpha = uOpacity * aStrength * shimmer * (0.16 + returnMatch * 0.74);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const THREAD_FRAGMENT_SHADER = `
precision highp float;
varying vec3 vColor;
varying float vAlpha;
void main() {
  gl_FragColor = vec4(vColor, clamp(vAlpha, 0.0, 0.82));
}
`;

function writePoint(
  target: Float32Array,
  index: number,
  point: [number, number, number]
): void {
  const offset = index * 3;
  target[offset] = point[0];
  target[offset + 1] = point[1];
  target[offset + 2] = point[2];
}

function setAttributeUpdate(attribute: THREE.BufferAttribute): void {
  attribute.needsUpdate = true;
}

/**
 * Long-horizon visual memory surrounding Sonic Memory.
 *
 * Sonic Memory makes the recent past radial. Anamnesis keeps a sparse path of
 * the whole performance and draws chords between moments that return to a
 * similar phrase-level state. Repetition therefore becomes spatial reunion.
 */
export class AnamnesisField {
  public readonly group = new THREE.Group();
  public readonly aura: THREE.Points;
  public readonly points: THREE.Points;
  public readonly chronology: THREE.Line;
  public readonly threads: THREE.LineSegments;
  public readonly beacon: THREE.Mesh;

  private readonly pointGeometry = new THREE.BufferGeometry();
  private readonly pathGeometry = new THREE.BufferGeometry();
  private readonly threadGeometry = new THREE.BufferGeometry();
  private readonly auraMaterial: THREE.ShaderMaterial;
  private readonly pointMaterial: THREE.ShaderMaterial;
  private readonly pathMaterial: THREE.LineBasicMaterial;
  private readonly threadMaterial: THREE.ShaderMaterial;
  private readonly beaconMaterial: THREE.MeshBasicMaterial;

  private readonly pointPositions = new Float32Array(MAX_POINTS * 3);
  private readonly pathPositions = new Float32Array(MAX_POINTS * 3);
  private readonly pointIndex = new Float32Array(MAX_POINTS);
  private readonly pointEnergy = new Float32Array(MAX_POINTS);
  private readonly pointNovelty = new Float32Array(MAX_POINTS);
  private readonly pointPitch = new Float32Array(MAX_POINTS);
  private readonly pointProgress = new Float32Array(MAX_POINTS);
  private readonly pointFamily = new Float32Array(MAX_POINTS);
  private readonly pointEcho = new Float32Array(MAX_POINTS);

  private readonly threadPositions = new Float32Array(MAX_THREADS * 2 * 3);
  private readonly threadStrength = new Float32Array(MAX_THREADS * 2);
  private readonly threadFamily = new Float32Array(MAX_THREADS * 2);
  private readonly threadTransposition = new Float32Array(MAX_THREADS * 2);
  private readonly threadPhase = new Float32Array(MAX_THREADS * 2);

  private renderedPoints = 0;
  private renderedThreads = 0;
  private currentPointIndex = -1;
  private hoverIndex = -1;
  private returnFamily = -1;
  private returnPulse = 0;
  private opacity = 0;
  private targetOpacity = 0.38;
  private expanded = false;
  private enabled = true;

  constructor(palette: PalettePreset) {
    this.pointFamily.fill(-1);
    this.threadFamily.fill(-1);

    this.pointGeometry.setAttribute('position', new THREE.BufferAttribute(this.pointPositions, 3));
    this.pointGeometry.setAttribute('aIndex', new THREE.BufferAttribute(this.pointIndex, 1));
    this.pointGeometry.setAttribute('aEnergy', new THREE.BufferAttribute(this.pointEnergy, 1));
    this.pointGeometry.setAttribute('aNovelty', new THREE.BufferAttribute(this.pointNovelty, 1));
    this.pointGeometry.setAttribute('aPitch', new THREE.BufferAttribute(this.pointPitch, 1));
    this.pointGeometry.setAttribute('aProgress', new THREE.BufferAttribute(this.pointProgress, 1));
    this.pointGeometry.setAttribute('aFamily', new THREE.BufferAttribute(this.pointFamily, 1));
    this.pointGeometry.setAttribute('aEcho', new THREE.BufferAttribute(this.pointEcho, 1));
    this.pointGeometry.setDrawRange(0, 0);

    this.pointMaterial = new THREE.ShaderMaterial({
      vertexShader: POINT_VERTEX_SHADER,
      fragmentShader: POINT_FRAGMENT_SHADER,
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: 0 },
        uPointScale: { value: 1 },
        uLayer: { value: 0 },
        uCurrentIndex: { value: -1 },
        uHoverIndex: { value: -1 },
        uReturnFamily: { value: -1 },
        uReturnPulse: { value: 0 },
        uPaletteA: { value: palette.a.clone() },
        uPaletteB: { value: palette.b.clone() },
        uPaletteC: { value: palette.c.clone() },
        uPaletteD: { value: palette.d.clone() },
        uCoreGlow: { value: new THREE.Vector3(palette.coreGlow.r, palette.coreGlow.g, palette.coreGlow.b) },
        uAccent: { value: new THREE.Vector3(palette.accent.r, palette.accent.g, palette.accent.b) },
      },
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
    });
    this.auraMaterial = this.pointMaterial.clone();
    this.auraMaterial.uniforms.uLayer.value = 1;
    this.auraMaterial.depthTest = false;
    this.aura = new THREE.Points(this.pointGeometry, this.auraMaterial);
    this.aura.frustumCulled = false;
    this.aura.renderOrder = 3;
    this.group.add(this.aura);

    this.points = new THREE.Points(this.pointGeometry, this.pointMaterial);
    this.points.frustumCulled = false;
    this.points.renderOrder = 6;
    this.group.add(this.points);

    this.pathGeometry.setAttribute('position', new THREE.BufferAttribute(this.pathPositions, 3));
    this.pathGeometry.setDrawRange(0, 0);
    this.pathMaterial = new THREE.LineBasicMaterial({
      color: palette.coreGlow,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    });
    this.chronology = new THREE.Line(this.pathGeometry, this.pathMaterial);
    this.chronology.frustumCulled = false;
    this.chronology.renderOrder = 4;
    this.group.add(this.chronology);

    this.threadGeometry.setAttribute('position', new THREE.BufferAttribute(this.threadPositions, 3));
    this.threadGeometry.setAttribute('aStrength', new THREE.BufferAttribute(this.threadStrength, 1));
    this.threadGeometry.setAttribute('aFamily', new THREE.BufferAttribute(this.threadFamily, 1));
    this.threadGeometry.setAttribute('aTransposition', new THREE.BufferAttribute(this.threadTransposition, 1));
    this.threadGeometry.setAttribute('aPhase', new THREE.BufferAttribute(this.threadPhase, 1));
    this.threadGeometry.setDrawRange(0, 0);
    this.threadMaterial = new THREE.ShaderMaterial({
      vertexShader: THREAD_VERTEX_SHADER,
      fragmentShader: THREAD_FRAGMENT_SHADER,
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: 0 },
        uReturnFamily: { value: -1 },
        uReturnPulse: { value: 0 },
        uPaletteA: { value: palette.a.clone() },
        uPaletteB: { value: palette.b.clone() },
        uPaletteC: { value: palette.c.clone() },
        uPaletteD: { value: palette.d.clone() },
        uAccent: { value: new THREE.Vector3(palette.accent.r, palette.accent.g, palette.accent.b) },
      },
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    });
    this.threads = new THREE.LineSegments(this.threadGeometry, this.threadMaterial);
    this.threads.frustumCulled = false;
    this.threads.renderOrder = 5;
    this.group.add(this.threads);

    const beaconGeometry = new THREE.IcosahedronGeometry(0.075, 2);
    this.beaconMaterial = new THREE.MeshBasicMaterial({
      color: palette.accent,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.beacon = new THREE.Mesh(beaconGeometry, this.beaconMaterial);
    this.beacon.renderOrder = 7;
    this.group.add(this.beacon);

    this.group.position.y = 0.45;
    this.group.visible = true;
  }

  public setData(points: readonly MemoryPoint[], threads: readonly EchoThread[]): void {
    const pointCount = Math.min(MAX_POINTS, points.length);
    this.renderedPoints = pointCount;
    for (let index = 0; index < pointCount; index += 1) {
      const point = points[index];
      writePoint(this.pointPositions, index, point.position);
      writePoint(this.pathPositions, index, point.position);
      this.pointIndex[index] = index;
      this.pointEnergy[index] = point.energy;
      this.pointNovelty[index] = point.novelty;
      this.pointPitch[index] = point.pitchClass;
      this.pointProgress[index] = point.progress;
      this.pointFamily[index] = point.familyId;
      this.pointEcho[index] = point.echoStrength;
    }
    this.pointGeometry.setDrawRange(0, pointCount);
    this.pathGeometry.setDrawRange(0, pointCount);
    for (const name of ['position', 'aIndex', 'aEnergy', 'aNovelty', 'aPitch', 'aProgress', 'aFamily', 'aEcho']) {
      setAttributeUpdate(this.pointGeometry.getAttribute(name) as THREE.BufferAttribute);
    }
    setAttributeUpdate(this.pathGeometry.getAttribute('position') as THREE.BufferAttribute);

    const candidateThreadCount = Math.min(MAX_THREADS, threads.length);
    let writtenThreads = 0;
    for (let index = 0; index < candidateThreadCount; index += 1) {
      const thread = threads[index];
      const from = points[thread.from];
      const to = points[thread.to];
      if (!from || !to) continue;
      writePoint(this.threadPositions, writtenThreads * 2, from.position);
      writePoint(this.threadPositions, writtenThreads * 2 + 1, to.position);
      for (let endpoint = 0; endpoint < 2; endpoint += 1) {
        const attributeIndex = writtenThreads * 2 + endpoint;
        this.threadStrength[attributeIndex] = thread.similarity;
        this.threadFamily[attributeIndex] = thread.familyId;
        this.threadTransposition[attributeIndex] = thread.transposition;
        this.threadPhase[attributeIndex] = (writtenThreads * 0.61803398875) % 1;
      }
      writtenThreads += 1;
    }
    this.renderedThreads = writtenThreads;
    this.threadGeometry.setDrawRange(0, writtenThreads * 2);
    for (const name of ['position', 'aStrength', 'aFamily', 'aTransposition', 'aPhase']) {
      setAttributeUpdate(this.threadGeometry.getAttribute(name) as THREE.BufferAttribute);
    }

    this.currentPointIndex = pointCount - 1;
    this.pointMaterial.uniforms.uCurrentIndex.value = this.currentPointIndex;
    this.auraMaterial.uniforms.uCurrentIndex.value = this.currentPointIndex;
    if (pointCount > 0) {
      const current = points[pointCount - 1].position;
      this.beacon.position.set(current[0], current[1], current[2]);
    }
  }

  public setRelic(relic: MemoryRelic): void {
    this.setData(relic.points, relic.threads);
    this.returnFamily = relic.stats.lastReturn
      ? relic.points.find(point => Math.abs(point.timeSeconds - relic.stats.lastReturn!.toSeconds) < 0.05)?.familyId ?? -1
      : -1;
    this.returnPulse = this.returnFamily >= 0 ? 0.72 : 0;
  }

  public celebrateReturn(thread: EchoThread): void {
    this.returnFamily = thread.familyId;
    this.returnPulse = 1;
  }

  public setPalette(palette: PalettePreset): void {
    for (const [name, value] of [
      ['uPaletteA', palette.a],
      ['uPaletteB', palette.b],
      ['uPaletteC', palette.c],
      ['uPaletteD', palette.d],
    ] as const) {
      this.pointMaterial.uniforms[name].value.copy(value);
      this.auraMaterial.uniforms[name].value.copy(value);
      this.threadMaterial.uniforms[name].value.copy(value);
    }
    for (const material of [this.pointMaterial, this.auraMaterial]) {
      material.uniforms.uCoreGlow.value.set(
        palette.coreGlow.r,
        palette.coreGlow.g,
        palette.coreGlow.b
      );
      material.uniforms.uAccent.value.set(
        palette.accent.r,
        palette.accent.g,
        palette.accent.b
      );
    }
    this.threadMaterial.uniforms.uAccent.value.set(
      palette.accent.r,
      palette.accent.g,
      palette.accent.b
    );
    this.pathMaterial.color.copy(palette.coreGlow);
    this.beaconMaterial.color.copy(palette.accent);
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.targetOpacity = enabled ? (this.expanded ? 1 : 0.38) : 0;
  }

  public setExpanded(expanded: boolean): void {
    this.expanded = expanded;
    this.targetOpacity = this.enabled ? (expanded ? 1 : 0.38) : 0;
  }

  public isExpanded(): boolean {
    return this.expanded;
  }

  public update(time: number, dt: number, viewportHeight = 900): void {
    const smoothing = 1 - Math.exp(-Math.max(0, dt) * 5.5);
    this.opacity += (this.targetOpacity - this.opacity) * smoothing;
    this.returnPulse = Math.max(0, this.returnPulse - dt * 0.28);

    const pointOpacity = this.opacity * (this.renderedPoints > 0 ? 1 : 0);
    const pointScale = Math.max(0.72, Math.min(1.35, viewportHeight / 900));
    for (const material of [this.pointMaterial, this.auraMaterial]) {
      material.uniforms.uTime.value = time;
      material.uniforms.uReturnFamily.value = this.returnFamily;
      material.uniforms.uReturnPulse.value = this.returnPulse;
      material.uniforms.uHoverIndex.value = this.hoverIndex;
    }
    this.pointMaterial.uniforms.uOpacity.value = pointOpacity;
    this.pointMaterial.uniforms.uPointScale.value = pointScale;
    this.auraMaterial.uniforms.uOpacity.value = pointOpacity * (this.expanded ? 0.78 : 0.36);
    this.auraMaterial.uniforms.uPointScale.value = pointScale;

    this.threadMaterial.uniforms.uTime.value = time;
    this.threadMaterial.uniforms.uOpacity.value = this.opacity * (this.expanded ? 1.2 : 0.44);
    this.threadMaterial.uniforms.uReturnFamily.value = this.returnFamily;
    this.threadMaterial.uniforms.uReturnPulse.value = this.returnPulse;

    this.pathMaterial.opacity = this.opacity * (this.expanded ? 0.52 : 0.11);
    this.beaconMaterial.opacity = pointOpacity * (0.5 + 0.35 * Math.sin(time * 2.7));
    const beaconScale = 1.1 + Math.sin(time * 2.1) * 0.14 + this.returnPulse * 1.35;
    this.beacon.scale.setScalar(beaconScale);

    const targetScale = this.expanded ? 1.08 : 1;
    const scale = this.group.scale.x + (targetScale - this.group.scale.x) * smoothing;
    this.group.scale.setScalar(scale);
    this.group.visible = this.opacity > 0.002 || this.targetOpacity > 0;
  }

  public pick(
    normalizedDeviceCoordinates: THREE.Vector2,
    camera: THREE.Camera,
    threshold = 0.22
  ): number {
    if (this.renderedPoints === 0 || this.opacity < 0.05) return -1;
    const raycaster = new THREE.Raycaster();
    raycaster.params.Points = { threshold };
    raycaster.setFromCamera(normalizedDeviceCoordinates, camera);
    const hit = raycaster.intersectObject(this.points, false)[0];
    return hit && typeof hit.index === 'number' && hit.index < this.renderedPoints
      ? hit.index
      : -1;
  }

  public setHoverIndex(index: number): void {
    this.hoverIndex = index >= 0 && index < this.renderedPoints ? index : -1;
  }

  public getRenderedPointCount(): number {
    return this.renderedPoints;
  }

  public getRenderedThreadCount(): number {
    return this.renderedThreads;
  }

  public dispose(): void {
    this.pointGeometry.dispose();
    this.pathGeometry.dispose();
    this.threadGeometry.dispose();
    this.auraMaterial.dispose();
    this.pointMaterial.dispose();
    this.pathMaterial.dispose();
    this.threadMaterial.dispose();
    this.beacon.geometry.dispose();
    this.beaconMaterial.dispose();
  }
}
