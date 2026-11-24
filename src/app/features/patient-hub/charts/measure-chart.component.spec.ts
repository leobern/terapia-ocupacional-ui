import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MeasureChartComponent, type MeasurePoint } from './measure-chart.component';

const SERIES: readonly MeasurePoint[] = Array.from({ length: 10 }, (_, i) => ({ label: `d${i}`, value: 50 + i }));

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MeasureChartComponent],
  template: `<app-measure-chart title="Peso" unit="kg" caption="Legenda" [series]="series" [idealRange]="range" />`,
})
class HostComponent {
  series = SERIES;
  range: readonly [number, number] | null = null;
}

describe('MeasureChartComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  const el = (): HTMLElement => fixture.nativeElement;
  const dots = (): number => el().querySelectorAll('.measure__dot').length;
  const periodButtons = (): HTMLButtonElement[] => Array.from(el().querySelectorAll('.measure__period'));

  beforeEach(() => {
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  });

  it('mostra título, valor atual, unidade e legenda', () => {
    expect(el().querySelector('.measure__title')?.textContent).toContain('Peso');
    expect(el().querySelector('.measure__value')?.textContent).toContain('59');
    expect(el().querySelector('.measure__unit')?.textContent).toContain('kg');
    expect(el().querySelector('.measure__caption')?.textContent).toContain('Legenda');
  });

  it('começa na internação (todos os pontos) e filtra por 30 dias e 7 dias', () => {
    expect(dots()).toBe(10);

    periodButtons()[2].click();
    fixture.detectChanges();

    expect(dots()).toBe(7);
    expect(periodButtons()[2].getAttribute('aria-pressed')).toBe('true');

    periodButtons()[1].click();
    fixture.detectChanges();

    expect(dots()).toBe(10);
  });

  it('desenha a faixa ideal só quando informada', () => {
    expect(el().querySelector('.measure__ideal')).toBeNull();

    fixture.componentInstance.range = [52, 56];
    fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.range = [52, 56];
    fixture.detectChanges();

    expect(el().querySelector('.measure__ideal')).not.toBeNull();
  });

  it('série vazia não quebra e não mostra legenda', () => {
    fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.series = [];
    fixture.detectChanges();

    expect(dots()).toBe(0);
    expect(el().querySelector('.measure__area')?.getAttribute('points')).toBe('');
  });
});
