import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { environment } from '@environments/environment';
import { switchMap } from 'rxjs';

import { DevTokenService } from './dev-token.service';

/** Envia o token de teste do gestor nas chamadas à API; a chamada que busca o próprio token passa direto. */
export const devTokenInterceptor: HttpInterceptorFn = (request, next) => {
  const isApi = request.url.startsWith(`${environment.apiBaseUrl}/`);

  if (!isApi || request.url.endsWith(DevTokenService.path)) {
    return next(request);
  }

  return inject(DevTokenService)
    .token()
    .pipe(switchMap(token => next(request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }))));
};
