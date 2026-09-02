import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { AnamnesisField } from './AnamnesisField';
import { ColorPalettes } from './ColorPalettes';
import type { EchoThread, MemoryPoint } from './AnamnesisModel';

function point(id: number, position: [number, number, number], familyId = -1): MemoryPoint {
  return {
    id,
    timeSeconds: id * 2,
    progress: id / 3,
    position,
    energy: 0.62,
    novelty: id === 2 ? 0.8 : 0.2,
    centroid: 0.45,
    pitchClass: id * 2,
    familyId,
    echoStrength: familyId >= 0 ? 0.94 : 0,
  };
}

describe('AnamnesisField', () => {
  it('renders a chronology and non-local echo threads from deterministic memory data', () => {
    const field = new AnamnesisField(ColorPalettes.getPalette('cosmic-nebula'));
    const points = [
      point(0, [4, 0, 0], 0),
      point(1, [0, 0.5, 4]),
      point(2, [-4, 1, 0], 0),
    ];
    const threads: EchoThread[] = [{
      id: 0,
      from: 2,
      to: 0,
      similarity: 0.94,
      harmonicSimilarity: 0.96,
      timbralSimilarity: 0.9,
      transposition: 0,
      familyId: 0,
      timeGapSeconds: 4,
    }];

    field.setData(points, threads);
    expect(field.getRenderedPointCount()).toBe(3);
    expect(field.getRenderedThreadCount()).toBe(1);
    expect(field.points.geometry.drawRange.count).toBe(3);
    expect(field.aura.geometry).toBe(field.points.geometry);
    expect(field.threads.geometry.drawRange.count).toBe(2);

    field.celebrateReturn(threads[0]);
    field.setExpanded(true);
    field.update(2, 0.25, 900);
    expect(field.group.visible).toBe(true);
    expect(field.beacon.position.toArray()).toEqual(points[2].position);
    const aura = field.aura.material as THREE.ShaderMaterial;
    expect(aura.uniforms.uLayer.value).toBe(1);
    expect(aura.uniforms.uOpacity.value).toBeGreaterThan(0);
    expect(aura.uniforms.uPointScale.value).toBe(1);

    field.dispose();
  });

  it('compacts invalid echo references instead of drawing stale thread segments', () => {
    const field = new AnamnesisField(ColorPalettes.getPalette('cosmic-nebula'));
    const points = [
      point(0, [4, 0, 0], 0),
      point(1, [0, 0.5, 4], 0),
    ];
    const threads: EchoThread[] = [
      {
        id: 0,
        from: 99,
        to: 0,
        similarity: 0.99,
        harmonicSimilarity: 0.99,
        timbralSimilarity: 0.99,
        transposition: 0,
        familyId: 0,
        timeGapSeconds: 8,
      },
      {
        id: 1,
        from: 1,
        to: 0,
        similarity: 0.93,
        harmonicSimilarity: 0.94,
        timbralSimilarity: 0.9,
        transposition: 2,
        familyId: 0,
        timeGapSeconds: 4,
      },
    ];

    field.setData(points, threads);

    expect(field.getRenderedThreadCount()).toBe(1);
    expect(field.threads.geometry.drawRange.count).toBe(2);
    const positions = field.threads.geometry.getAttribute('position') as THREE.BufferAttribute;
    expect([positions.getX(0), positions.getY(0), positions.getZ(0)]).toEqual(points[1].position);
    expect([positions.getX(1), positions.getY(1), positions.getZ(1)]).toEqual(points[0].position);

    field.dispose();
  });

  it('accepts palette changes and empty data without reallocating its core geometry', () => {
    const field = new AnamnesisField(ColorPalettes.getPalette('cosmic-nebula'));
    const geometry = field.points.geometry;
    field.setData([], []);
    field.setPalette(ColorPalettes.getPalette('solar-flare'));
    field.setEnabled(false);
    field.update(1, 1, 720);

    expect(field.points.geometry).toBe(geometry);
    expect(field.aura.geometry).toBe(geometry);
    expect(field.getRenderedPointCount()).toBe(0);
    expect(field.chronology).toBeInstanceOf(THREE.Line);

    field.dispose();
  });
});
