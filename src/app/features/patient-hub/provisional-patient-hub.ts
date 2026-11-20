import { inject, Injectable } from '@angular/core';

import { PatientListSource } from '../patient-list/patient-list-source';
import { HypothesisSaveRequest, PatientHubProfile } from './patient-hub.models';
import { HypothesisSynthesizer, HypothesisWriter, PatientHubSource } from './patient-hub-source';

const key = (patientId: string): string => `conductia:hypothesis:${patientId}`;

const SEED: Readonly<Record<string, string>> = {
  p1: 'Insuficiência respiratória aguda por impacto mecânico da prótese traqueal pequena, PC.',
};

/**
 * Provisório: perfil vem do censo de exemplo e a Hipótese fica no `localStorage`, que também faz o papel
 * do cache local (leitura offline) até a implementação real existir.
 */
@Injectable()
export class ProvisionalPatientHubSource extends PatientHubSource {
  private readonly census = inject(PatientListSource);

  async loadProfile(patientId: string): Promise<PatientHubProfile | null> {
    const census = await this.census.loadCensus('', new Date());
    const found = census.find(p => p.id === patientId);

    return found === undefined
      ? null
      : {
          bed: found.bed,
          birthDate: found.birthDate,
          id: found.id,
          name: found.name,
          therapy: found.therapy,
          therapyStartDate: found.therapyStartDate,
          ward: found.ward,
        };
  }

  loadHypothesis(patientId: string): Promise<string | null> {
    return Promise.resolve(localStorage.getItem(key(patientId)) ?? SEED[patientId] ?? null);
  }
}

/** Provisório: grava no cache local. */
@Injectable()
export class ProvisionalHypothesisWriter extends HypothesisWriter {
  save(request: HypothesisSaveRequest): Promise<void> {
    localStorage.setItem(key(request.patientId), request.text);

    return Promise.resolve();
  }
}

/** Provisório: devolve um resumo curto do texto colado (a IA real é dependência externa). */
@Injectable()
export class ProvisionalHypothesisSynthesizer extends HypothesisSynthesizer {
  synthesize(pastedText: string): Promise<string> {
    const text = pastedText.trim().replace(/\s+/g, ' ');

    return Promise.resolve(text.length > 240 ? `${text.slice(0, 237)}...` : text);
  }
}
