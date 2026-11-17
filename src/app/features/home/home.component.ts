import { ChangeDetectionStrategy, Component, computed, effect, inject, OnInit, Signal, signal } from '@angular/core';
import { Router } from '@angular/router';

import { AvatarComponent, type AvatarType } from '../../shared/components/avatar/avatar.component';
import { BadgeComponent } from '../../shared/components/badge/badge.component';
import { CardNotifyComponent } from '../../shared/components/card-notify/card-notify.component';
import { CardPatientsComponent } from '../../shared/components/card-patients/card-patients.component';
import { IconButtonComponent } from '../../shared/components/icon-button/icon-button.component';
import { PageContainerComponent } from '../../shared/components/page-container/page-container.component';
import { TagComponent } from '../../shared/components/tag/tag.component';
import { AiAssistantService } from '../../shared/services/ai-assistant.service';
import { HomeErrorComponent } from './components/home-error/home-error.component';
import { HomeSkeletonComponent } from './components/home-skeleton/home-skeleton.component';
import { DailyPatientsSource, DailyPatientsSummary } from './daily-patients';
import { HomeNotification } from './home.models';
import { HomeData, HomeDataSource } from './home-data-source';
import { type HomeLoadStatus, HomeStateService } from './home-state.service';
import { HospitalContextService } from './hospital-context.service';
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

  return `${capitalizedWeekday} - ${partValue('day')} de ${partValue('month')}`;
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
    CardNotifyComponent,
    CardPatientsComponent,
    HomeErrorComponent,
    HomeSkeletonComponent,
    IconButtonComponent,
    PageContainerComponent,
    TagComponent,
  ],
  selector: 'app-home',
  styleUrl: './home.component.scss',
  templateUrl: './home.component.html',
})
export class HomeComponent implements OnInit {
  // public: o spec abre o assistente e dispara o estado diretamente na instância.
  readonly aiAssistant = inject(AiAssistantService);
  /** Estado de carregamento inicial, compartilhado com as stories irmãs via HomeStateService. */
  readonly loadState = inject(HomeStateService).status;
  /** Último carregamento bem-sucedido da sessão (cache em memória). */
  readonly data = signal<HomeData | null>(null);
  /** Dados exibidos podem estar desatualizados; troca de hospital indisponível. */
  readonly stale = signal(false);
  readonly loading = signal(false);
  readonly controlsEnabled = computed(() => !this.stale());
  /** Notificações da grade (após o card fixo). A fonte real chega com a US-003-3-01. */
  readonly notifications = signal<readonly HomeNotification[]>([]);

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

  constructor() {
    const profile = inject(ProfessionalProfileReader).read();

    this.professionalName = profile.name;
    this.professionalPhotoUrl = profile.photoUrl ?? '';
    this.professionalAvatarType = signal<AvatarType>(this.professionalPhotoUrl ? 'photo' : 'user');

    effect(() => {
      const hospitalId = this.context.selected()?.id;

      if (hospitalId === undefined) {
        this.summary.set(null);
      } else {
        void this.loadSummary(hospitalId);
      }
    });
  }

  async ngOnInit(): Promise<void> {
    void this.refresh();
    this.unreadCount.set(await this.reader.countUnread());
  }

  async refresh(): Promise<void> {
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
  onViewNotificationDetail(_: number): void {
    // Rota de detalhe registrada na US-003-3-04 — fora do escopo desta story.
  }

  onViewAllNotifications(): void {
    // A tela de Notificações aceita `hospitalId` numérico na query; sem ele resolve
    // o hospital sozinha (mesmo default da Home). Os ids provisórios daqui não são
    // numéricos, então só repassa quando for.
    const hospitalId = this.context.selected()?.id;

    void this.router.navigate(['/notifications'], {
      queryParams: hospitalId !== undefined && /^\d+$/.test(hospitalId) ? { hospitalId } : {},
    });
  }

  onViewPatients(): void {
    // Navega para a tela "Listagem de Pacientes" — especificação independente, fora de escopo.
  }

  formatTime(isoDate: string): string {
    return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(isoDate));
  }

  protected bellLabel(): string {
    const count = this.unreadCount();

    return count > 0 ? `Notificações, ${count} não lidas` : 'Notificações';
  }

  protected onTrigger(): void {
    if (this.context.canSwitch) {
      this.listOpen.update(open => !open);
    }
  }

  protected choose(id: string): void {
    this.context.select(id);
    this.listOpen.set(false);
  }

  protected onOptionKeydown(event: Event, index: number, id: string): void {
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

  private async loadSummary(hospitalId: string): Promise<void> {
    const summary = await this.patients.loadForDay(hospitalId, new Date());

    if (this.context.selected()?.id === hospitalId) {
      this.summary.set(summary);
    }
  }
}
