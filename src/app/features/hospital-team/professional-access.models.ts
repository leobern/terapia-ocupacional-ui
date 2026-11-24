/** Status do vínculo exibido ao gestor. "Revogado" implica aprovação anterior e difere de "Recusado" (RN04). */
export type ProfessionalLinkStatus = 'approved' | 'revoked';

export interface HospitalProfessional {
  readonly id: number;
  readonly name: string;
  readonly specialty: string;
  readonly status: ProfessionalLinkStatus;
}
