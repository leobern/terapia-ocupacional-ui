import { ProvisionalAssessmentSource } from './provisional-assessment-source';

describe('ProvisionalAssessmentSource', () => {
  let source: ProvisionalAssessmentSource;

  beforeEach(() => {
    source = new ProvisionalAssessmentSource();
  });

  it('paciente sem avaliação volta null', async () => {
    expect(await source.loadLatest('p-vazio')).toBeNull();
  });

  it('p1 tem avaliação de exemplo com peso anterior', async () => {
    const seed = await source.loadLatest('p1');

    expect(seed?.values.weight).toBe('51,0');
    expect(seed?.previous.weight?.value).toBe('50,4');
  });

  it('primeira gravação não tem anterior', async () => {
    await source.save('p-novo', { weight: '60' });

    expect(await source.loadLatest('p-novo')).toEqual({ previous: {}, values: { weight: '60' } });
  });

  it('valor alterado vira o anterior, datado da gravação antiga', async () => {
    await source.save('p-novo', { weight: '60' });
    await source.save('p-novo', { weight: '62' });

    const result = await source.loadLatest('p-novo');

    expect(result?.values.weight).toBe('62');
    expect(result?.previous.weight?.value).toBe('60');
  });

  it('valor inalterado mantém o anterior; item esvaziado some', async () => {
    await source.save('p1', { handgrip: '14', height: '163', weight: '51,0' });

    let result = await source.loadLatest('p1');

    expect(result?.previous.weight?.value).toBe('50,4');

    await source.save('p1', { height: '163' });
    result = await source.loadLatest('p1');

    expect(result?.values).toEqual({ height: '163' });
    expect(result?.previous).toEqual({});
  });

  it('p1 com valor alterado guarda o valor do exemplo como anterior', async () => {
    await source.save('p1', { weight: '52,0' });

    expect((await source.loadLatest('p1'))?.previous.weight?.value).toBe('51,0');
  });
});
