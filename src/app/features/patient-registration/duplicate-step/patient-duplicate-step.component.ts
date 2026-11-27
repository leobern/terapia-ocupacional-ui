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
import { formatBirthDate } from '../../../shared/utils/br-date';
import { HospitalContextService } from '../../home/hospital-context.service';
import { PatientMatch } from '../patient-duplicate.models';
import { PatientDuplicateCheckService } from '../patient-duplicate-check.service';

type StepState = 'loading' | 'question' | 'error';

/**
 * Etapa de verificação de duplicidade do cadastro de paciente (US-002-1-03).
 * Recebe os dados já coletados (nome, nascimento, SAME opcional), consulta a API via
 * `PatientDuplicateCheckService` (mesmo caminho da US-002-1-01: `GET /api/v1/pacientes/duplicidade`)
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
  /** `dd/MM/yyyy` ou `yyyy-MM-dd`. */
  readonly birthDate = input.required<string>();
  readonly medicalRecordNumber = input<string | null>(null);

  /** Sem coincidência, ou o profissional respondeu "não": o cadastro segue. */
  readonly proceed = output();
  /** O profissional respondeu "sim": cadastro cancelado; id do paciente existente. */
  readonly existingPatient = output<number>();

  protected readonly i18n = inject(I18nService);
  protected readonly state = signal<StepState>('loading');
  protected readonly candidates = signal<readonly PatientMatch[]>([]);
  protected readonly errorMessage = signal('');
  protected readonly single = computed(() => this.candidates().length === 1);

  private readonly check = inject(PatientDuplicateCheckService);
  private readonly context = inject(HospitalContextService);

  constructor() {
    effect(() => {
      const hospitalId = this.context.selected()?.id;

      // Só (re)consulta quando o hospital ou os dados mudam, não a cada mudança interna.
      this.fullName();
      this.birthDate();
      this.medicalRecordNumber();
      if (hospitalId !== undefined) {
        untracked(() => void this.verify(hospitalId));
      }
    });
  }

  protected retry(): void {
    const hospitalId = this.context.selected()?.id;

    if (hospitalId === undefined) {
      this.fail(this.i18n.t('patientRegistration.duplicate.hospitalNotFound'));
    } else {
      void this.verify(hospitalId);
    }
  }

  protected answerYes(candidate: PatientMatch): void {
    this.existingPatient.emit(candidate.id);
  }

  protected answerNo(): void {
    this.proceed.emit();
  }

  protected formatDate(iso: string): string {
    return formatBirthDate(iso);
  }

  private async verify(hospitalId: number): Promise<void> {
    this.state.set('loading');
    try {
      const outcome = await this.check.check({
        birthDate: this.birthDate(),
        fullName: this.fullName(),
        hospitalId,
        medicalRecordNumber: this.medicalRecordNumber(),
      });

      if (outcome.kind === 'no-match') {
        this.proceed.emit();
      } else if (outcome.kind === 'matches') {
        this.candidates.set(outcome.matches);
        this.state.set('question');
      } else {
        this.fail(outcome.message);
      }
    } catch {
      this.fail(this.i18n.t('patientRegistration.duplicate.unavailable'));
    }
  }

  private fail(message: string): void {
    this.errorMessage.set(message);
    this.state.set('error');
  }
}
