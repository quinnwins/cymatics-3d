/**
 * HeadProfileSilhouette.ts
 * SoundForm 3D - 3D Volumetric Anatomical Head & Neck Shell
 *
 * Implements:
 * 1. True 3D Parametric Volumetric Head & Neck Mesh (visible and recognizable from all 360° angles).
 * 2. Translucent Fresnel Glassmorphism Shader:
 *    - Subtle 10% interior opacity so the internal vocal tract and breath stream remain 100% visible inside.
 *    - Luminous electric cyan rim glow highlighting the anatomical 3D contour from any perspective.
 * 3. 3 Perspective-anchored Callout Badges (Lips/Mouth, Throat/Pharynx, Vocal Cords) with glowing leader lines.
 */

import * as THREE from 'three';

const HEAD_FRESNEL_VERTEX_SHADER = `
varying vec3 vWorldNormal;
varying vec3 vViewPosition;
varying vec3 vWorldPos;

void main() {
    vWorldNormal = normalize(normalMatrix * normal);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = -mvPosition.xyz;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    gl_Position = projectionMatrix * mvPosition;
}
`;

const HEAD_FRESNEL_FRAGMENT_SHADER = `
uniform vec3 uColor;
uniform float uTime;
varying vec3 vWorldNormal;
varying vec3 vViewPosition;
varying vec3 vWorldPos;

void main() {
    vec3 normal = normalize(vWorldNormal);
    vec3 viewDir = normalize(vViewPosition);

    // Fresnel Rim Glow
    float NdotV = max(0.0, dot(normal, viewDir));
    float fresnel = pow(1.0 - NdotV, 2.8);

    // Subtle anatomical latitude contour lines
    float contour = sin(vWorldPos.y * 12.0) * 0.5 + 0.5;
    float contourGlow = pow(contour, 8.0) * 0.15;

    // Translucent glass base + glowing rim
    vec3 baseColor = uColor * 0.25;
    vec3 rimColor = uColor * 1.4;
    vec3 finalColor = mix(baseColor, rimColor, fresnel) + uColor * contourGlow;

    float alpha = clamp(0.06 + fresnel * 0.45, 0.0, 0.75);

    gl_FragColor = vec4(finalColor, alpha);
}
`;

export class HeadProfileSilhouette {
  public group: THREE.Group;
  private headMesh: THREE.Mesh;
  private wireframeMesh: THREE.LineSegments;
  private leaderLinesGroup: THREE.Group;
  private spriteGroup: THREE.Group;
  private material: THREE.ShaderMaterial;
  private sprites: THREE.Sprite[] = [];

  constructor() {
    this.group = new THREE.Group();
    this.leaderLinesGroup = new THREE.Group();
    this.spriteGroup = new THREE.Group();

    // 1. Build True 3D Parametric Anatomical Head & Neck Geometry
    const headGeom = this.generate3DHeadGeometry();

    this.material = new THREE.ShaderMaterial({
      vertexShader: HEAD_FRESNEL_VERTEX_SHADER,
      fragmentShader: HEAD_FRESNEL_FRAGMENT_SHADER,
      uniforms: {
        uColor: { value: new THREE.Color(0x38bdf8) },
        uTime: { value: 0.0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      side: THREE.DoubleSide,
    });

    this.headMesh = new THREE.Mesh(headGeom, this.material);
    this.group.add(this.headMesh);

    // Subtle anatomical wireframe contour lines
    const wireframeGeom = new THREE.WireframeGeometry(headGeom);
    const wireMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.12,
    });
    this.wireframeMesh = new THREE.LineSegments(wireframeGeom, wireMat);
    this.group.add(this.wireframeMesh);

    // 2. Anatomical Anchors & Perspective Callout Sprites
    this.createCallout(
      '👄 Lips & Mouth',
      'Acoustic Output',
      new THREE.Vector3(0.0, 0.92, 2.50),
      new THREE.Vector3(0.0, 1.45, 3.35),
      0x38bdf8
    );

    this.createCallout(
      '🗣 Throat / Pharynx',
      'Resonance Chamber',
      new THREE.Vector3(0.0, -0.30, -0.60),
      new THREE.Vector3(0.0, -0.15, -2.35),
      0x818cf8
    );

    this.createCallout(
      '🫁 Vocal Cords (Larynx)',
      'Sound Source (88 Hz)',
      new THREE.Vector3(0.0, -2.80, -0.25),
      new THREE.Vector3(0.0, -3.25, 1.45),
      0xf43f5e
    );

    this.group.add(this.leaderLinesGroup);
    this.group.add(this.spriteGroup);
  }

  private generate3DHeadGeometry(): THREE.BufferGeometry {
    // 24 Height Slices from Skull Apex (Y = 3.2) down to Lower Neck (Y = -3.4)
    // Aligned to encapsulate: Glottis (0, -2.8, -0.25) -> Throat (0, -0.3, -0.6) -> Lips (0, 0.92, 2.45)
    interface SliceDef {
      y: number;
      zAnt: number;  // Anterior boundary (front/face)
      zPost: number; // Posterior boundary (back/occiput)
      rX: number;    // Lateral half-width (temple/cheek/neck)
    }

    const slices: SliceDef[] = [
      { y:  3.20, zAnt:  0.20, zPost: -0.40, rX: 0.40 }, // Vertex apex
      { y:  2.85, zAnt:  1.20, zPost: -1.30, rX: 1.25 }, // Superior skull
      { y:  2.40, zAnt:  1.80, zPost: -1.65, rX: 1.55 }, // Forehead / Parietal
      { y:  1.95, zAnt:  2.15, zPost: -1.75, rX: 1.62 }, // Brow ridge
      { y:  1.60, zAnt:  2.35, zPost: -1.70, rX: 1.58 }, // Nasion (Nose bridge)
      { y:  1.25, zAnt:  2.85, zPost: -1.60, rX: 1.50 }, // Pronasale (Nose tip)
      { y:  1.00, zAnt:  2.50, zPost: -1.50, rX: 1.42 }, // Subnasale / Upper lip
      { y:  0.80, zAnt:  2.60, zPost: -1.45, rX: 1.38 }, // Stomion / Lip opening
      { y:  0.55, zAnt:  2.50, zPost: -1.40, rX: 1.35 }, // Lower lip
      { y:  0.25, zAnt:  2.35, zPost: -1.35, rX: 1.30 }, // Chin crease
      { y: -0.05, zAnt:  2.40, zPost: -1.30, rX: 1.28 }, // Pogonion (Chin tip)
      { y: -0.45, zAnt:  1.90, zPost: -1.30, rX: 1.22 }, // Submental jaw
      { y: -0.90, zAnt:  1.30, zPost: -1.35, rX: 1.15 }, // Upper neck / Hyoid
      { y: -1.40, zAnt:  1.05, zPost: -1.40, rX: 1.08 }, // Thyroid cartilage
      { y: -1.95, zAnt:  0.95, zPost: -1.45, rX: 1.02 }, // Mid neck
      { y: -2.50, zAnt:  0.88, zPost: -1.40, rX: 1.05 }, // Cricoid level
      { y: -3.00, zAnt:  0.82, zPost: -1.35, rX: 1.15 }, // Lower neck
      { y: -3.40, zAnt:  0.80, zPost: -1.30, rX: 1.28 }, // Sternal base
    ];

    const radialSegments = 36;
    const numSlices = slices.length;
    const vertices: number[] = [];
    const normals: number[] = [];
    const indices: number[] = [];

    // Generate ring vertices for each slice
    for (let i = 0; i < numSlices; i++) {
      const s = slices[i];
      const zCenter = (s.zAnt + s.zPost) * 0.5;
      const rZ = (s.zAnt - s.zPost) * 0.5;

      for (let j = 0; j < radialSegments; j++) {
        const theta = (j / radialSegments) * Math.PI * 2;
        const cosT = Math.cos(theta);
        const sinT = Math.sin(theta);

        // Deform anterior half slightly for realistic facial profile taper
        const x = sinT * s.rX * (cosT > 0.0 ? 0.95 : 1.0);
        const y = s.y;
        const z = zCenter + cosT * rZ;

        vertices.push(x, y, z);
      }
    }

    // Connect adjacent slice rings into quad strips (2 triangles each)
    for (let i = 0; i < numSlices - 1; i++) {
      for (let j = 0; j < radialSegments; j++) {
        const nextJ = (j + 1) % radialSegments;

        const v0 = i * radialSegments + j;
        const v1 = (i + 1) * radialSegments + j;
        const v2 = (i + 1) * radialSegments + nextJ;
        const v3 = i * radialSegments + nextJ;

        indices.push(v0, v1, v2);
        indices.push(v0, v2, v3);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    return geometry;
  }

  private createCallout(
    title: string,
    subtitle: string,
    anchorPos: THREE.Vector3,
    labelPos: THREE.Vector3,
    accentColor: number
  ): void {
    const lineGeom = new THREE.BufferGeometry().setFromPoints([anchorPos, labelPos]);
    const lineMat = new THREE.LineBasicMaterial({
      color: accentColor,
      transparent: true,
      opacity: 0.55,
    });
    const line = new THREE.Line(lineGeom, lineMat);
    this.leaderLinesGroup.add(line);

    const dotGeom = new THREE.SphereGeometry(0.06, 12, 12);
    const dotMat = new THREE.MeshBasicMaterial({ color: accentColor });
    const dotMesh = new THREE.Mesh(dotGeom, dotMat);
    dotMesh.position.copy(anchorPos);
    this.leaderLinesGroup.add(dotMesh);

    // Minimal High-DPI Billboard
    const canvas = document.createElement('canvas');
    canvas.width = 384;
    canvas.height = 120;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.strokeStyle = `rgba(${((accentColor >> 16) & 255)}, ${((accentColor >> 8) & 255)}, ${(accentColor & 255)}, 0.85)`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(6, 6, 372, 108, 18);
    ctx.fill();
    ctx.stroke();

    ctx.font = 'bold 36px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(title, 192, 50);

    ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = `rgb(${((accentColor >> 16) & 255)}, ${((accentColor >> 8) & 255)}, ${(accentColor & 255)})`;
    ctx.fillText(subtitle, 192, 92);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;

    const spriteMat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: true,
      depthWrite: false,
    });

    const sprite = new THREE.Sprite(spriteMat);
    sprite.position.copy(labelPos);
    sprite.scale.set(1.05, 0.33, 1.0);
    this.sprites.push(sprite);
    this.spriteGroup.add(sprite);
  }

  public update(time: number): void {
    this.material.uniforms.uTime.value = time;
  }

  public dispose(): void {
    this.headMesh.geometry.dispose();
    this.material.dispose();
    this.wireframeMesh.geometry.dispose();
    (this.wireframeMesh.material as THREE.Material).dispose();
    this.sprites.forEach((s) => {
      s.material.map?.dispose();
      s.material.dispose();
    });
  }
}
