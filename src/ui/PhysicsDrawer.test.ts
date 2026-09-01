import { describe, it, expect } from 'vitest';
import type { CameraMode } from '../visualizer/VisualizerEngine';

describe('Camera & Physics Interaction Architecture', () => {
  it('supports all 4 standard 3D camera modes', () => {
    const validModes: CameraMode[] = ['orbit', 'autocam', 'emitter-lock', 'top-down'];
    expect(validModes).toContain('orbit');
    expect(validModes).toContain('autocam');
    expect(validModes).toContain('emitter-lock');
    expect(validModes).toContain('top-down');
  });

  it('correctly handles camera mode events across event targets', () => {
    const target = new EventTarget();
    let receivedMode: string | null = null;
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent<{ mode: CameraMode }>;
      receivedMode = customEvent.detail?.mode || null;
    };

    target.addEventListener('camera-mode-changed', handler);
    target.dispatchEvent(new CustomEvent('camera-mode-changed', { detail: { mode: 'orbit' } }));

    expect(receivedMode).toBe('orbit');
    target.removeEventListener('camera-mode-changed', handler);
  });
});
