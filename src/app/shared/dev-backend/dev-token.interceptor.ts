import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { environment } from '@environments/environment';
import { switchMap } from 'rxjs';

import { DevTokenService } from './dev-token.service';

/**
 * Envia o token de teste nas chamadas à API; a que busca o próprio token passa direto. Quando a chamada já
 * leva `Authorization` (sessão real de quem entrou pelo login), o token de dev NÃO a sobrescreve.
 */
export const devTokenInterceptor: HttpInterceptorFn = (request, next) => {
  const isApi = request.url.startsWith(`${environment.apiBaseUrl}/`);

  if (!isApi || request.url.endsWith(DevTokenService.path) || request.headers.has('Authorization')) {
    return next(request);
  }

  return inject(DevTokenService)
    .token()
    .pipe(switchMap(token => next(request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }))));
};
