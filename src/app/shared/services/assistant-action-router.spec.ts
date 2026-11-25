import { recognizeAction } from './assistant-action-router';

describe('recognizeAction: alteração de unidade/ala (US-002-2-06)', () => {
  it('routes unit and ward requests to change-location', () => {
    expect(recognizeAction('unidade UTI')?.id).toBe('change-location');
    expect(recognizeAction('mudar a ala para Ala Norte')?.id).toBe('change-location');
  });

  it('keeps bed requests on move-bed', () => {
    expect(recognizeAction('mudar o leito para 12')?.id).toBe('move-bed');
  });
});
