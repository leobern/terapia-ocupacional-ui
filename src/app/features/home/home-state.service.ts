import { Injectable, signal } from '@angular/core';

export type HomeLoadStatus = 'loading' | 'success' | 'error';

/**
 * Estado de carregamento inicial da Home. Começa em `loading` e é alimentado
 * pelas stories irmãs (busca de dados, erro) via `setStatus`. O skeleton só
 * existe no carregamento inicial: troca de hospital e paginação não voltam
 * para `loading`.
 */
@Injectable({ providedIn: 'root' })
export class HomeStateService {
  readonly status = signal<HomeLoadStatus>('loading');

  setStatus(status: HomeLoadStatus): void {
    this.status.set(status);
  }
}
