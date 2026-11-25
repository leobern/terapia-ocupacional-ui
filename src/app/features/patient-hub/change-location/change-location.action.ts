import { inject, Injectable } from '@angular/core';

import { LOCATION_ACTION_ID } from '../../../shared/services/assistant-action-router';
import { I18nService } from '../../../shared/services/i18n.service';
import {
  type ConversationOutcome,
  type ConversationParseResult,
  type ConversationStep,
  ConversationStepError,
  type ScreenAction,
} from '../../../shared/services/screen-actions.service';
import { BedMovementPort, PatientNotFoundError, PatientWithoutInternacaoError } from '../move-bed/bed-movement.port';
import {
  LocationChangePort,
  LocationExtractor,
  LocationNotIdentifiedError,
  type LocationRequest,
  type ResolvedLocationChange,
} from './location-change.port';

type Translate = (key: string) => string;
interface Patient {
  readonly id: string;
  readonly name: string;
}

/**
 * Ação "Alterar unidade/ala" (US-002-2-06): tipo e valor vêm da mensagem, a prévia é associada à internação mais
 * recente e a confirmação Sim/Não vem antes de criar ou atualizar a linha (mesmo padrão de US-002-2-03).
 */
@Injectable({ providedIn: 'root' })
export class ChangeLocationAction {
  private readonly i18n = inject(I18nService);
  private readonly port = inject(LocationChangePort);
  private readonly beds = inject(BedMovementPort);
  private readonly extractor = inject(LocationExtractor);

  /** Paciente em contexto (tela aberta). */
  build(patient: Patient): ScreenAction {
    const t = this.t();

    return {
      conversation: {
        errorMessage: t('messages.error'),
        seedFromMessage: message => this.seed(message),
        skipLabel: '',
        steps: [this.requestStep(t)],
        submit: values => this.submit(patient, JSON.parse(values['request']) as LocationRequest, t),
        successMessage: '',
        title: t('title'),
      },
      id: LOCATION_ACTION_ID,
      label: t('title'),
    };
  }

  /** Fora da tela do paciente: o nome é perguntado e a busca é restrita ao hospital ativo (US-002-2-02). */
  buildByName(activeHospitalId: () => number | undefined): ScreenAction {
    const t = this.t();

    return {
      conversation: {
        errorMessage: t('messages.error'),
        seedFromMessage: message => this.seed(message),
        skipLabel: '',
        steps: [
          this.requestStep(t),
          {
            id: 'patientName',
            parse: (raw): ConversationParseResult =>
              raw.trim() ? { value: raw.trim() } : { error: t('messages.nameMissing') },
            prompt: t('prompts.patientName'),
          },
        ],
        submit: values =>
          this.submitByName(
            activeHospitalId(),
            values['patientName'],
            JSON.parse(values['request']) as LocationRequest,
            t,
          ),
        successMessage: '',
        title: t('title'),
      },
      id: LOCATION_ACTION_ID,
      label: t('title'),
    };
  }

  private t(): Translate {
    return key => this.i18n.t(`changeLocation.${key}`);
  }

  private seed(message: string): string {
    return this.extractor.extract(message) ? message : '';
  }

  /** Aceita o JSON da extração da mensagem ou a resposta livre à pergunta ("unidade UTI"). */
  private requestStep(t: Translate): ConversationStep {
    return {
      id: 'request',
      parse: (raw): ConversationParseResult => {
        const found = this.extractor.extract(raw);

        if (!found) {
          return { error: t('messages.MSG-09') };
        }

        return found.value ? { value: JSON.stringify(found) } : { error: t('messages.MSG-10') };
      },
      prompt: t('prompts.request'),
    };
  }

  private async submit(patient: Patient, request: LocationRequest, t: Translate): Promise<ConversationOutcome> {
    if (!/^\d+$/.test(patient.id)) {
      throw new Error('Id de paciente não numérico');
    }
    try {
      return this.present(patient, await this.port.resolve(Number(patient.id), request.type, request.value), t);
    } catch (error) {
      return this.blocked(error, t);
    }
  }

  private async submitByName(
    hospitalId: number | undefined,
    name: string,
    request: LocationRequest,
    t: Translate,
  ): Promise<ConversationOutcome> {
    if (hospitalId === undefined) {
      throw new Error('Sem hospital ativo');
    }
    try {
      // O contrato não tem busca por nome própria da localização: reaproveita a da movimentação (leito só como sonda).
      const found = await this.beds.resolveByName(hospitalId, name, '0');

      return found.kind === 'single'
        ? await this.submit({ id: String(found.resolved.pacienteId), name }, request, t)
        : this.askWhich(found.candidates, request, t);
    } catch (error) {
      if (error instanceof PatientNotFoundError) {
        return { message: error.message || t('messages.MSG-13'), tone: 'error' };
      }

      return this.blocked(error, t);
    }
  }

  private askWhich(
    candidates: readonly { id: number; fullName: string; birthDate: string; medicalRecordNumber: string | null }[],
    request: LocationRequest,
    t: Translate,
  ): ConversationOutcome {
    const labels = candidates.map(
      (c, i) =>
        `${i + 1}. ${c.fullName} — ${t('messages.birth')} ${c.birthDate.split('-').reverse().join('/')} — ${t('messages.same')} ${c.medicalRecordNumber ?? t('messages.noSame')}`,
    );
    const pick = (raw: string): (typeof candidates)[number] | undefined => {
      const text = raw.trim();

      return candidates.find((_, i) => text === String(i + 1) || text === labels[i]);
    };

    return {
      confirmation: {
        step: {
          id: 'candidate',
          options: labels.map((label, i) => ({ label, value: String(i + 1) })),
          parse: raw => (pick(raw) ? { value: raw.trim() } : { error: t('messages.chooseInvalid') }),
          prompt: t('prompts.chooseOne'),
        },
        submit: (answer): Promise<ConversationOutcome> => {
          const chosen = pick(answer) as (typeof candidates)[number];

          return this.submit({ id: String(chosen.id), name: chosen.fullName }, request, t);
        },
      },
      message: `${t('messages.multiple')}\n${labels.join('\n')}`,
      tone: 'success',
    };
  }

  private present(patient: Patient, result: ResolvedLocationChange, t: Translate): ConversationOutcome {
    const type = t(`types.${result.locationType}`);
    const summary =
      result.action === 'CREATE'
        ? t('messages.summaryCreate').replace('{type}', type).replace('{new}', result.newValue)
        : t('messages.summaryUpdate')
            .replace('{type}', type)
            .replace('{current}', result.currentValue as string)
            .replace('{new}', result.newValue);

    return {
      confirmation: { step: this.confirmStep(t), submit: answer => this.decide(answer, result, t) },
      message: summary.replace('{patient}', patient.name),
      tone: 'success',
    };
  }

  private confirmStep(t: Translate): ConversationStep {
    return {
      id: 'confirm',
      options: [
        { label: t('options.yes'), value: 'yes' },
        { label: t('options.no'), value: 'no' },
      ],
      parse: (raw): ConversationParseResult => {
        const answer = raw.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

        if (answer === 'sim' || answer === 'yes') {
          return { value: 'yes' };
        }

        return answer === 'nao' || answer === 'no' ? { value: 'no' } : { error: t('messages.confirmChoice') };
      },
      prompt: t('prompts.confirm'),
    };
  }

  /** "Sim" aplica; "Não" cancela sem chamar a API. */
  private async decide(answer: string, result: ResolvedLocationChange, t: Translate): Promise<ConversationOutcome> {
    const type = t(`types.${result.locationType}`);

    if (answer !== 'yes') {
      return { message: t('messages.cancelled').replace('{type}', type), tone: 'success' };
    }
    try {
      await this.port.confirm(result.pacienteId, result.internacaoId, result.locationType, result.newValue);
    } catch (error) {
      if (error instanceof LocationNotIdentifiedError) {
        return { message: error.message || t(`messages.${error.code}`), tone: 'error' };
      }

      return this.blocked(error, t);
    }

    return {
      message: t(result.action === 'CREATE' ? 'messages.created' : 'messages.updated')
        .replace('{type}', type)
        .replace('{new}', result.newValue),
      tone: 'success',
    };
  }

  private blocked(error: unknown, t: Translate): ConversationOutcome {
    if (error instanceof PatientWithoutInternacaoError) {
      return { message: error.message || t('messages.MSG-11'), tone: 'error' };
    }
    if (error instanceof LocationNotIdentifiedError) {
      throw new ConversationStepError('request', error.message || t(`messages.${error.code}`));
    }
    throw error;
  }
}
