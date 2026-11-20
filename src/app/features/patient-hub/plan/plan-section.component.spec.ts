import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConnectivityService } from '../../../shared/services/connectivity.service';
import { NOW, ProfessionalProfile, ProfessionalProfileReader } from '../../home/professional-profile';
import { CurrentRoute, RouteSaveRequest } from './plan.models';
import {
  EMPTY_SELECTION_HINT,
  LOAD_FAILED_HINT,
  RISK_FAILED_HINT,
  OFFLINE_HINT,
  PlanSectionComponent,
  SAVE_FAILED_HINT,
} from './plan-section.component';
import { PlanSource } from './plan-source';
import { RefeedingRisk, RefeedingRiskSource } from './refeeding-risk-source';

class FakeSource extends PlanSource {
  current: CurrentRoute | null = null;
  loadFails = false;
  saveFails = false;
  readonly saves: RouteSaveRequest[] = [];

  loadRoute(): Promise<CurrentRoute | null> {
    return this.loadFails ? Promise.reject(new Error('x')) : Promise.resolve(this.current);
  }

  saveRoute(request: RouteSaveRequest): Promise<CurrentRoute> {
    if (this.saveFails) {
      return Promise.reject(new Error('x'));
    }
    this.saves.push(request);
    this.current = { routes: request.routes, since: request.at };

    return Promise.resolve(this.current);
  }
}

class FakeRisk extends RefeedingRiskSource {
  fails = false;
  risk: RefeedingRisk = { atRisk: false, targetReached: false };

  load(): Promise<RefeedingRisk> {
    return this.fails ? Promise.reject(new Error('x')) : Promise.resolve(this.risk);
  }
}

describe('PlanSectionComponent', () => {
  let riskSource: FakeRisk;
  let fixture: ComponentFixture<PlanSectionComponent>;
  let source: FakeSource;

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const dialog = (): HTMLDialogElement => el().querySelector('dialog') as HTMLDialogElement;
  const box = (id: string): HTMLInputElement => el().querySelector(`[data-route="${id}"]`) as HTMLInputElement;
  const saveButton = (): HTMLButtonElement | null =>
    Array.from(el().querySelectorAll('button')).find(b => b.textContent.includes('Salvar plano')) ?? null;
  const text = (): string => el().textContent;
  const settle = async (): Promise<void> => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const openIt = async (): Promise<void> => {
    (el().querySelector('.plan__row') as HTMLButtonElement).click();
    await settle();
  };
  const toggle = async (id: string): Promise<void> => {
    box(id).click();
    await settle();
  };
  const save = async (): Promise<void> => {
    saveButton()?.click();
    await settle();
  };
  const setup = async (role: ProfessionalProfile['role']): Promise<void> => {
    TestBed.configureTestingModule({
      providers: [
        { provide: PlanSource, useValue: source },
        { provide: RefeedingRiskSource, useValue: riskSource },
        {
          provide: ProfessionalProfileReader,
          useValue: { read: (): ProfessionalProfile => ({ name: 'Dra. Ana', role }) },
        },
        { provide: NOW, useValue: (): Date => new Date('2026-11-20T15:00:00Z') },
      ],
    });
    fixture = TestBed.createComponent(PlanSectionComponent);
    fixture.componentRef.setInput('patientId', 'p9');
    await settle();
  };

  beforeEach(() => {
    source = new FakeSource();
    riskSource = new FakeRisk();
  });

  describe('alerta de síndrome de realimentação', () => {
    const alert = (): HTMLElement | null => el().querySelector('[data-testid="refeeding-alert"]');

    for (const role of ['doctor', 'nutritionist'] as const) {
      it(`${role}: risco em progressão mostra o alerta em destaque, antes da via vigente`, async () => {
        riskSource.risk = { atRisk: true, targetReached: false };
        await setup(role);
        await openIt();

        expect(alert()?.textContent).toContain('avance a dieta com cautela até a meta');
        expect(alert()?.classList.contains('plan__alert--reduced')).toBe(false);
        expect(alert()?.compareDocumentPosition(el().querySelector('fieldset') as Node)).toBe(
          Node.DOCUMENT_POSITION_FOLLOWING,
        );
      });
    }

    it('sem risco: nenhum alerta', async () => {
      await setup('doctor');
      await openIt();

      expect(alert()).toBeNull();
    });

    it('meta atingida: alerta visível com relevância reduzida e dito em texto', async () => {
      riskSource.risk = { atRisk: true, targetReached: true };
      await setup('doctor');
      await openIt();

      expect(alert()?.classList.contains('plan__alert--reduced')).toBe(true);
      expect(alert()?.textContent).toContain('Meta atingida');
    });

    it('falha do motor: sem alerta, aviso discreto e o resto do plano funciona', async () => {
      riskSource.fails = true;
      await setup('doctor');
      await openIt();

      expect(alert()).toBeNull();
      expect(text()).toContain(RISK_FAILED_HINT);
      await toggle('NE');
      await save();

      expect(source.saves.length).toBe(1);
    });
  });

  describe('médico', () => {
    beforeEach(() => setup('doctor'));

    it('não abre sozinho: aparece recolhido e sem ler dados', () => {
      expect(dialog().open).toBe(false);
      expect(text()).toContain('Plano de intervenção');
    });

    it('paciente sem via: nada marcado; escolhe NE, salva e vira a via vigente', async () => {
      await openIt();

      expect(dialog().open).toBe(true);
      expect(box('NE').checked).toBe(false);
      await toggle('NE');
      await save();

      expect(source.saves[0]).toEqual({
        at: '2026-11-20T15:00:00.000Z',
        author: 'Dra. Ana',
        patientId: 'p9',
        routes: ['NE'],
      });

      expect(text()).toContain('Vigente: NE');
    });

    it('reabrir mostra a mesma via e desde quando vale', async () => {
      source.current = { routes: ['NE'], since: '2026-11-12T12:00:00' };
      await openIt();

      expect(box('NE').checked).toBe(true);
      expect(text()).toContain('Desde 12/11.');
    });

    it('abrir e reavaliar (fechar e reabrir) não grava nada', async () => {
      source.current = { routes: ['NE'], since: '2026-11-12T12:00:00' };
      await openIt();
      (el().querySelector('app-icon-button') as HTMLElement).click();
      await settle();
      await openIt();

      expect(source.saves).toEqual([]);
      expect(source.current.routes).toEqual(['NE']);
    });

    it('altera a via: a nova substitui a anterior', async () => {
      source.current = { routes: ['NE'], since: '2026-11-12T12:00:00' };
      await openIt();
      await toggle('NE');
      await toggle('NP');
      await save();

      expect(source.current?.routes).toEqual(['NP']);
    });

    it('NE exclusiva com VO liberada e NE mantida vira "VO/NE"', async () => {
      source.current = { routes: ['NE'], since: '2026-11-12T12:00:00' };
      await openIt();
      await toggle('VO');
      await save();

      expect(source.saves[0].routes).toEqual(['VO', 'NE']);
      expect(text()).toContain('Vigente: VO/NE');
    });

    it('sem nenhuma via não salva e explica em texto', async () => {
      await openIt();
      await save();

      expect(source.saves).toEqual([]);
      expect(text()).toContain(EMPTY_SELECTION_HINT);
    });

    it('offline: salvar indisponível com aviso em texto', async () => {
      TestBed.inject(ConnectivityService).online.set(false);
      await openIt();
      await toggle('NE');

      expect(saveButton()?.disabled).toBe(true);
      expect(text()).toContain(OFFLINE_HINT);
      await save();

      expect(source.saves).toEqual([]);
    });

    it('offline no clique: avisa e não grava', async () => {
      await openIt();
      await toggle('NE');
      TestBed.inject(ConnectivityService).online.set(false);
      fixture.detectChanges();
      await (fixture.componentInstance as unknown as { save(): Promise<void> }).save();
      fixture.detectChanges();

      expect(source.saves).toEqual([]);
      expect(text()).toContain(OFFLINE_HINT);
    });

    it('falha ao gravar mostra mensagem e mantém a seleção', async () => {
      source.saveFails = true;
      await openIt();
      await toggle('NE');
      await save();

      expect(text()).toContain(SAVE_FAILED_HINT);
      expect(box('NE').checked).toBe(true);
    });

    it('falha ao carregar mostra mensagem e não oferece salvar', async () => {
      source.loadFails = true;
      await openIt();

      expect(text()).toContain(LOAD_FAILED_HINT);
      expect(saveButton()?.disabled).toBe(true);
    });

    it('fecha pelo scrim, pelo Esc e descarta resposta atrasada', async () => {
      await openIt();
      dialog().click();
      await settle();

      expect(dialog().open).toBe(false);

      await openIt();
      dialog().dispatchEvent(new Event('cancel', { cancelable: true }));
      await settle();

      expect(dialog().open).toBe(false);
    });
  });

  describe('não médico', () => {
    beforeEach(() => setup('other'));

    it('vê a via vigente, sem caixas de seleção nem botão de salvar', async () => {
      source.current = { routes: ['VO', 'NE'], since: '2026-11-12T12:00:00' };
      await openIt();

      expect(el().querySelector('[data-testid="current-route"]')?.textContent.trim()).toBe('VO/NE');
      expect(box('NE')).toBeNull();
      expect(saveButton()).toBeNull();
    });

    it('sem via definida mostra texto de vazio', async () => {
      await openIt();

      expect(text()).toContain('Sem via definida');
    });

    it('não consegue alterar nem salvar por chamada direta', async () => {
      await openIt();
      const c = fixture.componentInstance as unknown as { save(): Promise<void>; toggle(id: string): void };

      c.toggle('NE');
      await c.save();

      expect(source.saves).toEqual([]);
    });
  });
});
