/** Perfis profissionais que podem ser mencionados como grupo (@medicos, @nutris, @enfermagem…). */
export type ProfessionalGroup = 'doctors' | 'nurses' | 'nutritionists' | 'pharmacists' | 'physio' | 'speech';

/** Profissional vinculado e aprovado a UM paciente específico (FR-005). */
export interface LinkedProfessional {
  readonly id: number;
  readonly name: string;
  readonly specialty: string;
  readonly group: ProfessionalGroup | null;
}

/** Destinatário gravado no registro (pessoa já resolvida). */
export interface RecipientRef {
  readonly id: number;
  readonly name: string;
  readonly specialty: string;
}

/** Observação (sem destinatário) ou mensagem direcionada (com destinatário); imutável depois de salva. */
export interface PatientRecord {
  readonly id: string;
  readonly patientId: string;
  readonly author: string;
  /** ISO 8601 */
  readonly at: string;
  readonly content: string;
  readonly recipients: readonly RecipientRef[];
  readonly viaAudio: boolean;
}

/** Destinatário no formato do contrato (`RecipientSpec`, openapi/mensagens-api.yaml). */
export interface RecipientSpec {
  readonly type: 'PESSOA' | 'GRUPO' | 'TODOS';
  readonly professionalId?: number;
  readonly perfil?: string;
}

/**
 * Contrato de gravação: autor e data/hora seguem para a trilha de auditoria imutável (Princípio V).
 * `recipientSpecs` é o que o profissional confirmou (@todos ou pessoas); sem ele, valem `recipients`.
 */
export type PatientRecordRequest = Omit<PatientRecord, 'id'> & { readonly recipientSpecs?: readonly RecipientSpec[] };

const pad = (n: number): string => String(n).padStart(2, '0');

export function formatRecordTime(iso: string): string {
  const d = new Date(iso);

  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const SPECIALTY_PATTERNS: readonly { readonly group: ProfessionalGroup; readonly pattern: RegExp }[] = [
  { group: 'nutritionists', pattern: /nutricionist/ },
  { group: 'doctors', pattern: /m[eé]dic|nutr[oó]log|intensivist|cl[ií]nic/ },
  { group: 'nurses', pattern: /enfermeir/ },
  { group: 'pharmacists', pattern: /farmac/ },
  { group: 'physio', pattern: /fisioterap/ },
  { group: 'speech', pattern: /fonoaudi/ },
];

/** Grupo da tela a que a especialidade (texto livre do backend) pertence; `null` quando não reconhecida. */
export function groupOfSpecialty(specialty: string): ProfessionalGroup | null {
  const text = specialty.toLowerCase();

  return SPECIALTY_PATTERNS.find(rule => rule.pattern.test(text))?.group ?? null;
}
