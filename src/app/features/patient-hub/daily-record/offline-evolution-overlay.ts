import { OutboxOperation } from '../../../shared/offline/offline-store';
import { originFromApi, ParametroDiarioDto } from './api-evolutions';
import { DailyEvolution, ParameterEntry, Reevaluation } from './daily-record.models';

type ApiOrigin = Parameters<typeof originFromApi>[0];

/**
 * Sobrepõe à leitura do servidor (ou da cópia local) o que ainda está na fila de escrita do dia, para o profissional
 * nunca ver o registro "sumir" ao recarregar offline (ADR-003). Texto: a gravação pendente mais recente vence na tela.
 * Reavaliações pendentes são acrescentadas. Devolve `base` intacto quando não há nada pendente.
 */
export function overlayEvolution(
  base: DailyEvolution | null,
  operations: readonly OutboxOperation[],
): DailyEvolution | null {
  const texts = operations.filter(o => o.type === 'evolution-text');
  const reevaluations = operations.filter(o => o.type === 'reevaluations');

  if (texts.length === 0 && reevaluations.length === 0) {
    return base;
  }
  const last = texts.at(-1);
  const extra = reevaluations.flatMap(o => o.payload['reevaluations'] as readonly Reevaluation[]);

  return {
    at: last?.occurredAt ?? base?.at ?? reevaluations[0].occurredAt,
    author: (last ?? reevaluations[0]).payload['author'] as string,
    origin: last === undefined ? (base?.origin ?? 'manual') : originFromApi(last.payload['origin'] as ApiOrigin),
    pending: true,
    reevaluations: [...(base?.reevaluations ?? []), ...extra],
    text: last === undefined ? (base?.text ?? '') : (last.payload['text'] as string),
    version: base?.version ?? last?.baseVersion ?? 0,
  };
}

/** Lançamentos de parâmetros ainda pendentes, no modelo da tela (id provisório `pendente:opId#posição`). */
export function pendingEntries(operations: readonly OutboxOperation[]): readonly ParameterEntry[] {
  return operations
    .filter(o => o.type === 'parameters')
    .flatMap(o =>
      (o.payload['parameters'] as readonly ParametroDiarioDto[]).map(p => ({
        at: o.occurredAt,
        author: o.payload['author'] as string,
        id: `pendente:${o.opId}#${p.parameterId}`,
        parameterId: p.parameterId,
        value: p.value,
        ...(p.parameterLabel == null ? {} : { parameterLabel: p.parameterLabel }),
        ...(p.unit == null ? {} : { unit: p.unit }),
      })),
    );
}
