import { TestBed } from '@angular/core/testing';

import { Prescription } from './prescription.models';
import { PrescriptionGuidanceComponent } from './prescription-guidance.component';
import { PrescriptionSource } from './prescription-source';
import { PrescriptionSummaryComponent } from './prescription-summary.component';

const rx: Prescription = {
  route: 'NE',
  at: '2026-11-21T10:00:00Z',
  author: 'Dra. Ana',
  formulaId: 'a',
  formulaName: 'Hiper',
  kcalPerMl: 1.5,
  modality: 'intermittent',
  nursingNotes: 'Não desconectar a bolsa',
  pauseTimes: ['12:00', '20:00'],
  proteinPerMl: 0.06,
  startTime: '08:00',
  volumeMl: 1200,
};

describe('PrescriptionSummaryComponent', () => {
  it('mostra fórmula, volume, modalidade, horários e orientações', () => {
    const f = TestBed.createComponent(PrescriptionSummaryComponent);

    f.componentRef.setInput('prescriptions', [rx]);
    f.detectChanges();
    const text = (f.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('Hiper');
    expect(text).toContain('1.200 mL/dia');
    expect(text).toContain('Intermitente');
    expect(text).toContain('Início 08:00 · pausa 12:00, 20:00');
    expect(text).toContain('Não desconectar a bolsa');
  });

  it('com showAuthor mostra o médico que prescreveu e quando; sem ele não mostra', () => {
    const f = TestBed.createComponent(PrescriptionSummaryComponent);
    const el = f.nativeElement as HTMLElement;

    f.componentRef.setInput('prescriptions', [rx]);
    f.detectChanges();

    expect(el.querySelector('[data-testid="rx-summary-author"]')).toBeNull();
    f.componentRef.setInput('showAuthor', true);
    f.detectChanges();

    expect(el.querySelector('[data-testid="rx-summary-author"]')?.textContent).toContain('Dra. Ana');
    expect(el.querySelector('[data-testid="rx-summary-author"]')?.textContent).toContain('Médico ·');
  });

  it('sem orientações não mostra o campo; contínua mostra só o início; sem prescrição não renderiza', () => {
    const f = TestBed.createComponent(PrescriptionSummaryComponent);

    f.componentRef.setInput('prescriptions', [{ ...rx, modality: 'continuous', nursingNotes: '', pauseTimes: [] }]);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;

    expect(el.querySelector('[data-testid="rx-summary-notes"]')).toBeNull();
    expect(el.textContent).toContain('Início 08:00');
    expect(el.textContent).not.toContain('pausa');
    f.componentRef.setInput('prescriptions', []);
    f.detectChanges();

    expect(el.querySelector('[data-testid="rx-summary"]')).toBeNull();
  });
});

describe('PrescriptionGuidanceComponent', () => {
  const setup = async (
    load: () => Promise<readonly Prescription[]>,
  ): Promise<{ el: HTMLElement; open: (v: boolean) => Promise<void>; settle: () => Promise<void> }> => {
    TestBed.configureTestingModule({ providers: [{ provide: PrescriptionSource, useValue: { load } }] });
    const f = TestBed.createComponent(PrescriptionGuidanceComponent);
    const open = async (value: boolean): Promise<void> => {
      f.componentRef.setInput('open', value);
      f.detectChanges();
      await f.whenStable();
      f.detectChanges();
    };

    const settle = async (): Promise<void> => {
      await f.whenStable();
      f.detectChanges();
    };

    f.componentRef.setInput('patientId', 'p1');

    return { el: f.nativeElement as HTMLElement, open, settle };
  };

  it('ao abrir, mostra horários e orientações da prescrição vigente', async () => {
    const { el, open } = await setup(() => Promise.resolve([rx]));

    await open(true);

    expect(el.textContent).toContain('Prescrição vigente');
    expect(el.textContent).toContain('Não desconectar a bolsa');
  });

  it('falha ao carregar ou sem prescrição não mostra nada; fechado não lê', async () => {
    let calls = 0;
    const { el, open } = await setup(() => {
      calls++;

      return Promise.reject(new Error('x'));
    });

    await open(false);

    expect(calls).toBe(0);
    await open(true);

    expect(el.querySelector('[data-testid="rx-summary"]')).toBeNull();
  });

  it('descarta resposta de uma abertura anterior', async () => {
    const resolvers: ((v: readonly Prescription[]) => void)[] = [];
    const { el, open, settle } = await setup(() => new Promise(r => resolvers.push(r)));

    await open(true);
    await open(false);
    await open(true);
    resolvers[1]([rx]);
    await settle();
    resolvers[0]([]);
    await settle();

    expect(el.textContent).toContain('Hiper');
  });
});
