import { Injectable } from '@angular/core';

import { type ScreenCommand } from '../../shared/services/screen-actions.service';
import { PatientListAiCommandPort } from './patient-list-ai-command';

/** Provisória: aceita o comando sem fazer nada (a FT-003-4 ainda não existe). */
@Injectable()
export class ProvisionalPatientListAiCommand extends PatientListAiCommandPort {
  send(_: ScreenCommand): Promise<void> {
    return Promise.resolve();
  }
}
