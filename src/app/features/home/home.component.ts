import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  Injector,
  OnDestroy,
  OnInit,
  Signal,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';

import { AvatarComponent, type AvatarType } from '../../shared/components/avatar/avatar.component';
import { BadgeComponent } from '../../shared/components/badge/badge.component';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { CardNotifyComponent } from '../../shared/components/card-notify/card-notify.component';
import { CardPatientsComponent } from '../../shared/components/card-patients/card-patients.component';
import { IconButtonComponent } from '../../shared/components/icon-button/icon-button.component';
import { PageContainerComponent } from '../../shared/components/page-container/page-container.component';
import { TagComponent } from '../../shared/components/tag/tag.component';
import { PhIconComponent } from '../../shared/icons/ph-icon/ph-icon.component';
import { AiAssistantService } from '../../shared/services/ai-assistant.service';
import { ScreenActionsService } from '../../shared/services/screen-actions.service';
import { HOME_CONTEXT } from '../../shared/services/screen-contexts';
import { formatRelativeTime } from '../../shared/utils/relative-time';
import { ManagerAccessReader } from '../hospital-team/hospital-invite-port';
import { ChangeLocationAction } from '../patient-hub/change-location/change-location.action';
import { MoveBedAction } from '../patient-hub/move-bed/move-bed.action';
import { HospitalEditorComponent } from '../shift/hospital-editor.component';
import { shiftFailureMessage, ShiftService } from '../shift/shift.service';
import { HomeErrorComponent } from './components/home-error/home-error.component';
import { HomeSkeletonComponent } from './components/home-skeleton/home-skeleton.component';
import { DailyPatientsSource, DailyPatientsSummary } from './daily-patients';
import { HomeNotification } from './home.models';
import { HomeData, HomeDataSource } from './home-data-source';
import {
  HomeNotificationsSource,
  NOTIFICATIONS_BATCH_SIZE,
  sortNotificationsNewestFirst,
} from './home-notifications-source';
import { type HomeLoadStatus, HomeStateService } from './home-state.service';
import { HospitalContextService } from './hospital-context.service';
import { LinkRevocationChecker } from './link-revocation-checker';
import { ProfessionalProfileReader } from './professional-profile';
import { UnreadNotificationsReader } from './unread-notifications-reader';

/** Estado de carregamento da área abaixo do cabeçalho. */
export type HomeLoadState = HomeLoadStatus;

function formatTodayLabel(): string {
  const formatter = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', weekday: 'long' });
  const parts = formatter.formatToParts(new Date());
  const partValue = (type: string): string => parts.find(p => p.type === type)?.value ?? '';
  const weekday = partValue('weekday');
  const capitalizedWeekday = weekday.charAt(0).toUpperCase() + weekday.slice(1);

  return `${capitalizedWeekday}, ${partValue('day')} de ${partValue('month')}`; // Figma v2: "Domingo, 28 de maio"
}

/**
 * Tela Home — layout validado contra o Figma (mobile `4360:7018`, desktop
 * `4333:5876`, erro `4311:8624`): cabeçalho (avatar + sino/badge), tag do
 * hospital, título "Tarefas diárias do hospital", skeleton, erro genérico e a
 * grade de cards (`app-card-patients` + `app-card-notify`).
 *
 * O comportamento vem das stories do EP-003: estado de carregamento
 * (`HomeStateService`), hospital em contexto (`HospitalContextService`), erro com
 * nova tentativa e cache, contagem de pacientes do dia e sino com contador de
 * não lidas. Todas as fontes de dados são fronteiras provisórias (ver
 * `app.config.ts`) até as integrações reais existirem.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AvatarComponent,
    BadgeComponent,
    ButtonComponent,
    CardNotifyComponent,
    CardPatientsComponent,
    HomeErrorComponent,
    HomeSkeletonComponent,
    IconButtonComponent,
    PageContainerComponent,
    PhIconComponent,
    TagComponent,
  ],
  selector: 'app-home',
  styleUrl: './home.component.scss',
  templateUrl: './home.component.html',
})
export class HomeComponent implements OnInit, OnDestroy {
  // public: o spec abre o assistente e dispara o estado diretamente na instância.
  readonly aiAssistant = inject(AiAssistantService);
  /** Turno de trabalho (geolocalização): iniciar, retomar e ver quem já está em turno no hospital. */
  readonly shift = inject(ShiftService);
  /** Motivo de o turno não ter começado (fora do raio, sem localização cadastrada...), em texto. */
  readonly shiftMessage = signal<string | null>(null);
  readonly shiftBusy = signal(false);
  /** Estado de carregamento inicial, compartilhado com as stories irmãs via HomeStateService. */
  readonly loadState = computed<HomeLoadState>(() => {
    const hospitals = this.context.status();

    if (hospitals === 'error' || this.state.status() === 'error') {
      return 'error';
    }

    return hospitals === 'loading' ? 'loading' : this.state.status();
  });
  /** Último carregamento bem-sucedido da sessão (cache em memória). */
  readonly data = signal<HomeData | null>(null);
  /** Dados exibidos podem estar desatualizados; troca de hospital indisponível. */
  readonly stale = signal(false);
  readonly loading = signal(false);
  readonly controlsEnabled = computed(() => !this.stale());
  /** Notificações da grade (após o card fixo), da mais recente para a mais antiga (US-003-3-01). */
  readonly notifications = signal<readonly HomeNotification[]>([]);

  /** Cursor do próximo lote; `null` quando o fim da lista foi atingido (RN-03). */
  readonly nextCursor = signal<string | null>(null);
  readonly hasMore = computed(() => this.nextCursor() !== null);
  /** O primeiro lote do hospital em contexto já respondeu (base do estado vazio — US-003-3-05). */
  readonly feedLoaded = signal(false);
  readonly isFeedEmpty = computed(() => this.feedLoaded() && this.notifications().length === 0);

  protected readonly context = inject(HospitalContextService);
  protected readonly unreadCount = signal(0);
  protected readonly summary = signal<DailyPatientsSummary | null>(null);
  protected readonly listOpen = signal(false);
  protected readonly listId = 'home-hospital-list';

  // Perfil provisório até a story de sessão (ver ProfessionalProfileReader).
  protected readonly professionalName: string;
  protected readonly professionalTitle = 'Dra.';
  protected readonly professionalPhotoUrl: string;
  protected readonly professionalAvatarType: Signal<AvatarType>;
  protected readonly todayLabel = computed(() => formatTodayLabel());
  protected readonly selectedHospitalName = computed(() => this.context.selected()?.name ?? '');

  private readonly state = inject(HomeStateService);
  private readonly router = inject(Router);
  private readonly reader = inject(UnreadNotificationsReader);
  private readonly source = inject(HomeDataSource);
  private readonly patients = inject(DailyPatientsSource);
  private readonly notificationsSource = inject(HomeNotificationsSource);
  private readonly injector = inject(Injector);
  private readonly screenActions = inject(ScreenActionsService);
  private readonly moveBed = inject(MoveBedAction);
  private readonly changeLocation = inject(ChangeLocationAction);
  private readonly managerAccess = inject(ManagerAccessReader, { optional: true });
  private readonly revocation = inject(LinkRevocationChecker);
  private readonly scrollSentinel = viewChild<ElementRef<HTMLElement>>('scrollSentinel');
  private intersectionObserver?: IntersectionObserver;
  private feedGeneration = 0;
  private loadingMore = false;

  constructor() {
    effect(onCleanup => {
      onCleanup(this.screenActions.registerContext(HOME_CONTEXT));
    });

    const profile = inject(ProfessionalProfileReader).read();

    this.professionalName = profile.name;
    this.professionalPhotoUrl = profile.photoUrl ?? '';
    this.professionalAvatarType = signal<AvatarType>(this.professionalPhotoUrl ? 'photo' : 'user');

    // US-002-2-02: pedido de mudança de leito citando o paciente pelo nome (hospital ativo).
    effect(onCleanup => {
      const hospitalId = (): number | undefined => this.context.selected()?.id;

      onCleanup(
        this.screenActions.register([
          this.moveBed.buildByName(hospitalId),
          this.changeLocation.buildByName(hospitalId),
        ]),
      );
    });

    // Atalho do gestor (FT-009-1): convidar diretamente um profissional já cadastrado.
    if (this.managerAccess?.isManager()) {
      effect(onCleanup => {
        onCleanup(
          this.screenActions.register([
            {
              id: 'invite-professional',
              label: 'Convidar profissional',
              navigate: (): void => void this.router.navigate(['/hospital-team', 'invite']),
            },
            {
              id: 'revoke-professional-access',
              label: 'Revogar acesso de profissional',
              navigate: (): void => void this.router.navigate(['/hospital-team', 'access']),
            },
          ]),
        );
      });
    }

    effect(() => {
      const hospitalId = this.context.selected()?.id;

      if (hospitalId !== undefined) {
        void this.shift.refresh(hospitalId);
      }
    });

    effect(() => {
      const hospitalId = this.context.selected()?.id;

      if (hospitalId === undefined) {
        this.summary.set(null);
        this.resetFeed();
      } else {
        void this.loadSummary(hospitalId);
        void this.loadFirstBatch(hospitalId);
      }
    });

    // Observa o sentinel de fim de lista (só existe enquanto há mais lotes). Refaz a
    // observação a cada lote anexado: o IntersectionObserver só avisa quando a
    // visibilidade MUDA, e em telas grandes o sentinel segue visível depois do lote.
    effect(
      () => {
        const element = this.scrollSentinel()?.nativeElement;

        this.notifications();
        this.intersectionObserver?.disconnect();
        if (!element || typeof IntersectionObserver === 'undefined') {
          return;
        }
        this.intersectionObserver = new IntersectionObserver(entries => {
          if (entries.some(entry => entry.isIntersecting)) {
            void this.loadNextBatch();
          }
        });
        this.intersectionObserver.observe(element);
      },
      { injector: this.injector },
    );
  }

  ngOnDestroy(): void {
    this.intersectionObserver?.disconnect();
  }

  /** Carrega e anexa o próximo lote; no-op sem mais itens, em andamento ou offline com dados exibidos. */
  async loadNextBatch(): Promise<void> {
    const hospitalId = this.context.selected()?.id;
    const cursor = this.nextCursor();

    if (hospitalId === undefined || cursor === null || this.loadingMore || this.stale()) {
      return;
    }
    const generation = this.feedGeneration;

    this.loadingMore = true;
    try {
      const page = await this.notificationsSource.loadPage(hospitalId, cursor, NOTIFICATIONS_BATCH_SIZE);

      if (generation === this.feedGeneration) {
        const known = new Set(this.notifications().map(n => n.id));

        this.notifications.update(current => [
          ...current,
          ...sortNotificationsNewestFirst(page.items.filter(n => !known.has(n.id))),
        ]);
        this.nextCursor.set(page.nextCursor);
      }
    } catch {
      // Falha em lote adicional preserva os cards e o cursor (nova tentativa ao rolar de novo).
    } finally {
      if (generation === this.feedGeneration) {
        this.loadingMore = false;
      }
    }
  }

  /**
   * "Iniciar turno de trabalho": só dentro do raio do hospital; depois leva à lista de pacientes para escolher quem
   * visitar. Com o turno já iniciado, o botão vira "Retomar turno de trabalho" e leva direto à lista.
   */
  async onShiftClick(): Promise<void> {
    const hospitalId = this.context.selected()?.id;

    if (hospitalId === undefined || this.shiftBusy()) {
      return;
    }
    this.shiftMessage.set(null);
    if (this.shift.mine() !== null) {
      void this.router.navigate(['/patients'], { queryParams: { turno: '1' } });

      return;
    }
    this.shiftBusy.set(true);
    try {
      const result = await this.shift.start(hospitalId);

      if (result.ok) {
        void this.router.navigate(['/patients'], { queryParams: { turno: '1' } });
      } else {
        this.shiftMessage.set(shiftFailureMessage(result));
      }
    } finally {
      this.shiftBusy.set(false);
    }
  }

  /** "Cadastrar hospital": abre o cadastro conversacional no painel lateral. */
  onRegisterHospital(): void {
    this.aiAssistant.openAction({
      editor: {
        component: HospitalEditorComponent,
        description:
          'Informe o nome e o endereço do hospital e, estando nele, use a minha localização atual. Com a localização ' +
          'cadastrada, os profissionais podem iniciar o turno de trabalho ao chegar.',
        hint: 'Você também pode enviar via áudio.',
        inputs: {
          initialName: '',
          saved: (hospitalId: number): void => {
            this.shiftMessage.set(null);
            void this.shift.refresh(hospitalId);
          },
        },
        title: 'Cadastrar hospital',
      },
      id: 'hospital-registration',
      label: 'Cadastrar hospital',
    });
  }

  async ngOnInit(): Promise<void> {
    void this.refresh();
    this.unreadCount.set(await this.reader.countUnread());
  }

  async refresh(): Promise<void> {
    // Falha ao carregar os hospitais vinculados também cai no erro da Home: "tentar de novo" recarrega.
    if (this.context.status() === 'error') {
      void this.context.load();
    }
    if (this.loading()) {
      return;
    }
    this.loading.set(true);
    try {
      this.data.set(await this.source.load());
      this.stale.set(false);
      this.state.setStatus('success');
    } catch {
      if (this.data() === null) {
        this.state.setStatus('error');
      } else {
        this.stale.set(true);
      }
    } finally {
      this.loading.set(false);
    }
  }

  // public: exercitados diretamente pelo spec.
  /** US-003-3-04 RN-01: tocar em qualquer ponto do card abre o detalhe daquela notificação. */
  onViewNotificationDetail(id: number): void {
    void this.router.navigate(['/notifications', id]);
  }

  onViewAllNotifications(): void {
    // A tela de Notificações aceita `hospitalId` numérico na query; sem ele resolve
    // o hospital sozinha (mesmo default da Home).
    const hospitalId = this.context.selected()?.id;

    void this.router.navigate(['/notifications'], {
      queryParams: hospitalId === undefined ? {} : { hospitalId },
    });
  }

  /** Card de pacientes do dia: leva à listagem de pacientes. */
  onViewPatients(): void {
    void this.router.navigate(['/patients']);
  }

  formatTime(isoDate: string): string {
    return formatRelativeTime(isoDate); // Figma: "Hoje, 10:42"
  }

  protected bellLabel(): string {
    const count = this.unreadCount();

    return count > 0 ? `Notificações, ${count} não lidas` : 'Notificações';
  }

  protected onTrigger(): void {
    if (this.context.canSwitch()) {
      this.listOpen.update(open => !open);
    }
  }

  protected choose(id: number): void {
    this.context.select(id);
    this.listOpen.set(false);
  }

  protected onOptionKeydown(event: Event, index: number, id: number): void {
    const key = (event as KeyboardEvent).key;
    const options = (event.currentTarget as HTMLElement).parentElement?.children;

    if (key === 'Enter' || key === ' ') {
      event.preventDefault();
      this.choose(id);
    } else if (key === 'Escape') {
      this.listOpen.set(false);
    } else if ((key === 'ArrowDown' || key === 'ArrowUp') && options) {
      event.preventDefault();
      const next = key === 'ArrowDown' ? index + 1 : index - 1;

      (options[(next + options.length) % options.length] as HTMLElement).focus();
    }
  }

  private resetFeed(): void {
    this.feedGeneration++;
    this.loadingMore = false;
    this.notifications.set([]);
    this.nextCursor.set(null);
    this.feedLoaded.set(false);
  }

  private async loadFirstBatch(hospitalId: number): Promise<void> {
    this.resetFeed();
    const generation = this.feedGeneration;

    try {
      const page = await this.notificationsSource.loadPage(hospitalId, null, NOTIFICATIONS_BATCH_SIZE);

      if (generation === this.feedGeneration) {
        this.notifications.set(sortNotificationsNewestFirst(page.items));
        this.feedLoaded.set(true);
        this.nextCursor.set(page.nextCursor);
      }
    } catch (failure) {
      // 403 também é "sem permissão": só vira revogação se o vínculo constar como REVOGADO (US-001-2-04, Cenário 2).
      if ((failure as { status?: number }).status === 403 && (await this.revocation.isRevoked(hospitalId))) {
        this.context.revokeAccess(hospitalId);
      } else if (generation === this.feedGeneration) {
        // Falha do primeiro lote: sem erro genérico (isso é do `refresh()`); sinaliza dados desatualizados.
        this.stale.set(true);
      }
    }
  }

  private async loadSummary(hospitalId: number): Promise<void> {
    const summary = await this.patients.loadForDay(hospitalId, new Date());

    if (this.context.selected()?.id === hospitalId) {
      this.summary.set(summary);
    }
  }
}
