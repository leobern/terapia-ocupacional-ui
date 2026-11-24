import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';

import { ButtonComponent } from '../../../shared/components/button/button.component';
import { I18nService } from '../../../shared/services/i18n.service';
import { HospitalContextService } from '../../home/hospital-context.service';
import { PatientDuplicateCandidate, PatientsApiService } from './patients-api.service';

type StepState = 'loading' | 'question' | 'error';

/**
 * Etapa de verificação de duplicidade do cadastro de paciente (US-002-1-03).
 * Recebe os dados já coletados (nome, nascimento, SAME opcional), consulta a API
 * e, havendo coincidência, pergunta se é o mesmo paciente (MSG-06, RN-01/RN-02).
 * "Sim" cancela o cadastro e aponta o registro existente (RN-03); "não" ou ausência
 * de coincidência deixam o cadastro prosseguir (RN-04). Nada é gravado aqui.
 * Sem desenho no Figma: montada só com componentes do DS.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent],
  selector: 'app-patient-duplicate-step',
  styleUrl: './patient-duplicate-step.component.scss',
  templateUrl: './patient-duplicate-step.component.html',
})
export class PatientDuplicateStepComponent {
  readonly fullName = input.required<string>();
  /** Formato `yyyy-MM-dd`. */
  readonly birthDate = input.required<string>();
  readonly medicalRecordNumber = input<string | null>(null);

  /** Sem coincidência, ou o profissional respondeu "não": o cadastro segue. */
  readonly proceed = output();
  /** O profissional respondeu "sim": cadastro cancelado; id do paciente existente. */
  readonly existingPatient = output<number>();

  protected readonly i18n = inject(I18nService);
  protected readonly state = signal<StepState>('loading');
  protected readonly candidates = signal<readonly PatientDuplicateCandidate[]>([]);
  protected readonly errorKey = signal('patients.duplicate.errors.generic');
  protected readonly single = computed(() => this.candidates().length === 1);

  private readonly api = inject(PatientsApiService);
  private readonly context = inject(HospitalContextService);

  constructor() {
    effect(() => {
      const hospitalId = this.context.selected()?.id;

      // Só (re)consulta quando o hospital ou os dados mudam, não a cada mudança interna.
      this.fullName();
      this.birthDate();
      this.medicalRecordNumber();
      if (hospitalId !== undefined) {
        untracked(() => this.check(hospitalId));
      }
    });
  }

  protected retry(): void {
    const hospitalId = this.context.selected()?.id;

    if (hospitalId === undefined) {
      this.fail(404);
    } else {
      this.check(hospitalId);
    }
  }

  protected answerYes(candidate: PatientDuplicateCandidate): void {
    this.existingPatient.emit(candidate.id);
  }

  protected answerNo(): void {
    this.proceed.emit();
  }

  /** `yyyy-MM-dd` → `dd/mm/aaaa`, sem passar por `Date` (evita deslocar o dia pelo fuso). */
  protected formatDate(iso: string): string {
    const [year, month, day] = iso.split('-');

    return `${day}/${month}/${year}`;
  }

  private check(hospitalId: number): void {
    this.state.set('loading');
    this.api
      .checkDuplicate({
        birthDate: this.birthDate(),
        fullName: this.fullName(),
        hospitalId,
        medicalRecordNumber: this.medicalRecordNumber() || null,
      })
      .subscribe({
        error: (failure: unknown) => this.fail(failure instanceof HttpErrorResponse ? failure.status : 0),
        next: result => {
          if (result.duplicate && result.candidates.length > 0) {
            this.candidates.set(result.candidates);
            this.state.set('question');
          } else {
            this.proceed.emit();
          }
        },
      });
  }

  private fail(status: number): void {
    const known = [401, 403, 404, 422].includes(status);

    this.errorKey.set(known ? `patients.duplicate.errors.${status}` : 'patients.duplicate.errors.generic');
    this.state.set('error');
  }
}
