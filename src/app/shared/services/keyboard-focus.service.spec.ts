import { TestBed } from '@angular/core/testing';

import { KeyboardFocusService } from './keyboard-focus.service';

describe('KeyboardFocusService', () => {
  let service: KeyboardFocusService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(KeyboardFocusService);
  });

  it('defaults to keyboard modality (no mouse interaction yet)', () => {
    expect(service.isKeyboard()).toBeTrue();
  });

  it('switches to false on mousedown', () => {
    document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

    expect(service.isKeyboard()).toBeFalse();
  });

  it('switches to false on pointerdown', () => {
    document.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));

    expect(service.isKeyboard()).toBeFalse();
  });

  it('switches back to true on the next keydown after a mouse interaction', () => {
    document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

    expect(service.isKeyboard()).toBeFalse();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));

    expect(service.isKeyboard()).toBeTrue();
  });
});
