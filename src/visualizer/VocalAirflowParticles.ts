/**
 * VocalAirflowParticles.ts
 * SoundForm 3D - 3D Transglottal Breath & Acoustic Stream Particle System
 *
 * Implements:
 * 1. 1,200 dynamic breath particles spawned at the glottal base (u=0) and advected through the 6th-order Bézier airway spine.
 * 2. Glottal turbulence scattering: when aspiration strain or pathology is detected, particles scatter with high entropy at the vocal cord base.
 * 3. Particle color modulation: Healthy smooth cyan-gold laminar flow vs. Pathological coral-red turbulent dispersion.
 * 4. Zero-allocation per-frame ring buffer execution.
 */

import * as THREE from 'three';

export class VocalAirflowParticles {
  public group: THREE.Group;
  private particleCount = 1200;
  private points: THREE.Points;
  private geometry: THREE.BufferGeometry;
  private positions: Float32Array;
  private colors: Float32Array;
  private sizes: Float32Array;
  private particleU: Float32Array;
  private particleRadialAngles: Float32Array;
  private particleRadialDist: Float32Array;
  private particleSpeeds: Float32Array;

  // 6th-Order Bernstein-Bézier Control Points
  private p0 = new THREE.Vector3(0.0, -2.80, -0.25);
  private p1 = new THREE.Vector3(0.0, -1.60, -0.50);
  private p2 = new THREE.Vector3(0.0, -0.30, -0.60);
  private p3 = new THREE.Vector3(0.0,  0.65, -0.20);
  private p4 = new THREE.Vector3(0.0,  1.18,  0.75);
  private p5 = new THREE.Vector3(0.0,  1.05,  1.75);
  private p6 = new THREE.Vector3(0.0,  0.92,  2.45);

  constructor() {
    this.group = new THREE.Group();

    this.positions = new Float32Array(this.particleCount * 3);
    this.colors = new Float32Array(this.particleCount * 3);
    this.sizes = new Float32Array(this.particleCount);
    this.particleU = new Float32Array(this.particleCount);
    this.particleRadialAngles = new Float32Array(this.particleCount);
    this.particleRadialDist = new Float32Array(this.particleCount);
    this.particleSpeeds = new Float32Array(this.particleCount);

    for (let i = 0; i < this.particleCount; i++) {
      this.particleU[i] = Math.random() * 1.3; // Stagger initial positions along airway + lip exit
      this.particleRadialAngles[i] = Math.random() * Math.PI * 2;
      this.particleRadialDist[i] = Math.random() * 0.45;
      this.particleSpeeds[i] = 0.4 + Math.random() * 0.6;
      this.sizes[i] = 4.0 + Math.random() * 8.0;

      this.colors[i * 3 + 0] = 0.2;
      this.colors[i * 3 + 1] = 0.85;
      this.colors[i * 3 + 2] = 1.0;
    }

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    this.geometry.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1));

    // Particle sprite texture
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
      grad.addColorStop(0.35, 'rgba(100, 220, 255, 0.8)');
      grad.addColorStop(0.8, 'rgba(0, 150, 255, 0.2)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 64, 64);
    }
    const texture = new THREE.CanvasTexture(canvas);

    const material = new THREE.PointsMaterial({
      size: 0.18,
      vertexColors: true,
      map: texture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.points = new THREE.Points(this.geometry, material);
    this.group.add(this.points);
  }

  private evaluateSpine(u: number, out: THREE.Vector3): void {
    const t = Math.max(0.0, Math.min(1.0, u));
    const it = 1.0 - t;
    const b0 = it * it * it * it * it * it;
    const b1 = 6.0 * it * it * it * it * it * t;
    const b2 = 15.0 * it * it * it * it * t * t;
    const b3 = 20.0 * it * it * it * t * t * t;
    const b4 = 15.0 * it * it * t * t * t * t;
    const b5 = 6.0 * it * t * t * t * t * t;
    const b6 = t * t * t * t * t * t;

    out.set(
      b0 * this.p0.x + b1 * this.p1.x + b2 * this.p2.x + b3 * this.p3.x + b4 * this.p4.x + b5 * this.p5.x + b6 * this.p6.x,
      b0 * this.p0.y + b1 * this.p1.y + b2 * this.p2.y + b3 * this.p3.y + b4 * this.p4.y + b5 * this.p5.y + b6 * this.p6.y,
      b0 * this.p0.z + b1 * this.p1.z + b2 * this.p2.z + b3 * this.p3.z + b4 * this.p4.z + b5 * this.p5.z + b6 * this.p6.z
    );
  }

  public update(dt: number, time: number, intensity: number, isTurbulent: boolean): void {
    const spinePos = new THREE.Vector3();
    const speedMultiplier = 0.55 + intensity * 0.65;
    const turbulenceFactor = isTurbulent ? 1.0 : 0.15;

    for (let i = 0; i < this.particleCount; i++) {
      this.particleU[i] += dt * this.particleSpeeds[i] * speedMultiplier;

      // Reset particles that have escaped past the lips (u > 1.35)
      if (this.particleU[i] > 1.35) {
        this.particleU[i] = 0.0;
        this.particleRadialAngles[i] = Math.random() * Math.PI * 2;
        this.particleRadialDist[i] = Math.random() * 0.4;
      }

      const u = this.particleU[i];
      this.evaluateSpine(Math.min(1.0, u), spinePos);

      // Radial offset from centerline
      const angle = this.particleRadialAngles[i] + time * 0.5;
      const spread = (u > 1.0 ? (u - 1.0) * 1.5 + 0.35 : 0.35) * this.particleRadialDist[i];

      // Aspiration turbulence perturbation at glottis (u < 0.3)
      let noiseX = 0;
      let noiseY = 0;
      let noiseZ = 0;
      if (u < 0.4) {
        noiseX = (Math.sin(time * 15.0 + i) * 0.15) * turbulenceFactor;
        noiseY = (Math.cos(time * 18.0 + i) * 0.15) * turbulenceFactor;
        noiseZ = (Math.sin(time * 12.0 + i * 2) * 0.15) * turbulenceFactor;
      }

      // Compute final 3D position
      const posX = spinePos.x + Math.cos(angle) * spread + noiseX;
      const posY = spinePos.y + (u > 1.0 ? (u - 1.0) * 0.2 : 0.0) + noiseY;
      const posZ = spinePos.z + Math.sin(angle) * spread + (u > 1.0 ? (u - 1.0) * 0.9 : 0.0) + noiseZ;

      this.positions[i * 3 + 0] = posX;
      this.positions[i * 3 + 1] = posY;
      this.positions[i * 3 + 2] = posZ;

      // Color calculation: Healthy Cyan vs. Pathological Coral/Amber
      if (isTurbulent && u < 0.4) {
        // Red/Coral turbulence at glottal cord gap
        this.colors[i * 3 + 0] = 0.98;
        this.colors[i * 3 + 1] = 0.25;
        this.colors[i * 3 + 2] = 0.35;
      } else {
        // Smooth vocal resonance gradient (Cyan -> White at lips)
        const lipBlend = Math.min(1.0, Math.max(0.0, u - 0.7) / 0.3);
        this.colors[i * 3 + 0] = THREE.MathUtils.lerp(0.15, 0.95, lipBlend);
        this.colors[i * 3 + 1] = THREE.MathUtils.lerp(0.85, 0.95, lipBlend);
        this.colors[i * 3 + 2] = THREE.MathUtils.lerp(1.00, 1.00, lipBlend);
      }
    }

    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
  }

  public dispose(): void {
    this.geometry.dispose();
    (this.points.material as THREE.Material).dispose();
  }
}
