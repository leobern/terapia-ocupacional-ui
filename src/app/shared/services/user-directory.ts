/** Usuário cadastrado que pode ser marcado (`@`) em um cadastro. */
export interface DirectoryUser {
  readonly id: number;
  readonly name: string;
  readonly specialty: string;
  readonly photoUrl: string | null;
}

/**
 * Fronteira de busca de usuários cadastrados (autocomplete do `@`). A implementação real
 * (API de usuários) substitui a provisória em `app.config.ts`.
 */
export abstract class UserDirectory {
  /** Usuários cujo nome contém `term` (sem diferenciar maiúsculas/acentos); `''` lista todos. */
  abstract search(term: string): Promise<readonly DirectoryUser[]>;
}
