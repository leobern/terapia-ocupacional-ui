import { Location } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';

import { HospitalContextService } from '../home/hospital-context.service';
import { NutritionValues } from './nutrition-panel/nutrition-panel.models';
import { NutritionResultsSource } from './nutrition-panel/nutrition-results-source';
import { PatientHubComponent, reloadsOnVisibility } from './patient-hub.component';

describe('PatientHubComponent', () => {
  let fixture: ComponentFixture<PatientHubComponent>;
  let location: Location;
  let router: Router;

  let load: jasmine.Spy<(id: string) => Promise<NutritionValues>>;

  beforeEach(() => {
    load = jasmine.createSpy('load').and.resolveTo({});
  });

  const setup = (hospital: { name: string } | null, params: Record<string, string> = { id: 'p1' }): void => {
    TestBed.configureTestingModule({
      imports: [PatientHubComponent],
      providers: [
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap(params) } } },
        { provide: NutritionResultsSource, useValue: { load } },
        { provide: HospitalContextService, useValue: { selected: (): { name: string } | null => hospital } },
      ],
    });
    fixture = TestBed.createComponent(PatientHubComponent);
    location = TestBed.inject(Location);
    router = TestBed.inject(Router);
    fixture.detectChanges();
  };

  const el = (): HTMLElement => fixture.nativeElement;

  it('mostra título, hospital e data, e o painel com os 8 cards em "Sem dados"', () => {
    setup({ name: 'Hospital Vila Nova Star' });

    expect(el().querySelector('h1')?.textContent?.trim()).toBe('Paciente');
    expect(el().querySelector('.patient-hub__subtitle')?.textContent).toContain('Hospital Vila Nova Star ·');
    const values = Array.from(el().querySelectorAll('.nutrition-panel__value'));

    expect(values.length).toBe(8);
    expect(values.every(v => v.textContent?.trim() === 'Sem dados')).toBe(true);
  });

  it('reabrir o Hub mantém todos os cards (não dependem de ação do usuário)', () => {
    setup(null);
    fixture.destroy();
    fixture = TestBed.createComponent(PatientHubComponent);
    fixture.detectChanges();

    expect(el().querySelectorAll('.nutrition-panel__card').length).toBe(8);
    expect(el().querySelector('.patient-hub__subtitle')?.textContent).not.toContain('·  ·');
  });

  it('voltar usa o histórico quando existe', () => {
    setup(null);
    spyOn(location, 'back');

    spyOnProperty(window.history, 'length').and.returnValue(3);
    el().querySelector<HTMLElement>('app-icon-button button')?.click();

    expect(location.back).toHaveBeenCalledWith();
  });

  it('voltar sem histórico vai para a listagem', () => {
    setup(null);
    spyOn(router, 'navigate').and.resolveTo(true);

    spyOnProperty(window.history, 'length').and.returnValue(1);
    el().querySelector<HTMLElement>('app-icon-button button')?.click();

    expect(router.navigate).toHaveBeenCalledWith(['/patients']);
  });

  const valueTexts = (): (string | undefined)[] =>
    Array.from(el().querySelectorAll('.nutrition-panel__value')).map(v => v.textContent?.trim());

  it('ao abrir, lê os resultados do paciente da rota', async () => {
    setup(null);
    await fixture.whenStable();

    expect(load).toHaveBeenCalledWith('p1');
  });

  it('ao abrir, mostra o resultado de cada protocolo de forma independente', async () => {
    load.and.resolveTo({ 'nrs-2002': 'Em risco', 'therapy-type': 'Enteral', 'calorie-adequacy': '80%' });
    setup(null);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(valueTexts()).toEqual([
      'Sem dados',
      'Sem dados',
      'Em risco',
      'Sem dados',
      'Sem dados',
      'Enteral',
      '80%',
      'Sem dados',
    ]);
  });

  it('não atualiza sozinho: só recarrega ao atualizar, e mostra o resultado novo', async () => {
    setup(null);
    await fixture.whenStable();

    expect(load).toHaveBeenCalledTimes(1);
    load.and.resolveTo({ glim: 'Desnutrição' });
    fixture.detectChanges();

    expect(valueTexts()[3]).toBe('Sem dados');
    el().querySelector<HTMLElement>('.patient-hub__header > app-icon-button:last-child button')?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(valueTexts()[3]).toBe('Desnutrição');
  });

  it('retomar foco recarrega; oculto não', async () => {
    setup(null);
    await fixture.whenStable();
    window.dispatchEvent(new Event('focus'));

    expect(load).toHaveBeenCalledTimes(2);
    expect(reloadsOnVisibility('visible')).toBe(true);
    expect(reloadsOnVisibility('hidden')).toBe(false);
    document.dispatchEvent(new Event('visibilitychange'));
    await fixture.whenStable();

    expect(load.calls.count()).toBeGreaterThanOrEqual(2);
  });

  it('puxar para atualizar recarrega; arrasto curto ou fora do topo não', async () => {
    setup(null);
    await fixture.whenStable();
    const touch = (type: string, y: number): void => {
      const t = { clientY: y } as Touch;

      el().dispatchEvent(
        Object.assign(new Event(type), { changedTouches: [t], touches: [t] }) as unknown as TouchEvent,
      );
    };

    touch('touchstart', 10);
    touch('touchend', 50);

    expect(load).toHaveBeenCalledTimes(1);
    touch('touchstart', 10);
    touch('touchend', 200);

    expect(load).toHaveBeenCalledTimes(2);

    spyOnProperty(window, 'scrollY').and.returnValue(40);
    touch('touchstart', 10);
    touch('touchend', 200);

    expect(load).toHaveBeenCalledTimes(2);
  });

  it('se a recarga falhar, mantém os valores já exibidos', async () => {
    load.and.resolveTo({ glim: 'Desnutrição' });
    setup(null);
    await fixture.whenStable();
    load.and.rejectWith(new Error('offline'));
    await fixture.componentInstance.reload();
    fixture.detectChanges();

    expect(valueTexts()[3]).toBe('Desnutrição');
  });

  it('visibilitychange oculto não recarrega', async () => {
    setup(null);
    await fixture.whenStable();
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
    Reflect.deleteProperty(document, 'visibilityState');

    expect(load).toHaveBeenCalledTimes(1);
  });

  it('visibilitychange visível recarrega', async () => {
    setup(null);
    await fixture.whenStable();
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
    Reflect.deleteProperty(document, 'visibilityState');

    expect(load).toHaveBeenCalledTimes(2);
  });

  it('rota sem id consulta com id vazio', async () => {
    setup(null, {});
    await fixture.whenStable();

    expect(load).toHaveBeenCalledWith('');
  });
});
