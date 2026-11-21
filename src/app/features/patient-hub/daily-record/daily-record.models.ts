/** Origem do texto gravado: alimenta a trilha de auditoria feita no backend (Princípio V). */
export type EvolutionOrigin = 'ai' | 'ai-edited' | 'manual';

/** Evolução médica vigente do dia (FT-004-7, US-004-7-04): texto, autor e data/hora do registro. */
export interface DailyEvolution {
  readonly author: string;
  /** ISO 8601 */
  readonly at: string;
  readonly origin: EvolutionOrigin;
  readonly text: string;
}

export interface EvolutionSaveRequest {
  readonly author: string;
  readonly at: string;
  readonly origin: EvolutionOrigin;
  readonly patientId: string;
  /** AAAA-MM-DD: dia a que a evolução pertence. */
  readonly day: string;
  readonly text: string;
}

/** AAAA-MM-DD no fuso local. */
export function dayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${date.getFullYear()}-${month}-${day}`;
}

/** "28/05 às 16:05" a partir de um ISO. */
export function registeredAt(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number): string => String(n).padStart(2, '0');

  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} às ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Parâmetro assistencial acompanhado no Registro diário (FT-004-7). A lista é aberta, não um conjunto fixo. */
export interface ParameterDefinition {
  readonly id: string;
  readonly label: string;
  readonly unit: string;
  readonly placeholder: string;
  /** Texto de ajuda do card quando ainda não há lançamento. */
  readonly help: string;
}

/**
 * Catálogo inicial do Figma 4717-9855 e da story (glicemia, evacuações, débito de ileostomia, diurese,
 * resultado laboratorial). Outros parâmetros entram pelo cadastro de parâmetro novo.
 */
export const INITIAL_PARAMETERS: readonly ParameterDefinition[] = [
  {
    help: 'Cada lançamento vira um ponto novo.',
    id: 'glycemia',
    label: 'Glicemia',
    placeholder: 'Ex.: 132',
    unit: 'mg/dL',
  },
  {
    help: 'Número de evacuações no momento do registro.',
    id: 'bowel',
    label: 'Evacuações',
    placeholder: 'Ex.: 2',
    unit: 'evacuações',
  },
  {
    help: 'Débito medido no momento do registro.',
    id: 'ileostomy',
    label: 'Débito de ileostomia',
    placeholder: 'Ex.: 300',
    unit: 'mL',
  },
  {
    help: 'Evacuações e débito de ileostomia seguem o mesmo card.',
    id: 'diuresis',
    label: 'Diurese',
    placeholder: 'Ex.: 1200',
    unit: 'mL',
  },
  {
    help: 'Informe o valor do resultado recebido.',
    id: 'lab',
    label: 'Resultado laboratorial',
    placeholder: 'Ex.: 4,2',
    unit: 'valor',
  },
];

/** Um lançamento: ponto específico do histórico de um parâmetro, com autor e data/hora (FR-001/FR-002). */
export interface ParameterEntry {
  readonly id: string;
  readonly parameterId: string;
  readonly value: number;
  readonly author: string;
  /** Data/hora do lançamento (ISO). */
  readonly at: string;
}

/** Lançamento ainda não gravado; a gravação atribui o `id`. */
export type NewParameterEntry = Omit<ParameterEntry, 'id'>;

export const INVALID_VALUE_HINT = 'Informe um número válido, por exemplo 132 ou 4,2.';
export const NOTHING_TO_SAVE_HINT = 'Preencha o valor de ao menos um parâmetro para salvar o registro.';

/** Converte o texto digitado (aceita vírgula) em número; `null` quando não é um número não negativo. */
export function parseParameterValue(text: string): number | null {
  const trimmed = text.trim();

  if (!/^\d+([.,]\d+)?$/.test(trimmed)) {
    return null;
  }

  return Number(trimmed.replace(',', '.'));
}

export function formatParameterValue(value: number): string {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 3 });
}

/** HH:mm no fuso local. */
export function formatEntryTime(iso: string): string {
  const d = new Date(iso);

  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Mesmo dia civil local. */
export function isSameDay(iso: string, reference: Date): boolean {
  const d = new Date(iso);

  return (
    d.getFullYear() === reference.getFullYear() &&
    d.getMonth() === reference.getMonth() &&
    d.getDate() === reference.getDate()
  );
}
