import { NetworkStateService } from './network-state.service';

describe('NetworkStateService', () => {
  it('alterna entre alcançável, sem conexão e dado em cache', () => {
    const state = new NetworkStateService();

    expect(state.reachable()).toBeTrue();
    state.markUnreachable();
    expect(state.reachable()).toBeFalse();
    state.markStale('2026-11-26T10:00:00Z');
    expect(state.staleSavedAt()).toBe('2026-11-26T10:00:00Z');
    expect(state.reachable()).toBeFalse();
    state.markReachable();
    expect(state.reachable()).toBeTrue();
    // Uma resposta qualquer do servidor não apaga o aviso de cópia local; só uma leitura fresca do Hub apaga.
    expect(state.staleSavedAt()).toBe('2026-11-26T10:00:00Z');
    state.markUnreachable();
    state.markFresh();
    expect(state.reachable()).toBeTrue();
    expect(state.staleSavedAt()).toBeNull();
  });
});
