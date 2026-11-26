import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
  HttpResponse,
} from '@angular/common/http';
import { inject, InjectionToken } from '@angular/core';
import { environment } from '@environments/environment';
import { catchError, from, mergeMap, Observable, tap, throwError, timeout } from 'rxjs';

import { isNetworkFailure } from './network-failure';
import { NetworkStateService } from './network-state.service';
import { OfflineStore } from './offline-store';
import { OfflineUserService } from './offline-user.service';

/** Tempo máximo de uma leitura antes de cair no cache (rede ruim não pode travar a tela). */
export const OFFLINE_READ_TIMEOUT_MS = new InjectionToken<number>('OFFLINE_READ_TIMEOUT_MS', {
  factory: (): number => 10_000,
});

/** Leituras do Hub do paciente real (id numérico): `/v1/pacientes/{id}` e tudo abaixo dele. Ids de exemplo ficam de fora. */
function isHubRead(url: string): boolean {
  return new RegExp(`^${environment.apiBaseUrl}/v1/pacientes/[1-9][0-9]{0,15}(?:[/?]|$)`).test(url);
}

/** Valor guardado de uma resposta: só o que a UI usa (status e corpo). */
interface StoredResponse {
  readonly status: number;
  readonly body: unknown;
}

/** Chamadas à API fora do cache: só alimentam o "sem conexão" (qualquer resposta do servidor = alcançável). */
function trackReachability(
  request: HttpRequest<unknown>,
  next: HttpHandlerFn,
  state: NetworkStateService,
): Observable<HttpEvent<unknown>> {
  if (!request.url.startsWith(`${environment.apiBaseUrl}/`)) {
    return next(request);
  }

  return next(request).pipe(
    tap(event => {
      if (event instanceof HttpResponse) {
        state.markReachable();
      }
    }),
    catchError((error: unknown) => {
      if (isNetworkFailure(error)) {
        state.markUnreachable();
      } else if (error instanceof HttpErrorResponse) {
        state.markReachable();
      }

      return throwError(() => error);
    }),
  );
}

/**
 * Cache de leitura do Hub (ADR-003), em um único ponto na pilha HTTP em vez de decorar cada porta: toda leitura `GET`
 * de `/v1/pacientes/{id}…` de paciente real, com sessão, é guardada por usuário e URL; quando a leitura falha por REDE
 * (sem resposta, 502/503/504 ou tempo esgotado) devolve a última cópia, marcando "dado em cache" em
 * `NetworkStateService`. Erros do servidor (401/403/404…) NUNCA caem no cache: um acesso revogado não pode mostrar
 * dado clínico. Rede no modelo network-first com tempo curto: as portas devolvem Promise e não emitem duas vezes, então
 * o "stale-while-revalidate" literal é substituído por "servidor primeiro, cópia local na falha".
 */
export const offlineCacheInterceptor: HttpInterceptorFn = (request, next) => {
  const users = inject(OfflineUserService);
  const store = inject(OfflineStore);
  const state = inject(NetworkStateService);
  const limit = inject(OFFLINE_READ_TIMEOUT_MS);
  const userId = users.userId();

  if (request.method !== 'GET' || userId === null || !isHubRead(request.urlWithParams)) {
    return trackReachability(request, next, state);
  }
  const key = request.urlWithParams;

  return next(request).pipe(
    timeout(limit),
    tap(event => {
      if (event instanceof HttpResponse) {
        state.markFresh();
        const stored: StoredResponse = { body: event.body, status: event.status };

        // Falha ao guardar não pode derrubar a leitura que deu certo.
        store.putCache(userId, key, stored, new Date().toISOString()).catch(() => undefined);
      }
    }),
    catchError((error: unknown): Observable<HttpEvent<unknown>> => {
      if (!isNetworkFailure(error)) {
        if (error instanceof HttpErrorResponse) {
          state.markReachable();
        }

        return throwError(() => error);
      }

      return from(store.getCache(userId, key).catch(() => null)).pipe(
        mergeMap(cached => {
          if (cached === null) {
            state.markUnreachable();

            return throwError(() => error);
          }
          const { body, status } = cached.value as StoredResponse;

          state.markStale(cached.savedAt);

          return from([new HttpResponse({ body, status, url: request.url })]);
        }),
      );
    }),
  );
};
