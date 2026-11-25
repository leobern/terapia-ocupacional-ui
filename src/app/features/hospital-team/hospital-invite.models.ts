/** Perfil declarado no cadastro (`perfilDeclarado`), exibido ao gestor para conferência. */
export interface DeclaredProfile {
  readonly usuarioId: number;
  readonly nomeCompleto: string;
  readonly email: string;
  /** Rótulo em pt-BR do `perfilDeclarado` do contrato (ex.: TERAPEUTA → "Terapeuta"). */
  readonly perfilDeclarado: string;
}

/** Relação já existente entre a conta e o hospital: nenhuma, solicitação "Aguardando aprovação" ou vínculo "Aprovado". */
export type LinkRelation = 'none' | 'pending' | 'approved';

export type InviteLookup =
  | { readonly kind: 'not-registered' }
  | { readonly kind: 'found'; readonly profile: DeclaredProfile; readonly relation: LinkRelation };

/** `aproveitouSolicitacao` = o convite aprovou a solicitação pendente existente, sem criar vínculo paralelo. */
export interface InviteResult {
  readonly aproveitouSolicitacao: boolean;
}
