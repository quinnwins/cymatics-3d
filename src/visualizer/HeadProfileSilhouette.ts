/**
 * HeadProfileSilhouette.ts
 * SoundForm 3D - High-Fidelity Anatomical Sagittal Cephalometric Human Bust Shell & Contact Shadow
 *
 * Implements:
 * 1. True 3D Parametric Anatomical Human Bust Geometry (Cranial Vertex -> Face -> Neck -> Clavicles -> Shoulders):
 *    - Full cephalometric landmarks: Cranial vault, forehead, nasion, pronasale (nose tip), philtrum,
 *      upper/lower lips, pogonion (chin), mandibular jawline, sternocleidomastoid neck, clavicles, and shoulders.
 *    - Continuous ground-tapering bust that gracefully blends into the datum floor plane ($y = -4.85$).
 * 2. Dual-Pass Translucent Holographic Glassmorphism Shader:
 *    - Razor-sharp inverted Fresnel rim lighting (#00f0ff / #38bdf8) with cubic angle falloff.
 *    - Animated horizontal holographic isocline scanlines.
 *    - Height-based smooth opacity attenuation (transparent at base to seamlessly merge with the floor grid).
 *    - 90% interior transparency preserving crystal-clear visibility of internal vocal waveguide & airflow particles.
 * 3. Continuous Illuminated Sagittal Midline Profile Laser Guide.
 * 4. Soft Radial Ground Contact Shadow Disk anchoring the figure in 3D space.
 * 5. Perspective-anchored Anatomical Callout Badges with glowing leader lines.
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
uniform vec3  uColor;
uniform float uTime;
varying vec3  vWorldNormal;
varying vec3  vViewPosition;
varying vec3  vWorldPos;

void main() {
    vec3 normal = normalize(vWorldNormal);
    vec3 viewDir = normalize(vViewPosition);

    // 1. Razor-Sharp Inverted Fresnel Rim Glow
    float NdotV = max(0.0, dot(normal, viewDir));
    float fresnel = pow(1.0 - NdotV, 3.0);

    // 2. Animated Holographic Isocline Scanlines
    float scanline = sin(vWorldPos.y * 12.0 - uTime * 1.2) * 0.5 + 0.5;
    float scanGlow = pow(scanline, 8.0) * 0.16;

    // 3. Subtle Cephalometric Latitude Contour Lines
    float latContour = sin(vWorldPos.y * 6.0) * 0.5 + 0.5;
    float latGlow = pow(latContour, 12.0) * 0.10;

    // 4. Height-Based Alpha Attenuation (Graceful fade to datum floor at y = -4.85)
    float heightFade = smoothstep(-4.85, -3.30, vWorldPos.y);

    // 5. Clean Sapphire / Obsidian Glass Palette
    vec3 baseColor = uColor * 0.08;
    vec3 rimColor  = uColor * 1.45;
    vec3 finalColor = mix(baseColor, rimColor, fresnel) + uColor * (scanGlow + latGlow);

    // High interior transparency (90-95%) with luminous outer edge
    float alpha = (0.04 + fresnel * 0.42 + scanGlow * 0.15) * heightFade;
    alpha = clamp(alpha, 0.0, 0.70);

    gl_FragColor = vec4(finalColor, alpha);
}
`;

export class HeadProfileSilhouette {
  public group: THREE.Group;
  private headMesh: THREE.Mesh;
  private wireframeMesh: THREE.LineSegments;
  private midlineProfileLine: THREE.Line;
  private contactShadowMesh: THREE.Mesh;
  private leaderLinesGroup: THREE.Group;
  private spriteGroup: THREE.Group;
  private material: THREE.ShaderMaterial;
  private sprites: THREE.Sprite[] = [];

  constructor() {
    this.group = new THREE.Group();
    this.leaderLinesGroup = new THREE.Group();
    this.spriteGroup = new THREE.Group();

    // 1. Build True 3D Parametric Cephalometric Human Bust Geometry (Head -> Shoulders)
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

    // Subtle anatomical wireframe grid
    const wireframeGeom = new THREE.WireframeGeometry(headGeom);
    const wireMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.08,
    });
    this.wireframeMesh = new THREE.LineSegments(wireframeGeom, wireMat);
    this.group.add(this.wireframeMesh);

    // 2. Crisp Illuminated Sagittal Midline Profile Line
    const midlinePoints = this.generateMidlinePoints();
    const midlineGeom = new THREE.BufferGeometry().setFromPoints(midlinePoints);
    const midlineMat = new THREE.LineBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.85,
      linewidth: 2,
    });
    this.midlineProfileLine = new THREE.Line(midlineGeom, midlineMat);
    this.group.add(this.midlineProfileLine);

    // 3. Soft Radial Ground Contact Shadow on Datum Floor Plane
    this.contactShadowMesh = this.createContactShadowMesh();
    this.group.add(this.contactShadowMesh);

    // 4. Perspective-anchored Anatomical Callout Badges
    this.createCallout(
      'Lips & Mouth',
      'Acoustic Radiator',
      new THREE.Vector3(0.0, 0.92, 2.50),
      new THREE.Vector3(0.0, 1.45, 3.45),
      0x38bdf8
    );

    this.createCallout(
      'Throat / Pharynx',
      'Resonance Chamber',
      new THREE.Vector3(0.0, -0.30, -0.60),
      new THREE.Vector3(0.0, -0.15, -2.45),
      0x818cf8
    );

    this.createCallout(
      'Vocal Cords (Larynx)',
      'Sound Source (88 Hz)',
      new THREE.Vector3(0.0, -2.80, -0.25),
      new THREE.Vector3(0.0, -3.25, 1.45),
      0x00f0ff
    );

    this.group.add(this.leaderLinesGroup);
    this.group.add(this.spriteGroup);
  }

  private generate3DHeadGeometry(): THREE.BufferGeometry {
    // 24 Cephalometric Anatomical Slices from Cranial Vertex down through Neck, Clavicles & Shoulders
    interface AnatomicalSlice {
      y: number;
      zAnt: number;     // Sagittal anterior midline (front)
      zPost: number;    // Sagittal posterior midline (back/occiput/spine)
      rX: number;       // Lateral half-width (cranial/cheek/neck/shoulder)
      noseProm?: number;// Sharp anterior protrusion for nasal ridge/tip
    }

    const slices: AnatomicalSlice[] = [
      { y:  3.40, zAnt:  0.02, zPost: -0.30, rX: 0.25 }, // Cranium Vertex Apex
      { y:  3.15, zAnt:  0.85, zPost: -1.05, rX: 1.05 }, // Superior Parietal Vault
      { y:  2.75, zAnt:  1.55, zPost: -1.55, rX: 1.48 }, // Forehead
      { y:  2.30, zAnt:  1.90, zPost: -1.75, rX: 1.60 }, // Frontal Bone / Glabella
      { y:  1.90, zAnt:  2.15, zPost: -1.75, rX: 1.58 }, // Supraorbital Brow Ridge
      { y:  1.60, zAnt:  2.30, zPost: -1.70, rX: 1.52, noseProm: 0.22 }, // Nasion (Nasal Root)
      { y:  1.30, zAnt:  2.85, zPost: -1.62, rX: 1.45, noseProm: 0.58 }, // Pronasale (Nose Tip)
      { y:  1.05, zAnt:  2.45, zPost: -1.52, rX: 1.40, noseProm: 0.28 }, // Subnasale / Philtrum
      { y:  0.85, zAnt:  2.58, zPost: -1.46, rX: 1.36 }, // Upper Lip
      { y:  0.68, zAnt:  2.46, zPost: -1.42, rX: 1.34 }, // Stomion (Mouth Slit)
      { y:  0.50, zAnt:  2.52, zPost: -1.38, rX: 1.32 }, // Lower Lip
      { y:  0.28, zAnt:  2.32, zPost: -1.35, rX: 1.30 }, // Labiomental Crease
      { y: -0.02, zAnt:  2.42, zPost: -1.30, rX: 1.26 }, // Pogonion (Chin Tip)
      { y: -0.40, zAnt:  1.85, zPost: -1.30, rX: 1.20 }, // Submental Mandibular Arch
      { y: -0.85, zAnt:  1.25, zPost: -1.35, rX: 1.14 }, // Hyoid Level / Superior Neck
      { y: -1.40, zAnt:  1.05, zPost: -1.40, rX: 1.08 }, // Thyroid Cartilage (Adam's Apple)
      { y: -1.95, zAnt:  0.95, zPost: -1.45, rX: 1.05 }, // Cricoid Level / Mid Cervical
      { y: -2.50, zAnt:  0.88, zPost: -1.42, rX: 1.10 }, // Lower Cervical / C7
      { y: -3.00, zAnt:  0.85, zPost: -1.38, rX: 1.24 }, // Suprasternal Notch / Neck Base
      { y: -3.45, zAnt:  0.95, zPost: -1.35, rX: 1.70 }, // Clavicular Arch & Trapezius Slope
      { y: -3.85, zAnt:  1.15, zPost: -1.30, rX: 2.40 }, // Upper Chest / Deltoid Flare
      { y: -4.25, zAnt:  1.30, zPost: -1.25, rX: 3.05 }, // Mid Chest / Acromion Shoulder Line
      { y: -4.60, zAnt:  1.40, zPost: -1.20, rX: 3.50 }, // Lower Chest / Broad Shoulder Base
      { y: -4.85, zAnt:  1.45, zPost: -1.18, rX: 3.70 }, // Datum Floor Blending Base
    ];

    const radialSegments = 48;
    const numSlices = slices.length;
    const vertices: number[] = [];
    const indices: number[] = [];

    for (let i = 0; i < numSlices; i++) {
      const s = slices[i];
      const zCenter = (s.zAnt + s.zPost) * 0.5;
      const rZ = (s.zAnt - s.zPost) * 0.5;
      const noseProm = s.noseProm || 0.0;

      for (let j = 0; j < radialSegments; j++) {
        const theta = (j / radialSegments) * Math.PI * 2;
        const cosT = Math.cos(theta);
        const sinT = Math.sin(theta);

        let x = sinT * s.rX;
        let z = zCenter + cosT * rZ;

        // Anatomical facial & shoulder taper modulation
        if (s.y > -3.0) {
          if (cosT > 0.0 && noseProm > 0.0) {
            // Crisp nasal ridge taper
            const noseTaper = Math.max(0.0, 1.0 - Math.abs(sinT) * 3.5);
            z += noseProm * noseTaper;
            x *= (1.0 - noseTaper * 0.35);
          } else if (cosT > 0.0) {
            x *= (0.92 + 0.08 * (1.0 - cosT));
          }
        } else {
          // Shoulder and chest natural curvature
          if (cosT > 0.0) {
            // Front pectoral curve
            z += Math.sin(theta) * Math.sin(theta) * 0.15;
          } else {
            // Back scapular plane
            z -= (1.0 - Math.abs(sinT)) * 0.12;
          }
        }

        vertices.push(x, s.y, z);
      }
    }

    // Connect rings into quad strip triangles
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

  private generateMidlinePoints(): THREE.Vector3[] {
    // Continuous Sagittal Midline Profile Curve (X = 0)
    return [
      new THREE.Vector3(0.0,  3.40, -0.15), // Vertex Apex
      new THREE.Vector3(0.0,  3.15,  0.85),
      new THREE.Vector3(0.0,  2.75,  1.55), // Forehead
      new THREE.Vector3(0.0,  2.30,  1.90), // Glabella
      new THREE.Vector3(0.0,  1.90,  2.15), // Brow
      new THREE.Vector3(0.0,  1.60,  2.52), // Nasion
      new THREE.Vector3(0.0,  1.30,  2.85), // Pronasale (Nose Tip)
      new THREE.Vector3(0.0,  1.05,  2.45), // Subnasale
      new THREE.Vector3(0.0,  0.85,  2.58), // Upper Lip
      new THREE.Vector3(0.0,  0.68,  2.46), // Stomion
      new THREE.Vector3(0.0,  0.50,  2.52), // Lower Lip
      new THREE.Vector3(0.0,  0.28,  2.32), // Labiomental Crease
      new THREE.Vector3(0.0, -0.02,  2.42), // Chin Pogonion
      new THREE.Vector3(0.0, -0.40,  1.85), // Mandible Submental
      new THREE.Vector3(0.0, -0.85,  1.25), // Hyoid
      new THREE.Vector3(0.0, -1.40,  1.05), // Adam's Apple
      new THREE.Vector3(0.0, -1.95,  0.95), // Cricoid
      new THREE.Vector3(0.0, -2.50,  0.88), // Trachea
      new THREE.Vector3(0.0, -3.00,  0.85), // Suprasternal Notch
      new THREE.Vector3(0.0, -3.45,  0.95), // Clavicle
      new THREE.Vector3(0.0, -3.85,  1.15), // Upper Sternum
      new THREE.Vector3(0.0, -4.25,  1.30), // Mid Sternum
      new THREE.Vector3(0.0, -4.60,  1.40), // Xiphoid
      new THREE.Vector3(0.0, -4.85,  1.45), // Sternal Base
    ];
  }

  private createContactShadowMesh(): THREE.Mesh {
    // Soft Radial Ground Contact Shadow Disk on Floor Datum Plane
    const shadowGeom = new THREE.PlaneGeometry(6.5, 4.2);
    shadowGeom.rotateX(-Math.PI / 2);

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
      grad.addColorStop(0.0, 'rgba(0, 0, 0, 0.75)');
      grad.addColorStop(0.35, 'rgba(0, 15, 30, 0.50)');
      grad.addColorStop(0.70, 'rgba(0, 30, 60, 0.18)');
      grad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 256, 256);
    }

    const texture = new THREE.CanvasTexture(canvas);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      depthTest: true,
    });

    const mesh = new THREE.Mesh(shadowGeom, shadowMat);
    mesh.position.set(0.0, -4.84, 0.15); // Directly at datum floor base
    return mesh;
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
    this.midlineProfileLine.geometry.dispose();
    (this.midlineProfileLine.material as THREE.Material).dispose();
    this.contactShadowMesh.geometry.dispose();
    (this.contactShadowMesh.material as THREE.Material).dispose();
    this.leaderLinesGroup.traverse((child) => {
      if (child instanceof THREE.Line) {
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
      }
    });
    this.sprites.forEach((s) => {
      s.material.map?.dispose();
      s.material.dispose();
    });
  }
}
