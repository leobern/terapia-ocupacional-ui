import { Injectable, signal } from '@angular/core';

/**
 * Allowlist de preferências NÃO sensíveis que sobrevivem ao logout (único lugar a manter).
 * Falha fechada: toda chave nova de localStorage/sessionStorage é apagada por padrão. Só
 * entra aqui preferência de interface sem nenhum dado pessoal ou clínico (ex.: idioma).
 */
export const PRESERVED_PREFERENCE_KEYS: readonly string[] = ['lang'];

/** Prefixos de preferências não sensíveis preservadas (ex.: `ui.sidebar`). Mesma regra da allowlist. */
export const PRESERVED_PREFERENCE_PREFIXES: readonly string[] = ['ui.'];

function isPreserved(key: string): boolean {
  return PRESERVED_PREFERENCE_KEYS.includes(key) || PRESERVED_PREFERENCE_PREFIXES.some(p => key.startsWith(p));
}

function removeAllExceptPreserved(storage: Storage): void {
  const keys = Array.from({ length: storage.length }, (_, i) => storage.key(i) as string);

  keys.filter(key => !isPreserved(key)).forEach(key => storage.removeItem(key));
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
   * Remove token e cache local (RN03) falhando fechado: apaga TODAS as chaves de
   * localStorage e sessionStorage, exceto a allowlist de preferências não sensíveis
   * (`PRESERVED_PREFERENCE_KEYS`/`PRESERVED_PREFERENCE_PREFIXES`).
   */
  clear(): void {
    this.valid.set(false);
    removeAllExceptPreserved(localStorage);
    removeAllExceptPreserved(sessionStorage);
  }
}
