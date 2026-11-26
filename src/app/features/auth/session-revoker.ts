/**
 * Fronteira de revogação REMOTA da sessão do dispositivo atual (RN02).
 *
 * Só existe a operação do dispositivo corrente: nenhuma "sair de todos" é exposta.
 * A implementação real chama `POST /api/v1/auth/logout` (`HttpSessionRevoker`).
 */
export abstract class SessionRevoker {
  abstract revokeCurrentDevice(): Promise<void>;

  /** Revoga um refresh token específico (ex.: o antigo, depois de uma reautenticação que emitiu outro). */
  abstract revokeToken(refreshToken: string): Promise<void>;
}
