/** Status do vínculo (openapi/vinculos-api.yaml, `VinculoStatus`). */
export type LinkStatus = 'AGUARDANDO_APROVACAO' | 'APROVADO' | 'RECUSADO' | 'REVOGADO';

export interface HospitalOption {
  readonly id: number;
  readonly name: string;
}

export interface HospitalSearchPage {
  readonly items: readonly HospitalOption[];
  readonly nextCursor: string | null;
}

export interface HospitalLink {
  readonly id: number;
  readonly hospitalId: number;
  readonly hospitalName: string;
  readonly status: LinkStatus;
}

/** Rótulos em texto: o status nunca é transmitido só por cor. */
export const LINK_STATUS_LABEL: Readonly<Record<LinkStatus, string>> = {
  AGUARDANDO_APROVACAO: 'Aguardando aprovação',
  APROVADO: 'Aprovado',
  RECUSADO: 'Recusado',
  REVOGADO: 'Revogado',
};

/** RN03: pendente ou aprovado bloqueia nova solicitação; recusado/revogado pode ser refeito. */
export function blocksRequest(status: LinkStatus): boolean {
  return status === 'AGUARDANDO_APROVACAO' || status === 'APROVADO';
}
