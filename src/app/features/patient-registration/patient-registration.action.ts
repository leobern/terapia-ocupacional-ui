import { inject, Injectable } from '@angular/core';

import { REGISTER_PATIENT_ACTION_ID } from '../../shared/services/assistant-action-router';
import { I18nService } from '../../shared/services/i18n.service';
import {
  type ConversationParseResult,
  type ConversationStep,
  ConversationStepError,
  type ScreenAction,
} from '../../shared/services/screen-actions.service';
import { HospitalContextService } from '../home/hospital-context.service';
import { type CreateInternacaoRequest, InternacaoCreationPort, InternacaoFieldError } from './internacao-creation.port';
import { type CreatedPatient, PatientCreationPort, PatientFieldError } from './patient-creation.port';
import {
  PATIENT_SEXES,
  type PatientMessageCode,
  type PatientSex,
  type RuleResult,
  validateAdmissionNumber,
  validateAdmitChoice,
  validateBedNumber,
  validateBirthDate,
  validateFullName,
  validateHealthInsurance,
  validateHospitalAdmissionDate,
  validateMedicalRecordNumber,
  validateNutritionalTherapyStartDate,
  validateSex,
} from './patient-registration.rules';

const MESSAGE_BY_CODE: Readonly<Record<string, PatientMessageCode>> = {
  'MSG-01': 'MSG-01',
  'MSG-02': 'MSG-02',
  'MSG-03': 'MSG-03',
  'MSG-05': 'MSG-05',
  'MSG-08': 'MSG-08',
};

const ADMISSION_FIELDS = [
  'bedNumber',
  'healthInsurance',
  'admissionNumber',
  'hospitalAdmissionDate',
  'nutritionalTherapyStartDate',
] as const;

/**
 * Ação "Cadastrar paciente" (US-002-1-02): o assistente pergunta nome, nascimento, sexo e SAME, um por
 * vez, valida cada resposta e cria o paciente no hospital ativo da sessão (RN-04).
 */
@Injectable({ providedIn: 'root' })
export class PatientRegistrationAction {
  private readonly i18n = inject(I18nService);
  private readonly port = inject(PatientCreationPort);
  private readonly internacaoPort = inject(InternacaoCreationPort);
  private readonly hospitals = inject(HospitalContextService);

  /**
   * Paciente já criado cuja internação falhou: ao tentar de novo (ou corrigir a data), reaproveita-o em vez de
   * criar outro. Limpo quando o envio inteiro conclui.
   */
  private pending: { readonly key: string; readonly patient: CreatedPatient } | null = null;

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
            // US-002-1-05: internação é opcional; "sim" habilita as perguntas da US-002-1-06 (todas opcionais).
            id: 'admit',
            options: [
              { label: t('admit.yes'), value: 'yes' },
              { label: t('admit.no'), value: 'no' },
            ],
            parse: raw => parse(validateAdmitChoice(raw)),
            prompt: t('prompts.admit'),
          },
          ...this.admissionSteps(t, parse),
        ],
        submit: values => this.submit(values, message),
        successMessage: message('MSG-04'),
        title: t('title'),
      },
      id: REGISTER_PATIENT_ACTION_ID,
      label: t('title'),
    };
  }

  /** US-002-1-06: dados da internação, um por vez; todos opcionais (RN-01) e só perguntados se o usuário quer internar. */
  private admissionSteps(
    t: (key: string) => string,
    parse: <T extends string>(result: RuleResult<T>) => ConversationParseResult,
  ): ConversationStep[] {
    const when = (values: Readonly<Record<string, string>>): boolean => values['admit'] === 'yes';

    const steps: Pick<ConversationStep, 'id' | 'parse' | 'prompt'>[] = [
      { id: 'bedNumber', parse: raw => parse(validateBedNumber(raw)), prompt: t('prompts.bedNumber') },
      {
        id: 'healthInsurance',
        parse: raw => parse(validateHealthInsurance(raw)),
        prompt: t('prompts.healthInsurance'),
      },
      {
        id: 'admissionNumber',
        parse: raw => parse(validateAdmissionNumber(raw)),
        prompt: t('prompts.admissionNumber'),
      },
      {
        id: 'hospitalAdmissionDate',
        parse: raw => parse(validateHospitalAdmissionDate(raw, new Date())),
        prompt: t('prompts.hospitalAdmissionDate'),
      },
      {
        id: 'nutritionalTherapyStartDate',
        parse: raw => parse(validateNutritionalTherapyStartDate(raw)),
        prompt: t('prompts.nutritionalTherapyStartDate'),
      },
    ];

    return steps.map(step => ({ ...step, optional: true, when }));
  }

  private async submit(values: Readonly<Record<string, string>>, message: (code: string) => string): Promise<void> {
    const hospitalId = this.hospitals.selected()?.id;

    // RN-04: sem hospital ativo na sessão o cadastro não é enviado.
    if (hospitalId === undefined) {
      throw new Error('Sem hospital ativo na sessão');
    }
    const key = JSON.stringify([
      hospitalId,
      values['fullName'],
      values['birthDate'],
      values['sex'],
      values['medicalRecordNumber'],
    ]);

    try {
      const patient = this.pending?.key === key ? this.pending.patient : await this.createPatient(hospitalId, values);

      if (values['admit'] === 'yes') {
        this.pending = { key, patient };
        await this.internacaoPort.create(patient.id, this.admissionRequest(values));
      }
      this.pending = null;
    } catch (error) {
      if (error instanceof PatientFieldError || error instanceof InternacaoFieldError) {
        const code = MESSAGE_BY_CODE[error.code];

        // A mensagem do servidor tem precedência; sem ela, usa o texto local do código.
        throw new ConversationStepError(error.field, error.message || (code ? message(code) : message('error')));
      }
      throw error;
    }
  }

  private createPatient(hospitalId: number, values: Readonly<Record<string, string>>): Promise<CreatedPatient> {
    return this.port.create({
      birthDate: values['birthDate'],
      fullName: values['fullName'],
      hospitalId,
      sex: values['sex'] as PatientSex,
      ...(values['medicalRecordNumber'] ? { medicalRecordNumber: values['medicalRecordNumber'] } : {}),
    });
  }

  /** Só os campos respondidos (RN-01): pular ou "não sei" deixa o campo de fora. */
  private admissionRequest(values: Readonly<Record<string, string>>): CreateInternacaoRequest {
    return Object.fromEntries(ADMISSION_FIELDS.filter(field => values[field]).map(field => [field, values[field]]));
  }
}
