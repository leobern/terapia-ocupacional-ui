/** Contratos de `/v1/admin`, `/v1/perfil` e `/v1/auth/convites` (FT-009-3). */

export type PersonStatus = 'ATIVO' | 'CONVIDADO' | 'DESATIVADO' | 'PENDENTE';
export type UserRole = 'ADMIN' | 'GESTOR' | 'MEDICO' | 'TERAPEUTA' | 'RECECIONISTA';
export type HospitalRole = 'PROFISSIONAL' | 'GESTOR';

export interface HospitalRef {
  readonly id: number;
  readonly nome: string;
}

export interface TeamMember {
  readonly usuarioId: number | null;
  readonly conviteId: number | null;
  readonly nome: string;
  readonly email: string;
  readonly papel: UserRole;
  readonly situacao: PersonStatus;
  readonly hospitais: readonly HospitalRef[];
  readonly ultimoAcesso: string | null;
  readonly convidadoPor: string | null;
  readonly convidadoEm: string | null;
  readonly temFoto: boolean;
}

export interface PersonLink {
  readonly vinculoId: number;
  readonly hospitalId: number;
  readonly hospitalNome: string;
  readonly endereco: string | null;
  readonly papelHospital: HospitalRole;
  readonly status: string;
  readonly desde: string | null;
}

export interface PersonDetail {
  readonly pessoa: TeamMember;
  readonly vinculos: readonly PersonLink[];
}

export interface Interaction {
  readonly tipo: 'EVOLUCAO' | 'PRESCRICAO' | 'MENSAGEM_PACIENTE' | 'COMUNICADO';
  readonly quando: string | null;
  readonly texto: string;
  readonly pacienteId: number | null;
  readonly pacienteNome: string | null;
  readonly notificacaoId: number | null;
  readonly resolvida: boolean;
}

export interface AdminHospital {
  readonly id: number;
  readonly nome: string;
  readonly endereco: string | null;
  readonly ativo: boolean;
  readonly pessoas: number;
  readonly gestor: string | null;
  readonly pacientes: number;
  readonly criadoEm: string | null;
}

export interface InviteRequest {
  readonly email: string;
  readonly papel: UserRole;
  readonly hospitalIds: readonly number[];
  readonly papelHospital?: HospitalRole;
}

export interface InviteResult {
  readonly id: number | null;
  readonly email: string;
  readonly papel: UserRole;
  readonly expiraEm: string | null;
  readonly link: string | null;
  readonly vinculoDireto: boolean;
  readonly emailEnviado: boolean;
}

export interface InviteInfo {
  readonly email: string;
  readonly papel: UserRole;
  readonly expiraEm: string;
  readonly hospitais: readonly string[];
}

export interface Profile {
  readonly id: number;
  readonly nomeCompleto: string;
  readonly email: string;
  readonly papel: UserRole;
  readonly especialidade: string | null;
  readonly telefone: string | null;
  readonly registroProfissional: string | null;
  readonly temFoto: boolean;
  readonly ultimoAcesso: string | null;
  readonly membroDesde: string | null;
  readonly hospitais: readonly HospitalRef[];
}

export interface ProfileEdit {
  readonly nomeCompleto: string;
  readonly especialidade: string;
  readonly telefone: string;
  readonly registroProfissional: string;
}

/** `1 pessoa`, `2 pessoas`. */
export function plural(total: number, one: string, many: string): string {
  return `${total} ${total === 1 ? one : many}`;
}

export const ROLE_LABELS: Readonly<Record<UserRole, string>> = {
  ADMIN: 'Administrador',
  GESTOR: 'Gestor',
  MEDICO: 'Médico',
  RECECIONISTA: 'Recepcionista',
  TERAPEUTA: 'Terapeuta',
};

export const STATUS_LABELS: Readonly<Record<PersonStatus, string>> = {
  ATIVO: 'Ativo',
  CONVIDADO: 'Convidado',
  DESATIVADO: 'Desativado',
  PENDENTE: 'Pendente',
};

export const INTERACTION_LABELS: Readonly<Record<Interaction['tipo'], string>> = {
  COMUNICADO: 'Comunicado',
  EVOLUCAO: 'Evolução',
  MENSAGEM_PACIENTE: 'Mensagem no paciente',
  PRESCRICAO: 'Prescrição',
};
