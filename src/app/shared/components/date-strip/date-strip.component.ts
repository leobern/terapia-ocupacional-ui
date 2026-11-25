import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';

import { PhIconComponent } from '../../icons/ph-icon/ph-icon.component';

export interface DateStripDay {
  readonly date: Date;
  readonly weekday: string;
  readonly dayOfMonth: number;
  readonly selected: boolean;
  readonly label: string;
  /** `today`: a última casa, quando o selecionado é uma data anterior — "Hoje" com a seta que volta a hoje. */
  readonly kind: 'day' | 'today';
}

const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const WEEKDAYS_LONG = [
  'domingo',
  'segunda-feira',
  'terça-feira',
  'quarta-feira',
  'quinta-feira',
  'sexta-feira',
  'sábado',
];
/** Máximo de dias visíveis; a faixa mostra menos quando a coluna é estreita. */
const MAX_VISIBLE_DAYS = 5;
/** Medidas do Figma v2/DateStrip (4598:1613): dia 48px, seta 40px, gap 4, sem padding e borda 1. */
const DAY_WIDTH = 48;
const ARROW_WIDTH = 40;
const GAP = 4;
const CHROME_WIDTH = 2 * ARROW_WIDTH + 2 + GAP;

/** Quantos dias cabem na largura: de 1 a 5. */
export function visibleDaysFor(width: number): number {
  return Math.max(1, Math.min(MAX_VISIBLE_DAYS, Math.floor((width - CHROME_WIDTH) / (DAY_WIDTH + GAP))));
}
const MS_DAY = 86_400_000;

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

function diffDays(a: Date, b: Date): number {
  return Math.round((startOfDay(a).getTime() - startOfDay(b).getTime()) / MS_DAY);
}

/**
 * Carrossel de datas (Figma v2/DateStrip, estados "hoje" e "outras"). Ocupa 100% da coluna e mostra de 5 até 1 dia,
 * conforme a largura, com o espaço entre eles distribuído automaticamente.
 *
 * - **Hoje:** o dia de hoje fica selecionado (azul) no ÚLTIMO item à direita; não há datas futuras (`maxDate`) e a
 *   seta da direita some.
 * - **Outras:** ao voltar no tempo, o destaque anda para trás e fica **cinza**; a última casa vira "Hoje →" (azul) e
 *   leva direto a hoje. A janela só rola quando o destaque chega a uma extremidade.
 *
 * O componente apenas emite a escolha; a regra de data retroativa é do consumidor.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.date-strip--header]': "variant() === 'header'",
  },
  imports: [PhIconComponent],
  selector: 'app-date-strip',
  styleUrl: './date-strip.component.scss',
  templateUrl: './date-strip.component.html',
})
export class DateStripComponent {
  /** `header`: 250px de largura (3 dias), dentro do cabeçalho (Figma 4772:25062); `default`: a largura da coluna. */
  readonly variant = input<'default' | 'header'>('default');
  readonly selected = input.required<Date>();
  /** Última data selecionável (hoje, por padrão): o carrossel nunca avança além dela. */
  readonly maxDate = input<Date>(new Date());

  readonly dateChange = output<Date>();

  /** Dias visíveis agora, conforme a largura da coluna. */
  protected readonly visible = signal(MAX_VISIBLE_DAYS);

  /** O selecionado é hoje (estado "hoje"); senão, estado "outras". */
  protected readonly isToday = computed(() => diffDays(this.selected(), this.maxDate()) >= 0);

  /** Com datas anteriores e espaço para 2 ou mais casas, a última é o atalho "Hoje". */
  protected readonly showTodayTile = computed(() => !this.isToday() && this.visible() >= 2);

  protected readonly days = computed<readonly DateStripDay[]>(() => {
    const start = this.windowStart();
    const selected = startOfDay(this.selected());
    const common = Array.from({ length: this.slots() }, (_, i): DateStripDay => {
      const date = addDays(start, i);

      return {
        date,
        dayOfMonth: date.getDate(),
        kind: 'day',
        label: `${WEEKDAYS_LONG[date.getDay()]}, ${date.getDate()}`,
        selected: diffDays(date, selected) === 0,
        weekday: WEEKDAYS[date.getDay()],
      };
    });

    if (!this.showTodayTile()) {
      return common;
    }
    const today = startOfDay(this.maxDate());

    return [
      ...common,
      {
        date: today,
        dayOfMonth: today.getDate(),
        kind: 'today',
        label: 'Ir para hoje',
        selected: false,
        weekday: 'hoje',
      },
    ];
  });

  protected readonly canGoForward = computed(() => diffDays(this.selected(), this.maxDate()) < 0);

  /** Quantas casas de dias comuns (o atalho "Hoje" ocupa a última, quando existe). */
  private readonly slots = computed(() => this.visible() - (this.showTodayTile() ? 1 : 0));

  /** Primeiro dia da janela. Recalculado só quando o selecionado sai dela. */
  private readonly windowStart = linkedSignal<{ selected: Date; max: Date; size: number }, Date>({
    source: () => ({ max: this.maxDate(), selected: this.selected(), size: Math.max(1, this.slots()) }),
    computation: (source, previous) => {
      const selected = startOfDay(source.selected);
      const max = startOfDay(source.max);

      if (previous === undefined) {
        // Estado inicial: a janela termina em maxDate; se o selecionado for mais antigo, ele vira o primeiro item.
        const start = addDays(max, -(source.size - 1));

        return diffDays(selected, start) < 0 ? selected : start;
      }

      const index = diffDays(selected, previous.value);

      if (index < 0) {
        return selected;
      }

      if (index >= source.size) {
        return addDays(selected, -(source.size - 1));
      }

      return previous.value;
    },
  });

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const observer = new ResizeObserver(() => {
      // Elemento escondido (largura 0): mantém o que já mostra, em vez de cair para 1 dia.
      if (host.clientWidth > 0) {
        this.visible.set(visibleDaysFor(host.clientWidth));
      }
    });

    observer.observe(host);
    inject(DestroyRef).onDestroy(() => observer.disconnect());
  }

  protected shift(offset: number): void {
    if (offset > 0 && !this.canGoForward()) {
      return;
    }

    this.dateChange.emit(addDays(startOfDay(this.selected()), offset));
  }

  protected pick(day: DateStripDay): void {
    if (day.kind === 'today') {
      this.dateChange.emit(startOfDay(this.maxDate()));

      return;
    }
    if (!day.selected && diffDays(day.date, this.maxDate()) <= 0) {
      this.dateChange.emit(day.date);
    }
  }
}
