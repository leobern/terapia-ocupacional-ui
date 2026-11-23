import { ProvisionalUserDirectory } from './provisional-user-directory';

describe('ProvisionalUserDirectory', () => {
  const directory = new ProvisionalUserDirectory();
  const names = async (term: string): Promise<string[]> => (await directory.search(term)).map(user => user.name);

  it('lists everyone for an empty term', async () => {
    expect((await names('')).length).toBeGreaterThan(3);
  });

  it('filters by part of the name, ignoring case and accents', async () => {
    expect(await names('JAI')).toEqual(['Jairo Nepomuceno']);
    expect(await names('nutr')).toEqual(['nutricionistas']);
    expect(await names('filipp')).toEqual(['Filippa Martins']);
  });

  it('returns nothing when no one matches', async () => {
    expect(await names('zzz')).toEqual([]);
  });

  it('oferece @todos e grupos por perfil com a quantidade de vinculados que atingem', async () => {
    const groups = (await directory.search('')).filter(user => user.group);
    const byName = (name: string): number | undefined => groups.find(g => g.name === name)?.group?.memberCount;

    expect(byName('todos')).toBe(6);
    expect(byName('medicos')).toBe(2);
    expect(byName('psicologos')).toBe(0);
  });

  it('o grupo singular descreve "1 pessoa"', async () => {
    expect((await directory.search('enferm'))[0].specialty).toContain('1 pessoa)');
  });
});
