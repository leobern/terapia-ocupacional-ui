import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@environments/environment';
import { firstValueFrom } from 'rxjs';

import { DailyEvolution, EvolutionOrigin, ParameterEntry, Reevaluation } from './daily-record.models';

/** `ParametroDiario` de openapi/evolucoes-api.yaml; rótulo e unidade só nos parâmetros fora do catálogo. */
export interface ParametroDiarioDto {
  readonly parameterId: string;
  readonly value: number;
  readonly parameterLabel?: string | null;
  readonly unit?: string | null;
}

/** `EvolucaoDiaria`: o retrato vigente de um dia, com autor e data/hora do servidor. */
export interface EvolucaoDiariaDto {
  readonly date: string;
  readonly text: string;
  readonly origin: 'AI' | 'AI_EDITED' | 'MANUAL';
  readonly parameters: readonly ParametroDiarioDto[];
  readonly reevaluations: readonly Reevaluation[];
  readonly author: string;
  readonly at: string;
  /** Id da versão de texto vigente (0 = dia só com entradas): base da próxima gravação de texto (ADR-003). */
  readonly version?: number;
  /** `true` quando a versão vigente foi gravada sobre uma base defasada. */
  readonly conflict?: boolean;
  readonly conflictingVersions?: readonly VersaoTextoDto[];
}

/** `VersaoTextoEvolucao`: versão de texto que a gravação defasada não tinha visto. */
export interface VersaoTextoDto {
  readonly version: number;
  readonly text: string;
  readonly author: string;
  readonly at: string;
}

/** `SalvarTextoEvolucaoRequest`. */
export interface SalvarTextoDto {
  readonly text: string;
  readonly origin: EvolucaoDiariaDto['origin'];
  readonly baseVersion?: number;
  readonly occurredAt?: string;
}

/** `EvolucaoDiariaPage`: `nextBefore` nulo na última página. */
export interface EvolucaoDiariaPageDto {
  readonly items: readonly EvolucaoDiariaDto[];
  readonly nextBefore: string | null;
}

/** `SalvarEvolucaoDiariaRequest`: retrato completo do dia, nunca diferencial. Autor e hora não vão no corpo. */
export interface SalvarEvolucaoDiariaDto {
  readonly origin: EvolucaoDiariaDto['origin'];
  readonly text: string;
  readonly parameters: readonly ParametroDiarioDto[];
  readonly reevaluations: readonly Reevaluation[];
}

const ORIGIN_TO_API: Readonly<Record<EvolutionOrigin, EvolucaoDiariaDto['origin']>> = {
  ai: 'AI',
  'ai-edited': 'AI_EDITED',
  manual: 'MANUAL',
};

const ORIGIN_FROM_API: Readonly<Record<EvolucaoDiariaDto['origin'], EvolutionOrigin>> = {
  AI: 'ai',
  AI_EDITED: 'ai-edited',
  MANUAL: 'manual',
};

export function originFromApi(origin: EvolucaoDiariaDto['origin']): EvolutionOrigin {
  return ORIGIN_FROM_API[origin];
}

export function originToApi(origin: EvolutionOrigin): EvolucaoDiariaDto['origin'] {
  return ORIGIN_TO_API[origin];
}

/**
 * Evolução médica do dia a partir do retrato do servidor. Dia só com parâmetros (sem texto e sem reavaliação) não é
 * evolução: volta `null`, o mesmo estado vazio de "dia sem registro".
 */
export function toDailyEvolution(dto: EvolucaoDiariaDto): DailyEvolution | null {
  if (dto.text.trim() === '' && dto.reevaluations.length === 0) {
    return null;
  }

  return {
    at: dto.at,
    author: dto.author,
    origin: ORIGIN_FROM_API[dto.origin],
    reevaluations: dto.reevaluations,
    text: dto.text,
    ...(dto.version === undefined ? {} : { version: dto.version }),
  };
}

/** Parâmetro do corpo a partir do lançamento da tela: rótulo e unidade só quando existem. */
export function toParametroDto(entry: {
  readonly parameterId: string;
  readonly value: number;
  readonly parameterLabel?: string;
  readonly unit?: string;
}): ParametroDiarioDto {
  return {
    parameterId: entry.parameterId,
    value: entry.value,
    ...(entry.parameterLabel === undefined ? {} : { parameterLabel: entry.parameterLabel }),
    ...(entry.unit === undefined ? {} : { unit: entry.unit }),
  };
}

/**
 * Lançamentos de um dia no modelo da tela. O contrato guarda os parâmetros dentro da versão do dia, sem id nem hora
 * própria: o id é `aaaa-mm-dd#posição` e autor e hora são os da versão (servidor).
 */
export function toParameterEntries(dto: EvolucaoDiariaDto): readonly ParameterEntry[] {
  return dto.parameters.map((p, index) => ({
    at: dto.at,
    author: dto.author,
    id: `${dto.date}#${index}`,
    parameterId: p.parameterId,
    value: p.value,
    ...(p.parameterLabel == null ? {} : { parameterLabel: p.parameterLabel }),
    ...(p.unit == null ? {} : { unit: p.unit }),
  }));
}

/**
 * Chamadas HTTP de `/api/v1/pacientes/{id}/evolucoes` (`listEvolucoesPaciente`, `getEvolucaoPacienteDia`,
 * `saveEvolucaoPacienteDia`), compartilhadas pelas três portas do Registro diário. Erros sobem.
 */
@Injectable({ providedIn: 'root' })
export class EvolutionsApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBaseUrl}/v1/pacientes`;

  /** Retrato vigente do dia; 204 = dia sem registro (`null`). */
  async getDay(patientId: string, day: string): Promise<EvolucaoDiariaDto | null> {
    const response = await firstValueFrom(
      this.http.get<EvolucaoDiariaDto | null>(`${this.url}/${patientId}/evolucoes/${day}`, { observe: 'response' }),
    );

    return response.status === 204 ? null : response.body;
  }

  /** Grava uma versão nova do dia (retrato completo) e devolve o que o servidor guardou. */
  saveDay(patientId: string, day: string, body: SalvarEvolucaoDiariaDto): Promise<EvolucaoDiariaDto> {
    return firstValueFrom(this.http.put<EvolucaoDiariaDto>(`${this.url}/${patientId}/evolucoes/${day}`, body));
  }

  /** `POST .../texto` (aditivo, reenviável): nova versão só do texto, com `baseVersion` e a chave de idempotência. */
  addText(patientId: string, day: string, body: SalvarTextoDto, idempotencyKey: string): Promise<EvolucaoDiariaDto> {
    return firstValueFrom(
      this.http.post<EvolucaoDiariaDto>(`${this.url}/${patientId}/evolucoes/${day}/texto`, body, {
        headers: { 'Idempotency-Key': idempotencyKey },
      }),
    );
  }

  /** `POST .../parametros` (aditivo, reenviável). */
  addParameters(
    patientId: string,
    day: string,
    body: { readonly parameters: readonly ParametroDiarioDto[]; readonly occurredAt?: string },
    idempotencyKey: string,
  ): Promise<unknown> {
    return firstValueFrom(
      this.http.post(`${this.url}/${patientId}/evolucoes/${day}/parametros`, body, {
        headers: { 'Idempotency-Key': idempotencyKey },
      }),
    );
  }

  /** `POST .../reavaliacoes` (aditivo, reenviável). */
  addReevaluations(
    patientId: string,
    day: string,
    body: { readonly reevaluations: readonly Reevaluation[]; readonly occurredAt?: string },
    idempotencyKey: string,
  ): Promise<unknown> {
    return firstValueFrom(
      this.http.post(`${this.url}/${patientId}/evolucoes/${day}/reavaliacoes`, body, {
        headers: { 'Idempotency-Key': idempotencyKey },
      }),
    );
  }

  /** Uma página, do dia mais recente ao mais antigo; `before` pede só dias estritamente anteriores. */
  listPage(patientId: string, limit: number, before: string | null): Promise<EvolucaoDiariaPageDto> {
    let params = new HttpParams().set('limit', limit);

    if (before !== null) {
      params = params.set('before', before);
    }

    return firstValueFrom(this.http.get<EvolucaoDiariaPageDto>(`${this.url}/${patientId}/evolucoes`, { params }));
  }
}
