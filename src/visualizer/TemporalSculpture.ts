import * as THREE from 'three';
import { PalettePreset } from './ColorPalettes';
import { temporalMemory } from './TemporalMemory';

const POINT_COUNT = 65_536;
const INNER_RADIUS = 0.74;
const OUTER_RADIUS = 3.55;

const TEMPORAL_VERTEX_SHADER = `
precision highp float;

#define PI 3.1415926535897932384626433832795
#define TAU 6.2831853071795864769252867665590

uniform sampler2D uHistory;
uniform float uHistoryHead;
uniform float uHistoryRows;
uniform float uMemoryFrames;
uniform float uEnabled;
uniform float uGain;
uniform float uWarp;
uniform float uTime;
uniform float uColorByAge;
uniform float uSignal;
uniform float uPointScale;
uniform vec4 uBandEnergies;
uniform vec2 uHighEnergies;
uniform float uFundamentalHz;
uniform vec3 uPaletteA;
uniform vec3 uPaletteB;
uniform vec3 uPaletteC;
uniform vec3 uPaletteD;
uniform vec3 uCoreGlow;
uniform vec3 uAccent;

attribute float aSeed;
attribute float aRadius;

varying vec3 vColor;
varying float vAlpha;
varying float vHotCore;

vec3 cosinePalette(float t) {
  return uPaletteA + uPaletteB * cos(TAU * (uPaletteC * t + uPaletteD));
}

mat2 rotate2d(float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return mat2(c, -s, s, c);
}

void main() {
  vec3 basePosition = position;
  float baseLength = max(length(basePosition), 0.0001);
  vec3 direction = basePosition / baseLength;
  float age = clamp(aRadius, 0.0, 1.0);

  // Radius is a timeline: the newest audio lives at the emitter and older
  // frames remain at larger radii.
  float ageFrames = age * uMemoryFrames;
  float historyV = fract(uHistoryHead - ageFrames / max(uHistoryRows, 2.0) + 1.0);

  float azimuth = atan(direction.z, direction.x) / TAU + 0.5;
  float polar = acos(clamp(direction.y, -1.0, 1.0)) / PI;

  // Keep adjacent points coherent. A tiny deterministic dither avoids visible
  // sampling seams without turning the form into randomized spectral dust.
  float spectralCoordinate = fract(
    azimuth * 0.62
    + polar * 0.38
    + sin(azimuth * TAU * 2.0) * 0.025
    + age * uWarp * 0.018
    + (aSeed - 0.5) * 0.008
  );
  float lowWeightedBin = pow(clamp(spectralCoordinate, 0.001, 0.999), 2.15);
  float neighborBin = clamp(lowWeightedBin + mix(-0.018, 0.024, polar), 0.002, 0.996);
  float overtoneBin = clamp(pow(fract(spectralCoordinate * 1.618 + age * 0.031), 1.72), 0.002, 0.996);

  vec4 historySample = texture2D(uHistory, vec2(lowWeightedBin, historyV));
  vec4 neighborSample = texture2D(uHistory, vec2(neighborBin, historyV));
  vec4 overtoneSample = texture2D(uHistory, vec2(overtoneBin, historyV));

  float rawEnergy = max(
    historySample.r,
    max(neighborSample.r * 0.84, overtoneSample.r * 0.62)
  );
  float energy = pow(clamp(rawEnergy, 0.0, 1.0), 0.58);
  float captured = step(0.002, rawEnergy);
  float spectralMotion = (historySample.g - 0.5) * 2.0;
  float impulse = pow(clamp(max(historySample.b, neighborSample.b), 0.0, 1.0), 0.62);
  float pitch = max(historySample.a, neighborSample.a * 0.92);

  float currentPitch = clamp(log2(max(uFundamentalHz, 20.0) / 20.0) / 7.65, 0.0, 1.0);
  float pitchIdentity = max(pitch, currentPitch * 0.35);
  float harmonicOrder = 2.0 + floor(pitchIdentity * 7.0 + lowWeightedBin * 6.0);
  float polarOrder = 2.0 + floor(lowWeightedBin * 8.0 + pitchIdentity * 3.0);

  float petals = 0.5 + 0.5 * sin(
    azimuth * TAU * harmonicOrder
    + polar * PI * (1.5 + pitchIdentity * 5.0)
    + age * TAU * (0.42 + uWarp * 0.28)
  );
  float meridians = 0.5 + 0.5 * cos(
    polar * PI * polarOrder
    - azimuth * TAU * (1.0 + floor(pitchIdentity * 4.0))
    + spectralMotion * 2.4
  );
  float temporalContour = pow(
    0.5 + 0.5 * cos(
      age * TAU * (5.0 + lowWeightedBin * 13.0)
      - uTime * (0.16 + pitchIdentity * 0.18)
      + spectralMotion * 2.1
    ),
    4.5
  );
  float architecture = clamp(
    petals * 0.54
    + meridians * 0.28
    + petals * meridians * 0.34,
    0.0,
    1.0
  );
  architecture = pow(architecture, 1.18);

  float activation = smoothstep(0.025, 0.58, energy * uGain);
  float transientShell = impulse * (0.45 + temporalContour * 0.55);
  float harmonicRelief = (architecture - 0.42) * energy * (0.30 + (1.0 - lowWeightedBin) * 0.24);
  float contourRelief = (temporalContour - 0.32) * energy * 0.12;
  float transientRelief = transientShell * 0.42;
  float radialOffset = (harmonicRelief + contourRelief + transientRelief) * uGain;

  vec3 displaced = direction * (baseLength + radialOffset);

  // The past slowly twists into a helix. The present remains anchored so beats
  // can be read as causally expanding from one point.
  float twist = age * uWarp * (1.35 + pitchIdentity * 1.8)
    + spectralMotion * 0.42
    + uTime * 0.018 * (1.0 - age);
  displaced.xz = rotate2d(twist) * displaced.xz;

  float lateralWave = (petals - 0.5) * energy * 0.12 * uGain;
  vec3 tangent = normalize(vec3(-direction.z, 0.18 + direction.y * 0.12, direction.x));
  displaced += tangent * lateralWave;
  displaced.y += (meridians - 0.5) * energy * 0.14 * uGain;

  // Bass breathes the complete memory volume. High frequencies add delicate
  // anisotropy without replacing the historical field.
  float bassBreath = 1.0 + uBandEnergies.x * 0.055 + uBandEnergies.y * 0.032;
  displaced *= bassBreath;
  displaced.y += sin(azimuth * TAU * 3.0 + uTime * 0.14)
    * uHighEnergies.x * 0.045 * age;

  vec4 mvPosition = modelViewMatrix * vec4(displaced, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  float perspective = clamp(12.5 / max(2.0, -mvPosition.z), 0.62, 2.35);
  float pointSize = (
    0.78
    + activation * 1.65
    + transientShell * 1.75
    + temporalContour * activation * 0.38
  ) * perspective * uPointScale;
  gl_PointSize = clamp(pointSize, 0.9, 5.8);

  vec3 spectrumColor = cosinePalette(
    lowWeightedBin * 0.72
    + pitchIdentity * 0.24
    + spectralMotion * 0.045
  );
  vec3 ageColor = cosinePalette(0.03 + age * 0.88 + pitchIdentity * 0.08);
  vec3 color = mix(spectrumColor, ageColor, uColorByAge * 0.72);
  float presentGlow = 1.0 - smoothstep(0.02, 0.28, age);
  color = mix(color, uCoreGlow, presentGlow * 0.34);
  color = mix(color, uAccent, transientShell * 0.46 + temporalContour * 0.08);
  color = mix(color, vec3(1.0), transientShell * 0.36 + activation * 0.07);
  color *= 1.02 + activation * 0.34;

  float innerFade = smoothstep(0.0, 0.035, age);
  float outerFade = 1.0 - smoothstep(0.965, 1.0, age);
  float structurePresence = mix(
    0.34,
    1.0,
    max(architecture * 0.78, temporalContour * 0.72)
  );
  float broadEnergy = clamp(
    uBandEnergies.x * 0.36
    + uBandEnergies.y * 0.25
    + uBandEnergies.z * 0.18
    + uBandEnergies.w * 0.12
    + uHighEnergies.x * 0.06
    + uHighEnergies.y * 0.03,
    0.0,
    1.0
  );
  float globalPresence = pow(
    clamp(max(uSignal * 1.45, broadEnergy * 0.95), 0.0, 1.0),
    0.62
  );
  float microDither = 0.86 + 0.14 * sin(aSeed * TAU * 17.0 + age * TAU * 31.0);

  vColor = color;
  vHotCore = transientShell * 0.82 + activation * 0.28 + presentGlow * 0.12;
  vAlpha = uEnabled
    * captured
    * activation
    * (0.10 + globalPresence * 0.43)
    * structurePresence
    * (0.82 + transientShell * 0.35)
    * innerFade
    * outerFade
    * microDither;
}
`;

const TEMPORAL_FRAGMENT_SHADER = `
precision highp float;

varying vec3 vColor;
varying float vAlpha;
varying float vHotCore;

void main() {
  vec2 point = gl_PointCoord * 2.0 - 1.0;
  float radiusSquared = dot(point, point);
  if (radiusSquared > 1.0) discard;

  float radius = sqrt(radiusSquared);
  float core = exp(-radiusSquared * 3.7);
  float halo = 1.0 - smoothstep(0.38, 1.0, radius);
  float alpha = clamp(vAlpha * (core * 0.72 + halo * 0.28), 0.0, 0.72);
  if (alpha < 0.003) discard;

  vec3 color = vColor * (0.96 + core * 0.86 + vHotCore * 0.42);
  gl_FragColor = vec4(color, alpha);
}
`;

/**
 * A spatial memory of the currently playing sound.
 *
 * Points close to the emitter sample the newest spectral row. Points farther
 * away sample older rows, so rhythm, harmony, and timbre visibly propagate
 * outward instead of merely deforming one instantaneous blob.
 */
export class TemporalSculpture {
  public readonly group: THREE.Group;
  public readonly points: THREE.Points;

  private readonly material: THREE.ShaderMaterial;
  private readonly presentShell: THREE.Mesh;
  private readonly presentShellMaterial: THREE.MeshBasicMaterial;
  private readonly frozenBands = new THREE.Vector4();
  private readonly frozenHighs = new THREE.Vector2();
  private frozenFundamentalHz = 0;
  private frozenSignal = 0;
  private sculptureTime = 0;

  constructor(initialPalette: PalettePreset, pointCount = POINT_COUNT) {
    this.group = new THREE.Group();

    const geometry = this.buildGeometry(pointCount);
    this.material = new THREE.ShaderMaterial({
      vertexShader: TEMPORAL_VERTEX_SHADER,
      fragmentShader: TEMPORAL_FRAGMENT_SHADER,
      uniforms: {
        uHistory: { value: temporalMemory.getTexture() },
        uHistoryHead: { value: 0 },
        uHistoryRows: { value: 512 },
        uMemoryFrames: { value: 240 },
        uEnabled: { value: 1 },
        uGain: { value: 1 },
        uWarp: { value: 1 },
        uTime: { value: 0 },
        uColorByAge: { value: 1 },
        uSignal: { value: 0 },
        uPointScale: { value: 1 },
        uBandEnergies: { value: new THREE.Vector4() },
        uHighEnergies: { value: new THREE.Vector2() },
        uFundamentalHz: { value: 0 },
        uPaletteA: { value: initialPalette.a.clone() },
        uPaletteB: { value: initialPalette.b.clone() },
        uPaletteC: { value: initialPalette.c.clone() },
        uPaletteD: { value: initialPalette.d.clone() },
        uCoreGlow: { value: initialPalette.coreGlow.clone() },
        uAccent: { value: initialPalette.accent.clone() },
      },
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
    });

    this.points = new THREE.Points(geometry, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 3;
    this.group.add(this.points);

    const shellGeometry = new THREE.IcosahedronGeometry(INNER_RADIUS * 0.91, 2);
    this.presentShellMaterial = new THREE.MeshBasicMaterial({
      color: initialPalette.accent,
      wireframe: true,
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.presentShell = new THREE.Mesh(shellGeometry, this.presentShellMaterial);
    this.presentShell.renderOrder = 4;
    this.group.add(this.presentShell);
  }

  public update(
    time: number,
    bands: THREE.Vector4,
    highs: THREE.Vector2,
    fundamentalHz: number,
    camera?: THREE.Camera
  ): void {
    const state = temporalMemory.getUniformState();
    const settings = temporalMemory.getSettings();
    const uniforms = this.material.uniforms;

    // Continuously retain the latest complete visual state. Freeze then holds
    // history, phase, broad-band motion, pitch, and presence as one sculpture.
    if (!settings.frozen) {
      this.sculptureTime = time;
      this.frozenBands.copy(bands);
      this.frozenHighs.copy(highs);
      this.frozenFundamentalHz = fundamentalHz;
      this.frozenSignal = state.signal;
    }

    const renderBands = settings.frozen ? this.frozenBands : bands;
    const renderHighs = settings.frozen ? this.frozenHighs : highs;
    const renderFundamentalHz = settings.frozen ? this.frozenFundamentalHz : fundamentalHz;
    const renderSignal = settings.frozen ? this.frozenSignal : state.signal;

    if (state.texture && uniforms.uHistory.value !== state.texture) {
      uniforms.uHistory.value = state.texture;
    }

    uniforms.uHistoryHead.value = state.historyHead;
    uniforms.uHistoryRows.value = state.historyRows;
    uniforms.uMemoryFrames.value = state.memoryFrames;
    uniforms.uEnabled.value = state.enabled;
    uniforms.uGain.value = state.gain;
    uniforms.uWarp.value = state.warp;
    uniforms.uColorByAge.value = state.colorByAge;
    uniforms.uSignal.value = renderSignal;
    uniforms.uTime.value = this.sculptureTime;
    uniforms.uBandEnergies.value.copy(renderBands);
    uniforms.uHighEnergies.value.copy(renderHighs);
    uniforms.uFundamentalHz.value = renderFundamentalHz;

    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 900;
    uniforms.uPointScale.value = Math.max(0.72, Math.min(1.35, viewportHeight / 900));

    this.points.visible = state.enabled > 0 && Boolean(state.texture);
    this.presentShell.visible = this.points.visible;

    const pulse = 1 + renderBands.x * 0.08 + renderBands.y * 0.04 + renderSignal * 0.025;
    this.presentShell.scale.setScalar(pulse);
    this.presentShell.rotation.y = this.sculptureTime * 0.09;
    this.presentShell.rotation.z = -this.sculptureTime * 0.055;
    this.presentShellMaterial.opacity = 0.065 + renderSignal * 0.16;

    if (camera) {
      const distance = camera.position.length();
      this.presentShellMaterial.opacity *= Math.max(0.55, Math.min(1.15, distance / 8));
    }
  }

  public setPalette(palette: PalettePreset): void {
    const uniforms = this.material.uniforms;
    uniforms.uPaletteA.value.copy(palette.a);
    uniforms.uPaletteB.value.copy(palette.b);
    uniforms.uPaletteC.value.copy(palette.c);
    uniforms.uPaletteD.value.copy(palette.d);
    uniforms.uCoreGlow.value.copy(palette.coreGlow);
    uniforms.uAccent.value.copy(palette.accent);
    this.presentShellMaterial.color.copy(palette.accent);
  }

  public setVisible(visible: boolean): void {
    this.group.visible = visible;
  }

  public getPointCount(): number {
    return this.points.geometry.getAttribute('position').count;
  }

  public dispose(): void {
    this.points.geometry.dispose();
    this.material.dispose();
    this.presentShell.geometry.dispose();
    this.presentShellMaterial.dispose();
  }

  private buildGeometry(pointCount: number): THREE.BufferGeometry {
    const count = Math.max(4096, Math.round(pointCount));
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    const radii = new Float32Array(count);

    const goldenA = 0.6180339887498949;
    const goldenB = 0.7548776662466927;

    for (let index = 0; index < count; index += 1) {
      const sequence = (index + 0.5) / count;
      const radiusNorm = Math.pow(sequence, 0.64);
      const z = 1 - 2 * ((0.5 + index * goldenA) % 1);
      const azimuth = Math.PI * 2 * ((0.5 + index * goldenB) % 1);
      const planar = Math.sqrt(Math.max(0, 1 - z * z));
      const radius = INNER_RADIUS + radiusNorm * (OUTER_RADIUS - INNER_RADIUS);

      positions[index * 3 + 0] = Math.cos(azimuth) * planar * radius;
      positions[index * 3 + 1] = z * radius;
      positions[index * 3 + 2] = Math.sin(azimuth) * planar * radius;
      seeds[index] = (index * 0.3819660112501051) % 1;
      radii[index] = radiusNorm;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    geometry.setAttribute('aRadius', new THREE.BufferAttribute(radii, 1));
    geometry.computeBoundingSphere();
    return geometry;
  }
}
