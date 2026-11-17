/** Resultado tipado de uma tentativa de login. */
export type LoginResult =
  | { readonly kind: 'success'; readonly hasApprovedHospitalLink: boolean }
  /** E-mail inexistente e senha errada são indistinguíveis aqui de propósito (RN01). */
  | { readonly kind: 'invalid-credentials' }
  /** Bloqueio temporário (RN02). `retryAfterSeconds` só existe se o servidor informar. */
  | { readonly kind: 'locked'; readonly retryAfterSeconds?: number }
  | { readonly kind: 'network-error' };

/**
 * Fronteira de autenticação por e-mail e senha.
 *
 * DEPENDÊNCIA: o backend de autenticação fornecerá a implementação real,
 * substituindo `ProvisionalAuthGateway` em `app.config.ts`. Número de tentativas e
 * duração do bloqueio são regras do servidor; o front só reage a `locked`.
 */
export abstract class AuthGateway {
  /** Nunca rejeita: falhas de transporte viram `network-error`. */
  abstract login(email: string, password: string): Promise<LoginResult>;
}
