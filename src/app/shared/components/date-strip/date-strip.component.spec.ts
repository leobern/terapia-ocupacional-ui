import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DateStripComponent, visibleDaysFor } from './date-strip.component';

describe('DateStripComponent', () => {
  let fixture: ComponentFixture<DateStripComponent>;
  let emitted: Date[];
  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const buttons = (cls: string): HTMLButtonElement[] => Array.from(root().querySelectorAll<HTMLButtonElement>(cls));

  beforeEach(() => {
    fixture = TestBed.createComponent(DateStripComponent);
    fixture.componentRef.setInput('selected', new Date(2026, 10, 19, 15));
    fixture.componentRef.setInput('maxDate', new Date(2026, 10, 19, 15));
    emitted = [];
    fixture.componentInstance.dateChange.subscribe((d: Date) => emitted.push(d));
    fixture.detectChanges();
  });

  it('mostra 5 dias terminando em hoje, com o destaque no último (à direita)', () => {
    const days = buttons('.date-strip__day');

    expect(days.length).toBe(5);
    expect(days.map(d => d.querySelector('.date-strip__number')?.textContent)).toEqual(['15', '16', '17', '18', '19']);
    expect(days[4].getAttribute('aria-pressed')).toBe('true');
    expect(days[4].classList).toContain('date-strip__day--selected');
    expect(days[4].getAttribute('aria-label')).toBe('quinta-feira, 19');
  });

  it('emite a data ao tocar em um dia anterior e ignora o já selecionado', () => {
    const days = buttons('.date-strip__day');

    days[4].click();
    days[3].click();

    expect(emitted.length).toBe(1);
    expect(emitted[0].getDate()).toBe(18);
  });

  it('seta anterior emite o dia anterior e a seguinte fica desabilitada em hoje', () => {
    const [prev, next] = buttons('.date-strip__arrow');

    prev.click();
    next.click();

    expect(emitted.map(d => d.getDate())).toEqual([18]);
    expect(next.disabled).toBeTrue();
  });

  it('ao voltar, o destaque anda e a janela só rola quando ele chega à extremidade; a última casa vira "Hoje"', () => {
    const plain = '.date-strip__day:not(.date-strip__day--today)';
    const numbers = (): (string | null | undefined)[] =>
      buttons(plain).map(d => d.querySelector('.date-strip__number')?.textContent);
    const selectedIndex = (): number =>
      buttons(plain).findIndex(d => d.classList.contains('date-strip__day--selected'));

    fixture.componentRef.setInput('selected', new Date(2026, 10, 17, 15));
    fixture.detectChanges();

    expect(numbers()).toEqual(['15', '16', '17', '18']);
    expect(selectedIndex()).toBe(2);
    expect(buttons('.date-strip__day--today').length).toBe(1);

    fixture.componentRef.setInput('selected', new Date(2026, 10, 14, 15));
    fixture.detectChanges();

    expect(numbers()).toEqual(['14', '15', '16', '17']);
    expect(selectedIndex()).toBe(0);
  });

  it('em hoje o selecionado é azul e a seta da direita some; ao voltar o selecionado fica cinza e entra "Hoje →"', () => {
    const [, next] = buttons('.date-strip__arrow');

    expect(buttons('.date-strip__day--selected')[0].classList).not.toContain('date-strip__day--past');
    expect(next.classList).toContain('date-strip__arrow--hidden');
    expect(buttons('.date-strip__day--today').length).toBe(0);

    fixture.componentRef.setInput('selected', new Date(2026, 10, 18, 15));
    fixture.detectChanges();
    const tile = buttons('.date-strip__day--today')[0];

    expect(buttons('.date-strip__day--selected')[0].classList).toContain('date-strip__day--past');
    expect(next.classList).not.toContain('date-strip__arrow--hidden');
    expect(tile.textContent).toContain('Hoje');
    expect(tile.getAttribute('aria-label')).toBe('Ir para hoje');

    tile.click();

    expect(emitted.map(d => d.getDate())).toEqual([19]);
  });

  it('numa coluna de 1 dia não há casa "Hoje" (a seta da direita leva adiante)', async () => {
    (fixture.nativeElement as HTMLElement).style.width = '120px';
    await new Promise(resolve => setTimeout(resolve, 100));
    fixture.componentRef.setInput('selected', new Date(2026, 10, 18, 15));
    fixture.detectChanges();

    expect(buttons('.date-strip__day').length).toBe(1);
    expect(buttons('.date-strip__day--today').length).toBe(0);
  });

  it('próxima seta avança quando o selecionado é anterior a hoje', () => {
    fixture.componentRef.setInput('selected', new Date(2026, 10, 17, 15));
    fixture.detectChanges();
    const [, next] = buttons('.date-strip__arrow');

    next.click();

    expect(emitted.map(d => d.getDate())).toEqual([18]);
  });

  it('visibleDaysFor: de 1 a 5 dias conforme a largura da coluna', () => {
    expect(visibleDaysFor(578)).toBe(5);
    expect(visibleDaysFor(370)).toBe(5);
    expect(visibleDaysFor(300)).toBe(4);
    expect(visibleDaysFor(200)).toBe(2);
    expect(visibleDaysFor(60)).toBe(1);
  });

  it('numa coluna estreita mostra menos dias e mantém o selecionado visível', async () => {
    (fixture.nativeElement as HTMLElement).style.width = '200px';
    await new Promise(resolve => setTimeout(resolve, 100));
    fixture.detectChanges();
    const days = buttons('.date-strip__day');

    expect(days.length).toBe(2);
    expect(days.at(-1)?.classList).toContain('date-strip__day--selected');
  });
});
