import { HttpErrorResponse } from '@angular/common/http';

import { apiErrorMessage } from './notifications.errors';

describe('apiErrorMessage', () => {
  it('traduz 401/403/404/422 em mensagens próprias', () => {
    const msg = (status: number): string => apiErrorMessage(new HttpErrorResponse({ status }), 'padrão');

    expect(msg(401)).toContain('sessão expirou');
    expect(msg(403)).toContain('participante');
    expect(msg(404)).toContain('não foi encontrada');
    expect(msg(422)).toContain('Revise o texto');
  });

  it('usa o texto padrão para outros erros e para erros que não são HTTP', () => {
    expect(apiErrorMessage(new HttpErrorResponse({ status: 500 }), 'padrão')).toBe('padrão');
    expect(apiErrorMessage(new Error('x'), 'padrão')).toBe('padrão');
  });
});
