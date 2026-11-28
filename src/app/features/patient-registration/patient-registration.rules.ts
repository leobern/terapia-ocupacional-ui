/** Regras de validação dos dados fixos do paciente (US-002-1-02: RN-01 a RN-03). Funções puras. */

import { type BrDate, centuryOf, parseBrDate } from '../../shared/utils/br-date';

export type PatientSex = 'MALE' | 'FEMALE' | 'NOT_INFORMED';

export const PATIENT_SEXES: readonly PatientSex[] = ['MALE', 'FEMALE', 'NOT_INFORMED'];
export const FULL_NAME_MAX = 150;
export const SAME_MAX = 30;
export const BED_NUMBER_MAX = 20;
export const HEALTH_INSURANCE_MAX = 100;
export const ADMISSION_NUMBER_MAX = 30;
export const LOCATION_VALUE_MAX = 100;
export const LOCATION_LIMIT = 2;

export type LocationKind = 'UNIDADE' | 'ALA';
export const LOCATION_KINDS: readonly LocationKind[] = ['UNIDADE', 'ALA'];

/** Códigos das mensagens do sistema usados nas validações. */
export type PatientMessageCode =
  | 'MSG-01'
  | 'MSG-02'
  | 'MSG-03'
  | 'MSG-05'
  | 'MSG-08'
  | 'MSG-09'
  | 'MSG-10'
  | 'admissionNumberTooLong'
  | 'admitChoice'
  | 'bedTooLong'
  | 'insuranceTooLong'
  | 'invalidDate'
  | 'locationLimit'
  | 'locationNotInformed'
  | 'locationTooLong'
  | 'locationTypeRepeated'
  | 'sameTooLong';

export type RuleResult<T> = { readonly value: T } | { readonly code: PatientMessageCode };

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/gu, '')
    .toLowerCase()
    .replace(/[\s_-]+/gu, ' ')
    .trim();
}

/** Nome completo: não vazio (MSG-01) e até 150 caracteres (MSG-05). */
export function validateFullName(raw: string): RuleResult<string> {
  const name = raw.trim();

  if (name === '') {
    return { code: 'MSG-01' };
  }

  return name.length > FULL_NAME_MAX ? { code: 'MSG-05' } : { value: name };
}

function toIso(day: Date): string {
  return `${String(day.getFullYear()).padStart(4, '0')}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
}

/** "hoje"/"ontem" viram a data na hora, sem precisar da IA (Thiago, 2026-11-27); outra coisa devolve `null`. */
function relativeDate(raw: string, today: Date): BrDate | null {
  const word = normalize(raw);
  const offsets = new Map<string, number>([
    ['hoje', 0],
    ['ontem', -1],
  ]);
  const offset = offsets.get(word);

  if (offset === undefined) {
    return null;
  }
  const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);

  return { date, iso: toIso(date) };
}

function startOfDay(day: Date): Date {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate());
}

/** Data dia-mês-ano existente e não posterior a `today` (hoje é válido); devolve `aaaa-mm-dd` (MSG-02 se inválida). */
export function validateBirthDate(raw: string, today: Date): RuleResult<string> {
  const parsed = parseBrDate(raw);

  return parsed && parsed.date <= startOfDay(today) ? { value: parsed.iso } : { code: 'MSG-02' };
}

/** Sexo: aceita o rótulo (`labels`) ou o valor do contrato; qualquer outra coisa é MSG-03. */
export function validateSex(raw: string, labels: Readonly<Record<PatientSex, string>>): RuleResult<PatientSex> {
  const answer = normalize(raw);
  const found = PATIENT_SEXES.find(sex => answer === normalize(sex) || answer === normalize(labels[sex]));

  return found ? { value: found } : { code: 'MSG-03' };
}

/** SAME: opcional, até 30 caracteres, sem formato fixo. */
export function validateMedicalRecordNumber(raw: string): RuleResult<string> {
  const same = raw.trim();

  return same.length > SAME_MAX ? { code: 'sameTooLong' } : { value: same };
}

/** Internar agora? Aceita sim/yes e não/no (rótulos das opções); qualquer outra coisa é `admitChoice`. */
export function validateAdmitChoice(raw: string): RuleResult<'yes' | 'no'> {
  const answer = normalize(raw);

  if (answer === 'sim' || answer === 'yes') {
    return { value: 'yes' };
  }

  return answer === 'nao' || answer === 'no' ? { value: 'no' } : { code: 'admitChoice' };
}

/** "Não sei" e equivalentes: o campo opcional fica vazio (RN-01 da US-002-1-06). */
function isDontKnow(raw: string): boolean {
  return ['nao sei', 'n sei', 'nao lembro', "i don't know", 'i dont know', 'dont know', 'unknown'].includes(
    normalize(raw),
  );
}

function validateOptionalText(raw: string, max: number, tooLong: PatientMessageCode): RuleResult<string> {
  const text = raw.trim();

  if (isDontKnow(text)) {
    return { value: '' };
  }

  return text.length > max ? { code: tooLong } : { value: text };
}

/** Leito: opcional, até 20 caracteres. */
export function validateBedNumber(raw: string): RuleResult<string> {
  return validateOptionalText(raw, BED_NUMBER_MAX, 'bedTooLong');
}

/** Convênio: opcional, até 100 caracteres. */
export function validateHealthInsurance(raw: string): RuleResult<string> {
  return validateOptionalText(raw, HEALTH_INSURANCE_MAX, 'insuranceTooLong');
}

/** Número de atendimento: opcional, até 30 caracteres, sem formato fixo. */
export function validateAdmissionNumber(raw: string): RuleResult<string> {
  return validateOptionalText(raw, ADMISSION_NUMBER_MAX, 'admissionNumberTooLong');
}

/** Data de internação hospitalar: real e não futura (RN-02, MSG-08); aceita ano com 2 dígitos; "não sei" deixa vazio. */
export function validateHospitalAdmissionDate(raw: string, today: Date): RuleResult<string> {
  if (isDontKnow(raw)) {
    return { value: '' };
  }
  const parsed = parseBrDate(raw, centuryOf(today)) ?? relativeDate(raw, today);

  if (!parsed) {
    return { code: 'invalidDate' };
  }

  return parsed.date > startOfDay(today) ? { code: 'MSG-08' } : { value: parsed.iso };
}

/** Data de início da TN: real (pode ser futura); aceita ano com 2 dígitos; "não sei" deixa vazio. */
export function validateNutritionalTherapyStartDate(raw: string, today: Date = new Date()): RuleResult<string> {
  if (isDontKnow(raw)) {
    return { value: '' };
  }
  const parsed = parseBrDate(raw, centuryOf(today)) ?? relativeDate(raw, today);

  return parsed ? { value: parsed.iso } : { code: 'invalidDate' };
}

/** Tipo da localização: aceita o rótulo (`labels`) ou o valor do contrato; outra coisa é MSG-09 (US-002-1-07). */
export function validateLocationType(
  raw: string,
  labels: Readonly<Record<LocationKind, string>>,
): RuleResult<LocationKind> {
  const answer = normalize(raw);
  const found = LOCATION_KINDS.find(kind => answer === normalize(labels[kind]) || answer === normalize(kind));

  return found ? { value: found } : { code: 'MSG-09' };
}

/** Valor da localização: não vazio (MSG-10) e até 100 caracteres. */
export function validateLocationValue(raw: string): RuleResult<string> {
  const text = raw.trim();

  if (text === '') {
    return { code: 'MSG-10' };
  }

  return text.length > LOCATION_VALUE_MAX ? { code: 'locationTooLong' } : { value: text };
}
