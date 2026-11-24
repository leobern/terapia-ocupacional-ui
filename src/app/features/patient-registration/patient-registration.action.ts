import { inject, Injectable } from '@angular/core';

import { REGISTER_PATIENT_ACTION_ID } from '../../shared/services/assistant-action-router';
import { I18nService } from '../../shared/services/i18n.service';
import {
  type ConversationParseResult,
  ConversationStepError,
  type ScreenAction,
} from '../../shared/services/screen-actions.service';
import { HospitalContextService } from '../home/hospital-context.service';
import { PatientCreationPort, PatientFieldError } from './patient-creation.port';
import {
  PATIENT_SEXES,
  type PatientMessageCode,
  type PatientSex,
  type RuleResult,
  validateAdmitChoice,
  validateBirthDate,
  validateFullName,
  validateMedicalRecordNumber,
  validateSex,
} from './patient-registration.rules';

const MESSAGE_BY_CODE: Readonly<Record<string, PatientMessageCode>> = {
  'MSG-01': 'MSG-01',
  'MSG-02': 'MSG-02',
  'MSG-03': 'MSG-03',
  'MSG-05': 'MSG-05',
};

/**
 * Ação "Cadastrar paciente" (US-002-1-02): o assistente pergunta nome, nascimento, sexo e SAME, um por
 * vez, valida cada resposta e cria o paciente no hospital ativo da sessão (RN-04).
 */
@Injectable({ providedIn: 'root' })
export class PatientRegistrationAction {
  private readonly i18n = inject(I18nService);
  private readonly port = inject(PatientCreationPort);
  private readonly hospitals = inject(HospitalContextService);

  build(): ScreenAction {
    const t = (key: string): string => this.i18n.t(`patientRegistration.${key}`);
    const message = (code: string): string => t(`messages.${code}`);
    const sexLabels = Object.fromEntries(PATIENT_SEXES.map(sex => [sex, t(`sex.${sex}`)])) as Record<
      PatientSex,
      string
    >;
    const parse = <T extends string>(result: RuleResult<T>): ConversationParseResult =>
      'code' in result ? { error: message(result.code) } : { value: result.value };

    return {
      conversation: {
        errorMessage: message('error'),
        skipLabel: t('skip'),
        steps: [
          { id: 'fullName', parse: raw => parse(validateFullName(raw)), prompt: t('prompts.fullName') },
          {
            id: 'birthDate',
            parse: raw => parse(validateBirthDate(raw, new Date())),
            prompt: t('prompts.birthDate'),
          },
          {
            id: 'sex',
            options: PATIENT_SEXES.map(sex => ({ label: sexLabels[sex], value: sex })),
            parse: raw => parse(validateSex(raw, sexLabels)),
            prompt: t('prompts.sex'),
          },
          {
            id: 'medicalRecordNumber',
            optional: true,
            parse: raw => parse(validateMedicalRecordNumber(raw)),
            prompt: t('prompts.medicalRecordNumber'),
          },
          {
            // US-002-1-05: internação é opcional. "Sim" só registra a escolha (values['admit']); as perguntas
            // de internação entram aqui nas próximas stories da FT-002-1.
            id: 'admit',
            options: [
              { label: t('admit.yes'), value: 'yes' },
              { label: t('admit.no'), value: 'no' },
            ],
            parse: raw => parse(validateAdmitChoice(raw)),
            prompt: t('prompts.admit'),
          },
        ],
        submit: values => this.submit(values, message),
        successMessage: message('MSG-04'),
        title: t('title'),
      },
      id: REGISTER_PATIENT_ACTION_ID,
      label: t('title'),
    };
  }

  private async submit(values: Readonly<Record<string, string>>, message: (code: string) => string): Promise<void> {
    const hospitalId = this.hospitals.selected()?.id;

    // RN-04: sem hospital ativo na sessão o cadastro não é enviado.
    if (hospitalId === undefined) {
      throw new Error('Sem hospital ativo na sessão');
    }
    try {
      await this.port.create({
        birthDate: values['birthDate'],
        fullName: values['fullName'],
        hospitalId,
        sex: values['sex'] as PatientSex,
        ...(values['medicalRecordNumber'] ? { medicalRecordNumber: values['medicalRecordNumber'] } : {}),
      });
    } catch (error) {
      if (error instanceof PatientFieldError) {
        const code = MESSAGE_BY_CODE[error.code];

        // A mensagem do servidor tem precedência; sem ela, usa o texto local do código.
        throw new ConversationStepError(error.field, error.message || (code ? message(code) : message('error')));
      }
      throw error;
    }
  }
}
