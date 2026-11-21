import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DailyAdequacy } from './adequacy.models';
import { AdequacySummaryComponent } from './adequacy-summary.component';

const AVAILABLE: DailyAdequacy = {
  calories: { intake: 2000, percent: 107, target: 1875 },
  protein: { intake: 82.5, percent: 73, target: 112.5 },
  sources: { food: null, infusion: null },
  status: 'available',
  targets: {
    calorimetry: null,
    formula: 'simplified',
    kcalPerDay: 1875,
    kcalPerKg: 25,
    proteinPerDay: 112.5,
    proteinPerKg: 1.5,
    referenceWeight: { kg: 75, kind: 'current' },
  },
};

function render(adequacy: DailyAdequacy): HTMLElement {
  const fixture: ComponentFixture<AdequacySummaryComponent> = TestBed.createComponent(AdequacySummaryComponent);

  fixture.componentRef.setInput('adequacy', adequacy);
  fixture.detectChanges();

  return fixture.nativeElement as HTMLElement;
}

describe('AdequacySummaryComponent', () => {
  it('mostra aporte e "N% da meta (valor)" com barra limitada a 100%', () => {
    const el = render(AVAILABLE);
    const bars = Array.from(el.querySelectorAll('[role="progressbar"]'));

    expect(el.textContent).toContain('2.000 kcal');
    expect(el.textContent).toContain('107% da meta (1.875 kcal)');
    expect(el.textContent).toContain('82,5 g');
    expect(el.textContent).toContain('73% da meta (112,5 g)');
    expect(bars.map(b => b.getAttribute('aria-valuenow'))).toEqual(['100', '73']);
  });

  it('sem meta orienta a definir no Plano, sem percentual', () => {
    const el = render({ reason: 'no-target', status: 'unavailable' });

    expect(el.textContent).toContain('defina a meta calórica e proteica no Plano de intervenção');
    expect(el.querySelector('[role="progressbar"]')).toBeNull();
  });

  it('sem conexão fica indisponível', () => {
    expect(render({ reason: 'offline', status: 'unavailable' }).textContent).toContain('sem conexão');
  });
});
