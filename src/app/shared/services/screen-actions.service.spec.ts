import { TestBed } from '@angular/core/testing';

import { type ScreenAction, ScreenActionsService } from './screen-actions.service';

describe('ScreenActionsService', () => {
  let service: ScreenActionsService;
  const actions: readonly ScreenAction[] = [{ id: 'a', label: 'A' }];

  beforeEach(() => {
    service = TestBed.inject(ScreenActionsService);
  });

  it('starts with no actions', () => {
    expect(service.actions()).toEqual([]);
  });

  it('register exposes the actions and the returned cleanup removes them', () => {
    const cleanup = service.register(actions);

    expect(service.actions()).toBe(actions);

    cleanup();

    expect(service.actions()).toEqual([]);
  });

  it('a stale cleanup does not remove the actions registered by the next screen', () => {
    const cleanupFirst = service.register(actions);
    const next: readonly ScreenAction[] = [{ id: 'b', label: 'B' }];

    service.register(next);
    cleanupFirst();

    expect(service.actions()).toBe(next);
  });
});
