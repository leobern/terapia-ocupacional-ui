import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { environment } from '@environments/environment';
import { catchError, from, Observable, switchMap, throwError } from 'rxjs';

import { LocalSessionStore } from './local-session-store';
import { SessionRenewalService } from './session-renewal.service';

function withToken(request: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
  return request.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}

/**
 * Envia o `accessToken` da sessão local nas chamadas à API e, ao receber 401 (token
 * expirado), renova e repete a chamada uma vez, sem interrupção visível (C5, RN-05).
 * Sem sessão local ou com `Authorization` já definido, a chamada passa direto.
 */
export const sessionAuthInterceptor: HttpInterceptorFn = (request, next) => {
  const store = inject(LocalSessionStore);
  const renewal = inject(SessionRenewalService);
  const sent = store.accessToken();

  if (!request.url.startsWith(`${environment.apiBaseUrl}/`) || request.headers.has('Authorization') || !sent) {
    return next(request);
  }

  return next(withToken(request, sent)).pipe(
    catchError((error: unknown): Observable<never> | ReturnType<typeof next> => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401) {
        return throwError(() => error);
      }

      // Outra chamada já renovou enquanto esta voava: só repete com o token atual.
      const current = store.accessToken();
      const token$ = current && current !== sent ? Promise.resolve(current) : renewal.renew();

      return from(token$).pipe(
        switchMap(token => next(withToken(request, token))),
        // Renovação falhou (definitiva ou rede): devolve o 401 original ao chamador.
        catchError((inner: unknown) => throwError(() => (inner instanceof HttpErrorResponse ? inner : error))),
      );
    }),
  );
};
