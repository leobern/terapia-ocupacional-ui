import { OutboxOperation } from '../../../shared/offline/offline-store';
import { DailyEvolution } from './daily-record.models';
import { overlayEvolution, pendingEntries } from './offline-evolution-overlay';

let extraId = 0;
const op = (
  type: OutboxOperation['type'],
  payload: OutboxOperation['payload'],
  extra: Partial<OutboxOperation> = {},
): OutboxOperation => ({
  attempted: false,
  attempts: 0,
  day: '2026-11-26',
  nextAttemptAt: 'x',
  occurredAt: '2026-11-26T10:00:00.000Z',
  opId: `${type}-${extraId++}`,
  patientId: '42',
  payload,
  seq: 1,
  status: 'pending',
  type,
  userId: 'u',
  ...extra,
});

const base: DailyEvolution = {
  at: '2026-11-26T08:00:00.000Z',
  author: 'Bia',
  origin: 'manual',
  reevaluations: [{ dueAt: '2026-11-27T08:00:00.000Z', id: 'r0', name: 'Edema' }],
  text: 'do servidor',
  version: 7,
};
const reevaluation = { dueAt: '2026-11-28T10:00:00.000Z', id: 'r1', name: 'Diarreia' };

describe('overlayEvolution', () => {
  it('sem nada pendente devolve a leitura intacta', () => {
    expect(overlayEvolution(base, [])).toBe(base);
    expect(overlayEvolution(null, [op('parameters', { author: 'x', parameters: [] })])).toBeNull();
  });

  it('o último texto pendente vence e as reavaliações pendentes se somam às do servidor', () => {
    const merged = overlayEvolution(base, [
      op('evolution-text', { author: 'Ana', origin: 'MANUAL', text: 'primeiro' }),
      op(
        'evolution-text',
        { author: 'Ana', origin: 'AI', text: 'segundo' },
        { occurredAt: '2026-11-26T11:00:00.000Z' },
      ),
      op('reevaluations', { author: 'Ana', reevaluations: [reevaluation] }),
    ]);

    expect(merged).toEqual({
      at: '2026-11-26T11:00:00.000Z',
      author: 'Ana',
      origin: 'ai',
      pending: true,
      reevaluations: [...(base.reevaluations ?? []), reevaluation],
      text: 'segundo',
      version: 7,
    });
  });

  it('só reavaliação pendente mantém o texto do servidor, ou fica vazio sem leitura', () => {
    const withBase = overlayEvolution(base, [op('reevaluations', { author: 'Ana', reevaluations: [reevaluation] })]);

    expect(withBase).toEqual(
      jasmine.objectContaining({ at: base.at, author: 'Ana', origin: 'manual', text: 'do servidor' }),
    );
    const without = overlayEvolution(null, [op('reevaluations', { author: 'Ana', reevaluations: [reevaluation] })]);

    expect(without).toEqual(
      jasmine.objectContaining({
        at: '2026-11-26T10:00:00.000Z',
        origin: 'manual',
        pending: true,
        text: '',
        version: 0,
      }),
    );
  });

  it('sem leitura do servidor a versão vem da base que a tela tinha', () => {
    const merged = overlayEvolution(null, [
      op('evolution-text', { author: 'Ana', origin: 'MANUAL', text: 'x' }, { baseVersion: 2 }),
    ]);

    expect(merged?.version).toBe(2);
  });
});

describe('pendingEntries', () => {
  it('converte os parâmetros pendentes em lançamentos, com rótulo e unidade quando existem', () => {
    const entries = pendingEntries([
      op('parameters', {
        author: 'Ana',
        parameters: [
          { parameterId: 'glycemia', value: 100 },
          { parameterId: 'custom:albumina', parameterLabel: 'Albumina', unit: 'g/dL', value: 3 },
        ],
      }),
      op('evolution-text', { text: 'ignorado' }),
    ]);

    expect(entries.map(e => [e.parameterId, e.value, e.parameterLabel, e.unit, e.author])).toEqual([
      ['glycemia', 100, undefined, undefined, 'Ana'],
      ['custom:albumina', 3, 'Albumina', 'g/dL', 'Ana'],
    ]);
    expect(new Set(entries.map(e => e.id)).size).toBe(2);
  });
});
