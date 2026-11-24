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

/** Uma menção ou sugestão, com os profissionais resolvidos no momento da confirmação. */
export interface RecipientEntry {
  readonly key: string;
  /** Texto exibido: "@medicos", "@todos" ou o nome da pessoa. */
  readonly label: string;
  /** `mention` = escrito pelo profissional; `ai` = sugerido pelo assistente (exige confirmação). */
  readonly origin: 'mention' | 'ai';
  readonly members: readonly LinkedProfessional[];
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

/** Contrato de gravação: autor e data/hora seguem para a trilha de auditoria imutável (Princípio V). */
export type PatientRecordRequest = Omit<PatientRecord, 'id'>;

interface GroupInfo {
  readonly aliases: readonly string[];
  readonly label: string;
  readonly title: string;
}

export const GROUPS: Readonly<Record<ProfessionalGroup, GroupInfo>> = {
  doctors: { aliases: ['medicos', 'medico'], label: '@medicos', title: 'médicos' },
  nurses: { aliases: ['enfermagem', 'enfermeiros', 'enfermeiro'], label: '@enfermagem', title: 'enfermagem' },
  nutritionists: { aliases: ['nutris', 'nutri', 'nutricionistas'], label: '@nutris', title: 'nutricionistas' },
  pharmacists: { aliases: ['farmacia', 'farmaceuticos'], label: '@farmacia', title: 'farmácia' },
  physio: { aliases: ['fisio', 'fisioterapeutas'], label: '@fisio', title: 'fisioterapia' },
  speech: { aliases: ['fonos', 'fono', 'fonoaudiologos'], label: '@fonos', title: 'fonoaudiologia' },
};

export const ALL_LABEL = '@todos';
export const GROUP_KEYS = Object.keys(GROUPS) as ProfessionalGroup[];

export const OFFLINE_HINT = 'Sem conexão: registrar ou enviar fica indisponível até a conexão voltar.';
export const SEND_FAILED_HINT = 'Não foi possível registrar. O conteúdo foi mantido; tente novamente.';
export const EMPTY_CONTENT_HINT = 'Descreva a situação antes de continuar.';

const normalize = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

export function entryForGroup(
  group: ProfessionalGroup,
  team: readonly LinkedProfessional[],
  origin: RecipientEntry['origin'],
): RecipientEntry {
  return {
    key: `group:${group}`,
    label: GROUPS[group].label,
    members: team.filter(p => p.group === group),
    origin,
  };
}

export function entryForAll(team: readonly LinkedProfessional[], origin: RecipientEntry['origin']): RecipientEntry {
  return { key: 'all', label: ALL_LABEL, members: team, origin };
}

export function entryForPerson(person: LinkedProfessional, origin: RecipientEntry['origin']): RecipientEntry {
  return { key: `person:${person.id}`, label: person.name, members: [person], origin };
}

/** Extrai as menções `@…` do texto: grupo, @todos ou pessoa vinculada (primeiro nome ou parte do nome). */
export function parseMentions(text: string, team: readonly LinkedProfessional[]): readonly RecipientEntry[] {
  const entries = new Map<string, RecipientEntry>();

  for (const match of text.matchAll(/@([\p{L}\d_-]+)/gu)) {
    const token = normalize(match[1]);
    const group = GROUP_KEYS.find(key => GROUPS[key].aliases.includes(token));
    let entry: RecipientEntry | null = null;

    if (token === 'todos') {
      entry = entryForAll(team, 'mention');
    } else if (group) {
      entry = entryForGroup(group, team, 'mention');
    } else {
      const person = team.find(p => normalize(p.name).split(/\s+/).includes(token));

      entry = person ? entryForPerson(person, 'mention') : null;
    }
    if (entry && !entries.has(entry.key)) {
      entries.set(entry.key, entry);
    }
  }

  return [...entries.values()];
}

/** Profissionais distintos que receberão a mensagem (união dos membros das entradas válidas). */
export function resolveRecipients(entries: readonly RecipientEntry[]): readonly RecipientRef[] {
  const byId = new Map<number, RecipientRef>();

  for (const member of entries.flatMap(e => e.members)) {
    byId.set(member.id, { id: member.id, name: member.name, specialty: member.specialty });
  }

  return [...byId.values()];
}

/** Entrada de grupo/@todos sem nenhum profissional vinculado: bloqueia o envio direcionado. */
export const isBlocked = (entry: RecipientEntry): boolean => entry.members.length === 0;

export function blockedMessage(entry: RecipientEntry): string {
  return entry.key === 'all'
    ? 'Nenhum profissional está vinculado a este paciente.'
    : `Nenhum profissional de ${entry.label} está vinculado a este paciente.`;
}

const pad = (n: number): string => String(n).padStart(2, '0');

export function formatRecordTime(iso: string): string {
  const d = new Date(iso);

  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
