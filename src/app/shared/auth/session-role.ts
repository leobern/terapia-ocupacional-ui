/** Perfis de acesso (ADR-002). Autorização global no MVP: sem checagem de vínculo gestor↔hospital. */
export enum Role {
  ENFERMEIRO = 'ENFERMEIRO',
  GESTOR = 'GESTOR',
  MEDICO = 'MEDICO',
  NUTRICIONISTA = 'NUTRICIONISTA',
}

/**
 * Fronteira de leitura do perfil do usuário autenticado.
 *
 * DEPENDÊNCIA: a sessão real (EP-001) substituirá `ProvisionalSessionRoleReader` em `app.config.ts`.
 */
export abstract class SessionRoleReader {
  abstract read(): Role;
}
