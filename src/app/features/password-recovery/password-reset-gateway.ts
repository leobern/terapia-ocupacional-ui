/** Resultado da solicitação: o app trata os dois da mesma forma (RN03). */
export type RequestResetResult = 'sent' | 'unknown-email';

/** Resultado da confirmação; `invalid-token` cobre expirado, já usado e inválido (RN01/RN02). */
export type ConfirmResetResult = 'ok' | 'invalid-token';

/**
 * Fronteira com o backend de autenticação para recuperação de senha.
 * Substituível em testes. Falhas de rede/servidor rejeitam a promise.
 */
export abstract class PasswordResetGateway {
  abstract requestReset(email: string): Promise<RequestResetResult>;
  abstract confirmReset(token: string, newPassword: string): Promise<ConfirmResetResult>;
}
