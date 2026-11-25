import { formatRecordTime, groupOfSpecialty } from './patient-message.models';

describe('patient-message.models', () => {
  it('formata data e hora', () => {
    expect(formatRecordTime(new Date(2026, 10, 3, 9, 5).toISOString())).toBe('03/11/2026 09:05');
  });

  it('descobre o grupo pela especialidade em texto livre e devolve null quando não reconhece', () => {
    expect(groupOfSpecialty('Nutricionista clínica')).toBe('nutritionists');
    expect(groupOfSpecialty('Nutróloga')).toBe('doctors');
    expect(groupOfSpecialty('Enfermeiro')).toBe('nurses');
    expect(groupOfSpecialty('Farmacêutico')).toBe('pharmacists');
    expect(groupOfSpecialty('Fisioterapeuta')).toBe('physio');
    expect(groupOfSpecialty('Fonoaudióloga')).toBe('speech');
    expect(groupOfSpecialty('Outro')).toBeNull();
  });
});
