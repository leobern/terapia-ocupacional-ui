import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@environments/environment';
import { firstValueFrom } from 'rxjs';

import { ObservationFollowUpPort, RecordSuggestions } from './observation-follow-up.port';
import { asPatientApiId } from './patient-api-id';
import { RecipientSpec } from './patient-message.models';

/**
 * Sugestões, pendência e comunicação a partir de uma observação via API real (openapi/mensagens-api.yaml):
 * `GET .../mensagens/{registroId}/sugestoes` (`obterSugestoesRegistroPaciente`),
 * `POST .../{registroId}/pendencia` (`criarPendenciaReavaliacao`),
 * `POST .../{registroId}/comunicacao` (`enviarComunicacaoRegistro`) e
 * `PUT .../{mensagemId}/destinatarios` (`alterarDestinatariosPendencia`).
 * Erros HTTP (403, 404, 409, 422) chegam como `HttpErrorResponse` rejeitado.
 */
@Injectable()
export class ObservationFollowUpApiService extends ObservationFollowUpPort {
  private readonly http = inject(HttpClient);

  suggestions(patientId: string, recordId: string): Promise<RecordSuggestions> {
    return firstValueFrom(this.http.get<RecordSuggestions>(`${this.url(patientId)}/${recordId}/sugestoes`));
  }

  async createPending(
    patientId: string,
    recordId: string,
    dueAt: string,
    recipients: readonly RecipientSpec[] | null,
  ): Promise<void> {
    await firstValueFrom(
      this.http.post(`${this.url(patientId)}/${recordId}/pendencia`, {
        dueAt,
        ...(recipients === null ? {} : { destinatarios: recipients }),
      }),
    );
  }

  async sendCommunication(
    patientId: string,
    recordId: string,
    content: string,
    recipients: readonly RecipientSpec[],
  ): Promise<void> {
    await firstValueFrom(
      this.http.post(`${this.url(patientId)}/${recordId}/comunicacao`, { content, destinatarios: recipients }),
    );
  }

  async changePendingRecipients(
    patientId: string,
    threadId: string,
    recipients: readonly RecipientSpec[],
  ): Promise<void> {
    await firstValueFrom(
      this.http.put(`${this.url(patientId)}/${threadId}/destinatarios`, { destinatarios: recipients }),
    );
  }

  private url(patientId: string): string {
    return `${environment.apiBaseUrl}/v1/pacientes/${asPatientApiId(patientId)}/mensagens`;
  }
}
