import { inject, Injectable } from '@angular/core';

import { isApiPatientId } from '../api-patient-hub-source';
import { EvolutionsApi, originToApi, type SalvarEvolucaoDiariaDto, toDailyEvolution } from './api-evolutions';
import { DailyEvolutionDay, DailyEvolutionSource } from './daily-evolution-source';
import { DailyEvolution, EvolutionSaveRequest } from './daily-record.models';
import { ProvisionalDailyEvolutionSource } from './provisional-daily-evolution-source';

/** Teto de páginas por leitura da lista: a janela da tela é de dias, nunca de centenas de páginas. */
const MAX_PAGES = 20;

/**
 * Evolução médica real: `GET`/`PUT /api/v1/pacientes/{id}/evolucoes/{data}` e `GET .../evolucoes` (lista paginada).
 * `204` = dia sem registro (`null`). Autor e hora vêm do servidor: o corpo leva só origem, texto, parâmetros e
 * reavaliações. O `PUT` é o retrato completo do dia, então a gravação lê o dia antes e preserva os parâmetros já
 * lançados (e as reavaliações, quando a tela não manda). Erros sobem. Ids de exemplo seguem no provisório.
 */
@Injectable()
export class ApiDailyEvolutionSource extends DailyEvolutionSource {
  private readonly api = inject(EvolutionsApi);
  private readonly provisional = inject(ProvisionalDailyEvolutionSource);

  async load(patientId: string, day: string): Promise<DailyEvolution | null> {
    if (!isApiPatientId(patientId)) {
      return this.provisional.load(patientId, day);
    }
    const dto = await this.api.getDay(patientId, day);

    return dto === null ? null : toDailyEvolution(dto);
  }

  async save(request: EvolutionSaveRequest): Promise<DailyEvolution> {
    if (!isApiPatientId(request.patientId)) {
      return this.provisional.save(request);
    }
    const current = await this.api.getDay(request.patientId, request.day);
    const body: SalvarEvolucaoDiariaDto = {
      origin: originToApi(request.origin),
      parameters: current?.parameters ?? [],
      reevaluations: request.reevaluations ?? current?.reevaluations ?? [],
      text: request.text,
    };
    // A tela só grava com texto: o dia gravado nunca volta `null`.
    const saved = await this.api.saveDay(request.patientId, request.day, body);

    return toDailyEvolution(saved) as DailyEvolution;
  }

  override async list(patientId: string, days: readonly string[]): Promise<readonly DailyEvolutionDay[]> {
    if (!isApiPatientId(patientId)) {
      return this.provisional.list(patientId, days);
    }
    if (days.length === 0) {
      return [];
    }
    const wanted = new Set(days);
    const oldest = days.reduce((a, b) => (a < b ? a : b));
    const limit = Math.min(days.length, 100);
    const found: DailyEvolutionDay[] = [];
    let before: string | null = null;

    for (let page = 0; page < MAX_PAGES; page++) {
      // Páginas em sequência: o cursor da próxima vem da anterior.
      // eslint-disable-next-line no-await-in-loop
      const result = await this.api.listPage(patientId, limit, before);

      for (const dto of result.items) {
        const evolution = wanted.has(dto.date) ? toDailyEvolution(dto) : null;

        if (evolution !== null) {
          found.push({ day: dto.date, evolution });
        }
      }
      before = result.nextBefore;
      // Última página, ou a próxima já fica além do dia mais antigo pedido.
      if (before === null || before <= oldest) {
        break;
      }
    }

    return found;
  }
}
