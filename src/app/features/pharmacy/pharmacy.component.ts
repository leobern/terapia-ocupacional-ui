import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  type OnInit,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';

import { PageContainerComponent } from '../../shared/components/page-container/page-container.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { type FormValues, type ScreenAction, ScreenActionsService } from '../../shared/services/screen-actions.service';
import { PHARMACY_CONTEXT } from '../../shared/services/screen-contexts';
import { HospitalContextService } from '../home/hospital-context.service';
import { UnreadNotificationsReader } from '../home/unread-notifications-reader';
import { Formula, FORMULA_CATEGORIES } from './formulas.models';
import { FormulasApi } from './formulas-api';

type LoadStatus = 'loading' | 'ready' | 'error';

/**
 * Tela "Farmácia" (spec 012, US-009-2-01): catálogo compartilhado por categoria e padronização
 * por hospital. Rota exclusiva do gestor (`gestorGuard`). Sem desenho no Figma: montada com os
 * tokens do design system. Offline: o catálogo já carregado segue visível; marcar/desmarcar não.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageContainerComponent, PageHeaderComponent],
  selector: 'app-pharmacy',
  styleUrl: './pharmacy.component.scss',
  templateUrl: './pharmacy.component.html',
})
export class PharmacyComponent implements OnInit {
  protected readonly hospital = inject(HospitalContextService).selected;
  protected readonly hospitalStatus = inject(HospitalContextService).status;
  protected readonly unreadCount = signal(0);
  protected readonly status = signal<LoadStatus>('loading');
  protected readonly formulas = signal<readonly Formula[]>([]);
  protected readonly online = signal(navigator.onLine);
  protected readonly saveError = signal<string | null>(null);
  protected readonly savingId = signal<string | null>(null);

  protected readonly groups = computed(() =>
    FORMULA_CATEGORIES.map(category => ({
      ...category,
      formulas: this.formulas().filter(formula => formula.category === category.key),
    })).filter(group => group.formulas.length > 0),
  );

  private readonly api = inject(FormulasApi);
  private readonly context = inject(HospitalContextService);
  private readonly router = inject(Router);
  private readonly unread = inject(UnreadNotificationsReader);
  private readonly screenActions = inject(ScreenActionsService);

  constructor() {
    effect(onCleanup => {
      onCleanup(this.screenActions.registerContext(PHARMACY_CONTEXT));
    });

    const onOnline = (): void => this.online.set(true);
    const onOffline = (): void => this.online.set(false);

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    inject(DestroyRef).onDestroy(() => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    });

    // Atalhos da tela (padrão de cadastro): "Solicitar fórmula" abre o formulário em cards.
    // Offline a ação sai dos atalhos (US-009-2-02, cenário 4).
    effect(onCleanup => {
      const actions: readonly ScreenAction[] = this.online()
        ? [
            {
              form: {
                fields: [
                  {
                    id: 'description',
                    kind: 'text',
                    label: 'Qual fórmula você quer solicitar?',
                    placeholder: 'Nome, fabricante e características da fórmula',
                    required: true,
                  },
                ],
                submit: (values): Promise<void> => this.requestFormula(values),
                submitLabel: 'Solicitar fórmula',
                title: 'Solicitar fórmula',
              },
              id: 'request-formula',
              label: 'Solicitar fórmula',
            },
          ]
        : [];

      onCleanup(this.screenActions.register(actions));
    });

    effect(() => {
      const hospitalId = this.hospital()?.id;

      if (hospitalId) {
        void this.load(hospitalId);
      }
    });
  }

  async ngOnInit(): Promise<void> {
    // Falha anterior ao carregar os hospitais: tenta de novo ao abrir a tela (como a Home).
    if (this.hospitalStatus() === 'error') {
      void this.context.load();
    }
    this.unreadCount.set(await this.unread.countUnread().catch(() => 0));
  }

  protected reloadHospitals(): void {
    void this.context.load();
  }

  protected subtitle(): string {
    const name = this.hospital()?.name;
    const hint = 'Fórmulas padronizadas ficam disponíveis na prescrição deste hospital.';

    return name ? `${name} · ${hint}` : hint;
  }

  protected openNotifications(): void {
    void this.router.navigate(['/notifications']);
  }

  protected bellLabel(): string {
    const count = this.unreadCount();

    return count > 0 ? `Notificações, ${count} não lidas` : 'Notificações';
  }

  protected async load(hospitalId = this.hospital()?.id): Promise<void> {
    if (!hospitalId) {
      return;
    }
    this.status.set('loading');
    try {
      this.formulas.set(await this.api.list(hospitalId));
      this.status.set('ready');
    } catch {
      this.status.set('error');
    }
  }

  protected async toggle(formula: Formula): Promise<void> {
    const hospitalId = this.hospital()?.id;

    if (!hospitalId || !this.online() || this.savingId()) {
      return;
    }
    this.saveError.set(null);
    this.savingId.set(formula.id);
    try {
      await this.api.setStandardized(hospitalId, formula.id, !formula.standardized);
      this.formulas.update(list =>
        list.map(item => (item.id === formula.id ? { ...item, standardized: !formula.standardized } : item)),
      );
    } catch {
      this.saveError.set(`Não foi possível salvar a padronização de "${formula.name}". Tente novamente.`);
    } finally {
      this.savingId.set(null);
    }
  }
  protected yesNo(value: boolean): string {
    return value ? 'Sim' : 'Não';
  }

  protected number(value: number | null): string {
    return value === null ? '—' : value.toLocaleString('pt-BR');
  }

  protected suitability(formula: Formula): string {
    if (formula.vegan) {
      return 'Vegano';
    }

    return formula.vegetarian ? 'Vegetariano' : 'Não se aplica';
  }

  /** Envia o pedido pelo formulário dos atalhos; lançar erro mantém o formulário aberto com as respostas. */
  private async requestFormula(values: FormValues): Promise<void> {
    const hospitalId = this.hospital()?.id;
    const description = typeof values['description'] === 'string' ? values['description'].trim() : '';

    if (!hospitalId || !this.online() || !description) {
      throw new Error('Solicitação indisponível');
    }
    await this.api.requestFormula(hospitalId, description);
  }
}
