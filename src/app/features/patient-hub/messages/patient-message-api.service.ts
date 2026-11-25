import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@environments/environment';
import { firstValueFrom } from 'rxjs';

import { asPatientApiId } from './patient-api-id';
import {
  groupOfSpecialty,
  LinkedProfessional,
  PatientRecord,
  PatientRecordRequest,
  RecipientSpec,
} from './patient-message.models';
import { PatientMessageSource, PatientTeamSource } from './patient-message-source';

interface ProfessionalRefDto {
  readonly id: number;
  readonly name: string;
  readonly specialty: string;
}

/** `RegistroPaciente` de openapi/mensagens-api.yaml. */
interface RegistroPacienteDto {
  readonly id: number;
  readonly kind: 'OBSERVACAO' | 'MENSAGEM';
  readonly author: ProfessionalRefDto;
  readonly content: string;
  readonly createdAt: string;
  readonly resolvedRecipients?: readonly ProfessionalRefDto[];
}

/**
 * Registro do Hub via API real: `POST /api/v1/pacientes/{pacienteId}/mensagens` (`criarRegistroPaciente`).
 * Sem `destinatarios` o backend cria uma observação (não notifica); com eles, uma mensagem direcionada.
 * Divergência do contrato: não existe leitura de observações (o GET lista só threads), então `list` devolve
 * apenas o que foi registrado nesta sessão, do mais recente ao mais antigo. `viaAudio` não existe no
 * contrato (o áudio chega já transcrito) e não é enviado.
 */
@Injectable()
export class PatientMessageApiService extends PatientMessageSource {
  private readonly http = inject(HttpClient);
  private readonly session = new Map<string, readonly PatientRecord[]>();

  list(patientId: string): Promise<readonly PatientRecord[]> {
    return Promise.resolve(this.session.get(patientId) ?? []);
  }

  async send(request: PatientRecordRequest): Promise<PatientRecord> {
    const id = asPatientApiId(request.patientId);
    const specs: readonly RecipientSpec[] =
      request.recipientSpecs ?? request.recipients.map(r => ({ professionalId: r.id, type: 'PESSOA' }));
    const body = await firstValueFrom(
      this.http.post<RegistroPacienteDto>(`${environment.apiBaseUrl}/v1/pacientes/${id}/mensagens`, {
        content: request.content,
        destinatarios: specs,
      }),
    );
    const record: PatientRecord = {
      at: body.createdAt,
      author: body.author.name,
      content: body.content,
      id: String(body.id),
      patientId: request.patientId,
      recipients: (body.resolvedRecipients ?? []).map(r => ({ id: r.id, name: r.name, specialty: r.specialty })),
      viaAudio: request.viaAudio,
    };

    this.session.set(request.patientId, [record, ...(this.session.get(request.patientId) ?? [])]);

    return record;
  }
}

/**
 * Equipe vinculada e aprovada ao paciente. O contrato não tem listagem: usa
 * `POST .../mensagens/destinatarios/resolver` (`resolverDestinatariosMensagem`) com `TODOS`, que já devolve só
 * os profissionais vinculados e aprovados àquele paciente (o remetente fica de fora, como em todo envio).
 * 422 (ninguém além do remetente) é equipe vazia, não erro.
 */
@Injectable()
export class PatientTeamApiService extends PatientTeamSource {
  private readonly http = inject(HttpClient);

  async listLinked(patientId: string): Promise<readonly LinkedProfessional[]> {
    try {
      const body = await firstValueFrom(
        this.http.post<{ readonly professionals: readonly ProfessionalRefDto[] }>(
          `${environment.apiBaseUrl}/v1/pacientes/${asPatientApiId(patientId)}/mensagens/destinatarios/resolver`,
          { recipients: [{ type: 'TODOS' }] },
        ),
      );

      return body.professionals.map(p => ({
        group: groupOfSpecialty(p.specialty),
        id: p.id,
        name: p.name,
        specialty: p.specialty,
      }));
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 422) {
        return [];
      }
      throw error;
    }
  }
}
