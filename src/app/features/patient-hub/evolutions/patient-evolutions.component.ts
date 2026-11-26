import {
  ChangeDetectionStrategy,
  Component,
  effect,
  type ElementRef,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';

import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';
import { ScrollRevealDirective } from '../../../shared/directives/scroll-reveal.directive';
import { PhIconComponent } from '../../../shared/icons/ph-icon/ph-icon.component';
import { OutboxService } from '../../../shared/offline/outbox.service';
import { syncLabel } from '../../../shared/offline/sync-labels';
import { NOW } from '../../home/professional-profile';
import { DailyEvolutionDay, DailyEvolutionSource } from '../daily-record/daily-evolution-source';
import {
  DailyEvolution,
  dayKey,
  reevaluationStatus,
  registeredAt,
  shortDate,
} from '../daily-record/daily-record.models';

type LoadState = 'loading' | 'ready' | 'error';

export const EVOLUTIONS_EMPTY_TEXT = 'Nenhuma evolução registrada neste dia.';
export const EVOLUTIONS_LOAD_FAILED_HINT = 'Não foi possível carregar a evolução. Tente novamente em instantes.';
/** Quantos dias para trás a lista de evoluções alcança (a partir de hoje). */
export const EVOLUTIONS_WINDOW_DAYS = 14;

interface EvolutionEntry {
  readonly key: string;
  readonly date: Date;
  readonly registered: string;
  readonly evolution: DailyEvolution;
  readonly items: readonly {
    readonly id: string;
    readonly name: string;
    readonly lastAssessed: string;
    readonly status: ReturnType<typeof reevaluationStatus>;
  }[];
}

/**
 * Seção "Evoluções" do Hub (Figma v2/NotificationThread, State=pendencias): lista das evoluções dos últimos dias, da mais
 * recente para a mais antiga, com rolagem própria. Cada evolução traz os itens a reavaliar ("Avaliar") e o selo de prazo
 * ou "Vencida". A rolagem e a faixa de datas andam juntas (Thiago, 2026-11-25): escolher um dia leva até a evolução dele
 * e, ao rolar, a evolução que chega ao topo vira o dia escolhido.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AvatarComponent, PhIconComponent, ScrollRevealDirective],
  selector: 'app-patient-evolutions',
  styleUrl: './patient-evolutions.component.scss',
  templateUrl: './patient-evolutions.component.html',
})
export class PatientEvolutionsComponent {
  readonly patientId = input.required<string>();
  /** Dia escolhido na faixa de datas. */
  readonly day = input.required<Date>();
  /** Muda quando o Registro diário grava: as evoluções são lidas de novo. */
  readonly refreshKey = input(0);
  /** A evolução que chegou ao topo ao rolar: a tela passa este dia para a faixa de datas. */
  readonly dayChange = output<Date>();

  protected readonly state = signal<LoadState>('loading');
  protected readonly entries = signal<readonly EvolutionEntry[]>([]);
  protected readonly emptyText = EVOLUTIONS_EMPTY_TEXT;
  protected readonly loadFailedHint = EVOLUTIONS_LOAD_FAILED_HINT;

  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');
  private readonly source = inject(DailyEvolutionSource);
  private readonly clock = inject(NOW);
  private readonly outbox = inject(OutboxService);
  private token = 0;
  /** Último dia que a própria rolagem escolheu: não rola de volta quando a tela o devolve como `day`. */
  private fromScroll: string | null = null;

  constructor() {
    effect(() => {
      const id = this.patientId();

      this.refreshKey();
      // Gravação offline concluída no servidor: a lista é lida de novo.
      this.outbox.syncedTick();
      untracked(() => void this.load(id));
    });
    // Escolher um dia na faixa: rola até a evolução dele (ou a mais próxima, anterior).
    effect(() => {
      const key = dayKey(this.day());

      this.entries();
      untracked(() => this.scrollTo(key));
    });
  }

  /** Situação de sincronização das gravações do dia deste paciente (vazio = já no servidor). */
  protected syncOf(day: string): string {
    return syncLabel(this.outbox.forPatient(this.patientId(), day));
  }

  /** Rolagem do usuário: a primeira evolução visível no topo vira o dia escolhido. */
  protected onScroll(): void {
    const box = this.scroller()?.nativeElement;

    if (box === undefined) {
      return;
    }
    const top = box.getBoundingClientRect().top;
    const articles = Array.from(box.querySelectorAll<HTMLElement>('[data-day]'));
    const first = articles.find(a => a.getBoundingClientRect().bottom > top + 8);
    const key = first?.dataset['day'];

    if (key === undefined || key === dayKey(this.day()) || key === this.fromScroll) {
      return;
    }
    this.fromScroll = key;
    this.dayChange.emit(this.entries().find(e => e.key === key)?.date ?? this.day());
  }

  private scrollTo(key: string): void {
    if (this.fromScroll === key) {
      this.fromScroll = null;

      return;
    }
    this.fromScroll = null;
    const box = this.scroller()?.nativeElement;
    const entry = this.entries().find(e => e.key <= key);

    if (box === undefined || entry === undefined) {
      return;
    }
    const target = box.querySelector<HTMLElement>(`[data-day="${entry.key}"]`);

    if (target !== null) {
      box.scrollTo({ top: box.scrollTop + target.getBoundingClientRect().top - box.getBoundingClientRect().top });
    }
  }

  private async load(patientId: string): Promise<void> {
    const token = ++this.token;
    const now = this.clock();
    const days = Array.from({ length: EVOLUTIONS_WINDOW_DAYS }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);

      return { date: d, key: dayKey(d) };
    });

    this.state.set('loading');
    let found: readonly DailyEvolutionDay[];

    try {
      found = await this.source.list(
        patientId,
        days.map(d => d.key),
      );
    } catch {
      if (token === this.token) {
        this.entries.set([]);
        this.state.set('error');
      }

      return;
    }
    if (token !== this.token) {
      return;
    }
    const list: EvolutionEntry[] = [];

    for (const { day, evolution } of found) {
      const date = days.find(d => d.key === day)?.date;

      if (date !== undefined) {
        list.push({
          date,
          evolution,
          items: (evolution.reevaluations ?? []).map(item => ({
            id: item.id,
            lastAssessed: shortDate(evolution.at),
            name: item.name,
            status: reevaluationStatus(item.dueAt, now),
          })),
          key: day,
          registered: registeredAt(evolution.at),
        });
      }
    }
    this.entries.set(list);
    this.state.set('ready');
  }
}
