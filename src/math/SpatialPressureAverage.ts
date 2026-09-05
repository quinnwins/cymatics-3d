/** Trailing time-weighted mean p² at FIXED spatial positions, not mean geometry.
 * Samples are piecewise constant until the next observation. Retains one second
 * for window changes. A >200 ms sampling gap discards unobserved history. */
export class SpatialPressureAverage {
  public readonly meanSquare: Float32Array;
  public coverageSeconds = 0;
  public windowSeconds = 0.2;
  private history: { duration: number; square: Float32Array }[] = [];
  private retained = 0;
  private previous: Float32Array | null = null;
  private previousTime = 0;

  constructor(public readonly pointCount: number) {
    this.meanSquare = new Float32Array(pointCount);
  }

  public setWindow(seconds: number): void {
    this.windowSeconds = Math.max(0.05, Math.min(1, seconds));
    this.calculate();
  }

  public push(time: number, pressure: Float32Array): void {
    if (pressure.length !== this.pointCount) throw new Error('Spatial grid size changed');
    const dt = time - this.previousTime;
    if (this.previous && dt === 0) return;
    if (dt < 0 || dt > 0.2) this.reset();
    if (this.previous) {
      this.history.push({ duration: dt, square: this.previous });
      this.retained += dt;
      let excess = this.retained - 1;
      while (excess > 1e-10 && this.history.length) {
        const first = this.history[0], trim = Math.min(excess, first.duration);
        first.duration -= trim;
        this.retained -= trim;
        excess -= trim;
        if (first.duration < 1e-10) this.history.shift();
      }
    }
    this.previous = Float32Array.from(pressure, value => value * value);
    this.previousTime = time;
    this.calculate();
  }

  private calculate(): void {
    this.meanSquare.fill(0);
    this.coverageSeconds = Math.min(this.retained, this.windowSeconds);
    let remaining = this.coverageSeconds;
    for (let i = this.history.length - 1; i >= 0 && remaining > 1e-10; i--) {
      const { duration, square } = this.history[i];
      const weight = Math.min(duration, remaining) / this.coverageSeconds;
      for (let j = 0; j < this.pointCount; j++) this.meanSquare[j] += weight * square[j];
      remaining -= Math.min(duration, remaining);
    }
  }

  public reset(): void {
    this.history = [];
    this.previous = null;
    this.retained = 0;
    this.coverageSeconds = 0;
    this.meanSquare.fill(0);
  }
}
