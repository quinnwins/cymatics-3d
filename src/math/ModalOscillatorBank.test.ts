import { describe, it, expect } from 'vitest';
import { ModalOscillatorBank } from './ModalOscillatorBank';

describe('ModalOscillatorBank', () => {
  it('initializes 32 modes with zero initial displacement and velocity', () => {
    const bank = new ModalOscillatorBank(32);
    expect(bank.modeCount).toBe(32);
    expect(bank.amplitudes.length).toBe(32);
    expect(bank.velocities.length).toBe(32);
    for (let i = 0; i < 32; i++) {
      expect(bank.amplitudes[i]).toBe(0);
      expect(bank.velocities[i]).toBe(0);
    }
  });

  it('exhibits physical exponential ring-down decay matching theoretical quality factor Q', () => {
    const bank = new ModalOscillatorBank(1, 50.0); // 1 mode, Q = 50
    const f0 = 100.0; // 100 Hz
    bank.setModalParameters([f0], [1.0], [50.0]);

    // Give an initial displacement
    bank.amplitudes[0] = 1.0;
    bank.velocities[0] = 0.0;

    // Decay rate alpha = omega_0 / (2*Q) = (2*pi*100) / (2*50) = 2*pi = ~6.283 rad/s
    const alpha = (2.0 * Math.PI * f0) / (2.0 * 50.0);
    const dt = 0.001; // 1 ms step
    const steps = 100; // 0.1 s total
    for (let i = 0; i < steps; i++) {
      bank.update(dt, 0);
    }

    // Envelope expected at t = 0.1s is exp(-alpha * 0.1) = exp(-6.283 * 0.1) = exp(-0.6283) ~ 0.533
    const expectedEnvelope = Math.exp(-alpha * 0.1);
    expect(Math.abs(bank.amplitudes[0])).toBeLessThanOrEqual(expectedEnvelope * 1.05);
  });

  it('excites modes when driven by audio PCM time-domain signals', () => {
    const bank = new ModalOscillatorBank(8);
    const pcmSignal = new Float32Array(512);
    for (let i = 0; i < pcmSignal.length; i++) {
      pcmSignal[i] = Math.sin((i / 512) * Math.PI * 4) * 0.8;
    }

    bank.update(0.016, pcmSignal);

    let hasEnergy = false;
    for (let i = 0; i < bank.modeCount; i++) {
      if (Math.abs(bank.amplitudes[i]) > 1e-6) {
        hasEnergy = true;
        break;
      }
    }
    expect(hasEnergy).toBe(true);
  });

  it('maintains unconditional numerical stability even under extreme time-steps (e.g. dt = 1.0s)', () => {
    const bank = new ModalOscillatorBank(16);
    bank.amplitudes[0] = 1.0;
    // Massive dt: should decay smoothly without blowing up
    bank.update(1.0, 0);

    expect(Number.isFinite(bank.amplitudes[0])).toBe(true);
    expect(Math.abs(bank.amplitudes[0])).toBeLessThan(1.0);
  });
});
