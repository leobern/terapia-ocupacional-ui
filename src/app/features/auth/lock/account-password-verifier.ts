/** Resultado da conferência da senha da conta no desbloqueio. */
export type PasswordCheck = 'ok' | 'invalid' | 'locked' | 'unavailable';

/**
 * Porta de validação da senha da conta (reautenticação no desbloqueio). `invalid` = senha errada;
 * `locked` = conta temporariamente bloqueada por tentativas; `unavailable` = sem rede ou sem como validar.
 */
export abstract class AccountPasswordVerifier {
  abstract verify(password: string): Promise<PasswordCheck>;
}
