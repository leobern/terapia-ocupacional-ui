/**
 * Porta de validação da senha da conta (mecanismo de autenticação da US-001-1-03).
 * Funciona sem rede quando a implementação valida localmente (RN-06).
 */
export abstract class AccountPasswordVerifier {
  abstract verify(password: string): Promise<boolean>;
}
