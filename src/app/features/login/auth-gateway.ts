import { SessionTokens } from '../auth/local-session-store';

/** Resultado tipado de uma tentativa de login. */
export type LoginResult =
  | { readonly kind: 'success'; readonly tokens: SessionTokens }
  /** E-mail inexistente, conta inativa e senha errada são indistinguíveis de propósito (RN01). */
  | { readonly kind: 'invalid-credentials' }
  /** Bloqueio temporário (RN02, HTTP 423). `retryAfterSeconds` só existe se o servidor informar. */
  | { readonly kind: 'locked'; readonly retryAfterSeconds?: number }
  /** Perfil com segundo fator (ADMIN e GESTOR): o login devolve um desafio, não tokens (HTTP 202, contrato proposto). */
  | { readonly kind: 'mfa-required'; readonly challenge: string; readonly setupRequired: boolean }
  | { readonly kind: 'network-error' };

/**
 * Fronteira de autenticação por e-mail e senha (`POST /api/v1/auth/login`, passo único, ADR-001).
 * Número de tentativas e duração do bloqueio são regras do servidor; o front só reage a `locked`.
 */
export abstract class AuthGateway {
  /** Nunca rejeita: falhas de transporte e respostas inesperadas viram `network-error`. */
  abstract login(email: string, password: string): Promise<LoginResult>;
}
