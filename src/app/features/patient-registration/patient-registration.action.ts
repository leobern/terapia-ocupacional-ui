import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';

import { REGISTER_PATIENT_ACTION_ID } from '../../shared/services/assistant-action-router';
import { I18nService } from '../../shared/services/i18n.service';
import {
  type ConversationParseResult,
  type ConversationStep,
  ConversationStepError,
  type ScreenAction,
} from '../../shared/services/screen-actions.service';
import { HospitalContextService } from '../home/hospital-context.service';
import {
  type CreateInternacaoRequest,
  InternacaoCreationPort,
  InternacaoFieldError,
  type InternacaoLocation,
} from './internacao-creation.port';
import { type CreatedPatient, PatientCreationPort, PatientFieldError } from './patient-creation.port';
import {
  LOCATION_KINDS,
  type LocationKind,
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
  validateLocationType,
  validateLocationValue,
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
  'MSG-09': 'MSG-09',
  'MSG-10': 'MSG-10',
};

/** 422 de `locations` volta à pergunta correspondente (tipo = MSG-09, valor = MSG-10). */
const LOCATION_STEP_BY_CODE: Readonly<Record<string, string>> = {
  'MSG-09': 'location1Type',
  'MSG-10': 'location1Value',
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
  private readonly router = inject(Router);

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

    return [...steps.map(step => ({ ...step, optional: true, when })), ...this.locationSteps(t, parse, when)];
  }

  /**
   * US-002-1-07: localizações (Unidade e/ou Ala), até 2, uma de cada tipo (RN-03). Cada linha é uma sequência de
   * perguntas (tipo, valor, "mais uma?"); a última pergunta permite desistir de uma linha antes do envio (RN-04).
   */
  private locationSteps(
    t: (key: string) => string,
    parse: <T extends string>(result: RuleResult<T>) => ConversationParseResult,
    admitting: (values: Readonly<Record<string, string>>) => boolean,
  ): ConversationStep[] {
    const message = (code: string): string => t(`messages.${code}`);
    const labels = Object.fromEntries(LOCATION_KINDS.map(kind => [kind, t(`locationKind.${kind}`)])) as Record<
      LocationKind,
      string
    >;
    const typeOptions = LOCATION_KINDS.map(kind => ({ label: labels[kind], value: kind }));
    const yesNo = [
      { label: t('admit.yes'), value: 'yes' },
      { label: t('admit.no'), value: 'no' },
    ];
    const adding = (values: Readonly<Record<string, string>>): boolean =>
      admitting(values) && values['addLocation'] === 'yes';
    const typeStep = (id: string, prompt: string, when: ConversationStep['when']): ConversationStep => ({
      id,
      options: typeOptions,
      parse: (raw, values): ConversationParseResult => {
        const result = validateLocationType(raw, labels);

        // RN-03: sem repetir o tipo já informado.
        return 'value' in result && values['location1Type'] === result.value && id !== 'location1Type'
          ? { error: message('locationTypeRepeated') }
          : parse(result);
      },
      prompt,
      when,
    });
    const valueStep = (id: string, when: ConversationStep['when']): ConversationStep => ({
      id,
      parse: raw => parse(validateLocationValue(raw)),
      prompt: t(`prompts.${id}`),
      when,
    });
    const choice = (raw: string): ConversationParseResult => parse(validateAdmitChoice(raw));

    return [
      {
        id: 'addLocation',
        options: yesNo,
        optional: true,
        parse: raw => choice(raw),
        prompt: t('prompts.addLocation'),
        when: admitting,
      },
      typeStep('location1Type', t('prompts.location1Type'), adding),
      valueStep('location1Value', adding),
      {
        id: 'location1More',
        options: yesNo,
        parse: raw => choice(raw),
        prompt: t('prompts.location1More'),
        when: adding,
      },
      typeStep(
        'location2Type',
        t('prompts.location2Type'),
        values => adding(values) && values['location1More'] === 'yes',
      ),
      valueStep('location2Value', values => adding(values) && values['location1More'] === 'yes'),
      {
        // Cenário 3: com 2 localizações, pedir mais uma só devolve o aviso de limite (nada é adicionado).
        id: 'location2More',
        options: yesNo,
        parse: (raw): ConversationParseResult => {
          const result = validateAdmitChoice(raw);

          return 'value' in result && result.value === 'yes' ? { error: message('locationLimit') } : parse(result);
        },
        prompt: t('prompts.location2More'),
        when: values => 'location2Value' in values,
      },
      {
        // RN-04: desistir de uma linha ainda não salva; "Pular" mantém todas.
        id: 'locationRemove',
        options: LOCATION_KINDS.map(kind => ({ label: t(`locationRemove.${kind}`), value: kind })),
        optional: true,
        parse: (raw, values): ConversationParseResult => {
          const answer = raw.trim().toLowerCase();
          const kind = LOCATION_KINDS.find(
            k => answer === t(`locationRemove.${k}`).toLowerCase() || answer === labels[k].toLowerCase(),
          );

          if (!kind) {
            return { error: message('MSG-09') };
          }

          return this.locationsOf(values).some(location => location.locationType === kind)
            ? { value: kind }
            : { error: message('locationNotInformed') };
        },
        prompt: t('prompts.locationRemove'),
        when: values => 'location1Value' in values,
      },
    ];
  }

  /** Localizações informadas (já sem a removida em `locationRemove`, se houver). */
  private locationsOf(values: Readonly<Record<string, string>>): InternacaoLocation[] {
    const lines = [
      { locationType: values['location1Type'], locationValue: values['location1Value'] },
      { locationType: values['location2Type'], locationValue: values['location2Value'] },
    ].filter(line => line.locationType && line.locationValue) as InternacaoLocation[];

    return lines.filter(line => line.locationType !== values['locationRemove']);
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
      // Paciente cadastrado: leva à tela do paciente, onde o médico faz a avaliação clínica (peso, altura e demais itens).
      void this.router.navigate(['/patients', patient.id], { queryParams: { avaliar: '1' } });
    } catch (error) {
      if (error instanceof PatientFieldError || error instanceof InternacaoFieldError) {
        const code = MESSAGE_BY_CODE[error.code];
        const stepId =
          error.field === 'locations' ? (LOCATION_STEP_BY_CODE[error.code] ?? 'location1Type') : error.field;

        // A mensagem do servidor tem precedência; sem ela, usa o texto local do código.
        throw new ConversationStepError(stepId, error.message || (code ? message(code) : message('error')));
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
    const fields = Object.fromEntries(
      ADMISSION_FIELDS.filter(field => values[field]).map(field => [field, values[field]]),
    );
    const locations = this.locationsOf(values);

    return locations.length > 0 ? { ...fields, locations } : fields;
  }
}
