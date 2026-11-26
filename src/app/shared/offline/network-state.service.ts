import { Injectable, signal } from '@angular/core';

/**
 * O que a interface sabe da rede, deduzido das próprias requisições (ADR-003): qualquer resposta do servidor marca
 * "alcançável"; falha de rede marca "sem conexão". `staleSavedAt` guarda a hora do dado em cache que a última leitura
 * mostrou no lugar do servidor (`null` = a tela mostra dados do servidor).
 */
@Injectable({ providedIn: 'root' })
export class NetworkStateService {
  readonly reachable = signal(true);
  readonly staleSavedAt = signal<string | null>(null);

  /** O servidor respondeu (qualquer chamada). */
  markReachable(): void {
    this.reachable.set(true);
  }

  /** Uma leitura do Hub veio do servidor: a tela deixa de mostrar cópia local. */
  markFresh(): void {
    this.reachable.set(true);
    this.staleSavedAt.set(null);
  }

  markUnreachable(): void {
    this.reachable.set(false);
  }

  markStale(savedAt: string): void {
    this.reachable.set(false);
    this.staleSavedAt.set(savedAt);
  }
}
