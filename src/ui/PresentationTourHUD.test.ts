import { describe, it, expect } from 'vitest';
import { PresentationTourEngine } from '../visualizer/PresentationTourEngine';
import { TourStep } from './PresentationTourHUD';

describe('PresentationTourHUD & Tour Architecture', () => {
  it('defines all 7 presentation chapters with valid badges, titles, and subtitles', () => {
    const steps = PresentationTourEngine.TOUR_STEPS;
    expect(steps).toHaveLength(7);

    steps.forEach((step: TourStep, index: number) => {
      expect(step.id).toBeDefined();
      expect(step.chapterNumber).toBe(index + 1);
      expect(step.title).toBeTruthy();
      expect(step.badge).toBeTruthy();
      expect(step.subtitle).toBeTruthy();
      expect(step.durationMs).toBeGreaterThan(0);
      // Verify that no synthetic narration text property is required or present
      expect((step as any).narrationText).toBeUndefined();
    });
  });

  it('covers all studio frontiers in sequence without gaps', () => {
    const steps = PresentationTourEngine.TOUR_STEPS;
    const ids = steps.map(s => s.id);
    expect(ids).toEqual([
      'music-space',
      'cymatics-lab',
      'bio-acoustics',
      'cancer-therapy',
      'voice-biometrics',
      'nobel-mechanogenomics',
      'nobel-viral-senolytic',
    ]);
  });
});
