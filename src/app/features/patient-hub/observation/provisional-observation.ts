import { Injectable } from '@angular/core';

import {
  DirectedMessage,
  DirectedMessageRequest,
  Observation,
  ObservationRequest,
  ObservationSuggestions,
  ProfileGroup,
  RecipientsChangeRequest,
  Reevaluation,
  ReevaluationRequest,
  ResolveRequest,
  TeamMember,
  toIsoDate,
} from './observation.models';
import {
  DirectedMessageSource,
  DirectedMessageWriter,
  ObservationSuggester,
  ObservationWriter,
  PatientTeamSource,
  ReevaluationSource,
  ReevaluationWriter,
} from './observation-source';

const FOLLOW_UP = /diarre|v[oô]mit|náusea|nausea|intoler|febre|distens/i;
const COMMUNICATE = /eros[aã]o|les[aã]o|mucosa|úlcera|ulcera|sonda|sne/i;

const addDays = (iso: string, days: number): string => {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d + days);

  return toIsoDate(date);
};

/** Provisório: sugestões por palavras-chave, até a camada de IA (FT-003-4) existir. */
@Injectable()
export class ProvisionalObservationSuggester extends ObservationSuggester {
  suggest(text: string, ...[, today]: [ProfileGroup, string]): Promise<ObservationSuggestions> {
    return Promise.resolve({
      communication: COMMUNICATE.test(text)
        ? {
            draft: `Solicito atenção da equipe ao que foi observado: "${text.trim()}". Favor avaliar e reforçar os cuidados.`,
            group: 'enfermagem',
          }
        : null,
      reevaluation: FOLLOW_UP.test(text) ? { dueDate: addDays(today, 1), reason: text.trim() } : null,
    });
  }
}

const TEAM: readonly TeamMember[] = [
  { group: 'medicos', id: 1, name: 'Rafael Dutra Rabello Euarte' },
  { group: 'medicos', id: 4, name: 'Michelle Franklin' },
  { group: 'nutris', id: 2, name: 'Filippa Martins' },
  { group: 'farmacia', id: 3, name: 'Jairo Nepomuceno' },
  { group: 'enfermagem', id: 5, name: 'Almira Borges Pereira' },
  { group: 'fonos', id: 6, name: 'Samuel Lima Rocha' },
];

/** Provisório: mesma equipe vinculada para todo paciente (sem @fisio, para exercitar "grupo sem vinculados"). */
@Injectable()
export class ProvisionalPatientTeamSource extends PatientTeamSource {
  list(): Promise<readonly TeamMember[]> {
    return Promise.resolve(TEAM);
  }
}

/** Provisório: guarda tudo em memória (só acrescenta), até a API real existir. */
@Injectable()
export class ProvisionalObservationStore
  extends ReevaluationSource
  implements ObservationWriter, ReevaluationWriter, DirectedMessageSource, DirectedMessageWriter
{
  private observations: readonly Observation[] = [];
  private reevaluations: readonly Reevaluation[] = [];
  private messages: readonly DirectedMessage[] = [];
  private sequence = 0;

  save(request: ObservationRequest): Promise<Observation> {
    const observation: Observation = { ...request, id: `obs-${++this.sequence}` };

    this.observations = [...this.observations, observation];

    return Promise.resolve(observation);
  }

  list(patientId: string): Promise<readonly Reevaluation[]> {
    return Promise.resolve(this.reevaluations.filter(r => r.patientId === patientId));
  }

  create(request: ReevaluationRequest): Promise<Reevaluation> {
    const item: Reevaluation = {
      ...request,
      changes: [],
      id: `reev-${++this.sequence}`,
      resolvedAt: null,
      resolvedBy: null,
    };

    this.reevaluations = [...this.reevaluations, item];

    return Promise.resolve(item);
  }

  changeRecipients(request: RecipientsChangeRequest): Promise<Reevaluation> {
    return this.replace(request.id, item => ({
      ...item,
      changes: [...item.changes, { at: request.at, author: request.author, recipients: request.recipients }],
      recipients: request.recipients,
    }));
  }

  resolve(request: ResolveRequest): Promise<Reevaluation> {
    return this.replace(request.id, item => ({ ...item, resolvedAt: request.at, resolvedBy: request.author }));
  }

  listMessages(patientId: string): Promise<readonly DirectedMessage[]> {
    return Promise.resolve(this.messages.filter(m => m.patientId === patientId));
  }

  send(request: DirectedMessageRequest): Promise<DirectedMessage> {
    const message: DirectedMessage = { ...request, id: `msg-${++this.sequence}` };

    this.messages = [...this.messages, message];

    return Promise.resolve(message);
  }

  private replace(id: string, change: (item: Reevaluation) => Reevaluation): Promise<Reevaluation> {
    const current = this.reevaluations.find(r => r.id === id);

    if (current === undefined) {
      return Promise.reject(new Error('pendência inexistente'));
    }
    const updated = change(current);

    this.reevaluations = this.reevaluations.map(r => (r.id === id ? updated : r));

    return Promise.resolve(updated);
  }
}
