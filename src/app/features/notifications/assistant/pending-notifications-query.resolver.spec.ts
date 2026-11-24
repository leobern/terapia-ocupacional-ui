import { TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';

import { HospitalContextService } from '../../home/hospital-context.service';
import { LinkedHospitalsReader } from '../../home/linked-hospitals';
import { NotificationsApiService } from '../data-access/notifications-api.service';
import { type Notification, type NotificationPage, type NotificationStatus } from '../notifications.models';
import { PendingNotificationsQueryResolver } from './pending-notifications-query.resolver';

const note = (id: number, name: string, description: string): Notification => ({
  author: { id, name, photoUrl: null, specialty: 'Nutricionista' },
  createdAt: '2026-01-01T00:00:00Z',
  description,
  id,
  patient: null,
  read: false,
  replyCount: 0,
  replies: [],
  type: 'patient_message',
});

describe('PendingNotificationsQueryResolver', () => {
  let pages: NotificationPage[];
  let calls: { hospitalId: number; status: NotificationStatus }[];
  let failing: boolean;
  let resolver: PendingNotificationsQueryResolver;

  beforeEach(async () => {
    spyOnProperty(navigator, 'language', 'get').and.returnValue('pt-BR');
    pages = [];
    calls = [];
    failing = false;
    TestBed.configureTestingModule({
      providers: [
        PendingNotificationsQueryResolver,
        {
          provide: LinkedHospitalsReader,
          useValue: {
            read: (): Promise<{ id: number; name: string }[]> =>
              Promise.resolve([
                { id: 7, name: 'A' },
                { id: 8, name: 'B' },
              ]),
          },
        },
        {
          provide: NotificationsApiService,
          useValue: {
            getNotifications: (hospitalId: number, status: NotificationStatus): Observable<NotificationPage> => {
              calls.push({ hospitalId, status });

              return failing ? throwError(() => new Error('x')) : of(pages[calls.length - 1]);
            },
          },
        },
      ],
    });
    resolver = TestBed.inject(PendingNotificationsQueryResolver);
    await TestBed.inject(HospitalContextService).load();
  });

  it('matches the pending-tasks question (with or without accents) and nothing else', () => {
    expect(resolver.matches('Quais são minhas pendências de hoje?')).toBeTrue();
    expect(resolver.matches('quais sao minhas pendencias de hoje')).toBeTrue();
    expect(resolver.matches('Quais pacientes estão fora da meta nutricional?')).toBeFalse();
  });

  it('summarizes the 3 pending notifications of the hospital in context', async () => {
    pages = [
      {
        items: [note(1, 'Ana', 'a'), note(2, 'Bia', 'b')],
        nextCursor: '2',
        totalCount: 3,
      },
      { items: [note(3, 'Caio', 'c')], nextCursor: null, totalCount: 3 },
    ];

    const answer = await resolver.resolve();

    expect(answer.summary).toBe('Você tem 3 pendências:');
    expect(answer.items).toEqual([
      { route: '/notifications/1', text: 'a', title: 'Ana (Nutricionista)' },
      { route: '/notifications/2', text: 'b', title: 'Bia (Nutricionista)' },
      { route: '/notifications/3', text: 'c', title: 'Caio (Nutricionista)' },
    ]);

    expect(answer.link).toEqual({ label: 'Ver todas em Notificações', route: '/notifications' });

    expect(calls).toEqual([
      { hospitalId: 7, status: 'pending' },
      { hospitalId: 7, status: 'pending' },
    ]);
  });

  it('uses singular for a single pending notification', async () => {
    pages = [{ items: [note(1, 'Ana', 'a')], nextCursor: null, totalCount: 1 }];

    expect((await resolver.resolve()).summary).toBe('Você tem 1 pendência:');
  });

  it('titles a hospital link notice (no author) with the hospital name, or a generic title', async () => {
    const link = { ...note(1, 'x', 'Você foi aprovado'), author: undefined, hospital: { id: 7, name: 'Hospital X' } };

    pages = [{ items: [link, { ...link, hospital: undefined, id: 2 }], nextCursor: null, totalCount: 2 }];

    expect((await resolver.resolve()).items?.map(i => (typeof i === 'string' ? i : i.title))).toEqual([
      'Hospital X',
      'Notificação',
    ]);
  });

  it('says there are no pending notifications when the list is empty', async () => {
    pages = [{ items: [], nextCursor: null, totalCount: 0 }];

    expect(await resolver.resolve()).toEqual({ summary: 'Você não tem pendências.' });
  });

  it('reflects the hospital selected at question time', async () => {
    pages = [{ items: [], nextCursor: null, totalCount: 0 }];
    TestBed.inject(HospitalContextService).select(8);

    await resolver.resolve();

    expect(calls[0].hospitalId).toBe(8);
  });

  it('does not call the API without a hospital in context (no NaN)', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        PendingNotificationsQueryResolver,
        { provide: LinkedHospitalsReader, useValue: { read: (): Promise<never[]> => Promise.resolve([]) } },
        { provide: NotificationsApiService, useValue: { getNotifications: jasmine.createSpy('getNotifications') } },
      ],
    });
    await TestBed.inject(HospitalContextService).load();

    const answer = await TestBed.inject(PendingNotificationsQueryResolver).resolve();

    expect(answer.summary).toContain('Nenhum hospital');
    expect(TestBed.inject(NotificationsApiService).getNotifications).not.toHaveBeenCalled();
  });

  it('rejects when fetching fails, so the assistant shows the generic error', async () => {
    failing = true;

    await expectAsync(resolver.resolve()).toBeRejected();
  });
});
