import { provideHttpClient } from '@angular/common/http';
import { signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { Actions } from '@ngrx/effects';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { Subject } from 'rxjs';

import { AudioTranscriber } from '../../shared/services/audio-transcriber';
import { ViewportBreakpointService } from '../../shared/services/viewport-breakpoint.service';
import { HospitalContextService } from '../home/hospital-context.service';
import { LinkedHospitalsReader } from '../home/linked-hospitals';
import { NotificationsComponent } from './notifications.component';
import { Notification } from './notifications.models';
import { NotificationsActions } from './state/notifications.actions';
import { initialNotificationsState, NotificationsState } from './state/notifications.reducer';

/** Métodos protegidos que a tela expõe ao template e que os testes acionam diretamente. */
interface Internals {
  onAudio(audio: Blob): Promise<void>;
  transcribeError(): string | null;
  cardAnswerError(id: number): string | null;
  onRetry(): void;
  onDraftInput(text: string): void;
  onConfirmDiscard(): void;
  onCancelDiscard(): void;
  onTouchStart(event: TouchEvent, container: HTMLElement): void;
  onTouchEnd(event: TouchEvent): void;
  toReplies(notification: Notification): { authorName: string; text: string; time: string }[];
}

/** Transcritor controlável: devolve o texto de `result` ou falha quando `result` é `null`. */
class FakeTranscriber extends AudioTranscriber {
  result: string | null = 'texto falado';

  transcribe(): Promise<string> {
    return this.result === null ? Promise.reject(new Error('x')) : Promise.resolve(this.result);
  }
}

const notification = (id: number): Notification => ({
  author: { id: 1, name: 'Jairo', photoUrl: null, specialty: 'Enfermeiro' },
  createdAt: '2026-11-17T10:30:00',
  description: 'Descrição ' + id,
  id,
  patient: { id: 10, name: 'José' },
  read: false,
  replies: [
    {
      author: { id: 2, name: 'Ana', photoUrl: null, specialty: 'Nutróloga' },
      createdAt: '2026-11-17T11:45:00',
      id: 1,
      text: 'Ok',
    },
  ],
  replyCount: 1,
});

describe('NotificationsComponent — rolagem, rascunho e gestos', () => {
  let fixture: ComponentFixture<NotificationsComponent>;
  let store: MockStore;
  let actions: Subject<{ type: string }>;
  let dispatch: jasmine.Spy;
  let transcriber: FakeTranscriber;
  const touch = (y: number): TouchEvent =>
    ({ changedTouches: [{ clientY: y }], touches: [{ clientY: y }] }) as unknown as TouchEvent;
  /** Houve `draftChanged` depois de `before` chamadas (o campo do card despacha um vazio ao abrir). */
  const draftedSince = (before: number): boolean =>
    dispatch.calls
      .allArgs()
      .slice(before)
      .some(([a]) => a.type === NotificationsActions.draftChanged.type);
  const internals = (): Internals => fixture.componentInstance as unknown as Internals;
  const container = (scrollTop: number): HTMLElement => ({ scrollTop }) as HTMLElement;

  async function create(overrides: Partial<NotificationsState> = {}): Promise<void> {
    actions = new Subject();
    transcriber = new FakeTranscriber();
    await TestBed.configureTestingModule({
      imports: [NotificationsComponent],
      providers: [
        provideHttpClient(),
        { provide: AudioTranscriber, useValue: transcriber },
        provideMockStore({ initialState: { notifications: { ...initialNotificationsState, ...overrides } } }),
        { provide: Actions, useValue: actions },
        { provide: ViewportBreakpointService, useValue: { isDesktop: signal(true).asReadonly() } },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: { get: (): null => null } } } },
        {
          provide: LinkedHospitalsReader,
          useValue: {
            read: (): Promise<{ id: number; name: string }[]> =>
              Promise.resolve([{ id: 1, name: 'Hospital Vila Nova Star' }]),
          },
        },
      ],
    }).compileComponents();
    store = TestBed.inject(MockStore);
    await TestBed.inject(HospitalContextService).load();
    fixture = TestBed.createComponent(NotificationsComponent);
    fixture.detectChanges();
    // Helper de teste: o espião vale só para o teste que chamou create().
    // eslint-disable-next-line jasmine/no-unsafe-spy
    dispatch = spyOn(store, 'dispatch').and.callThrough();
  }

  describe('infinite scroll', () => {
    let notify: (entries: { isIntersecting: boolean }[]) => void;
    let original: typeof IntersectionObserver;

    beforeEach(() => {
      original = window.IntersectionObserver;
      window.IntersectionObserver = function (cb: typeof notify): unknown {
        notify = cb;

        return { disconnect: (): void => undefined, observe: (): void => undefined };
      } as unknown as typeof IntersectionObserver;
    });

    afterEach(() => {
      window.IntersectionObserver = original;
    });

    it('pede o próximo lote quando o fim da lista aparece e ainda há mais', async () => {
      await create({ pendingCursor: 'c1', pendingItems: [notification(1)], status: 'success' });
      notify([{ isIntersecting: true }]);

      expect(dispatch).toHaveBeenCalledWith(NotificationsActions.loadNextBatchRequested());
    });

    it('não pede nada se o fim da lista não está visível ou se já está carregando', async () => {
      await create({ pendingCursor: 'c1', pendingItems: [notification(1)], status: 'success' });
      notify([{ isIntersecting: false }]);

      expect(dispatch).not.toHaveBeenCalled();

      store.setState({
        notifications: { ...initialNotificationsState, pendingCursor: 'c1', status: 'loading-more-pending' },
      });
      fixture.detectChanges();
      notify([{ isIntersecting: true }]);

      expect(dispatch).not.toHaveBeenCalled();
    });
  });

  describe('erro, rascunho e descarte', () => {
    it('tentar de novo usa o hospital em contexto; sem hospital não faz nada', async () => {
      await create({ hospitalId: 4, status: 'error' });
      internals().onRetry();

      expect(dispatch).toHaveBeenCalledWith(NotificationsActions.retryRequested({ hospitalId: 4 }));

      dispatch.calls.reset();
      store.setState({ notifications: { ...initialNotificationsState, hospitalId: null, status: 'error' } });
      internals().onRetry();

      expect(dispatch).not.toHaveBeenCalled();
    });

    it('digitar o rascunho só vale com uma resposta em andamento', async () => {
      await create({ answeringId: 5, pendingItems: [notification(5)], status: 'success' });
      internals().onDraftInput('oi');

      expect(dispatch).toHaveBeenCalledWith(NotificationsActions.draftChanged({ notificationId: 5, text: 'oi' }));

      dispatch.calls.reset();
      store.setState({ notifications: { ...initialNotificationsState, answeringId: null, status: 'success' } });
      internals().onDraftInput('x');

      expect(dispatch).not.toHaveBeenCalled();
    });

    it('confirmar e cancelar o descarte despacham as ações correspondentes', async () => {
      await create({ status: 'success' });
      internals().onConfirmDiscard();
      internals().onCancelDiscard();

      expect(dispatch).toHaveBeenCalledWith(NotificationsActions.answerDiscarded());
      expect(dispatch).toHaveBeenCalledWith(NotificationsActions.discardConfirmationCancelled());
    });

    it('Cancelar fecha o campo de resposta e despacha o cancelamento', async () => {
      await create({ answeringId: 5, pendingItems: [notification(5)], status: 'success' });
      fixture.componentInstance.onCancelAnswer();

      expect(dispatch).toHaveBeenCalledWith(NotificationsActions.answerCancelled());
    });

    it('áudio gravado vira texto no campo (revisar antes de enviar); acrescenta ao que já foi digitado', async () => {
      await create({ answeringId: 5, draftText: 'Oi', pendingItems: [notification(5)], status: 'success' });
      await internals().onAudio(new Blob(['a']));

      expect(dispatch).toHaveBeenCalledWith(
        NotificationsActions.draftChanged({ notificationId: 5, text: 'Oi texto falado' }),
      );
    });

    it('áudio sem texto devolvido não altera o campo', async () => {
      await create({ answeringId: 5, pendingItems: [notification(5)], status: 'success' });
      transcriber.result = '';
      const before = dispatch.calls.count();

      await internals().onAudio(new Blob(['a']));

      expect(draftedSince(before)).toBeFalse();
    });

    it('sem transcrição disponível: aviso no campo em edição, e o usuário segue digitando', async () => {
      await create({ answeringId: 5, pendingItems: [notification(5)], status: 'success' });
      transcriber.result = null;
      await internals().onAudio(new Blob(['a']));

      expect(internals().cardAnswerError(5)).toContain('Não foi possível transcrever');
      expect(internals().cardAnswerError(6)).toBeNull();
    });

    it('áudio sem resposta em andamento é ignorado', async () => {
      await create({ pendingItems: [notification(5)], status: 'success' });
      const before = dispatch.calls.count();

      await internals().onAudio(new Blob(['a']));

      expect(draftedSince(before)).toBeFalse();
    });

    it('notificação com rascunho guardado aparece como "draft" com o texto, mesmo fora da edição', async () => {
      await create({ drafts: { 5: 'Alinhado' }, pendingItems: [notification(5)], status: 'success' });
      const card = fixture.nativeElement.querySelector('app-card-notify') as HTMLElement;

      expect(card.querySelector('.card-notify--draft')).not.toBeNull();
      expect(card.textContent).toContain('Alinhado');
      expect(card.textContent).toContain('Rascunho · não enviado');
    });

    it('converte as respostas para o card com autor e horário', async () => {
      await create({ status: 'success' });
      const [reply] = internals().toReplies(notification(1));

      expect([reply.authorName, reply.text]).toEqual(['Ana', 'Ok']);
      expect(reply.time).toMatch(/\d{2}:\d{2}$/); // "Hoje, 10:42" / "Ontem, 10:42"
    });
  });

  describe('puxar para atualizar', () => {
    it('arrastar mais de 80px a partir do topo atualiza a lista', async () => {
      await create({ status: 'success' });
      internals().onTouchStart(touch(10), container(0));
      internals().onTouchEnd(touch(200));

      expect(dispatch).toHaveBeenCalledWith(NotificationsActions.refreshRequested());
    });

    it('arrastes curtos, fora do topo ou sem início não atualizam', async () => {
      await create({ status: 'success' });
      internals().onTouchStart(touch(10), container(0));
      internals().onTouchEnd(touch(60));
      internals().onTouchStart(touch(10), container(50));
      internals().onTouchEnd(touch(300));
      internals().onTouchEnd(touch(300));

      expect(dispatch).not.toHaveBeenCalled();
    });

    it('com rascunho não enviado pede confirmação e só atualiza depois que o descarte é confirmado', async () => {
      await create({ answeringId: 5, pendingItems: [notification(5)], status: 'success' });
      internals().onTouchStart(touch(10), container(0));
      internals().onTouchEnd(touch(300));

      expect(dispatch).toHaveBeenCalledWith(NotificationsActions.discardConfirmationRequested());
      expect(dispatch).not.toHaveBeenCalledWith(NotificationsActions.refreshRequested());

      actions.next(NotificationsActions.answerDiscarded());

      expect(dispatch).toHaveBeenCalledWith(NotificationsActions.refreshRequested());
    });
  });
});
