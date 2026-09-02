import { beforeEach, describe, expect, it } from 'vitest';
import { TemporalMemoryController } from './TemporalMemory';

describe('TemporalMemoryController', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('clamps its public controls to stable rendering ranges', () => {
    const controller = new TemporalMemoryController();

    controller.setMemorySeconds(99);
    controller.setPropagation(0);
    controller.setGain(99);
    controller.setWarp(-4);

    const settings = controller.getSettings();
    expect(settings.memorySeconds).toBe(10);
    expect(settings.propagation).toBe(0.35);
    expect(settings.gain).toBe(2.2);
    expect(settings.warp).toBe(0);
  });

  it('freezes and resumes history capture without disabling the sculpture', () => {
    const controller = new TemporalMemoryController();

    controller.setEnabled(true);
    controller.setFrozen(true);
    expect(controller.shouldCapture()).toBe(false);
    expect(controller.getUniformState().enabled).toBe(1);

    controller.setFrozen(false);
    expect(controller.shouldCapture()).toBe(true);
  });

  it('compresses visible history for faster propagation media', () => {
    const controller = new TemporalMemoryController();
    controller.setMemorySeconds(8);
    controller.setPropagation(1);
    controller.recordFrame(1, 1, 1000);
    controller.recordFrame(2, 1, 1020);

    controller.setMedium('air');
    const airFrames = controller.getUniformState().memoryFrames;

    controller.setMedium('steel');
    const steelFrames = controller.getUniformState().memoryFrames;

    expect(airFrames).toBeGreaterThan(steelFrames);
    expect(steelFrames).toBeGreaterThan(2);
  });
});
