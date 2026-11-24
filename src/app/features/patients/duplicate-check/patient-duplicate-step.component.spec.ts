import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, of, Subject, throwError } from 'rxjs';

import { I18nService } from '../../../shared/services/i18n.service';
import { HospitalContextService } from '../../home/hospital-context.service';
import { PatientDuplicateStepComponent } from './patient-duplicate-step.component';
import { PatientDuplicateCheckResult, PatientsApiService } from './patients-api.service';

const francisco = { fullName: 'Francisco das Chagas', birthDate: '1980-05-05', id: 9, medicalRecordNumber: null };

const t = (key: string): string => TestBed.inject(I18nService).t(key);

describe('PatientDuplicateStepComponent', () => {
  let fixture: ComponentFixture<PatientDuplicateStepComponent>;
  let checkDuplicate: jasmine.Spy<PatientsApiService['checkDuplicate']>;
  let proceedSpy: jasmine.Spy;
  let existingSpy: jasmine.Spy;
  const selected = { value: { id: 3, name: 'H' } as { id: number; name: string } | null };

  function setup(response: Observable<PatientDuplicateCheckResult>): void {
    checkDuplicate.and.returnValue(response);
    TestBed.configureTestingModule({
      providers: [
        { provide: PatientsApiService, useValue: { checkDuplicate } },
        {
          provide: HospitalContextService,
          useValue: { selected: (): { id: number; name: string } | null => selected.value },
        },
      ],
    });
    fixture = TestBed.createComponent(PatientDuplicateStepComponent);
    fixture.componentRef.setInput('fullName', 'Francisco das Chagas');
    fixture.componentRef.setInput('birthDate', '1980-05-05');
    fixture.componentInstance.proceed.subscribe(proceedSpy);
    fixture.componentInstance.existingPatient.subscribe(existingSpy);
    fixture.detectChanges();
  }

  const text = (): string => (fixture.nativeElement as HTMLElement).textContent ?? '';
  const buttons = (): HTMLButtonElement[] =>
    Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'));

  beforeEach(() => {
    selected.value = { id: 3, name: 'H' };
    checkDuplicate = jasmine.createSpy('checkDuplicate');
    proceedSpy = jasmine.createSpy('proceedSpy');
    existingSpy = jasmine.createSpy('existingSpy');
  });

  it('consulta a API com o hospital ativo e mostra o carregamento', () => {
    setup(new Subject<PatientDuplicateCheckResult>());

    expect(checkDuplicate).toHaveBeenCalledWith({
      birthDate: '1980-05-05',
      fullName: 'Francisco das Chagas',
      hospitalId: 3,
      medicalRecordNumber: null,
    });

    expect(text()).toContain(t('patients.duplicate.checking'));
  });

  it('cenários 1 e 2: pergunta MSG-06 com nome, nascimento dd/mm/aaaa e SAME ausente', () => {
    setup(of({ candidates: [francisco], duplicate: true }));

    expect(text()).toContain(t('patients.duplicate.question'));
    expect(text()).toContain('Francisco das Chagas');
    expect(text()).toContain('05/05/1980');
    expect(text()).toContain(t('patients.duplicate.sameMissing'));
    expect(proceedSpy).not.toHaveBeenCalled();
  });

  it('mostra o SAME do paciente existente quando preenchido', () => {
    setup(of({ candidates: [{ ...francisco, medicalRecordNumber: 'A-123' }], duplicate: true }));

    expect(text()).toContain('A-123');
  });

  it('sem coincidência segue o cadastro sem perguntar', () => {
    setup(of({ candidates: [], duplicate: false }));

    expect(proceedSpy).toHaveBeenCalledTimes(1);
    expect(text()).not.toContain(t('patients.duplicate.question'));
  });

  it('cenário 3: "sim" emite o id do paciente existente e não prossegue', () => {
    setup(of({ candidates: [francisco], duplicate: true }));
    buttons()[0].click();

    expect(existingSpy).toHaveBeenCalledOnceWith(9);
    expect(proceedSpy).not.toHaveBeenCalled();
  });

  it('cenário 4: "não" prossegue com o cadastro', () => {
    setup(of({ candidates: [francisco], duplicate: true }));
    buttons()[1].click();

    expect(proceedSpy).toHaveBeenCalledTimes(1);
    expect(existingSpy).not.toHaveBeenCalled();
  });

  it('com vários candidatos, "sim" vale para o escolhido e "não" para todos', () => {
    setup(of({ candidates: [francisco, { ...francisco, id: 10 }], duplicate: true }));

    expect(buttons().length).toBe(3);
    buttons()[1].click();

    expect(existingSpy).toHaveBeenCalledOnceWith(10);
    buttons()[2].click();

    expect(proceedSpy).toHaveBeenCalledTimes(1);
  });

  for (const [status, snippet] of [
    [401, 'patients.duplicate.errors.401'],
    [403, 'patients.duplicate.errors.403'],
    [404, 'patients.duplicate.errors.404'],
    [422, 'patients.duplicate.errors.422'],
    [500, 'patients.duplicate.errors.generic'],
  ] as const) {
    it(`erro ${status} mostra mensagem em texto e não prossegue`, () => {
      setup(throwError(() => new HttpErrorResponse({ status })));

      expect(text()).toContain(t(snippet));
      expect(proceedSpy).not.toHaveBeenCalled();
    });
  }

  it('falha que não é HTTP (rede) usa a mensagem genérica e permite tentar de novo', () => {
    setup(throwError(() => new Error('rede')));

    expect(text()).toContain(t('patients.duplicate.errors.generic'));
    checkDuplicate.and.returnValue(of({ candidates: [francisco], duplicate: true }));
    buttons()[0].click();
    fixture.detectChanges();

    expect(text()).toContain(t('patients.duplicate.question'));
  });

  it('sem hospital ativo não consulta; "tentar de novo" mostra erro de hospital', () => {
    selected.value = null;
    setup(of({ candidates: [], duplicate: false }));

    expect(checkDuplicate).not.toHaveBeenCalled();
    (fixture.componentInstance as unknown as { retry(): void }).retry();
    fixture.detectChanges();

    expect(text()).toContain(t('patients.duplicate.errors.404'));
  });
});
