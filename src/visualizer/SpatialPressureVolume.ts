import * as THREE from 'three';
import { SpatialPressureAverage } from '../math/SpatialPressureAverage';
import { sampleCartesianPressure } from '../math/CartesianPressureField';
import type { PalettePreset } from './ColorPalettes';

/** Observation of the existing cube field. No moving particles, phase drift,
 * deformation, or camera rotation is added to the measured volume. */
export class SpatialPressureVolume {
  public readonly size = 32;
  public readonly average = new SpatialPressureAverage(this.size ** 3);
  public readonly group = new THREE.Group();
  public readonly mesh: THREE.Mesh;
  public readonly texture: THREE.Data3DTexture;
  private readonly encoded = new Uint16Array(this.size ** 3);
  private readonly material: THREE.ShaderMaterial;
  private lastSample = -Infinity;
  public sampleCount = 0;
  private readonly cameraLocal = new THREE.Vector3();
  private readonly inverse = new THREE.Matrix4();

  constructor(palette: PalettePreset) {
    this.texture = new THREE.Data3DTexture(this.encoded, this.size, this.size, this.size);
    this.texture.format = THREE.RedFormat;
    this.texture.type = THREE.HalfFloatType;
    this.texture.minFilter = this.texture.magFilter = THREE.LinearFilter;
    this.texture.unpackAlignment = 1;
    this.texture.needsUpdate = true;
    this.material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: {
        uField: { value: this.texture }, uCamera: { value: this.cameraLocal },
        uSize: { value: this.size }, uAccent: { value: palette.accent.clone() },
        uCore: { value: palette.coreGlow.clone() },
      },
      vertexShader: `out vec3 vLocal;
        void main() { vLocal = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `precision highp float;
        precision highp sampler3D;
        in vec3 vLocal;
        out vec4 outColor;
        uniform sampler3D uField;
        uniform vec3 uCamera, uAccent, uCore;
        uniform float uSize;
        float energy(vec3 p) {
          vec3 uvw = (p * 0.5 + 0.5) * (1.0 - 1.0 / uSize) + 0.5 / uSize;
          return max(0.0, texture(uField, uvw).r);
        }
        void main() {
          vec3 rd = normalize(vLocal - uCamera);
          vec3 inv = 1.0 / (rd + vec3(1e-8));
          vec3 lo = min((-1.0 - uCamera) * inv, (1.0 - uCamera) * inv);
          vec3 hi = max((-1.0 - uCamera) * inv, (1.0 - uCamera) * inv);
          float nearT = max(0.0, max(lo.x, max(lo.y, lo.z)));
          float farT = min(hi.x, min(hi.y, hi.z));
          if (farT <= nearT) discard;
          float stepSize = (farT - nearT) / 96.0;
          float transmission = 1.0;
          vec3 light = vec3(0.0);
          for (int i = 0; i < 96; i++) {
            vec3 p = uCamera + rd * (nearT + (float(i) + 0.5) * stepSize);
            float e = energy(p);
            // Fixed relative threshold: persistently quiet regions are luminous.
            // It is not retuned to force nodes to remain visible as they move.
            float density = exp(-e / 0.020);
            if (density > 0.005) {
              float eps = 2.0 / uSize;
              vec3 gradient = vec3(
                energy(p + vec3(eps,0,0)) - energy(p - vec3(eps,0,0)),
                energy(p + vec3(0,eps,0)) - energy(p - vec3(0,eps,0)),
                energy(p + vec3(0,0,eps)) - energy(p - vec3(0,0,eps)));
              vec3 normal = gradient / max(length(gradient), 1e-6);
              float rim = pow(1.0 - abs(dot(normal, rd)), 2.0);
              vec3 color = mix(uCore, uAccent, 0.30 + rim * 0.55);
              float absorbed = 1.0 - exp(-density * stepSize * 18.0);
              light += transmission * absorbed * color * (0.65 + rim * 0.65);
              transmission *= 1.0 - absorbed;
            }
            if (transmission < 0.01) break;
          }
          float alpha = 1.0 - transmission;
          // Three's normal blending expects straight alpha.
          outColor = vec4(light / max(alpha, 1e-5), alpha);
        }`,
      transparent: true, depthWrite: false, side: THREE.BackSide,
    });
    this.mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), this.material);
    this.group.add(this.mesh);
    this.group.position.y = 0.45;
    this.group.visible = false;
  }

  public update(time: number, modes: THREE.Vector3, bands: THREE.Vector4,
    halfSize: number, windowSeconds: number, camera: THREE.Camera): void {
    this.group.scale.setScalar(halfSize);
    let changed = false;
    if (this.average.windowSeconds !== windowSeconds) {
      this.average.setWindow(windowSeconds);
      changed = true;
    }
    if (time - this.lastSample >= 1 / 30 || time < this.lastSample) {
      this.average.push(time, sampleCartesianPressure(this.size, [modes.x, modes.y, modes.z], bands.y, bands.z));
      this.lastSample = time;
      this.sampleCount++;
      changed = true;
    }
    if (changed) {
      for (let i = 0; i < this.encoded.length; i++) this.encoded[i] = THREE.DataUtils.toHalfFloat(this.average.meanSquare[i]);
      this.texture.needsUpdate = true;
    }
    this.mesh.visible = this.average.coverageSeconds > 0;
    this.syncCamera(camera);
  }

  public syncCamera(camera: THREE.Camera): void {
    this.mesh.updateWorldMatrix(true, false);
    this.inverse.copy(this.mesh.matrixWorld).invert();
    this.cameraLocal.copy(camera.position).applyMatrix4(this.inverse);
  }

  public setPalette(palette: PalettePreset): void {
    this.material.uniforms.uAccent.value.copy(palette.accent);
    this.material.uniforms.uCore.value.copy(palette.coreGlow);
  }

  public reset(): void { this.average.reset(); this.lastSample = -Infinity; }
  public dispose(): void { this.texture.dispose(); this.material.dispose(); this.mesh.geometry.dispose(); }
}
