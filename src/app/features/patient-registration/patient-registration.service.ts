import { inject, Injectable } from '@angular/core';

import { I18nService } from '../../shared/services/i18n.service';
import { FormSubmitError } from '../../shared/services/screen-actions.service';
import { HospitalContextService } from '../home/hospital-context.service';
import { NewPatient, PatientRegistrationPort, RegisteredPatient } from './patient-registration-port';

/**
 * Ponto de cadastro de paciente para o formulário/chatbot (US-002-1-02 ainda não existe: quem montar
 * o fluxo chama `register`). SAME já usado no hospital bloqueia o cadastro com a MSG-07 — texto,
 * não só cor —, com o nome do paciente existente (RN-03); o formulário mantém as respostas para
 * o usuário corrigir o SAME (ou deixá-lo vazio) e tentar de novo.
 */
@Injectable({ providedIn: 'root' })
export class PatientRegistrationService {
  private readonly port = inject(PatientRegistrationPort);
  private readonly hospitals = inject(HospitalContextService);
  private readonly i18n = inject(I18nService);

  async register(patient: NewPatient): Promise<RegisteredPatient> {
    const hospital = this.hospitals.selected();

    if (hospital === null) {
      throw new FormSubmitError(this.i18n.t('patientRegistration.noHospital'));
    }

    const result = await this.port.create(hospital.id, patient);

    if (result.kind === 'same-duplicate') {
      throw new FormSubmitError(this.i18n.t('patientRegistration.msg07').replace('{name}', result.existingPatientName));
    }

    return result.patient;
  }
}
