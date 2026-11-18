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
});

describe('PendingNotificationsQueryResolver', () => {
  let pages: NotificationPage[];
  let calls: { hospitalId: number; status: NotificationStatus }[];
  let failing: boolean;
  let resolver: PendingNotificationsQueryResolver;

  beforeEach(() => {
    pages = [];
    calls = [];
    failing = false;
    TestBed.configureTestingModule({
      providers: [
        PendingNotificationsQueryResolver,
        {
          provide: LinkedHospitalsReader,
          useValue: {
            read: (): { id: string; name: string }[] => [
              { id: '7', name: 'A' },
              { id: '8', name: 'B' },
            ],
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
    expect(answer.items).toEqual(['Ana (Nutricionista): a', 'Bia (Nutricionista): b', 'Caio (Nutricionista): c']);

    expect(calls).toEqual([
      { hospitalId: 7, status: 'pending' },
      { hospitalId: 7, status: 'pending' },
    ]);
  });

  it('uses singular for a single pending notification', async () => {
    pages = [{ items: [note(1, 'Ana', 'a')], nextCursor: null, totalCount: 1 }];

    expect((await resolver.resolve()).summary).toBe('Você tem 1 pendência:');
  });

  it('says there are no pending notifications when the list is empty', async () => {
    pages = [{ items: [], nextCursor: null, totalCount: 0 }];

    expect(await resolver.resolve()).toEqual({ summary: 'Você não tem pendências.' });
  });

  it('reflects the hospital selected at question time', async () => {
    pages = [{ items: [], nextCursor: null, totalCount: 0 }];
    TestBed.inject(HospitalContextService).select('8');

    await resolver.resolve();

    expect(calls[0].hospitalId).toBe(8);
  });

  it('rejects when fetching fails, so the assistant shows the generic error', async () => {
    failing = true;

    await expectAsync(resolver.resolve()).toBeRejected();
  });
});
