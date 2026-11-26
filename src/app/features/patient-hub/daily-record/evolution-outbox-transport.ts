import { inject, Injectable } from '@angular/core';

import { OutboxOperation } from '../../../shared/offline/offline-store';
import { OutboxTransport, SendOutcome } from '../../../shared/offline/outbox-transport';
import { EvolucaoDiariaDto, EvolutionsApi, ParametroDiarioDto, SalvarTextoDto } from './api-evolutions';
import { Reevaluation } from './daily-record.models';

/**
 * Envia as operações da fila de evolução pelas rotas ADITIVAS (`/texto`, `/parametros`, `/reavaliacoes`), nunca pelo
 * `PUT` do retrato do dia (que não é seguro de reenviar). `opId` vai como `Idempotency-Key` e `occurredAt` é a hora em
 * que o profissional registrou. Conflito de texto (`conflict: true` na resposta) volta em `SendOutcome.conflict`.
 */
@Injectable({ providedIn: 'root' })
export class EvolutionOutboxTransport extends OutboxTransport {
  private readonly api = inject(EvolutionsApi);

  async send(operation: OutboxOperation): Promise<SendOutcome> {
    const { day, occurredAt, opId, patientId, payload } = operation;

    if (operation.type === 'parameters') {
      await this.api.addParameters(
        patientId,
        day,
        { occurredAt, parameters: payload['parameters'] as readonly ParametroDiarioDto[] },
        opId,
      );

      return {};
    }
    if (operation.type === 'reevaluations') {
      await this.api.addReevaluations(
        patientId,
        day,
        { occurredAt, reevaluations: payload['reevaluations'] as readonly Reevaluation[] },
        opId,
      );

      return {};
    }
    const body: SalvarTextoDto = {
      occurredAt,
      origin: payload['origin'] as SalvarTextoDto['origin'],
      text: payload['text'] as string,
      ...(operation.baseVersion === undefined ? {} : { baseVersion: operation.baseVersion }),
    };
    const saved: EvolucaoDiariaDto = await this.api.addText(patientId, day, body, opId);
    const version = saved.version ?? 0;

    return saved.conflict === true
      ? {
          conflict: {
            currentVersion: version,
            others: (saved.conflictingVersions ?? []).map(v => ({ at: v.at, author: v.author, text: v.text })),
          },
          version,
        }
      : { version };
  }
}
