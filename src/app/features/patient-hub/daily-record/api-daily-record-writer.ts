import { inject, Injectable } from '@angular/core';

import { isApiPatientId } from '../api-patient-hub-source';
import { EvolutionsApi, originToApi, toParameterEntries, toParametroDto } from './api-evolutions';
import { dayKey, NewParameterEntry, ParameterEntry } from './daily-record.models';
import { DailyRecordWriter } from './daily-record-writer';
import { ProvisionalDailyRecordSource } from './provisional-daily-record-source';

/**
 * Grava os parâmetros do Registro diário com `PUT /api/v1/pacientes/{id}/evolucoes/{data}`. O contrato guarda o
 * retrato completo do dia, então lê o dia, acrescenta os lançamentos novos (cada um é um ponto novo, nada é
 * sobrescrito) e preserva o texto, a origem e as reavaliações já gravados. O dia é o da data do lançamento. Autor e
 * hora que voltam são os do servidor. Erros sobem (nada é gravado). Ids de exemplo seguem no provisório.
 */
@Injectable()
export class ApiDailyRecordWriter extends DailyRecordWriter {
  private readonly api = inject(EvolutionsApi);
  private readonly provisional = inject(ProvisionalDailyRecordSource);

  async record(patientId: string, entries: readonly NewParameterEntry[]): Promise<readonly ParameterEntry[]> {
    if (!isApiPatientId(patientId)) {
      return this.provisional.record(patientId, entries);
    }
    if (entries.length === 0) {
      return [];
    }
    const day = dayKey(new Date(entries[0].at));
    const current = await this.api.getDay(patientId, day);
    const saved = await this.api.saveDay(patientId, day, {
      origin: current?.origin ?? originToApi('manual'),
      parameters: [...(current?.parameters ?? []), ...entries.map(toParametroDto)],
      reevaluations: current?.reevaluations ?? [],
      text: current?.text ?? '',
    });

    return toParameterEntries(saved).slice(-entries.length);
  }
}
