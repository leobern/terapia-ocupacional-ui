import { OutboxOperation, OutboxStatus } from './offline-store';
import { previewText, summaryText, syncLabel, worstStatus } from './sync-labels';

const op = (status: OutboxStatus): OutboxOperation => ({ opId: status, status }) as unknown as OutboxOperation;

describe('sync-labels', () => {
  it('escolhe o estado mais grave', () => {
    expect(worstStatus([])).toBeNull();
    expect(worstStatus([op('pending'), op('sending')])).toBe('sending');
    expect(worstStatus([op('pending'), op('failed'), op('conflict')])).toBe('conflict');
    expect(worstStatus([op('pending'), op('failed')])).toBe('failed');
  });

  it('descreve o estado por texto, vazio quando está tudo no servidor', () => {
    expect(syncLabel([])).toBe('');
    expect(syncLabel([op('pending')])).toBe('Pendente de sincronização');
    expect(syncLabel([op('failed')])).toBe('Não foi possível sincronizar');
  });

  it('resume as contagens', () => {
    expect(summaryText({ conflict: 0, failed: 0, pending: 0 })).toBe('');
    expect(summaryText({ conflict: 0, failed: 0, pending: 1 })).toBe('1 pendente de sincronização');
    expect(summaryText({ conflict: 1, failed: 2, pending: 3 })).toBe(
      '3 pendentes de sincronização · 2 com falha · 1 em conflito',
    );
  });

  it('mostra o conteúdo da gravação para o profissional reconhecê-la', () => {
    const withPayload = (type: OutboxOperation['type'], payload: object): OutboxOperation =>
      ({ payload, type }) as unknown as OutboxOperation;

    expect(previewText(withPayload('evolution-text', { text: 'Paciente estável' }))).toBe('Paciente estável');
    expect(previewText(withPayload('evolution-text', {}))).toBe('');
    expect(
      previewText(
        withPayload('parameters', {
          parameters: [
            { parameterId: 'glycemia', value: 132 },
            { parameterId: 'custom:albumina', parameterLabel: 'Albumina', unit: 'g/dL', value: 3.1 },
          ],
        }),
      ),
    ).toBe('glycemia: 132 · Albumina: 3.1 g/dL');
    expect(previewText(withPayload('parameters', {}))).toBe('');
    expect(
      previewText(withPayload('reevaluations', { reevaluations: [{ name: 'Diarreia' }, { name: 'Edema' }] })),
    ).toBe('Diarreia · Edema');
    expect(previewText(withPayload('reevaluations', {}))).toBe('');
  });
});
