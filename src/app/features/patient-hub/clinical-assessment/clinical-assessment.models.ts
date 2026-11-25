/**
 * Cor do status de um item da avaliação clínica: as cores de comunicação e as cores primária, secundária e terciária
 * (Thiago, 2026-11-24). Sempre acompanha o texto (a cor nunca é o único sinal).
 */
export type StatusTone = 'alert' | 'focus' | 'info' | 'primary' | 'secondary' | 'success' | 'tertiary' | 'warning';

/** Opções do seletor de cor da faixa de status (rótulo em texto + token de cor). */
export const STATUS_TONES: readonly { readonly value: StatusTone; readonly label: string }[] = [
  { label: 'Vermelho', value: 'alert' },
  { label: 'Amarelo', value: 'warning' },
  { label: 'Verde', value: 'success' },
  { label: 'Roxo', value: 'info' },
  { label: 'Rosa', value: 'focus' },
  { label: 'Azul escuro', value: 'primary' },
  { label: 'Azul', value: 'secondary' },
  { label: 'Verde-água', value: 'tertiary' },
];

/** Nome da cor em texto, para o rótulo ao lado do ponto. */
export function toneLabel(tone: StatusTone): string {
  return STATUS_TONES.find(t => t.value === tone)?.label ?? '';
}

/** Faixa de valores com o seu status: ex.: 0 a 10 → "Abaixo", 11 a 40 → "Limítrofe", 50 a 100 → "Acima". */
export interface StatusRange {
  readonly from: number;
  readonly to: number;
  readonly label: string;
  readonly tone: StatusTone;
}

/** Item livre da avaliação clínica (NRS, SARC-F, panturrilha...): título, valor, unidade e faixas de status opcionais. */
export interface ClinicalItem {
  readonly id: string;
  readonly title: string;
  readonly value: string;
  readonly unit: string;
  readonly ranges: readonly StatusRange[];
  /** Item fixo (protocolo): não se exclui; o valor segue editável. */
  readonly fixed?: boolean;
}

/**
 * Avaliação clínica do paciente. Tipo de TN, dispositivo, peso e altura são **obrigatórios** (cadastrados com o paciente);
 * o IMC é calculado deles. Os demais itens são dinâmicos: o usuário insere ou remove.
 */
export interface ClinicalAssessment {
  readonly tnType: string;
  readonly device: string;
  readonly weightKg: number | null;
  readonly heightCm: number | null;
  /** Peso anterior (mostrado como "Anterior: 50,4 kg em 20/05."). */
  readonly previousWeight?: { readonly kg: number; readonly at: string };
  readonly items: readonly ClinicalItem[];
}

/** Modelo de item para sugerir um novo cadastro: título, unidade e faixas já usados antes (ou padrão das USs). */
export interface ClinicalItemTemplate {
  readonly title: string;
  readonly unit: string;
  readonly ranges: readonly StatusRange[];
}

/**
 * Tipos padrão previstos nas USs (Painel Nutricional e Avaliação Nutricional e Funcional): NRS-2002, GLIM, SARC-F,
 * handgrip, circunferências e calorimetria. As faixas são só uma sugestão simulada; o usuário cadastra do jeito que quiser.
 */
export const STANDARD_CLINICAL_ITEMS: readonly ClinicalItemTemplate[] = [
  {
    ranges: [
      { from: 0, label: 'Sem risco', to: 2, tone: 'success' },
      { from: 3, label: 'Em risco', to: 7, tone: 'warning' },
    ],
    title: 'NRS-2002',
    unit: 'pontos',
  },
  {
    ranges: [
      { from: 0, label: 'Sem desnutrição', to: 0, tone: 'success' },
      { from: 1, label: 'Moderado', to: 1, tone: 'secondary' },
      { from: 2, label: 'Grave', to: 2, tone: 'alert' },
    ],
    title: 'GLIM',
    unit: '',
  },
  {
    ranges: [
      { from: 0, label: 'Sem sinal', to: 3, tone: 'success' },
      { from: 4, label: 'Sugestivo', to: 10, tone: 'alert' },
    ],
    title: 'SARC-F',
    unit: 'pontos',
  },
  {
    ranges: [
      { from: 0, label: 'Baixo', to: 20, tone: 'alert' },
      { from: 21, label: 'Adequado', to: 100, tone: 'success' },
    ],
    title: 'Handgrip',
    unit: 'kgf',
  },
  {
    ranges: [
      { from: 0, label: 'Baixa', to: 30, tone: 'alert' },
      { from: 31, label: 'Adequada', to: 100, tone: 'success' },
    ],
    title: 'Circunferência da panturrilha',
    unit: 'cm',
  },
  { ranges: [], title: 'Circunferência braquial', unit: 'cm' },
  { ranges: [], title: 'Calorimetria indireta', unit: 'kcal/dia' },
];

/** Protocolos fixos (NRS-2002, GLIM, SARC-F): sempre aparecem na avaliação e não se excluem (Thiago, 2026-11-24). */
export const FIXED_CLINICAL_TITLES: readonly string[] = ['NRS-2002', 'GLIM', 'SARC-F'];

const normalizeTitle = (title: string): string =>
  title
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/gu, '');

/** Garante os protocolos fixos no começo (valor vazio se ainda não há) e marca os demais como não fixos. */
export function withFixedItems(items: readonly ClinicalItem[]): readonly ClinicalItem[] {
  const fixed = FIXED_CLINICAL_TITLES.map((title): ClinicalItem => {
    const found = items.find(i => normalizeTitle(i.title) === normalizeTitle(title));
    const template = STANDARD_CLINICAL_ITEMS.find(t => t.title === title);

    return {
      fixed: true,
      id: found?.id ?? `fixed-${normalizeTitle(title)}`,
      ranges: found?.ranges ?? template?.ranges ?? [],
      title,
      unit: found?.unit ?? template?.unit ?? '',
      value: found?.value ?? '',
    };
  });
  const fixedKeys = new Set(FIXED_CLINICAL_TITLES.map(normalizeTitle));

  return [...fixed, ...items.filter(i => !fixedKeys.has(normalizeTitle(i.title))).map(i => ({ ...i, fixed: false }))];
}

/** Sugestões de novo item: o histórico do usuário primeiro, depois os padrões; sem repetir título nem o que já existe. */
export function itemSuggestions(
  history: readonly ClinicalItemTemplate[],
  existingTitles: readonly string[],
): readonly ClinicalItemTemplate[] {
  const taken = new Set(existingTitles.map(t => t.trim().toLowerCase()));
  const result: ClinicalItemTemplate[] = [];

  for (const template of [...history, ...STANDARD_CLINICAL_ITEMS]) {
    const key = template.title.trim().toLowerCase();

    if (key !== '' && !taken.has(key)) {
      taken.add(key);
      result.push(template);
    }
  }

  return result;
}

export interface ClinicalStatus {
  readonly label: string;
  readonly tone: StatusTone;
}

/** Lê "4,2", "31" ou "183–257"; devolve o primeiro número (ou `null`). */
export function parseClinicalValue(raw: string): number | null {
  const match = /-?\d+(?:[.,]\d+)?/u.exec(raw);

  return match === null ? null : Number(match[0].replace(',', '.'));
}

/** Status do item para o valor atual: a primeira faixa que o contém; sem faixa, sem status. */
export function clinicalStatus(item: Pick<ClinicalItem, 'ranges' | 'value'>): ClinicalStatus | null {
  const value = parseClinicalValue(item.value);

  if (value === null) {
    return null;
  }
  const range = item.ranges.find(r => value >= r.from && value <= r.to);

  return range === undefined ? null : { label: range.label, tone: range.tone };
}

/** IMC (kg/m²) a partir do peso e da altura; `null` se faltar algum. */
export function bodyMassIndex(weightKg: number | null, heightCm: number | null): number | null {
  if (weightKg === null || heightCm === null || weightKg <= 0 || heightCm <= 0) {
    return null;
  }
  const meters = heightCm / 100;

  return weightKg / (meters * meters);
}

/** Erros de preenchimento por campo obrigatório (vazio = válido). */
export function clinicalErrors(a: Pick<ClinicalAssessment, 'device' | 'heightCm' | 'tnType' | 'weightKg'>): {
  readonly device?: string;
  readonly heightCm?: string;
  readonly tnType?: string;
  readonly weightKg?: string;
} {
  return {
    ...(a.tnType.trim() === '' ? { tnType: 'Informe o tipo de TN.' } : {}),
    ...(a.device.trim() === '' ? { device: 'Informe o dispositivo.' } : {}),
    ...(a.weightKg === null || a.weightKg <= 0 ? { weightKg: 'Informe o peso.' } : {}),
    ...(a.heightCm === null || a.heightCm <= 0 ? { heightCm: 'Informe a altura.' } : {}),
  };
}

const TN_LABELS: Readonly<Record<string, string>> = { NE: 'enteral', NP: 'parenteral', VO: 'oral' };
const DEVICE_LABELS: Readonly<Record<string, string>> = { GTT: 'gastrostomia', SNE: 'sonda', SNG: 'sonda' };

/** Rótulo pequeno ao lado do código ("NE" → "enteral"); vazio quando não há. */
export function tnLabel(code: string): string {
  return TN_LABELS[code.trim().toUpperCase()] ?? '';
}

export function deviceLabel(code: string): string {
  return DEVICE_LABELS[code.trim().toUpperCase()] ?? '';
}

/** 51 → "51,0"; 153 → "153". */
export function formatClinicalNumber(value: number, digits = 1): string {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: digits, minimumFractionDigits: digits });
}
