import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConnectivityService } from '../../../shared/services/connectivity.service';
import { NOW, ProfessionalProfile, ProfessionalProfileReader } from '../../home/professional-profile';
import { CurrentRoute, normalizeRoutes, RouteSaveRequest } from '../plan/plan.models';
import { PlanSource } from '../plan/plan-source';
import {
  ROUTE_EMPTY_HINT,
  ROUTE_LOAD_FAILED_HINT,
  ROUTE_OFFLINE_HINT,
  ROUTE_SAVE_FAILED_HINT,
  RouteChangeComponent,
} from './route-change.component';

class FakePlan {
  route: CurrentRoute | null = { routes: ['VO'], since: '2026-11-10T08:00:00.000Z' };
  loadFails = false;
  saveFails = false;
  readonly saved: RouteSaveRequest[] = [];

  loadRoute(): Promise<CurrentRoute | null> {
    return this.loadFails ? Promise.reject(new Error('x')) : Promise.resolve(this.route);
  }

  saveRoute(request: RouteSaveRequest): Promise<CurrentRoute> {
    if (this.saveFails) {
      return Promise.reject(new Error('x'));
    }
    this.saved.push(request);
    this.route = { routes: normalizeRoutes(request.routes), since: request.at };

    return Promise.resolve(this.route);
  }
}

describe('RouteChangeComponent', () => {
  let fixture: ComponentFixture<RouteChangeComponent>;
  let plan: FakePlan;
  const online = signal(true);
  const emitted: CurrentRoute[] = [];

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const text = (): string => el().textContent.replace(/\s+/gu, ' ');
  const button = (label: string): HTMLButtonElement | null =>
    Array.from(el().querySelectorAll('button')).find(b => b.textContent.includes(label)) ?? null;
  const box = (id: string): HTMLInputElement => el().querySelector(`input[data-route="${id}"]`) as HTMLInputElement;
  const settle = async (): Promise<void> => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const setup = async (role: ProfessionalProfile['role'] = 'doctor'): Promise<void> => {
    TestBed.configureTestingModule({
      providers: [
        { provide: PlanSource, useValue: plan },
        {
          provide: ProfessionalProfileReader,
          useValue: { read: (): ProfessionalProfile => ({ name: 'Dra. Ana', role }) },
        },
        { provide: NOW, useValue: (): Date => new Date('2026-11-21T10:00:00Z') },
        { provide: ConnectivityService, useValue: { online } },
      ],
    });
    fixture = TestBed.createComponent(RouteChangeComponent);
    fixture.componentRef.setInput('patientId', 'p1');
    fixture.componentInstance.routeSaved.subscribe(r => emitted.push(r));
    await settle();
  };
  const edit = async (): Promise<void> => {
    button('Alterar via')?.click();
    await settle();
  };
  const click = async (id: string): Promise<void> => {
    box(id).click();
    await settle();
  };
  const saveClick = async (): Promise<void> => {
    button('Salvar via')?.click();
    await settle();
  };

  beforeEach(() => {
    plan = new FakePlan();
    online.set(true);
    emitted.length = 0;
  });

  it('médico vê a via vigente e a ação de alterar', async () => {
    await setup();

    expect(text()).toContain('Via de nutriçãoVO');
    expect(button('Alterar via')).not.toBeNull();
  });

  it('não médico só vê a via vigente, sem a ação', async () => {
    await setup('other');

    expect(text()).toContain('VO');
    expect(button('Alterar via')).toBeNull();
    expect(el().querySelector('input')).toBeNull();
  });

  it('não médico não consegue iniciar a edição nem salvar', async () => {
    await setup('other');
    const c = fixture.componentInstance as unknown as { startEditing(): void; save(): Promise<void> };

    c.startEditing();
    await c.save();

    expect(plan.saved).toEqual([]);
  });

  it('VO para VO/NE: salva via mista combinada, com autor e data/hora, e emite', async () => {
    await setup();
    await edit();
    await click('NE');
    await saveClick();

    expect(plan.saved).toEqual([
      { at: '2026-11-21T10:00:00.000Z', author: 'Dra. Ana', patientId: 'p1', routes: ['VO', 'NE'] },
    ]);

    expect(text()).toContain('VO/NE');
    expect(emitted.length).toBe(1);
    expect(button('Salvar via')).toBeNull();
  });

  it('via mista é ordenada na ordem padronizada', async () => {
    plan.route = { routes: ['NP'], since: '2026-11-10T08:00:00.000Z' };
    await setup();
    await edit();
    await click('VO');
    await saveClick();

    expect(plan.saved[0].routes).toEqual(['VO', 'NP']);
  });

  it('exige ao menos uma via', async () => {
    await setup();
    await edit();
    await click('VO');
    await saveClick();

    expect(text()).toContain(ROUTE_EMPTY_HINT);
    expect(plan.saved).toEqual([]);
  });

  it('salvar sem mudança não regrava nem renova o "desde quando"', async () => {
    await setup();
    await edit();
    await saveClick();

    expect(plan.saved).toEqual([]);
    expect(emitted).toEqual([]);
    expect(button('Alterar via')).not.toBeNull();
  });

  it('cancelar descarta a seleção', async () => {
    await setup();
    await edit();
    await click('NE');
    button('Cancelar')?.click();
    await settle();

    expect(plan.saved).toEqual([]);
    expect(text()).toContain('VO');
    expect(text()).not.toContain('VO/NE');
  });

  it('falha ao salvar mantém a via anterior e informa o erro', async () => {
    plan.saveFails = true;
    await setup();
    await edit();
    await click('NE');
    await saveClick();

    expect(text()).toContain(ROUTE_SAVE_FAILED_HINT);
    expect(el().querySelector('[data-testid="route-current"]')?.textContent).toContain('VO');
    expect(emitted).toEqual([]);
  });

  it('offline: via vigente visível e alteração indisponível com mensagem', async () => {
    online.set(false);
    await setup();

    expect(text()).toContain('VO');
    expect(text()).toContain(ROUTE_OFFLINE_HINT);
    expect(button('Alterar via')?.disabled).toBe(true);
    (fixture.componentInstance as unknown as { startEditing(): void }).startEditing();
    await settle();

    expect(el().querySelector('[data-testid="route-hint"]')?.textContent).toContain(ROUTE_OFFLINE_HINT);
  });

  it('cair offline durante a edição bloqueia o salvamento', async () => {
    await setup();
    await edit();
    await click('NE');
    online.set(false);
    await settle();
    await (fixture.componentInstance as unknown as { save(): Promise<void> }).save();
    await settle();

    expect(plan.saved).toEqual([]);
    expect(text()).toContain(ROUTE_OFFLINE_HINT);
  });

  it('sem via definida mostra o aviso e permite definir', async () => {
    plan.route = null;
    await setup();

    expect(text()).toContain('Sem via definida');
    await edit();
    await click('NE');
    await saveClick();

    expect(text()).toContain('NE');
  });

  it('falha ao carregar avisa em texto', async () => {
    plan.loadFails = true;
    await setup();

    expect(text()).toContain(ROUTE_LOAD_FAILED_HINT);
  });

  it('trocar de paciente descarta resposta atrasada', async () => {
    await setup();
    fixture.componentRef.setInput('patientId', 'p2');
    plan.route = { routes: ['NP'], since: '2026-11-10T08:00:00.000Z' };
    await settle();

    expect(text()).toContain('NP');
  });
});
