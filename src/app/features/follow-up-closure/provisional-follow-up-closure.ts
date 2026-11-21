import { Injectable } from '@angular/core';

import {
  FollowUpClosure,
  FollowUpClosureRequest,
  FollowUpReopening,
  FollowUpReopeningRequest,
} from './follow-up-closure.models';
import { FollowUpClosureSource, FollowUpClosureWriter } from './follow-up-closure-source';

/** Provisório: guarda os encerramentos em memória (só acrescenta), até a API real existir. */
@Injectable()
export class ProvisionalFollowUpClosureSource extends FollowUpClosureSource implements FollowUpClosureWriter {
  private closures: readonly FollowUpClosure[] = [];
  private reopenings: readonly FollowUpReopening[] = [];
  private sequence = 0;

  list(patientId: string): Promise<readonly FollowUpClosure[]> {
    return Promise.resolve(this.closures.filter(c => c.patientId === patientId));
  }

  listAll(): Promise<readonly FollowUpClosure[]> {
    return Promise.resolve(this.closures);
  }

  close(request: FollowUpClosureRequest): Promise<FollowUpClosure> {
    const closure: FollowUpClosure = { ...request, id: `closure-${++this.sequence}` };

    this.closures = [...this.closures, closure];

    return Promise.resolve(closure);
  }

  listReopenings(patientId: string): Promise<readonly FollowUpReopening[]> {
    return Promise.resolve(this.reopenings.filter(r => r.patientId === patientId));
  }

  listAllReopenings(): Promise<readonly FollowUpReopening[]> {
    return Promise.resolve(this.reopenings);
  }

  reopen(request: FollowUpReopeningRequest): Promise<FollowUpReopening> {
    const reopening: FollowUpReopening = { ...request, id: `reopening-${++this.sequence}` };

    this.reopenings = [...this.reopenings, reopening];

    return Promise.resolve(reopening);
  }
}
