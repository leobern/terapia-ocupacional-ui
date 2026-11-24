import { inject, Injectable } from '@angular/core';

import { I18nService } from '../../shared/services/i18n.service';
import { formatBirthDate, parseBirthDate } from './parse-birth-date';
import { DuplicateCheckInput, DuplicateCheckOutcome, PatientMatch } from './patient-duplicate.models';
import { PatientDuplicateSource } from './patient-duplicate-source';

const MIN_NAME_LENGTH = 3;

/**
 * Fluxo da US-002-1-01: assim que o chatbot coleta nome e data de nascimento, valida (MSG-01/MSG-02),
 * consulta a duplicidade e diz qual é o próximo passo. A fonte só é consultada com entradas válidas;
 * falhas dela propagam como erro (quem chama decide a mensagem).
 */
@Injectable({ providedIn: 'root' })
export class PatientDuplicateCheckService {
  private readonly i18n = inject(I18nService);
  private readonly source = inject(PatientDuplicateSource);

  async check(input: DuplicateCheckInput): Promise<DuplicateCheckOutcome> {
    const fullName = input.fullName.trim();

    if (fullName.length < MIN_NAME_LENGTH) {
      return { kind: 'invalid-name', message: this.i18n.t('patientRegistration.duplicate.nameTooShort') };
    }
    const birthDate = parseBirthDate(input.birthDate);

    if (birthDate === null) {
      return { kind: 'invalid-date', message: this.i18n.t('patientRegistration.duplicate.invalidBirthDate') };
    }
    const matches = await this.source.find(input.hospitalId, fullName, birthDate);

    return matches.length === 0
      ? { kind: 'no-match', next: 'sex' }
      : { kind: 'matches', lines: matches.map(match => this.describe(match)), next: 'sex' };
  }

  private describe(match: PatientMatch): string {
    const parts = [
      `${this.i18n.t('patientRegistration.duplicate.name')}: ${match.fullName}`,
      `${this.i18n.t('patientRegistration.duplicate.birthDate')}: ${formatBirthDate(match.birthDate)}`,
    ];

    if (match.medicalRecordNumber) {
      parts.push(`${this.i18n.t('patientRegistration.duplicate.same')}: ${match.medicalRecordNumber}`);
    }

    return parts.join(' · ');
  }
}
