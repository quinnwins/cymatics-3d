/**
 * ModalOscillatorBank.ts
 * Real-Time Audio-Driven State-Space Modal Oscillator Bank
 *
 * Implements M parallel second-order harmonic oscillator ODEs:
 *   d^2 q_j/dt^2 + 2 * zeta_j * omega_j * dq_j/dt + omega_j^2 * q_j = C_j * s(t)
 *
 * Uses unconditionally stable exact state-transition exponential integration.
 * Zero-GC execution guaranteed in the 120 FPS render loop.
 */

export interface ModalOscillatorConfig {
  modeCount?: number;
  qualityFactor?: number; // Default Q factor (damping zeta = 1 / (2Q))
  gain?: number;
}

export class ModalOscillatorBank {
  public readonly modeCount: number;
  public readonly frequencies: Float32Array;      // omega_j = 2 * pi * f_j (rad/s)
  public readonly damping: Float32Array;          // zeta_j
  public readonly qualityFactors: Float32Array;   // Q_j
  public readonly amplitudes: Float32Array;       // q_j (position)
  public readonly velocities: Float32Array;       // dq_j/dt (velocity)
  public readonly couplings: Float32Array;        // C_j (spatial source coupling)

  private gain = 1.0;

  constructor(modeCount = 32, defaultQ = 40.0) {
    this.modeCount = Math.max(1, modeCount);
    this.frequencies = new Float32Array(this.modeCount);
    this.damping = new Float32Array(this.modeCount);
    this.qualityFactors = new Float32Array(this.modeCount);
    this.amplitudes = new Float32Array(this.modeCount);
    this.velocities = new Float32Array(this.modeCount);
    this.couplings = new Float32Array(this.modeCount);

    // Initialize default harmonic spectrum with natural Q damping
    for (let i = 0; i < this.modeCount; i++) {
      const f = 60.0 * Math.pow(1.12, i); // Logarithmically distributed modal frequencies (60 Hz to ~2 kHz)
      this.frequencies[i] = 2.0 * Math.PI * f;
      this.qualityFactors[i] = defaultQ * (1.0 + 0.2 * (i % 3));
      this.damping[i] = 1.0 / (2.0 * this.qualityFactors[i]);
      this.couplings[i] = 1.0 / (1.0 + 0.08 * i);
    }
  }

  /**
   * Configures exact cavity eigenfrequencies and source couplings.
   */
  public setModalParameters(
    frequenciesHz: ArrayLike<number>,
    couplings?: ArrayLike<number>,
    qualityFactors?: ArrayLike<number>
  ): void {
    const count = Math.min(this.modeCount, frequenciesHz.length);
    for (let i = 0; i < count; i++) {
      const fHz = Math.max(1.0, frequenciesHz[i]);
      this.frequencies[i] = 2.0 * Math.PI * fHz;
      if (qualityFactors && i < qualityFactors.length) {
        this.qualityFactors[i] = Math.max(1.0, qualityFactors[i]);
      }
      this.damping[i] = 1.0 / (2.0 * this.qualityFactors[i]);
      if (couplings && i < couplings.length) {
        this.couplings[i] = couplings[i];
      }
    }
  }

  public setGain(gain: number): void {
    this.gain = Math.max(0, gain);
  }

  public getGain(): number {
    return this.gain;
  }

  /**
   * Advances the modal oscillators by dt seconds using an exact exponential integrator.
   * Accepts either an instantaneous scalar sample or a Float32Array time-domain audio buffer.
   */
  public update(dt: number, input: number | Float32Array): void {
    if (dt <= 0) return;

    // Sub-sample drive force from input buffer or scalar
    let driveForce = 0;
    if (typeof input === 'number') {
      driveForce = input * this.gain;
    } else if (input && input.length > 0) {
      // Fast RMS computation of the recent PCM slice
      let sumSq = 0;
      const step = Math.max(1, Math.floor(input.length / 64));
      let count = 0;
      for (let k = 0; k < input.length; k += step) {
        const val = input[k];
        sumSq += val * val;
        count++;
      }
      const rms = count > 0 ? Math.sqrt(sumSq / count) : 0;
      driveForce = rms * 3.5 * this.gain;
    }

    // Integrate each oscillator via exact state transition
    const M = this.modeCount;
    for (let j = 0; j < M; j++) {
      const omega0 = this.frequencies[j];
      const zeta = this.damping[j];
      const q0 = this.amplitudes[j];
      const v0 = this.velocities[j];
      const force = driveForce * this.couplings[j];

      // Damped angular frequency: omega_d = omega_0 * sqrt(1 - zeta^2)
      const zetaSq = zeta * zeta;
      const alpha = zeta * omega0; // Decay rate
      const omega0Sq = omega0 * omega0;
      const qEquilibrium = force / Math.max(omega0Sq, 1e-4);

      const expDecay = Math.exp(-alpha * dt);

      if (zetaSq < 1.0) {
        // Underdamped oscillation (physical resonant cavity acoustic modes)
        const omegaD = omega0 * Math.sqrt(1.0 - zetaSq);
        const cosWd = Math.cos(omegaD * dt);
        const sinWd = Math.sin(omegaD * dt);

        const deltaQ = q0 - qEquilibrium;
        const c1 = deltaQ;
        const c2 = (v0 + alpha * deltaQ) / Math.max(omegaD, 1e-4);

        const qNew = expDecay * (c1 * cosWd + c2 * sinWd) + qEquilibrium;
        const vNew = expDecay * (
          (-alpha * c1 + omegaD * c2) * cosWd +
          (-alpha * c2 - omegaD * c1) * sinWd
        );

        this.amplitudes[j] = qNew;
        this.velocities[j] = vNew;
      } else {
        // Overdamped / critically damped fallback
        const deltaQ = q0 - qEquilibrium;
        const qNew = expDecay * (deltaQ + (v0 + alpha * deltaQ) * dt) + qEquilibrium;
        const vNew = expDecay * (v0 - alpha * (v0 + alpha * deltaQ) * dt);

        this.amplitudes[j] = qNew;
        this.velocities[j] = vNew;
      }
    }
  }

  public getAmplitudes(): Float32Array {
    return this.amplitudes;
  }

  public reset(): void {
    this.amplitudes.fill(0);
    this.velocities.fill(0);
  }
}
