import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConnectivityService } from '../../../shared/services/connectivity.service';
import { NOW, ProfessionalProfileReader } from '../../home/professional-profile';
import { NutritionCardModalComponent } from './nutrition-card-modal.component';
import { NutritionHistorySource, NutritionValueWriter } from './nutrition-card-ports';
import { ProvisionalNutritionCardStore } from './provisional-nutrition-card-store';

describe('NutritionCardModalComponent', () => {
  let fixture: ComponentFixture<NutritionCardModalComponent>;
  let store: ProvisionalNutritionCardStore;

  const dialog = (): HTMLDialogElement => fixture.nativeElement.querySelector('dialog');
  const settle = async (): Promise<void> => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  // Chama o método protegido sem passar pelo DOM (o botão fica desabilitado em alguns estados).
  const save = (): Promise<void> => (fixture.componentInstance as unknown as { save(): Promise<void> }).save();

  beforeEach(() => {
    store = new ProvisionalNutritionCardStore();
    TestBed.configureTestingModule({
      providers: [
        { provide: NutritionHistorySource, useValue: store },
        { provide: NutritionValueWriter, useValue: store },
        { provide: ProfessionalProfileReader, useValue: { read: (): { name: string } => ({ name: 'Michelle' }) } },
        { provide: NOW, useValue: (): Date => new Date(2026, 4, 28, 12) },
      ],
    });
    fixture = TestBed.createComponent(NutritionCardModalComponent);
  });

  it('fica fechado sem indicador', async () => {
    await settle();

    expect(dialog().open).toBe(false);
  });

  it('não grava sem paciente ou sem indicador', async () => {
    fixture.componentRef.setInput('indicator', 'weight');
    await settle();
    await save();

    expect(store.auditTrail.length).toBe(0);
    expect(fixture.nativeElement.textContent).not.toContain('Histórico desta internação');
  });

  it('offline: chamada direta a salvar não grava e mostra a conexão necessária', async () => {
    fixture.componentRef.setInput('indicator', 'weight');
    fixture.componentRef.setInput('patientId', 'p1');
    TestBed.inject(ConnectivityService).online.set(false);
    await settle();
    await save();
    await settle();

    expect(store.auditTrail.length).toBe(0);
    expect(fixture.nativeElement.textContent).toContain('Conexão necessária para salvar o valor.');
  });

  it('falha ao carregar o histórico mantém o modal utilizável', async () => {
    spyOn(store, 'load').and.rejectWith(new Error('x'));
    fixture.componentRef.setInput('indicator', 'weight');
    fixture.componentRef.setInput('patientId', 'p1');
    await settle();

    expect(dialog().open).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Ainda sem valor');
  });

  it('fecha o dialog quando o indicador volta a nulo', async () => {
    fixture.componentRef.setInput('indicator', 'weight');
    fixture.componentRef.setInput('patientId', 'p1');
    await settle();
    fixture.componentRef.setInput('indicator', null);
    await settle();

    expect(dialog().open).toBe(false);
  });
});
