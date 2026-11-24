import { ComponentFixture, TestBed } from '@angular/core/testing';

import { I18nService } from '../../../shared/services/i18n.service';
import { HospitalContextService } from '../../home/hospital-context.service';
import { DuplicateCheckInput, DuplicateCheckOutcome, PatientMatch } from '../patient-duplicate.models';
import { PatientDuplicateCheckService } from '../patient-duplicate-check.service';
import { PatientDuplicateStepComponent } from './patient-duplicate-step.component';

const francisco: PatientMatch = {
  birthDate: '1980-05-05',
  fullName: 'Francisco das Chagas',
  id: 9,
  medicalRecordNumber: null,
};

const t = (key: string): string => TestBed.inject(I18nService).t(key);

describe('PatientDuplicateStepComponent', () => {
  let fixture: ComponentFixture<PatientDuplicateStepComponent>;
  let check: jasmine.Spy<(input: DuplicateCheckInput) => Promise<DuplicateCheckOutcome>>;
  let proceedSpy: jasmine.Spy;
  let existingSpy: jasmine.Spy;
  const selected = { value: { id: 3, name: 'H' } as { id: number; name: string } | null };

  const matches = (...found: PatientMatch[]): DuplicateCheckOutcome => ({
    kind: 'matches',
    lines: [],
    matches: found,
    next: 'sex',
  });

  async function setup(response: Promise<DuplicateCheckOutcome>, same?: string): Promise<void> {
    check.and.returnValue(response);
    TestBed.configureTestingModule({
      providers: [
        { provide: PatientDuplicateCheckService, useValue: { check } },
        {
          provide: HospitalContextService,
          useValue: { selected: (): { id: number; name: string } | null => selected.value },
        },
      ],
    });
    fixture = TestBed.createComponent(PatientDuplicateStepComponent);
    fixture.componentRef.setInput('fullName', 'Francisco das Chagas');
    fixture.componentRef.setInput('birthDate', '1980-05-05');
    if (same !== undefined) {
      fixture.componentRef.setInput('medicalRecordNumber', same);
    }
    fixture.componentInstance.proceed.subscribe(proceedSpy);
    fixture.componentInstance.existingPatient.subscribe(existingSpy);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const text = (): string => (fixture.nativeElement as HTMLElement).textContent ?? '';
  const buttons = (): HTMLButtonElement[] =>
    Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'));

  beforeEach(() => {
    selected.value = { id: 3, name: 'H' };
    check = jasmine.createSpy('check');
    proceedSpy = jasmine.createSpy('proceedSpy');
    existingSpy = jasmine.createSpy('existingSpy');
  });

  it('consulta o serviço com o hospital ativo e mostra o carregamento enquanto espera', async () => {
    await setup(new Promise<DuplicateCheckOutcome>(() => undefined));

    expect(check).toHaveBeenCalledWith({
      birthDate: '1980-05-05',
      fullName: 'Francisco das Chagas',
      hospitalId: 3,
      medicalRecordNumber: null,
    });

    expect(text()).toContain(t('patientRegistration.duplicate.checking'));
  });

  it('repassa o SAME informado ao serviço', async () => {
    await setup(Promise.resolve({ kind: 'no-match', next: 'sex' }), 'A-1');

    expect(check.calls.mostRecent().args[0].medicalRecordNumber).toBe('A-1');
  });

  it('cenários 1 e 2: pergunta MSG-06 com nome, nascimento dd/mm/aaaa e SAME ausente', async () => {
    await setup(Promise.resolve(matches(francisco)));

    expect(text()).toContain(t('patientRegistration.duplicate.question'));
    expect(text()).toContain('Francisco das Chagas');
    expect(text()).toContain('05/05/1980');
    expect(text()).toContain(t('patientRegistration.duplicate.sameMissing'));
    expect(proceedSpy).not.toHaveBeenCalled();
  });

  it('mostra o SAME do paciente existente quando preenchido', async () => {
    await setup(Promise.resolve(matches({ ...francisco, medicalRecordNumber: 'A-123' })));

    expect(text()).toContain('A-123');
  });

  it('sem coincidência segue o cadastro sem perguntar', async () => {
    await setup(Promise.resolve({ kind: 'no-match', next: 'sex' }));

    expect(proceedSpy).toHaveBeenCalledTimes(1);
    expect(text()).not.toContain(t('patientRegistration.duplicate.question'));
  });

  it('cenário 3: "sim" emite o id do paciente existente e não prossegue', async () => {
    await setup(Promise.resolve(matches(francisco)));
    buttons()[0].click();

    expect(existingSpy).toHaveBeenCalledOnceWith(9);
    expect(proceedSpy).not.toHaveBeenCalled();
  });

  it('cenário 4: "não" prossegue com o cadastro', async () => {
    await setup(Promise.resolve(matches(francisco)));
    buttons()[1].click();

    expect(proceedSpy).toHaveBeenCalledTimes(1);
    expect(existingSpy).not.toHaveBeenCalled();
  });

  it('com vários candidatos, "sim" vale para o escolhido e "não" para todos', async () => {
    await setup(Promise.resolve(matches(francisco, { ...francisco, id: 10 })));

    expect(buttons().length).toBe(3);
    buttons()[1].click();

    expect(existingSpy).toHaveBeenCalledOnceWith(10);
    buttons()[2].click();

    expect(proceedSpy).toHaveBeenCalledTimes(1);
  });

  for (const kind of ['access-denied', 'invalid-date', 'invalid-name', 'session-expired', 'unavailable'] as const) {
    it(`erro "${kind}" mostra a mensagem em texto e não prossegue`, async () => {
      await setup(Promise.resolve({ kind, message: `mensagem ${kind}` }));

      expect(text()).toContain(`mensagem ${kind}`);
      expect(proceedSpy).not.toHaveBeenCalled();
    });
  }

  it('falha inesperada do serviço usa a mensagem de indisponível e permite tentar de novo', async () => {
    await setup(Promise.reject(new Error('rede')));

    expect(text()).toContain(t('patientRegistration.duplicate.unavailable'));
    check.and.resolveTo(matches(francisco));
    buttons()[0].click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(text()).toContain(t('patientRegistration.duplicate.question'));
  });

  it('sem hospital ativo não consulta; "tentar de novo" mostra erro de hospital', async () => {
    selected.value = null;
    await setup(Promise.resolve({ kind: 'no-match', next: 'sex' }));

    expect(check).not.toHaveBeenCalled();
    (fixture.componentInstance as unknown as { retry(): void }).retry();
    fixture.detectChanges();

    expect(text()).toContain(t('patientRegistration.duplicate.hospitalNotFound'));
  });
});
