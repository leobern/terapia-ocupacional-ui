import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@environments/environment';
import { map, Observable, shareReplay } from 'rxjs';

/**
 * Token de TESTE do gestor, só para desenvolvimento local (`ng serve --configuration local`).
 * Vem de `GET /api/v1/dev/token`, que só existe no backend em perfil dev. Será substituído
 * pela sessão real quando o login (EP-001) estiver integrado.
 */
@Injectable({ providedIn: 'root' })
export class DevTokenService {
  static readonly path = '/v1/dev/token';

  private readonly http = inject(HttpClient);
  private token$?: Observable<string>;

  token(): Observable<string> {
    this.token$ ??= this.http.get<{ accessToken: string }>(`${environment.apiBaseUrl}${DevTokenService.path}`).pipe(
      map(response => response.accessToken),
      shareReplay({ bufferSize: 1, refCount: false }),
    );

    return this.token$;
  }
}
