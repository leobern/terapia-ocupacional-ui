import { Location } from '@angular/common';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';

import { ConnectivityService } from '../../shared/services/connectivity.service';
import { PatientHubProfile } from '../patient-hub/patient-hub.models';
import { PatientHubSource } from '../patient-hub/patient-hub-source';
import { DiagnosisComponent, ERROR_HINT, OFFLINE_HINT } from './diagnosis.component';
import { GlimReading } from './diagnosis.models';
import { DiagnosisSource } from './diagnosis-source';

const PROFILE: PatientHubProfile = {
  bed: '35',
  birthDate: '1959-04-13',
  id: 'p1',
  name: 'José Raimundo Soares Neto',
  therapy: 'NE',
  therapyStartDate: '2026-05-26',
  ward: 'Ala 2',
};

const CONFIRMED: GlimReading = {
  criteria: {
    inflammation: 'positive',
    'low-bmi': 'negative',
    'low-muscle-mass': 'not-evaluated',
    'reduced-intake': 'positive',
    'weight-loss': 'positive',
  },
  fluidRetention: true,
  protocols: [
    { id: 'nrs-2002', label: 'NRS-2002', points: 4, result: 'Risco' },
    { id: 'sarc-f', label: 'SARC-F', result: 'Pouco provável' },
  ],
  screeningPositive: true,
  severity: { 'weight-loss': 'moderate' },
};

class FakeDiagnosisSource extends DiagnosisSource {
  reading: Promise<GlimReading> = Promise.resolve(CONFIRMED);

  load(): Promise<GlimReading> {
    return this.reading;
  }
}

class FakeHub extends PatientHubSource {
  loadProfile(): Promise<PatientHubProfile | null> {
    return Promise.resolve(PROFILE);
  }

  loadHypothesis(): Promise<string | null> {
    return Promise.resolve(null);
  }
}

describe('DiagnosisComponent', () => {
  let fixture: ComponentFixture<DiagnosisComponent>;
  let source: FakeDiagnosisSource;
  const online = signal(true);
  let location: { back: jasmine.Spy };

  async function render(id: string | null = 'p1'): Promise<HTMLElement> {
    TestBed.overrideProvider(ActivatedRoute, {
      useValue: { paramMap: of(convertToParamMap(id === null ? {} : { id })) },
    });
    fixture = TestBed.createComponent(DiagnosisComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    return fixture.nativeElement;
  }

  beforeEach(() => {
    source = new FakeDiagnosisSource();
    location = { back: jasmine.createSpy('back') };
    online.set(true);
    TestBed.configureTestingModule({
      imports: [DiagnosisComponent],
      providers: [
        { provide: DiagnosisSource, useValue: source },
        { provide: PatientHubSource, useClass: FakeHub },
        { provide: ConnectivityService, useValue: { online } },
        { provide: Location, useValue: location },
      ],
    });
  });

  it('shows skeleton while loading', () => {
    source.reading = new Promise(() => undefined);
    TestBed.overrideProvider(ActivatedRoute, { useValue: { paramMap: of(convertToParamMap({ id: 'p1' })) } });
    fixture = TestBed.createComponent(DiagnosisComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelectorAll('app-skeleton').length).toBe(2);
  });

  it('shows the result, staging and the 5 criteria with text', async () => {
    const el = await render();
    const text = el.textContent ?? '';

    expect(el.querySelector('.diagnosis__subtitle')?.textContent).toContain(
      'José Raimundo Soares Neto · Ala 2 · Leito 35',
    );

    expect(text).toContain('Desnutrição confirmada');
    expect(text).toContain('Estadiamento: moderada.');
    expect(text).toContain('Aguardando confirmação do médico');
    expect(el.querySelectorAll('.diagnosis__criterion').length).toBe(5);
    expect(el.querySelector('.diagnosis__count')?.textContent).toBe('5');
    expect(text).toContain('Fenotípicos');
    expect(text).toContain('Etiológicos');
    const states = Array.from(el.querySelectorAll('.diagnosis__criterion-state')).map(s => s.textContent);

    expect(states).toEqual(['Positivo', 'Negativo', 'Não avaliado', 'Positivo', 'Positivo']);
  });

  it('says staging is not calculated when the grade is unknown', async () => {
    source.reading = Promise.resolve({ ...CONFIRMED, severity: {} });
    const el = await render();

    expect(el.textContent).toContain('Estadiamento não calculado');
  });

  it('shows excluded', async () => {
    source.reading = Promise.resolve({
      criteria: {
        inflammation: 'negative',
        'low-bmi': 'negative',
        'low-muscle-mass': 'negative',
        'reduced-intake': 'negative',
        'weight-loss': 'negative',
      },
      fluidRetention: false,
      protocols: [],
      screeningPositive: true,
      severity: {},
    });
    const el = await render();

    expect(el.textContent).toContain('Desnutrição excluída');
  });

  it('shows "Indeterminado" explicitly', async () => {
    source.reading = Promise.resolve({
      ...CONFIRMED,
      criteria: {
        ...CONFIRMED.criteria,
        inflammation: 'not-evaluated',
        'reduced-intake': 'not-evaluated',
        'weight-loss': 'not-evaluated',
      },
    });
    const el = await render();

    expect(el.querySelector('.diagnosis__result')?.textContent).toBe('Indeterminado');
  });

  it('reports the missing prerequisite without calculating or listing criteria', async () => {
    source.reading = Promise.resolve({ ...CONFIRMED, fluidRetention: false, screeningPositive: false });
    const el = await render();

    expect(el.querySelector('.diagnosis__result')?.textContent).toBe('Pré-requisito não cumprido');
    expect(el.textContent).toContain('Não há triagem positiva registrada');
    expect(el.querySelector('.diagnosis__criterion')).toBeNull();
    expect(el.querySelector('.diagnosis__banner')).toBeNull();
  });

  it('shows a read error', async () => {
    source.reading = Promise.reject(new Error('x'));
    const el = await render();

    expect(el.querySelector('[role="alert"]')?.textContent).toContain(ERROR_HINT);
  });

  it('says calculation needs a connection when offline and the read fails', async () => {
    online.set(false);
    source.reading = Promise.reject(new Error('x'));
    const el = await render();

    expect(el.querySelector('[role="alert"]')?.textContent).toContain(OFFLINE_HINT);
  });

  it('errors without a patient id', async () => {
    const el = await render(null);

    expect(el.querySelector('[role="alert"]')).not.toBeNull();
  });

  it('goes back', async () => {
    const el = await render();

    el.querySelector<HTMLButtonElement>('app-icon-button button')?.click();

    expect(location.back).toHaveBeenCalledWith();
  });

  it('shows the reliability alert with fluid retention, even with criteria not evaluated', async () => {
    source.reading = Promise.resolve({
      ...CONFIRMED,
      criteria: {
        ...CONFIRMED.criteria,
        inflammation: 'not-evaluated',
        'reduced-intake': 'not-evaluated',
        'weight-loss': 'not-evaluated',
      },
    });
    const el = await render();

    expect(el.textContent).toContain('Edema ou ascite registrado: peso, IMC e massa muscular podem estar mascarados.');
  });

  it('hides the reliability alert without fluid retention', async () => {
    source.reading = Promise.resolve({ ...CONFIRMED, fluidRetention: false });
    const el = await render();

    expect(el.textContent).not.toContain('Edema ou ascite');
  });

  it('shows the other protocols side by side with text, read-only', async () => {
    const el = await render();
    const tiles = Array.from(el.querySelectorAll('.diagnosis__tile')).map(t =>
      Array.from(t.children)
        .map(c => c.textContent?.trim())
        .join(' '),
    );

    expect(tiles).toEqual(['NRS-2002 4 pontos Risco', 'SARC-F Pouco provável']);
    expect(el.querySelector('#protocols-title + .diagnosis__count')?.textContent).toBe('2');
    expect(el.querySelector('.diagnosis__tile button, .diagnosis__tile input')).toBeNull();
  });

  it('copes with no other protocol applied', async () => {
    source.reading = Promise.resolve({ ...CONFIRMED, protocols: [] });
    const el = await render();

    expect(el.textContent).toContain('Nenhum outro protocolo aplicado');
    expect(el.querySelector('.diagnosis__tile')).toBeNull();
  });
});
