import { HttpErrorResponse } from '@angular/common/http';
import { TimeoutError } from 'rxjs';

import { failureReason, isNetworkFailure } from './network-failure';

describe('isNetworkFailure', () => {
  it('reconhece falta de resposta, gateway sem servidor e tempo esgotado', () => {
    for (const status of [0, 502, 503, 504]) {
      expect(isNetworkFailure(new HttpErrorResponse({ status }))).toBeTrue();
    }
    expect(isNetworkFailure(new TimeoutError())).toBeTrue();
  });

  it('não trata resposta do servidor nem erro qualquer como rede', () => {
    for (const status of [400, 401, 403, 404, 422, 500]) {
      expect(isNetworkFailure(new HttpErrorResponse({ status }))).toBeFalse();
    }
    expect(isNetworkFailure(new Error('x'))).toBeFalse();
  });
});

describe('failureReason', () => {
  it('usa a mensagem do servidor quando existe', () => {
    expect(failureReason(new HttpErrorResponse({ error: { message: 'Texto em branco' }, status: 400 }))).toBe(
      'Texto em branco',
    );
  });

  it('cai no texto por status quando o corpo não tem mensagem', () => {
    expect(failureReason(new HttpErrorResponse({ error: { message: '  ' }, status: 422 }))).toContain('422');
    expect(failureReason(new HttpErrorResponse({ error: null, status: 404 }))).toContain('404');
  });

  it('devolve um texto padrão para erros que não são HTTP', () => {
    expect(failureReason(new Error('x'))).toBe('Não foi possível enviar o registro.');
  });
});
