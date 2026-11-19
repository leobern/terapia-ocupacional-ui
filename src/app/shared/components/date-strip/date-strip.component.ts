import { ChangeDetectionStrategy, Component, computed, input, linkedSignal, output } from '@angular/core';

import { PhIconComponent } from '../../icons/ph-icon/ph-icon.component';

export interface DateStripDay {
  readonly date: Date;
  readonly weekday: string;
  readonly dayOfMonth: number;
  readonly selected: boolean;
  /** Distância (em dias) até o selecionado, limitada a 2: define o tamanho do item (60/54/48). */
  readonly distance: 0 | 1 | 2;
  readonly label: string;
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
const VISIBLE_DAYS = 5;
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
 * Carrossel de datas (Figma v2/DateStrip): janela de 5 dias com setas.
 *
 * O padrão é a data de hoje selecionada no ÚLTIMO item à direita (não há datas futuras:
 * `maxDate`, por padrão hoje). Ao voltar no tempo, é o **destaque** que anda — do último
 * para o penúltimo e assim por diante. Só quando o destaque chega a uma extremidade é que
 * a janela de datas rola. O componente apenas emite a escolha; a regra de data retroativa
 * é do consumidor.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PhIconComponent],
  selector: 'app-date-strip',
  styleUrl: './date-strip.component.scss',
  templateUrl: './date-strip.component.html',
})
export class DateStripComponent {
  readonly selected = input.required<Date>();
  /** Última data selecionável (hoje, por padrão): o carrossel nunca avança além dela. */
  readonly maxDate = input<Date>(new Date());

  readonly dateChange = output<Date>();

  protected readonly days = computed<readonly DateStripDay[]>(() => {
    const start = this.windowStart();
    const selected = startOfDay(this.selected());

    return Array.from({ length: VISIBLE_DAYS }, (_, i) => {
      const date = addDays(start, i);
      const distance = Math.min(Math.abs(diffDays(date, selected)), 2) as 0 | 1 | 2;

      return {
        date,
        dayOfMonth: date.getDate(),
        distance,
        label: `${WEEKDAYS_LONG[date.getDay()]}, ${date.getDate()}`,
        selected: distance === 0,
        weekday: WEEKDAYS[date.getDay()],
      };
    });
  });

  protected readonly canGoForward = computed(() => diffDays(this.selected(), this.maxDate()) < 0);

  /** Primeiro dia da janela. Recalculado só quando o selecionado sai dela. */
  private readonly windowStart = linkedSignal<{ selected: Date; max: Date }, Date>({
    source: () => ({ max: this.maxDate(), selected: this.selected() }),
    computation: (source, previous) => {
      const selected = startOfDay(source.selected);
      const max = startOfDay(source.max);

      if (previous === undefined) {
        // Estado inicial: a janela termina em maxDate; se o selecionado for mais antigo, ele vira o primeiro item.
        const start = addDays(max, -(VISIBLE_DAYS - 1));

        return diffDays(selected, start) < 0 ? selected : start;
      }

      const index = diffDays(selected, previous.value);

      if (index < 0) {
        return selected;
      }

      if (index >= VISIBLE_DAYS) {
        return addDays(selected, -(VISIBLE_DAYS - 1));
      }

      return previous.value;
    },
  });

  protected shift(offset: number): void {
    if (offset > 0 && !this.canGoForward()) {
      return;
    }

    this.dateChange.emit(addDays(startOfDay(this.selected()), offset));
  }

  protected pick(day: DateStripDay): void {
    if (!day.selected && diffDays(day.date, this.maxDate()) <= 0) {
      this.dateChange.emit(day.date);
    }
  }
}
