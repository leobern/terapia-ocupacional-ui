/**
 * Fronteira de revogação REMOTA da sessão do dispositivo atual (RN02).
 *
 * Só existe a operação do dispositivo corrente: nenhuma "sair de todos" é exposta.
 * DEPENDÊNCIA: US-001-1-08 fornecerá a implementação real (chamada ao backend).
 */
export abstract class SessionRevoker {
  abstract revokeCurrentDevice(): Promise<void>;
}
