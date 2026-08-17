import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  Injector,
  OnDestroy,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';

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
import { HomeActions } from './state/home.actions';
import {
  selectErrorMessage,
  selectHospitals,
  selectNextCursor,
  selectNotifications,
  selectSelectedHospitalId,
  selectStale,
  selectStatus,
  selectSummary,
} from './state/home.reducer';

function formatTodayLabel(): string {
  const formatter = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', weekday: 'long' });
  const parts = formatter.formatToParts(new Date());
  const partValue = (type: string): string => parts.find(p => p.type === type)?.value ?? '';
  const weekday = partValue('weekday');
  const capitalizedWeekday = weekday.charAt(0).toUpperCase() + weekday.slice(1);

  return `${capitalizedWeekday} - ${partValue('day')} de ${partValue('month')}`;
}

/**
 * Tela Home (specs/003-home, reconstruída com o design system em 2026-07-30)
 * — cabeçalho (avatar + sino/badge), tag de hospital, título "Tarefas diárias
 * do hospital", skeleton, erro genérico e a grade de cards (`app-card-patients`
 * + `app-card-notify`), todos componentes compartilhados (specs/ds/*). Figma:
 * mobile `4360:7018`, desktop `4333:5876`, erro `4311:8624`.
 *
 * NOTA: o conteúdo abaixo é a marcação estrutural pedida — as regras de
 * negócio finas (ex.: qual tag de hospital some quando, paginação exata da
 * grade em desktop) ficam para uma spec própria depois.
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
export class HomeComponent implements OnDestroy {
  // `store` precisa ser o primeiro campo: os `toSignal(this.store.select(...))`
  // abaixo dependem dele já estar atribuído — campos de classe inicializam na
  // ordem em que aparecem no arquivo, e não na ordem de accessibility exigida
  // pelo lint (por isso `store` fica `protected`, não `private`, aqui).
  protected readonly store = inject(Store);
  protected readonly aiAssistant = inject(AiAssistantService);

  protected readonly status = toSignal(this.store.select(selectStatus), { initialValue: 'idle' as const });
  protected readonly summary = toSignal(this.store.select(selectSummary), { initialValue: null });
  protected readonly notifications = toSignal(this.store.select(selectNotifications), { initialValue: [] });
  protected readonly hospitals = toSignal(this.store.select(selectHospitals), { initialValue: [] });
  protected readonly selectedHospitalId = toSignal(this.store.select(selectSelectedHospitalId), {
    initialValue: null,
  });
  protected readonly stale = toSignal(this.store.select(selectStale), { initialValue: false });
  protected readonly errorMessage = toSignal(this.store.select(selectErrorMessage), { initialValue: null });
  protected readonly nextCursor = toSignal(this.store.select(selectNextCursor), { initialValue: null });

  // NOTA: não há ainda um serviço de sessão/perfil no frontend (fora do
  // escopo desta feature — a tela de login/autenticação ainda não foi
  // construída). Estes campos ficam com um valor de exemplo até essa peça
  // existir; a estrutura do cabeçalho já está pronta para receber dados
  // reais assim que o serviço de sessão for implementado.
  protected readonly professionalName = 'Michelle Franklin';
  protected readonly professionalTitle = 'Dra.';
  protected readonly professionalPhotoUrl: string | null = null;

  protected readonly todayLabel = computed(() => formatTodayLabel());

  protected readonly professionalAvatarType = computed<AvatarType>(() =>
    this.professionalPhotoUrl ? 'photo' : 'user',
  );

  protected readonly selectedHospitalName = computed(
    () => this.hospitals().find(hospital => hospital.id === this.selectedHospitalId())?.name ?? '',
  );

  private readonly injector = inject(Injector);
  private readonly scrollSentinel = viewChild<ElementRef<HTMLElement>>('scrollSentinel');
  private intersectionObserver?: IntersectionObserver;

  constructor() {
    this.store.dispatch(HomeActions.pageOpened());

    // Observa o sentinel de fim de lista (FR-004) assim que ele existir no
    // DOM — some/reaparece conforme `status()` alterna os blocos do template.
    effect(
      () => {
        const element = this.scrollSentinel()?.nativeElement;

        this.intersectionObserver?.disconnect();
        if (!element) {
          return;
        }
        this.intersectionObserver = new IntersectionObserver(entries => {
          const visivel = entries.some(entry => entry.isIntersecting);

          if (visivel && this.nextCursor() && this.status() !== 'loading-more') {
            this.store.dispatch(HomeActions.loadNextBatch());
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

  protected onRetry(): void {
    this.store.dispatch(HomeActions.retryRequested());
  }

  protected onViewNotificationDetail(_: number): void {
    // Rota de detalhe registrada na US2 (T039) — fora do escopo desta spec.
  }

  protected onViewAllNotifications(): void {
    // FR-008: navega para a tela "Notificações" — especificação independente, fora de escopo.
  }

  protected onViewPatients(): void {
    // Navega para a tela "Listagem de Pacientes" — especificação independente, fora de escopo.
  }

  protected formatTime(isoDate: string): string {
    return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(isoDate));
  }
}
