import { Injectable, signal } from '@angular/core';

/** Chaves exatas de sessão/cache sensível removidas no logout (único lugar a manter). */
export const SESSION_STORAGE_KEYS: readonly string[] = ['token', 'profile', 'patients'];

/** Prefixos de chaves de sessão/cache sensível (ex.: `session.token`, `cache.patients`). */
export const SESSION_STORAGE_PREFIXES: readonly string[] = ['session.', 'cache.'];

function isSessionKey(key: string): boolean {
  return SESSION_STORAGE_KEYS.includes(key) || SESSION_STORAGE_PREFIXES.some(p => key.startsWith(p));
}

function removeSessionKeys(storage: Storage): void {
  const keys = Array.from({ length: storage.length }, (_, i) => storage.key(i) as string);

  keys.filter(isSessionKey).forEach(key => storage.removeItem(key));
}

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

  /**
   * Remove token e cache local sensível (RN03). Só apaga chaves de sessão
   * (`SESSION_STORAGE_KEYS`/`SESSION_STORAGE_PREFIXES`); preferências não sensíveis
   * (ex.: idioma) são preservadas.
   */
  clear(): void {
    this.valid.set(false);
    removeSessionKeys(localStorage);
    removeSessionKeys(sessionStorage);
  }
}
