import { Injectable } from '@angular/core';

import { DailyIntake } from './adequacy.models';

/**
 * Porta de leitura dos volumes infundidos do dia (NE/NP) da Prescrição (FT-004-8), já convertidos em
 * kcal e proteína. Somente leitura; `null` quando não há infusão. A implementação real substitui a provisória.
 */
export abstract class InfusedIntakeSource {
  abstract today(patientId: string): Promise<DailyIntake | null>;
}

/** Porta de leitura da estimativa de recordatório alimentar do dia (Avaliação, FT-004-4); `null` se ausente. */
export abstract class FoodRecallSource {
  abstract today(patientId: string): Promise<DailyIntake | null>;
}

/** Provisório: só o paciente `p1` tem infusão de exemplo (valores do protótipo 4717-9855). */
@Injectable()
export class ProvisionalInfusedIntakeSource extends InfusedIntakeSource {
  today(patientId: string): Promise<DailyIntake | null> {
    return Promise.resolve(patientId === 'p1' ? { kcal: 1425, proteinG: 82.5 } : null);
  }
}

/** Provisório: ainda não há recordatório coletado. */
@Injectable()
export class ProvisionalFoodRecallSource extends FoodRecallSource {
  today(): Promise<DailyIntake | null> {
    return Promise.resolve(null);
  }
}
