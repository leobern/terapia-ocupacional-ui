import { Injectable, signal } from '@angular/core';

/**
 * Estado local da sessão do dispositivo e do cache sensível (token, perfil, dados
 * clínicos, vínculos). Provisório até US-001-1-08: nenhuma sessão é criada ainda,
 * então `isValid` nasce `false`; `clear` já é a limpeza definitiva (RN03).
 */
@Injectable({ providedIn: 'root' })
export class LocalSessionStore {
  private readonly valid = signal(false);

  isValid(): boolean {
    return this.valid();
  }

  /** Remove token e todo cache local sensível; nada é preservado offline (RN03). */
  clear(): void {
    this.valid.set(false);
    localStorage.clear();
    sessionStorage.clear();
  }
}
