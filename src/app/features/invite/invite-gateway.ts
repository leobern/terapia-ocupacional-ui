/** Resultado de aceitar o convite e criar a conta. */
export type AcceptInviteResult =
  | 'ok'
  /** Token inexistente, já usado ou expirado. */
  | 'invalid-token'
  /** O e-mail do convite já tem conta (o convite deve ser tratado como login). */
  | 'already-registered';

/**
 * Fronteira do aceite de convite (Figma seção 12, tela 06): o profissional convidado cria o nome e a senha da conta.
 * Contrato PROPOSTO (ainda não existe no backend): `POST /v1/auth/convites/aceitar` com `{ token, nomeCompleto, senha }`.
 * Ver `docs/regras-de-negocio/pendencias-backend-acesso.md`.
 */
export abstract class InviteGateway {
  /** Rejeita só em falha de transporte ou resposta inesperada (a tela mostra "tente novamente"). */
  abstract accept(token: string, fullName: string, password: string): Promise<AcceptInviteResult>;
}
