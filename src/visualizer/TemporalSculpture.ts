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

  float ageFrames = age * uMemoryFrames;
  float historyV = fract(uHistoryHead - ageFrames / max(uHistoryRows, 2.0) + 1.0);

  float azimuth = atan(direction.z, direction.x) / TAU + 0.5;
  float polar = acos(clamp(direction.y, -1.0, 1.0)) / PI;
  float angularScan = fract(
    azimuth * 0.57
    + polar * 0.31
    + aSeed * 0.17
    + age * uWarp * 0.13
  );

  // Bias sampling toward the lower spectrum while retaining high-frequency filaments.
  float lowWeightedBin = mix(angularScan, angularScan * angularScan * angularScan, 0.68);
  lowWeightedBin = clamp(lowWeightedBin, 0.002, 0.996);
  float neighborBin = clamp(fract(lowWeightedBin + 0.011 + aSeed * 0.007), 0.002, 0.996);

  vec4 historySample = texture2D(uHistory, vec2(lowWeightedBin, historyV));
  vec4 neighborSample = texture2D(uHistory, vec2(neighborBin, historyV));

  float energy = max(historySample.r, neighborSample.r * 0.82);
  float spectralMotion = (historySample.g - 0.5) * 2.0;
  float impulse = historySample.b;
  float pitch = historySample.a;

  float harmonicOrder = 2.0 + floor(pitch * 8.0 + lowWeightedBin * 5.0);
  float angularForm = 0.5 + 0.5 * sin(
    azimuth * TAU * harmonicOrder
    + polar * PI * (2.0 + pitch * 7.0)
    + age * TAU * (1.0 + uWarp)
  );
  float radialForm = 0.5 + 0.5 * sin(
    age * TAU * (4.0 + lowWeightedBin * 18.0)
    - uTime * (0.42 + pitch * 0.58)
    + spectralMotion * 4.0
    + aSeed * TAU
  );

  // Separate broad presence from fine structure. Ordinary mastered music often
  // lives well below full scale; the old 0.82 ceiling suppressed almost every
  // point after alpha multiplication. The lower knee keeps quiet harmonics
  // visible while exact silence still produces zero global presence below.
  float activation = smoothstep(0.004, 0.34, energy * uGain);
  float ridge = pow(clamp(angularForm * radialForm, 0.0, 1.0), 1.65);
  float shellRidge = pow(radialForm, 3.0);
  float filamentRidge = pow(angularForm, 4.0);
  float memoryTexture = clamp(
    0.10 + ridge * 0.78 + shellRidge * 0.28 + filamentRidge * 0.18,
    0.0,
    1.25
  );
  float transientShell = impulse * (0.55 + 0.45 * angularForm);

  float displacement = (
    energy * (0.30 + 0.42 * angularForm)
    + transientShell * 0.28
    + spectralMotion * 0.065
  ) * uGain;

  vec3 displaced = direction * (baseLength + displacement);

  // Older sound turns into a gentle spatial helix instead of a flat stack of shells.
  float twist = age * uWarp * 2.4 + spectralMotion * 0.72 + uTime * 0.022 * (1.0 - age);
  displaced.xz = rotate2d(twist) * displaced.xz;
  displaced += direction * (radialForm - 0.5) * (0.07 + ridge * 0.08) * activation;

  // Let bass breathe the whole memory volume while upper bands create fine anisotropy.
  float bassBreath = 1.0 + uBandEnergies.x * 0.035 + uBandEnergies.y * 0.022;
  displaced *= bassBreath;
  displaced.y += sin(azimuth * TAU * 3.0 + uTime * 0.16) * uHighEnergies.x * 0.035 * age;

  vec4 mvPosition = modelViewMatrix * vec4(displaced, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  float perspective = clamp(24.0 / max(2.0, -mvPosition.z), 0.55, 3.2);
  float pointSize = (
    0.68
    + activation * 2.15
    + impulse * 1.65
    + ridge * 0.62
  ) * perspective * uPointScale;
  gl_PointSize = clamp(pointSize, 0.8, 7.6);

  vec3 spectrumColor = cosinePalette(lowWeightedBin * 0.78 + pitch * 0.28 + spectralMotion * 0.08);
  vec3 ageColor = cosinePalette(0.05 + age * 0.84 + uTime * 0.006);
  vec3 color = mix(spectrumColor, ageColor, uColorByAge * 0.74);
  vec3 temporalTint = mix(uCoreGlow, uAccent, clamp(age * 0.82 + impulse * 0.18, 0.0, 1.0));
  color = mix(color, temporalTint, 0.15 + ridge * 0.18);
  color = mix(color, vec3(1.0), impulse * 0.30 + activation * 0.10 + ridge * 0.05);

  float innerFade = smoothstep(0.015, 0.11, age);
  float outerFade = 1.0 - smoothstep(0.90, 1.0, age);
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

  float globalSignal = max(uSignal, broadEnergy * 0.82);
  float globalPresence = smoothstep(0.004, 0.18, globalSignal);
  float localPresence = 0.035 + activation * (0.82 + 0.18 * memoryTexture);
  float structuralPresence = 0.32 + memoryTexture * 0.88;
  float radialEnvelope = innerFade * (0.46 + 0.54 * outerFade);

  vColor = color;
  vHotCore = impulse * 0.72 + activation * 0.32 + ridge * 0.18;
  vAlpha = uEnabled
    * globalPresence
    * localPresence
    * structuralPresence
    * radialEnvelope;
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

  float gaussian = exp(-radiusSquared * 4.8);
  float edge = 1.0 - smoothstep(0.68, 1.0, sqrt(radiusSquared));
  float alpha = clamp(vAlpha * gaussian * edge, 0.0, 0.74);
  if (alpha < 0.002) discard;

  vec3 color = vColor * (1.02 + gaussian * 0.82 + vHotCore * 0.42);
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
    this.presentShellMaterial.opacity = 0.045 + renderSignal * 0.12;

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
