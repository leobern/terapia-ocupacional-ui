import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@environments/environment';
import { firstValueFrom } from 'rxjs';

import { isApiPatientId } from '../api-patient-hub-source';
import {
  ConductFlag,
  ConductFlagRequest,
  CurrentRoute,
  NutritionRoute,
  RouteSaveRequest,
  SwallowingDecision,
  SwallowingSaveRequest,
} from './plan.models';
import { PlanSource, ResponsibleSaveRequest } from './plan-source';
import {
  CalculatedWeights,
  NutritionTargets,
  ReferenceWeight,
  ReferenceWeightKind,
  ReferenceWeightSaveRequest,
  TargetFormula,
  TargetsSaveRequest,
} from './plan-targets';
import { ProvisionalPlanSource } from './provisional-plan-source';
import { CadenceSaveRequest, normalizeCadence, ReviewCadence, Weekday } from './review-cadence';

type KindDto = 'ADJUSTED' | 'CURRENT' | 'DRY' | 'IDEAL';
type FormulaDto = 'INDIRECT_CALORIMETRY' | 'SIMPLIFIED';
type SwallowingDto = 'NEEDED' | 'NOT_NEEDED';

/** `PesoReferencia` de openapi/plano-nutricional-api.yaml. */
interface ReferenceWeightDto {
  readonly kg: number;
  readonly kind: KindDto;
}

/** `Metas` do contrato; `calorimetry` só existe na fórmula INDIRECT_CALORIMETRY. */
interface TargetsDto {
  readonly calorimetry?: { readonly kcal: number; readonly percent: number } | null;
  readonly formula: FormulaDto;
  readonly kcalPerDay: number;
  readonly kcalPerKg: number;
  readonly proteinPerDay: number;
  readonly proteinPerKg: number;
  readonly referenceWeight: ReferenceWeightDto;
}

/** `PlanoNutricional` do contrato: todo campo do plano pode vir nulo (ainda não definido). */
interface PlanDto {
  readonly at: string;
  readonly author: string;
  readonly cadence?: readonly number[] | null;
  readonly referenceWeight?: ReferenceWeightDto | null;
  readonly responsible?: string | null;
  readonly routes?: readonly NutritionRoute[] | null;
  readonly routesSince?: string | null;
  readonly swallowing?: SwallowingDto | null;
  readonly targets?: TargetsDto | null;
}

/** `SinalizacaoConduta` do contrato (`id` numérico). */
interface FlagDto {
  readonly at: string;
  readonly author: string;
  readonly id: number;
  readonly text: string;
}

/** Corpo do `PUT`: só o campo gravado; o que ficar ausente mantém o valor vigente no servidor. */
type PlanPatch = Partial<{
  readonly cadence: readonly number[];
  readonly referenceWeight: ReferenceWeightDto;
  readonly responsible: string;
  readonly routes: readonly NutritionRoute[];
  readonly swallowing: SwallowingDto;
  readonly targets: TargetsDto;
}>;

const KIND_TO_DTO: Readonly<Record<ReferenceWeightKind, KindDto>> = {
  adjusted: 'ADJUSTED',
  current: 'CURRENT',
  dry: 'DRY',
  ideal: 'IDEAL',
};
const KIND_FROM_DTO: Readonly<Record<KindDto, ReferenceWeightKind>> = {
  ADJUSTED: 'adjusted',
  CURRENT: 'current',
  DRY: 'dry',
  IDEAL: 'ideal',
};
const FORMULA_TO_DTO: Readonly<Record<TargetFormula, FormulaDto>> = {
  'indirect-calorimetry': 'INDIRECT_CALORIMETRY',
  simplified: 'SIMPLIFIED',
};
const FORMULA_FROM_DTO: Readonly<Record<FormulaDto, TargetFormula>> = {
  INDIRECT_CALORIMETRY: 'indirect-calorimetry',
  SIMPLIFIED: 'simplified',
};

export function toReferenceWeight(dto: ReferenceWeightDto): ReferenceWeight {
  return { kg: dto.kg, kind: KIND_FROM_DTO[dto.kind] };
}

function toReferenceWeightDto(weight: ReferenceWeight): ReferenceWeightDto {
  return { kg: weight.kg, kind: KIND_TO_DTO[weight.kind] };
}

export function toTargets(dto: TargetsDto): NutritionTargets {
  return {
    calorimetry: dto.calorimetry ?? null,
    formula: FORMULA_FROM_DTO[dto.formula],
    kcalPerDay: dto.kcalPerDay,
    kcalPerKg: dto.kcalPerKg,
    proteinPerDay: dto.proteinPerDay,
    proteinPerKg: dto.proteinPerKg,
    referenceWeight: toReferenceWeight(dto.referenceWeight),
  };
}

/** A calorimetria só vai no corpo na fórmula INDIRECT_CALORIMETRY (proibida na SIMPLIFIED). */
export function toTargetsDto(targets: NutritionTargets): TargetsDto {
  return {
    ...(targets.formula === 'indirect-calorimetry' && targets.calorimetry ? { calorimetry: targets.calorimetry } : {}),
    formula: FORMULA_TO_DTO[targets.formula],
    kcalPerDay: targets.kcalPerDay,
    kcalPerKg: targets.kcalPerKg,
    proteinPerDay: targets.proteinPerDay,
    proteinPerKg: targets.proteinPerKg,
    referenceWeight: toReferenceWeightDto(targets.referenceWeight),
  };
}

function toFlag(dto: FlagDto): ConductFlag {
  return { at: dto.at, author: dto.author, id: String(dto.id), text: dto.text };
}

function toSwallowing(value: SwallowingDto | null | undefined): SwallowingDecision | null {
  if (value === undefined || value === null) {
    return null;
  }

  return value === 'NEEDED' ? 'needed' : 'not-needed';
}

/**
 * Plano nutricional real: `GET`/`PUT /api/v1/pacientes/{id}/plano-nutricional` (`getPlanoNutricional`,
 * `savePlanoNutricional`) e `GET`/`POST .../plano-nutricional/sinalizacoes` (`listSinalizacoesConduta`,
 * `addSinalizacaoConduta`). Cada gravação manda só o campo alterado; a resposta é o plano completo, de onde sai o
 * valor devolvido. Autor e data/hora são do servidor (`at`/`author` do pedido são ignorados). `204` = paciente sem
 * plano (tudo vazio). Erros sobem (400/404/rede). Fora do contrato e mantidos no provisório: pesos calculados
 * (vêm da Avaliação) e a lista de médicos responsáveis. Ids de exemplo seguem inteiros no provisório.
 */
@Injectable()
export class ApiPlanSource extends PlanSource {
  private readonly http = inject(HttpClient);
  private readonly provisional = inject(ProvisionalPlanSource);
  private readonly url = `${environment.apiBaseUrl}/v1/pacientes`;

  async loadRoute(patientId: string): Promise<CurrentRoute | null> {
    if (!isApiPatientId(patientId)) {
      return this.provisional.loadRoute(patientId);
    }
    const plan = await this.read(patientId);

    return plan?.routes ? { routes: plan.routes, since: plan.routesSince ?? plan.at } : null;
  }

  async saveRoute(request: RouteSaveRequest): Promise<CurrentRoute> {
    if (!isApiPatientId(request.patientId)) {
      return this.provisional.saveRoute(request);
    }
    const plan = await this.write(request.patientId, { routes: request.routes });

    return { routes: plan.routes ?? request.routes, since: plan.routesSince ?? plan.at };
  }

  async loadSwallowing(patientId: string): Promise<SwallowingDecision | null> {
    if (!isApiPatientId(patientId)) {
      return this.provisional.loadSwallowing(patientId);
    }

    return toSwallowing((await this.read(patientId))?.swallowing);
  }

  async saveSwallowing(request: SwallowingSaveRequest): Promise<SwallowingDecision> {
    if (!isApiPatientId(request.patientId)) {
      return this.provisional.saveSwallowing(request);
    }
    const plan = await this.write(request.patientId, {
      swallowing: request.decision === 'needed' ? 'NEEDED' : 'NOT_NEEDED',
    });

    return toSwallowing(plan.swallowing) ?? request.decision;
  }

  async loadConductFlags(patientId: string): Promise<readonly ConductFlag[]> {
    if (!isApiPatientId(patientId)) {
      return this.provisional.loadConductFlags(patientId);
    }
    const flags = await firstValueFrom(
      this.http.get<readonly FlagDto[]>(`${this.url}/${patientId}/plano-nutricional/sinalizacoes`),
    );

    return flags.map(toFlag);
  }

  async addConductFlag(request: ConductFlagRequest): Promise<ConductFlag> {
    if (!isApiPatientId(request.patientId)) {
      return this.provisional.addConductFlag(request);
    }

    return toFlag(
      await firstValueFrom(
        this.http.post<FlagDto>(`${this.url}/${request.patientId}/plano-nutricional/sinalizacoes`, {
          text: request.text,
        }),
      ),
    );
  }

  /** Fora do contrato: os pesos calculados vêm da Avaliação nutricional; seguem no provisório. */
  loadCalculatedWeights(patientId: string): Promise<CalculatedWeights> {
    return this.provisional.loadCalculatedWeights(patientId);
  }

  async loadReferenceWeight(patientId: string): Promise<ReferenceWeight | null> {
    if (!isApiPatientId(patientId)) {
      return this.provisional.loadReferenceWeight(patientId);
    }
    const weight = (await this.read(patientId))?.referenceWeight;

    return weight ? toReferenceWeight(weight) : null;
  }

  async saveReferenceWeight(request: ReferenceWeightSaveRequest): Promise<ReferenceWeight> {
    if (!isApiPatientId(request.patientId)) {
      return this.provisional.saveReferenceWeight(request);
    }
    const plan = await this.write(request.patientId, { referenceWeight: toReferenceWeightDto(request.weight) });

    return plan.referenceWeight ? toReferenceWeight(plan.referenceWeight) : request.weight;
  }

  async loadTargets(patientId: string): Promise<NutritionTargets | null> {
    if (!isApiPatientId(patientId)) {
      return this.provisional.loadTargets(patientId);
    }
    const targets = (await this.read(patientId))?.targets;

    return targets ? toTargets(targets) : null;
  }

  async saveTargets(request: TargetsSaveRequest): Promise<NutritionTargets> {
    if (!isApiPatientId(request.patientId)) {
      return this.provisional.saveTargets(request);
    }
    const plan = await this.write(request.patientId, { targets: toTargetsDto(request.targets) });

    return plan.targets ? toTargets(plan.targets) : request.targets;
  }

  async loadCadence(patientId: string): Promise<ReviewCadence | null> {
    if (!isApiPatientId(patientId)) {
      return this.provisional.loadCadence(patientId);
    }
    const days = (await this.read(patientId))?.cadence;

    return days ? normalizeCadence(days as readonly Weekday[]) : null;
  }

  async saveCadence(request: CadenceSaveRequest): Promise<ReviewCadence> {
    if (!isApiPatientId(request.patientId)) {
      return this.provisional.saveCadence(request);
    }
    const plan = await this.write(request.patientId, { cadence: normalizeCadence(request.days) });

    return normalizeCadence((plan.cadence ?? request.days) as readonly Weekday[]);
  }

  async loadResponsible(patientId: string): Promise<string | null> {
    if (!isApiPatientId(patientId)) {
      return this.provisional.loadResponsible(patientId);
    }

    return (await this.read(patientId))?.responsible ?? null;
  }

  async saveResponsible(request: ResponsibleSaveRequest): Promise<string> {
    if (!isApiPatientId(request.patientId)) {
      return this.provisional.saveResponsible(request);
    }

    return (await this.write(request.patientId, { responsible: request.name })).responsible ?? request.name;
  }

  /** Fora do contrato: não há endpoint de médicos por hospital para o plano; segue no provisório. */
  loadResponsibleOptions(): Promise<readonly string[]> {
    return this.provisional.loadResponsibleOptions();
  }

  /** `204` (sem plano) chega como `null` no corpo. */
  private read(patientId: string): Promise<PlanDto | null> {
    return firstValueFrom(this.http.get<PlanDto | null>(`${this.url}/${patientId}/plano-nutricional`));
  }

  private write(patientId: string, patch: PlanPatch): Promise<PlanDto> {
    return firstValueFrom(this.http.put<PlanDto>(`${this.url}/${patientId}/plano-nutricional`, patch));
  }
}
