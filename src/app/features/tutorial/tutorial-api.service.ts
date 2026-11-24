import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@environments/environment';
import { firstValueFrom } from 'rxjs';

import { TutorialResult, TutorialStateStore, TutorialStatus } from './tutorial-state';

/** Schema `TutorialStatus` do contrato (`openapi/tutorial-api.yaml`). */
interface TutorialStatusResponse {
  readonly status: TutorialStatus;
  readonly registradoEm?: string | null;
}

/**
 * Estado do tutorial via API real: `GET` e `PUT /api/v1/tutorial` (`openapi/tutorial-api.yaml`).
 * Erros (401, 400, 422, rede) chegam como `HttpErrorResponse` rejeitado; quem chama decide
 * seguir sem bloquear o médico (splash e tutorial já fazem isso). Rever pelas configurações
 * é só navegação e nunca chama `register`.
 */
@Injectable()
export class TutorialApiService extends TutorialStateStore {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBaseUrl}/v1/tutorial`;

  async read(): Promise<TutorialStatus> {
    const { status } = await firstValueFrom(this.http.get<TutorialStatusResponse>(this.url));

    return status;
  }

  async register(result: TutorialResult): Promise<void> {
    await firstValueFrom(this.http.put<TutorialStatusResponse>(this.url, { resultado: result }));
  }
}
