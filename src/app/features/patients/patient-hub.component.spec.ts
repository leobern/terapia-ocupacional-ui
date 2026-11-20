import { Location } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { HospitalContextService } from '../home/hospital-context.service';
import { PatientHubComponent } from './patient-hub.component';

describe('PatientHubComponent', () => {
  let fixture: ComponentFixture<PatientHubComponent>;
  let location: Location;
  let router: Router;

  const setup = (hospital: { name: string } | null): void => {
    TestBed.configureTestingModule({
      imports: [PatientHubComponent],
      providers: [{ provide: HospitalContextService, useValue: { selected: (): { name: string } | null => hospital } }],
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
});
