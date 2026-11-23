import { inject, Injectable } from '@angular/core';

import { NotificationsRepository } from '../../notifications/data-access/notifications-repository.service';
import { PatientHubSource } from '../patient-hub-source';
import { LinkedProfessional, PatientRecord, PatientRecordRequest, ProfessionalGroup } from './patient-message.models';
import { MessageAiAssistant, PatientMessageSource, PatientTeamSource } from './patient-message-source';

const TEAM: readonly LinkedProfessional[] = [
  { group: 'doctors', id: 1, name: 'Rafael Dutra Rabello Euarte', specialty: 'Nutrólogo' },
  { group: 'nutritionists', id: 2, name: 'Filippa Martins', specialty: 'Nutricionista' },
  { group: 'pharmacists', id: 3, name: 'Jairo Nepomuceno', specialty: 'Farmacêutico' },
  { group: 'doctors', id: 4, name: 'Michelle Franklin', specialty: 'Nutróloga' },
  { group: 'nurses', id: 5, name: 'Almira Borges Pereira', specialty: 'Enfermeira' },
  { group: 'speech', id: 6, name: 'Samuel Lima Rocha', specialty: 'Fonoaudiólogo' },
];

/** Provisório: a mesma equipe de exemplo para todo paciente (sem fisioterapia, para exercitar o grupo vazio). */
@Injectable()
export class ProvisionalPatientTeamSource extends PatientTeamSource {
  listLinked(): Promise<readonly LinkedProfessional[]> {
    return Promise.resolve(TEAM);
  }
}

/**
 * Provisório, em memória. Mensagem direcionada também entra na lista de notificações (o backend real faz
 * esse fan-out); observação sem destinatário não notifica ninguém.
 */
@Injectable()
export class ProvisionalPatientMessageSource extends PatientMessageSource {
  private readonly notifications = inject(NotificationsRepository);
  private readonly hub = inject(PatientHubSource);
  private readonly store = new Map<string, readonly PatientRecord[]>();
  private sequence = 0;

  list(patientId: string): Promise<readonly PatientRecord[]> {
    return Promise.resolve(this.store.get(patientId) ?? []);
  }

  async send(request: PatientRecordRequest): Promise<PatientRecord> {
    const record: PatientRecord = { ...request, id: `msg-${++this.sequence}` };

    if (record.recipients.length > 0) {
      const profile = await this.hub.loadProfile(record.patientId);

      this.notifications.create({
        dueDate: '',
        message: record.content,
        patient: { id: record.patientId, name: profile?.name ?? '' },
        recipients: record.recipients.map(r => ({ ...r, photoUrl: null })),
      });
    }
    this.store.set(record.patientId, [record, ...(this.store.get(record.patientId) ?? [])]);

    return record;
  }
}

const RULES: readonly { readonly group: ProfessionalGroup; readonly pattern: RegExp }[] = [
  { group: 'nurses', pattern: /\b(sne|sonda|curativo|mucosa|exterioriz)/i },
  { group: 'pharmacists', pattern: /\b(estoque|farm[aá]cia|diluic)/i },
  { group: 'doctors', pattern: /\b(prescri|dose|conduta)/i },
];

/** Provisório: ainda não há serviço de IA; não transcreve e sugere grupos por palavras-chave simples. */
@Injectable()
export class ProvisionalMessageAiAssistant extends MessageAiAssistant {
  transcribe(): Promise<string> {
    return Promise.resolve('');
  }

  suggestGroups(content: string): Promise<readonly ProfessionalGroup[]> {
    return Promise.resolve(RULES.filter(rule => rule.pattern.test(content)).map(rule => rule.group));
  }
}
