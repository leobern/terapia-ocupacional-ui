import { Injectable } from '@angular/core';

import { FollowUpClosure, FollowUpClosureRequest } from './follow-up-closure.models';
import { FollowUpClosureSource, FollowUpClosureWriter } from './follow-up-closure-source';

/** Provisório: guarda os encerramentos em memória (só acrescenta), até a API real existir. */
@Injectable()
export class ProvisionalFollowUpClosureSource extends FollowUpClosureSource implements FollowUpClosureWriter {
  private closures: readonly FollowUpClosure[] = [];
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
}
