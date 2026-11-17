import { provideHttpClient } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { Actions } from '@ngrx/effects';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { Subject } from 'rxjs';

import { NotificationsComponent } from './notifications.component';
import { Notification } from './notifications.models';
import { NotificationsActions } from './state/notifications.actions';
import { initialNotificationsState, NotificationsState } from './state/notifications.reducer';

function notification(id: number, overrides: Partial<Notification> = {}): Notification {
  return {
    id,
    author: { id: 1, name: 'Jairo Nepomuceno', specialty: 'Enfermeiro', photoUrl: null },
    patient: { id: 100 + id, name: 'José da Silva' },
    description: 'Descrição ' + id,
    createdAt: new Date().toISOString(),
    read: false,
    replyCount: 0,
    replies: [],
    ...overrides,
  };
}

describe('NotificationsComponent', () => {
  let fixture: ComponentFixture<NotificationsComponent>;
  let store: MockStore;
  let router: Router;
  let actionsSubject: Subject<{ type: string }>;

  async function configureStore(overrides: Partial<NotificationsState> = {}): Promise<void> {
    actionsSubject = new Subject();
    await TestBed.configureTestingModule({
      imports: [NotificationsComponent],
      providers: [
        provideHttpClient(),
        provideMockStore({ initialState: { notifications: { ...initialNotificationsState, ...overrides } } }),
        { provide: Actions, useValue: actionsSubject },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: { get: (): null => null } } },
        },
      ],
    }).compileComponents();
    store = TestBed.inject(MockStore);
    router = TestBed.inject(Router);
  }

  function createComponent(): void {
    fixture = TestBed.createComponent(NotificationsComponent);
    fixture.detectChanges();
  }

  // --- US2: navegação ao paciente (FR-006) ---

  it('onCardClick navega para /patients/:id com o patientId correto', async () => {
    await configureStore({ status: 'success', pendingItems: [notification(1)] });
    createComponent();
    spyOn(router, 'navigate');

    fixture.componentInstance.onCardClick(101);

    expect(router.navigate).toHaveBeenCalledWith(['/patients', 101]);
  });

  it('card em modo "answering" recebe type="answering" (app-card-notify suprime cardClick sozinho — DS spec FR-015)', async () => {
    await configureStore({ status: 'success', pendingItems: [notification(1)], answeringId: 1 });
    createComponent();

    expect(fixture.componentInstance.cardType(1)).toBe('answering');
  });

  it('cardType retorna "detail" por padrão e "answer-open" quando expandido', async () => {
    await configureStore({ status: 'success', pendingItems: [notification(1)] });
    createComponent();

    expect(fixture.componentInstance.cardType(1)).toBe('detail');
    fixture.componentInstance.onViewRepliesClick(1);

    expect(fixture.componentInstance.cardType(1)).toBe('answer-open');
  });

  // --- US4: expandir/recolher histórico ---

  it('onViewRepliesClick expande o card (type vira answer-open)', async () => {
    await configureStore({
      status: 'success',
      pendingItems: [
        notification(1, {
          replyCount: 1,
          replies: [
            {
              id: 1,
              author: { id: 2, name: 'Renata', specialty: 'Nutricionista', photoUrl: null },
              text: 'ok',
              createdAt: new Date().toISOString(),
            },
          ],
        }),
      ],
    });
    createComponent();

    expect(fixture.componentInstance.isExpanded(1)).toBeFalse();
    fixture.componentInstance.onViewRepliesClick(1);

    expect(fixture.componentInstance.isExpanded(1)).toBeTrue();
  });

  it('onCollapseClick recolhe o card', async () => {
    await configureStore({ status: 'success', pendingItems: [notification(1)] });
    createComponent();

    fixture.componentInstance.onViewRepliesClick(1);
    fixture.componentInstance.onCollapseClick(1);

    expect(fixture.componentInstance.isExpanded(1)).toBeFalse();
  });

  it('responder com histórico já expandido mantém o histórico visível (Acceptance Scenario 1a de US3)', async () => {
    await configureStore({ status: 'success', pendingItems: [notification(1)], answeringId: 1 });
    createComponent();

    fixture.componentInstance.onViewRepliesClick(1); // já estava expandido antes de responder

    // `isExpanded` continua true mesmo com `answeringId === 1` — o template
    // usa isso para não colapsar o histórico ao entrar em modo "answering".
    expect(fixture.componentInstance.isExpanded(1)).toBeTrue();
  });

  // --- Fluxo de resposta (US3) ---

  it('onAnswerClick despacha answerStarted com o notificationId', async () => {
    await configureStore({ status: 'success' });
    createComponent();
    spyOn(store, 'dispatch');

    fixture.componentInstance.onAnswerClick(1);

    expect(store.dispatch).toHaveBeenCalledWith(NotificationsActions.answerStarted({ notificationId: 1 }));
  });

  it('onSendDraft despacha answerSubmitted só quando há um card em edição', async () => {
    await configureStore({ status: 'success', answeringId: 5 });
    createComponent();
    spyOn(store, 'dispatch');

    fixture.componentInstance.onSendDraft();

    expect(store.dispatch).toHaveBeenCalledWith(NotificationsActions.answerSubmitted({ notificationId: 5 }));
  });

  it('onBottomSheetClosed descarta o rascunho sem diálogo (FR-010)', async () => {
    await configureStore({ status: 'success', answeringId: 5 });
    createComponent();
    spyOn(store, 'dispatch');

    fixture.componentInstance.onBottomSheetClosed();

    expect(store.dispatch).toHaveBeenCalledWith(NotificationsActions.answerDiscarded());
  });
});
