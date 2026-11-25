import { Injectable } from '@angular/core';

import { provisionalCensusSeed } from '../patient-list/provisional-patient-list';
import { HypothesisSaveRequest, PatientHubProfile } from './patient-hub.models';
import {
  HypothesisSynthesizer,
  HypothesisWriter,
  PatientHubSource,
  PriorStaysSource,
  PriorStaysSynthesizer,
} from './patient-hub-source';

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
  loadProfile(patientId: string): Promise<PatientHubProfile | null> {
    // Independe do censo real (`PatientListSource`): usa só a semente de exemplo.
    const found = provisionalCensusSeed().find(p => p.id === patientId);

    return Promise.resolve(
      found === undefined
        ? null
        : {
            bed: found.bed,
            birthDate: found.birthDate,
            id: found.id,
            name: found.name,
            therapy: found.therapy,
            therapyStartDate: found.therapyStartDate,
            ward: found.ward,
          },
    );
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

/** Provisório: só o paciente `p1` tem internação anterior (no hospital de exemplo). */
const PRIOR_STAYS: Readonly<Record<string, string | undefined>> = {
  p1: 'Internação anterior (2025): NE por sonda com boa tolerância; intercorrência de broncoaspiração tratada, com ajuste de velocidade da dieta.',
};

@Injectable()
export class ProvisionalPriorStaysSource extends PriorStaysSource {
  hasPriorStays(patientId: string): Promise<boolean> {
    return Promise.resolve(patientId in PRIOR_STAYS);
  }
}

/** Provisório: devolve o texto de exemplo (a IA real é dependência externa). */
@Injectable()
export class ProvisionalPriorStaysSynthesizer extends PriorStaysSynthesizer {
  synthesize(patientId: string): Promise<string> {
    const text = PRIOR_STAYS[patientId];

    return text === undefined ? Promise.reject(new Error('sem internação anterior')) : Promise.resolve(text);
  }
}
