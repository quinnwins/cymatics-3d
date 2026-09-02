import { describe, it, expect } from 'vitest';
import { ProvenanceBadge, PROVENANCE_DEFINITIONS } from './ProvenanceBadge';

describe('ProvenanceBadge UI Component', () => {
  it('instantiates with ANALYTIC provenance by default', () => {
    const badge = new ProvenanceBadge();
    expect(badge.element).toBeDefined();
    expect(badge.getProvenance()).toBe('ANALYTIC');
    expect(badge.element.textContent).toContain('ANALYTIC');
  });

  it('updates provenance type and updates DOM content', () => {
    const badge = new ProvenanceBadge();
    badge.setProvenance('REDUCED_ORDER');
    expect(badge.getProvenance()).toBe('REDUCED_ORDER');
    expect(badge.element.textContent).toContain('REDUCED-ORDER');

    badge.setProvenance('BENCHMARKED');
    expect(badge.getProvenance()).toBe('BENCHMARKED');
    expect(badge.element.textContent).toContain('BENCHMARKED');
  });

  it('complies with touch ergonomics (min-height and min-width 44px on tap target)', () => {
    const badge = new ProvenanceBadge();
    const button = badge.element.querySelector('button');
    expect(button).not.toBeNull();
    expect(button?.className).toContain('min-h-[44px]');
    expect(button?.className).toContain('min-w-[44px]');
  });

  it('toggles detail popover on button click', () => {
    const badge = new ProvenanceBadge();
    const button = badge.element.querySelector('button');
    const popover = badge.element.querySelector('div:last-child') as HTMLElement;

    expect(popover.classList.contains('hidden')).toBe(true);
    expect(button?.getAttribute('aria-expanded')).toBe('false');
    button?.click();
    expect(popover.classList.contains('hidden')).toBe(false);
    expect(button?.getAttribute('aria-expanded')).toBe('true');
    button?.click();
    expect(popover.classList.contains('hidden')).toBe(true);
    expect(button?.getAttribute('aria-expanded')).toBe('false');
    badge.destroy();
  });

  it('uses relative positioning without fixed viewport anchoring to prevent collisions', () => {
    const badge = new ProvenanceBadge();
    expect(badge.element.className).toContain('relative');
    expect(badge.element.className).not.toContain('fixed');
    badge.destroy();
  });

  it('closes popover on Escape keydown and supports clean destruction', () => {
    const badge = new ProvenanceBadge();
    document.body.appendChild(badge.element);
    const button = badge.element.querySelector('button');
    const popover = badge.element.querySelector('div:last-child') as HTMLElement;

    button?.click();
    expect(popover.classList.contains('hidden')).toBe(false);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(popover.classList.contains('hidden')).toBe(false || true); // will be closed by escape
    expect(popover.classList.contains('hidden')).toBe(true);

    badge.destroy();
    expect(document.body.contains(badge.element)).toBe(false);
  });

  it('displays human-friendly Physics label and tag on header pill', () => {
    const badge = new ProvenanceBadge();
    const pill = badge.element.querySelector('button > span');
    expect(pill?.textContent).toContain('Physics:');
    expect(pill?.textContent).toContain('Exact Math');

    badge.setProvenance('REDUCED_ORDER');
    expect(pill?.textContent).toContain('Real-Time');

    badge.setProvenance('INTERPRETIVE');
    expect(pill?.textContent).toContain('Expressive');

    badge.setProvenance('BENCHMARKED');
    expect(pill?.textContent).toContain('Lab Calibrated');
    badge.destroy();
  });

  it('allows interactive mode switching via option click and invokes onModeSelect callback', () => {
    let selectedMode = '';
    const badge = new ProvenanceBadge({
      onModeSelect: (mode) => {
        selectedMode = mode;
      },
    });

    const button = badge.element.querySelector('button');
    button?.click(); // Open popover

    const hybridOption = badge.element.querySelector('[data-mode="hybrid"]') as HTMLElement | null;
    expect(hybridOption).not.toBeNull();
    hybridOption?.click();

    expect(selectedMode).toBe('hybrid');
    expect(badge.getProvenance()).toBe('REDUCED_ORDER');

    const physicalOption = badge.element.querySelector('[data-mode="physical"]') as HTMLElement | null;
    physicalOption?.click();
    expect(selectedMode).toBe('physical');
    expect(badge.getProvenance()).toBe('ANALYTIC');
    badge.destroy();
  });

  it('renders locked lab notice when in BENCHMARKED mode instead of mode switcher', () => {
    const badge = new ProvenanceBadge();
    badge.setProvenance('BENCHMARKED');

    const button = badge.element.querySelector('button');
    button?.click();

    const switcher = badge.element.querySelector('[role="radiogroup"]');
    expect(switcher).toBeNull();

    expect(badge.element.textContent).toContain('Lab Apparatus Active');
    badge.destroy();
  });

  it('supports opening physics controls from popover footer', () => {
    let opened = false;
    const badge = new ProvenanceBadge({
      onOpenPhysicsDrawer: () => {
        opened = true;
      },
    });

    const button = badge.element.querySelector('button');
    button?.click();

    const openBtn = badge.element.querySelector('#btn-popover-open-physics') as HTMLElement | null;
    expect(openBtn).not.toBeNull();
    openBtn?.click();

    expect(opened).toBe(true);
    badge.destroy();
  });
});
