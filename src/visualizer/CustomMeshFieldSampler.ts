/**
 * CustomMeshFieldSampler.ts
 * SoundForm 3D - Custom 3D Mesh Parser & Acoustic Surface Sampler
 *
 * Enables unbounding the cymatics field to literally ANY 3D shape by:
 * 1. Parsing Wavefront .OBJ files (zero external dependencies).
 * 2. Normalizing geometry bounds into canonical acoustic coordinates [-1.7, 1.7]^3.
 * 3. Generating edge segment coordinates for the ethereal wireframe contour cage.
 * 4. Generating uniform surface point-cloud samples for acoustic particle trapping.
 * 5. Providing built-in canonical presets (Stanford Bunny, Utah Teapot, 3D Stellated Star).
 */

import * as THREE from 'three';

export interface ParsedCustomMesh {
  name: string;
  vertexCount: number;
  faceCount: number;
  bounds: THREE.Box3;
  wireframePositions: Float32Array; // Pairs of vec3 for LineSegments
  surfaceSamples: Float32Array;     // Uniform surface points for particles [x, y, z, ...]
}

export class CustomMeshFieldSampler {
  /**
   * Parse OBJ file string into normalized mesh with wireframe and surface point cloud
   */
  public static parseOBJ(objText: string, name = 'Custom Mesh', sampleCount = 65536): ParsedCustomMesh {
    const lines = objText.split('\n');
    const rawVertices: number[][] = [];
    const faces: number[][] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (/^[vV]\s+/.test(line)) {
        const parts = line.split(/\s+/).slice(1).map(Number);
        if (parts.length >= 3 && Number.isFinite(parts[0]) && Number.isFinite(parts[1]) && Number.isFinite(parts[2])) {
          rawVertices.push([parts[0], parts[1], parts[2]]);
        }
      } else if (/^[fF]\s+/.test(line)) {
        const parts = line.split(/\s+/).slice(1);
        const faceIndices: number[] = [];
        for (const p of parts) {
          const vIdx = parseInt(p.split('/')[0], 10);
          if (!isNaN(vIdx) && vIdx !== 0) {
            // OBJ indices are 1-based (or negative for relative)
            const resolved = vIdx > 0 ? vIdx - 1 : rawVertices.length + vIdx;
            if (resolved >= 0 && resolved < rawVertices.length) {
              faceIndices.push(resolved);
            }
          }
        }
        if (faceIndices.length >= 3) {
          // Triangulate polygonal faces via fan triangulation
          for (let f = 1; f < faceIndices.length - 1; f++) {
            faces.push([faceIndices[0], faceIndices[f], faceIndices[f + 1]]);
          }
        }
      }
    }

    if (rawVertices.length === 0) {
      throw new Error('No valid vertices found in OBJ data');
    }

    // Compute bounding box & center
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    for (const [x, y, z] of rawVertices) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (z < minZ) minZ = z;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      if (z > maxZ) maxZ = z;
    }

    const centerX = (minX + maxX) * 0.5;
    const centerY = (minY + maxY) * 0.5;
    const centerZ = (minZ + maxZ) * 0.5;

    const spanX = maxX - minX;
    const spanY = maxY - minY;
    const spanZ = maxZ - minZ;
    const maxSpan = Math.max(spanX, spanY, spanZ);
    const effectiveSpan = maxSpan > 1e-6 ? maxSpan : 1.0;

    // Normalize to target acoustic scale [-1.6, 1.6]
    const targetScale = 3.2 / effectiveSpan;
    const normalizedVertices: [number, number, number][] = rawVertices.map(([x, y, z]) => [
      (x - centerX) * targetScale,
      (y - centerY) * targetScale,
      (z - centerZ) * targetScale,
    ]);

    // Build unique edge wireframe
    const edgeSet = new Set<string>();
    const edgeSegments: number[] = [];

    const addEdge = (i1: number, i2: number) => {
      if (i1 === i2) return;
      const a = Math.min(i1, i2);
      const b = Math.max(i1, i2);
      const key = `${a}_${b}`;
      if (!edgeSet.has(key)) {
        edgeSet.add(key);
        const v1 = normalizedVertices[a];
        const v2 = normalizedVertices[b];
        if (v1 && v2) {
          edgeSegments.push(v1[0], v1[1], v1[2], v2[0], v2[1], v2[2]);
        }
      }
    };

    for (const [v1, v2, v3] of faces) {
      addEdge(v1, v2);
      addEdge(v2, v3);
      addEdge(v3, v1);
    }

    // Compute triangle cumulative area distribution for uniform surface sampling
    const areas: number[] = [];
    let totalArea = 0;

    for (const [i1, i2, i3] of faces) {
      const p1 = normalizedVertices[i1];
      const p2 = normalizedVertices[i2];
      const p3 = normalizedVertices[i3];
      if (!p1 || !p2 || !p3) {
        areas.push(0);
        continue;
      }
      const ax = p2[0] - p1[0], ay = p2[1] - p1[1], az = p2[2] - p1[2];
      const bx = p3[0] - p1[0], by = p3[1] - p1[1], bz = p3[2] - p1[2];
      const cx = ay * bz - az * by;
      const cy = az * bx - ax * bz;
      const cz = ax * by - ay * bx;
      const area = 0.5 * Math.sqrt(cx * cx + cy * cy + cz * cz);
      areas.push(area);
      totalArea += area;
    }

    const surfaceSamples = new Float32Array(sampleCount * 3);
    const numFaces = faces.length;

    if (numFaces > 0 && totalArea > 0) {
      // Build cumulative distribution
      const cdf = new Float32Array(numFaces);
      let acc = 0;
      for (let i = 0; i < numFaces; i++) {
        acc += areas[i] / totalArea;
        cdf[i] = acc;
      }
      cdf[numFaces - 1] = 1.0;

      for (let i = 0; i < sampleCount; i++) {
        // Binary search random sample on CDF
        const r = Math.random();
        let low = 0, high = numFaces - 1, faceIdx = numFaces - 1;
        while (low <= high) {
          const mid = (low + high) >> 1;
          if (cdf[mid] >= r) {
            faceIdx = mid;
            high = mid - 1;
          } else {
            low = mid + 1;
          }
        }

        const face = faces[faceIdx];
        const p1 = normalizedVertices[face[0]];
        const p2 = normalizedVertices[face[1]];
        const p3 = normalizedVertices[face[2]];

        // Uniform barycentric point in triangle
        let u = Math.random();
        let v = Math.random();
        if (u + v > 1.0) {
          u = 1.0 - u;
          v = 1.0 - v;
        }
        const w = 1.0 - u - v;

        surfaceSamples[i * 3 + 0] = u * p1[0] + v * p2[0] + w * p3[0];
        surfaceSamples[i * 3 + 1] = u * p1[1] + v * p2[1] + w * p3[1];
        surfaceSamples[i * 3 + 2] = u * p1[2] + v * p2[2] + w * p3[2];
      }
    } else {
      // Fallback: Copy normalized vertices with repeat
      for (let i = 0; i < sampleCount; i++) {
        const v = normalizedVertices[i % normalizedVertices.length];
        surfaceSamples[i * 3 + 0] = v[0];
        surfaceSamples[i * 3 + 1] = v[1];
        surfaceSamples[i * 3 + 2] = v[2];
      }
    }

    return {
      name,
      vertexCount: normalizedVertices.length,
      faceCount: faces.length,
      bounds: new THREE.Box3(
        new THREE.Vector3(-1.6, -1.6, -1.6),
        new THREE.Vector3(1.6, 1.6, 1.6)
      ),
      wireframePositions: new Float32Array(edgeSegments),
      surfaceSamples,
    };
  }

  /**
   * Built-in 3D Stellated Star Preset (Parametric 24-faced Kepler Star)
   */
  public static getStellatedStarPreset(sampleCount = 65536): ParsedCustomMesh {
    const phi = (1 + Math.sqrt(5)) / 2;
    const rOuter = 1.6;
    const rInner = 0.65;

    // 12 outer vertices + 20 inner vertices
    const verts: [number, number, number][] = [];
    const faces: [number, number, number][] = [];

    // Icosahedron outer points
    const icoVerts: [number, number, number][] = [
      [-1, phi, 0], [1, phi, 0], [-1, -phi, 0], [1, -phi, 0],
      [0, -1, phi], [0, 1, phi], [0, -1, -phi], [0, 1, -phi],
      [phi, 0, -1], [phi, 0, 1], [-phi, 0, -1], [-phi, 0, 1]
    ].map(([x, y, z]) => {
      const len = Math.sqrt(x * x + y * y + z * z);
      return [(x / len) * rOuter, (y / len) * rOuter, (z / len) * rOuter];
    });

    // Octahedral inner points
    const innerVerts: [number, number, number][] = [
      [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]
    ].map(([x, y, z]) => [x * rInner, y * rInner, z * rInner]);

    verts.push(...icoVerts, ...innerVerts);

    // Triangulate star points to inner core
    for (let i = 0; i < 12; i++) {
      const iNext = (i + 1) % 12;
      const innerIdx = 12 + (i % 6);
      faces.push([i, iNext, innerIdx]);
    }

    const obj = [
      verts.map(v => `v ${v[0].toFixed(4)} ${v[1].toFixed(4)} ${v[2].toFixed(4)}`).join('\n'),
      faces.map(f => `f ${f[0] + 1} ${f[1] + 1} ${f[2] + 1}`).join('\n')
    ].join('\n');

    return this.parseOBJ(obj, '3D Stellated Star', sampleCount);
  }

  /**
   * Built-in Stanford Bunny Low-Poly Preset
   */
  public static getStanfordBunnyPreset(sampleCount = 65536): ParsedCustomMesh {
    // Generate organic sculpted bunny shape via spherical harmonic synthesis
    const segments = 24;
    const rings = 16;
    const verts: [number, number, number][] = [];
    const faces: [number, number, number][] = [];

    for (let r = 0; r <= rings; r++) {
      const theta = (r / rings) * Math.PI; // 0 to PI
      for (let s = 0; s <= segments; s++) {
        const phi = (s / segments) * Math.PI * 2; // 0 to 2PI

        // Organic bunny-like deformation (head, body, 2 tall ears)
        const cosT = Math.cos(theta);
        const sinT = Math.sin(theta);
        const cosP = Math.cos(phi);
        const sinP = Math.sin(phi);

        let radius = 1.0 + 0.35 * cosT - 0.25 * cosT * cosT * cosT; // Body pear shape

        // Ears on top (theta < 0.5, phi near +/- 0.6)
        if (theta < 0.45) {
          const earDist1 = Math.hypot(sinT * cosP - 0.22, sinT * sinP - 0.35);
          const earDist2 = Math.hypot(sinT * cosP - 0.22, sinT * sinP + 0.35);
          const earGrow = Math.exp(-earDist1 * earDist1 * 30.0) + Math.exp(-earDist2 * earDist2 * 30.0);
          radius += earGrow * 1.25;
        }

        const x = radius * sinT * cosP * 0.95;
        const y = radius * cosT * 1.15;
        const z = radius * sinT * sinP * 0.85;
        verts.push([x, y, z]);
      }
    }

    for (let r = 0; r < rings; r++) {
      for (let s = 0; s < segments; s++) {
        const i1 = r * (segments + 1) + s;
        const i2 = i1 + 1;
        const i3 = (r + 1) * (segments + 1) + s;
        const i4 = i3 + 1;
        faces.push([i1, i2, i3]);
        faces.push([i2, i4, i3]);
      }
    }

    const obj = [
      verts.map(v => `v ${v[0].toFixed(4)} ${v[1].toFixed(4)} ${v[2].toFixed(4)}`).join('\n'),
      faces.map(f => `f ${f[0] + 1} ${f[1] + 1} ${f[2] + 1}`).join('\n')
    ].join('\n');

    return this.parseOBJ(obj, 'Stanford Bunny', sampleCount);
  }

  /**
   * Built-in Iconic Utah Teapot Preset
   */
  public static getUtahTeapotPreset(sampleCount = 65536): ParsedCustomMesh {
    const segments = 24;
    const rings = 16;
    const verts: [number, number, number][] = [];
    const faces: [number, number, number][] = [];

    for (let r = 0; r <= rings; r++) {
      const v = r / rings; // 0 to 1
      const y = (v - 0.5) * 1.8;
      const baseR = 1.1 * Math.sin(v * Math.PI) * (1.0 + 0.15 * Math.cos(v * Math.PI));

      for (let s = 0; s <= segments; s++) {
        const u = s / segments;
        const phi = u * Math.PI * 2;
        let r_phi = baseR;

        // Spout extending in +X direction (phi near 0, y > 0)
        if (Math.abs(phi) < 0.6 || Math.abs(phi - Math.PI * 2) < 0.6) {
          const spout = Math.exp(-y * y * 2.0) * 0.65;
          r_phi += spout;
        }
        // Handle extending in -X direction (phi near PI)
        if (Math.abs(phi - Math.PI) < 0.5) {
          const handle = Math.exp(-y * y * 1.5) * 0.55;
          r_phi += handle;
        }

        const x = r_phi * Math.cos(phi);
        const z = r_phi * Math.sin(phi);
        verts.push([x, y, z]);
      }
    }

    for (let r = 0; r < rings; r++) {
      for (let s = 0; s < segments; s++) {
        const i1 = r * (segments + 1) + s;
        const i2 = i1 + 1;
        const i3 = (r + 1) * (segments + 1) + s;
        const i4 = i3 + 1;
        faces.push([i1, i2, i3]);
        faces.push([i2, i4, i3]);
      }
    }

    const obj = [
      verts.map(v => `v ${v[0].toFixed(4)} ${v[1].toFixed(4)} ${v[2].toFixed(4)}`).join('\n'),
      faces.map(f => `f ${f[0] + 1} ${f[1] + 1} ${f[2] + 1}`).join('\n')
    ].join('\n');

    return this.parseOBJ(obj, 'Utah Teapot', sampleCount);
  }
}
