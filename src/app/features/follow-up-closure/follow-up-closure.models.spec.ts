import {
  activeClosures,
  buildHistory,
  CLOSURE_REASONS,
  FollowUpClosure,
  FollowUpReopening,
  formatIsoDate,
  FUTURE_DATE_HINT,
  INVALID_DATE_HINT,
  reasonLabel,
  toIsoDate,
  validateEffectiveDate,
} from './follow-up-closure.models';

describe('follow-up-closure.models', () => {
  const today = new Date(2026, 10, 21, 15, 0);

  it('oferece os 4 motivos da spec, com o texto de apoio da alta da EMTN', () => {
    expect(CLOSURE_REASONS.map(r => r.label)).toEqual([
      'Alta hospitalar',
      'Óbito',
      'Alta da EMTN',
      'Transferência externa',
    ]);

    expect(CLOSURE_REASONS.find(r => r.id === 'emtn-discharge')?.help).toContain('Segue internado');
  });

  it('rotula o motivo e cai no id quando desconhecido', () => {
    expect(reasonLabel('death')).toBe('Óbito');
    expect(reasonLabel('x' as never)).toBe('x');
  });

  it('formata datas no fuso local', () => {
    expect(toIsoDate(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(formatIsoDate('2026-11-20')).toBe('20/11/2026');
  });

  it('aceita hoje e datas passadas, recusa futura e inválida', () => {
    expect(validateEffectiveDate('2026-11-21', today)).toBeNull();
    expect(validateEffectiveDate('2026-01-01', today)).toBeNull();
    expect(validateEffectiveDate('2026-11-22', today)).toBe(FUTURE_DATE_HINT);
    expect(validateEffectiveDate('', today)).toBe(INVALID_DATE_HINT);
    expect(validateEffectiveDate('2026-13-45', today)).toBe(INVALID_DATE_HINT);
  });
});

describe('reaberturas', () => {
  const c = (id: string, at: string): FollowUpClosure => ({
    at,
    author: 'Ana',
    effectiveDate: '2026-11-01',
    id,
    patientId: 'p1',
    reason: 'death',
  });
  const r = (id: string, closureId: string, at: string): FollowUpReopening => ({
    at,
    author: 'Bia',
    closureId,
    id,
    patientId: 'p1',
  });

  it('activeClosures ignora os encerramentos revertidos', () => {
    const closures = [c('a', '2026-11-01T00:00:00Z'), c('b', '2026-11-03T00:00:00Z')];

    expect(activeClosures(closures, [r('r1', 'a', '2026-11-02T00:00:00Z')]).map(x => x.id)).toEqual(['b']);
  });

  it('buildHistory ordena por data/hora e liga cada reabertura ao encerramento', () => {
    const history = buildHistory(
      [c('b', '2026-11-03T00:00:00Z'), c('a', '2026-11-01T00:00:00Z')],
      [r('r1', 'a', '2026-11-02T00:00:00Z'), r('r2', 'zz', '2026-11-04T00:00:00Z')],
    );

    expect(history.map(e => (e.kind === 'closure' ? e.closure.id : e.reopening.id))).toEqual(['a', 'r1', 'b', 'r2']);
    expect(history[0].kind === 'closure' && history[0].reopening?.id).toBe('r1');
    expect(history[1].kind === 'reopening' && history[1].closure?.id).toBe('a');
    expect(history[3].kind === 'reopening' && history[3].closure).toBeNull();
  });
});
