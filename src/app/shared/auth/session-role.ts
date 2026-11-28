/** Perfis de acesso do backend (ADR-002). Autorização global no MVP: sem checagem de vínculo gestor↔hospital. */
export enum Role {
  ADMIN = 'ADMIN',
  GESTOR = 'GESTOR',
  MEDICO = 'MEDICO',
  RECECIONISTA = 'RECECIONISTA',
  TERAPEUTA = 'TERAPEUTA',
}

/**
 * Fronteira de leitura do perfil do usuário autenticado. `null` quando não há sessão ou o perfil
 * não é reconhecido. É só controle de interface: quem autoriza de fato é o backend (401/403).
 */
export abstract class SessionRoleReader {
  abstract read(): Role | null;
}
