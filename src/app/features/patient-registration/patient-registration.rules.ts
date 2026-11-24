/** Regras de validação dos dados fixos do paciente (US-002-1-02: RN-01 a RN-03). Funções puras. */

export type PatientSex = 'MALE' | 'FEMALE' | 'NOT_INFORMED';

export const PATIENT_SEXES: readonly PatientSex[] = ['MALE', 'FEMALE', 'NOT_INFORMED'];
export const FULL_NAME_MAX = 150;
export const SAME_MAX = 30;

/** Códigos das mensagens do sistema usados nas validações. */
export type PatientMessageCode = 'MSG-01' | 'MSG-02' | 'MSG-03' | 'MSG-05' | 'sameTooLong';

export type RuleResult<T> = { readonly value: T } | { readonly code: PatientMessageCode };

const DATE_BR = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/u;

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

/** Data dd/mm/aaaa existente e não posterior a `today` (hoje é válido); devolve `aaaa-mm-dd` (MSG-02 se inválida). */
export function validateBirthDate(raw: string, today: Date): RuleResult<string> {
  const match = DATE_BR.exec(raw.trim());

  if (!match) {
    return { code: 'MSG-02' };
  }
  const [day, month, year] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(year, month - 1, day);
  const exists = date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  if (!exists || year < 1 || date > startOfToday) {
    return { code: 'MSG-02' };
  }

  return {
    value: `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
  };
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
