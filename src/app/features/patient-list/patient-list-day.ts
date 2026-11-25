import { Injectable, signal } from '@angular/core';

/**
 * Última data escolhida na lista de pacientes (Thiago, 2026-11-25). Ao entrar no detalhe de um paciente e voltar, a lista
 * reabre na data em que estava; mexer na data dentro do detalhe não altera a da lista. Só a própria lista grava aqui.
 */
@Injectable({ providedIn: 'root' })
export class PatientListDay {
  /** `null` até a lista escolher uma data: ela abre em hoje. */
  readonly day = signal<Date | null>(null);
}
