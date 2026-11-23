import {
  authorGroupOf,
  formatIsoDate,
  groupLabel,
  isOverdue,
  NO_VALID_RECIPIENT_HINT,
  recipientsLabel,
  resolveRecipients,
  TeamMember,
  toIsoDate,
  validateRecipients,
} from './observation.models';

const TEAM: readonly TeamMember[] = [
  { group: 'medicos', id: 1, name: 'Ana' },
  { group: 'medicos', id: 2, name: 'Beto' },
  { group: 'enfermagem', id: 3, name: 'Carla' },
];

describe('observation.models', () => {
  it('resolve o grupo só para os vinculados ao paciente, sem repetir pessoas', () => {
    const resolved = resolveRecipients({ group: 'medicos', people: [TEAM[0], TEAM[2]] }, TEAM);

    expect(resolved.map(m => m.id)).toEqual([1, 2, 3]);
  });

  it('grupo sem vinculados e sem pessoas é inválido; com uma pessoa é válido', () => {
    expect(validateRecipients({ group: 'fisio', people: [] }, TEAM)).toBe(NO_VALID_RECIPIENT_HINT);
    expect(validateRecipients({ group: null, people: [] }, TEAM)).toBe(NO_VALID_RECIPIENT_HINT);
    expect(validateRecipients({ group: 'fisio', people: [TEAM[2]] }, TEAM)).toBeNull();
  });

  it('perfil do autor: médico → @medicos; demais → @nutris', () => {
    expect(authorGroupOf('doctor')).toBe('medicos');
    expect(authorGroupOf('other')).toBe('nutris');
  });

  it('vencida só depois do dia do prazo e só se não resolvida (borda)', () => {
    const today = new Date(2026, 10, 23, 10);

    expect(isOverdue({ dueDate: '2026-11-22', resolvedAt: null }, today)).toBeTrue();
    expect(isOverdue({ dueDate: '2026-11-23', resolvedAt: null }, today)).toBeFalse();
    expect(isOverdue({ dueDate: '2026-11-24', resolvedAt: null }, today)).toBeFalse();
    expect(isOverdue({ dueDate: '2026-11-22', resolvedAt: '2026-11-22T10:00:00Z' }, today)).toBeFalse();
  });

  it('formata datas e rótulos', () => {
    expect(toIsoDate(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(formatIsoDate('2026-01-05')).toBe('05/01/2026');
    expect(groupLabel('nutris')).toBe('@nutris');
    expect(groupLabel('x' as never)).toBe('@x');
    expect(recipientsLabel({ group: 'medicos', people: [TEAM[2]] })).toBe('@medicos, Carla');
    expect(recipientsLabel({ group: null, people: [] })).toBe('');
  });
});
