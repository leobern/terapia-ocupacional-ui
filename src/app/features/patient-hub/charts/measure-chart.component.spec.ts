import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { type MeasureBadge, MeasureChartComponent, type MeasurePoint } from './measure-chart.component';

const SERIES: readonly MeasurePoint[] = Array.from({ length: 10 }, (_, i) => ({
  label: `d${i}`,
  note: i === 8 ? 'balança' : undefined,
  value: 50 + i * 0.5,
}));

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MeasureChartComponent],
  template: `<app-measure-chart
    title="Peso"
    unit="kg"
    caption="Legenda"
    [series]="series"
    [badge]="badge"
    [idealRange]="range"
    [reference]="reference"
  />`,
})
class HostComponent {
  series: readonly MeasurePoint[] = SERIES;
  badge: MeasureBadge | null = { icon: 'arrow-up', text: '+2 kg' };
  range: readonly [number, number] | null = null;
  reference: { label: string; value: number } | null = null;
}

describe('MeasureChartComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  const el = (): HTMLElement => fixture.nativeElement;
  const dots = (): number => el().querySelectorAll('.trend__point').length;
  const create = (setup?: (host: HostComponent) => void): void => {
    fixture = TestBed.createComponent(HostComponent);
    setup?.(fixture.componentInstance);
    fixture.detectChanges();
  };

  it('mostra título, valor atual, unidade, legenda e selo', () => {
    create();

    expect(el().querySelector('.trend__title')?.textContent).toContain('Peso');
    expect(el().querySelector('.trend__value')?.textContent).toContain('54,5');
    expect(el().querySelector('.trend__unit')?.textContent).toContain('kg');
    expect(el().querySelector('.trend__caption')?.textContent).toContain('Legenda');
    expect(el().querySelector('.trend__badge')?.textContent).toContain('+2 kg');
  });

  it('desenha a grade de 3 linhas com passo redondo', () => {
    create();

    const ticks = Array.from(el().querySelectorAll('.trend__tick')).map(t => t.textContent?.trim());

    expect(ticks.length).toBe(3);
    expect(ticks[0]).toBe('50');
  });

  it('mostra todos os pontos da internação, sem botões de período', () => {
    create();

    expect(dots()).toBe(10);
    expect(el().querySelector('.trend__chip')).toBeNull();
    expect(el().textContent).not.toContain('30 dias');
  });

  it('o ponto escolhido mostra o tooltip; o padrão é o penúltimo', () => {
    create();

    expect(el().querySelector('.trend__tooltip')?.textContent).toContain('d8 · balança');

    (el().querySelectorAll('.trend__point')[0] as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(el().querySelector('.trend__tooltip')?.textContent).toContain('d0');
  });

  it('com apenas um ponto escolhe esse ponto', () => {
    create(host => (host.series = [{ label: 'a', value: 50 }]));

    expect(el().querySelector('.trend__tooltip')?.textContent).toContain('a');
  });

  it('desenha faixa ideal e linha de referência só quando informadas', () => {
    create();

    expect(el().querySelector('.trend__ideal')).toBeNull();
    expect(el().querySelector('.trend__reference')).toBeNull();

    create(host => {
      host.range = [51, 53];
      host.reference = { label: 'Início', value: 51 };
    });

    expect(el().querySelector('.trend__ideal')).not.toBeNull();
    expect(el().querySelector('.trend__reference-label')?.textContent).toContain('Início');
  });

  it('série vazia não quebra', () => {
    create(host => {
      host.series = [];
      host.badge = null;
    });

    expect(dots()).toBe(0);
    expect(el().querySelector('.trend__tooltip')).toBeNull();
    expect(el().querySelector('.trend__value')?.textContent).toContain('—');
    expect(el().querySelector('.trend__area')?.getAttribute('points')).toBe('');
  });
});
