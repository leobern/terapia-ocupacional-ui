import {
  validateBirthDate,
  validateFullName,
  validateMedicalRecordNumber,
  validateSex,
} from './patient-registration.rules';

describe('patient registration rules', () => {
  const today = new Date(2026, 10, 24, 15, 30);
  const labels = { FEMALE: 'Feminino', MALE: 'Masculino', NOT_INFORMED: 'Não informado' } as const;

  it('validates the full name (MSG-01 / MSG-05)', () => {
    expect(validateFullName('  Carlos Eduardo Matos ')).toEqual({ value: 'Carlos Eduardo Matos' });
    expect(validateFullName('   ')).toEqual({ code: 'MSG-01' });
    expect(validateFullName('a'.repeat(150))).toEqual({ value: 'a'.repeat(150) });
    expect(validateFullName('a'.repeat(151))).toEqual({ code: 'MSG-05' });
  });

  it('validates the birth date (MSG-02) and converts it to ISO', () => {
    expect(validateBirthDate('15/09/1975', today)).toEqual({ value: '1975-09-15' });
    expect(validateBirthDate('5/9/1975', today)).toEqual({ value: '1975-09-05' });
    expect(validateBirthDate('24/11/2026', today)).toEqual({ value: '2026-11-24' });
    expect(validateBirthDate('25/11/2026', today)).toEqual({ code: 'MSG-02' });
    expect(validateBirthDate('31/02/2000', today)).toEqual({ code: 'MSG-02' });
    expect(validateBirthDate('', today)).toEqual({ code: 'MSG-02' });
    expect(validateBirthDate('1975-09-15', today)).toEqual({ code: 'MSG-02' });
    expect(validateBirthDate('15/09/0000', today)).toEqual({ code: 'MSG-02' });
  });

  it('validates the sex by label or contract value (MSG-03)', () => {
    expect(validateSex('Masculino', labels)).toEqual({ value: 'MALE' });
    expect(validateSex(' feminino ', labels)).toEqual({ value: 'FEMALE' });
    expect(validateSex('nao informado', labels)).toEqual({ value: 'NOT_INFORMED' });
    expect(validateSex('NOT_INFORMED', labels)).toEqual({ value: 'NOT_INFORMED' });
    expect(validateSex('outro', labels)).toEqual({ code: 'MSG-03' });
  });

  it('limits the SAME to 30 characters', () => {
    expect(validateMedicalRecordNumber(' 12345 ')).toEqual({ value: '12345' });
    expect(validateMedicalRecordNumber('')).toEqual({ value: '' });
    expect(validateMedicalRecordNumber('1'.repeat(30))).toEqual({ value: '1'.repeat(30) });
    expect(validateMedicalRecordNumber('1'.repeat(31))).toEqual({ code: 'sameTooLong' });
  });
});
