import { signal } from '@angular/core';
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

  it('registerSort expõe a ordenação e o cleanup velho não remove a seguinte', () => {
    const def = {
      active: signal<string | null>(null),
      options: [{ id: 'x', label: 'X' }],
      select: (): void => undefined,
    };
    const next = { ...def };
    const cleanup = service.registerSort(def);

    expect(service.sort()).toBe(def);

    service.registerSort(next);
    cleanup();

    expect(service.sort()).toBe(next);
  });

  it('o cleanup da ordenação atual a remove', () => {
    const def = { active: signal<string | null>(null), options: [], select: (): void => undefined };

    service.registerSort(def)();

    expect(service.sort()).toBeNull();
  });

  it('registerCommandHandler: o cleanup só remove o handler se ainda for o atual', () => {
    const registry = TestBed.inject(ScreenActionsService);
    const a = (): Promise<void> => Promise.resolve();
    const b = (): Promise<void> => Promise.resolve();
    const cleanA = registry.registerCommandHandler(a);

    registry.registerCommandHandler(b);
    cleanA();

    expect(registry.commandHandler()).toBe(b);
  });

  it('registerSuggestions expõe as sugestões da tela e o cleanup só remove se ainda forem as atuais', () => {
    const first = [{ label: 'Cadastrar' }];
    const second = [{ label: 'Outra' }];
    const cleanupFirst = service.registerSuggestions(first);

    expect(service.suggestions()).toBe(first);
    service.registerSuggestions(second);
    cleanupFirst();

    expect(service.suggestions()).toBe(second);
    service.registerSuggestions(first)();

    expect(service.suggestions()).toEqual([]);
  });
});
