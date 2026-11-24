import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@environments/environment';
import { firstValueFrom } from 'rxjs';

import { WelcomeSource, WelcomeStatus } from './welcome-source';

/**
 * Boas-vindas via API real (openapi/onboarding-api.yaml): `GET /api/v1/onboarding/welcome`
 * (`getWelcomeStatus`) e `POST /api/v1/onboarding/welcome/complete` (`completeWelcome`, 204,
 * idempotente). Erros 401 (sessão inválida), 403 (não é profissional / sem hospital aprovado)
 * e de rede chegam como `HttpErrorResponse` rejeitado; splash e tela tratam seguindo ao Painel.
 */
@Injectable()
export class WelcomeApiService extends WelcomeSource {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/v1/onboarding/welcome`;

  getStatus(): Promise<WelcomeStatus> {
    return firstValueFrom(this.http.get<WelcomeStatus>(this.baseUrl));
  }

  async complete(): Promise<void> {
    await firstValueFrom(this.http.post<null>(`${this.baseUrl}/complete`, null));
  }
}
