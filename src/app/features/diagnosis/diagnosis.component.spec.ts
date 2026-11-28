import { Location } from '@angular/common';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { of } from 'rxjs';

import { ConnectivityService } from '../../shared/services/connectivity.service';
import { NOW, ProfessionalProfile, ProfessionalProfileReader } from '../home/professional-profile';
import { PatientHubProfile } from '../patient-hub/patient-hub.models';
import { PatientHubSource } from '../patient-hub/patient-hub-source';
import { DiagnosisComponent, ERROR_HINT, OFFLINE_HINT } from './diagnosis.component';
import { GlimReading } from './diagnosis.models';
import { DiagnosisDecisionSource } from './diagnosis-decision-source';
import { DiagnosisSource } from './diagnosis-source';
import { ProvisionalDiagnosisDecisionSource } from './provisional-diagnosis-decision-source';

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
  let routeOverridden = false;
  let role: 'doctor' | 'other';
  let decisions: ProvisionalDiagnosisDecisionSource;

  async function render(id: string | null = 'p1'): Promise<HTMLElement> {
    if (!routeOverridden) {
      TestBed.overrideProvider(ActivatedRoute, {
        useValue: { paramMap: of(convertToParamMap(id === null ? {} : { id })) },
      });
      routeOverridden = true;
    }
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
    role = 'doctor';
    routeOverridden = false;
    decisions = new ProvisionalDiagnosisDecisionSource();
    TestBed.configureTestingModule({
      imports: [DiagnosisComponent],
      providers: [
        { provide: DiagnosisSource, useValue: source },
        { provide: PatientHubSource, useClass: FakeHub },
        { provide: ConnectivityService, useValue: { online } },
        { provide: Location, useValue: location },
        { provide: DiagnosisDecisionSource, useValue: decisions },
        {
          provide: ProfessionalProfileReader,
          useValue: { read: (): ProfessionalProfile => ({ name: 'Dra. Ana', role }) },
        },
        { provide: NOW, useValue: (): Date => new Date(2026, 10, 20, 10, 30) },
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

    expect(el.querySelector('.page-header__subtitle')?.textContent).toContain(
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

  describe('decisão do médico', () => {
    const buttons = (el: HTMLElement): string[] =>
      Array.from(el.querySelectorAll('.diagnosis__actions app-button')).map(b => b.textContent?.trim() ?? '');
    const choose = (el: HTMLElement, name: string, value: string): void => {
      const select = el.querySelector<HTMLSelectElement>(
        `select[data-field="${name}"], select[data-criterion="${name}"]`,
      );

      if (select === null) {
        throw new Error(name);
      }
      select.value = value;
      select.dispatchEvent(new Event('change'));
      fixture.detectChanges();
    };
    const click = async (el: HTMLElement, label: string): Promise<void> => {
      const btn = Array.from(el.querySelectorAll<HTMLElement>('.diagnosis__actions app-button')).find(b =>
        b.textContent?.includes(label),
      );

      btn?.querySelector('button')?.click();
      await fixture.whenStable();
      fixture.detectChanges();
    };

    it('médico vê as três ações; não médico não as tem no DOM e vê o aviso de aguardando', async () => {
      expect(buttons(await render())).toEqual(['Confirmar', 'Alterar', 'Excluir']);
      fixture.destroy();
      role = 'other';
      const el = await render();

      expect(el.querySelector('.diagnosis__actions')).toBeNull();
      expect(el.textContent).toContain('Aguardando confirmação do médico');
    });

    it('sem triagem não há ações', async () => {
      source.reading = Promise.resolve({ ...CONFIRMED, screeningPositive: false });

      expect((await render()).querySelector('.diagnosis__actions')).toBeNull();
    });

    it('confirmar grava, audita e mostra quem confirmou, sem ações', async () => {
      const el = await render();

      await click(el, 'Confirmar');

      expect(el.textContent).toContain('Confirmado por Dra. Ana em 20/11/26 10:30.');
      expect(el.querySelector('.diagnosis__actions')).toBeNull();
      expect((await decisions.load('p1')).audit.map(e => e.action)).toEqual(['confirm']);
    });

    it('reabrir mostra o diagnóstico já confirmado, também offline', async () => {
      await render().then(el => click(el, 'Confirmar'));
      fixture.destroy();
      online.set(false);
      const el = await render();

      expect(el.textContent).toContain('Confirmado por Dra. Ana');
      expect(el.querySelector('.diagnosis__actions')).toBeNull();
    });

    it('offline as ações ficam desabilitadas com aviso em texto', async () => {
      online.set(false);
      const el = await render();

      expect(el.textContent).toContain('Sem conexão: confirmar, alterar e excluir precisam de conexão.');
      await click(el, 'Confirmar');
      await click(el, 'Alterar');
      await click(el, 'Excluir');

      expect((await decisions.load('p1')).audit).toEqual([]);
      expect(el.querySelector('app-confirm-dialog')?.textContent).not.toContain('Excluir diagnóstico?');
    });

    it('override sem entrada de auditoria não mostra o aviso de alteração', async () => {
      spyOn(decisions, 'load').and.resolveTo({
        audit: [],
        decision: null,
        override: { criteria: CONFIRMED.criteria, outcome: 'confirmed', staging: 'severe' },
      });

      expect((await render()).textContent).not.toContain('Alterado pelo médico:');
    });

    const callConfirm = (): void => (fixture.componentInstance as unknown as { confirm(): void }).confirm();

    it('confirmar sem paciente é ignorado', async () => {
      spyOn(decisions, 'apply');

      await render(null);
      callConfirm();

      expect(decisions.apply).not.toHaveBeenCalled();
    });

    it('confirmar sem resultado calculado é ignorado', async () => {
      spyOn(decisions, 'apply');

      source.reading = Promise.resolve({ ...CONFIRMED, screeningPositive: false });
      await render();
      callConfirm();

      expect((fixture.componentInstance as unknown as { rows(): [] }).rows()).toEqual([]);
      expect(decisions.apply).not.toHaveBeenCalled();
    });

    it('uma segunda ação enquanto grava é ignorada', async () => {
      const el = await render();
      const spy = spyOn(decisions, 'apply').and.returnValue(new Promise(() => undefined));

      await click(el, 'Confirmar');
      await click(el, 'Confirmar');

      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('falha ao gravar mostra erro e mantém o estado', async () => {
      spyOn(decisions, 'apply').and.rejectWith(new Error('x'));
      const el = await render();

      await click(el, 'Confirmar');

      expect(el.querySelector('[role="alert"]')?.textContent).toContain('Não foi possível gravar a decisão');
      expect(buttons(el).length).toBe(3);
    });

    it('excluir pede confirmação; cancelar não altera nada', async () => {
      const el = await render();

      await click(el, 'Excluir');

      expect(el.querySelector('app-confirm-dialog')?.textContent).toContain('Excluir diagnóstico?');
      el.querySelectorAll<HTMLElement>('app-confirm-dialog app-button button')[1]?.click();
      fixture.detectChanges();

      expect((await decisions.load('p1')).audit).toEqual([]);
      expect(buttons(el).length).toBe(3);
    });

    it('excluir confirmado mostra "Diagnóstico excluído" com autor e persiste', async () => {
      const el = await render();

      await click(el, 'Excluir');
      el.querySelectorAll<HTMLElement>('app-confirm-dialog app-button button')[0]?.click();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(el.textContent).toContain('Diagnóstico excluído');
      expect(el.textContent).toContain('Excluído por Dra. Ana em 20/11/26 10:30.');
      expect(el.querySelector('.diagnosis__actions')).toBeNull();
      expect((await decisions.load('p1')).audit.map(e => e.action)).toEqual(['exclude']);
      fixture.destroy();

      expect((await render()).textContent).toContain('Diagnóstico excluído');
    });

    it('alterar: salvar mostra o valor alterado, marcado, e ele vale ao confirmar', async () => {
      const el = await render();

      await click(el, 'Alterar');
      const select = el.querySelector<HTMLSelectElement>('select[data-field="outcome"]');

      expect(select?.value).toBe('confirmed');
      choose(el, 'outcome', 'excluded');
      fixture.detectChanges();
      const staging = el.querySelector<HTMLSelectElement>('select[data-field="staging"]');

      expect(staging?.disabled).toBeTrue();
      expect(el.querySelector('.alter__hint')?.textContent).toContain('foi limpo');
      choose(el, 'low-muscle-mass', 'negative');
      Array.from(el.querySelectorAll<HTMLElement>('.alter__actions app-button'))
        .find(b => b.textContent?.includes('Salvar'))
        ?.querySelector('button')
        ?.click();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(el.textContent).toContain('Desnutrição excluída');
      expect(el.textContent).toContain('Alterado pelo médico: Dra. Ana em 20/11/26 10:30.');
      await click(el, 'Confirmar');
      const record = await decisions.load('p1');

      expect(record.decision?.result.outcome).toBe('excluded');
      expect(record.decision?.result.criteria['low-muscle-mass']).toBe('negative');
      expect(record.audit.map(e => e.action)).toEqual(['alter', 'confirm']);
      expect(record.audit[0].before?.outcome).toBe('confirmed');
      expect(record.audit[0].after?.outcome).toBe('excluded');
    });

    it('alterar o estadiamento e cancelar o sheet', async () => {
      const el = await render();

      await click(el, 'Alterar');

      choose(el, 'staging', 'severe');
      choose(el, 'staging', '');
      Array.from(el.querySelectorAll<HTMLElement>('.alter__actions app-button'))
        .find(b => b.textContent?.includes('Cancelar'))
        ?.querySelector('button')
        ?.click();
      fixture.detectChanges();

      expect((await decisions.load('p1')).audit).toEqual([]);
      expect(el.querySelector<HTMLDialogElement>('dialog.alter')?.open).toBeFalse();
    });

    it('alterado persiste ao reabrir sem recalcular', async () => {
      await decisions.apply({
        action: 'alter',
        altered: {
          criteria: CONFIRMED.criteria,
          outcome: 'confirmed',
          staging: 'severe',
        },
        at: '2026-11-20T10:00:00',
        author: 'Dra. Ana',
        current: { criteria: CONFIRMED.criteria, outcome: 'confirmed', staging: 'moderate' },
        patientId: 'p1',
      });
      const el = await render();

      expect(el.textContent).toContain('Estadiamento: grave.');
      expect(el.textContent).toContain('Alterado pelo médico');
    });
  });

  describe('completar dados (indeterminado)', () => {
    const INDETERMINATE: GlimReading = {
      ...CONFIRMED,
      criteria: {
        ...CONFIRMED.criteria,
        inflammation: 'not-evaluated',
        'reduced-intake': 'not-evaluated',
        'weight-loss': 'not-evaluated',
      },
    };
    const completeButton = (el: HTMLElement): HTMLButtonElement | null =>
      Array.from(el.querySelectorAll<HTMLButtonElement>('app-button button')).find(b =>
        b.textContent?.includes('Completar dados'),
      ) ?? null;

    it('mostra a ação no indeterminado, também para não médico, e leva ao hub do paciente', async () => {
      role = 'other';
      source.reading = Promise.resolve(INDETERMINATE);
      const el = await render();
      const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);

      completeButton(el)?.click();

      expect(navigate).toHaveBeenCalledWith(['/patients', 'p1']);
    });

    it('não mostra a ação em confirmada, excluída nem sem triagem', async () => {
      expect(completeButton(await render())).toBeNull();
      source.reading = Promise.resolve({
        ...CONFIRMED,
        criteria: {
          ...CONFIRMED.criteria,
          'low-muscle-mass': 'negative',
          'low-bmi': 'negative',
          inflammation: 'negative',
          'reduced-intake': 'negative',
          'weight-loss': 'negative',
        },
      });

      expect(completeButton(await render())).toBeNull();
      source.reading = Promise.resolve({ ...CONFIRMED, screeningPositive: false });

      expect(completeButton(await render())).toBeNull();
    });

    it('recalcula com os dados completados ao reabrir a tela', async () => {
      source.reading = Promise.resolve(INDETERMINATE);
      let el = await render();

      expect(el.querySelector('.diagnosis__result')?.textContent).toBe('Indeterminado');
      source.reading = Promise.resolve(CONFIRMED);
      el = await render();

      expect(el.querySelector('.diagnosis__result')?.textContent).toContain('confirmada');
      expect(completeButton(el)).toBeNull();
    });

    it('sem id de paciente a ação é ignorada', async () => {
      const el = await render(null);

      expect(completeButton(el)).toBeNull();
    });
  });
});
