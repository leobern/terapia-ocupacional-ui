import { TestBed } from '@angular/core/testing';

import { PrivacyOverlayService } from '../../services/privacy-overlay.service';
import { PrivacyOverlayComponent } from './privacy-overlay.component';

describe('PrivacyOverlayComponent', () => {
  let visibility: string;

  const overlay = (el: HTMLElement): HTMLElement | null => el.querySelector('[data-testid="privacy-overlay"]');

  function create(): { el: HTMLElement; detect: () => void } {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
    const fixture = TestBed.createComponent(PrivacyOverlayComponent);

    TestBed.inject(PrivacyOverlayService).start();
    fixture.detectChanges();

    return { detect: () => fixture.detectChanges(), el: fixture.nativeElement as HTMLElement };
  }

  beforeEach(() => (visibility = 'visible'));

  afterEach(() => delete (document as unknown as Record<string, unknown>)['visibilityState']);

  it('C7: covers the content when the page goes to the background and uncovers on return', () => {
    const { detect, el } = create();

    expect(overlay(el)).toBeNull();

    visibility = 'hidden';
    document.dispatchEvent(new Event('visibilitychange'));
    detect();

    expect(overlay(el)).not.toBeNull();
    expect(el.textContent?.trim()).toBe('');

    visibility = 'visible';
    document.dispatchEvent(new Event('visibilitychange'));
    detect();

    expect(overlay(el)).toBeNull();
  });

  it('covers on focus loss and uncovers on focus', () => {
    const { detect, el } = create();

    window.dispatchEvent(new Event('blur'));
    detect();

    expect(overlay(el)).not.toBeNull();

    window.dispatchEvent(new Event('focus'));
    detect();

    expect(overlay(el)).toBeNull();
  });

  it('covers on pagehide and uncovers on pageshow', () => {
    const { detect, el } = create();

    window.dispatchEvent(new Event('pagehide'));
    detect();

    expect(overlay(el)).not.toBeNull();

    window.dispatchEvent(new Event('pageshow'));
    detect();

    expect(overlay(el)).toBeNull();
  });

  it('stays covered when focus returns while the page is still hidden', () => {
    const { detect, el } = create();

    visibility = 'hidden';
    window.dispatchEvent(new Event('focus'));
    detect();

    expect(overlay(el)).not.toBeNull();
  });

  it('starts covered when the app opens already in the background', () => {
    visibility = 'hidden';
    const { el } = create();

    expect(overlay(el)).not.toBeNull();
  });

  it('is opaque, above the app and hidden from assistive technology', () => {
    const { detect, el } = create();

    window.dispatchEvent(new Event('blur'));
    detect();
    const node = overlay(el) as HTMLElement;
    const style = getComputedStyle(node);

    expect(node.getAttribute('aria-hidden')).toBe('true');
    expect(style.position).toBe('fixed');
    expect(style.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
    expect(Number(style.zIndex)).toBeGreaterThan(100);
  });

  it('start is idempotent and stops listening when destroyed', () => {
    const { detect, el } = create();

    TestBed.inject(PrivacyOverlayService).start();
    TestBed.resetTestingModule();
    window.dispatchEvent(new Event('blur'));
    detect();

    expect(overlay(el)).toBeNull();
  });
});
