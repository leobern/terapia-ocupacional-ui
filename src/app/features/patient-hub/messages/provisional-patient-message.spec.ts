import { TestBed } from '@angular/core/testing';

import { NotificationsRepository } from '../../notifications/data-access/notifications-repository.service';
import { PatientHubSource } from '../patient-hub-source';
import {
  ProvisionalMessageAiAssistant,
  ProvisionalPatientMessageSource,
  ProvisionalPatientTeamSource,
} from './provisional-patient-message';

const base = {
  at: '2026-11-21T10:00:00.000Z',
  author: 'Michelle Franklin',
  content: 'x',
  patientId: 'p1',
  viaAudio: false,
};

describe('provisional patient messages', () => {
  let source: ProvisionalPatientMessageSource;
  let notifications: NotificationsRepository;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ProvisionalPatientMessageSource,
        {
          provide: PatientHubSource,
          useValue: { loadProfile: (): Promise<{ name: string }> => Promise.resolve({ name: 'Maria' }) },
        },
      ],
    });
    source = TestBed.inject(ProvisionalPatientMessageSource);
    notifications = TestBed.inject(NotificationsRepository);
  });

  it('observação é guardada sem notificar ninguém; lista do mais recente ao mais antigo', async () => {
    const before = notifications.list('pending', null, 50).totalCount;

    await source.send({ ...base, content: 'primeira', recipients: [] });
    await source.send({ ...base, content: 'segunda', recipients: [] });

    expect((await source.list('p1')).map(r => r.content)).toEqual(['segunda', 'primeira']);
    expect(await source.list('p2')).toEqual([]);
    expect(notifications.list('pending', null, 50).totalCount).toBe(before);
  });

  it('mensagem direcionada entra nas notificações com o paciente', async () => {
    const before = notifications.list('pending', null, 50).totalCount;

    await source.send({ ...base, recipients: [{ id: 5, name: 'Almira', specialty: 'Enfermeira' }] });

    expect(notifications.list('pending', null, 50).totalCount).toBe(before + 1);
    expect(notifications.list('pending', null, 1).items[0].patient).toEqual({ id: 'p1', name: 'Maria' });
  });

  it('equipe e IA provisórias', async () => {
    expect((await new ProvisionalPatientTeamSource().listLinked()).length).toBe(6);
    const ai = new ProvisionalMessageAiAssistant();

    expect(await ai.transcribe()).toBe('');
    expect(await ai.suggestGroups('SNE exteriorizada')).toEqual(['nurses']);
    expect(await ai.suggestGroups('dieta interrompida')).toEqual([]);
  });
});
