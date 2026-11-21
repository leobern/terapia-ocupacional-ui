import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SkeletonComponent, type SkeletonVariant } from './skeleton.component';

describe('SkeletonComponent', () => {
  let fixture: ComponentFixture<SkeletonComponent>;

  function render(variant: SkeletonVariant): HTMLElement {
    fixture = TestBed.createComponent(SkeletonComponent);
    fixture.componentRef.setInput('variant', variant);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();

    return fixture.nativeElement.querySelector('.skeleton');
  }

  beforeEach(() => TestBed.configureTestingModule({ imports: [SkeletonComponent] }));

  it('is hidden from assistive technology (the container announces busy)', () => {
    expect(render('select').getAttribute('aria-hidden')).toBe('true');
  });

  it('applies the modifier of each variant', () => {
    for (const variant of ['select', 'card-patients', 'card-notify', 'block'] as const) {
      expect(render(variant).classList).toContain(`skeleton--${variant}`);
    }
  });

  it('matches the real dimensions: 48px select and 180x180 cards', () => {
    const size = (variant: SkeletonVariant): string[] => {
      const style = getComputedStyle(render(variant));

      return [style.width === '' ? '' : style.height, style.width];
    };

    expect(size('select')[0]).toBe('48px');
    expect(size('card-patients')).toEqual(['180px', '180px']);
    expect(size('card-notify')).toEqual(['180px', '180px']);
  });
});
