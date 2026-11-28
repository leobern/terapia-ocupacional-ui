/** Resultado de aceitar o convite e criar a conta. */
export type AcceptInviteResult =
  | 'ok'
  /** Token inexistente, já usado ou expirado. */
  | 'invalid-token'
  /** O e-mail do convite já tem conta (o convite deve ser tratado como login). */
  | 'already-registered';

/** O que o convite diz antes do aceite (e-mail, papel e hospitais). */
export interface InviteSummary {
  readonly email: string;
  readonly role: string;
  readonly hospitals: readonly string[];
}

/** Foto opcional enviada junto com o aceite (base64 sem prefixo). */
export interface InvitePhoto {
  readonly base64: string;
  readonly type: string;
}

/**
 * Fronteira do aceite de convite: o profissional convidado cria nome, foto (opcional) e senha da conta.
 * Contrato: `GET /v1/auth/convites/{token}` e `POST /v1/auth/convites/aceitar`
 * com `{ token, nomeCompleto, senha, fotoBase64?, fotoTipo? }`.
 */
export abstract class InviteGateway {
  /** `null` = convite inválido, usado, cancelado ou expirado. Rejeita só em falha de transporte. */
  abstract check(token: string): Promise<InviteSummary | null>;

  /** Rejeita só em falha de transporte ou resposta inesperada (a tela mostra "tente novamente"). */
  abstract accept(token: string, fullName: string, password: string, photo?: InvitePhoto): Promise<AcceptInviteResult>;
}
