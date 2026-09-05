import { describe, expect, it } from 'vitest';
import { SpatialPressureAverage } from './SpatialPressureAverage';
import { cartesianPressure, sampleCartesianPressure } from './CartesianPressureField';

describe('fixed-position spatial mean square', () => {
  it('squares before averaging so opposite phases do not cancel', () => {
    const avg = new SpatialPressureAverage(2);
    avg.push(0, new Float32Array([1, 0]));
    avg.push(0.1, new Float32Array([-1, 2]));
    avg.push(0.2, new Float32Array([-1, 2]));
    expect(avg.meanSquare[0]).toBeCloseTo(1);
    expect(avg.meanSquare[1]).toBeCloseTo(2);
  });
  it('does not falsely hold a node that moved to another position', () => {
    const avg = new SpatialPressureAverage(2);
    avg.push(0, new Float32Array([0, 1]));
    avg.push(0.1, new Float32Array([1, 0]));
    avg.push(0.2, new Float32Array([1, 0]));
    expect([...avg.meanSquare]).toEqual([0.5, 0.5]);
  });
  it('time-weights and fractionally trims the selected window', () => {
    const avg = new SpatialPressureAverage(1);
    avg.push(0, new Float32Array([1]));
    avg.push(0.075, new Float32Array([2]));
    avg.push(0.225, new Float32Array([2]));
    expect(avg.meanSquare[0]).toBeCloseTo((0.05 + 0.15 * 4) / 0.2);
    avg.setWindow(0.05);
    expect(avg.meanSquare[0]).toBeCloseTo(4);
  });
  it('restarts after a missing observation interval', () => {
    const avg = new SpatialPressureAverage(1);
    avg.push(0, new Float32Array([1]));
    avg.push(0.1, new Float32Array([1]));
    avg.push(2, new Float32Array([2]));
    expect(avg.coverageSeconds).toBe(0);
    avg.push(2.1, new Float32Array([2]));
    expect(avg.meanSquare[0]).toBeCloseTo(4);
  });
  it('samples the original field at fixed grid coordinates', () => {
    const n = 9, modes = [2, 4, 6];
    const grid = sampleCartesianPressure(n, modes, 0.3, 0.6);
    for (let z = 0; z < n; z++) for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      expect(grid[x + n * (y + n * z)]).toBeCloseTo(cartesianPressure(x / 4 - 1, y / 4 - 1, z / 4 - 1, modes, 0.3, 0.6), 6);
    }
  });
  it('preserves stationary-field energy across different sampling rates', () => {
    for (const rate of [20, 30, 60]) {
      const avg = new SpatialPressureAverage(1);
      for (let i = 0; i <= rate; i++) avg.push(i / rate, new Float32Array([0.7]));
      expect(avg.meanSquare[0]).toBeCloseTo(0.49, 5);
    }
  });
});
