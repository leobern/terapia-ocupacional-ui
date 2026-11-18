import { ProvisionalUserDirectory } from './provisional-user-directory';

describe('ProvisionalUserDirectory', () => {
  const directory = new ProvisionalUserDirectory();
  const names = async (term: string): Promise<string[]> => (await directory.search(term)).map(user => user.name);

  it('lists everyone for an empty term', async () => {
    expect((await names('')).length).toBeGreaterThan(3);
  });

  it('filters by part of the name, ignoring case and accents', async () => {
    expect(await names('JAI')).toEqual(['Jairo Nepomuceno']);
    expect(await names('nutr')).toEqual([]);
    expect(await names('filipp')).toEqual(['Filippa Martins']);
  });

  it('returns nothing when no one matches', async () => {
    expect(await names('zzz')).toEqual([]);
  });
});
