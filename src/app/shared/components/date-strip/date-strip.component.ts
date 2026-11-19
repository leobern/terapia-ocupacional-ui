import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { PhIconComponent } from '../../icons/ph-icon/ph-icon.component';

export interface DateStripDay {
  readonly date: Date;
  readonly weekday: string;
  readonly dayOfMonth: number;
  readonly selected: boolean;
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

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

/**
 * Carrossel de datas (Figma v2/DateStrip): 5 dias centrados na data selecionada,
 * com setas para dia anterior/seguinte. A data selecionada fica destacada e as
 * vizinhas visíveis; só emite a escolha — a regra de data retroativa é do consumidor.
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
  readonly dateChange = output<Date>();

  protected readonly days = computed<readonly DateStripDay[]>(() => {
    const center = startOfDay(this.selected());

    return [-2, -1, 0, 1, 2].map(offset => {
      const date = addDays(center, offset);

      return {
        date,
        dayOfMonth: date.getDate(),
        label: `${WEEKDAYS_LONG[date.getDay()]}, ${date.getDate()}`,
        selected: offset === 0,
        weekday: WEEKDAYS[date.getDay()],
      };
    });
  });

  protected shift(offset: number): void {
    this.dateChange.emit(addDays(startOfDay(this.selected()), offset));
  }

  protected pick(day: DateStripDay): void {
    if (!day.selected) {
      this.dateChange.emit(day.date);
    }
  }
}
