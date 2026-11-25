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

/** Chaves da sessão persistida (fora da allowlist: apagadas por `clear`). */
export const SESSION_ACCESS_TOKEN_KEY = 'session.accessToken';
export const SESSION_REFRESH_TOKEN_KEY = 'session.refreshToken';

/** Tokens da sessão local (RN-05). */
export interface SessionTokens {
  readonly accessToken: string;
  readonly refreshToken: string;
}

function readItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Estado local da sessão do dispositivo e do cache sensível (token, perfil, dados
 * clínicos, vínculos). A sessão persiste entre aberturas (US-001-1-08, RN-01): os tokens
 * ficam em `localStorage` e `isValid` considera apenas dados locais (RN-06). Quem abre a
 * sessão (login, US-001-1-03) chama `open`; `clear` é a limpeza definitiva (RN03).
 */
@Injectable({ providedIn: 'root' })
export class LocalSessionStore {
  private readonly valid = signal(readItem(SESSION_REFRESH_TOKEN_KEY) !== null);

  isValid(): boolean {
    return this.valid();
  }

  accessToken(): string | null {
    return readItem(SESSION_ACCESS_TOKEN_KEY);
  }

  refreshToken(): string | null {
    return readItem(SESSION_REFRESH_TOKEN_KEY);
  }

  /** Abre a sessão persistida com os tokens recebidos do login. */
  open(tokens: SessionTokens): void {
    localStorage.setItem(SESSION_ACCESS_TOKEN_KEY, tokens.accessToken);
    localStorage.setItem(SESSION_REFRESH_TOKEN_KEY, tokens.refreshToken);
    this.valid.set(true);
  }

  /** Troca só o `accessToken` (renovação transparente, RN-05). */
  updateAccessToken(accessToken: string): void {
    localStorage.setItem(SESSION_ACCESS_TOKEN_KEY, accessToken);
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
