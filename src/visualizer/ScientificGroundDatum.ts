/**
 * ScientificGroundDatum.ts
 * SoundForm 3D - High-Precision Anti-Aliased Coordinate Ground Plane Datum
 * 
 * Provides an analytical, resolution-independent reference datum grid
 * with fwidth anti-aliasing and smooth radial distance falloff.
 */

import * as THREE from 'three';

const GROUND_DATUM_VERTEX_SHADER = `
varying vec3 vWorldPos;
varying vec2 vUv;

void main() {
    vUv = uv;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

const GROUND_DATUM_FRAGMENT_SHADER = `
precision highp float;

uniform vec3 uGridColor;
uniform vec3 uBaseColor;
uniform float uGridScale;
uniform float uRadius;
uniform vec3 uCameraPos;

varying vec3 vWorldPos;
varying vec2 vUv;

float getGrid(vec2 pos, float scale, float lineWidth) {
    vec2 coord = pos / scale;
    vec2 grid = abs(fract(coord - 0.5) - 0.5) / (fwidth(coord) * lineWidth);
    float line = min(grid.x, grid.y);
    return 1.0 - min(line, 1.0);
}

void main() {
    vec2 pos = vWorldPos.xz;
    float dist = length(pos);
    
    // Smooth radial distance attenuation
    float radialFalloff = smoothstep(uRadius, 0.0, dist);
    if (radialFalloff <= 0.001) {
        discard;
    }

    // Minor (0.25m) and Major (1.0m) coordinate grid lines
    float minorGrid = getGrid(pos, uGridScale * 0.25, 1.0) * 0.18;
    float majorGrid = getGrid(pos, uGridScale * 1.0, 1.5) * 0.45;
    float axisX = getGrid(vec2(pos.y, 0.0), 100.0, 2.0) * 0.75 * smoothstep(2.5, 0.0, abs(pos.y));
    float axisZ = getGrid(vec2(pos.x, 0.0), 100.0, 2.0) * 0.75 * smoothstep(2.5, 0.0, abs(pos.x));

    float totalGrid = clamp(minorGrid + majorGrid + axisX + axisZ, 0.0, 1.0);

    // Subtle dark slate pedestal with glowing grid lines
    vec3 color = mix(uBaseColor, uGridColor, totalGrid);
    float alpha = (0.12 + totalGrid * 0.55) * radialFalloff;

    gl_FragColor = vec4(color, alpha);
}
`;

export class ScientificGroundDatum {
  public mesh: THREE.Mesh;
  private material: THREE.ShaderMaterial;

  constructor(radius = 16.0) {
    const geometry = new THREE.PlaneGeometry(radius * 2, radius * 2, 1, 1);
    geometry.rotateX(-Math.PI / 2);

    this.material = new THREE.ShaderMaterial({
      vertexShader: GROUND_DATUM_VERTEX_SHADER,
      fragmentShader: GROUND_DATUM_FRAGMENT_SHADER,
      uniforms: {
        uGridColor: { value: new THREE.Color(0x38bdf8) }, // Crisp scientific cyan/ice
        uBaseColor: { value: new THREE.Color(0x030712) }, // Deep void slate
        uGridScale: { value: 1.0 },
        uRadius: { value: radius },
        uCameraPos: { value: new THREE.Vector3() },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      side: THREE.DoubleSide,
    });

    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.position.y = -1.8; // Positioned cleanly below center stage
    this.mesh.renderOrder = 0;
  }

  public update(camera: THREE.Camera): void {
    this.material.uniforms.uCameraPos.value.copy(camera.position);
  }

  public setVisible(visible: boolean): void {
    this.mesh.visible = visible;
  }

  public dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
