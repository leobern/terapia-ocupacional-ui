/** Perfil declarado pelo profissional no cadastro (spec 002), exibido ao gestor para conferência. */
export interface DeclaredProfile {
  readonly name: string;
  readonly email: string;
  readonly specialty: string;
}

/** Relação já existente entre a conta e o hospital: nenhuma, solicitação "Aguardando aprovação" ou vínculo "Aprovado". */
export type LinkRelation = 'none' | 'pending' | 'approved';

export type InviteLookup =
  | { readonly kind: 'not-registered' }
  | { readonly kind: 'found'; readonly profile: DeclaredProfile; readonly relation: LinkRelation };

/** `approvedRequest` = o convite aprovou a solicitação pendente existente, sem criar vínculo paralelo. */
export interface InviteResult {
  readonly approvedRequest: boolean;
}
