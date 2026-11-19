import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DateStripComponent } from './date-strip.component';

describe('DateStripComponent', () => {
  let fixture: ComponentFixture<DateStripComponent>;
  let emitted: Date[];
  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const buttons = (cls: string): HTMLButtonElement[] => Array.from(root().querySelectorAll<HTMLButtonElement>(cls));

  beforeEach(() => {
    fixture = TestBed.createComponent(DateStripComponent);
    fixture.componentRef.setInput('selected', new Date(2026, 10, 19, 15));
    emitted = [];
    fixture.componentInstance.dateChange.subscribe((d: Date) => emitted.push(d));
    fixture.detectChanges();
  });

  it('mostra 5 dias com o selecionado destacado e vizinhos visíveis', () => {
    const days = buttons('.date-strip__day');

    expect(days.length).toBe(5);
    expect(days.map(d => d.querySelector('.date-strip__number')?.textContent)).toEqual(['17', '18', '19', '20', '21']);
    expect(days[2].getAttribute('aria-pressed')).toBe('true');
    expect(days[2].classList).toContain('date-strip__day--selected');
    expect(days[2].getAttribute('aria-label')).toBe('quinta-feira, 19');
  });

  it('emite a data ao tocar em um vizinho e ignora o já selecionado', () => {
    const days = buttons('.date-strip__day');

    days[2].click();
    days[1].click();

    expect(emitted.length).toBe(1);
    expect(emitted[0].getDate()).toBe(18);
  });

  it('setas emitem dia anterior e seguinte', () => {
    const [prev, next] = buttons('.date-strip__arrow');

    prev.click();
    next.click();

    expect(emitted.map(d => d.getDate())).toEqual([18, 20]);
  });
});
