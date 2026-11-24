import { Location } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { Actions } from '@ngrx/effects';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { of, Subject, throwError } from 'rxjs';

import { AiAssistantService } from '../../shared/services/ai-assistant.service';
import { ConnectivityService } from '../../shared/services/connectivity.service';
import { ProvisionalUserDirectory } from '../../shared/services/provisional-user-directory';
import {
  FormSubmitError,
  type ScreenAction,
  ScreenActionsService,
  type ScreenCommand,
} from '../../shared/services/screen-actions.service';
import { UserDirectory } from '../../shared/services/user-directory';
import { ViewportBreakpointService } from '../../shared/services/viewport-breakpoint.service';
import { HospitalContextService } from '../home/hospital-context.service';
import { LinkedHospitalsReader } from '../home/linked-hospitals';
import { AnnouncementAssistant } from './assistant/announcement-assistant';
import { ProvisionalAnnouncementAssistant } from './assistant/provisional-announcement-assistant';
import { type Comunicado, ComunicadosApiService } from './data-access/comunicados-api.service';
import { NotificationsApiService } from './data-access/notifications-api.service';
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
    mentioned: [{ id: 4, name: 'Michelle Franklin', specialty: 'Nutróloga', photoUrl: null }],
    replyCount: 0,
    replies: [],
    type: 'patient_message',
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

    it('abre na aba Ativas, mostrando só as ativas', async () => {
      await configureStore({
        pendingItems: [notification(1)],
        resolvedItems: [notification(2)],
        status: 'success',
      });
      createComponent();
      const el: HTMLElement = fixture.nativeElement;
      const tabs = Array.from(el.querySelectorAll('[role="tab"]'));

      expect(tabs.map(t => t.textContent?.trim())).toEqual(['Ativas', 'Resolvidas']);
      expect(tabs.map(t => t.getAttribute('aria-selected'))).toEqual(['true', 'false']);
      expect(el.querySelectorAll('app-card-notify').length).toBe(1);
      expect(el.querySelector('.card-notify--resolved')).toBeNull();
    });

    it('na aba Resolvidas lista só as resolvidas, em cards esmaecidos', async () => {
      await configureStore({
        activeTab: 'resolved',
        pendingItems: [notification(1)],
        resolvedItems: [notification(2)],
        resolvedLoaded: true,
        status: 'success',
      });
      createComponent();
      const el: HTMLElement = fixture.nativeElement;

      expect(el.querySelectorAll('app-card-notify').length).toBe(1);
      expect(el.querySelector('.card-notify--resolved')).not.toBeNull();
    });

    it('na aba Resolvidas o card oferece responder (sem Resolver) e acioná-lo inicia a resposta', async () => {
      await configureStore({
        activeTab: 'resolved',
        resolvedItems: [notification(2)],
        resolvedLoaded: true,
        status: 'success',
      });
      createComponent();
      spyOn(store, 'dispatch');
      const el: HTMLElement = fixture.nativeElement;
      const answer = el.querySelector('.card-notify__actions app-icon-button button') as HTMLButtonElement;

      expect(answer).not.toBeNull();
      expect(el.querySelector('.card-notify__row app-icon-button')).toBeNull();

      answer.click();

      expect(store.dispatch).toHaveBeenCalledWith(NotificationsActions.answerStarted({ notificationId: 2 }));
    });

    it('acionar a aba Resolvidas despacha tabSelected; acionar a aba atual não faz nada', async () => {
      await configureStore({ status: 'success' });
      createComponent();
      const dispatch = jasmine.createSpy('dispatch');

      store.dispatch = dispatch;
      const tabs = Array.from(fixture.nativeElement.querySelectorAll('[role="tab"]')) as HTMLButtonElement[];

      tabs[0].click();

      expect(dispatch).not.toHaveBeenCalled();

      tabs[1].click();

      expect(dispatch).toHaveBeenCalledWith(NotificationsActions.tabSelected({ tab: 'resolved' }));
    });

    it('notificações não lidas exibidas são marcadas como lidas; já lidas não disparam marcação', async () => {
      await configureStore({
        pendingItems: [notification(1), notification(2, { read: true }), notification(3)],
        status: 'success',
      });
      const dispatch = jasmine.createSpy('dispatch');

      store.dispatch = dispatch;
      createComponent();

      expect(dispatch).toHaveBeenCalledWith(NotificationsActions.markAsReadRequested({ notificationIds: [1, 3] }));
    });

    it('com tudo lido não dispara nenhuma marcação', async () => {
      await configureStore({ pendingItems: [notification(1, { read: true })], status: 'success' });
      const dispatch = jasmine.createSpy('dispatch');

      store.dispatch = dispatch;
      createComponent();

      expect(dispatch).not.toHaveBeenCalledWith(jasmine.objectContaining({ notificationIds: jasmine.anything() }));
    });

    it('sem notificações ativas, indica que não há notificações pendentes no momento', async () => {
      await configureStore({ status: 'success' });
      createComponent();

      expect(fixture.nativeElement.querySelector('.notifications__empty')?.textContent).toContain(
        'Nenhuma notificação pendente no momento',
      );
    });

    it('Resolvidas vazia (já carregada) mostra o estado vazio próprio; antes de carregar não mostra', async () => {
      await configureStore({ activeTab: 'resolved', resolvedLoaded: false, status: 'success' });
      createComponent();

      expect(fixture.nativeElement.querySelector('.notifications__empty')).toBeNull();

      store.setState({
        notifications: { ...initialNotificationsState, activeTab: 'resolved', resolvedLoaded: true, status: 'success' },
      });
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.notifications__empty')?.textContent).toContain(
        'Nenhuma notificação resolvida',
      );
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

    describe('comando por texto ou áudio', () => {
      const open = async (command: ScreenCommand, transcript: string | Error): Promise<ScreenAction> => {
        await configureStore({ status: 'success' });
        createComponent();
        spyOn(TestBed.inject(AnnouncementAssistant), 'transcribe').and.callFake(() =>
          transcript instanceof Error ? Promise.reject(transcript) : Promise.resolve(transcript),
        );
        const assistant = TestBed.inject(AiAssistantService);

        spyOn(assistant, 'openAction');

        await TestBed.inject(ScreenActionsService).commandHandler()?.(command);

        return (assistant.openAction as jasmine.Spy).calls.mostRecent().args[0];
      };

      it('texto abre o formulário do comunicado com o conteúdo preenchido', async () => {
        const action = await open({ kind: 'text', text: 'Reunião às 10h' }, '');

        expect(action.form?.initialValues).toEqual({ message: 'Reunião às 10h' });
        expect(action.form?.notice).toBeUndefined();
      });

      it('áudio transcrito preenche o conteúdo editável', async () => {
        const action = await open({ audio: new Blob(['x']), kind: 'audio' }, 'Estoque baixo');

        expect(action.form?.initialValues).toEqual({ message: 'Estoque baixo' });
      });

      it('falha na transcrição abre o formulário vazio com aviso para digitar', async () => {
        const action = await open({ audio: new Blob(['x']), kind: 'audio' }, new Error('falha'));

        expect(action.form?.initialValues).toBeUndefined();
        expect(action.form?.notice).toContain('Digite o comunicado');
      });
    });

    const jairo = { id: 3, name: 'Jairo Nepomuceno', photoUrl: null, specialty: 'Farmacêutico' };

    it('o formulário envia o comunicado pela API de comunicados e recarrega a lista', async () => {
      await configureStore({ hospitalId: 1, status: 'success' });
      createComponent();
      const send = spyOn(TestBed.inject(ComunicadosApiService), 'create').and.returnValue(of({} as Comunicado));
      const dispatch = spyOn(store, 'dispatch').and.callThrough();
      const create = TestBed.inject(ScreenActionsService).actions()[0].form;

      await create?.submit({ message: 'Revisar', recipients: [jairo] });

      expect(send).toHaveBeenCalledWith(1, 'Revisar', [{ professionalId: 3, type: 'PESSOA' }]);
      expect(dispatch).toHaveBeenCalledWith(NotificationsActions.refreshRequested());
    });

    it('grupos por perfil e @todos vão como GRUPO e TODOS, junto das pessoas', async () => {
      await configureStore({ hospitalId: 1, status: 'success' });
      createComponent();
      const send = spyOn(TestBed.inject(ComunicadosApiService), 'create').and.returnValue(of({} as Comunicado));
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

      expect(send).toHaveBeenCalledWith(1, 'Reunião', [
        { professionalId: 3, type: 'PESSOA' },
        { perfil: 'medicos', type: 'GRUPO' },
        { type: 'TODOS' },
      ]);
    });

    it('sem conexão o envio fica indisponível, avisa e não chama a API', async () => {
      await configureStore({ hospitalId: 1, status: 'success' });
      createComponent();
      TestBed.inject(ConnectivityService).online.set(false);
      const api = TestBed.inject(ComunicadosApiService);

      spyOn(api, 'create');
      const create = TestBed.inject(ScreenActionsService).actions()[0].form;

      await expectAsync(
        create?.submit({ message: 'Revisar', recipients: [jairo] }) as Promise<void>,
      ).toBeRejectedWithError(FormSubmitError, /Sem conexão/u);

      expect(api.create).not.toHaveBeenCalled();
    });

    it('falha da API propaga o erro (o formulário mantém as respostas)', async () => {
      await configureStore({ hospitalId: 1, status: 'success' });
      createComponent();
      spyOn(TestBed.inject(ComunicadosApiService), 'create').and.returnValue(throwError(() => new Error('x')));
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

  describe('tipos de conteúdo', () => {
    const mixed = (): Notification[] => [
      notification(1),
      notification(2, { type: 'reevaluation_pending', overdue: true }),
      notification(3, { type: 'reevaluation_pending', overdue: false }),
      notification(4, { type: 'internal_notice', patient: undefined }),
    ];

    for (const tab of ['pending', 'resolved'] as const) {
      it(`aba ${tab}: identifica cada tipo em texto, "Vencida" só na vencida e sem paciente no comunicado`, async () => {
        await configureStore(
          tab === 'pending'
            ? { status: 'success', pendingItems: mixed() }
            : { activeTab: 'resolved', resolvedItems: mixed(), resolvedLoaded: true, status: 'success' },
        );
        createComponent();
        const cards = Array.from(fixture.nativeElement.querySelectorAll('app-card-notify')) as HTMLElement[];
        const labels = cards.map(c => c.querySelector('.card-notify__kind-label')?.textContent?.trim());

        expect(labels).toEqual([
          'Mensagem de paciente',
          'Pendência de reavaliação',
          'Pendência de reavaliação',
          'Comunicado interno',
        ]);

        expect(cards.map(c => c.querySelector('.card-notify__kind-label--overdue')?.textContent?.trim())).toEqual([
          undefined,
          'Vencida',
          undefined,
          undefined,
        ]);

        expect(cards[3].querySelector('.card-notify__patient')).toBeNull();
      });
    }

    it('toque em comunicado interno não navega ao paciente', async () => {
      await configureStore({ status: 'success', pendingItems: mixed() });
      createComponent();
      spyOn(router, 'navigate');

      fixture.componentInstance.onCardClick(undefined);

      expect(router.navigate).not.toHaveBeenCalled();
    });
  });

  // --- US-001-2-03: mudança de status do vínculo com o hospital ---

  describe('mudança de status de vínculo', () => {
    beforeEach(() => {
      spyOnProperty(navigator, 'language', 'get').and.returnValue('pt-BR');
    });

    const link = (id: number, linkStatus: 'approved' | 'rejected' | 'revoked', hospitalId = 1): Notification =>
      notification(id, {
        author: undefined,
        description: `Texto ${linkStatus} do hospital`,
        hospital: { id: hospitalId, name: 'Hospital Vila Nova Star' },
        linkStatus,
        mentioned: undefined,
        patient: undefined,
        type: 'hospital_link_status_change',
      });

    async function open(items: Notification[]): Promise<HTMLElement[]> {
      await configureStore({ status: 'success', pendingItems: items });
      createComponent();
      // eslint-disable-next-line jasmine/no-unsafe-spy
      spyOn(router, 'navigate').and.resolveTo(true);

      return Array.from(fixture.nativeElement.querySelectorAll('app-card-notify')) as HTMLElement[];
    }

    it('card identifica o hospital e mostra o status em texto, sem paciente nem resolver', async () => {
      const cards = await open([link(1, 'approved'), link(2, 'rejected'), link(3, 'revoked')]);

      expect(cards.map(c => c.querySelector('.card-notify__name')?.textContent?.trim())).toEqual([
        'Hospital Vila Nova Star',
        'Hospital Vila Nova Star',
        'Hospital Vila Nova Star',
      ]);

      expect(cards.map(c => c.querySelector('.card-notify__specialty')?.textContent?.trim())).toEqual([
        jasmine.stringMatching(/^Vínculo aprovado/),
        jasmine.stringMatching(/^Vínculo recusado/),
        jasmine.stringMatching(/^Vínculo revogado/),
      ] as unknown as string[]);

      expect(cards[0].querySelector('.card-notify__kind-label')?.textContent?.trim()).toBe('Vínculo com hospital');
      expect(cards[0].querySelector('.card-notify__patient')).toBeNull();

      expect(cards[0].textContent).toContain('Texto approved do hospital');
      expect(fixture.componentInstance.isParticipant(link(1, 'approved'))).toBeFalse();
    });

    it('aprovado: seleciona o hospital e abre o Painel (Home)', async () => {
      const cards = await open([link(1, 'approved')]);
      const context = TestBed.inject(HospitalContextService);

      spyOn(context, 'select');
      (cards[0].querySelector('article') as HTMLElement).click();
      await fixture.whenStable();

      expect(context.select).toHaveBeenCalledWith(1);
      expect(router.navigate).toHaveBeenCalledWith(['/home']);
    });

    it('aprovado em hospital ainda não carregado: recarrega os vínculos antes de selecionar', async () => {
      await open([link(1, 'approved', 7)]);
      const context = TestBed.inject(HospitalContextService);

      spyOn(context, 'load').and.resolveTo();
      spyOn(context, 'select');
      await (
        fixture.componentInstance as unknown as { onNotificationClick(n: Notification): Promise<void> }
      ).onNotificationClick(link(1, 'approved', 7));

      expect(context.load).toHaveBeenCalledWith();
      expect(context.select).toHaveBeenCalledWith(7);
      expect(router.navigate).toHaveBeenCalledWith(['/home']);
    });

    it('tolera aviso sem respostas, sem hospital e sem status', async () => {
      const bare = { ...link(1, 'approved'), hospital: undefined, linkStatus: undefined, replies: undefined };
      const cards = await open([bare as unknown as Notification]);

      expect(cards[0].querySelector('.card-notify__name')?.textContent?.trim()).toBe('');
      expect(fixture.componentInstance.isParticipant(bare as unknown as Notification)).toBeFalse();

      (cards[0].querySelector('article') as HTMLElement).click();
      await fixture.whenStable();

      expect(router.navigate).toHaveBeenCalledWith(['/hospital-links']);
    });

    it('mensagem de paciente sem respostas informadas não quebra o card', async () => {
      const cards = await open([{ ...notification(5), replies: undefined } as unknown as Notification]);

      expect(cards.length).toBe(1);
      expect(
        fixture.componentInstance.isParticipant({ ...notification(5), replies: undefined } as unknown as Notification),
      ).toBeTrue();
    });

    it('mensagem sem autor mostra subtítulo vazio e toque vai ao paciente', async () => {
      const cards = await open([notification(6, { author: undefined })]);

      expect(cards[0].querySelector('.card-notify__name')?.textContent?.trim()).toBe('');
      (cards[0].querySelector('article') as HTMLElement).click();

      expect(router.navigate).toHaveBeenCalledWith(['/patients', 106]);
    });

    for (const status of ['rejected', 'revoked'] as const) {
      it(`${status}: abre a tela de vínculos`, async () => {
        const cards = await open([link(1, status)]);

        (cards[0].querySelector('article') as HTMLElement).click();
        await fixture.whenStable();

        expect(router.navigate).toHaveBeenCalledWith(['/hospital-links']);
      });
    }
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

  describe('resolver thread (FR-012 a FR-014)', () => {
    const me = { id: 4, name: 'Michelle Franklin', specialty: 'Nutróloga', photoUrl: null };
    const other = { id: 9, name: 'Outro', specialty: 'Médico', photoUrl: null };
    const resolveButtons = (): NodeListOf<HTMLElement> =>
      (fixture.nativeElement as HTMLElement).querySelectorAll('button[aria-label="Resolver"]');

    it('todo card listado tem o indicador (a API só lista as notificações do próprio profissional)', async () => {
      await configureStore({
        status: 'success',
        pendingItems: [
          notification(1, { author: me, mentioned: [] }),
          notification(2),
          notification(4, { mentioned: [other] }),
        ],
      });
      createComponent();
      fixture.detectChanges();

      expect(resolveButtons().length).toBe(3);
    });

    it('sem conexão o indicador fica desabilitado e nada é despachado', async () => {
      await configureStore({ status: 'success', pendingItems: [notification(1)] });
      createComponent();
      const online = TestBed.inject(ConnectivityService).online;

      online.set(false);
      fixture.detectChanges();
      spyOn(store, 'dispatch');

      expect(resolveButtons()[0].hasAttribute('disabled')).toBeTrue();
      fixture.componentInstance.onResolveClick(1);
      fixture.componentInstance.onConfirmResolve();

      expect(store.dispatch).not.toHaveBeenCalled();
      online.set(true);
    });

    it('confirmar sem diálogo aberto não despacha', async () => {
      await configureStore({ status: 'success' });
      createComponent();
      spyOn(store, 'dispatch');

      fixture.componentInstance.onConfirmResolve();

      expect(store.dispatch).not.toHaveBeenCalled();
    });

    it('falha ao resolver mostra a mensagem de erro em texto', async () => {
      await configureStore({
        status: 'success',
        pendingItems: [notification(1)],
        resolveErrorMessage: 'Não foi possível resolver a notificação.',
      });
      createComponent();
      fixture.detectChanges();

      expect((fixture.nativeElement as HTMLElement).querySelector('[role="alert"]')?.textContent).toContain(
        'Não foi possível resolver',
      );
    });
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
