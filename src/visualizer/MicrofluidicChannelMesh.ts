/**
 * MicrofluidicChannelMesh.ts
 * SoundForm 3D - High-Precision PDMS Microfluidic Channel Mesh with IDT Transducers & 3D Annotations
 */

import * as THREE from 'three';
import { SAW_VERTEX_SHADER, SAW_FRAGMENT_SHADER } from './shaders/surfaceAcousticWaveShader';

export class MicrofluidicChannelMesh {
  public group: THREE.Group;
  private sawMesh: THREE.Mesh;
  private sawMaterial: THREE.ShaderMaterial;
  private idtLeftMesh: THREE.Group;
  private idtRightMesh: THREE.Group;
  private annotationSprites: THREE.Sprite[] = [];
  private connectorLines: THREE.LineSegments[] = [];

  constructor() {
    this.group = new THREE.Group();

    // 1. Channel Outer Wireframe & Glass Enclosure
    const channelWidth = 8.0;
    const channelHeight = 3.6;
    const channelLength = 16.0;

    // Main Channel Bounding Box Wireframe
    const channelBox = new THREE.BoxGeometry(channelWidth, channelHeight, channelLength);
    const channelEdges = new THREE.EdgesGeometry(channelBox);
    const channelWireframe = new THREE.LineSegments(
      channelEdges,
      new THREE.LineBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.35,
      })
    );
    this.group.add(channelWireframe);

    // Glass Floor Datum (Dark reflective substrate)
    const floorGeom = new THREE.PlaneGeometry(channelWidth + 0.4, channelLength + 0.4);
    const floorMat = new THREE.MeshBasicMaterial({
      color: 0x020617,
      transparent: true,
      opacity: 0.75,
      side: THREE.DoubleSide,
    });
    const floorMesh = new THREE.Mesh(floorGeom, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.y = -channelHeight * 0.5;
    this.group.add(floorMesh);

    // 2. Trident Outlet Splitters Wireframe at z = +8.0
    this.createOutletTridentGeometry();

    // 3. Inlet Funnel Nozzle Wireframe at z = -8.0
    this.createInletFunnelGeometry();

    // 4. Standing Surface Acoustic Wave (SSAW) Visual Plane
    this.sawMaterial = new THREE.ShaderMaterial({
      vertexShader: SAW_VERTEX_SHADER,
      fragmentShader: SAW_FRAGMENT_SHADER,
      uniforms: {
        uTime: { value: 0.0 },
        uFrequency: { value: 220.0 },
        uAcousticPower: { value: 1.0 },
        uNodeCount: { value: 4.0 },
        uNodeColor: { value: new THREE.Color(0x00e5ff) },     // Cyan Node Line
        uAntinodeColor: { value: new THREE.Color(0xff0055) }, // Rose Antinode
        uIdtGlowColor: { value: new THREE.Color(0xffb700) },   // Gold Transducer Wavefront
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const sawGeom = new THREE.PlaneGeometry(channelWidth, channelLength, 64, 64);
    this.sawMesh = new THREE.Mesh(sawGeom, this.sawMaterial);
    this.sawMesh.rotation.x = -Math.PI / 2;
    this.sawMesh.position.y = -channelHeight * 0.5 + 0.02;
    this.group.add(this.sawMesh);

    // 5. Interdigital Transducer (IDT) Gold Electrode Arrays (Left & Right Flanks)
    this.idtLeftMesh = this.createIdtElectrodeBank(-channelWidth * 0.5 - 0.08, 0xffaa00);
    this.idtRightMesh = this.createIdtElectrodeBank(channelWidth * 0.5 + 0.08, 0xffaa00);
    this.group.add(this.idtLeftMesh);
    this.group.add(this.idtRightMesh);

    // 6. Centerline Acoustic Pressure Node Guide Ribbon
    const nodeGuideGeom = new THREE.BufferGeometry();
    const nodeVerts = new Float32Array([
      0, -channelHeight * 0.5 + 0.04, -channelLength * 0.5,
      0, -channelHeight * 0.5 + 0.04, channelLength * 0.5,
    ]);
    nodeGuideGeom.setAttribute('position', new THREE.BufferAttribute(nodeVerts, 3));
    const nodeGuideLine = new THREE.Line(
      nodeGuideGeom,
      new THREE.LineBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.85 })
    );
    this.group.add(nodeGuideLine);

    // 7. In-Scene 3D Billboard Annotations
    this.initInSceneAnnotations();
  }

  private createOutletTridentGeometry(): void {
    // 3 Diverging Outlet Ports at z in [+4.0, +8.0]
    const splitLineMat = new THREE.LineBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.45 });
    
    // Splitter Wedge Left (x = -1.2 to -1.5)
    const wedgeLeftGeom = new THREE.BufferGeometry();
    const wedgeLeftVerts = new Float32Array([
      -1.0, -1.8, 4.0,
      -1.8, -1.8, 8.0,
      -1.0, 1.8, 4.0,
      -1.8, 1.8, 8.0,
    ]);
    wedgeLeftGeom.setAttribute('position', new THREE.BufferAttribute(wedgeLeftVerts, 3));
    this.group.add(new THREE.LineSegments(wedgeLeftGeom, splitLineMat));

    // Splitter Wedge Right (x = +1.0 to +1.8)
    const wedgeRightGeom = new THREE.BufferGeometry();
    const wedgeRightVerts = new Float32Array([
      1.0, -1.8, 4.0,
      1.8, -1.8, 8.0,
      1.0, 1.8, 4.0,
      1.8, 1.8, 8.0,
    ]);
    wedgeRightGeom.setAttribute('position', new THREE.BufferAttribute(wedgeRightVerts, 3));
    this.group.add(new THREE.LineSegments(wedgeRightGeom, splitLineMat));
  }

  private createInletFunnelGeometry(): void {
    // Hydrodynamic Focusing Funnel at z in [-8.0, -4.0]
    const funnelMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.45 });
    const funnelGeom = new THREE.BufferGeometry();
    const funnelVerts = new Float32Array([
      -3.8, -1.8, -8.0,
      -1.2, -1.8, -4.0,
      3.8, -1.8, -8.0,
      1.2, -1.8, -4.0,
      -3.8, 1.8, -8.0,
      -1.2, 1.8, -4.0,
      3.8, 1.8, -8.0,
      1.2, 1.8, -4.0,
    ]);
    funnelGeom.setAttribute('position', new THREE.BufferAttribute(funnelVerts, 3));
    this.group.add(new THREE.LineSegments(funnelGeom, funnelMat));
  }

  private createIdtElectrodeBank(xPos: number, colorHex: number): THREE.Group {
    const bank = new THREE.Group();
    const fingerCount = 20;
    const fingerLength = 0.55;
    const fingerWidth = 0.08;
    const fingerSpacing = 0.6;

    const goldMat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.85,
    });

    // Bus Bars
    const busGeom = new THREE.BoxGeometry(0.08, 0.06, 13.0);
    const busMesh = new THREE.Mesh(busGeom, goldMat);
    busMesh.position.set(xPos, -1.78, 0);
    bank.add(busMesh);

    // Comb Fingers
    const fingerGeom = new THREE.BoxGeometry(fingerLength, 0.04, fingerWidth);
    const isLeft = xPos < 0;

    for (let i = 0; i < fingerCount; i++) {
      const z = -5.7 + i * fingerSpacing;
      const finger = new THREE.Mesh(fingerGeom, goldMat);
      const xOffset = isLeft ? xPos + fingerLength * 0.5 : xPos - fingerLength * 0.5;
      finger.position.set(xOffset, -1.78, z);
      bank.add(finger);
    }

    return bank;
  }

  private initInSceneAnnotations(): void {
    // 1. Center Outlet: Purified Somatic Stream
    this.addAnnotation({
      text: 'Purified Somatic Stream',
      subtitle: 'Center Pressure Node (Φ > 0)',
      anchorPos: new THREE.Vector3(0, -1.8, 8.0),
      badgePos: new THREE.Vector3(0, 0.8, 8.2),
      accentColor: '#00e5ff',
    });

    // 2. Flanking Outlet: Deflected Cancer Stream
    this.addAnnotation({
      text: 'Deflected Cancer Stream',
      subtitle: 'Side Antinode Lanes (Φ < 0)',
      anchorPos: new THREE.Vector3(-3.2, -1.8, 8.0),
      badgePos: new THREE.Vector3(-3.6, 2.6, 8.2),
      accentColor: '#ff0055',
    });

    // 3. IDT Acoustic Emitter Array
    this.addAnnotation({
      text: 'IDT Sound Transducer',
      subtitle: 'Piezoelectric Wave Emitters',
      anchorPos: new THREE.Vector3(4.1, -1.8, 0.0),
      badgePos: new THREE.Vector3(4.4, 1.2, 0.0),
      accentColor: '#ffb700',
    });

    // 4. Inlet: Mixed Sample Inflow
    this.addAnnotation({
      text: 'Mixed Sample Inflow',
      subtitle: 'Healthy + Cancer Cells Intermixed',
      anchorPos: new THREE.Vector3(0, -1.8, -8.0),
      badgePos: new THREE.Vector3(0, 2.0, -8.2),
      accentColor: '#38bdf8',
    });
  }

  private addAnnotation(config: {
    text: string;
    subtitle: string;
    anchorPos: THREE.Vector3;
    badgePos: THREE.Vector3;
    accentColor: string;
  }): void {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 140;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Rounded Glass Badge Background
    ctx.fillStyle = 'rgba(2, 6, 23, 0.92)';
    ctx.strokeStyle = config.accentColor;
    ctx.lineWidth = 4;
    this.roundRect(ctx, 4, 4, 504, 132, 24);
    ctx.fill();
    ctx.stroke();

    // Category Dot
    ctx.fillStyle = config.accentColor;
    ctx.beginPath();
    ctx.arc(36, 50, 12, 0, Math.PI * 2);
    ctx.fill();

    // Title Text
    ctx.font = 'bold 30px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(config.text, 64, 58);

    // Subtitle Text
    ctx.font = '500 20px "JetBrains Mono", monospace';
    ctx.fillStyle = config.accentColor;
    ctx.fillText(config.subtitle, 64, 98);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;

    const spriteMat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: true,
      depthWrite: false,
    });

    const sprite = new THREE.Sprite(spriteMat);
    sprite.position.copy(config.badgePos);
    sprite.scale.set(2.7, 0.74, 1.0);
    this.annotationSprites.push(sprite);
    this.group.add(sprite);

    // Connector Line Pin from Badge to Channel Datum
    const lineGeom = new THREE.BufferGeometry();
    const linePositions = new Float32Array([
      config.badgePos.x, config.badgePos.y - 0.4, config.badgePos.z,
      config.anchorPos.x, config.anchorPos.y, config.anchorPos.z,
    ]);
    lineGeom.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
    const lineMat = new THREE.LineBasicMaterial({
      color: new THREE.Color(config.accentColor),
      transparent: true,
      opacity: 0.65,
    });
    const connector = new THREE.LineSegments(lineGeom, lineMat);
    this.connectorLines.push(connector);
    this.group.add(connector);
  }

  private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  public update(time: number, acousticFreqHz: number, acousticPower: number, nodeCount = 4): void {
    this.sawMaterial.uniforms.uTime.value = time;
    this.sawMaterial.uniforms.uFrequency.value = acousticFreqHz;
    this.sawMaterial.uniforms.uAcousticPower.value = acousticPower;
    this.sawMaterial.uniforms.uNodeCount.value = nodeCount;
  }

  public dispose(): void {
    this.sawMesh.geometry.dispose();
    this.sawMaterial.dispose();
    this.annotationSprites.forEach(sprite => {
      sprite.material.map?.dispose();
      sprite.material.dispose();
    });
    this.connectorLines.forEach(line => {
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    });
  }
}
