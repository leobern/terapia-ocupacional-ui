import { TestBed } from '@angular/core/testing';
import { provideMockActions } from '@ngrx/effects/testing';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { Observable, of, ReplaySubject } from 'rxjs';

import { HomeApiService } from '../../home/data-access/home-api.service';
import { NotificationsApiService } from '../data-access/notifications-api.service';
import { NotificationPage } from '../notifications.models';
import { NotificationsActions } from './notifications.actions';
import {
  loadNextBatch$,
  loadPendingPage$,
  loadResolvedOnTabSelected$,
  markAsRead$,
  refresh$,
  resolveHospitalContext$,
  resolveNotification$,
  submitReply$,
} from './notifications.effects';
import { initialNotificationsState, NotificationsState } from './notifications.reducer';

const page: NotificationPage = { items: [], nextCursor: null, totalCount: 0 };

describe('notifications.effects (abas)', () => {
  let actions$: ReplaySubject<{ type: string }>;
  let api: jasmine.SpyObj<NotificationsApiService>;
  let homeApi: jasmine.SpyObj<HomeApiService>;
  const failing = (): Observable<never> => new Observable(sub => sub.error(new Error('x')));

  function setup(state: Partial<NotificationsState>): void {
    TestBed.resetTestingModule();
    actions$ = new ReplaySubject(1);
    api = jasmine.createSpyObj('NotificationsApiService', ['getNotifications', 'createReply', 'markAsRead', 'resolve']);
    api.getNotifications.and.returnValue(of(page));
    homeApi = jasmine.createSpyObj('HomeApiService', ['getHospitals']);
    TestBed.configureTestingModule({
      providers: [
        provideMockActions(() => actions$ as unknown as Observable<never>),
        provideMockStore({
          initialState: { notifications: { ...initialNotificationsState, hospitalId: 1, ...state } },
        }),
        { provide: NotificationsApiService, useValue: api },
        { provide: HomeApiService, useValue: homeApi },
      ],
    });
    TestBed.inject(MockStore);
  }

  function run<T>(effect: Observable<T>, action: { type: string }): T[] {
    const out: T[] = [];

    effect.subscribe(value => out.push(value));
    actions$.next(action);

    return out;
  }

  it('loadNextBatch na aba Ativas busca pelo cursor de Ativas', () => {
    setup({ pendingCursor: 'p1', resolvedCursor: 'r1', resolvedLoaded: true });
    TestBed.runInInjectionContext(() => {
      const out = run(loadNextBatch$(), NotificationsActions.loadNextBatchRequested());

      expect(api.getNotifications).toHaveBeenCalledWith(1, 'pending', 'p1');
      expect(out).toEqual([NotificationsActions.loadPendingPageSuccess({ page })]);
    });
  });

  it('loadNextBatch na aba Resolvidas busca a 1ª página com cursor nulo e as seguintes pelo cursor', () => {
    setup({ activeTab: 'resolved', pendingCursor: 'p1' });
    TestBed.runInInjectionContext(() => {
      const out = run(loadNextBatch$(), NotificationsActions.loadNextBatchRequested());

      expect(api.getNotifications).toHaveBeenCalledWith(1, 'resolved', null);
      expect(out).toEqual([NotificationsActions.loadResolvedPageSuccess({ page })]);
    });
  });

  it('loadNextBatch usa o cursor de Resolvidas quando já há uma página', () => {
    setup({ activeTab: 'resolved', resolvedCursor: 'r1', resolvedLoaded: true });
    TestBed.runInInjectionContext(() => {
      run(loadNextBatch$(), NotificationsActions.loadNextBatchRequested());

      expect(api.getNotifications).toHaveBeenCalledWith(1, 'resolved', 'r1');
    });
  });

  it('loadNextBatch não busca quando a aba selecionada esgotou, mesmo que a outra tenha cursor', () => {
    setup({ pendingCursor: null, resolvedCursor: 'r1', resolvedLoaded: true });
    TestBed.runInInjectionContext(() => {
      run(loadNextBatch$(), NotificationsActions.loadNextBatchRequested());

      expect(api.getNotifications).not.toHaveBeenCalled();
    });
  });

  it('loadNextBatch converte falha em failure da aba correspondente', () => {
    setup({ pendingCursor: 'p1' });
    api.getNotifications.and.returnValue(new Observable(sub => sub.error(new Error('x'))));
    TestBed.runInInjectionContext(() => {
      const out = run(loadNextBatch$(), NotificationsActions.loadNextBatchRequested());

      expect(out[0].type).toBe(NotificationsActions.loadPendingPageFailure({ message: '' }).type);
    });

    setup({ activeTab: 'resolved' });
    api.getNotifications.and.returnValue(new Observable(sub => sub.error(new Error('x'))));
    TestBed.runInInjectionContext(() => {
      const out = run(loadNextBatch$(), NotificationsActions.loadNextBatchRequested());

      expect(out[0].type).toBe(NotificationsActions.loadResolvedPageFailure({ message: '' }).type);
    });
  });

  it('selecionar Resolvidas pela 1ª vez pede a 1ª página; já carregada ou Ativas, não', () => {
    setup({ resolvedLoaded: false });
    TestBed.runInInjectionContext(() => {
      expect(run(loadResolvedOnTabSelected$(), NotificationsActions.tabSelected({ tab: 'resolved' }))).toEqual([
        NotificationsActions.loadNextBatchRequested(),
      ]);
    });

    setup({ resolvedLoaded: true });
    TestBed.runInInjectionContext(() => {
      expect(run(loadResolvedOnTabSelected$(), NotificationsActions.tabSelected({ tab: 'resolved' }))).toEqual([]);
      expect(run(loadResolvedOnTabSelected$(), NotificationsActions.tabSelected({ tab: 'pending' }))).toEqual([]);
    });
  });

  it('refresh reabre a tela e reaplica a aba Resolvidas quando era a selecionada', () => {
    setup({ activeTab: 'resolved' });
    TestBed.runInInjectionContext(() => {
      expect(run(refresh$(), NotificationsActions.refreshRequested())).toEqual([
        NotificationsActions.pageOpened({ hospitalId: 1 }),
        NotificationsActions.tabSelected({ tab: 'resolved' }),
      ]);
    });

    setup({});
    TestBed.runInInjectionContext(() => {
      expect(run(refresh$(), NotificationsActions.refreshRequested())).toEqual([
        NotificationsActions.pageOpened({ hospitalId: 1 }),
      ]);
    });

    setup({ hospitalId: null });
    TestBed.runInInjectionContext(() => {
      expect(run(refresh$(), NotificationsActions.refreshRequested())).toEqual([]);
    });
  });

  it('pageOpened sem hospital resolve o primeiro hospital vinculado; falha vira erro', () => {
    setup({});
    homeApi.getHospitals.and.returnValue(of([{ id: 7, name: 'H' }]));
    TestBed.runInInjectionContext(() => {
      expect(run(resolveHospitalContext$(), NotificationsActions.pageOpened({ hospitalId: null }))).toEqual([
        NotificationsActions.pageOpened({ hospitalId: 7 }),
      ]);
    });

    setup({});
    homeApi.getHospitals.and.returnValue(failing());
    TestBed.runInInjectionContext(() => {
      const out = run(resolveHospitalContext$(), NotificationsActions.pageOpened({ hospitalId: null }));

      expect(out[0].type).toBe(NotificationsActions.loadPendingPageFailure({ message: '' }).type);
    });
  });

  it('pageOpened com hospital carrega a 1ª página de Ativas; falha vira failure', () => {
    setup({});
    TestBed.runInInjectionContext(() => {
      expect(run(loadPendingPage$(), NotificationsActions.pageOpened({ hospitalId: 1 }))).toEqual([
        NotificationsActions.loadPendingPageSuccess({ page }),
      ]);

      expect(api.getNotifications).toHaveBeenCalledWith(1, 'pending', null);
    });

    setup({});
    api.getNotifications.and.returnValue(failing());
    TestBed.runInInjectionContext(() => {
      const out = run(loadPendingPage$(), NotificationsActions.pageOpened({ hospitalId: 1 }));

      expect(out[0].type).toBe(NotificationsActions.loadPendingPageFailure({ message: '' }).type);
    });
  });

  it('envia a resposta com o rascunho; falha vira answerSubmitFailure', () => {
    const reply = { author: { id: 1, name: 'A', photoUrl: null, specialty: 'B' }, createdAt: '', id: 1, text: 't' };

    setup({ draftText: 'oi' });
    api.createReply.and.returnValue(of(reply));
    TestBed.runInInjectionContext(() => {
      expect(run(submitReply$(), NotificationsActions.answerSubmitted({ notificationId: 5 }))).toEqual([
        NotificationsActions.answerSubmitSuccess({ notificationId: 5, reply }),
      ]);

      expect(api.createReply).toHaveBeenCalledWith(5, 'oi');
    });

    setup({});
    api.createReply.and.returnValue(failing());
    TestBed.runInInjectionContext(() => {
      const out = run(submitReply$(), NotificationsActions.answerSubmitted({ notificationId: 5 }));

      expect(out[0].type).toBe(NotificationsActions.answerSubmitFailure({ notificationId: 5, message: '' }).type);
    });
  });

  it('resolve a notificação; falha vira resolveFailure', () => {
    setup({});
    api.resolve.and.returnValue(of(undefined));
    TestBed.runInInjectionContext(() => {
      expect(run(resolveNotification$(), NotificationsActions.resolveRequested({ notificationId: 5 }))).toEqual([
        NotificationsActions.resolveSuccess({ notificationId: 5 }),
      ]);
    });

    setup({});
    api.resolve.and.returnValue(failing());
    TestBed.runInInjectionContext(() => {
      const out = run(resolveNotification$(), NotificationsActions.resolveRequested({ notificationId: 5 }));

      expect(out[0].type).toBe(NotificationsActions.resolveFailure({ notificationId: 5, message: '' }).type);
    });
  });

  it('marca como lida cada notificação; falha (ex.: offline) é ignorada sem erro', () => {
    setup({});
    api.markAsRead.and.returnValues(of(undefined), failing());
    TestBed.runInInjectionContext(() => {
      const out = run(markAsRead$(), NotificationsActions.markAsReadRequested({ notificationIds: [1, 2] }));

      expect(api.markAsRead.calls.allArgs()).toEqual([[1], [2]]);
      expect(out.length).toBe(1);
    });
  });
});
