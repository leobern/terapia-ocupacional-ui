import { AnnouncementAssistant } from './assistant/announcement-assistant';
import { ProvisionalAnnouncementAssistant } from './assistant/provisional-announcement-assistant';
import { Location } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { Actions } from '@ngrx/effects';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { Subject, throwError } from 'rxjs';

import { AiAssistantService } from '../../shared/services/ai-assistant.service';
import { ConnectivityService } from '../../shared/services/connectivity.service';
import { ProvisionalUserDirectory } from '../../shared/services/provisional-user-directory';
import { FormSubmitError, ScreenActionsService } from '../../shared/services/screen-actions.service';
import { UserDirectory } from '../../shared/services/user-directory';
import { ViewportBreakpointService } from '../../shared/services/viewport-breakpoint.service';
import { HospitalContextService } from '../home/hospital-context.service';
import { LinkedHospitalsReader } from '../home/linked-hospitals';
import { NotificationsApiService } from './data-access/notifications-api.service';
import { NotificationsRepository } from './data-access/notifications-repository.service';
import { ProvisionalNotificationsApiService } from './data-access/provisional-notifications-api.service';
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
  const isDesktop = signal(true);

  beforeEach(() => isDesktop.set(true));

  async function configureStore(overrides: Partial<NotificationsState> = {}): Promise<void> {
    actionsSubject = new Subject();
    await TestBed.configureTestingModule({
      imports: [NotificationsComponent],
      providers: [
        provideHttpClient(),
        { provide: NotificationsApiService, useClass: ProvisionalNotificationsApiService },
        { provide: UserDirectory, useClass: ProvisionalUserDirectory },
        { provide: AnnouncementAssistant, useClass: ProvisionalAnnouncementAssistant },
        { provide: ViewportBreakpointService, useValue: { isDesktop: isDesktop.asReadonly() } },
        {
          provide: LinkedHospitalsReader,
          useValue: {
            read: (): Promise<{ id: number; name: string }[]> =>
              Promise.resolve([{ id: 1, name: 'Hospital Vila Nova Star' }]),
          },
        },
        provideMockStore({ initialState: { notifications: { ...initialNotificationsState, ...overrides } } }),
        { provide: Actions, useValue: actionsSubject },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: { get: (): null => null } } },
        },
      ],
    }).compileComponents();
    await TestBed.inject(HospitalContextService).load();
    store = TestBed.inject(MockStore);
    router = TestBed.inject(Router);
  }

  function createComponent(): void {
    fixture = TestBed.createComponent(NotificationsComponent);
    fixture.detectChanges();
  }

  // --- Cabeçalho, fechar e seções (Figma 4506:8583 / 4506:8580) ---

  describe('cabeçalho e seções', () => {
    it('mostra o título com a contagem e o contexto (hospital · data) no subtítulo (Figma v2/PageHeader)', async () => {
      await configureStore({ hospitalId: 1, pendingTotalCount: 3, status: 'success', pendingItems: [notification(1)] });
      createComponent();
      const el: HTMLElement = fixture.nativeElement;

      expect(el.querySelector('.notifications__title')?.textContent?.trim()).toBe('3 notificações');
      expect(el.querySelector('.notifications__subtitle')?.textContent).toContain('Hospital Vila Nova Star');
      expect(el.querySelector('.notifications__subtitle')?.textContent).toContain(' de ');
    });

    it('mobile: o título também leva a contagem ("3 notificações")', async () => {
      isDesktop.set(false);
      await configureStore({ hospitalId: 1, pendingTotalCount: 3, status: 'success' });
      createComponent();

      expect(fixture.nativeElement.querySelector('.notifications__title')?.textContent?.trim()).toBe('3 notificações');
    });

    it('o botão de voltar vem primeiro, e o de atalhos abre o assistente nas ações da tela', async () => {
      await configureStore({ status: 'success' });
      createComponent();
      const buttons = Array.from(
        fixture.nativeElement.querySelectorAll('.notifications__header app-icon-button button'),
      ) as HTMLButtonElement[];
      const assistant = TestBed.inject(AiAssistantService);

      expect(buttons.map(b => b.getAttribute('aria-label'))).toEqual(['Voltar', 'Ações da tela']);

      buttons[1].click();

      expect(assistant.isOpen()).toBeTrue();
      expect(assistant.view()).toBe('shortcuts');
    });

    it('o botão de atalhos fica desabilitado enquanto o menu de atalhos está aberto', async () => {
      await configureStore({ status: 'success' });
      createComponent();
      const assistant = TestBed.inject(AiAssistantService);
      const button = (): HTMLButtonElement =>
        fixture.nativeElement.querySelector('.notifications__shortcuts button') as HTMLButtonElement;

      expect(button().disabled).toBeFalse();

      assistant.openShortcuts();
      fixture.detectChanges();

      expect(button().disabled).toBeTrue();
    });

    it('o botão voltar volta para a tela anterior quando há histórico', async () => {
      await configureStore({ status: 'success' });
      createComponent();
      const location = TestBed.inject(Location);

      spyOn(location, 'back');
      spyOnProperty(window.history, 'length').and.returnValue(3);
      (
        fixture.nativeElement.querySelector('.notifications__header button[aria-label="Voltar"]') as HTMLButtonElement
      ).click();

      expect(location.back).toHaveBeenCalledWith();
    });

    it('o botão voltar leva para a Home quando não há histórico', async () => {
      await configureStore({ status: 'success' });
      createComponent();
      spyOn(router, 'navigate');
      spyOnProperty(window.history, 'length').and.returnValue(1);

      fixture.componentInstance.onClose();

      expect(router.navigate).toHaveBeenCalledWith(['/home']);
    });

    it('lista as resolvidas abaixo do título "Resolvidas", em cards esmaecidos', async () => {
      await configureStore({
        pendingItems: [notification(1)],
        resolvedItems: [notification(2)],
        status: 'success',
      });
      createComponent();
      const el: HTMLElement = fixture.nativeElement;
      const cards = Array.from(el.querySelectorAll('app-card-notify .card-notify'));

      const titles = Array.from(el.querySelectorAll('app-notification-section-title')).map(t => t.textContent ?? '');

      expect(titles[0]).toContain('Pendentes');
      expect(titles[1]).toContain('Resolvidas');
      expect(cards.length).toBe(2);
      expect(cards[0].classList).not.toContain('card-notify--resolved');
      expect(cards[1].classList).toContain('card-notify--resolved');
    });

    it('não mostra o cabeçalho de paciente em notificação criada sem paciente', async () => {
      await configureStore({ pendingItems: [notification(1, { patient: null })], status: 'success' });
      createComponent();

      expect(fixture.nativeElement.querySelector('.card-notify__patient')).toBeNull();
    });
  });

  // --- Ações da tela no assistente (padrão de cadastro) ---

  describe('ações da tela', () => {
    it('registra Criar comunicado, Editar e Responder e as remove ao sair da tela', async () => {
      await configureStore({ status: 'success' });
      createComponent();
      const registry = TestBed.inject(ScreenActionsService);

      expect(registry.actions().map(a => a.label)).toEqual([
        'Criar comunicado interno',
        'Editar notificação',
        'Responder notificação',
      ]);

      expect(registry.actions()[0].form?.fields.map(f => [f.kind, f.required])).toEqual([
        ['mention', true],
        ['text', true],
      ]);

      expect(registry.actions()[0].form?.fields[0].requiredMessage).toContain('destinatário');

      fixture.destroy();

      expect(registry.actions()).toEqual([]);
    });

    it('o campo de destinatários pede sugestão ao assistente a partir do texto do comunicado', async () => {
      await configureStore({ status: 'success' });
      createComponent();
      const assistant = TestBed.inject(AnnouncementAssistant);
      const spy = spyOn(assistant, 'suggestRecipients').and.callThrough();
      const field = TestBed.inject(ScreenActionsService).actions()[0].form?.fields[0];

      expect(field?.suggest?.from).toBe('message');
      expect((await field?.suggest?.run('Estoque de medicamento baixo'))?.map(u => u.name)).toEqual(['farmaceuticos']);
      expect(spy).toHaveBeenCalledWith('Estoque de medicamento baixo');
    });

    const jairo = { id: 3, name: 'Jairo Nepomuceno', photoUrl: null, specialty: 'Farmacêutico' };

    it('o formulário envia o comunicado pela API com os ids dos destinatários e recarrega a lista', async () => {
      await configureStore({ hospitalId: 1, status: 'success' });
      createComponent();
      const api = TestBed.inject(NotificationsApiService);
      const send = spyOn(api, 'createAnnouncement').and.callThrough();
      const dispatch = spyOn(store, 'dispatch').and.callThrough();
      const create = TestBed.inject(ScreenActionsService).actions()[0].form;

      await create?.submit({ message: 'Revisar', recipients: [jairo] });
      fixture.detectChanges();

      expect(send).toHaveBeenCalledWith(1, 'Revisar', [3], []);
      expect(
        TestBed.inject(NotificationsRepository)
          .list('pending', null, 50)
          .items.find(n => n.description === 'Revisar')?.recipients?.[0].name,
      ).toBe('Jairo Nepomuceno');

      expect(dispatch).toHaveBeenCalledWith(NotificationsActions.refreshRequested());
    });

    it('grupos e @todos vão separados das pessoas e chegam à lista dos destinatários resolvidos', async () => {
      await configureStore({ hospitalId: 1, status: 'success' });
      createComponent();
      const send = spyOn(TestBed.inject(NotificationsApiService), 'createAnnouncement').and.callThrough();
      const create = TestBed.inject(ScreenActionsService).actions()[0].form;
      const medicos = {
        group: { memberCount: 2, profile: 'medicos' },
        id: -5,
        name: 'medicos',
        photoUrl: null,
        specialty: '',
      };
      const todos = { group: { memberCount: 6, profile: null }, id: -1, name: 'todos', photoUrl: null, specialty: '' };

      await create?.submit({ message: 'Reunião', recipients: [jairo, medicos, todos] });

      expect(send).toHaveBeenCalledWith(1, 'Reunião', [3], ['medicos', null]);
      expect(
        TestBed.inject(NotificationsRepository)
          .list('pending', null, 50)
          .items.find(n => n.description === 'Reunião')?.recipients?.length,
      ).toBe(6);
    });

    it('sem conexão o envio fica indisponível, avisa e não chama a API', async () => {
      await configureStore({ hospitalId: 1, status: 'success' });
      createComponent();
      TestBed.inject(ConnectivityService).online.set(false);
      const api = TestBed.inject(NotificationsApiService);

      spyOn(api, 'createAnnouncement');
      const create = TestBed.inject(ScreenActionsService).actions()[0].form;

      await expectAsync(
        create?.submit({ message: 'Revisar', recipients: [jairo] }) as Promise<void>,
      ).toBeRejectedWithError(FormSubmitError, /Sem conexão/u);

      expect(api.createAnnouncement).not.toHaveBeenCalled();
    });

    it('falha da API propaga o erro (o formulário mantém as respostas)', async () => {
      await configureStore({ hospitalId: 1, status: 'success' });
      createComponent();
      spyOn(TestBed.inject(NotificationsApiService), 'createAnnouncement').and.returnValue(
        throwError(() => new Error('x')),
      );
      const create = TestBed.inject(ScreenActionsService).actions()[0].form;

      await expectAsync(create?.submit({ message: 'x', recipients: [jairo] }) as Promise<void>).toBeRejected();
    });

    it('o card de comunicado mostra os destinatários antes do texto', async () => {
      await configureStore({
        status: 'success',
        pendingItems: [notification(1, { patient: null, recipients: [jairo] })],
      });
      createComponent();

      expect(fixture.nativeElement.textContent).toContain('Para Jairo Nepomuceno: Descrição 1');
    });
  });

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

  it('Resolver pede confirmação: só despacha resolveRequested após "Sim"', async () => {
    await configureStore({ status: 'success' });
    createComponent();
    spyOn(store, 'dispatch');

    fixture.componentInstance.onResolveClick(7);

    expect(store.dispatch).not.toHaveBeenCalled();

    fixture.componentInstance.onConfirmResolve();

    expect(store.dispatch).toHaveBeenCalledWith(NotificationsActions.resolveRequested({ notificationId: 7 }));
  });

  it('"Não" no diálogo de Resolver não despacha nada', async () => {
    await configureStore({ status: 'success' });
    createComponent();
    spyOn(store, 'dispatch');

    fixture.componentInstance.onResolveClick(7);
    fixture.componentInstance.onCancelResolve();
    fixture.componentInstance.onConfirmResolve();

    expect(store.dispatch).not.toHaveBeenCalled();
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
