/** RN01 — os 4 status possíveis de um vínculo com hospital. */
export type HospitalLinkStatus = 'approved' | 'pending' | 'refused' | 'revoked';

export interface HospitalLink {
  readonly id: number;
  readonly hospitalId: number;
  readonly hospitalName: string;
  readonly status: HospitalLinkStatus;
  /** Data da última mudança de status (ISO 8601). */
  readonly updatedAt: string;
}

export interface HospitalLinkList {
  /** Ordenados pelo nome do hospital. */
  readonly items: readonly HospitalLink[];
  /** `true` se há ao menos um vínculo aprovado (RN02: decide o destino pós-login). */
  readonly hasApprovedLink: boolean;
}

/** Texto e ícone de cada status: a cor nunca é a única forma de transmiti-lo. */
export const HOSPITAL_LINK_STATUS_VIEW: Readonly<
  Record<HospitalLinkStatus, { readonly label: string; readonly icon: string }>
> = {
  approved: { icon: 'check-circle', label: 'Aprovado' },
  pending: { icon: 'hourglass', label: 'Aguardando aprovação' },
  refused: { icon: 'x-circle', label: 'Recusado' },
  revoked: { icon: 'prohibit', label: 'Revogado' },
};

/** Hospital devolvido pela busca por nome (US-001-2-01). */
export interface HospitalOption {
  readonly id: number;
  readonly name: string;
}

export interface HospitalSearchPage {
  readonly items: readonly HospitalOption[];
  readonly nextCursor: string | null;
}

/** RN03: pendente ou aprovado bloqueia nova solicitação; recusado/revogado pode ser refeito. */
export function blocksRequest(status: HospitalLinkStatus): boolean {
  return status === 'pending' || status === 'approved';
}
