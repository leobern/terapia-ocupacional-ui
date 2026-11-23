/** Grupos por perfil profissional que podem ser mencionados (@medicos, @nutris...). */
export type ProfileGroup = 'enfermagem' | 'farmacia' | 'fisio' | 'fonos' | 'medicos' | 'nutris';

export const PROFILE_GROUPS: readonly { readonly id: ProfileGroup; readonly label: string }[] = [
  { id: 'medicos', label: '@medicos' },
  { id: 'nutris', label: '@nutris' },
  { id: 'enfermagem', label: '@enfermagem' },
  { id: 'fonos', label: '@fonos' },
  { id: 'fisio', label: '@fisio' },
  { id: 'farmacia', label: '@farmacia' },
];

export function groupLabel(group: ProfileGroup): string {
  return PROFILE_GROUPS.find(g => g.id === group)?.label ?? `@${group}`;
}

/** Perfil do autor a partir do perfil autenticado (médico → @medicos; demais → @nutris, até haver o perfil real). */
export function authorGroupOf(role: 'doctor' | 'other'): ProfileGroup {
  return role === 'doctor' ? 'medicos' : 'nutris';
}

/** Profissional vinculado E aprovado a um paciente específico. */
export interface TeamMember {
  readonly id: number;
  readonly name: string;
  readonly group: ProfileGroup;
}

/** Destinatário de uma pendência: um grupo (resolvido para os vinculados) e/ou pessoas específicas. */
export interface Recipients {
  readonly group: ProfileGroup | null;
  readonly people: readonly TeamMember[];
}

/** Quem de fato recebe: membros do grupo vinculados ao paciente + pessoas escolhidas, sem repetição. */
export function resolveRecipients(recipients: Recipients, team: readonly TeamMember[]): readonly TeamMember[] {
  const fromGroup = recipients.group === null ? [] : team.filter(m => m.group === recipients.group);
  const byId = new Map<number, TeamMember>();

  for (const member of [...fromGroup, ...recipients.people]) {
    byId.set(member.id, member);
  }

  return [...byId.values()];
}

export const NO_VALID_RECIPIENT_HINT = 'Não há destinatário válido: nenhum profissional vinculado ao paciente.';

/** `null` = válido. Sempre exige ao menos um destinatário resolvido (FR-005, ponto em aberto da spec). */
export function validateRecipients(recipients: Recipients, team: readonly TeamMember[]): string | null {
  return resolveRecipients(recipients, team).length === 0 ? NO_VALID_RECIPIENT_HINT : null;
}

export interface Observation {
  readonly id: string;
  readonly patientId: string;
  readonly author: string;
  readonly authorGroup: ProfileGroup;
  readonly at: string;
  readonly text: string;
}

export type ObservationRequest = Omit<Observation, 'id'>;

export interface RecipientsChange {
  readonly author: string;
  readonly at: string;
  readonly recipients: Recipients;
}

/** Pendência de reavaliação: registro com prazo ligado à observação de origem. */
export interface Reevaluation {
  readonly id: string;
  readonly patientId: string;
  readonly observationId: string;
  readonly author: string;
  readonly createdAt: string;
  /** Prazo `yyyy-MM-dd`. */
  readonly dueDate: string;
  readonly reason: string;
  readonly recipients: Recipients;
  /** Alterações de destinatário depois da criação (trilha de auditoria; só acrescenta). */
  readonly changes: readonly RecipientsChange[];
  readonly resolvedBy: string | null;
  readonly resolvedAt: string | null;
}

export interface ReevaluationRequest {
  readonly patientId: string;
  readonly observationId: string;
  readonly author: string;
  readonly createdAt: string;
  readonly dueDate: string;
  readonly reason: string;
  readonly recipients: Recipients;
}

export interface RecipientsChangeRequest extends RecipientsChange {
  readonly id: string;
}

export interface ResolveRequest {
  readonly id: string;
  readonly author: string;
  readonly at: string;
}

/** Mensagem direcionada (imutável) enviada a partir de uma observação. */
export interface DirectedMessage {
  readonly id: string;
  readonly patientId: string;
  readonly observationId: string;
  readonly author: string;
  readonly at: string;
  readonly recipients: Recipients;
  readonly text: string;
}

export type DirectedMessageRequest = Omit<DirectedMessage, 'id'>;

export interface ReevaluationSuggestion {
  readonly dueDate: string;
  readonly reason: string;
}

export interface CommunicationSuggestion {
  readonly group: ProfileGroup;
  readonly draft: string;
}

export interface ObservationSuggestions {
  readonly reevaluation: ReevaluationSuggestion | null;
  readonly communication: CommunicationSuggestion | null;
}

export function toIsoDate(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');

  return `${date.getFullYear()}-${month}-${day}`;
}

/** Vencida: prazo anterior a hoje e ainda não resolvida (no dia do prazo ainda não está vencida). */
export function isOverdue(item: Pick<Reevaluation, 'dueDate' | 'resolvedAt'>, today: Date): boolean {
  return item.resolvedAt === null && item.dueDate < toIsoDate(today);
}

export function formatIsoDate(iso: string): string {
  const [y, m, d] = iso.split('-');

  return `${d}/${m}/${y}`;
}

export function recipientsLabel(recipients: Recipients): string {
  const parts = [
    ...(recipients.group === null ? [] : [groupLabel(recipients.group)]),
    ...recipients.people.map(p => p.name),
  ];

  return parts.join(', ');
}

export const OFFLINE_OBSERVATION_HINT = 'Sem conexão: criar, enviar e alterar precisam de conexão.';
export const OBSERVATION_FAILED_HINT = 'Não foi possível salvar. Tente novamente.';
