import {
  validateAdmissionNumber,
  validateAdmitChoice,
  validateBedNumber,
  validateBirthDate,
  validateFullName,
  validateHealthInsurance,
  validateHospitalAdmissionDate,
  validateMedicalRecordNumber,
  validateNutritionalTherapyStartDate,
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

describe('validateAdmitChoice', () => {
  it('accepts yes/no in any case, with or without accent', () => {
    expect(validateAdmitChoice('Sim')).toEqual({ value: 'yes' });
    expect(validateAdmitChoice(' yes ')).toEqual({ value: 'yes' });
    expect(validateAdmitChoice('NÃO')).toEqual({ value: 'no' });
    expect(validateAdmitChoice('nao')).toEqual({ value: 'no' });
    expect(validateAdmitChoice('no')).toEqual({ value: 'no' });
  });

  it('rejects anything else', () => {
    expect(validateAdmitChoice('talvez')).toEqual({ code: 'admitChoice' });
  });
});

describe('admission rules (US-002-1-06)', () => {
  const today = new Date(2026, 10, 24, 15, 30);

  it('accepts free text up to the limits and trims it', () => {
    expect(validateBedNumber(' 302B ')).toEqual({ value: '302B' });
    expect(validateBedNumber('1'.repeat(20))).toEqual({ value: '1'.repeat(20) });
    expect(validateBedNumber('1'.repeat(21))).toEqual({ code: 'bedTooLong' });
    expect(validateHealthInsurance('a'.repeat(100))).toEqual({ value: 'a'.repeat(100) });
    expect(validateHealthInsurance('a'.repeat(101))).toEqual({ code: 'insuranceTooLong' });
    expect(validateAdmissionNumber('AB-12/3')).toEqual({ value: 'AB-12/3' });
    expect(validateAdmissionNumber('1'.repeat(31))).toEqual({ code: 'admissionNumberTooLong' });
  });

  it('treats "não sei" as an empty answer', () => {
    expect(validateBedNumber('Não sei')).toEqual({ value: '' });
    expect(validateHealthInsurance("I don't know")).toEqual({ value: '' });
    expect(validateAdmissionNumber('')).toEqual({ value: '' });
    expect(validateHospitalAdmissionDate('nao sei', today)).toEqual({ value: '' });
    expect(validateNutritionalTherapyStartDate('não sei')).toEqual({ value: '' });
  });

  it('accepts today and past admission dates, rejecting future ones with MSG-08 (RN-02)', () => {
    expect(validateHospitalAdmissionDate('24/11/2026', today)).toEqual({ value: '2026-11-24' });
    expect(validateHospitalAdmissionDate('01/01/2020', today)).toEqual({ value: '2020-01-01' });
    expect(validateHospitalAdmissionDate('25/11/2026', today)).toEqual({ code: 'MSG-08' });
    expect(validateHospitalAdmissionDate('31/02/2026', today)).toEqual({ code: 'invalidDate' });
    expect(validateHospitalAdmissionDate('ontem', today)).toEqual({ code: 'invalidDate' });
  });

  it('accepts any valid nutritional therapy start date', () => {
    expect(validateNutritionalTherapyStartDate('25/12/2026')).toEqual({ value: '2026-12-25' });
    expect(validateNutritionalTherapyStartDate('30/02/2026')).toEqual({ code: 'invalidDate' });
  });

  it('aceita os separadores combinados nas três datas do cadastro', () => {
    const iso = { value: '2020-06-08' };

    for (const text of ['08/06/2020', '08-06-2020', '08.06.2020', '08 06 2020', '08062020', '8-6-2020']) {
      expect(validateBirthDate(text, today)).withContext(text).toEqual(iso);
      expect(validateHospitalAdmissionDate(text, today)).withContext(text).toEqual(iso);
      expect(validateNutritionalTherapyStartDate(text)).withContext(text).toEqual(iso);
    }
  });
});
