import { ProvisionalPatientNameExtractor } from './provisional-patient-name-extractor';

describe('ProvisionalPatientNameExtractor', () => {
  const extractor = new ProvisionalPatientNameExtractor();

  it('extracts the name between the verb and "para o leito"', () => {
    expect(extractor.extract('mover Beatriz Ramos Costa para o leito 210')).toBe('Beatriz Ramos Costa');
    expect(extractor.extract('Transferir Otávio Nunes Prado pro leito 7')).toBe('Otávio Nunes Prado');
    expect(extractor.extract('mudar a paciente Ana D’Ávila para o leito 3')).toBe('Ana D’Ávila');
    expect(extractor.extract('alterar o leito da Maria da Silva para 12')).toBe('Maria da Silva');
  });

  it('returns null when there is no name', () => {
    expect(extractor.extract('mudar para o leito 412')).toBeNull();
    expect(extractor.extract('mover o paciente para o leito 412')).toBeNull();
    expect(extractor.extract('leito 412')).toBeNull();
    expect(extractor.extract('')).toBeNull();
  });
});
