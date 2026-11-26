import { inject, Injectable } from '@angular/core';

import { isApiPatientId } from '../api-patient-hub-source';
import { EvolutionsApi, toParameterEntries } from './api-evolutions';
import { ParameterEntry } from './daily-record.models';
import { DailyRecordSource } from './daily-record-source';
import { ProvisionalDailyRecordSource } from './provisional-daily-record-source';

const PAGE_SIZE = 100;
/** Teto de páginas: 100 páginas de 100 dias já passam de dois anos de internação. */
const MAX_PAGES = 100;

/**
 * Lançamentos do Registro diário reais: percorre `GET /api/v1/pacientes/{id}/evolucoes` (lista paginada por data) e
 * junta os parâmetros de cada dia, do mais antigo ao mais recente. O contrato não guarda hora por lançamento: todos os
 * de um dia saem com autor e hora da versão vigente. Erros sobem. Ids de exemplo seguem no provisório.
 */
@Injectable()
export class ApiDailyRecordSource extends DailyRecordSource {
  private readonly api = inject(EvolutionsApi);
  private readonly provisional = inject(ProvisionalDailyRecordSource);

  async loadEntries(patientId: string): Promise<readonly ParameterEntry[]> {
    if (!isApiPatientId(patientId)) {
      return this.provisional.loadEntries(patientId);
    }
    const days: (readonly ParameterEntry[])[] = [];
    let before: string | null = null;

    for (let page = 0; page < MAX_PAGES; page++) {
      // Páginas em sequência: o cursor da próxima vem da anterior.
      // eslint-disable-next-line no-await-in-loop
      const result = await this.api.listPage(patientId, PAGE_SIZE, before);

      days.push(...result.items.map(toParameterEntries));
      before = result.nextBefore;
      if (before === null) {
        break;
      }
    }

    // As páginas vêm do dia mais recente ao mais antigo; a tela espera a ordem cronológica.
    return days.toReversed().flat();
  }
}
