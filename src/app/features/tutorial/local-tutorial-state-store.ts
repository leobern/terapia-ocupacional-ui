import { Injectable } from '@angular/core';

import { TutorialResult, TutorialStateStore, TutorialStatus } from './tutorial-state';

/** Prefixo `ui.`: preferência não sensível que sobrevive ao logout (ver `PRESERVED_PREFERENCE_PREFIXES`). */
export const TUTORIAL_STORAGE_KEY = 'ui.tutorial';

/** Implementação provisória: guarda o resultado no `localStorage` do dispositivo. */
@Injectable()
export class LocalTutorialStateStore extends TutorialStateStore {
  read(): Promise<TutorialStatus> {
    const value = this.load();

    return Promise.resolve(value === 'CONCLUIDO' || value === 'PULADO' ? value : 'PENDENTE');
  }

  async register(result: TutorialResult): Promise<void> {
    if ((await this.read()) === 'PENDENTE') {
      this.save(result);
    }
  }

  // Armazenamento indisponível (modo privado, bloqueio): o tutorial segue pendente, sem erro.
  private load(): string | null {
    try {
      return localStorage.getItem(TUTORIAL_STORAGE_KEY);
    } catch {
      return null;
    }
  }

  private save(result: TutorialResult): void {
    try {
      localStorage.setItem(TUTORIAL_STORAGE_KEY, result);
    } catch {
      // ignora: ver `load`.
    }
  }
}
