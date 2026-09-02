import { beforeEach, describe, expect, it } from 'vitest';
import { TemporalMemoryController } from './TemporalMemory';

describe('TemporalMemoryController', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('clamps its public controls to stable rendering ranges', () => {
    const controller = new TemporalMemoryController();

    controller.setMemorySeconds(99);
    controller.setLookbackSeconds(99);
    controller.setPropagation(0);
    controller.setGain(99);
    controller.setWarp(-4);

    const settings = controller.getSettings();
    expect(settings.memorySeconds).toBe(10);
    expect(settings.lookbackSeconds).toBe(10);
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

  it('stretches the history collected so far across the starting sculpture', () => {
    const controller = new TemporalMemoryController();
    controller.setMemorySeconds(8);

    controller.recordFrame(1, 1, 1000);
    controller.recordFrame(2, 1, 1020);
    controller.recordFrame(3, 1, 1040);

    const state = controller.getUniformState();
    expect(state.availableFrames).toBe(3);
    expect(state.memoryFrames).toBe(3);
  });

  it('compresses a populated history for faster propagation media', () => {
    const controller = new TemporalMemoryController();
    controller.setMemorySeconds(8);
    controller.setPropagation(1);

    for (let index = 0; index < 400; index += 1) {
      controller.recordFrame(index % 510, 1, 1000 + index * 21);
    }

    controller.setMedium('air');
    const airFrames = controller.getUniformState().memoryFrames;

    controller.setMedium('steel');
    const steelFrames = controller.getUniformState().memoryFrames;

    expect(airFrames).toBeGreaterThan(steelFrames);
    expect(steelFrames).toBeGreaterThan(2);
  });

  it('moves the center backward through the ring buffer with the time lens', () => {
    const controller = new TemporalMemoryController();
    controller.recordFrame(200, 1, 1000);
    controller.recordFrame(201, 1, 1020);

    const liveHead = controller.getUniformState().historyHead;
    controller.setLookbackSeconds(1);
    const pastHead = controller.getUniformState().historyHead;

    expect(pastHead).toBeGreaterThanOrEqual(0);
    expect(pastHead).toBeLessThan(1);
    expect(pastHead).toBeLessThan(liveHead);
  });
});
